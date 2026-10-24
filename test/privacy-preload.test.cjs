const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('remote-page privacy preload exposes matching DNT and GPC preferences',()=>{
 function Navigator(){};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../electron/privacy-preload.cjs'),'utf8'),{Navigator,require:name=>{assert.equal(name,'electron');return {contextBridge:{executeInMainWorld:({func})=>func()}}}});
 assert.equal(new Navigator().doNotTrack,'1');assert.equal(new Navigator().globalPrivacyControl,true);
});
