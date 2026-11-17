const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','reading-thoughts','margin-number-core.js'),'utf8'),ctx);
const core=ctx.MarginNumberCore;
function fixture({numbers=true,irregular=false,inside=false}={}){
 const page={viewBox:[0,0,612,792],chars:[]};
 const word=(text,x,y,size)=>{for(let i=0;i<text.length;i++)page.chars.push({c:text[i],rect:[x+i*size/2,y,x+(i+1)*size/2,y+size],fontSize:size,baseline:y+1,wordBreakAfter:i===text.length-1,spaceAfter:i===text.length-1});};
 for(let row=0;row<12;row++){
  const y=700-row*12;
  if(numbers)word(String(irregular?row*7+1:row+1).padStart(3,'0'),inside?62:20,y,7);
  word('Result 2027 improves by 3.8% and 58.3%; reference [12].',60,y,10);
  if(numbers)word(String(irregular?row*3+81:row+101).padStart(3,'0'),inside?400:575,y,7);
 }
 return page;
}
const page=fixture(),model=core.detect(page);assert.equal(model.groups.length,2);assert.equal(model.indices.size,72);
const raw=core.textFromChars(page.chars).text,range={anchorOffset:0,headOffset:page.chars.length,text:raw};
const clean=core.cleanRange(page,range,model);assert.equal(clean.removed,72);assert.ok(!/\b001\b|\b101\b/.test(clean.text));assert.ok(clean.text.includes('2027'));assert.ok(clean.text.includes('3.8%'));assert.ok(clean.text.includes('58.3%'));assert.ok(clean.text.includes('[12]'));
assert.equal(core.cleanRange(page,{...range,anchorOffset:range.headOffset,headOffset:0},model).text,clean.text);
assert.equal(core.detect(fixture({numbers:false})).indices.size,0);
assert.equal(core.detect(fixture({irregular:true})).indices.size,0);
assert.equal(core.detect(fixture({inside:true})).indices.size,0);
const figure=fixture();for(const char of figure.chars)if(char.rect[0]>50&&char.rect[0]<570)char.fontSize=7;
assert.equal(core.detect(figure).indices.size,0);assert.equal(core.detect(figure,model.groups).indices.size,72);
const short=fixture();short.chars=short.chars.filter(char=>char.rect[1]>675);
assert.equal(core.detect(short).indices.size,0);assert.equal(core.detect(short,model.groups).indices.size,18);
const partial=core.cleanRange(page,{anchorOffset:1,headOffset:3,text:'01'},model);assert.equal(partial.text,'');assert.equal(partial.removed,2);
const unrelated={anchorOffset:3,headOffset:20,text:'Original whitespace  preserved'};assert.equal(core.cleanRange(page,unrelated,model).text,unrelated.text);
console.log('PASS: both margins, body years/percentages/citations, tables, irregular counters, reverse selections and partial numbers');
