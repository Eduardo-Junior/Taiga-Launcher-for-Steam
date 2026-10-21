@echo off
cd /d "%~dp0"
if exist "..\..\Taiga Launcher.exe" (
 start "" "..\..\Taiga Launcher.exe"
 exit /b
)
if exist "..\..\TaigaPSP.exe" (
 start "" "..\..\TaigaPSP.exe"
 exit /b
)
if not exist "node_modules\electron\dist\electron.exe" call npm install
call npm start
