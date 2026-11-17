const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.join(__dirname,'..','src','reading-thoughts');
const config=fs.readFileSync(path.join(dir,'preset-config.json'),'utf8');
const source=fs.readFileSync(path.join(dir,'setup-preset.js'),'utf8');
const key='extensions.zotero.llmforzotero.sidebarLayout';
const secrets='extensions.zotero.ZoteroPDFTranslate.secretObj';
const model='extensions.zotero.llmforzotero.codexAppServerModel';
const values=new Map([[key,'stacked'],[secrets,'local-private-placeholder']]);
const defaults=new Map([[model,'upstream-default']]);
let saved=0;
const clock={setInterval:()=>1,clearInterval(){}};
const ctx={Object,JSON,Zotero:{Prefs:{get:k=>values.has(k)?values.get(k):defaults.get(k),set:(k,v)=>values.set(k,v)},File:{getContentsAsync:async url=>url.endsWith('.css')?'/* reader only */':config},getMainWindow:()=>clock,getMainWindows:()=>[]},Services:{prefs:{prefHasUserValue:k=>values.has(k),clearUserPref:k=>values.delete(k),savePrefFile:()=>saved++}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
 await ctx.ReadingSetupPreset.start('jar:fixture!/');
 assert.equal(values.get(key),'independent');assert.equal(values.get(secrets),'local-private-placeholder');
 assert.ok(values.has(model));assert.ok(saved);
 const backup=values.get('extensions.zotero.readingThoughts.setupBackup');
 assert.ok(!backup.includes(secrets));assert.ok(!backup.includes('local-private-placeholder'));
 ctx.Zotero.ReaderThoughtsSetup.apply();assert.equal(values.get('extensions.zotero.readingThoughts.setupBackup'),backup);
 ctx.Zotero.ReaderThoughtsSetup.restore();assert.equal(values.get(key),'stacked');assert.equal(values.has(model),false);assert.equal(ctx.Zotero.Prefs.get(model),'upstream-default');
 assert.equal(values.get(secrets),'local-private-placeholder');
 ctx.ReadingSetupPreset.stop();await ctx.ReadingSetupPreset.start('jar:fixture!/');
 assert.equal(values.get(key),'stacked'); // Restore survives restart.
 ctx.Zotero.ReaderThoughtsSetup.apply();assert.equal(values.get(key),'independent');
 ctx.ReadingSetupPreset.stop();console.log('PASS: one-time setup, original backup, default restoration, restart and secret isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
