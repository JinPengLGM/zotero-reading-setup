/* Native paste-first source editor. Only the saved source is rendered. */
var CodeEditor = (() => {
  const preferred={python:'py',cpp:'cpp',c:'c',javascript:'js',typescript:'ts',java:'java',rust:'rs',go:'go',r:'r',matlab:'m',julia:'jl',bash:'sh',powershell:'ps1',sql:'sql',json:'json',yaml:'yaml',ini:'toml',xml:'html',markdown:'md',plaintext:'txt',dockerfile:'Dockerfile',makefile:'Makefile',cmake:'CMakeLists.txt',protobuf:'proto'};
  const editors=new Set();let enabled=true;
  function extension(language){return preferred[language]||Object.keys(CodeDocument.extensions).find(ext=>CodeDocument.extensions[ext]===language)||'txt';}
  function filename(name,language='python'){
    name=String(name||'').trim();
    if(!name)name='untitled';
    if(name.length>160||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw new Error('请使用有效的文件名，例如 main.py 或 main.cpp');
    if(!name.includes('.')&&!['Dockerfile','Makefile','CMakeLists.txt'].includes(name)){
      const ext=extension(language);name=ext.includes('.')||/^[A-Z]/.test(ext)?ext:name+'.'+ext;
    }
    if(!CodeDocument.isSupported(name))throw new Error('请使用支持的文件扩展名，例如 .py、.cpp、.c、.js');
    return name;
  }
  function open(parent,save,initial={}){
    enabled=true;
    const win=parent.openDialog('about:blank','reading-thoughts-new-code-'+Zotero.Utilities.randomString(),'chrome,dialog=no,resizable,centerscreen,width=980,height=720');
    editors.add(win);
    let dirty=!!initial.text,busy=false,ready=false;
    function init(){
      if(ready||win.closed)return;ready=true;
      const doc=win.document;doc.title='新建代码文档';doc.documentElement.lang='zh-CN';
      const element=(tag,attributes={},text)=>{const node=doc.createElementNS('http://www.w3.org/1999/xhtml',tag);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;};
      const style=element('style');style.textContent=`
        :root{color-scheme:light dark;--bg:#f7f8fa;--panel:#fff;--ink:#263240;--muted:#74808c;--line:#dbe1e8;--accent:#426b94}
        @media(prefers-color-scheme:dark){:root{--bg:#20252d;--panel:#252d37;--ink:#e2e8f0;--muted:#a1aebc;--line:#45515f;--accent:#89b3de}}
        *{box-sizing:border-box}html,body{height:100%;margin:0}body{min-width:620px;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,"Microsoft YaHei",sans-serif;padding:24px;display:flex;flex-direction:column;gap:16px}h1{font-size:21px;margin:0;font-weight:650}header p{color:var(--muted);font-size:12px;margin:5px 0 0}.fields{display:grid;grid-template-columns:1fr 240px;gap:18px}label{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:600}input,select,textarea,button{font:inherit;color:var(--ink)}input,select{height:38px;border:1px solid var(--line);border-radius:7px;background:var(--panel);padding:7px 10px}input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:1px}.source{flex:1;min-height:180px}textarea{flex:1;min-height:180px;width:100%;resize:none;white-space:pre;tab-size:4;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:16px;font:14px/1.7 "Cascadia Code",Consolas,monospace;font-weight:400}footer{display:flex;align-items:center;justify-content:space-between;gap:20px}.stats{font-size:12px;color:var(--muted)}.buttons{display:flex;gap:10px}button{border:1px solid var(--line);border-radius:7px;padding:9px 16px;background:var(--panel);cursor:pointer}button.primary{background:#426b94;border-color:#426b94;color:#fff;font-weight:600}button:disabled{opacity:.6;cursor:wait}#code-error{font-size:12px;color:#bd5547;min-height:18px}#code-error:empty{display:none}`;
      doc.head.append(style);
      // Privileged Gecko documents sanitize form controls inserted with innerHTML.
      // Build controls directly so none are dropped before listeners are attached.
      const header=element('header');header.append(element('h1',{},'新建代码文档'),element('p',{},'粘贴代码，保存后即可像文章一样阅读和批注。'));
      const fields=element('section',{class:'fields'}),nameLabel=element('label',{},'文件名'),languageLabel=element('label',{},'语言');
      const nameInput=element('input',{id:'code-name','aria-label':'文件名',autocomplete:'off'});nameInput.value=initial.name||'untitled.py';
      // A top-level Gecko chrome window has no browser actor for HTML select popups.
      // Use ordinary HTML buttons for the list so mouse and keyboard work here.
      languageLabel.style.position='relative';
      const languageButton=element('button',{id:'code-language',type:'button','aria-label':'代码语言','aria-haspopup':'listbox','aria-expanded':'false'});
      const languageOptions=element('div',{id:'code-language-options',role:'listbox',hidden:''});
      nameLabel.append(nameInput);languageLabel.append(languageButton,languageOptions);fields.append(nameLabel,languageLabel);
      style.textContent+=`.fields #code-language{height:38px;padding:7px 10px;text-align:left;font-size:14px;font-weight:400}#code-language::after{content:'▾';float:right}#code-language-options{position:absolute;top:66px;left:0;right:0;max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:7px;background:var(--panel);box-shadow:0 8px 24px #0002;z-index:10}#code-language-options[hidden]{display:none}#code-language-options button{display:block;width:100%;border:0;border-radius:0;text-align:left;padding:8px 10px;font-size:13px;font-weight:400}#code-language-options button:hover,#code-language-options button:focus{background:var(--bg);outline:2px solid var(--accent);outline-offset:-2px}`;
      const sourceLabel=element('label',{class:'source'},'代码'),textarea=element('textarea',{id:'code-source','aria-label':'代码内容',spellcheck:'false',wrap:'off',placeholder:'把代码粘贴到这里…'});textarea.value=initial.text||'';sourceLabel.append(textarea);
      const footer=element('footer'),stats=element('div',{class:'stats'}),buttons=element('div',{class:'buttons'});
      stats.append(element('span',{id:'code-stats'},'0 行 · 0 字符'),element('br'),doc.createTextNode('Ctrl + Enter 创建并阅读 · Tab 缩进'));
      buttons.append(element('button',{id:'code-cancel',type:'button'},'取消'),element('button',{id:'code-save',class:'primary',type:'button'},'创建并阅读'));footer.append(stats,buttons);
      doc.body.replaceChildren(header,fields,sourceLabel,element('div',{id:'code-error',role:'alert'}),footer);
      const name=doc.getElementById('code-name'),language=doc.getElementById('code-language'),source=doc.getElementById('code-source'),button=doc.getElementById('code-save'),error=doc.getElementById('code-error');
      const order=['python','cpp','c','javascript','typescript','java','rust','go','r','matlab','julia','bash','powershell',...Object.keys(CodeDocument.labels)];
      const languageText=key=>CodeDocument.labels[key]+' (.'+extension(key)+')';
      const setLanguage=key=>{language.value=key;language.textContent=languageText(key);};
      const showLanguages=show=>{languageOptions.hidden=!show;language.setAttribute('aria-expanded',String(show));};
      const chooseLanguage=key=>{
        setLanguage(key);showLanguages(false);
        const ext=extension(key);name.value=ext.includes('.')||/^[A-Z]/.test(ext)?ext:(name.value.replace(/\.[^.]*$/,'')||'untitled')+'.'+ext;
        update();language.focus();
      };
      for(const key of new Set(order)){
        const option=element('button',{type:'button',role:'option','data-language':key},languageText(key));
        option.addEventListener('click',()=>chooseLanguage(key));languageOptions.append(option);
      }
      setLanguage(CodeDocument.isSupported(name.value)?CodeDocument.language(name.value):'python');
      const update=()=>{dirty=true;error.textContent='';doc.getElementById('code-stats').textContent=(source.value?source.value.split('\n').length:0)+' 行 · '+source.value.length+' 字符';};
      source.addEventListener('input',update);
      name.addEventListener('input',()=>{update();if(CodeDocument.isSupported(name.value))setLanguage(CodeDocument.language(name.value));});
      language.addEventListener('click',()=>showLanguages(languageOptions.hidden));
      doc.addEventListener('click',event=>{if(!languageLabel.contains(event.target))showLanguages(false);});
      languageLabel.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();showLanguages(false);language.focus();}
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){
          event.preventDefault();showLanguages(true);const buttons=Array.from(languageOptions.children),index=buttons.indexOf(doc.activeElement);
          buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
        }
      });
      const submit=async()=>{
        if(busy)return;
        error.textContent='';
        if(!enabled){error.textContent='扩展已停用，请先复制保留代码，再重新打开编辑器';return;}
        if(!source.value.trim()){error.textContent='请先粘贴或输入代码';source.focus();return;}
        let target;try{target=filename(name.value,language.value);}catch(e){error.textContent=e.message;name.focus();return;}
        busy=true;button.disabled=true;button.textContent='正在创建…';
        try{await save({name:target,text:source.value});dirty=false;win.close();}
        catch(e){error.textContent=e.message||'创建失败，请重试';}
        finally{busy=false;if(!win.closed){button.disabled=false;button.textContent='创建并阅读';}}
      };
      button.addEventListener('click',submit);doc.getElementById('code-cancel').addEventListener('click',()=>win.close());
      doc.addEventListener('keydown',event=>{
        if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();submit();}
        if(event.key==='Tab'&&event.target===source&&!event.shiftKey){event.preventDefault();source.setRangeText('    ',source.selectionStart,source.selectionEnd,'end');update();}
      });
      win.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
      win.addEventListener('unload',()=>editors.delete(win),{once:true});
      if(initial.text)update();
      win.setTimeout(()=>source.focus(),50);
    }
    if(win.document.readyState==='complete')init();else win.addEventListener('load',init,{once:true});
    return win;
  }
  return {open,filename,stop(){enabled=false;for(const win of editors)try{if(!win.closed)win.document.getElementById('code-error').textContent='扩展已停用，请复制保留尚未保存的代码';}catch(_){}}};
})();
