const test=require('node:test'),assert=require('node:assert/strict');const {addressSuggestions}=require('../electron/address-suggestions.cjs');
test('typed host or remembered title returns ranked, deduplicated local URLs',()=>{
 const history=[{url:'https://linkedin.com/feed',title:'LinkedIn',visitedAt:3},{url:'https://linkedin.com/feed',title:'LinkedIn',visitedAt:1},{url:'https://example.com/linkedin-guide',title:'A guide',visitedAt:4}];
 const list=addressSuggestions('link',history,[{url:'https://linkedin.com/feed',title:'LinkedIn'}]);assert.equal(list[0].url,'https://linkedin.com/feed');assert.equal(list[0].source,'Bookmark');assert.equal(list.length,2);
 assert.equal(addressSuggestions('A guide',history)[0].url,'https://example.com/linkedin-guide');
});
test('suggestions exclude executable schemes, credentials and invalid URLs, and cap results',()=>{
 const items=[{url:'javascript:alert(1)'},{url:'https://user:password@example.com/'},{url:'file:///C:/secret'},{url:'not a url'},...Array.from({length:20},(_,i)=>({url:'https://site'+i+'.example',visitedAt:i}))];
 assert.equal(addressSuggestions('',items).length,8);assert.match(addressSuggestions('',items)[0].url,/site19/);assert.deepEqual(addressSuggestions('nomatch',items),[]);
});
