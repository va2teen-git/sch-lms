while($true) { Write-Host 'Starting server...'; node ./dist/server/entry.mjs; Write-Host 'Server crashed, restarting...'; Start-Sleep -Seconds 2 }
