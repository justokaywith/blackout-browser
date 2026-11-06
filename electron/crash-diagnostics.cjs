function diagnosticDetails(value){
 if(value?.stack||value?.message)return String(value.stack||value.message).slice(0,16384);
 if(value&&typeof value==='object'){
  const safe={};for(const key of ['type','reason','exitCode','serviceName','name'])if(['string','number','boolean'].includes(typeof value[key]))safe[key]=typeof value[key]==='string'?value[key].slice(0,256):value[key];
  return Object.keys(safe).length?JSON.stringify(safe,null,2):'No structured diagnostic fields available';
 }
 return String(value||'Unknown error').slice(0,16384);
}
function childExitReport(details){if(details.type==='Utility'||details.reason==='clean-exit')return null;return `${details.type==='GPU'?'Graphics process':'Child process '+details.type} stopped (${details.reason})`;}
module.exports={diagnosticDetails,childExitReport};
