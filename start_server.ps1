Set-Location -Path "D:\school-lms"
$env:HOST = '0.0.0.0'
$env:PORT = '8080'
while($true) {
    Write-Host 'Starting server...'
    & "C:\Program Files\nodejs\node.exe" ./dist/server/entry.mjs
    Write-Host 'Server crashed, restarting...'
    Start-Sleep -Seconds 2
}
