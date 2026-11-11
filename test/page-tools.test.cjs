const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {shortcutAction}=require('../electron/keyboard.cjs');
const k=(key,mods={})=>shortcutAction({type:'keyDown',key,...mods});
test('everyday page shortcuts map to page tools',()=>{
 assert.equal(k('f',{control:true}),'find');assert.equal(k('p',{control:true}),'print');assert.equal(k('s',{control:true}),'save-page');
 assert.equal(k('F12'),'devtools');assert.equal(k('i',{control:true,shift:true}),'devtools');assert.equal(k('s',{control:true,shift:true}),'screenshot');
 assert.equal(k('F3'),'find-next');assert.equal(k('p',{control:true,shift:true}),'toggle-pip');
});
test('chrome renderer exposes find bar and the main process validates page commands',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8');assert.match(html,/id="find-bar"[^>]*hidden/);assert.match(html,/m3-browser\.css/);
 const main=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
 assert.match(main,/'browser:page-command'[\s\S]{0,200}\['find', 'print', 'devtools', 'save-page', 'screenshot', 'zoom-in', 'zoom-out', 'zoom-reset'\]\.includes\(action\)/);
 assert.match(main,/findInPage\(text\.slice\(0, 500\)/);
});
