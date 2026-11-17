/* Import source as a stored original and an annotatable native HTML snapshot. */
var CodeImport = (() => {
  const windows=new Map();let timer,clock;
  function selection(win){
    const pane=win.ZoteroPane;
    const libraryID=pane.getSelectedLibraryID()||Zotero.Libraries.userLibraryID;
    return {libraryID,collectionID:pane.getSelectedCollection(true)};
  }
  async function importFile(path,options={}){
    const win=options.window||Zotero.getMainWindow();
    const name=PathUtils.filename(path),info=await IOUtils.stat(path);
    if(info.type!=='regular'||info.size>2*1024*1024)throw new Error(name+'：请选择 2 MB 以内的源码文本');
    const {text,encoding}=CodeDocument.decode(await IOUtils.read(path));
    const document=CodeDocument.render({name,text,encoding});
    const selected=selection(win),source=options.sourceItemID?Zotero.Items.get(options.sourceItemID):null;
    let parent=options.parentID?Zotero.Items.get(options.parentID):source?.parentItem;
    if(parent&&!parent.isRegularItem())throw new Error('请选择常规文献条目作为父条目');
    const libraryID=parent?.libraryID||source?.libraryID||options.libraryID||selected.libraryID;
    const library=Zotero.Libraries.get(libraryID);
    if(!library.editable||!library.filesEditable)throw new Error('当前文库不允许添加附件，请选择可写文库');
    let created=false,snapshot;
    const temp=PathUtils.join(Zotero.getTempDirectory().path,'code-reader-'+Zotero.Utilities.randomString()+'.html');
    try{
      await IOUtils.writeUTF8(temp,document.html);
      if(!parent){
        parent=new Zotero.Item('computerProgram');parent.libraryID=libraryID;
        parent.setField('title',name);parent.setField('programmingLanguage',document.label);
        parent.setField('extra','Code Reader\nSource file: '+name);
        parent.addTag('代码阅读');
        const collectionID=options.collectionID===undefined?selected.collectionID:options.collectionID;
        if(collectionID&&Zotero.Collections.get(collectionID)?.libraryID===libraryID)parent.setCollections([collectionID]);
        await parent.saveTx();created=true;
      }
      snapshot=await Zotero.Attachments.importSnapshotFromFile({file:temp,parentItemID:parent.id,title:'代码阅读 · '+name,url:'',contentType:'text/html',charset:'utf-8',singleFile:true});
      if(source){
        if(!source.parentID){source.parentID=parent.id;await source.saveTx();}
      }else{
        await Zotero.Attachments.importFromFile({file:path,parentItemID:parent.id,title:'原始源码 · '+name,contentType:'text/plain'});
      }
      return {parentID:parent.id,attachmentID:snapshot.id,name,language:document.label,lines:document.lineCount};
    }catch(error){
      if(created&&parent?.id)try{await parent.eraseTx();}catch(_){}
      throw error;
    }finally{await IOUtils.remove(temp,{ignoreAbsent:true});}
  }
  async function importPaths(paths,options={}){
    const results=[],errors=[];
    for(const path of paths){try{results.push(await importFile(path,options));}catch(error){Zotero.logError(error);errors.push(PathUtils.filename(path)+'：'+error.message);}}
    if(options.open!==false&&results.length)await Zotero.Reader.open(results[0].attachmentID);
    return {results,errors};
  }
  async function createFromText({name,text},options={}){
    name=CodeEditor.filename(name);
    if(!String(text||'').trim())throw new Error('请先粘贴或输入代码');
    const directory=PathUtils.join(Zotero.getTempDirectory().path,'code-draft-'+Zotero.Utilities.randomString());
    await IOUtils.makeDirectory(directory);
    const path=PathUtils.join(directory,name);
    try{
      await IOUtils.writeUTF8(path,text);
      const result=await importFile(path,options);
      if(options.open!==false)await Zotero.Reader.open(result.attachmentID);
      return result;
    }finally{await IOUtils.remove(path,{ignoreAbsent:true});await IOUtils.remove(directory,{ignoreAbsent:true});}
  }
  function newDocument(win,initial={}){
    const target={window:win,...selection(win)};
    return CodeEditor.open(win,data=>createFromText(data,target),initial);
  }
  async function choose(win){
    const {FilePicker}=ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
    const picker=new FilePicker();picker.init(win,'导入代码阅读',picker.modeOpenMultiple);
    picker.appendFilter('源码与文本（可多选）',Object.keys(CodeDocument.extensions).map(ext=>'*.'+ext).concat(['Makefile','Dockerfile','CMakeLists.txt']).join('; '));
    picker.appendFilters(picker.filterAll);
    if(await picker.show()!==picker.returnOK)return;
    const result=await importPaths(picker.files,{window:win});
    if(result.errors.length)Services.prompt.alert(win,'部分代码未能导入',result.errors.join('\n'));
  }
  async function readAttachment(win){
    const sources=win.ZoteroPane.getSelectedItems().filter(item=>item.isAttachment());
    const results=[];
    for(const source of sources){
      const path=await source.getFilePathAsync();
      if(path&&CodeDocument.isSupported(path))results.push(await importFile(path,{window:win,sourceItemID:source.id}));
    }
    if(results.length)await Zotero.Reader.open(results[0].attachmentID);
  }
  function addWindow(win){
    if(windows.has(win))return;
    const doc=win.document,file=doc.getElementById('menu_FilePopup')||doc.getElementById('fileMenu')?.querySelector('menupopup');
    if(!file)return;
    const run=action=>()=>action(win).catch(error=>{Zotero.logError(error);Services.prompt.alert(win,'代码阅读',error.message);});
    const newItem=doc.createXULElement('menuitem');newItem.id='reading-thoughts-new-code';newItem.setAttribute('label','新建代码文档…');newItem.addEventListener('command',()=>newDocument(win));file.append(newItem);
    const item=doc.createXULElement('menuitem');item.id='reading-thoughts-import-code';item.setAttribute('label','导入代码阅读…');item.addEventListener('command',run(choose));file.append(item);
    const context=doc.getElementById('zotero-itemmenu');
    const contextItem=doc.createXULElement('menuitem');contextItem.id='reading-thoughts-read-code';contextItem.setAttribute('label','将代码附件转为阅读文档');contextItem.addEventListener('command',run(readAttachment));
    const update=()=>{contextItem.hidden=!win.ZoteroPane.getSelectedItems().some(item=>item.isAttachment()&&CodeDocument.isSupported(item.attachmentFilename||'')&&item.attachmentContentType!=='text/html');};
    context?.append(contextItem);context?.addEventListener('popupshowing',update);
    windows.set(win,{item,newItem,context,contextItem,update});
  }
  return {
    start(){
      clock=Zotero.getMainWindow();Zotero.ReaderThoughtsCode={importPaths,importFile,createFromText,newDocument:initial=>newDocument(Zotero.getMainWindow(),initial),languages:CodeDocument.labels};
      for(const win of Zotero.getMainWindows())addWindow(win);
      timer=clock.setInterval(()=>{for(const win of Zotero.getMainWindows())addWindow(win);},2000);
    },
    stop(){
      if(timer)clock.clearInterval(timer);
      CodeEditor.stop();
      for(const {item,newItem,context,contextItem,update}of windows.values())try{item.remove();newItem.remove();contextItem.remove();context?.removeEventListener('popupshowing',update);}catch(_){}
      windows.clear();delete Zotero.ReaderThoughtsCode;
    }
  };
})();
