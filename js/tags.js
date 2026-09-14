/**
 * 标签页逻辑
 * - 渲染所有标签
 * - 根据 URL 参数过滤文章
 */

(function() {
    'use strict';

    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function initTagsPage() {
        const allContainer = document.getElementById('tagsAll');
        const postsSection = document.getElementById('tagPostsSection');
        const postsList = document.getElementById('tagPostsList');
        const activeTag = document.getElementById('activeTag');
        
        if (!allContainer || typeof getAllTags !== 'function') return;
        
        // 渲染所有标签
        const tags = getAllTags();
        const maxCount = Math.max(...tags.map(t => t[1]));
        
        allContainer.innerHTML = tags.map(([tag, count]) => {
            const size = 0.9 + (count / maxCount) * 0.5;
            return `<a href="?tag=${encodeURIComponent(tag)}" class="tag-item tag-large" style="font-size:${size}rem">
                ${tag}
                <span class="tag-count">${count} 篇</span>
            </a>`;
        }).join('');
        
        // 检查是否有标签过滤
        const selectedTag = getUrlParam('tag');
        if (selectedTag && typeof getPostsByTag === 'function' && typeof renderPostsList === 'function') {
            const posts = getPostsByTag(selectedTag);
            
            activeTag.textContent = selectedTag;
            postsSection.style.display = 'block';
            renderPostsList(posts);
            
            // 滚动到文章列表
            setTimeout(() => {
                postsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTagsPage);
    } else {
        initTagsPage();
    }
})();
