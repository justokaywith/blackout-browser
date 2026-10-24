const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
test('installer PowerShell helpers and generated uninstaller parse without executing system changes',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../installer/main.cjs'),'utf8'),start=source.indexOf('function createUninstaller('),end=source.indexOf('// IPC Handlers',start),root=fs.mkdtempSync(path.join(__dirname,'../work/uninstaller-'));
 const sandbox={fs,path,app:{getVersion:()=> '0.2.27'},__dirname:path.join(root,'code'),execFile:(...args)=>args.at(-1)(null),console};vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);await sandbox.createUninstaller(root,path.join(root,'Blackout Browser.exe'));
 const files=['discover.ps1','running.ps1','shortcuts.ps1'].map(n=>path.join(__dirname,'../installer',n));files.push(path.join(root,'uninstall.ps1'));
 for(const file of files){const text=fs.readFileSync(file,'utf8'),command='$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseInput('+"'"+text.replaceAll("'","''")+"'"+',[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){$errors|ForEach-Object {$_.Message};exit 1}';assert.doesNotThrow(()=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,encoding:'utf8'}),file);}
 assert.ok(!fs.readFileSync(path.join(root,'uninstall.ps1'),'utf8').includes('rmdir /s'));
});
