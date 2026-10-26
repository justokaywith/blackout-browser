function createFaviconResolver(fetcher){
 const cache=new Map(),pending=new Map();
 const response=item=>item?new Response(item.body,{headers:{'Content-Type':item.type,'Cache-Control':'public, max-age=3600','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}}):new Response('Not found',{status:404});
 async function read(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);try{
  const r=await fetcher(url,{signal:controller.signal,credentials:'omit'}),type=r.headers.get('content-type')||'';
  if(!r.ok||!/^image\/(?:png|x-icon|vnd\.microsoft\.icon|svg\+xml|webp|jpeg)(?:;|$)/i.test(type))return null;
  if(r.url&&new URL(r.url).protocol!=='https:')return null;
  const reader=r.body?.getReader();if(!reader)return null;const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512*1024){await reader.cancel();return null}chunks.push(value)}
  if(!size)return null;const body=new Uint8Array(size);let at=0;for(const part of chunks){body.set(part,at);at+=part.length}return {body,type};
 }catch{return null}finally{clearTimeout(timer)}}
 return async target=>{let source;try{source=new URL(target)}catch{return response(null)}if(source.protocol!=='https:'||source.username||source.password)return response(null);
  const origin=source.origin,found=cache.get(origin);if(found&&found.until>Date.now())return response(found.value);
  if(!pending.has(origin)){const task=(async()=>{const special={'pactuno.online':'/brand/favicon-32.png','www.pactuno.online':'/brand/favicon-32.png','relay.pactuno.online':'/favicon.svg'},paths=[...(special[source.hostname]?[special[source.hostname]]:[]),'/favicon.ico','/favicon.svg','/favicon.png','/apple-touch-icon.png'];let value=null;for(const path of [...new Set(paths)]){value=await read(new URL(path,origin).href);if(value)break}if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(origin,{value,until:Date.now()+(value?1800000:30000)});return value})();pending.set(origin,task)}
  try{return response(await pending.get(origin))}finally{pending.delete(origin)}
 };
}
module.exports={createFaviconResolver};
