#!/bin/bash

echo ""
echo "=========================================="
echo "  Android Framework Blog - 本地预览"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[❌] 未检测到 Node.js"
    echo ""
    echo "请按以下步骤安装："
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo "  通用:    访问 https://nodejs.org/ 下载安装包"
    echo ""
    exit 1
fi

echo "[✓] Node.js 版本: $(node --version)"
echo ""

echo "[→] 正在启动博客服务器..."
node server.js "$@"
