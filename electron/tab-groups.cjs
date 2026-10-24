const {randomUUID}=require('node:crypto');
function applyTabGroup(context, action, payload={}) {
  context.groups ||= new Map();
  const tab=context.tabs.get(payload.tabId);
  const name=String(payload.name || '').trim().slice(0,40);
  let group=context.groups.get(payload.groupId);
  if(action==='create') {
    if(!tab || !name || context.groups.size>=30)return false;
    group={id:randomUUID(),name,collapsed:false};context.groups.set(group.id,group);tab.groupId=group.id;
  } else if(action==='assign') {
    if(!tab || payload.groupId && !group)return false;
    tab.groupId=group?.id || null;
  } else if(action==='rename') {
    if(!group || !name)return false;group.name=name;
  } else if(action==='collapse') {
    if(!group)return false;group.collapsed=!group.collapsed;
  } else if(action==='ungroup') {
    if(!group)return false;
    for(const item of context.tabs.values())if(item.groupId===group.id)item.groupId=null;
    context.groups.delete(group.id);
  } else return false;
  // Keep members contiguous so keyboard tab order follows the visible strip.
  const tabs=[...context.tabs.values()],positions=new Map(),original=new Map(tabs.map((item,index)=>[item.id,index]));
  tabs.forEach((item,index)=>{if(item.groupId&&!positions.has(item.groupId))positions.set(item.groupId,index)});
  tabs.sort((a,b)=>(positions.get(a.groupId)??original.get(a.id))-(positions.get(b.groupId)??original.get(b.id)));
  context.tabs=new Map(tabs.map(item=>[item.id,item]));
  return true;
}
function moveTab(context,id,targetId,after=false){
 if(typeof id!=='string'||typeof targetId!=='string'||id===targetId)return false;
 const tab=context.tabs.get(id),target=context.tabs.get(targetId);if(!tab||!target)return false;
 const tabs=[...context.tabs.values()].filter(t=>t.id!==id);
 tab.groupId=target.groupId||null;tabs.splice(tabs.findIndex(t=>t.id===targetId)+(after?1:0),0,tab);
 context.tabs=new Map(tabs.map(t=>[t.id,t]));return true;
}
module.exports={applyTabGroup,moveTab};
