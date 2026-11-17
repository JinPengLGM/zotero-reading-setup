@echo off
setlocal
rem A launcher called from PowerShell 7 can inherit an incompatible PSModulePath.
rem Scope the bundled system module path to this child process only.
set "PSModulePath=%SystemRoot%\System32\WindowsPowerShell\v1.0\Modules"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare.ps1" %*
if errorlevel 1 (
  echo.
  echo Preparation failed. Read the error above and docs\TROUBLESHOOTING.md.
  pause
  exit /b 1
)
echo.
echo Open Zotero: Tools - Plugins. Install the three numbered core XPI files.
pause
