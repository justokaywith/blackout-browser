const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../installer/main.cjs'), 'utf8');
const handlerCode = source.slice(source.indexOf("ipcMain.handle('installer:install'"), source.indexOf("ipcMain.handle('installer:launch'"));
async function attempt(kind) {
  const root = fs.mkdtempSync(path.join(__dirname, '../work/install-check-'));
  const payload = path.join(root, 'payload');
  const target = path.join(root, 'installed');
  fs.mkdirSync(path.join(payload, 'resources'), {recursive: true});
  fs.writeFileSync(path.join(payload, 'Blackout Browser.exe'), 'new executable');
  if (kind !== 'missing') fs.writeFileSync(path.join(payload, 'resources/app.asar'), 'new package');
  let handler;
  let registered = false,shortcut=null,opened=null;
  vm.runInNewContext(handlerCode, {
    fs, path, require, console: {error() {}, warn() {}}, mainWindow: null,
    ipcMain: {handle(name, fn) {handler = fn;}},
    getDefaultInstallDir: () => target, getSourceBrowserDir: () => payload,
    detectedInstallDir:null,detectExisting:async()=>null,installing:false,runPs:async()=>{},validInstall:require('../installer/install-core.cjs').validInstall,
    app:{getPath:()=>path.join(root,'profiles')},
    shell:{writeShortcutLink:(_file,_mode,options)=>{shortcut=options;return kind!=='shortcut-failure'},openExternal:async url=>{opened=url}},
    installPayload:options=>require('../installer/install-core.cjs').installPayload({...options,copy:(source,destination)=>{fs.cpSync(source,destination,{recursive:true});if(kind==='stale')fs.writeFileSync(path.join(destination,'resources/app.asar'),'old package')}}),
    copyDirectoryRecursive: () => {
      fs.cpSync(payload, target, {recursive: true});
      if (kind === 'stale') fs.writeFileSync(path.join(target, 'resources/app.asar'), 'old package');
    },
    createDesktopShortcut: async () => {}, createStartMenuShortcut: async () => {},
    createUninstaller: async () => {registered = true;}
  });
  const result = await handler({}, {targetDir: target,makeDefaultBrowser:kind==='default'});
  return {result, registered,shortcut,opened};
}
test('missing payload fails before declaring installation success', async () => {
  const {result, registered} = await attempt('missing');
  assert.equal(result.success, false); assert.match(result.error, /payload is missing/); assert.equal(registered, false);
});
test('stale copied package fails verification before Windows registration', async () => {
  const {result, registered} = await attempt('stale');
  assert.equal(result.success, false); assert.match(result.error, /did not match/); assert.equal(registered, false);
});
test('verified executable and package allow successful installation', async () => {
  const {result, registered,shortcut,opened} = await attempt('good');
  assert.equal(result.success, true); assert.equal(registered, true);
  assert.equal(shortcut.appUserModelId,'online.pactuno.blackout');assert.ok(shortcut.toastActivatorClsid);assert.equal(opened,null);
});
test('default-browser choice opens the registered Windows app without claiming automatic success',async()=>{const {result,opened}=await attempt('default');assert.equal(result.success,true);assert.equal(result.defaultSettingsOpened,true);assert.equal(opened,'ms-settings:defaultapps?registeredAppUser=BlackoutBrowser');});
test('notification shortcut registration failure is surfaced',async()=>{const {result}=await attempt('shortcut-failure');assert.equal(result.success,false);assert.match(result.error,/notification shortcut/);});
