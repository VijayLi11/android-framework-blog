/**
 * 导读页逻辑
 * 读取 posts.js 中的 guideCategories，按分类渲染推荐阅读路径
 */

(function() {
    'use strict';

    function renderGuide() {
        const container = document.getElementById('guideList');
        if (!container || typeof guideCategories === 'undefined') return;

        container.innerHTML = guideCategories.map((cat, i) => {
            const items = cat.posts
                .map(id => typeof getPostById === 'function' ? getPostById(id) : null)
                .filter(Boolean);
            if (!items.length) return '';

            return `
            <div class="guide-cat">
                <h2 class="guide-cat-title"><span class="guide-num">${i + 1}</span>${cat.name}</h2>
                <p class="guide-cat-desc">${cat.desc}</p>
                <div class="guide-items">
                    ${items.map((p, j) => `
                    <a class="guide-item" href="post.html?id=${p.id}">
                        <span class="guide-item-num">${j + 1}.</span>
                        <span class="guide-item-title">${p.title}</span>
                        <span class="guide-item-meta">${p.date} · ⏱️ ${p.readTime}</span>
                    </a>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderGuide);
    } else {
        renderGuide();
    }
})();
