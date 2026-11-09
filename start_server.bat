@echo off
title School LMS Production Server
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   Запуск боевого сервера School LMS (порт 8080)
echo   Сторожевой процесс: start_server.ps1
echo   Для остановки сервера нажмите Ctrl+C
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
pause
