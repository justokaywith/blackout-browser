param([string]$Target,[switch]$OpenSettings)
$ErrorActionPreference='Stop'
if(-not $Target){$Target=Join-Path $env:LOCALAPPDATA 'Programs\Blackout Browser\Blackout Browser.exe'}
$exe=[IO.Path]::GetFullPath($Target)
if([IO.Path]::GetFileName($exe) -ne 'Blackout Browser.exe' -or -not(Test-Path -LiteralPath $exe -PathType Leaf)){throw 'Blackout Browser executable was not found'}
$root='HKCU:\Software\Clients\StartMenuInternet\BlackoutBrowser'
function SetValue($key,$name,$value){New-Item -Path $key -Force | Out-Null;if($name -eq ''){Set-Item -LiteralPath $key -Value $value}else{New-ItemProperty -LiteralPath $key -Name $name -Value $value -PropertyType String -Force | Out-Null}}
SetValue $root '' 'Blackout Browser'
SetValue "$root\DefaultIcon" '' ('"'+$exe+'",0')
SetValue "$root\shell\open\command" '' ('"'+$exe+'"')
SetValue "$root\Capabilities" 'ApplicationName' 'Blackout Browser'
SetValue "$root\Capabilities" 'ApplicationDescription' 'Browse the web with Blackout Browser by Pactuno.'
SetValue "$root\Capabilities" 'ApplicationIcon' ('"'+$exe+'",0')
foreach($id in @('BlackoutBrowserURL','BlackoutBrowserHTML')){
 $key='HKCU:\Software\Classes\'+$id
 SetValue $key '' 'Blackout Browser'
 SetValue "$key\Application" 'ApplicationName' 'Blackout Browser'
 SetValue "$key\DefaultIcon" '' ('"'+$exe+'",0')
 SetValue "$key\shell\open\command" '' ('"'+$exe+'" "%1"')
}
SetValue 'HKCU:\Software\Classes\BlackoutBrowserURL' 'URL Protocol' ''
foreach($scheme in @('http','https')){SetValue "$root\Capabilities\URLAssociations" $scheme 'BlackoutBrowserURL'}
foreach($extension in @('.htm','.html','.shtml','.xht','.xhtml')){
 SetValue "$root\Capabilities\FileAssociations" $extension 'BlackoutBrowserHTML'
 SetValue ('HKCU:\Software\Classes\'+$extension+'\OpenWithProgids') 'BlackoutBrowserHTML' ''
}
SetValue 'HKCU:\Software\RegisteredApplications' 'BlackoutBrowser' 'Software\Clients\StartMenuInternet\BlackoutBrowser\Capabilities'
SetValue 'HKCU:\Software\Classes\CLSID\{B192965D-13C9-47B5-9628-7D5F0C9BB7D1}' '' 'Blackout Browser notifications'
SetValue 'HKCU:\Software\Classes\AppUserModelId\online.pactuno.blackout' 'DisplayName' 'Blackout Browser'
SetValue 'HKCU:\Software\Classes\AppUserModelId\online.pactuno.blackout' 'IconUri' $exe
SetValue 'HKCU:\Software\Classes\AppUserModelId\online.pactuno.blackout' 'CustomActivator' '{B192965D-13C9-47B5-9628-7D5F0C9BB7D1}'
Write-Output 'Blackout Browser registered. Your current default has not been changed.'
if($OpenSettings){Start-Process 'ms-settings:defaultapps?registeredAppUser=BlackoutBrowser'}
