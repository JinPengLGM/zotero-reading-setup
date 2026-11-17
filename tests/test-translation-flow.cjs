const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.join(__dirname,'..','src','reading-thoughts');let httpCalls=0,mode='success';
const pref={'sourceLanguage':'en-US','targetLanguage':'zh-CN','customGPT1.model':'deepseek-flash','customGPT1.endPoint':'http://test.invalid/v1/chat/completions','secretObj':'{}'};
const clock={setInterval(fn,ms){const t=setInterval(fn,ms);t.unref();return t;},clearInterval};
const queue=[],services={async runTranslationTask(){throw Error('Unexpected native fallback');}};
const Zotero={Prefs:{get:k=>pref[k.replace('extensions.zotero.ZoteroPDFTranslate.','')],set:(k,v)=>pref[k.replace('extensions.zotero.ZoteroPDFTranslate.','')]=v},getMainWindow:()=>clock,getMainWindows:()=>[],logError(){},Utilities:{randomString:()=>String(Math.random())},PDFTranslate:{data:{translate:{queue,services}},hooks:{onReaderTabPanelRefresh(){}}},HTTP:{request(method,url,options){
 httpCalls++;const currentMode=mode;
 return new Promise((resolve,reject)=>{
  let cancelled=false;const listeners={};const xhr={readyState:1,responseText:'',status:200,addEventListener:(name,fn)=>listeners[name]=fn};
  options.cancellerReceiver(()=>{cancelled=true;reject(Error('cancelled'));});options.requestObserver(xhr);
  setTimeout(()=>{
   if(cancelled)return;
   if(currentMode==='rate-limit'){const e=Error('rate limited');e.status=429;reject(e);return;}
   xhr.readyState=2;listeners.readystatechange?.();
   if(method==='GET'){xhr.response=[[['谷歌译文']]];resolve(xhr);return;}
   let choices=currentMode==='empty'?[{delta:{reasoning_content:'hidden'},finish_reason:'length'}]:[{delta:{content:'第一句。'},finish_reason:null},{delta:{content:'第二句。'},finish_reason:'stop'}];
   const data=choices.map(choice=>'data: '+JSON.stringify({choices:[choice]})+'\n\n').join('')+'data: [DONE]\n\n';
   xhr.responseText=data.slice(0,31);listeners.progress?.();
   xhr.responseText=data;listeners.progress?.();resolve(xhr);
  },currentMode==='slow'?120:10);
 });
}}};
const ctx={Zotero,console};vm.createContext(ctx);for(const file of ['translation-core.js','translation-feedback.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx);
ctx.TranslationFeedback.start();
const task=(raw,service='customgpt1')=>({id:Math.random()+'',type:'text',raw,result:'',audio:[],service,candidateServices:[],extraTasks:[],status:'waiting'});
const run=t=>{queue.push(t);return services.runTranslationTask(t,{});};
(async()=>{
 let t=task('Translate one sentence');await run(t);assert.equal(t.result,'第一句。第二句。');assert.equal(t.status,'success');
 const calls=httpCalls;t=task('Translate one sentence');await run(t);assert.equal(httpCalls,calls);assert.equal(t.status,'success');
 mode='empty';t=task('Empty response');await run(t);assert.equal(t.status,'fail');assert.equal(t.result,'');assert.match(Zotero.ReaderThoughtsTranslation.metrics().at(-1).error,/输出额度/);
 mode='rate-limit';t=task('Rate limited');await run(t);assert.equal(t.status,'fail');assert.match(Zotero.ReaderThoughtsTranslation.metrics().at(-1).error,/限流/);
 mode='slow';const old=task('Old request');const pending=run(old);Zotero.ReaderThoughtsTranslation.cancel();await pending;assert.equal(old.status,'fail');assert.equal(Zotero.ReaderThoughtsTranslation.metrics().at(-1).phase,'cancelled');
 const replaced=task('Replaced request');const first=run(replaced);mode='success';const newest=task('Newest request','googleapi');await run(newest);await first;assert.equal(newest.result,'谷歌译文');assert.equal(newest.status,'success');assert.equal(replaced.result,'');
 mode='slow';const same=task('Repeated click');queue.push(same);const before=httpCalls;await Promise.all([services.runTranslationTask(same,{}),services.runTranslationTask(same,{})]);assert.equal(httpCalls,before+1);
 ctx.TranslationFeedback.stop();console.log('PASS: streaming, cache, empty/truncated results, rate-limit errors, cancellation, stale result isolation and request deduplication');
})().catch(e=>{ctx.TranslationFeedback.stop();console.error(e);process.exitCode=1;});
