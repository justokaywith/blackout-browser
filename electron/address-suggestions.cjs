function addressSuggestions(query,history=[],favorites=[],limit=8){
 const q=String(query||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').slice(0,2048),byUrl=new Map();
 for(const [items,kind] of [[history,'History'],[favorites,'Bookmark']])for(const item of items){
  try{const url=new URL(item.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)continue;
   const normalized=url.href,title=String(item.title||url.hostname).slice(0,120),host=url.hostname.toLowerCase().replace(/^www\./,''),full=(host+url.pathname+url.search).toLowerCase(),name=title.toLowerCase();
   if(q&&!full.includes(q)&&!name.includes(q))continue;
   const score=(q?(host.startsWith(q)?1000:full.startsWith(q)?800:name.startsWith(q)?600:400):0)+(kind==='Bookmark'?30:0),visitedAt=Number(item.visitedAt||item.lastOpenedAt||item.createdAt)||0;
   const result={url:normalized,title,source:kind,score,visitedAt},old=byUrl.get(normalized);
   if(!old||score>old.score||(score===old.score&&visitedAt>old.visitedAt))byUrl.set(normalized,result);
  }catch{}
 }
 return [...byUrl.values()].sort((a,b)=>b.score-a.score||b.visitedAt-a.visitedAt).slice(0,Math.min(10,Math.max(0,limit))).map(({url,title,source})=>({url,title,source}));
}
module.exports={addressSuggestions};
