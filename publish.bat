@echo off
rem One-click publish: commit all changes and push to GitHub (GitHub Pages auto-deploys).
cd /d %~dp0

git add .
git commit -m "update: %date% %time:~0,5%"
if errorlevel 1 echo Nothing to commit.

git push
if errorlevel 1 (
    echo.
    echo ==========================================
    echo   PUSH FAILED! Check network and retry.
    echo   Your changes are committed locally only.
    echo ==========================================
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Pushed! Live in about 1 minute:
echo   https://vijayli11.github.io/android-framework-blog/
echo ==========================================
pause
