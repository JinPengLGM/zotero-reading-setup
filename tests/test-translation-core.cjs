const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const dir=path.join(__dirname,'..','src','reading-thoughts');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(dir,'translation-core.js'),'utf8'),ctx);
const {splitText,sseParser}=ctx.TranslationCore;
const text=('Robots learn from interaction. 测试机器人🤖处理文本。 A long sentence follows with references [14].\n\n').repeat(120);
const parts=splitText(text,2000);
assert(parts.length>1);
assert(parts.every(x=>x.length<=2000&&x.trim()));
assert.equal(parts.join(' ').replace(/\s+/g,' ').trim(),text.replace(/\s+/g,' ').trim());
assert(parts.every(x=>!/[\uD800-\uDBFF]$/.test(x)));
const wire='data: {"choices":[{"delta":{"reasoning_content":"not displayed"},"finish_reason":null}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"机器人"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{"content":"学习。"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
for(let chunkSize=1;chunkSize<45;chunkSize++){
 let output='',reasoning=0,finish='';
 const parser=sseParser(event=>{for(const c of event.choices||[]){output+=c.delta.content||'';reasoning+=(c.delta.reasoning_content||'').length;finish=c.finish_reason||finish;}});
 for(let i=0;i<wire.length;i+=chunkSize)parser.push(wire.slice(i,i+chunkSize));
 parser.push('',true);
 assert.equal(output,'机器人学习。');assert.equal(reasoning,13);assert.equal(finish,'stop');assert(parser.done);
}
let finish='';const truncated=sseParser(o=>{finish=o.choices[0].finish_reason;});
truncated.push('data: {"choices":[{"delta":{},"finish_reason":"length"}]}',true);
assert.equal(finish,'length');
assert.throws(()=>sseParser(()=>{}).push('data: {bad}\n\n'),/JSON/);
console.log('PASS: lossless chunking, Unicode boundaries, fragmented SSE, finish reasons and malformed data');
