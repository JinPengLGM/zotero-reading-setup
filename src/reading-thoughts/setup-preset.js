/* Apply the shareable preset once. Back up only the keys owned by the preset. */
var ReadingSetupPreset = (() => {
  const prefix = 'extensions.zotero.readingThoughts.';
  const marker = prefix + 'setupVersion', backupKey = prefix + 'setupBackup';
  const menus = new Map();
  const styles = new Map();
  let config, clock, timer, sidebarCSS;
  const get = key => Zotero.Prefs.get(key, true);
  const put = (key, value) => Zotero.Prefs.set(key, value, true);
  function capture() {
    return Object.fromEntries(Object.keys(config.preferences).map(key => [key,
      Services.prefs.prefHasUserValue(key) ? {user: true, value: get(key)} : {user: false}
    ]));
  }
  function writeSnapshot(snapshot) {
    for (const [key, entry] of Object.entries(snapshot)) {
      if (entry.user) put(key, entry.value);
      else if (Services.prefs.prefHasUserValue(key)) Services.prefs.clearUserPref(key);
    }
  }
  function apply() {
    const before = capture();
    // Keep the first backup, so applying the same preset twice stays reversible.
    if (!Services.prefs.prefHasUserValue(backupKey)) put(backupKey, JSON.stringify(before));
    try {
      for (const [key, value] of Object.entries(config.preferences)) put(key, value);
      put(marker, String(config.schema));
      Services.prefs.savePrefFile(null);
    } catch (error) {
      writeSnapshot(before);
      throw error;
    }
    return Object.keys(config.preferences).length;
  }
  function restore() {
    const raw = get(backupKey);
    if (!raw) throw new Error('没有可恢复的阅读配置备份');
    const snapshot = JSON.parse(raw);
    // Ignore unknown keys even if a local backup was edited manually.
    writeSnapshot(Object.fromEntries(Object.entries(snapshot).filter(([key]) =>
      Object.hasOwn(config.preferences, key))));
    put(marker, 'restored'); // Do not automatically apply again after a restart.
    Services.prefs.savePrefFile(null);
    return Object.keys(snapshot).length;
  }
  function scan() {
    for (const win of Zotero.getMainWindows()) {
      if (!styles.has(win)) {
        const style = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        style.id = 'reading-setup-sidebar-style';
        style.textContent = sidebarCSS;
        win.document.documentElement.append(style);
        styles.set(win, style);
      }
      if (menus.has(win)) continue;
      const popup = win.document.getElementById('toolsMenu')?.querySelector('menupopup');
      if (!popup) continue;
      const menu = win.document.createXULElement('menu');
      menu.setAttribute('label', '阅读配置预设');
      const sub = win.document.createXULElement('menupopup');
      for (const [label, action] of [
        ['应用共享阅读配置', apply], ['恢复应用前的设置', restore]
      ]) {
        const item = win.document.createXULElement('menuitem');
        item.setAttribute('label', label);
        item.addEventListener('command', () => {
          try {
            action();
            Services.prompt.alert(win, '阅读配置预设', '设置已保存，请重启 Zotero 使所有面板设置生效。');
          } catch (error) {
            Zotero.logError(error);
            Services.prompt.alert(win, '阅读配置预设', String(error.message || error));
          }
        });
        sub.append(item);
      }
      menu.append(sub); popup.append(menu); menus.set(win, menu);
    }
  }
  return {
    async start(rootURI) {
      // A jar: URL passed as a string is routed to Zotero.HTTP and fails URI
      // parsing. A Gecko channel works for both installed XPI and file roots.
      const {NetUtil} = ChromeUtils.importESModule('resource://gre/modules/NetUtil.sys.mjs');
      const read = name => Zotero.File.getContentsAsync(NetUtil.newChannel({
        uri: rootURI + name, loadUsingSystemPrincipal: true
      }), 'UTF-8');
      config = JSON.parse(await read('preset-config.json'));
      sidebarCSS = await read('reader-sidebar.css');
      if (config.schema !== 1 || !config.preferences) throw new Error('不支持的阅读配置预设');
      if (!Services.prefs.prefHasUserValue(marker)) apply();
      Zotero.ReaderThoughtsSetup = {apply, restore, status: () => ({
        schema: config.schema, baseline: config.baseline, applied: get(marker),
        preferenceCount: Object.keys(config.preferences).length
      })};
      clock = Zotero.getMainWindow(); scan(); timer = clock.setInterval(scan, 2000);
    },
    stop() {
      if (timer) clock.clearInterval(timer);
      for (const menu of menus.values()) try { menu.remove(); } catch (_) {}
      for (const style of styles.values()) try { style.remove(); } catch (_) {}
      menus.clear(); styles.clear(); delete Zotero.ReaderThoughtsSetup;
    }
  };
})();
