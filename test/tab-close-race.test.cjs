const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const publish=source.slice(source.indexOf('function publishTab('),source.indexOf('function updateViewBounds('));
test('late media callbacks cannot publish a removed or destroyed tab',()=>{
 const tab={id:'a',view:{webContents:undefined}},context={tabs:new Map([['a',tab]])};const env={};vm.createContext(env);vm.runInContext(publish,env);
 assert.doesNotThrow(()=>env.publishTab(context,tab));tab.closing=true;assert.equal(env.publishTab(context,tab),false);
 context.tabs.delete('a');tab.closing=false;assert.equal(env.publishTab(context,tab),false);
});
test('closing a media tab clears its permission and indicator before destroying the view',async()=>{
 const order=[],tab={id:'a',url:'https://meet.google.com/',view:{webContents:{id:3,isDestroyed:()=>false,destroy:()=>order.push('destroy')}}};
 const context={tabs:new Map([['a',tab],['b',{id:'b'}]]),activeTab:null,closedTabs:[]};const access=new Map([[3,{}]]);
 const env={sitePermissions:{clear:()=>order.push('revoke')},deviceAccess:access,closeSiteInfoPopup(){},publishDeviceAccess(){assert.equal(access.size,0)},sendTabs(){},switchTab(){},createTab(){}};vm.createContext(env);
 vm.runInContext(source.slice(source.indexOf('async function closeTab('),source.indexOf('async function createBrowserWindow(')),env);
 await env.closeTab(context,'a');assert.deepEqual(order,['revoke','destroy']);assert.equal(context.tabs.has('a'),false);
});
