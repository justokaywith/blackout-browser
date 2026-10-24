const test=require('node:test'),assert=require('node:assert/strict');
const {applyTabGroup}=require('../electron/tab-groups.cjs');
test('groups collect tabs without losing them and can collapse, rename and ungroup',()=>{
 const c={tabs:new Map(['a','b','c'].map(id=>[id,{id}]))};
 assert.equal(applyTabGroup(c,'create',{tabId:'a',name:'Research'}),true);const id=[...c.groups.keys()][0];
 assert.equal(applyTabGroup(c,'assign',{tabId:'c',groupId:id}),true);
 assert.deepEqual([...c.tabs.keys()],['a','c','b']);
 applyTabGroup(c,'collapse',{groupId:id});assert.equal(c.groups.get(id).collapsed,true);
 applyTabGroup(c,'rename',{groupId:id,name:'Work'});assert.equal(c.groups.get(id).name,'Work');
 applyTabGroup(c,'ungroup',{groupId:id});assert.equal(c.tabs.size,3);assert.equal(c.groups.size,0);assert.ok([...c.tabs.values()].every(t=>!t.groupId));
});
test('invalid tabs, group IDs and blank names cannot change grouping',()=>{
 const c={tabs:new Map([['a',{id:'a'}]])};assert.equal(applyTabGroup(c,'create',{tabId:'foreign',name:'No'}),false);assert.equal(applyTabGroup(c,'create',{tabId:'a',name:' '}),false);assert.equal(applyTabGroup(c,'assign',{tabId:'a',groupId:'foreign'}),false);
});
