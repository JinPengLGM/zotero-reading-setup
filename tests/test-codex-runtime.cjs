const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path').win32;
const source=fs.readFileSync(require('node:path').join(__dirname,'..','src','reading-thoughts','codex-runtime.js'),'utf8');
const root='C:\\Users\\test\\AppData\\Local\\OpenAI\\Codex\\bin';
const old=path.join(root,'1111111111111111','codex.exe'),fresh=path.join(root,'2222222222222222','codex.exe'),newest=path.join(root,'3333333333333333','codex.exe');
async function scenario({initial=old,valid=false,available=true,race=false}={}){
 let value=initial,writes=0,saved=0,scans=0;
 const ctx={Zotero:{Prefs:{get:()=>value,set:(k,v)=>{writes++;value=v;}},getMainWindow:()=>({setInterval:()=>1,clearInterval(){}}),logError(e){throw e;}},PathUtils:{join:path.join,filename:path.basename},Services:{prefs:{savePrefFile(){saved++;}}},IOUtils:{
  exists:async p=>p===old?valid:available&&[fresh,newest].includes(p),
  getChildren:async()=>{scans++;if(race)value='D:\\manual\\codex.exe';return available?[path.dirname(fresh),path.dirname(newest),path.join(root,'not-a-runtime')]:[];},
  stat:async p=>({type:'regular',size:10,lastModified:p===newest?2:1})
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.CodexRuntimeRepair.start();ctx.CodexRuntimeRepair.stop();return {value,writes,saved,scans};
}
(async()=>{
 assert.deepEqual(await scenario(),{value:newest,writes:1,saved:1,scans:1});
 assert.equal((await scenario({valid:true})).writes,0);
 assert.equal((await scenario({initial:''})).scans,0);
 assert.equal((await scenario({initial:'D:\\manual\\codex.exe'})).scans,0);
 assert.equal((await scenario({available:false})).writes,0);
 const concurrent=await scenario({race:true});assert.equal(concurrent.value,'D:\\manual\\codex.exe');assert.equal(concurrent.writes,0);
 console.log('PASS: missing desktop runtime repaired; valid/custom/automatic settings preserved; absent candidates and concurrent user edits handled');
})().catch(e=>{console.error(e);process.exitCode=1;});
