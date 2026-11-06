const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
// Use original-fs in Electron to copy .asar files without Electron treating them as directories
const fs = process.versions.electron ? require('original-fs') : require('node:fs');
const {execFile}=require('node:child_process');
const {installPayload,chooseExisting,validInstall}=require('./install-core.cjs');
let detectedInstallDir=null,installing=false;
function runPs(file,args=[]){const script=require('node:fs').readFileSync(path.join(__dirname,file),'utf8');const invocation='& {\n'+script+'\n} '+args.map(value=>"'"+String(value).replaceAll("'","''")+"'").join(' ');return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',invocation],{windowsHide:true},(err,out)=>err?reject(err):resolve(out)));}
async function detectExisting(){let candidates=[];try{candidates=JSON.parse(await runPs('discover.ps1'));}catch{};detectedInstallDir=chooseExisting(fs,[...candidates,getDefaultInstallDir()]);return detectedInstallDir;}

let mainWindow = null;

// Determine where source browser files are located
function getSourceBrowserDir() {
  const candidatePaths = [];

  // When packaged as Blackout-Setup.exe:
  if (process.resourcesPath) {
    candidatePaths.push(path.join(process.resourcesPath, 'payload'));
  }

  // Fallbacks:
  candidatePaths.push(
    path.join(__dirname, 'payload'),
    path.join(__dirname, '..', 'release', 'win-unpacked'),
    path.join(__dirname, '..', '..', 'release', 'win-unpacked')
  );

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, 'Blackout Browser.exe'))) {
        console.log('Using browser source from:', p);
        return p;
      }
    } catch {}
  }
  return candidatePaths[0];
}

function getDefaultInstallDir() {
  const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || app.getPath('userData');
  return detectedInstallDir || path.join(localAppData, 'Programs', 'Blackout Browser');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 560,
    minWidth: 800,
    minHeight: 540,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#202129',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close',event=>{if(installing)event.preventDefault();});
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function copyDirectoryRecursive(src, dest, onProgress) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, onProgress);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
      if (onProgress) onProgress(entry.name);
    }
  }
  return count;
}

async function createDesktopShortcut(target){try{await runPs('shortcuts.ps1',[target,'desktop']);return true;}catch{return false;}}
async function createStartMenuShortcut(target){try{await runPs('shortcuts.ps1',[target,'start']);return true;}catch{return false;}}
function createUninstaller(targetDir, targetExe) {
  return new Promise((resolve) => {
    try {
      const uninstallPs1Path = path.join(targetDir, 'uninstall.ps1');
      const uninstallCmdPath = path.join(targetDir, 'Uninstall Blackout Browser.cmd');

      const psScript = `# Blackout Browser Uninstaller Script
param([switch]$Quiet)
$AppName = "Blackout Browser"
$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Quiet) {
  Add-Type -AssemblyName System.Windows.Forms
  $res = [System.Windows.Forms.MessageBox]::Show("Are you sure you want to completely uninstall Blackout Browser and all its shortcuts?", "Uninstall Blackout Browser", [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
  if ($res -ne [System.Windows.Forms.DialogResult]::Yes) { exit }
}

Get-Process -Name "Blackout Browser" -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq (Join-Path $InstallDir "Blackout Browser.exe")} | Stop-Process -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

$desktopPaths = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:USERPROFILE 'Desktop'),
  [Environment]::GetFolderPath('CommonDesktop')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique;
foreach ($d in $desktopPaths) {
  $sc = Join-Path $d "$AppName.lnk"
  if (Test-Path $sc) { Remove-Item $sc -Force -ErrorAction SilentlyContinue }
}

$startMenuPaths = @(
  [Environment]::GetFolderPath('Programs'),
  (Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'),
  [Environment]::GetFolderPath('CommonPrograms')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique;
foreach ($p in $startMenuPaths) {
  $sc = Join-Path $p "$AppName.lnk"
  if (Test-Path $sc) { Remove-Item $sc -Force -ErrorAction SilentlyContinue }
}

Remove-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BlackoutBrowser" -Recurse -Force -ErrorAction SilentlyContinue

if (-not $Quiet) {
  [System.Windows.Forms.MessageBox]::Show("Blackout Browser has been successfully uninstalled from your computer.", "Uninstall Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
}

$resolved = [IO.Path]::GetFullPath($InstallDir)
$profile = Join-Path $env:APPDATA 'Blackout Browser'
if ($resolved -eq [IO.Path]::GetPathRoot($resolved) -or $resolved -eq $env:USERPROFILE -or $profile.StartsWith($resolved.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or $resolved.StartsWith($profile,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe uninstall target' }
if (-not (Test-Path -LiteralPath (Join-Path $resolved 'resources\app.asar'))) { throw 'Browser installation not found' }
Remove-Item -LiteralPath $resolved -Recurse -Force

`;

      const cmdScript = `@echo off
title Uninstall Blackout Browser
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
`;

      fs.writeFileSync(uninstallPs1Path, psScript, 'utf8');
      fs.writeFileSync(uninstallCmdPath, cmdScript, 'utf8');

      // Register in Windows "Installed Apps" / Control Panel
      let appVer = app.getVersion();
      try {
        const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        if (rootPkg.version) appVer = rootPkg.version;
      } catch {}

      const regCommand = `
$RegPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BlackoutBrowser';
if (-not (Test-Path $RegPath)) { New-Item -Path $RegPath -Force | Out-Null };
Set-ItemProperty -Path $RegPath -Name 'DisplayName' -Value 'Blackout Browser';
Set-ItemProperty -Path $RegPath -Name 'DisplayVersion' -Value '${appVer}';
Set-ItemProperty -Path $RegPath -Name 'Publisher' -Value 'Pactuno';
Set-ItemProperty -Path $RegPath -Name 'InstallLocation' -Value '${targetDir.replace(/'/g, "''")}';
Set-ItemProperty -Path $RegPath -Name 'DisplayIcon' -Value '${targetExe.replace(/'/g, "''")},0';
Set-ItemProperty -Path $RegPath -Name 'UninstallString' -Value 'cmd.exe /c ""${uninstallCmdPath.replace(/'/g, "''")}""';
Set-ItemProperty -Path $RegPath -Name 'QuietUninstallString' -Value 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${uninstallPs1Path.replace(/'/g, "''")}" -Quiet';
Set-ItemProperty -Path $RegPath -Name 'EstimatedSize' -Value 310000;
`.replace(/\r?\n/g, ' ');

      execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',regCommand],{windowsHide:true},(error)=>{
        if (error) console.error('Failed to register Windows uninstaller:', error);
        resolve(true);
      });
    } catch (e) {
      console.error('Error generating uninstaller:', e);
      resolve(false);
    }
  });
}

// IPC Handlers
ipcMain.handle('installer:get-defaults', async () => {
  await detectExisting();
  return {
    defaultPath: getDefaultInstallDir(),
    existingInstall:Boolean(detectedInstallDir),
    profilePath:path.join(app.getPath('appData'),'Blackout Browser'),
    sourceAvailable: fs.existsSync(getSourceBrowserDir())
  };
});

ipcMain.handle('installer:browse', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Installation Folder',
    defaultPath: getDefaultInstallDir(),
    properties: ['openDirectory', 'createDirectory', 'promptToCreate']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    let chosen = result.filePaths[0];
    if (!chosen.toLowerCase().endsWith('blackout browser')) {
      chosen = path.join(chosen, 'Blackout Browser');
    }
    return chosen;
  }
  return null;
});

ipcMain.handle('installer:install', async (event, options) => {
  if(installing)return {success:false,error:'An installation is already running.'};
  await detectExisting();
  if(installing)return {success:false,error:'An installation is already running.'};
  const targetDir = detectedInstallDir || options.targetDir || getDefaultInstallDir();
  const sourceDir = getSourceBrowserDir();

  const sendProgress = (percent, status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('installer:progress', { percent, status });
    }
  };

  try {
    installing=true;
    if(validInstall(fs,targetDir))await runPs('running.ps1',[path.join(targetDir,'Blackout Browser.exe')]);
    const installed=installPayload({fs,source:sourceDir,target:targetDir,profile:path.join(app.getPath('appData'),'Blackout Browser'),onProgress:sendProgress});
    // Set first-launch marker in installed resources
    try {
      const resDir = path.join(targetDir, 'resources');
      if (!fs.existsSync(resDir)) fs.mkdirSync(resDir, { recursive: true });
      fs.writeFileSync(path.join(resDir, '.first-launch'), '1', 'utf8');
    } catch (e) {
      console.warn('Could not write .first-launch marker:', e);
    }

    const installedExe = path.join(targetDir, 'Blackout Browser.exe');

    sendProgress(80, 'Configuring browser shortcuts and uninstaller...');
    if (options.createDesktopShortcut) {
      await createDesktopShortcut(installedExe);
    }

    if (options.createStartMenuShortcut) {
      await createStartMenuShortcut(installedExe);
    }

    sendProgress(90, 'Registering Blackout with Windows...');
    await runPs('register-browser.ps1',[installedExe]);
    const notificationLink=path.join(app.getPath('appData'),'Microsoft','Windows','Start Menu','Programs','Blackout Browser.lnk');
    fs.mkdirSync(path.dirname(notificationLink),{recursive:true});
    if(!shell.writeShortcutLink(notificationLink,fs.existsSync(notificationLink)?'update':'create',{target:installedExe,cwd:targetDir,icon:installedExe,iconIndex:0,appUserModelId:'online.pactuno.blackout',toastActivatorClsid:'B192965D-13C9-47B5-9628-7D5F0C9BB7D1'}))throw Error('Could not configure Windows notification shortcut.');
    await createUninstaller(targetDir, installedExe);

    let defaultSettingsOpened=false;
    if(options.makeDefaultBrowser){try{await shell.openExternal('ms-settings:defaultapps?registeredAppUser=BlackoutBrowser');defaultSettingsOpened=true;}catch{}}
    sendProgress(100, 'Installation complete!');

    installing=false;
    return {
      success: true,
      profilePreserved:true,
      defaultSettingsOpened,
      installedExe
    };
  } catch (err) {
    installing=false;
    console.error('Installation error:', err);
    return {
      success: false,
      error: err.message
    };
  }
});

ipcMain.handle('installer:launch', (_event, exePath) => {
  const target = exePath || path.join(getDefaultInstallDir(), 'Blackout Browser.exe');
  if (fs.existsSync(target)) {
    const { spawn } = require('node:child_process');
    const child = spawn(target, [], { detached: true, stdio: 'ignore' });
    child.unref();
    if (mainWindow) mainWindow.close();
    return true;
  }
  return false;
});

ipcMain.handle('installer:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('installer:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
