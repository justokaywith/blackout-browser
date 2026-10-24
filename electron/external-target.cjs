const {pathToFileURL}=require('node:url');
function externalTarget(args){
 for(const arg of args.slice(1)){
  if(/^https?:\/\//i.test(arg)){try{const url=new URL(arg);if(!url.username&&!url.password)return url.href;}catch{}}
  if(/^[a-z]:\\.*\.(?:html?|shtml|xhtml?|xht)$/i.test(arg))return pathToFileURL(arg).href;
 }
 return null;
}
module.exports={externalTarget};
