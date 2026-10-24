const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('suggestions wait for typing and clear without allowing stale results to reopen',async()=>{
 const handlers={},attrs={},timers=[];let calls=0,resolveQuery;const popups=[];
 const input={value:'',setAttribute:(k,v)=>attrs[k]=v,addEventListener:(k,f)=>handlers[k]=f,getBoundingClientRect:()=>({x:0,y:0,width:300,height:36})};
 const list={setAttribute(){},hidden:true};const document={activeElement:input,querySelector:s=>s==='#address'?input:{addEventListener(){}},createElement:()=>list,body:{append(){}}};
 const window={blackout:{addressSuggestions:()=>{calls++;return new Promise(r=>resolveQuery=r)},addressPopup:async rows=>popups.push(rows),onState(){}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('ui/address-suggestions.js','utf8'),{document,window,navigate(){},setTimeout:f=>{timers.push(f);return timers.length},clearTimeout(){}});
 handlers.focus?.();assert.equal(calls,0);assert.notEqual(attrs['aria-expanded'],'true');
 input.value='link';handlers.input();timers.pop()();assert.equal(calls,1);
 input.value='';handlers.input();assert.equal(attrs['aria-expanded'],'false');assert.equal(popups.at(-1).length,0);
 resolveQuery([{url:'https://linkedin.com',title:'LinkedIn'}]);await Promise.resolve();await Promise.resolve();assert.equal(attrs['aria-expanded'],'false');
});
