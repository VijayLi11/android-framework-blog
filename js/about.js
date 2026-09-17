/**
 * 关于页逻辑
 * - 从 posts.js 的 aboutConfig 渲染整个页面（头部 + 专注领域 + 技术栈 + 时间线）
 * - 本地环境（file:// / localhost）显示「✏️ 编辑」入口，可就地编辑全部内容
 * - 保存通过 File System Access API 写回 js/posts.js（与 write.html / guide.html 共用同一次文件授权）
 */

(function() {
    'use strict';

    // posts.js 中的标记区
    const ABOUT_BEGIN_MARK = '// <<<ABOUT-BEGIN>>>';
    const ABOUT_END_MARK = '// <<<ABOUT-END>>>';

    const TAG_LEVELS = [
        { value: 'expert', label: '精通' },
        { value: 'proficient', label: '熟练' },
        { value: 'familiar', label: '了解' }
    ];

    let editing = false;
    let editData = null; // 编辑期间的工作副本

    // 仅本地环境显示编辑入口，线上访客不可见
    function isLocalEnv() {
        return ['', 'localhost', '127.0.0.1'].indexOf(location.hostname) !== -1;
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // 行内 Markdown 渲染；marked 不可用时回退为纯文本转义
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

    function getConfig() {
        return (typeof aboutConfig !== 'undefined') ? aboutConfig : {
            avatar: 'FW', name: '', title: '', github: '', email: '',
            skills: [], techTags: [], timeline: []
        };
    }

    // ========== 渲染：浏览模式 ==========

    function renderHeroView(cfg) {
        document.getElementById('aboutAvatar').textContent = cfg.avatar;
        document.getElementById('aboutName').textContent = cfg.name;
        document.getElementById('aboutTitle').innerHTML = mdInline(cfg.title);
        document.getElementById('aboutGithub').href = cfg.github || '#';
        document.getElementById('aboutEmail').href = 'mailto:' + (cfg.email || '');
        document.getElementById('aboutSocialEdit').innerHTML = '';
    }

    function renderSectionsView(cfg) {
        const skillsHtml = cfg.skills.map(s => `
                    <div class="skill-item">
                        <div class="skill-icon">${escapeAttr(s.icon)}</div>
                        <h3>${escapeAttr(s.title)}</h3>
                        <p>${mdInline(s.desc)}</p>
                    </div>`).join('');

        const tagsHtml = cfg.techTags.map(t =>
            `<span class="tech-tag ${escapeAttr(t.level)}">${escapeAttr(t.name)}</span>`).join('\n                    ');

        const timelineHtml = cfg.timeline.map(t => `
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <div class="timeline-date">${escapeAttr(t.date)}</div>
                            <h3>${escapeAttr(t.title)}</h3>
                            <p>${mdInline(t.desc)}</p>
                        </div>
                    </div>`).join('');

        document.getElementById('aboutContent').innerHTML = `
            <div class="about-card">
                <h2>🎯 专注领域</h2>
                <div class="skill-grid">${skillsHtml}
                </div>
            </div>

            <div class="about-card">
                <h2>🛠️ 技术栈</h2>
                <div class="tech-stack">
                    ${tagsHtml}
                </div>
            </div>

            <div class="about-card">
                <h2>📈 经历时间线</h2>
                <div class="timeline">${timelineHtml}
                </div>
            </div>`;
    }

    // ========== 渲染：编辑模式 ==========

    function renderHeroEdit(d) {
        document.getElementById('aboutAvatar').innerHTML =
            `<input class="guide-edit-input about-avatar-input" id="editAvatar" value="${escapeAttr(d.avatar)}" maxlength="4" title="头像字母">`;
        document.getElementById('aboutName').innerHTML =
            `<input class="guide-edit-input about-name-input" id="editName" value="${escapeAttr(d.name)}" placeholder="名字">`;
        document.getElementById('aboutTitle').innerHTML =
            `<input class="guide-edit-input" id="editTitle" value="${escapeAttr(d.title)}" placeholder="职位一句话">`;
        document.getElementById('aboutSocialEdit').innerHTML = `
                <input class="guide-edit-input" id="editGithub" value="${escapeAttr(d.github)}" placeholder="GitHub 链接 https://github.com/..." style="flex:1;min-width:220px;">
                <input class="guide-edit-input" id="editEmail" value="${escapeAttr(d.email)}" placeholder="邮箱" style="flex:1;min-width:180px;">`;
    }

    function renderSectionsEdit(d) {
        const actionBtns = (action, i, len) => `
                        <div class="about-edit-actions">
                            <button class="guide-img-btn" data-action="move" data-group="${action}" data-index="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
                            <button class="guide-img-btn" data-action="move" data-group="${action}" data-index="${i}" data-dir="1" ${i === len - 1 ? 'disabled' : ''}>↓</button>
                            <button class="guide-img-btn" data-action="del" data-group="${action}" data-index="${i}">🗑️</button>
                        </div>`;

        const skillsHtml = d.skills.map((s, i) => `
                    <div class="skill-item">
                        <input class="guide-edit-input about-skill-icon" data-index="${i}" value="${escapeAttr(s.icon)}" placeholder="图标emoji" maxlength="4">
                        <input class="guide-edit-input about-skill-title" data-index="${i}" value="${escapeAttr(s.title)}" placeholder="标题">
                        <textarea class="guide-edit-input about-skill-desc" data-index="${i}" rows="2" placeholder="描述（支持 Markdown 与换行）">${escapeAttr(s.desc)}</textarea>
                        ${actionBtns('skills', i, d.skills.length)}
                    </div>`).join('');

        const levelOptions = lv => TAG_LEVELS.map(l =>
            `<option value="${l.value}" ${l.value === lv ? 'selected' : ''}>${l.label}</option>`).join('');

        const tagsHtml = d.techTags.map((t, i) => `
                    <div class="about-tag-edit-row">
                        <input class="guide-edit-input about-tag-name" data-index="${i}" value="${escapeAttr(t.name)}" placeholder="标签名" style="flex:1;">
                        <select class="about-tag-level" data-index="${i}">${levelOptions(t.level)}</select>
                        <button class="guide-img-btn" data-action="del" data-group="techTags" data-index="${i}">🗑️</button>
                    </div>`).join('');

        const timelineHtml = d.timeline.map((t, i) => `
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>
                        <div class="timeline-content">
                            <input class="guide-edit-input about-tl-date" data-index="${i}" value="${escapeAttr(t.date)}" placeholder="时间，如 2023 - 至今" style="max-width:220px;">
                            <input class="guide-edit-input about-tl-title" data-index="${i}" value="${escapeAttr(t.title)}" placeholder="职位">
                            <textarea class="guide-edit-input about-tl-desc" data-index="${i}" rows="2" placeholder="描述（支持 Markdown 与换行）">${escapeAttr(t.desc)}</textarea>
                            ${actionBtns('timeline', i, d.timeline.length)}
                        </div>
                    </div>`).join('');

        document.getElementById('aboutContent').innerHTML = `
            <div class="about-card">
                <h2>🎯 专注领域</h2>
                <div class="skill-grid">${skillsHtml}
                </div>
                <button class="guide-img-btn" data-action="add" data-group="skills" style="margin-top:10px;">➕ 新增卡片</button>
            </div>

            <div class="about-card">
                <h2>🛠️ 技术栈</h2>
                ${tagsHtml}
                <button class="guide-img-btn" data-action="add" data-group="techTags" style="margin-top:10px;">➕ 新增标签</button>
            </div>

            <div class="about-card">
                <h2>📈 经历时间线</h2>
                <div class="timeline">${timelineHtml}
                </div>
                <button class="guide-img-btn" data-action="add" data-group="timeline" style="margin-top:10px;">➕ 新增经历</button>
            </div>`;
    }

    // 区块操作：增 / 删 / 移动（先同步输入框内容到 editData，再操作，再重渲染）
    function handleAction(action, group, index, dir) {
        syncFromInputs();
        const arr = editData[group];
        if (action === 'add') {
            if (group === 'skills') arr.push({ icon: '✨', title: '', desc: '' });
            if (group === 'techTags') arr.push({ name: '', level: 'familiar' });
            if (group === 'timeline') arr.push({ date: '', title: '', desc: '' });
        } else if (action === 'del') {
            arr.splice(index, 1);
        } else if (action === 'move') {
            const target = index + dir;
            if (target < 0 || target >= arr.length) return;
            const tmp = arr[index];
            arr[index] = arr[target];
            arr[target] = tmp;
        }
        renderSectionsEdit(editData);
    }

    // ========== 编辑条 ==========

    function renderEditBar() {
        const bar = document.getElementById('aboutEditBar');
        if (!bar) return;
        if (!isLocalEnv()) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        bar.innerHTML = editing
            ? '<button class="guide-edit-btn guide-edit-save" id="aboutSaveBtn">💾 保存</button>' +
              '<button class="guide-edit-btn" id="aboutCancelBtn">↩️ 取消</button>'
            : '<button class="guide-edit-btn" id="aboutEditBtn">✏️ 编辑关于页</button>';

        if (editing) {
            document.getElementById('aboutSaveBtn').onclick = saveAbout;
            document.getElementById('aboutCancelBtn').onclick = cancelEdit;
        } else {
            document.getElementById('aboutEditBtn').onclick = enterEdit;
        }
    }

    function renderAbout() {
        const cfg = getConfig();
        renderEditBar();
        if (editing) {
            renderHeroEdit(editData);
            renderSectionsEdit(editData);
        } else {
            renderHeroView(cfg);
            renderSectionsView(cfg);
        }
    }

    function enterEdit() {
        editData = JSON.parse(JSON.stringify(getConfig()));
        editing = true;
        renderAbout();
        showToast('✏️ 编辑模式：修改后点击「保存」');
    }

    function cancelEdit() {
        editing = false;
        editData = null;
        renderAbout();
    }

    // 编辑中关闭/刷新页面前提示
    window.addEventListener('beforeunload', function(e) {
        if (editing) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // ========== 收集编辑内容 ==========

    function valuesOf(selector) {
        return Array.from(document.querySelectorAll(selector)).map(el => el.value.trim());
    }

    function syncFromInputs() {
        editData.avatar = document.getElementById('editAvatar').value.trim();
        editData.name = document.getElementById('editName').value.trim();
        editData.title = document.getElementById('editTitle').value.trim();
        editData.github = document.getElementById('editGithub').value.trim();
        editData.email = document.getElementById('editEmail').value.trim();

        const icons = valuesOf('.about-skill-icon');
        const titles = valuesOf('.about-skill-title');
        const descs = valuesOf('.about-skill-desc');
        editData.skills = icons.map((icon, i) => ({ icon: icon, title: titles[i], desc: descs[i] }));

        const names = valuesOf('.about-tag-name');
        const levels = Array.from(document.querySelectorAll('.about-tag-level')).map(el => el.value);
        editData.techTags = names.map((name, i) => ({ name: name, level: levels[i] }))
            .filter(t => t.name); // 空标签名直接丢弃

        const dates = valuesOf('.about-tl-date');
        const tlTitles = valuesOf('.about-tl-title');
        const tlDescs = valuesOf('.about-tl-desc');
        editData.timeline = dates.map((date, i) => ({ date: date, title: tlTitles[i], desc: tlDescs[i] }));
    }

    function buildAboutSection(d) {
        const skillEntries = d.skills.map(s =>
            `        { icon: ${JSON.stringify(s.icon)}, title: ${JSON.stringify(s.title)}, desc: ${JSON.stringify(s.desc)} }`).join(',\n');
        const tagEntries = d.techTags.map(t =>
            `        { name: ${JSON.stringify(t.name)}, level: ${JSON.stringify(t.level)} }`).join(',\n');
        const tlEntries = d.timeline.map(t =>
            `        { date: ${JSON.stringify(t.date)}, title: ${JSON.stringify(t.title)}, desc: ${JSON.stringify(t.desc)} }`).join(',\n');

        return `    avatar: ${JSON.stringify(d.avatar)},
    name: ${JSON.stringify(d.name)},
    title: ${JSON.stringify(d.title)},
    github: ${JSON.stringify(d.github)},
    email: ${JSON.stringify(d.email)},
    skills: [
${skillEntries}
    ],
    techTags: [
${tagEntries}
    ],
    timeline: [
${tlEntries}
    ]`;
    }

    // 应用到内存数据并退出编辑模式
    function applyEdits() {
        const cfg = getConfig();
        Object.keys(cfg).forEach(k => delete cfg[k]);
        Object.assign(cfg, JSON.parse(JSON.stringify(editData)));
        editing = false;
        editData = null;
        renderAbout();
    }

    // ========== 保存到 posts.js（复用 write.html / guide.html 的文件授权） ==========

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

    async function saveAbout() {
        syncFromInputs();

        if (!editData.name) {
            showToast('❌ 名字不能为空');
            return;
        }

        // 浏览器不支持直接写文件：降级为复制代码手动粘贴
        if (!window.showOpenFilePicker) {
            const code = `const aboutConfig = {\n${buildAboutSection(editData)}\n};`;
            try {
                await navigator.clipboard.writeText(code);
                showToast('📋 已复制代码，请手动替换 posts.js 中的 aboutConfig');
            } catch (e) {
                showToast('❌ 复制失败，请用 Chrome/Edge 打开以直接保存');
            }
            return;
        }

        try {
            const handle = await getPostsFileHandle();
            const text = await (await handle.getFile()).text();

            const begin = text.indexOf(ABOUT_BEGIN_MARK);
            const end = text.indexOf(ABOUT_END_MARK);
            if (begin === -1 || end === -1 || begin > end) {
                showToast('❌ posts.js 中未找到关于页配置标记，请检查文件');
                return;
            }
            const newText = text.slice(0, begin + ABOUT_BEGIN_MARK.length) + '\n'
                + buildAboutSection(editData) + '\n' + text.slice(end);

            const writable = await handle.createWritable();
            await writable.write(newText);
            await writable.close();

            applyEdits();
            showToast('✅ 关于页已保存到 posts.js！双击 publish.bat 发布');
        } catch (e) {
            if (e.name === 'AbortError') {
                showToast('⚠️ 已取消文件选择，未保存');
            } else {
                showToast('❌ 保存失败：' + e.message);
            }
        }
    }

    // ========== 启动 ==========

    function init() {
        renderAbout();

        // 事件委托：处理编辑模式下的 增/删/移动 按钮
        document.getElementById('aboutContent').addEventListener('click', function(e) {
            const btn = e.target.closest('[data-action]');
            if (!btn || !editing) return;
            handleAction(
                btn.dataset.action,
                btn.dataset.group,
                parseInt(btn.dataset.index, 10),
                parseInt(btn.dataset.dir || '0', 10)
            );
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
