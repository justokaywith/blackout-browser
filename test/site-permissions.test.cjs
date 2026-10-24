const test=require('node:test'),assert=require('node:assert/strict');
const {createSitePermissions}=require('../electron/site-permissions.cjs');
function setup(response=1) {
 let url='https://calls.example/room', prompts=0, notices=[];
 const wc={id:5,getURL:()=>url,isDestroyed:()=>false};
 const controller=createSitePermissions({dialog:{showMessageBox:async()=>{prompts++;return {response}}},findWindow:()=>null,notify:(_wc,types)=>notices.push(types)});
 const request=(permission,details)=>new Promise(resolve=>controller.request(wc,permission,resolve,details));
 return {wc,controller,request,get prompts(){return prompts},notices,setUrl:value=>url=value};
}
test('camera/microphone require explicit approval, scoped by page and device',async()=>{
 const s=setup();
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'video'}),false);
 assert.equal(await s.request('media',{requestingUrl:'https://calls.example',mediaTypes:['audio']}),true);
 assert.equal(s.prompts,1);
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'audio'}),true);
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'video'}),false);
 assert.equal(s.controller.check(s.wc,'media','https://other.example',{mediaType:'audio'}),false);
 s.controller.clear(s.wc);
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'audio'}),false);
 assert.deepEqual(s.notices.at(-1),[]);
});
test('blocked, insecure and screen capture requests do not open permission prompts',async()=>{
 const s=setup();s.controller.policy.video='block';
 assert.equal(await s.request('media',{mediaTypes:['video']}),false);
 assert.equal(await s.request('display-capture',{mediaTypes:['video']}),false);
 assert.equal(await s.request('media',{requestingUrl:'http://untrusted.example',mediaTypes:['audio']}),false);
 assert.equal(s.prompts,0);
});
test('navigation while native prompt is open cannot grant the next document access',async()=>{
 let resolvePrompt;const wc={id:2,getURL:()=> 'https://calls.example',isDestroyed:()=>false};
 const p=createSitePermissions({dialog:{showMessageBox:()=>new Promise(r=>resolvePrompt=r)},findWindow:()=>null,notify:()=>{}});
 const answer=new Promise(resolve=>p.request(wc,'media',resolve,{mediaTypes:['audio']}));
 p.clear(wc);resolvePrompt({response:1});assert.equal(await answer,false);
});
test('browser-owned page controls allow, reset and block each device without granting location',async()=>{
 const s=setup();assert.equal(s.controller.setPage(s.wc,'audio','allow'),true);
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'audio'}),true);
 assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'unknown'}),false);
 s.controller.setPage(s.wc,'video','allow');assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'unknown'}),true);
 assert.equal(await s.request('geolocation',{}),false);assert.equal(s.prompts,0);
 s.controller.setPage(s.wc,'audio','block');assert.equal(await s.request('media',{mediaTypes:['audio']}),false);
 s.controller.clear(s.wc);assert.equal(s.controller.pageState(s.wc).audio,'block');
 s.controller.setPage(s.wc,'audio','ask');assert.equal(s.controller.pageState(s.wc).audio,'ask');
 s.controller.setPage(s.wc,'audio','block');s.controller.clear(s.wc,true);assert.equal(s.controller.pageState(s.wc).audio,'ask');
});
test('global block cannot be bypassed by a page control and insecure pages cannot gain a grant',()=>{
 const s=setup();s.controller.policy.video='block';s.controller.setPage(s.wc,'video','allow');assert.equal(s.controller.check(s.wc,'media','https://calls.example',{mediaType:'video'}),false);
 s.setUrl('http://unsafe.example');assert.equal(s.controller.setPage(s.wc,'audio','allow'),false);
});
test('simultaneous microphone and camera requests queue rather than silently rejecting the second',async()=>{
 const resolvers=[];const wc={id:9,getURL:()=> 'https://calls.example',isDestroyed:()=>false};
 const p=createSitePermissions({dialog:{showMessageBox:()=>new Promise(r=>resolvers.push(r))},findWindow:()=>null,notify:()=>{}});
 const audio=new Promise(r=>p.request(wc,'media',r,{mediaTypes:['audio']}));
 const video=new Promise(r=>p.request(wc,'media',r,{mediaTypes:['video']}));
 assert.equal(resolvers.length,1);resolvers[0]({response:1});assert.equal(await audio,true);
 await Promise.resolve();assert.equal(resolvers.length,2);resolvers[1]({response:1});assert.equal(await video,true);
 assert.equal(p.check(wc,'media','https://calls.example',{mediaType:'unknown'}),true);
});
