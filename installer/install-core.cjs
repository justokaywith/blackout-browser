const path=require('node:path'),crypto=require('node:crypto');
const required=['Blackout Browser.exe',path.join('resources','app.asar')];
function validInstall(fs,dir){return typeof dir==='string'&&path.isAbsolute(dir)&&required.every(name=>{try{return fs.statSync(path.join(dir,name)).isFile()}catch{return false}});}
function protectedTarget(target,profile){const a=path.resolve(target).toLowerCase(),b=path.resolve(profile).toLowerCase();return a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep)||a===path.parse(a).root;}
function chooseExisting(fs,candidates){return candidates.find(dir=>validInstall(fs,dir))||null;}
function installPayload({fs,source,target,profile,onProgress=()=>{},copy=(src,dest)=>fs.cpSync(src,dest,{recursive:true})}){
 if(!path.isAbsolute(target)||protectedTarget(target,profile))throw Error('Choose an application folder outside your browser profile.');
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('Choose a direct application folder, not a linked directory.');
 if(!validInstall(fs,source))throw Error('Installer payload is missing. Download the complete installer again.');
 if(fs.existsSync(target)&&fs.readdirSync(target).length&&!validInstall(fs,target))throw Error('This folder contains other files. Choose an empty application folder.');
 if(path.resolve(source)===path.resolve(target))throw Error('Installation cannot replace its own payload.');
 const parent=path.dirname(path.resolve(target)),suffix=crypto.randomUUID(),stage=path.join(parent,'.blackout-update-'+suffix),backup=path.join(parent,'.blackout-previous-'+suffix);
 for(const dir of [stage,backup])if(path.dirname(path.resolve(dir))!==parent)throw Error('Unsafe staging directory');
 fs.mkdirSync(parent,{recursive:true});onProgress(15,'Preparing your update');copy(source,stage);onProgress(65,'Verifying application files');
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 function verify(a,b){for(const entry of fs.readdirSync(a,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Unexpected link in payload');const left=path.join(a,entry.name),right=path.join(b,entry.name);if(entry.isDirectory())verify(left,right);else if(hash(left)!==hash(right))throw Error('Installed files did not match this update.');}}
 verify(source,stage);
 let moved=false;
 try{
   if(fs.existsSync(target)){fs.renameSync(target,backup);moved=true;}
   fs.renameSync(stage,target);
 }catch(error){
   if(moved&&!fs.existsSync(target))fs.renameSync(backup,target);
   throw Error('Close all Blackout windows, then try again. Your existing files were preserved. '+error.message);
 }
 onProgress(78,'Application files verified');return {installedExe:path.join(target,'Blackout Browser.exe'),backup:moved?backup:null};
}
module.exports={installPayload,validInstall,chooseExisting,protectedTarget};
