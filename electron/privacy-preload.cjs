const {contextBridge}=require('electron');
contextBridge.executeInMainWorld({func:()=>{
  for(const [key,value] of [['doNotTrack','1'],['globalPrivacyControl',true]]){
    try{Object.defineProperty(Navigator.prototype,key,{get:()=>value,configurable:true});}catch{}
  }
}});
