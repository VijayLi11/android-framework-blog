/**
 * 博客核心逻辑
 * - 主题切换
 * - 移动端菜单
 * - 矩阵背景动画
 * - 首页渲染（文章列表、标签云、统计）
 * - 搜索功能
 * - 打字机效果
 */

(function() {
    'use strict';

    // ========================
    // 主题管理
    // ========================
    const THEME_KEY = 'blog-theme';
    
    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = saved ? saved === 'dark' : prefersDark;
        
        if (!isDark) {
            document.documentElement.setAttribute('data-theme', 'light');
        }
        updateThemeIcon(!isDark);
    }

    function toggleTheme() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem(THEME_KEY, 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem(THEME_KEY, 'light');
        }
        updateThemeIcon(!isLight);
    }

    function updateThemeIcon(isLight) {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
        }
    }

    // ========================
    // 移动端菜单
    // ========================
    function initMobileMenu() {
        const toggle = document.getElementById('menuToggle');
        const links = document.querySelector('.nav-links');
        if (!toggle || !links) return;
        
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
            toggle.textContent = links.classList.contains('open') ? '✕' : '☰';
        });
        
        // 点击链接后关闭菜单
        links.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                links.classList.remove('open');
                toggle.textContent = '☰';
            });
        });
    }

    // ========================
    // 矩阵背景动画
    // ========================
    function initMatrixBg() {
        const canvas = document.createElement('canvas');
        const container = document.getElementById('matrixBg');
        if (!container) return;
        
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        
        let width, height;
        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ';
        const fontSize = 14;
        let columns;
        let drops = [];
        
        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            columns = Math.floor(width / fontSize);
            drops = Array(columns).fill(1);
        }
        
        function draw() {
            ctx.fillStyle = 'rgba(10, 10, 15, 0.05)';
            ctx.fillRect(0, 0, width, height);
            
            ctx.fillStyle = '#00d4aa';
            ctx.font = fontSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                
                if (drops[i] * fontSize > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }
        
        resize();
        window.addEventListener('resize', resize);
        
        let frameId;
        function animate() {
            draw();
            frameId = requestAnimationFrame(animate);
        }
        
        // 性能优化：页面不可见时暂停
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(frameId);
            } else {
                animate();
            }
        });
        
        animate();
    }

    // ========================
    // 打字机效果
    // ========================
    function initTypewriter() {
        const el = document.getElementById('typewriter');
        if (!el) return;
        
        const texts = [
            'Android Framework Engineer',
            'System Stability Expert',
            'Performance Optimizer'
        ];
        let textIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        
        function type() {
            const current = texts[textIndex];
            
            if (isDeleting) {
                el.textContent = current.substring(0, charIndex - 1);
                charIndex--;
            } else {
                el.textContent = current.substring(0, charIndex + 1);
                charIndex++;
            }
            
            let delay = isDeleting ? 50 : 100;
            
            if (!isDeleting && charIndex === current.length) {
                delay = 2000;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                textIndex = (textIndex + 1) % texts.length;
                delay = 500;
            }
            
            setTimeout(type, delay);
        }
        
        setTimeout(type, 500);
    }

    // ========================
    // 渲染标签云 + 标签筛选
    // ========================
    let currentTagFilter = null;
    
    function renderTagsCloud() {
        const container = document.getElementById('tagsCloud');
        if (!container || typeof getAllTags !== 'function') return;
        
        const tags = getAllTags();
        const maxCount = Math.max(...tags.map(t => t[1]));
        
        container.innerHTML = tags.map(([tag, count]) => {
            const size = 0.85 + (count / maxCount) * 0.4;
            const active = tag === currentTagFilter ? ' active' : '';
            return `<button type="button" class="tag-item${active}" data-tag="${escapeHtml(tag)}" title="点击筛选该标签" style="font-size:${size}rem">
                ${tag}
                <span class="tag-count">${count}</span>
            </button>`;
        }).join('');
        
        // 点击标签：原地筛选文章，再次点击恢复全部
        container.querySelectorAll('.tag-item').forEach(item => {
            item.addEventListener('click', () => {
                const tag = item.getAttribute('data-tag');
                applyTagFilter(tag === currentTagFilter ? null : tag);
            });
        });
    }
    
    function applyTagFilter(tag) {
        currentTagFilter = tag;
        renderTagsCloud();
        
        if (typeof postsData === 'undefined') return;
        const bar = document.getElementById('filterBar');
        
        if (tag) {
            renderPostsList(postsData.filter(p => p.tags.includes(tag)));
            if (bar) {
                bar.hidden = false;
                bar.innerHTML = `🏷️ 已筛选：<strong>${escapeHtml(tag)}</strong> <button type="button" class="filter-clear" id="filterClear">✕ 清除筛选</button>`;
                document.getElementById('filterClear').addEventListener('click', () => applyTagFilter(null));
            }
            const section = document.querySelector('.posts-section');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            renderPostsList(postsData);
            if (bar) {
                bar.hidden = true;
                bar.innerHTML = '';
            }
        }
    }

    // ========================
    // 渲染文章列表
    // ========================
    function renderPostsList(posts) {
        const container = document.getElementById('postsList');
        if (!container) return;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">暂无文章</p>';
            return;
        }
        
        container.innerHTML = posts.map(post => `
            <article class="post-card" data-id="${post.id}">
                <div class="post-meta">
                    <span class="post-date">${post.date}</span>
                    <div class="post-tags">
                        ${post.tags.map(t => `<span class="post-tag">${t}</span>`).join('')}
                    </div>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${post.excerpt}</p>
                <div class="post-stats">
                    <span class="post-stat">⏱️ ${post.readTime}</span>
                    <span class="post-stat">🏷️ ${post.tags.length} 个标签</span>
                    <a href="write.html?id=${post.id}" class="post-stat" style="margin-left:auto;color:var(--accent);text-decoration:none;" onclick="event.stopPropagation()">✏️ 编辑</a>
                </div>
            </article>
        `).join('');
        
        // 绑定点击事件（排除编辑按钮）
        container.querySelectorAll('.post-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('a')) return;
                const id = card.getAttribute('data-id');
                window.location.href = `post.html?id=${id}`;
            });
        });
    }

    // ========================
    // 更新统计数据
    // ========================
    function updateStats() {
        const postCountEl = document.getElementById('postCount');
        const tagCountEl = document.getElementById('tagCount');
        
        if (postCountEl && typeof postsData !== 'undefined') {
            animateNumber(postCountEl, 0, postsData.length, 800);
        }
        if (tagCountEl && typeof getAllTags === 'function') {
            animateNumber(tagCountEl, 0, getAllTags().length, 800);
        }
    }

    function animateNumber(el, start, end, duration) {
        const startTime = performance.now();
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(start + (end - start) * ease);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // ========================
    // 搜索功能
    // ========================
    function initSearch() {
        const input = document.getElementById('searchInput');
        const results = document.getElementById('searchResults');
        if (!input || !results || typeof searchPosts !== 'function') return;
        
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            
            if (!query) {
                results.classList.remove('active');
                return;
            }
            
            debounceTimer = setTimeout(() => {
                const found = searchPosts(query);
                renderSearchResults(found, query);
            }, 150);
        });
        
        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.classList.remove('active');
            }
        });
        
        input.addEventListener('focus', () => {
            if (input.value.trim()) {
                results.classList.add('active');
            }
        });
    }

    function renderSearchResults(posts, query) {
        const results = document.getElementById('searchResults');
        if (!results) return;
        
        if (posts.length === 0) {
            results.innerHTML = `<div class="search-result-item"><p>未找到与 "${escapeHtml(query)}" 相关的文章</p></div>`;
        } else {
            results.innerHTML = posts.map(post => `
                <div class="search-result-item" data-id="${post.id}">
                    <h4>${highlightText(post.title, query)}</h4>
                    <p>${highlightText(post.excerpt.substring(0, 80) + '...', query)}</p>
                    <div class="result-tags">
                        ${post.tags.map(t => `<span class="result-tag">${t}</span>`).join('')}
                    </div>
                </div>
            `).join('');
            
            results.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.getAttribute('data-id');
                    window.location.href = `post.html?id=${id}`;
                });
            });
        }
        
        results.classList.add('active');
    }

    function highlightText(text, query) {
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark style="background:var(--accent-dim);color:var(--accent);border-radius:2px;padding:0 2px;">$1</mark>');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ========================
    // 初始化
    // ========================
    function init() {
        initTheme();
        initMobileMenu();
        initMatrixBg();
        initTypewriter();
        initSearch();
        
        // 首页特有初始化
        if (document.getElementById('postsList')) {
            renderTagsCloud();
            if (typeof postsData !== 'undefined') {
                renderPostsList(postsData);
            }
            updateStats();
        }
        
        // 绑定主题切换按钮
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', toggleTheme);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
