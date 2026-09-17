# Aplica el icono de la casa al exe empaquetado y regenera el instalador.
# Uso (tras npx electron-builder --dir):
#   powershell -ExecutionPolicy Bypass -File resources\aplicar-icono.ps1
$ErrorActionPreference = "Stop"
$src = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$rcedit = Join-Path $src "resources\rcedit-x64.exe"
$ico    = Join-Path $src "resources\icono.ico"
$exe    = Join-Path $src "dist\win-unpacked\HABITIA.exe"

if (!(Test-Path $exe)) { throw "No existe $exe (ejecuta primero: npx electron-builder --dir)" }
& $rcedit $exe --set-icon $ico
if ($LASTEXITCODE -ne 0) { throw "rcedit fallo: $LASTEXITCODE" }
Write-Output "Icono aplicado a $exe"

Push-Location $src
cmd.exe /c "npx.cmd electron-builder --win nsis --publish never --prepackaged dist/win-unpacked"
$code = $LASTEXITCODE
Pop-Location
Write-Output "Instalador regenerado (exit=$code) -> dist\HABITIA-Setup-0.4.0.exe"
exit $code