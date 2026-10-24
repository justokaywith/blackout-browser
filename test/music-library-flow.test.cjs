const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
test('search result favorite/download enters library and library click plays local file', async () => {
  const nodes = new Map();
  const track = { id:'song', videoId:'jNQXAC9IVRw', title:'Song' };
  let favorites = [], played = 0, remote = 0;
  function node() { return { children:[], handlers:{}, value:'', hidden:true, style:{setProperty(){}}, classList:{toggle(){},add(){},remove(){}},
    addEventListener(n,h){this.handlers[n]=h;}, append(...x){this.children.push(...x);},appendChild(x){this.children.push(x);},replaceChildren(){this.children=[];},setAttribute(){},getAttribute(n){return this[n];},pause(){},play(){played++;return Promise.resolve();} }; }
  const document = { querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);}, querySelectorAll:()=>[],createElement:node,createTextNode:x=>x,addEventListener(){},documentElement:{style:{setProperty(){}}} };
  const api = { onState(){},getUiAppearance:async()=>({}), getMusicFavorites:async()=>favorites,getMusicState:async()=>null, searchMusic:async()=>[track],
    toggleMusicFavorite:async t=>{favorites=[t];},cacheMusicTrack:async t=>{favorites=[{...t,hasLocalAudio:true,isCached:true,cachedUrl:'blackout://app/music-cache/song.m4a'}];return {success:true};},musicStop:async()=>{},musicPlay:()=>{remote++;} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/music-popup.js'),'utf8'),{document,window:{blackout:api},navigator:{onLine:false},localStorage:{getItem:()=>null,setItem(){}},crypto:{randomUUID:()=> 'p'},setInterval(){},setTimeout,Date,console});
  await new Promise(setImmediate);
  document.querySelector('#music-search-input').value='Song';
  await document.querySelector('#music-search-btn').handlers.click({stopPropagation(){}});
  await new Promise(setImmediate);
  const row = document.querySelector('#music-results-dropdown').children[0];
  const [favorite,download] = row.children[1].children;
  await favorite.handlers.click({stopPropagation(){}});
  assert.equal(favorites.length,1);
  assert.equal(played,0,'saving a result does not start playback');
  await download.handlers.click({stopPropagation(){}});
  assert.equal(download.textContent,'Downloaded');
  const entry=document.querySelector('#music-favorites-list').children[0];
  entry.handlers.click();
  await new Promise(setImmediate);
  assert.equal(played,1);
  assert.equal(remote,0);
  assert.equal(document.querySelector('#universal-audio-player').src,favorites[0].cachedUrl);
});
