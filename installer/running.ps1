param([string]$Target)
$ErrorActionPreference='Stop'
$expected=[IO.Path]::GetFullPath($Target)
$running=@(Get-Process -Name 'Blackout Browser' -ErrorAction SilentlyContinue | Where-Object {$_.Path -and [IO.Path]::GetFullPath($_.Path) -eq $expected})
if($running.Count){throw 'Close all Blackout Browser windows before updating. Your data will be kept.'}
