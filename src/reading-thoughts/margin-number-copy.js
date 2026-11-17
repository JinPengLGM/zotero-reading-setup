/* Clean draft line numbers in selection text; keep PDF bytes and positions intact. */
var MarginNumberCopy = (() => {
  const preference='extensions.zotero.readingThoughts.ignoreDraftLineNumbers';
  const views=new Map(),menus=new Map(),cache=new WeakMap(),documents=new Map();let clock,timer,lastCopy;
  const enabled=()=>Zotero.Prefs.get(preference,true)!==false;
  function model(info,page){
    const document=info.document;let entry=cache.get(page.chars);
    if(!entry||entry.version!==document.version){
      const result=MarginNumberCore.detect(page,document.templates);
      for(const group of result.groups){
        if(group.source!=='page-layout'||document.templates.some(t=>t.side===group.side&&Math.abs(t.x-group.x)<2.5&&t.fontName===group.fontName))continue;
        document.templates.push(group);document.version++;
      }
      entry={result,version:document.version};cache.set(page.chars,entry);
    }
    return entry.result;
  }
  function clean(info,ranges){
    let removed=0;const texts=[];
    for(const range of ranges||[]){
      const page=info.view._pdfPages[range.pageIndex??range.position?.pageIndex];if(!page?.chars){texts.push(range.text||'');continue;}
      const found=model(info,page);info.models.set(range.pageIndex??range.position?.pageIndex,found.groups);
      const result=found.indices.size?MarginNumberCore.cleanRange(page,range,found):{text:range.text,removed:0};
      texts.push(result.text||'');removed+=result.removed;
    }
    return {texts,removed};
  }
  function attach(reader,view){
    if(!view?._iframeWindow||!reader._iframeWindow||views.has(view)||typeof view._getAnnotationFromSelectionRanges!=='function')return;
    const original=view._getAnnotationFromSelectionRanges;
    if(!documents.has(reader.itemID))documents.set(reader.itemID,{templates:[],version:0});
    const info={reader,view,original,models:new Map(),document:documents.get(reader.itemID)};
    for(const [index,page]of Object.entries(view._pdfPages||{}))if(page?.chars)info.models.set(Number(index),model(info,page).groups);
    const wrapped=Components.utils.exportFunction(function(ranges,type,color){
      const annotation=original.call(view,ranges,type,color);if(!annotation)return annotation;
      try{
        if(enabled()){
          const selected=Array.from(ranges).sort((a,b)=>(a.pageIndex??a.position.pageIndex)-(b.pageIndex??b.position.pageIndex)).slice(0,2);
          const result=clean(info,selected);if(result.removed)annotation.text=result.texts.join(' ');
        }
      }catch(error){Zotero.logError(error);}
      return Components.utils.cloneInto(annotation,reader._iframeWindow);
    },reader._iframeWindow,{allowCrossOriginArguments:true});
    view._getAnnotationFromSelectionRanges=wrapped;info.wrapped=wrapped;
    const onCopy=event=>{
      if(!enabled()||!event.clipboardData||view._selectedAnnotationIDs?.length||view._textAnnotationFocused?.())return;
      if(event.target?.closest?.('input,textarea,[contenteditable="true"]'))return;
      const ranges=view._selectionRanges;if(!ranges?.length||ranges[0].collapsed)return;
      try{
        const {texts,removed}=clean(info,ranges);if(!removed)return;
        const text=texts.join(ranges.length<=2?' ':'\n');
        event.clipboardData.setData('text/plain',text);event.preventDefault();
        lastCopy={itemID:reader.itemID,pages:ranges.length,removedGlyphs:removed,textLength:text.length};
      }catch(error){Zotero.logError(error);}
    };
    info.window=view._iframeWindow;info.onCopy=onCopy;info.window.addEventListener('copy',onCopy,true);views.set(view,info);
    view._ensureBasicPageData(0).then(()=>{if(views.has(view)&&view._pdfPages[0]?.chars)info.models.set(0,model(info,view._pdfPages[0]).groups);}).catch(()=>{});
    if(view._selectionRanges?.length)view._setSelectionRanges(view._selectionRanges);
  }
  function detach(info){
    try{if(info.view._getAnnotationFromSelectionRanges===info.wrapped)info.view._getAnnotationFromSelectionRanges=info.original;info.window.removeEventListener('copy',info.onCopy,true);}catch(_){}
    views.delete(info.view);
  }
  function scan(){
    for(const reader of Zotero.Reader._readers||[]){
      if(reader._type!=='pdf')continue;
      try{attach(reader,reader._internalReader?._primaryView);attach(reader,reader._internalReader?._secondaryView);}catch(_){}
    }
    for(const info of views.values())try{if(info.window.closed)detach(info);}catch(_){views.delete(info.view);}
    for(const win of Zotero.getMainWindows()){
      if(menus.has(win))continue;
      const popup=win.document.getElementById('toolsMenu')?.querySelector('menupopup');if(!popup)continue;
      const item=win.document.createXULElement('menuitem');item.setAttribute('label','复制时忽略稿件行号');item.setAttribute('type','checkbox');item.setAttribute('checked',String(enabled()));
      item.addEventListener('command',()=>{
        Zotero.Prefs.set(preference,!enabled(),true);
        for(const info of views.values())try{if(info.view._selectionRanges?.length)info.view._setSelectionRanges(info.view._selectionRanges);}catch(_){}
        for(const item of menus.values())item.setAttribute('checked',String(enabled()));
      });popup.append(item);menus.set(win,item);
    }
  }
  return {
    start(){clock=Zotero.getMainWindow();scan();timer=clock.setInterval(scan,500);Zotero.ReaderThoughtsMargins={diagnostics:()=>({enabled:enabled(),lastCopy,views:Array.from(views.values()).map(info=>({itemID:info.reader.itemID,pages:Array.from(info.models,([pageIndex,groups])=>({pageIndex,groups}))}))})};},
    stop(){if(timer)clock.clearInterval(timer);for(const info of Array.from(views.values()))detach(info);for(const item of menus.values())try{item.remove();}catch(_){}menus.clear();documents.clear();delete Zotero.ReaderThoughtsMargins;}
  };
})();
