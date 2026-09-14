/**
 * 极简静态文件服务器
 * 纯 Node.js 内置模块，零依赖
 * 
 * 启动方式:
 *   node server.js           # 默认端口 8080
 *   node server.js 3000      # 指定端口 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.argv[2] || 8080;
const ROOT = __dirname;

// MIME 类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
}

function logRequest(req, statusCode, filePath, duration) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const color = statusCode >= 400 ? '\x1b[31m' : statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`${now} ${color}${statusCode}${reset} ${req.method} ${req.url} ${duration}ms`);
}

const server = http.createServer((req, res) => {
    const start = Date.now();
    const parsedUrl = url.parse(req.url, true);
    let pathname;
    try {
        pathname = decodeURIComponent(parsedUrl.pathname);
    } catch (e) {
        // 畸形 URL（如非法的 % 编码），直接返回 400，避免进程崩溃
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        logRequest(req, 400, parsedUrl.pathname, Date.now() - start);
        return;
    }
    
    // 安全路径处理：禁止访问上级目录
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT, safePath);
    
    // 目录默认返回 index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    
    // 文件不存在则 404
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const notFoundHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>404 Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;padding:80px 20px;background:#0a0a0f;color:#e2e2e8;">
    <h1 style="font-size:4rem;margin-bottom:20px;color:#00d4aa;">404</h1>
    <p style="font-size:1.2rem;color:#8b8b9a;">文件未找到</p>
    <p style="margin-top:30px;"><a href="/" style="color:#00d4aa;text-decoration:none;">← 返回首页</a></p>
</body>
</html>`;
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(notFoundHtml);
        logRequest(req, 404, pathname, Date.now() - start);
        return;
    }
    
    // 读取并返回文件
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Internal Server Error');
            logRequest(req, 500, pathname, Date.now() - start);
            return;
        }
        
        const mimeType = getMimeType(filePath);
        const headers = {
            'Content-Type': mimeType,
            'Cache-Control': mimeType.startsWith('text/') || mimeType.includes('json') 
                ? 'no-cache' 
                : 'public, max-age=3600',
        };
        
        res.writeHead(200, headers);
        res.end(data);
        logRequest(req, 200, pathname, Date.now() - start);
    });
});

server.listen(PORT, () => {
    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│  🚀 Android Framework Blog Server       │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│  📍 Local:   http://localhost:${PORT}/        │`);
    console.log(`│  📡 Network: http://127.0.0.1:${PORT}/        │`);
    console.log('├─────────────────────────────────────────┤');
    console.log('│  按 Ctrl+C 停止服务                     │');
    console.log('└─────────────────────────────────────────┘\n');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n👋 服务器已关闭');
    process.exit(0);
});
