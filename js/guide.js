/**
 * 导读页逻辑
 * - 从 posts.js 读取 guidePageConfig（页面标题/介绍语）和 guideCategories（分类）渲染页面
 * - 本地环境（file:// / localhost）显示「✏️ 编辑导读」入口，可就地编辑：
 *   页面标题、介绍语、各分类大标题、内容概括
 * - 保存通过 File System Access API 写回 js/posts.js（与 write.html 共用同一次文件授权）
 */

(function() {
    'use strict';

    // posts.js 中的标记区（与 write.html 保持一致）
    const PAGE_BEGIN_MARK = '// <<<GUIDE-PAGE-BEGIN>>>';
    const PAGE_END_MARK = '// <<<GUIDE-PAGE-END>>>';
    const GUIDE_BEGIN_MARK = '// <<<GUIDE-BEGIN>>>';
    const GUIDE_END_MARK = '// <<<GUIDE-END>>>';

    let editing = false;

    // 仅本地环境显示编辑入口，线上访客不可见
    function isLocalEnv() {
        return ['', 'localhost', '127.0.0.1'].indexOf(location.hostname) !== -1;
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // 行内 Markdown 渲染（支持图片、链接、加粗等）；marked 不可用时回退为纯文本转义
    function mdInline(s) {
        if (typeof marked !== 'undefined' && marked.parseInline) {
            return marked.parseInline(String(s));
        }
        return escapeAttr(s);
    }

    function showToast(msg) {
        let toast = document.getElementById('guideToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'guideToast';
            toast.className = 'guide-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function getPageConfig() {
        return (typeof guidePageConfig !== 'undefined')
            ? guidePageConfig
            : { title: '导读', intro: '' };
    }

    // ========== 渲染 ==========

    function renderGuide() {
        const container = document.getElementById('guideList');
        if (!container || typeof guideCategories === 'undefined') return;

        const cfg = getPageConfig();
        const titleEl = document.getElementById('guideTitle');
        const introEl = document.getElementById('guideIntro');

        renderEditBar();

        if (editing) {
            if (titleEl) titleEl.innerHTML =
                `<input class="guide-edit-input" id="editPageTitle" value="${escapeAttr(cfg.title)}" placeholder="页面标题">`;
            if (introEl) introEl.innerHTML =
                `<textarea class="guide-edit-input" id="editPageIntro" rows="2" placeholder="页面介绍语（支持 Markdown：图片 ![描述](url)、链接 [文字](url)、加粗 **文字** 等）">${escapeAttr(cfg.intro)}</textarea>
                 <div class="guide-desc-toolbar">
                     <button class="guide-img-btn" id="introImgBtn">🖼️ 插入图片</button>
                     <span class="guide-desc-hint">支持 Markdown 语法，下方实时预览</span>
                 </div>
                 <div class="guide-desc-preview" id="editPageIntroPreview">${mdInline(cfg.intro)}</div>`;
            renderEditMode(container);

            // 介绍语的实时预览与插图按钮
            const introTa = document.getElementById('editPageIntro');
            if (introTa) {
                introTa.addEventListener('input', () => {
                    const pv = document.getElementById('editPageIntroPreview');
                    if (pv) pv.innerHTML = mdInline(introTa.value) || '<span style="opacity:0.5">（空）</span>';
                });
                document.getElementById('introImgBtn').addEventListener('click', () => {
                    pickImageForTextarea(introTa, () => {
                        const pv = document.getElementById('editPageIntroPreview');
                        if (pv) pv.innerHTML = mdInline(introTa.value);
                    });
                });
            }
            return;
        }

        if (titleEl) titleEl.textContent = cfg.title;
        if (introEl) introEl.innerHTML = mdInline(cfg.intro);

        container.innerHTML = guideCategories.map((cat, i) => {
            const items = cat.posts
                .map(id => typeof getPostById === 'function' ? getPostById(id) : null)
                .filter(Boolean);

            const itemsHtml = items.length
                ? items.map((p, j) => `
                    <a class="guide-item" href="post.html?id=${p.id}">
                        <span class="guide-item-num">${j + 1}.</span>
                        <span class="guide-item-title">${p.title}</span>
                        <span class="guide-item-meta">${p.date} · ⏱️ ${p.readTime}</span>
                    </a>`).join('')
                : '<p class="guide-empty">暂无文章，敬请期待 🚧</p>';

            return `
            <div class="guide-cat">
                <h2 class="guide-cat-title"><span class="guide-num">${i + 1}</span>${cat.name}</h2>
                <p class="guide-cat-desc">${mdInline(cat.desc)}</p>
                <div class="guide-items">${itemsHtml}</div>
            </div>`;
        }).join('');
    }

    // 编辑模式：分类大标题 / 内容概括变为输入框，文章列表保持只读展示
    function renderEditMode(container) {
        container.innerHTML = guideCategories.map((cat, i) => {
            const items = cat.posts
                .map(id => typeof getPostById === 'function' ? getPostById(id) : null)
                .filter(Boolean);

            const itemsHtml = items.length
                ? items.map((p, j) => `
                    <span class="guide-item guide-item-readonly">
                        <span class="guide-item-num">${j + 1}.</span>
                        <span class="guide-item-title">${p.title}</span>
                        <span class="guide-item-meta">${p.date} · ⏱️ ${p.readTime}</span>
                    </span>`).join('')
                : '<p class="guide-empty">暂无文章</p>';

            return `
            <div class="guide-cat">
                <h2 class="guide-cat-title">
                    <span class="guide-num">${i + 1}</span>
                    <input class="guide-edit-input guide-cat-name-input" data-index="${i}" value="${escapeAttr(cat.name)}" placeholder="分类大标题">
                </h2>
                <div class="guide-cat-desc">
                    <textarea class="guide-edit-input guide-cat-desc-input" data-index="${i}" rows="2" placeholder="内容概括（支持 Markdown：图片 ![描述](url)、链接 [文字](url)、加粗 **文字** 等）">${escapeAttr(cat.desc)}</textarea>
                    <div class="guide-desc-toolbar">
                        <button class="guide-img-btn" data-index="${i}">🖼️ 插入图片</button>
                        <span class="guide-desc-hint">支持 Markdown 语法，下方实时预览</span>
                    </div>
                    <div class="guide-desc-preview" data-index="${i}">${mdInline(cat.desc)}</div>
                </div>
                <div class="guide-items">${itemsHtml}</div>
            </div>`;
        }).join('');

        // 绑定实时预览与插图按钮
        container.querySelectorAll('.guide-cat-desc-input').forEach(ta => {
            ta.addEventListener('input', () => updateDescPreview(ta));
        });
        container.querySelectorAll('.guide-img-btn').forEach(btn => {
            btn.addEventListener('click', () => pickImageFor(btn.dataset.index));
        });
    }

    function updateDescPreview(textarea) {
        const preview = document.querySelector('.guide-desc-preview[data-index="' + textarea.dataset.index + '"]');
        if (preview) preview.innerHTML = mdInline(textarea.value) || '<span style="opacity:0.5">（空）</span>';
    }

    // 选择图片 → 转 Base64 → 以 Markdown 语法插入到对应 textarea 光标处
    function pickImageFor(index) {
        const ta = document.querySelector('.guide-cat-desc-input[data-index="' + index + '"]');
        if (ta) pickImageForTextarea(ta, () => updateDescPreview(ta));
    }

    function pickImageForTextarea(ta, afterInsert) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files && input.files[0];
            if (!file) return;
            if (file.size > 500 * 1024) {
                showToast('⚠️ 图片超过 500KB，Base64 内嵌会显著增大 posts.js，建议先压缩');
            }
            const reader = new FileReader();
            reader.onload = () => {
                insertAtCursor(ta, `![${file.name.replace(/\.[^.]+$/, '')}](${reader.result})`);
                if (afterInsert) afterInsert();
                showToast('🖼️ 图片已插入（Base64 内嵌）');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }

    function insertAtCursor(textarea, text) {
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || start;
        textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
    }

    function renderEditBar() {
        const bar = document.getElementById('guideEditBar');
        if (!bar) return;
        if (!isLocalEnv()) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        bar.innerHTML = editing
            ? '<button class="guide-edit-btn guide-edit-save" id="guideSaveBtn">💾 保存</button>' +
              '<button class="guide-edit-btn" id="guideCancelBtn">↩️ 取消</button>'
            : '<button class="guide-edit-btn" id="guideEditBtn">✏️ 编辑导读</button>';

        if (editing) {
            document.getElementById('guideSaveBtn').onclick = saveGuide;
            document.getElementById('guideCancelBtn').onclick = cancelEdit;
        } else {
            document.getElementById('guideEditBtn').onclick = enterEdit;
        }
    }

    function enterEdit() {
        editing = true;
        renderGuide();
        showToast('✏️ 编辑模式：修改后点击「保存」');
    }

    function cancelEdit() {
        editing = false;
        renderGuide();
    }

    // 编辑中关闭/刷新页面前提示
    window.addEventListener('beforeunload', function(e) {
        if (editing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ========== 收集编辑内容 ==========

    function collectEdits() {
        const title = document.getElementById('editPageTitle').value.trim();
        const intro = document.getElementById('editPageIntro').value.trim();
        if (!title) {
            showToast('❌ 页面标题不能为空');
            return null;
        }

        const nameInputs = document.querySelectorAll('.guide-cat-name-input');
        const descInputs = document.querySelectorAll('.guide-cat-desc-input');
        const cats = guideCategories.map((c, i) => ({
            name: nameInputs[i].value.trim(),
            desc: descInputs[i].value.trim(),
            posts: c.posts
        }));
        for (const c of cats) {
            if (!c.name) {
                showToast('❌ 有分类大标题为空，请填写');
                return null;
            }
        }
        return { title, intro, cats };
    }

    function buildPageSection(data) {
        return `    title: ${JSON.stringify(data.title)},\n    intro: ${JSON.stringify(data.intro)}`;
    }

    function buildGuideEntries(cats) {
        return cats.map(c =>
`    {
        name: ${JSON.stringify(c.name)},
        desc: ${JSON.stringify(c.desc)},
        posts: [${c.posts.map(p => JSON.stringify(p)).join(', ')}]
    }`).join(',\n');
    }

    // 应用到内存数据并退出编辑模式
    function applyEdits(data) {
        const cfg = getPageConfig();
        cfg.title = data.title;
        cfg.intro = data.intro;
        guideCategories.length = 0;
        data.cats.forEach(c => guideCategories.push(c));
        editing = false;
        renderGuide();
    }

    // ========== 保存到 posts.js（复用 write.html 的文件授权） ==========

    function openHandleDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('blog-editor-handles', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('handles');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getStoredHandle(key) {
        const db = await openHandleDB();
        return new Promise((resolve, reject) => {
            const req = db.transaction('handles', 'readonly').objectStore('handles').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function storeHandle(key, handle) {
        const db = await openHandleDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getPostsFileHandle() {
        let handle = null;
        try { handle = await getStoredHandle('postsJs'); } catch (e) { /* 忽略读取失败 */ }

        if (handle) {
            const opts = { mode: 'readwrite' };
            if ((await handle.queryPermission(opts)) === 'granted') return handle;
            if ((await handle.requestPermission(opts)) === 'granted') return handle;
        }

        showToast('📂 请在弹窗中选择本项目的 js/posts.js 文件');
        const [picked] = await window.showOpenFilePicker({
            types: [{ description: 'posts.js', accept: { 'text/javascript': ['.js'] } }],
            multiple: false
        });
        await storeHandle('postsJs', picked);
        return picked;
    }

    async function saveGuide() {
        const data = collectEdits();
        if (!data) return;

        // 浏览器不支持直接写文件：降级为复制代码手动粘贴
        if (!window.showOpenFilePicker) {
            const code = `const guidePageConfig = {\n${buildPageSection(data)}\n};\n\nconst guideCategories = [\n${buildGuideEntries(data.cats)}\n];`;
            try {
                await navigator.clipboard.writeText(code);
                showToast('📋 已复制代码，请手动替换 posts.js 中对应两段内容');
            } catch (e) {
                showToast('❌ 复制失败，请用 Chrome/Edge 打开以直接保存');
            }
            return;
        }

        try {
            const handle = await getPostsFileHandle();
            const text = await (await handle.getFile()).text();

            // 替换导读页面配置区
            const pBegin = text.indexOf(PAGE_BEGIN_MARK);
            const pEnd = text.indexOf(PAGE_END_MARK);
            if (pBegin === -1 || pEnd === -1 || pBegin > pEnd) {
                showToast('❌ posts.js 中未找到导读页面配置标记，请检查文件');
                return;
            }
            let newText = text.slice(0, pBegin + PAGE_BEGIN_MARK.length) + '\n'
                + buildPageSection(data) + '\n' + text.slice(pEnd);

            // 替换导读分类区
            const gBegin = newText.indexOf(GUIDE_BEGIN_MARK);
            const gEnd = newText.indexOf(GUIDE_END_MARK);
            if (gBegin === -1 || gEnd === -1 || gBegin > gEnd) {
                showToast('❌ posts.js 中未找到导读区标记，请检查文件');
                return;
            }
            newText = newText.slice(0, gBegin + GUIDE_BEGIN_MARK.length) + '\n'
                + buildGuideEntries(data.cats) + '\n' + newText.slice(gEnd);

            const writable = await handle.createWritable();
            await writable.write(newText);
            await writable.close();

            applyEdits(data);
            showToast('✅ 导读已保存到 posts.js！双击 publish.bat 发布');
        } catch (e) {
            if (e.name === 'AbortError') {
                showToast('⚠️ 已取消文件选择，未保存');
            } else {
                showToast('❌ 保存失败：' + e.message);
            }
        }
    }

    // ========== 启动 ==========

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderGuide);
    } else {
        renderGuide();
    }
})();
