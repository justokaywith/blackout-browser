const test=require('node:test'),assert=require('node:assert/strict');const {browserUserAgent,privacyHeaders}=require('../electron/browser-identity.cjs');
test('desktop identity uses actual runtime Chromium and platform, never a fixed old or Android version',()=>{
 assert.match(browserUserAgent('156.0.8078.48','win32'),/Windows NT 10.0.*Chrome\/156.0.8078.48/);
 assert.match(browserUserAgent('156.0.8078.48','linux'),/Linux/);assert.equal(browserUserAgent('fake'),null);
});
test('privacy request signals override case variants without losing other headers',()=>{
 const h=privacyHeaders({dnt:'0','sec-gpc':'0','user-agent':'old',Cookie:'session'},'156.0.8078.48');assert.equal(h.DNT,'1');assert.equal(h['Sec-GPC'],'1');assert.equal(h.Cookie,'session');assert.equal(h.dnt,undefined);assert.match(h['User-Agent'],/156.0.8078.48/);
});
