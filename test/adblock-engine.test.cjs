const test=require('node:test');const assert=require('node:assert/strict');
const engine=require('../electron/adblock-engine.cjs');
test('vendored filter engine loads offline and targets YouTube video ads with scriptlets',()=>{
 assert.equal(engine.available(),true);const info=engine.info();assert.ok(info&&info.bytes>1e6,'serialized lists present');
 const {ElectronBlocker}=require('../electron/vendor/ghostery-adblocker.cjs');const fs=require('node:fs'),path=require('node:path');
 const b=ElectronBlocker.deserialize(new Uint8Array(fs.readFileSync(path.join(__dirname,'../electron/vendor/adblock-engine.bin'))));
 const c=b.getCosmeticsFilters({url:'https://www.youtube.com/watch?v=x',hostname:'www.youtube.com',domain:'youtube.com',getBaseRules:true,getInjectionRules:true,getExtendedRules:false,getRulesFromHostname:true,getRulesFromDOM:false});
 assert.ok(c.scripts.length>0);assert.match(c.scripts.join('\n'),/adPlacements|playerAds/);
});
test('cosmetic IPC is attached once per session and respects live settings',()=>{
 let registered=0;const session={registerPreloadScript(o){registered++;assert.equal(o.type,'frame');assert.ok(o.filePath.endsWith('ghostery-preload.cjs'));return 'id'+registered}};
 engine.attachCosmetics(session,()=>({styles:false,scripts:true}));engine.attachCosmetics(session,()=>({styles:false,scripts:true}));assert.equal(registered,1);
});
test('main-frame navigations are never blocked',()=>{assert.equal(engine.matchRequest({id:1,url:'https://ads.doubleclick.net/',resourceType:'mainFrame'}),null)});
