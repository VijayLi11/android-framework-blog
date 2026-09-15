@echo off
rem One-click publish: commit all changes and push to GitHub (GitHub Pages auto-deploys).
cd /d %~dp0

git add .
git commit -m "update: %date% %time:~0,5%"
if errorlevel 1 echo Nothing to commit.
git push

echo.
echo ==========================================
echo   Pushed! Live in about 1 minute:
echo   https://vijayli11.github.io/android-framework-blog/
echo ==========================================
pause
