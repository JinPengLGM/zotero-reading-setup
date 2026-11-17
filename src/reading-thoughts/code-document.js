/* Offline, inert HTML snapshots of source files. No imported code is executed. */
var CodeDocument = (() => {
  const extensions={
    py:'python',pyi:'python',pyw:'python',c:'c',h:'cpp',cc:'cpp',cpp:'cpp','c++':'cpp',cxx:'cpp',hpp:'cpp',hxx:'cpp',cu:'cpp',cuh:'cpp',
    js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',java:'java',
    rs:'rust',go:'go',r:'r',rb:'ruby',php:'php',cs:'csharp',swift:'swift',kt:'kotlin',kts:'kotlin',lua:'lua',pl:'perl',pm:'perl',
    sh:'bash',bash:'bash',zsh:'bash',fish:'shell',sql:'sql',json:'json',jsonl:'json',yaml:'yaml',yml:'yaml',toml:'ini',ini:'ini',cfg:'ini',
    html:'xml',htm:'xml',xml:'xml',svg:'xml',css:'css',scss:'scss',less:'less',md:'markdown',markdown:'markdown',
    diff:'diff',patch:'diff',mk:'makefile',graphql:'graphql',gql:'graphql',txt:'plaintext',log:'plaintext',
    m:'matlab',jl:'julia',ps1:'powershell',psm1:'powershell',cmake:'cmake',proto:'protobuf'
  };
  const labels={python:'Python',c:'C',cpp:'C++ / CUDA',javascript:'JavaScript',typescript:'TypeScript',java:'Java',rust:'Rust',go:'Go',r:'R',ruby:'Ruby',php:'PHP',csharp:'C#',swift:'Swift',kotlin:'Kotlin',lua:'Lua',perl:'Perl',bash:'Shell / Bash',shell:'Shell',sql:'SQL',json:'JSON',yaml:'YAML',ini:'INI / TOML',xml:'HTML / XML',css:'CSS',scss:'SCSS',less:'Less',markdown:'Markdown',diff:'Diff',makefile:'Makefile',graphql:'GraphQL',plaintext:'纯文本',matlab:'MATLAB',julia:'Julia',powershell:'PowerShell',cmake:'CMake',protobuf:'Protocol Buffers',dockerfile:'Dockerfile'};
  const escape=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  function language(name){
    const base=name.split(/[\\/]/).at(-1).toLowerCase();
    if(base==='makefile'||base==='gnumakefile')return 'makefile';
    if(base==='dockerfile'||base.startsWith('dockerfile.'))return 'dockerfile';
    if(base==='cmakelists.txt')return 'cmake';
    if(base==='.bashrc'||base==='.zshrc')return 'bash';
    return extensions[base.split('.').at(-1)]||'plaintext';
  }
  function isSupported(name){return language(name)!=='plaintext'||/\.(txt|log)$/i.test(name);}
  function decode(bytes){
    if(bytes.length>2*1024*1024)throw new Error('单个代码文件请控制在 2 MB 内，较大项目可按文件分开导入');
    let encoding='utf-8',offset=0;
    if(bytes[0]===0xff&&bytes[1]===0xfe){encoding='utf-16le';offset=2;}
    else if(bytes[0]===0xfe&&bytes[1]===0xff){encoding='utf-16be';offset=2;}
    else {
      const header=String.fromCharCode(...bytes.slice(0,200)).split(/\r?\n/).slice(0,2).join('\n');
      const declared=header.match(/coding\s*[:=]\s*([-\w.]+)/i);
      if(declared)encoding=declared[1];
    }
    let text;
    try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes.slice(offset));}
    catch(error){
      if(encoding!=='utf-8')throw new Error('无法读取声明的字符编码：'+encoding);
      try{text=new TextDecoder('gb18030',{fatal:true}).decode(bytes);encoding='GB18030';}
      catch(_){throw new Error('无法识别文本编码，请先将文件保存为 UTF-8');}
    }
    if(text.includes('\0'))throw new Error('这不是可阅读的源码文本文件');
    return {text:text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'),encoding};
  }
  function outline(text,lang){
    const entries=[];
    text.split('\n').forEach((line,index)=>{
      if(entries.length>=180)return;
      let m;
      if(['python','ruby'].includes(lang))m=line.match(/^\s*(?:(?:async|public|private)\s+)?(def|class|module)\s+([\w.]+)/);
      else if(lang==='rust')m=line.match(/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|unsafe)\s+)?(fn|struct|enum|trait|impl)\s+([\w:<>, ]+)/);
      else if(lang==='go')m=line.match(/^\s*(func|type)\s+(?:\([^)]*\)\s*)?([\w]+)/);
      else if(['javascript','typescript'].includes(lang))m=line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([\w$]+)/)||line.match(/^\s*(?:export\s+)?(const|let)\s+([\w$]+)\s*=.*=>/);
      else m=line.match(/^\s*(?:(?:public|private|protected|static|abstract|export|async|final)\s+)*(class|struct|interface|enum|function)\s+([\w$]+)/)||line.match(/^\s*(?:[\w:*&<>\[\]]+\s+)+([\w:~]+)\s*\([^;]*\)\s*(?:const\s*)?\{/);
      if(m)entries.push({line:index+1,title:m[2]?m[1]+' '+m[2].trim():m[1]});
    });
    return entries;
  }
  function lineMarkup(html){
    const stack=[],lines=[];let current='';
    for(const part of html.split(/(<span\b[^>]*>|<\/span>|\n)/g)){
      if(part==='\n'){lines.push(current+'</span>'.repeat(stack.length));current=stack.join('');}
      else if(part.startsWith('<span')){stack.push(part);current+=part;}
      else if(part==='</span>'){stack.pop();current+=part;}
      else current+=part;
    }
    lines.push(current);
    return lines.map((line,i)=>`<span class="code-line" id="L${i+1}" data-line="${i+1}">${line}</span>`).join('\n');
  }
  const css=`
    :root{color-scheme:light dark;--paper:#fbfaf7;--ink:#28333d;--muted:#75808b;--border:#dddfe2;--panel:#f3f4f5;--accent:#36796c;--keyword:#8156a5;--string:#357e62;--number:#b46a36;--comment:#81909a;--title:#2c6d9f}
    @media(prefers-color-scheme:dark){:root{--paper:#20252c;--ink:#d7dee7;--muted:#929fae;--border:#3b4552;--panel:#272e38;--accent:#82c6b1;--keyword:#c5a3e6;--string:#9accad;--number:#e6ba8c;--comment:#93a0ae;--title:#93c6f1}}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.7 system-ui,"Microsoft YaHei",sans-serif}article{max-width:1120px;margin:auto;padding:32px 24px 80px}header{padding-bottom:22px;border-bottom:1px solid var(--border)}.eyebrow{font-size:11px;letter-spacing:.16em;font-weight:650;color:var(--accent);margin:0 0 10px}h1{font-size:25px;line-height:1.4;font-weight:650;overflow-wrap:anywhere;margin:0 0 10px}.meta{font-size:12px;color:var(--muted);margin:0}.hint{font-size:12px;color:var(--muted);margin:10px 0 0}nav{margin:20px 0;padding:12px 16px;background:var(--panel);border:1px solid var(--border);border-radius:9px}summary{font-size:13px;font-weight:600;cursor:pointer}nav ol{margin:10px 0 0;padding-left:22px;columns:2;column-width:210px}nav li{font-size:12px;break-inside:avoid;padding:3px 0}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}h2{font-size:13px;letter-spacing:.08em;margin:24px 0 14px;color:var(--muted)}pre{margin:0;border:1px solid var(--border);border-radius:10px;padding:15px 0;white-space:normal;background:var(--paper)}code{display:block;white-space:normal;font:13px/1.85 "Cascadia Code",Consolas,"Liberation Mono",monospace;tab-size:4}.code-line{display:block;position:relative;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.85em;padding:0 16px 0 4.5em;scroll-margin-top:24px}.code-line::before{content:attr(data-line);position:absolute;left:0;width:3.4em;text-align:right;color:var(--muted);font-size:11px;line-height:2.18;user-select:none}.code-line:target{background:#d9b95426}.hljs-comment,.hljs-quote{color:var(--comment);font-style:italic}.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-meta{color:var(--keyword)}.hljs-string,.hljs-regexp,.hljs-addition{color:var(--string)}.hljs-number,.hljs-symbol,.hljs-attr{color:var(--number)}.hljs-title,.hljs-section,.hljs-name,.hljs-built_in,.hljs-type{color:var(--title)}.hljs-deletion{color:#b85b63}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}@media(max-width:600px){article{padding:22px 12px 60px}h1{font-size:21px}code{font-size:12px}.code-line{padding-left:3.7em;padding-right:10px}.code-line::before{width:2.8em}}`;
  function render({name,text,encoding='UTF-8'}){
    text=text.replace(/\r\n?/g,'\n');
    const lineCount=text.split('\n').length;
    if(lineCount>20000)throw new Error('代码超过 20000 行，请拆成几个文件后导入');
    const lang=language(name),label=labels[lang]||lang;
    let markup=escape(text),highlighted=false;
    if(text.length<=300000&&hljs.getLanguage(lang)){
      try{markup=hljs.highlight(text,{language:lang,ignoreIllegals:true}).value;highlighted=lang!=='plaintext';}catch(_){}
    }
    const entries=outline(text,lang);
    const toc=entries.length?`<nav aria-label="代码目录"><details open><summary>代码目录 · ${entries.length} 处定义</summary><ol>${entries.map(e=>`<li><a href="#L${e.line}">${escape(e.title)} <small>· L${e.line}</small></a></li>`).join('')}</ol></details></nav>`:'';
    const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="reading-thoughts-code" content="1"><title>${escape(name)} · 代码阅读</title><style>${css}</style></head><body><article><header><p class="eyebrow">CODE READER / ${escape(label)}</p><h1>${escape(name)}</h1><p class="meta">${escape(label)} · ${lineCount} 行 · ${escape(encoding)}${highlighted?' · 语法高亮':''}</p><p class="hint">选中代码后按 Alt + Q：写思路、添加到对话、翻译。使用阅读器搜索可查找变量与函数。</p></header>${toc}<h2>源码</h2><pre><code>${lineMarkup(markup)}</code></pre></article></body></html>`;
    return {html,language:lang,label,lineCount,highlighted};
  }
  return {language,isSupported,decode,render,extensions,labels};
})();
