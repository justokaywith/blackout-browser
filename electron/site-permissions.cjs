function secureOrigin(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || (url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)) ? url.origin : null; } catch { return null; }
}
function createSitePermissions({dialog, findWindow, notify}) {
  const grants = new Map(), pending = new Map(), generations = new Map(), blocked = new Map();
  const policy = {audio:'ask', video:'ask'};
  const keyFor = (wc, origin) => `${wc.id}:${origin}`;
  function clear(wc,forget=false) { generations.set(wc.id,(generations.get(wc.id)||0)+1); for (const map of forget?[grants,blocked]:[grants])for(const key of map.keys())if(key.startsWith(`${wc.id}:`))map.delete(key); notify(wc, []); }
  function pageState(wc){const origin=secureOrigin(wc.getURL()),key=keyFor(wc,origin);return Object.fromEntries(['audio','video'].map(t=>[t,policy[t]==='block'||blocked.get(key)?.has(t)?'block':grants.get(key)?.has(t)?'allow':'ask']));}
  function setPage(wc,type,value){
    const origin=secureOrigin(wc.getURL());if(!origin||!['audio','video'].includes(type)||!['ask','block','allow'].includes(value)||wc.isDestroyed())return false;
    if(value==='allow'&&policy[type]==='block')return false;
    const key=keyFor(wc,origin);generations.set(wc.id,(generations.get(wc.id)||0)+1);
    const current=grants.get(key)||new Set(),denied=blocked.get(key)||new Set();current.delete(type);denied.delete(type);
    if(value==='allow'&&policy[type]!=='block')current.add(type);if(value==='block')denied.add(type);
    grants.set(key,current);blocked.set(key,denied);notify(wc,[...current]);return true;
  }
  async function request(wc, permission, callback, details = {}) {
    if (['fullscreen','clipboard-sanitized-write'].includes(permission)) return callback(true);
    if (permission !== 'media' || !wc || wc.isDestroyed()) return callback(false);
    const origin=secureOrigin(details.requestingUrl || wc.getURL());
    const topOrigin=secureOrigin(wc.getURL());
    const types=[...new Set(details.mediaTypes || [])];
    if (!origin || !topOrigin || !types.length || types.some(t => !['audio','video'].includes(t) || policy[t] === 'block')) return callback(false);
    const key=keyFor(wc,origin);
    if(types.some(t=>blocked.get(key)?.has(t)))return callback(false);
    const current=grants.get(key) || new Set();
    if (types.every(t => current.has(t))) return callback(true);
    if (pending.has(key)) {
      const before=generations.get(wc.id)||0;await pending.get(key);
      if(wc.isDestroyed()||secureOrigin(wc.getURL())!==topOrigin||(generations.get(wc.id)||0)!==before)return callback(false);
      return request(wc,permission,callback,details);
    }
    let finish;pending.set(key,new Promise(resolve=>finish=resolve));
    const generation=generations.get(wc.id)||0;
    try {
      const names=types.map(t => t === 'audio' ? 'microphone' : 'camera').join(' and ');
      const options={type:'question',title:'Site device access',message:`Allow ${origin} to use your ${names}?`,detail:`Requested within ${topOrigin}. Access lasts until this page navigates or you stop it. Windows privacy settings may also block access.`,buttons:['Block','Allow for this page'],defaultId:0,cancelId:0};
      const parent=findWindow(wc);
      const result=await (parent ? dialog.showMessageBox(parent,options) : dialog.showMessageBox(options));
      if (result.response !== 1 || wc.isDestroyed() || (generations.get(wc.id)||0)!==generation || secureOrigin(wc.getURL()) !== topOrigin || types.some(t=>policy[t]==='block')) return callback(false);
      for (const type of types) current.add(type);
      grants.set(key,current);
      notify(wc,[...current]);
      callback(true);
    } catch { callback(false); } finally { pending.delete(key);finish(); }
  }
  function check(wc, permission, origin, details={}) {
    if (['fullscreen','clipboard-sanitized-write'].includes(permission)) return true;
    if (!wc || permission !== 'media' || !secureOrigin(origin)) return false;
    const types=grants.get(keyFor(wc,secureOrigin(origin)));
    const requested=details.mediaType==='unknown'||!details.mediaType?['audio','video']:[details.mediaType];
    return Boolean(types && requested.every(t=>['audio','video'].includes(t)&&policy[t]!=='block'&&!blocked.get(keyFor(wc,secureOrigin(origin)))?.has(t)&&types.has(t)));
  }
  return {request,check,clear,policy,pageState,setPage};
}
module.exports={secureOrigin,createSitePermissions};
