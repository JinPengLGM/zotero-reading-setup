/* Translation transport and feedback, limited to the two configured engines.
 * No credentials are retained here or written to diagnostics. */
var TranslationFeedback = (() => {
  const prefix='extensions.zotero.ZoteroPDFTranslate.';
  const html='http://www.w3.org/1999/xhtml';
  const jobs=new Map(),cache=new Map(),panels=new Map();
  let addon,services,originalRun,wrappedRun,clock,timer,active,last,sequence=0;
  const pref=key=>Zotero.Prefs.get(prefix+key,true);
  const setText=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  const seconds=ms=>(ms/1000).toFixed(1)+' 秒';
  const engineName=service=>service==='googleapi'?'Google API':'DeepSeek Flash';
  const currentTask=()=>addon?.data.translate.queue.at(-1);
  const live=job=>job.task._readingTranslationJob===job.id;
  const supported=task=>task && ['text','custom'].includes(task.type) && (task.service==='googleapi'||task.service==='customgpt1'&&/^deepseek/i.test(pref('customGPT1.model')||''));
  function refresh(job,force=false) {
    if(job.options.noDisplay||job.task.type!=='text'||!live(job))return;
    if(!force&&Date.now()-(job.lastRefresh||0)<120)return;
    job.lastRefresh=Date.now();
    addon.hooks.onReaderTabPanelRefresh();
    render();
  }
  function publish(job) {
    let value='';
    for(let i=0;i<job.outputs.length;i++){
      if(!job.outputs[i])break;
      value+=(value?'\n\n':'')+job.outputs[i];
      if(!job.completed[i])break;
    }
    job.partial=value;
    if(live(job))job.task.result=value;
    refresh(job);
  }
  function abort(job,reason='已停止翻译') {
    if(!job||job.finished)return;
    job.cancelled=true;job.cancelReason=reason;
    for(const cancel of job.cancellers)try{cancel();}catch(_){}
    render();
  }
  async function request(job,method,url,options,onChunk) {
    if(job.cancelled)throw new Error(job.cancelReason);
    let localCancel,used=0,lastData=Date.now(),watchdog,timeoutMessage='';
    const started=Date.now();
    const progress=xhr=>{
      if(job.cancelled)return;
      lastData=Date.now();
      if(onChunk){const text=xhr.responseText||'';onChunk(text.slice(used),false);used=text.length;}
    };
    try{
      const response=await Zotero.HTTP.request(method,url,{
        ...options,timeout:60000,errorDelayMax:0,noRetryOnThrottle:true,
        cancellerReceiver:cancel=>{localCancel=cancel;job.cancellers.add(cancel);},
        requestObserver:xhr=>{
          xhr.addEventListener('readystatechange',()=>{if(xhr.readyState===2&&!job.headersMs)job.headersMs=Date.now()-job.started;});
          xhr.addEventListener('progress',()=>{try{progress(xhr);}catch(error){job.parseError=error;localCancel?.();}});
          watchdog=clock.setInterval(()=>{
            const now=Date.now();
            if(now-lastData>20000||now-started>60000){timeoutMessage=now-lastData>20000?'服务已 20 秒没有返回数据，请重试或切换服务':'本段翻译超过 60 秒，请重试或缩短选文';localCancel?.();}
          },500);
        }
      });
      if(job.cancelled)throw new Error(job.cancelReason);
      if(job.parseError)throw job.parseError;
      if(onChunk){const text=response.responseText||'';onChunk(text.slice(used),true);}
      return response;
    }catch(error){
      if(timeoutMessage)throw new Error(timeoutMessage);
      if(job.parseError)throw new Error('服务返回的数据格式异常，请重试');
      if(job.cancelled)throw new Error(job.cancelReason);
      const status=error.status||error.xmlhttp?.status;
      if(status===429)throw new Error('服务正在限流，请稍后重试或切换服务');
      if(status===401||status===403)throw new Error('服务拒绝了请求，请检查该服务的密钥或额度');
      if(status>=500)throw new Error('服务暂时不可用（HTTP '+status+'），请重试或切换服务');
      if(error.name==='TimeoutException')throw new Error('请求超时，请重试或切换服务');
      throw error;
    }finally{
      if(watchdog)clock.clearInterval(watchdog);
      if(localCancel)job.cancellers.delete(localCancel);
    }
  }
  async function google(job,part,index,secret) {
    const base=(secret||'https://translate.googleapis.com').replace(/\/$/,'');
    const url=base+'/translate_a/single?client=gtx&dt=t&sl='+encodeURIComponent(job.from)+'&tl='+encodeURIComponent(job.to)+'&q='+encodeURIComponent(part);
    const xhr=await request(job,'GET',url,{responseType:'json'});
    const rows=xhr.response?.[0];
    if(!Array.isArray(rows))throw new Error('Google 返回了无法识别的翻译结果');
    const result=rows.map(row=>row?.[0]||'').join('');
    if(!result.trim())throw new Error('Google 没有返回译文，请重试');
    if(!job.firstContentMs)job.firstContentMs=Date.now()-job.started;
    job.outputs[index]=result;
  }
  async function deepseek(job,part,index,secret) {
    const endpoint=pref('customGPT1.endPoint');
    const model=pref('customGPT1.model');
    const prompt=pref('customGPT1.prompt')||'Translate from ${langFrom} to ${langTo}. Only return the translation. ${sourceText}';
    const instruction=prompt.replaceAll('${sourceText}','').replaceAll('${langFrom}',job.from).replaceAll('${langTo}',job.to).trim();
    let custom={};try{custom=JSON.parse(pref('customGPT1.customParams')||'{}');}catch(_){}
    for(const k of ['model','messages','stream','temperature','max_tokens','thinking','reasoning_effort'])delete custom[k];
    const body={...custom,model,messages:[{role:'system',content:instruction},{role:'user',content:part}],temperature:parseFloat(pref('customGPT1.temperature')||'.2'),stream:true,thinking:{type:'disabled'},max_tokens:8192};
    let finishReason,seenEvent=false;
    const parser=TranslationCore.sseParser(event=>{
      seenEvent=true;
      if(event.error)throw new Error('服务返回错误，请重试');
      for(const choice of event.choices||[]){
        const delta=choice.delta||{};
        job.reasoningChars+=(delta.reasoning_content||'').length;
        const content=delta.content||'';
        if(content){
          if(!job.firstContentMs)job.firstContentMs=Date.now()-job.started;
          job.outputs[index]+=content;publish(job);
        }
        if(choice.finish_reason)finishReason=choice.finish_reason;
      }
    });
    const response=await request(job,'POST',endpoint,{headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify(body),responseType:'text'},(chunk,final)=>parser.push(chunk,final));
    if(!seenEvent){
      try{
        const data=JSON.parse(response.responseText);
        job.outputs[index]=data.choices?.[0]?.message?.content||'';
        finishReason=data.choices?.[0]?.finish_reason;
      }catch(_){}
    }
    if(finishReason==='length')throw new Error('服务用完输出额度，译文可能不完整；请缩短选文或使用 Google');
    if(!job.outputs[index].trim())throw new Error(job.reasoningChars?'服务返回了思考数据，但没有译文；请重试或使用 Google':'服务没有返回译文，请重试');
    if(!finishReason&&!parser.done)throw new Error('连接提前中断，译文尚未完成，请重试');
  }
  function createJob(task,options) {
    const from=task.type==='text'&&task.processed?pref('sourceLanguage'):task.langfrom||pref('sourceLanguage');
    const to=task.type==='text'&&task.processed?pref('targetLanguage'):task.langto||pref('targetLanguage');
    const job={id:++sequence,task,options,service:task.service,raw:task.raw,from:from||'auto',to:to||'zh-CN',started:Date.now(),cancellers:new Set(),reasoningChars:0,outputs:[],completed:[],finished:false};
    task._readingTranslationJob=job.id;jobs.set(job.id,job);
    if(jobs.size>80){for(const [id,j]of jobs){if(j.finished){jobs.delete(id);break;}}}
    return job;
  }
  async function perform(job) {
    const {task,options}=job;
    const identity=job.service==='customgpt1'?String(pref('customGPT1.endPoint'))+'|'+pref('customGPT1.model')+'|'+pref('customGPT1.prompt'):job.service;
    const key=JSON.stringify([identity,job.from,job.to,job.raw]);
    task.status='processing';task.result='';
    try{
      if(!options.noCache&&cache.has(key)){
        task.result=cache.get(key);job.partial=task.result;job.cached=true;
      }else{
        const secret=JSON.parse(pref('secretObj')||'{}')[job.service]||'';
        const parts=TranslationCore.splitText(job.raw,job.service==='googleapi'?4000:2000);
        job.outputs=parts.map(()=> '');job.completed=parts.map(()=>false);job.totalParts=parts.length;
        let next=0;
        const worker=async()=>{
          while(next<parts.length){
            if(job.cancelled)throw new Error(job.cancelReason);
            const index=next++;
            await (job.service==='googleapi'?google:deepseek)(job,parts[index],index,secret);
            job.completed[index]=true;publish(job);
          }
        };
        const workers=Array.from({length:Math.min(2,parts.length)},()=>worker());
        // Cancel sibling requests on failure and wait for them before finalizing.
        await Promise.all(workers.map(p=>p.catch(error=>{job.failure=job.failure||error;for(const cancel of job.cancellers)try{cancel();}catch(_){};throw error;}))).catch(async error=>{await Promise.allSettled(workers);throw job.failure||error;});
        if(job.cancelled)throw new Error(job.cancelReason);
        const value=job.outputs.join('\n\n').trim();
        if(!value)throw new Error('服务没有返回译文，请重试');
        job.partial=value;if(live(job))task.result=value;
        cache.set(key,value);if(cache.size>100)cache.delete(cache.keys().next().value);
      }
      job.phase='success';if(live(job))task.status='success';
    }catch(error){
      job.phase=job.cancelled?'cancelled':'fail';
      job.error=job.cancelled?'已停止翻译':(error.message||'网络请求失败，请重试').replace(/sk-[\w-]+/g,'[hidden]');
      if(live(job)){task.status='fail';task.result=job.partial||'';}
    }finally{
      job.finished=true;job.elapsedMs=Date.now()-job.started;
      if(live(job)){task.processed=true;task.langfrom=job.from;task.langto=job.to;}
      refresh(job,true);
      if(active===job)active=null;
      render();
    }
    return job.phase==='success';
  }
  function run(task,options={}) {
    task=task||currentTask();
    if(!supported(task))return originalRun.call(services,task,options);
    if(!task.raw?.trim())return Promise.resolve(false);
    const visible=task.type==='text'&&!options.noDisplay;
    if(visible&&active&&!active.finished){
      if(active.task===task&&active.service===task.service&&active.raw===task.raw&&active.from===(task.langfrom||pref('sourceLanguage'))&&active.to===(task.langto||pref('targetLanguage')))return active.promise;
      abort(active,'已切换到新的翻译请求');
    }
    const job=createJob(task,options);
    if(visible){active=job;last=job;}
    job.promise=perform(job);render();return job.promise;
  }
  function retry(service) {
    const source=currentTask();if(!source?.raw)return;
    const chosen=service||source.service;
    if(service)Zotero.Prefs.set(prefix+'translateSource',chosen,true);
    const task={id:Zotero.Utilities.randomString()+'-'+Date.now(),type:'text',raw:source.raw,result:'',audio:[],service:chosen,candidateServices:[],itemId:source.itemId,status:'waiting',extraTasks:[],langfrom:pref('sourceLanguage'),langto:pref('targetLanguage')};
    addon.data.translate.queue.push(task);addon.hooks.onReaderTabPanelRefresh();
    return run(task,{noCheckZoteroItemLanguage:true,noCache:!service});
  }
  const styleText=`
    .reading-translation-status{box-sizing:border-box;display:flex;flex-direction:column;gap:7px;margin:5px 0 8px;padding:10px 11px;border:1px solid #7894bd45;border-radius:9px;background:light-dark(#f3f6fa,#262e3b);font:12px/1.5 system-ui;color:inherit;flex:none;}
    .reading-translation-heading{display:flex;gap:7px;align-items:center;font-weight:600;}
    .reading-translation-dot{width:8px;height:8px;background:#4f85d0;border-radius:50%;flex:none;}
    .reading-translation-status[data-busy="true"] .reading-translation-dot{animation:reading-translation-pulse 1s ease-in-out infinite;}
    .reading-translation-status[data-phase="fail"] .reading-translation-dot{background:#ce6547;}
    .reading-translation-status[data-phase="success"] .reading-translation-dot{background:#4a9982;}
    .reading-translation-detail{opacity:.8;overflow-wrap:anywhere;}
    .reading-translation-controls{display:flex;flex-wrap:wrap;gap:7px;}
    .reading-translation-controls button{font:12px system-ui;border:1px solid #7894bd66;border-radius:6px;padding:4px 9px;color:inherit;background:transparent;cursor:pointer;}
    .reading-translation-controls button:hover{background:#7894bd20;}
    .reading-translation-status [hidden]{display:none!important;}
    @keyframes reading-translation-pulse{50%{opacity:.3;}}
    @media(prefers-reduced-motion:reduce){.reading-translation-dot{animation:none!important;}}
  `;
  function ensurePanel(panel) {
    if(panels.has(panel))return panels.get(panel);
    const doc=panel.ownerDocument;
    const language=panel.querySelector('[id$="-language"]');if(!language)return;
    if(!doc.getElementById('reading-translation-style')){
      const style=doc.createElementNS(html,'style');style.id='reading-translation-style';style.textContent=styleText;doc.documentElement.append(style);
    }
    const box=doc.createElementNS(html,'div');box.className='reading-translation-status';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
    const heading=doc.createElementNS(html,'div');heading.className='reading-translation-heading';
    const dot=doc.createElementNS(html,'span');dot.className='reading-translation-dot';
    const label=doc.createElementNS(html,'span');heading.append(dot,label);
    const detail=doc.createElementNS(html,'div');detail.className='reading-translation-detail';
    const controls=doc.createElementNS(html,'div');controls.className='reading-translation-controls';
    const button=(label,action)=>{const b=doc.createElementNS(html,'button');b.type='button';b.textContent=label;b.addEventListener('click',action);controls.append(b);return b;};
    const stop=button('停止',()=>abort(active));const again=button('重试',()=>retry());const googleButton=button('用 Google 快译',()=>retry('googleapi'));
    box.append(heading,detail,controls);language.after(box);
    const value={panel,box,label,detail,controls,stop,again,googleButton};panels.set(panel,value);return value;
  }
  function render() {
    if(!addon)return;
    const task=currentTask();const job=task&&jobs.get(task._readingTranslationJob);
    for(const win of Zotero.getMainWindows?.()||[]){
      for(const panel of win.document.querySelectorAll('translator-plugin-panel')){
        const ui=ensurePanel(panel);if(!ui)continue;
        const service=job?.service||task?.service||pref('translateSource');
        if(!['googleapi','customgpt1'].includes(service)){ui.box.hidden=true;continue;}
        ui.box.hidden=false;
        const busy=!!job&&!job.finished;
        const phase=job?.phase||(busy?'processing':task?.status||'waiting');
        const elapsed=job?(job.finished?job.elapsedMs:Date.now()-job.started):0;
        let label='选文后点击翻译',detail='Alt + Q 打开选区菜单，翻译结果只显示在这里';
        if(busy){
          label=job.firstContentMs?'正在生成译文':job.reasoningChars?'服务正在思考':job.headersMs?'已连接，等待译文':'正在连接翻译服务';
          const completed=job.completed.filter(Boolean).length;
          detail=job.totalParts>1?`已完成 ${completed}/${job.totalParts} 段 · 已生成 ${job.outputs.join('').length} 字`:`${job.raw.length} 字符 · ${job.firstContentMs?'译文正在更新':'等待首段译文'}`;
          if(elapsed>10000&&!job.firstContentMs)detail='等待较久，可以停止或改用 Google 快译';
        }else if(phase==='success'){
          label=job?.cached?'已完成 · 缓存命中':'翻译完成';detail=job?`译文 ${task.result.length} 字${job.firstContentMs?' · 首字 '+seconds(job.firstContentMs):''}`:`译文 ${task.result.length} 字`;
        }else if(phase==='fail'||phase==='cancelled'){
          label=phase==='cancelled'?'已停止':'翻译未完成';detail=job?.error||task?._readingTranslationError||'上次请求没有返回译文，请重试';
        }
        setText(ui.label,engineName(service)+' · '+label+(job?' · '+seconds(elapsed):''));setText(ui.detail,detail);
        ui.box.dataset.busy=String(busy);ui.box.dataset.phase=phase;
        ui.stop.hidden=!busy;ui.again.hidden=busy||!['fail','cancelled'].includes(phase);
        ui.googleButton.hidden=service!=='customgpt1'||!task?.raw;
        ui.controls.hidden=ui.stop.hidden&&ui.again.hidden&&ui.googleButton.hidden;
      }
    }
    for(const [panel]of panels){try{if(!panel.isConnected)panels.delete(panel);}catch(_){panels.delete(panel);}}
  }
  function install() {
    if(services)return;
    addon=Zotero.PDFTranslate;if(!addon?.data?.translate?.services)return;
    services=addon.data.translate.services;originalRun=services.runTranslationTask;
    wrappedRun=function(task,options){return run(task,options);};services.runTranslationTask=wrappedRun;
    for(const task of addon.data.translate.queue){if(task.status==='success'&&task.raw?.trim()&&!task.result?.trim()){task.status='fail';task._readingTranslationError='上次请求未返回译文，不能视为成功；请重试';}}
    Zotero.ReaderThoughtsTranslation={cancel:()=>abort(active),retry,metrics:()=>Array.from(jobs.values()).map(j=>({service:j.service,inputChars:j.raw.length,outputChars:j.partial?.length||0,totalParts:j.totalParts,completedParts:j.completed.filter(Boolean).length,phase:j.phase||'processing',elapsedMs:j.elapsedMs,firstContentMs:j.firstContentMs,headersMs:j.headersMs,reasoningChars:j.reasoningChars,cached:!!j.cached,error:j.error}))};
  }
  return {
    start(){clock=Zotero.getMainWindow();install();timer=clock.setInterval(()=>{try{install();render();}catch(error){Zotero.logError(error);}},250);render();},
    stop(){
      if(timer)clock.clearInterval(timer);for(const job of jobs.values())abort(job,'扩展已重新加载');
      if(services?.runTranslationTask===wrappedRun)services.runTranslationTask=originalRun;
      for(const {box}of panels.values())try{box.remove();}catch(_){}
      for(const win of Zotero.getMainWindows?.()||[])win.document.getElementById('reading-translation-style')?.remove();
      delete Zotero.ReaderThoughtsTranslation;panels.clear();
    }
  };
})();
