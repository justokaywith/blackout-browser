const test=require('node:test'),assert=require('node:assert/strict');
const {launchInstaller}=require('../electron/installer-launch.cjs');
test('waits for OS installer handoff before quitting',async()=>{
 let ready,quit=false;const promise=launchInstaller('setup.exe',{fs:{existsSync:()=>true,statSync:()=>({isFile:()=>true})},shell:{openPath:()=>new Promise(r=>ready=r)},quit:()=>quit=true});assert.equal(quit,false);ready('');await promise;assert.equal(quit,true);
});
test('failed handoff keeps the browser open and reports the failure',async()=>{
 let quit=false;await assert.rejects(launchInstaller('setup.exe',{fs:{existsSync:()=>true,statSync:()=>({isFile:()=>true})},shell:{openPath:async()=> 'Windows could not open this file'},quit:()=>quit=true}),/Windows/);assert.equal(quit,false);
});
