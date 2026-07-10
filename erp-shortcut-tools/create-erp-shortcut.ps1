$ErrorActionPreference = "Stop"

$shortcutName = "DK ERP.lnk"
$erpUrl = "http://erp.e-dk.co.kr/erp/iwarunner.html"
$runnerPath = Join-Path $env:LOCALAPPDATA "Appeon\Appeon IWA Runner\AppeonIWAShell.exe"
$desktopPath = [Environment]::GetFolderPath("DesktopDirectory")
$shortcutPath = Join-Path $desktopPath $shortcutName

if (-not (Test-Path -LiteralPath $runnerPath)) {
    Write-Host "Appeon IWA Runner file was not found." -ForegroundColor Red
    Write-Host "Expected path:" -ForegroundColor Yellow
    Write-Host $runnerPath
    Write-Host ""
    Write-Host "Install ERP/Appeon IWA Runner first, then run this script again."
    exit 1
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $runnerPath
$shortcut.Arguments = "-r -u `"$erpUrl`""
$shortcut.WorkingDirectory = Split-Path -Parent $runnerPath
$shortcut.IconLocation = "$runnerPath,0"
$shortcut.Description = "DK ERP"
$shortcut.Save()

Write-Host "ERP desktop shortcut has been created." -ForegroundColor Green
Write-Host $shortcutPath
Write-Host ""
Write-Host "Target:"
Write-Host "`"$runnerPath`" $($shortcut.Arguments)"
