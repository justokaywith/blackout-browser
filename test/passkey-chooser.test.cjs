const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const start=main.indexOf("browserSession.on('select-webauthn-account'");
const code=main.slice(start,main.indexOf('  applyProtectionToSession',start));
function handler(response) {
 let callback;
 vm.runInNewContext(code,{browserSession:{on:(_name,fn)=>callback=fn},dialog:{showMessageBox:async()=>({response})}});
 return callback;
}
test('passkey chooser returns only the explicitly selected account',async()=>{
 const results=[];await handler(1)({}, {frame:{url:'https://login.example'},relyingPartyId:'login.example',accounts:[{credentialId:'a',name:'One'},{credentialId:'b',name:'Two'}]},id=>results.push(id));
 assert.deepEqual(results,['b']);
});
test('cancel and missing authentication frame cancel once',async()=>{
 for (const frame of [null,{url:'https://login.example'}]) {
  const results=[];await handler(1)({}, {frame,relyingPartyId:'login.example',accounts:[{credentialId:'a'}]},id=>results.push(id));assert.deepEqual(results,[undefined]);
 }
});
