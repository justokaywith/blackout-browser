const {test}=require('node:test');const assert=require('node:assert/strict');const {moveTab}=require('../electron/tab-groups.cjs');
test('tab reorder preserves identity and active selection, rejects foreign IDs, keeps groups contiguous',()=>{const a={id:'a'},b={id:'b',groupId:'g'},c={id:'c',groupId:'g'},d={id:'d'};const ctx={tabs:new Map([a,b,c,d].map(t=>[t.id,t])),activeId:'c'};assert.equal(moveTab(ctx,'d','a',false),true);assert.deepEqual([...ctx.tabs.keys()],['d','a','b','c']);assert.equal(ctx.activeId,'c');assert.equal(ctx.tabs.get('c'),c);assert.equal(moveTab(ctx,'a','b',true),true);assert.equal(a.groupId,'g');assert.deepEqual([...ctx.tabs.keys()],['d','b','a','c']);assert.equal(moveTab(ctx,'missing','a',false),false);assert.equal(moveTab(ctx,'a','a',false),false);assert.equal(moveTab(ctx,'c','d',false),true);assert.equal(c.groupId,null);assert.deepEqual([...ctx.tabs.keys()],['c','d','b','a']);});

const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('double click survives a tab-strip rerender and does not close a different tab',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../ui/app.js'),'utf8'),env={performance:{now:()=>1000}};vm.createContext(env);
 vm.runInContext(s.slice(s.indexOf('let lastRevealedTabId'),s.indexOf('function renderTabs(state)')),env);
 assert.equal(env.tabHeaderDoubleClick('a',{detail:1}),false);assert.equal(env.tabHeaderDoubleClick('b',{detail:1}),false);assert.equal(env.tabHeaderDoubleClick('b',{detail:1}),true);
 env.performance.now=()=>2000;assert.equal(env.tabHeaderDoubleClick('b',{detail:1}),false);
});
