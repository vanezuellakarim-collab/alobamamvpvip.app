@echo off
chcp 65001 >nul
title AloBaMa Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ==================================================
  echo   [LOI] May chua cai Node.js!
  echo   1. Mo:  https://nodejs.org
  echo   2. Tai ban "LTS" va cai dat (an Next lien tung)
  echo   3. Cai xong, dong cua so nay va chay lai run.bat
  echo  ==================================================
  echo.
  pause
  exit /b 1
)
echo.
echo   ==================================================
echo     AloBaMa dang chay tai:   http://localhost:3000
echo     Demo:  demo / 1234   va   ongba1234 / 1234
echo     >> GIU cua so nay MO. Tat cua so = tat app <<
echo   ==================================================
echo.
start "" http://localhost:3000
node server.js
echo.
echo  Server da dung (hoac loi). Thong bao loi (neu co) nam tren.
pause
