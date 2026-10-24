const {secureOrigin}=require('./site-permissions.cjs');
function createNotificationPermissions({dialog,findWindow,isPrivate,read=()=>({}),save=()=>{}}){
 let saved;try{saved=read();}catch{}const normal=new Map(Object.entries(saved||{}).filter(([k,v])=>secureOrigin(k)===k&&['allow','block'].includes(v))),privateChoices=new Map(),pending=new Map();let policy='ask';
 const choices=wc=>isPrivate(wc)?privateChoices:normal;
 function list(wc){return{policy,sites:[...choices(wc)].map(([origin,value])=>({origin,value}))};}
 function set(wc,origin,value){if(!secureOrigin(origin)||secureOrigin(origin)!==origin||!['ask','allow','block'].includes(value))return false;const map=choices(wc);if(value==='ask')map.delete(origin);else map.set(origin,value);if(!isPrivate(wc))save(Object.fromEntries(normal));return true;}
 function check(wc,origin,privateMode){const map=typeof privateMode==='boolean'?(privateMode?privateChoices:normal):choices(wc);return Boolean((!wc||!wc.isDestroyed())&&policy!=='block'&&secureOrigin(origin)&&map.get(secureOrigin(origin))==='allow');}
 async function request(wc,callback,details={}){
  if(!wc||wc.isDestroyed()||policy==='block')return callback(false);const origin=secureOrigin(details.requestingUrl||details.requestingOrigin||wc.getURL()),top=secureOrigin(wc.getURL());
  if(!origin||origin!==top||details.isMainFrame===false)return callback(false);
  const choice=choices(wc).get(origin);if(choice)return callback(choice==='allow');
  const key=(isPrivate(wc)?'private:':'normal:')+origin;
  if(pending.has(key)){await pending.get(key);return callback(!wc.isDestroyed()&&secureOrigin(wc.getURL())===origin&&check(wc,origin));}
  let finish;pending.set(key,new Promise(resolve=>finish=resolve));
  try{const options={type:'question',title:'Website notifications',message:`Allow notifications from ${origin}?`,detail:isPrivate(wc)?'This choice lasts until all private windows close. Windows notification settings also apply.':'This choice is saved for this site. Change it in Settings → Site permissions. Windows notification settings also apply.',buttons:['Not now','Block site','Allow'],defaultId:0,cancelId:0},parent=findWindow(wc),result=await(parent?dialog.showMessageBox(parent,options):dialog.showMessageBox(options));if(wc.isDestroyed()||secureOrigin(wc.getURL())!==origin||policy==='block')return callback(false);if(result.response===1)set(wc,origin,'block');if(result.response===2)set(wc,origin,'allow');callback(result.response===2);
  }catch{callback(false);}finally{pending.delete(key);finish();}
 }
 return{request,check,list,set,clearPrivate:()=>privateChoices.clear(),setPolicy:value=>{if(['ask','block'].includes(value))policy=value;return policy;}};
}
module.exports={createNotificationPermissions};
