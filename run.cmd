@echo off
cd /d %~dp0
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'server\\index\.js' -or ($_.CommandLine -match 'npm run backend:dev' -and $_.Name -eq 'node.exe') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
start "backend" cmd /k npm run backend:dev
start "docs" cmd /k npm run docs:dev