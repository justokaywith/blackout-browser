[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$roots=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')
$found=@(foreach($root in $roots){Get-ItemProperty -Path ($root+'\*') -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -eq 'Blackout Browser' -and $_.InstallLocation} | ForEach-Object {$_.InstallLocation}})
ConvertTo-Json -InputObject $found -Compress
