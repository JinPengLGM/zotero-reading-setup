/* Local reader UI customization. All notes use Zotero's native annotation store. */
var readerThoughts;
var translationFeedback;
var codexRuntimeRepair;
var codeImport;
var marginNumberCopy;
var readingSetupPreset;
function install() {}
function uninstall() {}
async function startup({id, rootURI}, reason) {
  await Zotero.initializationPromise;
  var scope = {Zotero, Components, Services, IOUtils, PathUtils, ChromeUtils, TextDecoder};
  Services.scriptloader.loadSubScript(rootURI + 'setup-preset.js', scope, 'UTF-8');
  readingSetupPreset = scope.ReadingSetupPreset;
  await readingSetupPreset.start(rootURI);
  Services.scriptloader.loadSubScript(rootURI + 'codex-runtime.js', scope, 'UTF-8');
  codexRuntimeRepair = scope.CodexRuntimeRepair;
  await codexRuntimeRepair.start();
  Services.scriptloader.loadSubScript(rootURI + 'reading-thoughts.js', scope, 'UTF-8');
  readerThoughts = scope.ReaderThoughts;
  readerThoughts.start(id);
  Services.scriptloader.loadSubScript(rootURI + 'translation-core.js', scope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'translation-feedback.js', scope, 'UTF-8');
  translationFeedback = scope.TranslationFeedback;
  translationFeedback.start();
  Services.scriptloader.loadSubScript(rootURI + 'vendor/highlight.min.js', scope, 'UTF-8');
  for (var language of ['matlab','julia','powershell','cmake','protobuf','dockerfile']) {
    Services.scriptloader.loadSubScript(rootURI + 'vendor/' + language + '.min.js', scope, 'UTF-8');
  }
  Services.scriptloader.loadSubScript(rootURI + 'code-document.js', scope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'code-editor.js', scope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'code-import.js', scope, 'UTF-8');
  codeImport = scope.CodeImport;
  codeImport.start();
  Services.scriptloader.loadSubScript(rootURI + 'margin-number-core.js', scope, 'UTF-8');
  Services.scriptloader.loadSubScript(rootURI + 'margin-number-copy.js', scope, 'UTF-8');
  marginNumberCopy = scope.MarginNumberCopy;
  marginNumberCopy.start();
}
function shutdown(data, reason) {
  readingSetupPreset?.stop();
  readingSetupPreset = null;
  marginNumberCopy?.stop();
  marginNumberCopy = null;
  codeImport?.stop();
  codeImport = null;
  codexRuntimeRepair?.stop();
  codexRuntimeRepair = null;
  translationFeedback?.stop();
  translationFeedback = null;
  readerThoughts?.stop();
  readerThoughts = null;
}
