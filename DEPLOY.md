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

### 1. 写文章

打开 `write.html`（本地双击即可）使用内置编辑器：

1. 填写标题、日期、标签、摘要、阅读时长
2. Markdown 或 HTML 模式编写正文，支持实时预览
3. 图片：小图（<500KB）直接拖拽/粘贴上传，自动转 Base64 内嵌；大图建议先压缩
4. 写完点「生成代码」→「复制到剪贴板」

### 2. 发布文章

编辑 `js/posts.js`，把复制的文章对象**粘贴到数组最前面**，保存。

### 3. 更新 RSS

编辑 `rss.xml`，在 `<channel>` 内最前面（其他 `<item>` 之前）加一条：

```xml
<item>
    <title>文章标题</title>
    <link>https://vijayli11.github.io/android-framework-blog/post.html?id=文章id</link>
    <description>文章摘要</description>
    <pubDate>Mon, 15 Sep 2026 08:00:00 GMT</pubDate>
</item>
```

### 4. 推送上线

```bash
cd D:\workspace\blog
git add .
git commit -m "post: 文章标题"
git push
```

约 1 分钟后线上自动更新。可到仓库 **Actions** 标签页查看部署状态。

### 5. 修改站点本身

改任何 HTML/CSS/JS 都是同样的流程：`git add` → `commit` → `push`，自动部署。

## 四、可选增强

### 开启 Giscus 评论

1. 仓库 Settings → General → Features → 勾选 **Discussions**
2. 安装 [giscus](https://github.com/apps/giscus) App 到本仓库
3. 打开 [giscus.app/zh-CN](https://giscus.app/zh-CN)，输入仓库名，生成配置
4. 把生成的参数填入 `post.html` 中被注释的 Giscus 代码段，取消注释，push

### 自定义域名（加速国内访问）

1. 购买域名（阿里云/腾讯云，如 `.top` 约 10 元/年，境外托管无需备案）
2. 仓库 Settings → Pages → Custom domain 填域名
3. 在域名服务商处添加 CNAME 记录指向 `vijayli11.github.io`
4. 勾选 Enforce HTTPS，同步更新 `rss.xml` 中的域名

## 五、本地预览

- **VS Code Live Server**（推荐）：右键 `index.html` → Open with Live Server
- 直接双击 `index.html` 也能浏览（文章详情页需通过 URL 参数加载，建议用 Live Server）

## 六、目录结构

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
