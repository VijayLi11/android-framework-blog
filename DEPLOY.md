# 部署与维护手册

> 个人技术博客的部署记录与日常维护流程。
> 线上地址：**https://vijayli11.github.io/android-framework-blog/**

---

## 一、架构速览

- **纯静态站点**：无框架、无构建、无后端，HTML + CSS + 原生 JS
- **文章数据**：全部存放在 `js/posts.js`（一个 JS 数组）
- **托管平台**：GitHub Pages（仓库 `main` 分支根目录）
- **更新机制**：`git push` 到 `main` 分支 → GitHub Pages 自动重新部署（约 1 分钟生效）

## 二、部署过程回顾（2026-09-15 完成）

### 上线前优化

1. Prism 代码高亮、Marked 解析器从 CDN（cdnjs/jsdelivr）改为本地 `js/vendor/`、`css/vendor/`，避免国内 CDN 不稳定
2. 新增 `favicon.svg`
3. 导航栏隐藏「写作」入口（`write.html` 仍可通过直接输 URL 使用）
4. `post.html` 中 Giscus 评论占位代码注释（启用方法见下文）

### 部署步骤

1. `git init` 初始化本地仓库并首次提交
2. SSH 公钥（`~/.ssh/id_rsa.pub`）添加到 GitHub → Settings → SSH keys
3. GitHub 创建公开仓库 `VijayLi11/android-framework-blog`（不勾选 Add README）
4. `git remote add origin` + `git push -u origin main`
5. 仓库 Settings → Pages → Source 选 **Deploy from a branch** → Branch 选 **main** / **/(root)** → Save
6. 约 1 分钟后站点上线

> ⚠️ 踩坑记录：曾尝试 Cloudflare（新版控制台 Git 集成会建成 Worker，域名 `*.workers.dev` 国内无法访问；且 wrangler 自动安装会把 148MB 的 `node_modules` 当静态资源上传导致超限）。最终选用 GitHub Pages：零配置、push 自动部署、国内可访问。

## 三、日常更新文章（重点）

一键流程：**双击 `write.bat` 写作 → 点「💾 保存到 posts.js」→ 双击 `publish.bat` 发布**。

### 1. 写文章

1. 双击 `write.bat`，自动用浏览器打开编辑器（建议 Chrome/Edge，需支持 File System Access API 才能直接保存）
2. 填写标题、日期、标签、摘要、阅读时长，Markdown/HTML 模式编写正文，实时预览
3. 图片：小图（<500KB）直接拖拽/粘贴上传，自动转 Base64 内嵌；大图建议先压缩
4. 写完点「**💾 保存到 posts.js**」——首次会让你选择一次 `js/posts.js` 文件（授权后浏览器会记住），之后点保存即直接写入

> ✏️ **修改已有文章**：编辑器顶部下拉框选择文章（或访问 `write.html?id=文章id`），修改后同样点「保存到 posts.js」，会自动替换原文章。
>
> 🔒 编辑器是纯前端工具，无后端。即使访客打开 write.html 也无法改动线上内容；文章数据保存在 `js/posts.js`，只有本机 git push 能更新。
>
> ⚠️ 若使用 Firefox 等不支持 File System Access 的浏览器：点「📋 生成代码」→「复制到剪贴板」，手动粘贴到 `js/posts.js` 数组最前面。

### 2. 发布

双击 `publish.bat` —— 自动执行 `git add` + `commit` + `push`，约 1 分钟后线上自动更新。可到仓库 **Actions** 标签页查看部署状态。

### 3. 可选：更新 RSS

想让 RSS 订阅者收到新文章，在 `rss.xml` 的 `<channel>` 内最前面（其他 `<item>` 之前）加一条：

```xml
<item>
    <title>文章标题</title>
    <link>https://vijayli11.github.io/android-framework-blog/post.html?id=文章id</link>
    <description>文章摘要</description>
    <pubDate>Mon, 15 Sep 2026 08:00:00 GMT</pubDate>
</item>
```

### 4. 修改站点本身

改任何 HTML/CSS/JS 后，同样双击 `publish.bat` 即可。

## 四、可选增强

### Giscus 评论（已启用 ✅）

已于 2026-09-15 启用，配置在 `post.html` 的 `comments-section`。评论数据存放在仓库的 GitHub Discussions（Announcements 分类）。如需关闭，将 `post.html` 中该 section 注释掉即可。

### 自定义域名（加速国内访问）

1. 购买域名（阿里云/腾讯云，如 `.top` 约 10 元/年，境外托管无需备案）
2. 仓库 Settings → Pages → Custom domain 填域名
3. 在域名服务商处添加 CNAME 记录指向 `vijayli11.github.io`
4. 勾选 Enforce HTTPS，同步更新 `rss.xml` 中的域名

## 五、本地预览

- **VS Code Live Server**（推荐）：右键 `index.html` → Open with Live Server
- 直接双击 `index.html` 也能浏览（文章详情页需通过 URL 参数加载，建议用 Live Server）

## 六、换电脑怎么办

所有文章和代码都在 GitHub 仓库里，新电脑只需一次性准备：

1. 安装 [Git](https://git-scm.com)
2. 生成新 SSH 密钥并添加到 GitHub（支持多 key 并存）：
   ```bash
   ssh-keygen -t rsa -b 4096
   cat ~/.ssh/id_rsa.pub   # 复制，粘贴到 github.com/settings/ssh/new
   ```
3. 拉取仓库：`git clone git@github.com:VijayLi11/android-framework-blog.git`
4. 之后流程不变：`write.bat` 写作 → 保存 → `publish.bat` 发布

注意：
- 编辑器首次点「保存到 posts.js」需重新选择一次文件（授权存在各电脑的浏览器里）
- 浏览器草稿（localStorage）不随仓库转移，换电脑前请先保存/发布草稿
- **应急方案**：不装任何环境，直接在 GitHub 网页上编辑 `js/posts.js` → Commit，同样自动部署（手机也行）

## 七、目录结构

```
blog/
├── index.html          # 首页（文章列表 + 搜索 + 标签云）
├── post.html           # 文章详情页（目录 + 代码高亮，评论可选）
├── tags.html           # 标签云页
├── about.html          # 关于我
├── write.html          # 写作编辑器（本地使用，线上不展示入口）
├── rss.xml             # RSS 订阅
├── favicon.svg         # 站点图标
├── css/
│   ├── style.css       # 主题样式
│   └── vendor/         # Prism 主题（本地化）
└── js/
    ├── posts.js        # 文章数据（新文章加在数组最前）
    ├── main.js         # 核心逻辑
    ├── post.js         # 文章页逻辑
    ├── tags.js         # 标签页逻辑
    └── vendor/         # Prism / Marked（本地化，无外部 CDN 依赖）
```
