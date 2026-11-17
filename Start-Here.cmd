@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare.ps1" %*
if errorlevel 1 (
  echo.
  echo Preparation failed. Read the error above and docs\TROUBLESHOOTING.md.
  pause
  exit /b 1
)
echo.
echo Open Zotero: Tools - Plugins. Install the three numbered core XPI files.
pause
