const {pathToFileURL}=require('node:url');
function externalTarget(args){
 for(const arg of args.slice(1)){
  const clean = typeof arg === 'string' ? arg.trim().replace(/^["']|["']$/g, '') : '';
  if(!clean) continue;
  if(/^https?:\/\//i.test(clean)){try{const url=new URL(clean);if(!url.username&&!url.password)return url.href;}catch{}}
  if(/^[a-z]:[\\/].*\.(?:html?|shtml|xhtml?|xht|pdf|svg|webp|xml)$/i.test(clean)){
    try { return pathToFileURL(clean).href; } catch {}
  }
 }
 return null;
}
module.exports={externalTarget};
