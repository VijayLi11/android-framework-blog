# Android Framework & Stability 技术博客

> 专注 Android 系统稳定性、Framework 源码分析与性能优化的个人技术博客。

## 特性

- ⚡ **纯静态**：零框架依赖，极速加载
- 🌙 **暗黑科技主题**：支持一键切换亮/暗模式
- 📝 **Markdown 编辑器**：内置写作后台，支持 Markdown 实时预览
- 🖼️ **图片上传**：拖拽 / 点击 / 粘贴三种方式上传，自动转 Base64 或生成引用代码
- 🔍 **实时搜索**：标题、标签、摘要全文搜索
- 🏷️ **标签云**：按标签浏览文章
- 📑 **文章目录**：自动生成 TOC，滚动高亮
- 💻 **代码高亮**：Java / Kotlin / C++ / Bash 语法高亮
- 📱 **响应式**：完美适配移动端
- 🌐 **RSS 订阅**：支持 RSS 2.0
- 💬 **Giscus 评论**：基于 GitHub Discussions 的评论系统（可选开启）

## 目录结构

```
blog/
├── index.html          # 首页（文章列表 + 搜索 + 标签云）
├── post.html           # 文章详情页（目录 + 代码高亮 + 评论）
├── guide.html          # 导读页（按分类的学习路径）
├── about.html          # 关于我
├── write.html          # 文章编辑器（Markdown + 图片上传）
├── rss.xml             # RSS 订阅
├── favicon.svg         # 站点图标
├── DEPLOY.md           # 部署与维护手册
├── css/
│   ├── style.css       # 主题样式
│   └── vendor/         # Prism 主题（本地化）
└── js/
    ├── posts.js        # 文章数据（在这里粘贴新文章）
    ├── main.js         # 核心逻辑
    ├── post.js         # 文章页逻辑
    ├── guide.js        # 导读页逻辑
    └── vendor/         # Prism / Marked（本地化）
```

## 快速开始

### 本地预览

**方式1：VS Code Live Server（推荐）**
安装 Live Server 插件，右键 `index.html` → Open with Live Server

**方式2：直接打开**
双击 `index.html`（文章详情页依赖 URL 参数，建议用 Live Server）

### 线上地址

已部署到 GitHub Pages：**https://vijayli11.github.io/android-framework-blog/**

`git push` 到 `main` 分支后自动重新部署。详细部署过程与日常维护流程见 [DEPLOY.md](DEPLOY.md)。

## 写文章（三种方式）

### 方式1：使用在线编辑器（推荐）

打开 `write.html`，使用内置编辑器：

1. **Markdown 模式**：支持标准 Markdown 语法，实时预览
2. **HTML 模式**：直接编写 HTML 标签，更精细控制
3. **工具栏**：一键插入标题、代码块、表格、列表等
4. **图片上传**：
   - 拖拽图片到上传区域
   - 点击选择图片文件
   - 直接粘贴（Ctrl+V / Cmd+V）
   - 图片自动转 Base64 内嵌，或生成引用代码
5. **草稿自动保存**：点击「保存草稿」，下次「读取草稿」恢复
6. **生成代码**：点击「生成代码」→「复制到剪贴板」→ 粘贴到 `js/posts.js`

### 方式2：手动编辑 posts.js

```javascript
// js/posts.js
const postsData = [
    // 新文章添加到数组最前面
    {
        id: "your-post-id",
        title: "文章标题",
        date: "2026-06-08",
        tags: ["标签1", "标签2"],
        excerpt: "文章摘要...",
        readTime: "10 min",
        content: `
            <h2>标题</h2>
            <p>正文内容...</p>
            <pre><code class="language-java">代码块</code></pre>
        `
    },
    // ... 已有文章
];
```

### 方式3：导入已有文章

在编辑器顶部下拉框选择已有文章，加载后修改，重新生成代码。

## 图片处理说明

由于纯静态博客没有后端，图片有两种处理方式：

| 方式 | 适用场景 | 操作方法 |
|------|----------|----------|
| **Base64 内嵌** | 小图标、截图（&lt; 500KB） | 编辑器直接上传，自动嵌入文章 |
| **本地文件引用** | 大图、大量图片 | 放到 `assets/` 目录，手动写 `<img src="assets/xxx.png">` |

> 💡 建议：文章配图先用编辑器上传生成代码，若文件过大会有提示，此时应压缩图片或改用本地引用。

## 自定义配置

### 修改个人信息
编辑 `about.html`：姓名、职位、社交链接、技术栈、经历时间线

### 开启 Giscus 评论
编辑 `post.html` 中 Giscus 脚本，替换 `data-repo` 等信息。
获取配置：[giscus.app](https://giscus.app/zh-CN)

### 修改主题色
编辑 `css/style.css` 中的 `--accent` 变量（默认 `#00d4aa` 科技绿）

## 技术栈

- HTML5 + CSS3 (原生，无框架)
- Vanilla JavaScript (ES6+)
- [Marked.js](https://marked.js.org/) Markdown 解析器
- Prism.js (代码高亮)
- Giscus (评论系统，可选)

## License

MIT
