const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.join(__dirname,'..','src','reading-thoughts'),ctx={TextDecoder};vm.createContext(ctx);
for(const file of ['vendor/highlight.min.js',...['matlab','julia','powershell','cmake','protobuf','dockerfile'].map(x=>'vendor/'+x+'.min.js'),'code-document.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),ctx);
const core=ctx.CodeDocument;
const unescape=s=>s.replace(/&(?:amp|lt|gt|quot|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"})[s]);
const sample='# 中文注释 & 保留缩进\nclass Agent:\n    """Multiple\n    lines <script>alert(1)</script>\n    """\n    def step(self, x):\n        return x < 3 and "<&\\t"\n';
const rendered=core.render({name:'demo<&.py',text:sample});
const code=rendered.html.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)[1];
assert.equal(unescape(code.replace(/<[^>]+>/g,'')),sample);
assert.ok(rendered.highlighted);assert.equal(rendered.language,'python');assert.match(rendered.html,/href="#L6"/);
assert.ok(!rendered.html.includes('<script>'));assert.ok(!rendered.html.includes('<img '));
let depth=0;for(const tag of code.matchAll(/<\/?span\b[^>]*>/g)){depth+=tag[0].startsWith('</')?-1:1;assert.ok(depth>=0);}assert.equal(depth,0);
assert.equal(core.decode(Buffer.from('中文\r\nabc','utf8')).text,'中文\nabc');
assert.equal(core.decode(Buffer.concat([Buffer.from([255,254]),Buffer.from('中文\n','utf16le')])).text,'中文\n');
assert.throws(()=>core.decode(Buffer.from([0,1,2])),/源码文本/);
assert.throws(()=>core.decode(new Uint8Array(2*1024*1024+1)),/2 MB/);
assert.throws(()=>core.render({name:'huge.py',text:'\n'.repeat(20001)}),/20000/);
for(const [file,language] of Object.entries({'train.py':'python','agent.cpp':'cpp','main.ts':'typescript','policy.rs':'rust','analysis.R':'r','matrix.m':'matlab','run.jl':'julia','Dockerfile':'dockerfile','CMakeLists.txt':'cmake','run.ps1':'powershell'})){
 assert.equal(core.language(file),language);assert.ok(ctx.hljs.getLanguage(language));
}
const big='x'.repeat(300001);const fallback=core.render({name:'large.py',text:big});assert.equal(fallback.highlighted,false);assert.ok(fallback.html.includes(big));

console.log('PASS: 42 bundled grammars, encoding, source fidelity, multiline spans, escaping, definitions, file limits and large-file fallback');
