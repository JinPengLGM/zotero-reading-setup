/* Repair only a missing, explicitly configured Codex desktop runtime path. */
var CodexRuntimeRepair = (() => {
  const preference='extensions.zotero.llmforzotero.codexAppServerPath';
  let timer,clock,pending,stopped=true,last={changed:false};
  const configured=()=>String(Zotero.Prefs.get(preference,true)||'').trim();
  async function inspect() {
    const before=configured();
    const match=before.match(/^(.*[\\/]OpenAI[\\/]Codex[\\/]bin)[\\/][a-f0-9]{8,}[\\/]codex\.exe$/i);
    // Leave auto-detection and all user-managed executables alone.
    if(!match||await IOUtils.exists(before))return {changed:false};
    const candidates=[];
    for(const directory of await IOUtils.getChildren(match[1])){
      if(!/^[a-f0-9]{8,}$/i.test(PathUtils.filename(directory)))continue;
      const path=PathUtils.join(directory,'codex.exe');
      try{
        const info=await IOUtils.stat(path);
        if(info.type==='regular'&&info.size>0)candidates.push({path,modified:info.lastModified});
      }catch(_){}
    }
    candidates.sort((a,b)=>b.modified-a.modified);
    const next=candidates[0]?.path;
    // Recheck after asynchronous IO so a manual preference change always wins.
    if(!next||stopped||configured()!==before||await IOUtils.exists(before)||!await IOUtils.exists(next))return {changed:false};
    if(stopped||configured()!==before)return {changed:false};
    Zotero.Prefs.set(preference,next,true);
    Services.prefs.savePrefFile(null);
    return {changed:true,previous:before,current:next};
  }
  function repair() {
    if(stopped)return Promise.resolve({changed:false});
    if(!pending)pending=inspect().then(result=>{if(result.changed)last=result;return result;}).catch(error=>{
      Zotero.logError(error);return {changed:false,error:String(error)};
    }).finally(()=>{pending=null;});
    return pending;
  }
  return {
    async start(){
      stopped=false;clock=Zotero.getMainWindow();
      Zotero.ReaderThoughtsCodexRuntime={repair,status:()=>({...last})};
      await repair();
      if(!stopped)timer=clock.setInterval(repair,30000);
    },
    stop(){stopped=true;if(timer)clock.clearInterval(timer);delete Zotero.ReaderThoughtsCodexRuntime;}
  };
})();
