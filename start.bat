@echo off
chcp 65001 >nul
title Android Framework Blog Server

echo.
echo ==========================================
echo   Android Framework Blog - 本地预览
echo ==========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [❌] 未检测到 Node.js
    echo.
    echo 请按以下步骤安装：
    echo   1. 访问 https://nodejs.org/
    echo   2. 下载 LTS 版本（推荐）
    echo   3. 双击安装包，一路下一步
    echo   4. 安装完成后，重新运行本脚本
    echo.
    echo 或者使用其他方式预览：
    echo   - VS Code 安装 Live Server 插件
    echo   - Python: python -m http.server 8080
    echo.
    pause
    exit /b 1
)

echo [✓] Node.js 版本:
node --version
echo.

REM 启动服务器
echo [→] 正在启动博客服务器...
node server.js %*

echo.
pause
