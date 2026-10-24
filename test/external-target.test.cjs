const test=require('node:test'),assert=require('node:assert/strict');
const {externalTarget}=require('../electron/external-target.cjs');
test('Windows external web links are opened without interpreting switches as URLs',()=>{
 assert.equal(externalTarget(['Blackout Browser.exe','--flag','https://example.com/a?q=1']),'https://example.com/a?q=1');
 assert.equal(externalTarget(['app.exe','javascript:alert(1)']),null);
 assert.equal(externalTarget(['app.exe','https://user:password@example.com']),null);
 assert.equal(externalTarget(['app.exe','--inspect=9229']),null);
});
