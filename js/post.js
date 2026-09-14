/**
 * 文章详情页逻辑
 * - 解析 URL 参数加载文章
 * - 渲染文章内容
 * - 生成目录（TOC）
 * - 上下篇导航
 * - 代码高亮
 */

(function() {
    'use strict';

    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function renderPost() {
        const postId = getUrlParam('id');
        const container = document.getElementById('postArticle');
        
        if (!postId || !container || typeof getPostById !== 'function') {
            container.innerHTML = `
                <div class="post-loading">
                    <p>⚠️ 文章不存在或参数错误</p>
                    <p style="margin-top:16px;"><a href="index.html" style="color:var(--accent);">返回首页</a></p>
                </div>
            `;
            return;
        }
        
        const post = getPostById(postId);
        if (!post) {
            container.innerHTML = `
                <div class="post-loading">
                    <p>⚠️ 未找到文章：${escapeHtml(postId)}</p>
                    <p style="margin-top:16px;"><a href="index.html" style="color:var(--accent);">返回首页</a></p>
                </div>
            `;
            return;
        }
        
        // 更新页面标题
        document.title = `${post.title} | Android Framework Blog`;
        
        // 渲染文章
        container.innerHTML = `
            <header class="post-header">
                <div class="post-meta">
                    <span class="post-date">📅 ${post.date}</span>
                    <span class="post-stat">⏱️ ${post.readTime}</span>
                    <div class="post-tags">
                        ${post.tags.map(t => `<a href="tags.html?tag=${encodeURIComponent(t)}" class="post-tag">${t}</a>`).join('')}
                    </div>
                    <a href="write.html?id=${post.id}" class="post-stat" style="margin-left:auto;color:var(--accent);text-decoration:none;">✏️ 编辑</a>
                </div>
                <h1>${post.title}</h1>
            </header>
            <div class="post-body" id="postBody">
                ${post.content}
            </div>
        `;
        
        // 代码高亮
        if (window.Prism) {
            Prism.highlightAllUnder(container);
        }
        
        // 生成目录
        generateTOC();
        
        // 渲染导航
        renderNav(postId);
        
        // 滚动监听
        initScrollSpy();
    }

    function generateTOC() {
        const body = document.getElementById('postBody');
        const toc = document.getElementById('tocContent');
        const sidebar = document.getElementById('tocSidebar');
        
        if (!body || !toc || !sidebar) return;
        
        const headings = body.querySelectorAll('h2, h3');
        if (headings.length === 0) {
            sidebar.style.display = 'none';
            return;
        }
        
        // 为标题添加锚点
        headings.forEach((heading, index) => {
            const id = `heading-${index}`;
            heading.id = id;
        });
        
        toc.innerHTML = Array.from(headings).map(heading => {
            const level = heading.tagName === 'H3' ? 'h3' : '';
            return `<a href="#${heading.id}" class="${level}" data-target="${heading.id}">${heading.textContent}</a>`;
        }).join('');
        
        // 大屏显示 TOC
        if (window.innerWidth > 1200) {
            sidebar.classList.add('visible');
        }
        
        // 平滑滚动
        toc.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.getElementById(a.getAttribute('href').slice(1));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    function initScrollSpy() {
        const headings = document.querySelectorAll('.post-body h2, .post-body h3');
        const tocLinks = document.querySelectorAll('.toc-content a');
        if (!headings.length || !tocLinks.length) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    tocLinks.forEach(link => link.classList.remove('active'));
                    const active = document.querySelector(`.toc-content a[data-target="${entry.target.id}"]`);
                    if (active) active.classList.add('active');
                }
            });
        }, {
            rootMargin: '-80px 0px -60% 0px'
        });
        
        headings.forEach(h => observer.observe(h));
    }

    function renderNav(currentId) {
        const nav = document.getElementById('postNav');
        if (!nav || typeof postsData === 'undefined') return;
        
        const index = postsData.findIndex(p => p.id === currentId);
        if (index === -1) return;
        
        const prev = index < postsData.length - 1 ? postsData[index + 1] : null;
        const next = index > 0 ? postsData[index - 1] : null;
        
        let html = '';
        
        if (prev) {
            html += `
                <a href="post.html?id=${prev.id}" class="post-nav-item">
                    <div class="nav-label">← 上一篇</div>
                    <div class="nav-title">${prev.title}</div>
                </a>
            `;
        } else {
            html += `<div></div>`;
        }
        
        if (next) {
            html += `
                <a href="post.html?id=${next.id}" class="post-nav-item next">
                    <div class="nav-label">下一篇 →</div>
                    <div class="nav-title">${next.title}</div>
                </a>
            `;
        }
        
        nav.innerHTML = html;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderPost);
    } else {
        renderPost();
    }
})();
