param([string]$Target,[string]$Kind)
$ErrorActionPreference='Stop'
$canonical=[IO.Path]::GetFullPath($Target)
if([IO.Path]::GetFileName($canonical) -ne 'Blackout Browser.exe' -or -not (Test-Path -LiteralPath $canonical -PathType Leaf)){throw 'Invalid browser executable'}
$shell=New-Object -ComObject WScript.Shell
if($Kind -eq 'desktop'){
 $primary=[Environment]::GetFolderPath('DesktopDirectory')
 $dirs=@($primary,(Join-Path $env:USERPROFILE 'Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))
}else{
 $primary=[Environment]::GetFolderPath('Programs')
 $dirs=@($primary,[Environment]::GetFolderPath('CommonPrograms'))
}
if(-not $primary){throw 'Windows did not return a shortcut directory'}
foreach($dir in $dirs){if($dir -and $dir -match '\\Public\\|\\ProgramData\\'){$existing=Join-Path $dir 'Blackout Browser.lnk';if(Test-Path -LiteralPath $existing){$link=$shell.CreateShortcut($existing);if($link.TargetPath -and [IO.Path]::GetFullPath($link.TargetPath) -eq $canonical){$primary=$dir;break}}}}
$primary=[IO.Path]::GetFullPath($primary)
$backup=Join-Path (Split-Path $canonical -Parent) ('shortcut-backups\'+[Guid]::NewGuid().ToString())
foreach($dir in ($dirs | Where-Object {$_ -and (Test-Path -LiteralPath $_)} | Select-Object -Unique)){
 $link=Join-Path $dir 'Blackout Browser.lnk'
 if((Test-Path -LiteralPath $link) -and [IO.Path]::GetFullPath($dir) -ne $primary){
  $old=$shell.CreateShortcut($link)
  if($old.TargetPath -and [IO.Path]::GetFullPath($old.TargetPath) -eq $canonical){
   New-Item -Path $backup -ItemType Directory -Force | Out-Null
   $saved=Join-Path $backup ([Guid]::NewGuid().ToString()+'.lnk')
   Copy-Item -LiteralPath $link -Destination $saved
   if((Get-FileHash -LiteralPath $link).Hash -ne (Get-FileHash -LiteralPath $saved).Hash){throw 'Shortcut backup failed'}
   Remove-Item -LiteralPath $link
  }
 }
}
New-Item -Path $primary -ItemType Directory -Force | Out-Null
$sc=$shell.CreateShortcut((Join-Path $primary 'Blackout Browser.lnk'))
if($sc.TargetPath -and [IO.Path]::GetFullPath($sc.TargetPath) -eq $canonical){Write-Output 'Existing shortcut retained';exit 0}
$sc.TargetPath=$canonical
$sc.WorkingDirectory=Split-Path $canonical -Parent
$sc.Description='Blackout Browser'
$sc.IconLocation=$canonical+',0'
$sc.Save()
Write-Output 'One shortcut maintained'
