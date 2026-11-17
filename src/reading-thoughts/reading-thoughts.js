/* Local reader UI. Translation runs through Translate for Zotero only on click. */
var ReaderThoughts = (() => {
  const documents = new Map();
  let pluginID;
  const css = `
    .selection-popup { width:360px !important; max-width:calc(100vw - 48px) !important; border-radius:12px !important; padding:8px !important; box-sizing:border-box; box-shadow:0 8px 32px #25203d26,0 0 0 1px #8d81a82e !important; }
    .selection-popup:not(.reading-menu-open) { visibility:hidden !important; pointer-events:none !important; }
    .selection-popup .colors { justify-content:space-evenly !important; padding:2px 4px; box-sizing:border-box; }
    .selection-popup .color-button { min-width:30px; height:29px !important; border-radius:7px; }
    .selection-popup .color-name { display:none !important; }
    .selection-popup .tool-toggle { margin:4px 3px !important; }
    .selection-popup .tool-toggle button { height:28px !important; border-radius:7px !important; }
    .selection-popup > .custom-sections { display:flex; flex-direction:column; }
    .selection-popup .section:has(.reading-thought-actions) { order:-1; border:0 !important; padding:6px 3px 8px !important; }
    .reading-thought-actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
    .reading-thought-actions button { flex:none; border:1px solid #8870bb66; border-radius:8px; padding:8px 12px; background:#a28ae51c; color:inherit; font:600 14px/1.3 system-ui; cursor:pointer; }
    .reading-thought-actions button:focus-visible { outline:2px solid #6b8cce; outline-offset:2px; }
    .reading-thought-actions button:hover { background:#a28ae538; }
    .reading-thought-actions .reading-chat-add { border-color:#6b8cce66; background:#6090e81a; }
    .reading-thought-actions .reading-chat-add:hover { background:#6090e833; }
    .reading-thought-actions .reading-translate { border-color:#489b9066; background:#489b901a; }
    .reading-thought-actions .reading-translate:hover { background:#489b9033; }
    .reading-thought-actions span { font:12px/1.5 system-ui; color:var(--fill-secondary); }
    .reading-thought-actions span { flex-basis:100%; padding:0 3px; }
    .selection-popup:has(.reading-chat-add) .section:has(> .reading-ai-context) { display:none !important; }
    .selection-popup .section:has(.zoteropdftranslate-readerpopup) { display:none !important; }
    .selection-popup .reading-ai-context { border:0 !important; padding:8px !important; color:var(--fill-secondary) !important; font-size:12px !important; }
    .annotation-popup { width:340px !important; max-width:calc(100vw - 48px); border:1px solid #a28ae577; border-radius:12px !important; box-shadow:0 10px 32px #34294a22 !important; overflow:hidden; }
    .annotation-popup .preview header { padding:10px 12px 5px; }
    .annotation-popup .comment::before { content:'我的思路'; display:block; padding:6px 14px 2px; font:600 12px/1.5 system-ui; color:var(--fill-secondary); }
    .annotation-popup .comment .content { min-height:104px !important; max-height:240px !important; padding:9px 14px 14px !important; font:15px/1.75 system-ui !important; }
    .annotation-popup::after { content:'随输入自动保存 · 点击划线可继续编辑'; position:static !important; display:block; border:0 !important; padding:8px 14px 11px; font:11px/1.4 system-ui; color:var(--fill-secondary); }
    .annotation-popup .preview .tags { padding:7px 14px !important; font-size:12px; }
  `;
  function decorate(doc) {
    for (const button of doc.querySelectorAll('.selection-popup button')) {
      if (button.title === 'Add selected text to LLM panel') {
        button.textContent = '添加到对话';
        button.title = '把选文加入 LLM 上下文，用于论文问答';
        button.classList.add('reading-ai-context');
      }
    }
    for (const editor of doc.querySelectorAll('.annotation-popup .comment .content[contenteditable]')) {
      if (!editor.hasAttribute('data-reading-thought')) {
        editor.dataset.readingThought = 'true';
        editor.setAttribute('data-reading-original-placeholder', editor.getAttribute('placeholder') || '');
        editor.setAttribute('placeholder', '写下你的思路、疑问或联想…');
        editor.setAttribute('aria-label', '我的思路');
      }
    }
  }
  function getChatRoot(doc, reader) {
    // Zotero's browser element is a separate browsing context: iframe.top
    // still refers to reader.html. Use the reader's owning chrome document.
    const topDoc = reader._iframe?.ownerDocument || reader._window?.document || Zotero.getMainWindow().document;
    const tabID = String(reader.tabID ?? reader._tabID ?? '');
    const deck = topDoc.getElementById('zotero-context-pane-item-deck');
    const host = Array.from(deck?.children || []).find(el => el.getAttribute('data-tab-id') === tabID);
    return {topDoc, root:host?.querySelector('#llm-main'), tabID};
  }
  function closeSelection(reader) {
    reader._internalReader._updateState(Components.utils.cloneInto({
      primaryViewSelectionPopup:null, secondaryViewSelectionPopup:null
    },reader._iframeWindow));
  }
  async function translateSelection(doc, reader, selectedText) {
    const translator = Zotero.PDFTranslate;
    if (!translator?.hooks?.onTranslate) throw new Error('翻译插件尚未就绪，请稍后重试');
    const {topDoc, tabID} = getChatRoot(doc, reader);
    if (String(topDoc.defaultView.Zotero_Tabs?.selectedID ?? '') !== tabID) return;
    const nav = topDoc.getElementById('zotero-context-pane-sidenav');
    const pane = nav?.querySelector('[data-pane*="zoteropdftranslate"]');
    if (!pane) throw new Error('当前窗口没有翻译面板');
    if (topDoc.documentElement.getAttribute('data-llm-pane-view') === 'chat' || nav._collapsed) pane.click();
    // Pass the captured passage explicitly. A different selection or focus
    // must never make the button translate an older queue entry.
    const raw = selectedText.replace(/[\u0000-\u001F\u007F-\u009F]/gu,' ').normalize('NFKC').trim();
    const queue = translator.data.translate.queue;
    const service = Zotero.Prefs.get('extensions.zotero.ZoteroPDFTranslate.translateSource',true);
    let task = queue.findLast(t => t.type === 'text' && t.raw.trim() === raw && t.itemId === reader.itemID && t.service === service && ['waiting','processing'].includes(t.status));
    if (!task) {
      task = {id:Zotero.Utilities.randomString()+'-'+Date.now(),type:'text',raw,result:'',audio:[],service,candidateServices:[],itemId:reader.itemID,status:'waiting',extraTasks:[]};
      queue.push(task);
    } else if (queue.at(-1) !== task) {
      queue.splice(queue.indexOf(task),1); queue.push(task);
    }
    translator.data.translate.selectedText = selectedText;
    closeSelection(reader);
    translator.hooks.onReaderTabPanelRefresh();
    try {
      await translator.hooks.onTranslate(task,{noCheckZoteroItemLanguage:true});
    } catch (error) {
      task.status = 'fail'; task.result = '翻译失败：'+error.message;
      translator.hooks.onReaderTabPanelRefresh();
      Zotero.logError(error);
    }
  }
  function addToChat(doc, reader, row, button, hint, selectedText) {
    const native = row.closest('.selection-popup')?.querySelector('.reading-ai-context, button[title="Add selected text to LLM panel"]');
    const {topDoc, root, tabID} = getChatRoot(doc, reader);
    const currentTab = String(topDoc.defaultView.Zotero_Tabs?.selectedID ?? '');
    if (!native || native.disabled || !root || currentTab !== tabID) {
      hint.textContent = '请打开当前论文的 LLM 面板后重试';
      return;
    }
    // Keep the LLM plugin's native source/page tracking and context ownership.
    // Adding a context does not send a message or overwrite the user's draft.
    native.click();
    const nav = topDoc.getElementById('zotero-context-pane-sidenav');
    if (topDoc.documentElement.getAttribute('data-llm-pane-view') !== 'chat' || nav?._collapsed) {
      nav?.querySelector('[data-pane*="zotero-llm"]')?.click();
    }
    button.disabled = true;
    const normalize = text => text.replace(/\s+/g,' ').trim();
    const prefix = normalize(selectedText).slice(0,100);
    const verify = attempt => {
      const target = getChatRoot(doc, reader);
      if (String(topDoc.defaultView.Zotero_Tabs?.selectedID ?? '') !== tabID) return;
      const quote = Array.from(target.root?.querySelectorAll('.llm-selected-context-text') || [])
        .find(el => normalize(el.textContent || '').startsWith(prefix));
      if (!quote) {
        if (attempt < 4) { doc.defaultView.setTimeout(() => verify(attempt+1),150); return; }
        button.disabled = false;
        hint.textContent = '请查看右侧 AI 面板提示，确认引用是否已满';
        return;
      }
      const status = target.root.querySelector('#llm-status');
      if (status) status.textContent = '已引用选文，请输入你的问题';
      closeSelection(reader);
      target.root.querySelector('#llm-input')?.focus({preventScroll:true});
    };
    doc.defaultView.setTimeout(() => verify(0),100);
  }
  function attach(doc) {
    if (!doc || documents.has(doc)) return;
    const style = doc.createElement('style');
    style.id = 'reading-thoughts-style';
    style.textContent = css;
    doc.head.append(style);
    const keyboardDocs = new Set();
    let previousFocus;
    const onKeyDown = event => {
      const toggle = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.code === 'KeyQ' || event.key?.toLowerCase() === 'q');
      const escape = event.key === 'Escape';
      if ((!toggle && !escape) || event.repeat || event.isComposing) return;
      const popup = doc.querySelector('.selection-popup:has(.reading-thought-actions)');
      if (!popup) return;
      const open = popup.classList.contains('reading-menu-open');
      if (escape && !open) return;
      if (toggle && event.target?.closest?.('input,textarea,[contenteditable="true"]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (open) {
        popup.classList.remove('reading-menu-open');
        previousFocus?.focus?.();
      } else {
        previousFocus = event.target?.ownerDocument?.activeElement;
        popup.classList.add('reading-menu-open');
        popup.querySelector('.reading-thought-actions button')?.focus();
      }
    };
    const bindKeyboard = target => {
      if (!target || keyboardDocs.has(target)) return;
      keyboardDocs.add(target);
      target.addEventListener('keydown',onKeyDown,true);
      target.addEventListener('load',onFrameLoad,true);
      for (const frame of target.querySelectorAll('iframe')) {
        try { bindKeyboard(frame.contentDocument); } catch (_) {}
      }
    };
    const onFrameLoad = event => {
      if (event.target?.localName === 'iframe') {
        try { bindKeyboard(event.target.contentDocument); } catch (_) {}
      }
    };
    bindKeyboard(doc);
    const observer = new doc.defaultView.MutationObserver(() => {
      decorate(doc);
      for (const frame of doc.querySelectorAll('iframe')) {
        try { bindKeyboard(frame.contentDocument); } catch (_) {}
      }
    });
    observer.observe(doc.body, Components.utils.cloneInto({childList:true, subtree:true}, doc.defaultView));
    documents.set(doc, {observer, style, keyboardDocs, onKeyDown, onFrameLoad});
    decorate(doc);
  }
  function selection(event) {
    const {reader, doc, params, append} = event;
    attach(doc);
    const original = params?.annotation;
    if (!original?.position || !original.text) return;
    doc.querySelectorAll('.selection-popup').forEach(popup => popup.classList.remove('reading-menu-open'));
    const row = doc.createElement('div');
    row.className = 'reading-thought-actions';
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = '✎ 写思路';
    button.title = '给选文加紫色下划线，并在原文旁写批注';
    const hint = doc.createElement('span');
    hint.textContent = 'Alt + Q 打开菜单 · Esc 收起 · 译文显示在右侧';
    const chatButton = doc.createElement('button');
    chatButton.type = 'button';
    chatButton.className = 'reading-chat-add';
    chatButton.textContent = '添加到对话';
    chatButton.title = '引用这段选文，自动打开右侧 AI 对话';
    chatButton.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if(chatButton.disabled) return;
      try { addToChat(doc,reader,row,chatButton,hint,original.text); }
      catch(error) { chatButton.disabled=false;hint.textContent='暂时无法添加引用，请重选后再试';Zotero.logError(error); }
    });
    const translateButton = doc.createElement('button');
    translateButton.type = 'button';
    translateButton.className = 'reading-translate';
    translateButton.textContent = '翻译';
    translateButton.title = '在右侧翻译当前选中的原文';
    translateButton.addEventListener('click',async event => {
      event.preventDefault(); event.stopPropagation();
      if (translateButton.disabled) return;
      translateButton.disabled = true;
      try { await translateSelection(doc,reader,original.text); }
      catch(error) { translateButton.disabled=false;hint.textContent=error.message;Zotero.logError(error); }
    });
    row.append(button, chatButton, translateButton, hint);
    append(row);
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      try {
        const internal = reader._internalReader;
        const state = internal._state;
        if (state.readOnly) throw new Error('只读文档无法添加批注');
        const primary = state.primaryViewSelectionPopup?.annotation?.text === original.text;
        const key = primary ? 'primary' : 'secondary';
        const popup = state[key + 'ViewSelectionPopup'];
        if (!popup?.rect) throw new Error('请重新选择需要批注的文字');
        const clone = value => Components.utils.cloneInto(value, reader._iframeWindow);
        // Reuse an annotation for the same passage rather than adding duplicates.
        let annotation = state.annotations.find(a => ['highlight','underline'].includes(a.type) && a.text === original.text && JSON.stringify(a.position) === JSON.stringify(original.position));
        if (!annotation) {
          annotation = internal._annotationManager.addAnnotation(clone({
            ...original, type:'underline', color:'#a28ae5', comment:'', tags:[]
          }));
        }
        internal.setSelectedAnnotations(clone([annotation.id]), true);
        internal._updateState(clone({
          sidebarOpen:false,
          [key + 'ViewSelectionPopup']:null,
          [key + 'ViewAnnotationPopup']:{annotation, rect:Array.from(popup.rect)}
        }));
        doc.defaultView.setTimeout(() => {
          decorate(doc);
          doc.querySelector('.annotation-popup .comment .content[contenteditable]')?.focus();
        }, 120);
      } catch (error) {
        button.disabled = false;
        hint.textContent = error.message;
        Zotero.logError(error);
      }
    });
  }
  function toolbar({doc}) { attach(doc); }
  return {
    start(id) {
      pluginID = id;
      Zotero.Reader.registerEventListener('renderToolbar', toolbar, id);
      Zotero.Reader.registerEventListener('renderTextSelectionPopup', selection, id);
      // Reader dispatch stops at the first exception. Register before other
      // extensions so their popup failures cannot hide the native-note action.
      const listeners = Zotero.Reader._registeredListeners;
      Zotero.Reader._registeredListeners = [
        ...listeners.filter(x => x.pluginID === id),
        ...listeners.filter(x => x.pluginID !== id)
      ];
      for (const reader of Zotero.Reader._readers || []) attach(reader._iframeWindow?.document);
    },
    stop() {
      Zotero.Reader.unregisterEventListener('renderToolbar', toolbar);
      Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', selection);
      for (const [doc, {observer,style,keyboardDocs,onKeyDown,onFrameLoad}] of documents) {
        // Previously closed reader tabs can leave dead window wrappers.
        try { observer.disconnect(); } catch (_) {}
        for (const target of keyboardDocs) {
          try {
            target.removeEventListener('keydown',onKeyDown,true);
            target.removeEventListener('load',onFrameLoad,true);
          } catch (_) {}
        }
        try {
          style.remove();
          doc.querySelectorAll('.reading-menu-open').forEach(el => el.classList.remove('reading-menu-open'));
          doc.querySelectorAll('.reading-thought-actions').forEach(el => el.remove());
          doc.querySelectorAll('.reading-ai-context').forEach(el => {
            el.textContent = 'Add Text'; el.title = 'Add selected text to LLM panel'; el.classList.remove('reading-ai-context');
          });
          doc.querySelectorAll('[data-reading-thought]').forEach(el => {
            el.setAttribute('placeholder', el.getAttribute('data-reading-original-placeholder'));
            el.setAttribute('aria-label', 'Annotation comment');
            el.removeAttribute('data-reading-thought'); el.removeAttribute('data-reading-original-placeholder');
          });
        } catch (_) {}
      }
      documents.clear();
    }
  };
})();
