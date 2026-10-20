/**
 * ELS Studio — authoring application.
 * Screen list (add / duplicate / delete / reorder), categorized screen library
 * with live previews, schema-driven editor, live preview (desktop/tablet/mobile),
 * course settings & theme, templates, undo/redo, autosave, validation,
 * JSON import/export and SCORM 1.2 / 2004 export.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, I = ELS.icons;
    var $ = function (id) { return document.getElementById(id); };

    var S = {
        course: null, sel: 0, tab: 'content', device: 'desktop',
        past: [], future: [], snap: null,
        openState: {}, activeState: {}, form: null, report: null, previewReady: false
    };

    /* ------------------------------------------------------------------ *
     * Persistence (IndexedDB with localStorage fallback)
     * ------------------------------------------------------------------ */
    var DB = {
        db: null,
        open: function () {
            return new Promise(function (resolve) {
                if (!root.indexedDB) return resolve(null);
                try {
                    var req = indexedDB.open('els-studio', 1);
                    req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
                    req.onsuccess = function () { DB.db = req.result; resolve(DB.db); };
                    req.onerror = function () { resolve(null); };
                } catch (e) { resolve(null); }
            });
        },
        get: function (k) {
            return new Promise(function (resolve) {
                if (!DB.db) { try { resolve(JSON.parse(localStorage.getItem('els-studio:' + k))); } catch (e) { resolve(null); } return; }
                var tx = DB.db.transaction('kv', 'readonly').objectStore('kv').get(k);
                tx.onsuccess = function () { resolve(tx.result || null); };
                tx.onerror = function () { resolve(null); };
            });
        },
        set: function (k, v) {
            return new Promise(function (resolve, reject) {
                if (!DB.db) { try { localStorage.setItem('els-studio:' + k, JSON.stringify(v)); resolve(); } catch (e) { reject(e); } return; }
                var tx = DB.db.transaction('kv', 'readwrite');
                tx.objectStore('kv').put(v, k);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        }
    };

    function templates() { try { return JSON.parse(localStorage.getItem('els-templates') || '[]'); } catch (e) { return []; } }
    function saveTemplates(list) { try { localStorage.setItem('els-templates', JSON.stringify(list)); return true; } catch (e) { toast('Could not save template (storage full).', 'error'); return false; } }

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */
    function toast(msg, kind) {
        var el = h('div.a-toast' + (kind ? '.is-' + kind : ''), { text: msg });
        $('toasts').appendChild(el);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, kind === 'error' ? 6000 : 3200);
    }
    function download(name, data, mime) {
        var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = h('a', { href: url, download: name });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
    function slug(s) { return String(s || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'course'; }
    function screen() { return S.course.screens[S.sel]; }
    function def(s) { return ELS.registry.get(s && s.type); }

    function modal(title, opts) {
        opts = opts || {};
        var body = h('div.a-dialog-body');
        var foot = h('div.a-dialog-foot');
        var close = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); document.removeEventListener('keydown', esc); if (opts.onClose) opts.onClose(); if (prev && prev.focus) prev.focus(); };
        var dlg = h('div.a-dialog' + (opts.wide ? '.is-wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            h('div.a-dialog-head', h('h2', { text: title }), h('button.a-ibtn', { type: 'button', 'aria-label': 'Close', html: I.cross, onclick: function () { close(); } })),
            body, opts.noFoot ? null : foot);
        var wrap = h('div.a-modal', { onclick: function (e) { if (e.target === wrap) close(); } }, dlg);
        var prev = document.activeElement;
        function esc(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', esc);
        document.body.appendChild(wrap);
        setTimeout(function () { var f = dlg.querySelector('input, select, button:not(.a-ibtn), textarea'); if (f) f.focus(); }, 30);
        return { body: body, foot: foot, close: close, el: dlg };
    }

    /* ------------------------------------------------------------------ *
     * History / commit
     * ------------------------------------------------------------------ */
    var pushHistory = util.debounce(function () {
        var now = JSON.stringify(S.course);
        if (now === S.snap) return;
        if (S.snap) { S.past.push(S.snap); if (S.past.length > 80) S.past.shift(); }
        S.snap = now; S.future = [];
        updateUndo();
    }, 500);

    function commit(structural) {
        pushHistory();
        validate();
        if (structural) renderList(); else updateListItem(S.sel);
        updateHeader();
        sendPreview();
        autosave();
    }

    function updateUndo() {
        $('btn-undo').disabled = !S.past.length;
        $('btn-redo').disabled = !S.future.length;
    }
    function undo() {
        if (!S.past.length) return;
        S.future.push(JSON.stringify(S.course));
        S.snap = S.past.pop();
        S.course = JSON.parse(S.snap);
        S.sel = Math.min(S.sel, S.course.screens.length - 1);
        refreshAll(); updateUndo(); autosave();
    }
    function redo() {
        if (!S.future.length) return;
        S.past.push(JSON.stringify(S.course));
        S.snap = S.future.pop();
        S.course = JSON.parse(S.snap);
        S.sel = Math.min(S.sel, S.course.screens.length - 1);
        refreshAll(); updateUndo(); autosave();
    }

    var autosave = util.debounce(function () {
        DB.set('course', S.course).catch(function () { toast('Autosave failed — the course may be too large for browser storage. Export JSON to keep your work.', 'error'); });
    }, 800);

    function setCourse(c, keepHistory) {
        S.course = ELS.normalizeCourse(util.clone(c));
        S.sel = 0; S.openState = {}; S.activeState = {};
        if (!keepHistory) { S.past = []; S.future = []; }
        S.snap = JSON.stringify(S.course);
        refreshAll(); updateUndo(); autosave();
    }

    function refreshAll() {
        validate();
        renderList();
        renderEditor();
        updateHeader();
        sendPreview(true);
    }

    /* ------------------------------------------------------------------ *
     * Validation
     * ------------------------------------------------------------------ */
    function validate() { S.report = ELS.schema.validateCourse(S.course); return S.report; }
    function issuesOf(s) { return (S.report && s && S.report.screens[s.id]) || []; }

    function updateHeader() {
        var t = $('course-title');
        if (document.activeElement !== t) t.value = S.course.title || '';
        var r = S.report, pill = $('status-pill');
        if (r.errors) { pill.className = 'a-status-pill is-error'; pill.innerHTML = I.info + '<span>' + r.errors + ' error' + (r.errors > 1 ? 's' : '') + (r.warnings ? ' · ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') : '') + '</span>'; }
        else { pill.className = 'a-status-pill is-ok'; pill.innerHTML = I.check + '<span>Ready' + (r.warnings ? ' · ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') : '') + '</span>'; }
        $('screen-count').textContent = S.course.screens.length + ' · ' + S.course.screens.filter(function (s) { return ELS.registry.isScored(s); }).length + ' scored';
        var s = screen();
        $('stage-info').textContent = s ? (S.sel + 1) + ' / ' + S.course.screens.length + ' · ' + (def(s) ? def(s).label : s.type) + ' · ' + (S.course.dir === 'rtl' ? 'RTL' : 'LTR') + ' · ' + S.course.lang : 'No screens';
    }

    function showIssues() {
        var m = modal('Validation', {});
        var any = false;
        S.course.screens.forEach(function (s, i) {
            var is = issuesOf(s);
            if (!is.length) return;
            any = true;
            m.body.appendChild(h('h3', { style: { margin: '14px 0 4px', fontSize: '14px' } }, (i + 1) + '. ' + (s.title || s.id)));
            var ul = h('ul.a-export-list');
            is.forEach(function (x) {
                ul.appendChild(h('li', { style: { color: x.level === 'warning' ? '#7a5600' : '#8c2a26', cursor: 'pointer' }, onclick: function () { m.close(); select(i); }, text: (x.level === 'warning' ? '⚠ ' : '✖ ') + x.message }));
            });
            m.body.appendChild(ul);
        });
        (S.report.course || []).forEach(function (x) { any = true; m.body.appendChild(h('p', { text: x.message })); });
        if (!any) m.body.appendChild(h('p', { text: 'No problems found. Every screen is valid and ready to export.' }));
        m.foot.appendChild(h('button.a-btn', { type: 'button', text: 'Close', onclick: m.close }));
    }

    /* ------------------------------------------------------------------ *
     * Screen list
     * ------------------------------------------------------------------ */
    function renderList() {
        var list = $('screen-list');
        list.innerHTML = '';
        var lastSection = null;
        S.course.screens.forEach(function (s, i) {
            if (s.section && s.section !== lastSection) { list.appendChild(h('li.a-section-label', { text: s.section, 'aria-hidden': 'true' })); }
            lastSection = s.section || lastSection;
            list.appendChild(listItem(s, i));
        });
        if (!S.course.screens.length) list.appendChild(h('li.a-empty', { text: 'No screens yet. Add your first screen.' }));
    }

    function listItem(s, i) {
        var d = def(s), is = issuesOf(s);
        var err = is.some(function (x) { return x.level !== 'warning'; }), warn = !err && is.length;
        var li = h('li.a-screen' + (i === S.sel ? '.is-selected' : ''), { draggable: 'true', tabindex: '0', 'data-i': i, 'aria-current': i === S.sel ? 'true' : null, 'aria-label': (i + 1) + '. ' + (s.title || s.id) },
            h('span.a-screen-num', { text: String(i + 1) }),
            h('span.a-screen-icon', { html: d ? d.icon : I.info }),
            h('span.a-screen-text', h('span.a-screen-title', { text: s.title || '(untitled)' }), h('span.a-screen-type', { text: (d ? d.label : s.type) + (ELS.registry.isScored(s) ? ' · ' + ELS.registry.maxPoints(s) + ' pts' : '') })),
            err || warn ? h('span.a-screen-flag' + (err ? '.is-error' : '.is-warning'), { title: is.map(function (x) { return x.message; }).join('\n') }) : null,
            h('span.a-screen-acts',
                h('button.a-ibtn', { type: 'button', title: 'Duplicate', 'aria-label': 'Duplicate screen', html: I.plus, onclick: function (e) { e.stopPropagation(); duplicate(i); } }),
                h('button.a-ibtn.is-danger', { type: 'button', title: 'Delete', 'aria-label': 'Delete screen', html: I.cross, onclick: function (e) { e.stopPropagation(); removeScreen(i); } })));
        li.addEventListener('click', function () { select(i); });
        li.addEventListener('keydown', function (e) {
            if (e.target !== li) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
            else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveScreen(i, i + (e.key === 'ArrowUp' ? -1 : 1), true); }
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); var n = $('screen-list').querySelector('[data-i="' + (i + (e.key === 'ArrowUp' ? -1 : 1)) + '"]'); if (n) n.focus(); }
            else if (e.key === 'Delete') { e.preventDefault(); removeScreen(i); }
        });
        li.addEventListener('dragstart', function (e) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); li.classList.add('is-dragging'); });
        li.addEventListener('dragend', function () { li.classList.remove('is-dragging'); clearDrop(); });
        li.addEventListener('dragover', function (e) {
            e.preventDefault();
            var r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
            clearDrop(); li.classList.add(after ? 'is-drop-after' : 'is-drop-before');
        });
        li.addEventListener('drop', function (e) {
            e.preventDefault();
            var from = Number(e.dataTransfer.getData('text/plain'));
            var r = li.getBoundingClientRect(), after = e.clientY > r.top + r.height / 2;
            var to = i + (after ? 1 : 0);
            if (from < to) to--;
            clearDrop();
            if (isFinite(from) && from !== to) moveScreen(from, to);
        });
        return li;
    }
    function clearDrop() { Array.prototype.forEach.call(document.querySelectorAll('.is-drop-before, .is-drop-after'), function (x) { x.classList.remove('is-drop-before', 'is-drop-after'); }); }

    function updateListItem(i) {
        var old = $('screen-list').querySelector('[data-i="' + i + '"]');
        var s = S.course.screens[i];
        if (!old || !s) return renderList();
        var neu = listItem(s, i);
        old.parentNode.replaceChild(neu, old);
    }

    function select(i, fromPreview) {
        if (i < 0 || i >= S.course.screens.length) return;
        var changed = i !== S.sel;
        S.sel = i;
        Array.prototype.forEach.call($('screen-list').querySelectorAll('.a-screen'), function (li) {
            var on = Number(li.getAttribute('data-i')) === i;
            li.classList.toggle('is-selected', on);
            if (on) { li.setAttribute('aria-current', 'true'); li.scrollIntoView({ block: 'nearest' }); } else li.removeAttribute('aria-current');
        });
        if (changed) { S.openState = {}; S.activeState = {}; }
        renderEditor();
        updateHeader();
        if (!fromPreview) postPreview({ type: 'els:goto', index: i });
    }

    function insertScreen(s, at) {
        at = at === undefined ? S.sel + 1 : at;
        at = util.clamp(at, 0, S.course.screens.length);
        S.course.screens.splice(at, 0, s);
        S.sel = at; S.openState = {};
        commit(true); renderEditor();
        select(at);
    }
    function addFromType(type) {
        var s = ELS.newScreen(type, S.course);
        var prev = screen();
        if (prev && prev.section) s.section = prev.section;
        insertScreen(s);
        toast('Added "' + def(s).label + '" screen.', 'ok');
    }
    function addFromTemplate(tpl) {
        var s = util.clone(tpl.screen);
        s.id = ELS.uniqueId(S.course, s.id || s.type);
        insertScreen(s);
        toast('Added from template "' + tpl.name + '".', 'ok');
    }
    function duplicate(i) {
        var s = util.clone(S.course.screens[i]);
        s.id = ELS.uniqueId(S.course, s.id.replace(/-copy(-\d+)?$/, '') + '-copy');
        s.title = (s.title || '') + ' (copy)';
        S.course.screens.splice(i + 1, 0, s);
        S.sel = i + 1;
        commit(true); renderEditor(); select(i + 1);
        toast('Screen duplicated.', 'ok');
    }
    function removeScreen(i) {
        var s = S.course.screens[i];
        if (!s) return;
        if (!root.confirm('Delete screen "' + (s.title || s.id) + '"? You can undo with Ctrl+Z.')) return;
        S.course.screens.splice(i, 1);
        S.sel = Math.max(0, Math.min(S.sel >= i ? S.sel - 1 : S.sel, S.course.screens.length - 1));
        if (S.sel < 0) S.sel = 0;
        commit(true); renderEditor(); select(S.sel);
    }
    function moveScreen(from, to, keepFocus) {
        if (to < 0 || to >= S.course.screens.length) return;
        var s = S.course.screens.splice(from, 1)[0];
        S.course.screens.splice(to, 0, s);
        S.sel = to;
        commit(true); renderEditor(); select(to);
        if (keepFocus) { var li = $('screen-list').querySelector('[data-i="' + to + '"]'); if (li) li.focus(); }
    }

    /* ------------------------------------------------------------------ *
     * Editor
     * ------------------------------------------------------------------ */
    function renderEditor() {
        var ed = $('editor');
        ed.innerHTML = '';
        var s = screen();
        if (!s) {
            ed.appendChild(h('div.a-empty', h('p', { text: 'Select or add a screen to edit it.' }), h('button.a-btn.is-primary', { type: 'button', html: I.plus + '<span>Add screen</span>', onclick: openLibrary })));
            return;
        }
        var d = def(s);
        var head = h('div.a-editor-head',
            h('span.a-screen-icon', { html: d ? d.icon : I.info }),
            h('div.a-editor-title', h('strong', { text: d ? d.label : s.type }), h('span', { text: 'Screen ' + (S.sel + 1) + ' · id: ' + s.id + (ELS.registry.isScored(s) ? ' · scored' : '') })),
            h('button.a-ibtn', { type: 'button', title: 'Save as reusable template', 'aria-label': 'Save as template', html: I.star, onclick: saveAsTemplate }),
            h('button.a-ibtn', { type: 'button', title: 'Duplicate screen', 'aria-label': 'Duplicate', html: I.plus, onclick: function () { duplicate(S.sel); } }),
            h('button.a-ibtn.is-danger', { type: 'button', title: 'Delete screen', 'aria-label': 'Delete', html: I.cross, onclick: function () { removeScreen(S.sel); } }));
        var tabs = h('div.a-tabs', { role: 'tablist' });
        [['content', 'Content'], ['screen', 'Screen & layout']].forEach(function (t) {
            tabs.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': S.tab === t[0] ? 'true' : 'false', text: t[1], onclick: function () { S.tab = t[0]; renderEditor(); } }));
        });
        var issueBox = h('div');
        var scroll = h('div.a-scroll');
        var formHost = h('div');
        scroll.appendChild(issueBox);
        scroll.appendChild(formHost);
        ed.appendChild(head); ed.appendChild(tabs); ed.appendChild(scroll);
        var fields;
        if (S.tab === 'screen') {
            fields = [{ key: 'id', label: 'Screen id', type: 'text', required: true, help: 'Used for branching, results and LMS interaction ids. Letters, digits, - and _.' }].concat(ELS.baseFields.filter(function (f) { return f.key !== 'title'; }));
        } else {
            fields = [ELS.baseFields[0]].concat(d ? d.fields : []);
        }
        var oldId = s.id;
        S.form = new root.ELSForm(formHost, {
            fields: fields, obj: s, root: s, course: S.course, scroller: scroll,
            openState: S.openState, activeState: S.activeState,
            onChange: function (structural) {
                if (s.id !== oldId) { renameRefs(oldId, s.id); oldId = s.id; }
                commit(structural);
                paintIssues(issueBox);
            }
        });
        S.form.render();
        paintIssues(issueBox);
    }

    function paintIssues(box) {
        var s = screen();
        var is = issuesOf(s);
        box.innerHTML = '';
        var errs = is.filter(function (x) { return x.level !== 'warning'; }), warns = is.filter(function (x) { return x.level === 'warning'; });
        [[errs, ''], [warns, '.is-warning']].forEach(function (pair) {
            if (!pair[0].length) return;
            var ul = h('ul');
            pair[0].forEach(function (x) {
                ul.appendChild(h('li', { text: x.message, onclick: function () {
                    var tgt = document.querySelector('#editor [data-path="' + x.path + '"]');
                    if (tgt) { tgt.scrollIntoView({ block: 'center', behavior: 'smooth' }); var f = tgt.querySelector('input,textarea,select,[contenteditable]'); if (f) f.focus(); }
                } }));
            });
            box.appendChild(h('div.a-issues' + pair[1], h('strong', { text: pair[1] ? 'Suggestions' : 'Fix before export' }), ul));
        });
        if (S.form) S.form.paintIssues(is);
    }

    /** Keep references valid when a screen id is renamed. */
    function renameRefs(from, to) {
        if (!from || !to || from === to) return;
        S.course.screens.forEach(function (s) {
            (s.choices || []).forEach(function (c) { if (c.goto === from) c.goto = to; });
            if (s.default_goto === from) s.default_goto = to;
            (s.sections || []).forEach(function (sec) { if (Array.isArray(sec.screen_ids)) sec.screen_ids = sec.screen_ids.map(function (x) { return x === from ? to : x; }); });
        });
    }

    function saveAsTemplate() {
        var s = screen();
        var name = root.prompt('Template name', s.title || def(s).label);
        if (!name) return;
        var list = templates();
        list.push({ id: util.uid('tpl'), name: name, type: s.type, created: new Date().toISOString(), screen: util.clone(s) });
        if (saveTemplates(list)) toast('Saved to "My templates" in the screen library.', 'ok');
    }

    /* ------------------------------------------------------------------ *
     * Live preview
     * ------------------------------------------------------------------ */
    function postPreview(msg) {
        var f = $('preview');
        if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*');
    }
    var sendPreview = util.debounce(function () {
        postPreview({ type: 'els:course', course: util.clone(S.course), index: S.sel });
    }, 280);

    root.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || typeof d !== 'object') return;
        var main = $('preview') && $('preview').contentWindow;
        if (e.source === main) {
            if (d.type === 'els:hello') sendPreview();
            else if (d.type === 'els:slide' && typeof d.index === 'number' && d.index !== S.sel) select(d.index, true);
        } else if (S.libFrame && e.source === S.libFrame.contentWindow && d.type === 'els:hello') {
            S.libSend();
        }
    });

    function setDevice(dev) {
        S.device = dev;
        $('device').className = 'a-device' + (dev === 'desktop' ? '' : ' is-' + dev);
        Array.prototype.forEach.call(document.querySelectorAll('[data-device]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-device') === dev ? 'true' : 'false'); });
    }

    function playFull(target) {
        try { localStorage.setItem('els-author-preview', JSON.stringify(S.course)); }
        catch (e) { toast('Course too large to open in a new tab (browser storage limit). Use Export instead.', 'error'); return; }
        root.open((target || 'course.html') + '?course=__author', '_blank');
    }

    /* ------------------------------------------------------------------ *
     * Screen library
     * ------------------------------------------------------------------ */
    function openLibrary() {
        var m = modal('Add a screen', { wide: true, noFoot: true, onClose: function () { S.libFrame = null; } });
        m.body.style.padding = '0';
        var cat = 'all', q = '', picked = null;
        var nav = h('nav.a-lib-nav', { 'aria-label': 'Categories' });
        var search = h('input.fe-input', { type: 'search', placeholder: 'Search screen types…', 'aria-label': 'Search screen types' });
        var grid = h('div.a-lib-grid');
        var frame = h('iframe', { title: 'Screen preview', src: 'course.html?preview=1' });
        var info = h('div.a-lib-preview-info');
        S.libFrame = frame;
        var lib = h('div.a-lib', nav, h('div.a-lib-main', h('div.a-lib-search', search), grid), h('div.a-lib-preview', h('div.a-lib-preview-frame', frame), info));
        m.body.appendChild(lib);
        var groups = ELS.registry.byCategory();
        function navBtn(id, label, count) {
            var b = h('button', { type: 'button', 'aria-pressed': cat === id ? 'true' : 'false', onclick: function () { cat = id; drawNav(); drawGrid(); } }, h('span', { text: label }), h('small', { text: String(count) }));
            nav.appendChild(b);
        }
        function drawNav() {
            nav.innerHTML = '';
            navBtn('all', 'All types', ELS.registry.all().length);
            groups.forEach(function (g) { navBtn(g.category.id, g.category.label, g.types.length); });
            navBtn('mine', 'My templates', templates().length);
        }
        function matches(d) { return !q || (d.label + ' ' + d.type + ' ' + (d.description || '')).toLowerCase().indexOf(q) >= 0; }
        function card(d, tpl) {
            var scored = ELS.registry.isScored(tpl ? tpl.screen : Object.assign({ type: d.type }, d.template));
            var tracks = !scored && ELS.registry.requiresInteraction(Object.assign({ type: d.type }, d.template));
            var c = h('button.a-card', { type: 'button', 'aria-pressed': 'false' },
                h('div.a-card-top', h('span.a-card-icon', { html: d.icon }), h('strong', { text: tpl ? tpl.name : d.label })),
                h('p', { text: tpl ? d.label + ' · saved ' + (tpl.created || '').slice(0, 10) : d.description }),
                h('div.a-card-tags', h('span.a-tag', { text: d.type }), scored ? h('span.a-tag.is-scored', { text: 'Scored' }) : null, tracks ? h('span.a-tag.is-track', { text: 'Tracks completion' }) : null));
            c.addEventListener('click', function () {
                Array.prototype.forEach.call(grid.querySelectorAll('.a-card'), function (x) { x.setAttribute('aria-pressed', 'false'); });
                c.setAttribute('aria-pressed', 'true');
                picked = { d: d, tpl: tpl };
                showPreview();
            });
            c.addEventListener('dblclick', function () { add(); });
            if (tpl) {
                c.appendChild(h('span.a-card-del', h('button.a-ibtn.is-danger', { type: 'button', title: 'Delete template', 'aria-label': 'Delete template', html: I.cross, onclick: function (e) {
                    e.stopPropagation();
                    if (!root.confirm('Delete template "' + tpl.name + '"?')) return;
                    saveTemplates(templates().filter(function (x) { return x.id !== tpl.id; })); drawNav(); drawGrid();
                } })));
            }
            return c;
        }
        function drawGrid() {
            grid.innerHTML = '';
            if (cat === 'mine') {
                var tl = templates().filter(function (t) { var d = ELS.registry.get(t.type); return d && (!q || (t.name + ' ' + d.label).toLowerCase().indexOf(q) >= 0); });
                if (!tl.length) grid.appendChild(h('p.a-empty', { text: 'No templates yet. Use the ★ button in the screen editor to save any screen as a reusable template.' }));
                tl.forEach(function (t) { grid.appendChild(card(ELS.registry.get(t.type), t)); });
                return;
            }
            groups.forEach(function (g) {
                if (cat !== 'all' && g.category.id !== cat) return;
                var ts = g.types.filter(matches);
                if (!ts.length) return;
                grid.appendChild(h('div.a-lib-cat', { text: g.category.label + ' — ' + g.category.description }));
                ts.forEach(function (d) { grid.appendChild(card(d)); });
            });
            if (!grid.children.length) grid.appendChild(h('p.a-empty', { text: 'No screen types match "' + q + '".' }));
        }
        function previewCourse() {
            var s = picked.tpl ? util.clone(picked.tpl.screen) : ELS.newScreen(picked.d.type, { screens: [] });
            return { id: 'lib-preview', title: 'Preview', lang: S.course.lang, dir: S.course.dir, theme: S.course.theme, settings: Object.assign({}, S.course.settings, { gate: 'none' }), screens: [s] };
        }
        S.libSend = function () { if (picked && frame.contentWindow) frame.contentWindow.postMessage({ type: 'els:course', course: previewCourse(), index: 0 }, '*'); };
        function showPreview() {
            info.innerHTML = '';
            var d = picked.d;
            info.appendChild(h('h3', { text: picked.tpl ? picked.tpl.name : d.label }));
            info.appendChild(h('p', { text: d.description }));
            info.appendChild(h('button.a-btn.is-primary', { type: 'button', html: I.plus + '<span>Add to course</span>', onclick: add }));
            S.libSend();
        }
        function add() {
            if (!picked) return;
            m.close();
            if (picked.tpl) addFromTemplate(picked.tpl); else addFromType(picked.d.type);
        }
        search.addEventListener('input', function () { q = search.value.trim().toLowerCase(); drawGrid(); });
        drawNav(); drawGrid();
        var first = grid.querySelector('.a-card'); if (first) first.click();
        search.focus();
    }

    /* ------------------------------------------------------------------ *
     * Course settings
     * ------------------------------------------------------------------ */
    var LANGS = [['en', 'English'], ['ar', 'العربية (Arabic)'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['pt', 'Português'], ['tr', 'Türkçe'], ['fa', 'فارسی (Persian)'], ['ur', 'اردو (Urdu)'], ['he', 'עברית (Hebrew)']];
    var FONTS = ['Work Sans', 'Rubik', 'Tajawal', 'Noto Sans Arabic', 'Inter', 'Segoe UI', 'Georgia', 'Arial'];
    var SETTINGS_FIELDS = [
        { section: 'Course' },
        { key: 'title', label: 'Course title', type: 'text', required: true },
        { key: 'id', label: 'Course identifier', type: 'text', required: true, pattern: '^[A-Za-z0-9_\\-.]+$', patternHelp: 'letters, digits, - _ .', help: 'Used in the SCORM manifest and for saving learner progress.' },
        { key: 'lang', label: 'Language (learner interface)', type: 'select', options: LANGS.map(function (l) { return { value: l[0], label: l[1] }; }), help: 'Buttons and feedback labels are translated for English and Arabic; other languages use English labels.' },
        { key: 'dir', label: 'Text direction', type: 'select', options: [{ value: 'ltr', label: 'Left to right' }, { value: 'rtl', label: 'Right to left (Arabic, Hebrew…)' }] },
        { key: 'settings', label: 'Learning & tracking', type: 'group', fields: [
            { key: 'scorm_version', label: 'SCORM version', type: 'select', options: [{ value: '1.2', label: 'SCORM 1.2' }, { value: '2004', label: 'SCORM 2004 (4th edition)' }] },
            { key: 'mastery_score', label: 'Pass mark (%)', type: 'number', min: 0, max: 100, help: 'Learners pass when their overall score reaches this percentage.' },
            { key: 'completion_rule', label: 'Course is complete when…', type: 'select', options: [{ value: 'all_viewed', label: 'Every screen is viewed and every required activity is done' }, { value: 'reached_end', label: 'The last screen is reached' }] },
            { key: 'gate', label: 'Navigation', type: 'select', options: [{ value: 'none', label: 'Free navigation' }, { value: 'scored', label: 'Must finish scored questions before moving on' }, { value: 'all', label: 'Must finish every required activity before moving on' }] },
            { key: 'transition', label: 'Screen transition', type: 'select', options: ['slide', 'fade', 'convex', 'concave', 'zoom', 'none'] },
            { key: 'show_progress', label: 'Show progress bar', type: 'bool' },
            { key: 'show_menu', label: 'Show contents menu', type: 'bool' },
            { key: 'show_score', label: 'Show score to learners', type: 'bool' },
            { key: 'shuffle_seed', label: 'Shuffle seed (optional)', type: 'text', help: 'Set to make option/question shuffling identical for every learner.' }
        ] },
        { key: 'theme', label: 'Design', type: 'group', fields: [
            { key: 'primary', label: 'Primary colour', type: 'color' },
            { key: 'primary_dark', label: 'Primary (dark)', type: 'color' },
            { key: 'accent', label: 'Accent colour', type: 'color' },
            { key: 'background', label: 'Page background', type: 'color' },
            { key: 'surface', label: 'Card background', type: 'color' },
            { key: 'text', label: 'Text colour', type: 'color' },
            { key: 'font', label: 'Body font', type: 'select', options: FONTS },
            { key: 'heading_font', label: 'Heading font', type: 'select', options: FONTS },
            { key: 'radius', label: 'Corner radius (px)', type: 'number', min: 0, max: 32 },
            { key: 'style', label: 'Visual style', type: 'select', options: [{ value: 'soft', label: 'Soft (shadows)' }, { value: 'flat', label: 'Flat (outlines)' }, { value: 'bold', label: 'Bold' }] }
        ] }
    ];

    function openSettings() {
        var m = modal('Course settings & design');
        var lang = S.course.lang;
        var host = h('div');
        m.body.appendChild(host);
        var form = new root.ELSForm(host, { fields: SETTINGS_FIELDS, obj: S.course, root: S.course, course: S.course, scroller: m.body, onChange: function (structural) {
            if (S.course.lang !== lang) { S.course.dir = util.isRtlLang(S.course.lang) ? 'rtl' : 'ltr'; lang = S.course.lang; form.render(); }
            commit(structural);
            updateHeader();
        } });
        form.render();
        m.foot.appendChild(h('button.a-btn', { type: 'button', text: 'Reset design to defaults', onclick: function () { S.course.theme = util.clone(ELS.defaultTheme); form.render(); commit(true); } }));
        m.foot.appendChild(h('button.a-btn.is-primary', { type: 'button', text: 'Done', onclick: m.close }));
    }

    /* ------------------------------------------------------------------ *
     * Import / export
     * ------------------------------------------------------------------ */
    function exportJson() {
        download(slug(S.course.title) + '.json', JSON.stringify(S.course, null, 2), 'application/json');
        toast('Course JSON downloaded.', 'ok');
    }
    function parseCourseText(text) {
        var t = text.trim();
        if (t.charAt(0) === '{') return JSON.parse(t);
        var m = /=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(t);
        if (m) return JSON.parse(m[1]);
        throw new Error('Unrecognised file format');
    }
    function importJson() {
        var inp = $('import-file');
        inp.value = '';
        inp.onchange = function () {
            var f = inp.files[0];
            if (!f) return;
            var fr = new FileReader();
            fr.onload = function () {
                try {
                    var c = parseCourseText(String(fr.result));
                    if (!c || !Array.isArray(c.screens)) throw new Error('No "screens" array found');
                    var unknown = c.screens.filter(function (s) { return !ELS.registry.has(s.type); }).map(function (s) { return s.type; });
                    S.past.push(JSON.stringify(S.course));
                    setCourse(c, true);
                    toast('Imported "' + S.course.title + '"' + (unknown.length ? ' — unknown types: ' + unknown.join(', ') : '') + '.', unknown.length ? 'error' : 'ok');
                } catch (e) { toast('Import failed: ' + e.message, 'error'); }
            };
            fr.readAsText(f);
        };
        inp.click();
    }

    function openExport() {
        validate();
        var m = modal('Export SCORM package');
        var ver = S.course.settings.scorm_version || '1.2';
        var verSel = h('select.fe-input', {}, h('option', { value: '1.2', text: 'SCORM 1.2 (widest LMS support)', selected: ver === '1.2' }), h('option', { value: '2004', text: 'SCORM 2004 4th edition', selected: ver === '2004' }));
        var name = h('input.fe-input', { type: 'text', value: slug(S.course.title) + '-scorm' });
        m.body.appendChild(h('div.fe-field', h('label', { text: 'Standard' }), verSel));
        m.body.appendChild(h('div.fe-field', h('label', { text: 'File name' }), h('div.fe-row', name, h('span', { text: '.zip' }))));
        var scored = S.course.screens.filter(function (s) { return ELS.registry.isScored(s); });
        m.body.appendChild(h('div.a-note', { html: '<strong>' + S.course.screens.length + ' screens</strong>, ' + scored.length + ' scored (' + scored.reduce(function (a, s) { return a + ELS.registry.maxPoints(s); }, 0) + ' points). Pass mark ' + S.course.settings.mastery_score + '%. ' +
            'The package reports progress, completion, score, pass/fail and question-level interactions, and saves learner state for resume.' }));
        if (S.report.errors) {
            var ul = h('ul.a-export-list');
            S.course.screens.forEach(function (s, i) { issuesOf(s).filter(function (x) { return x.level !== 'warning'; }).forEach(function (x) { ul.appendChild(h('li', { text: (i + 1) + '. ' + (s.title || s.id) + ': ' + x.message, style: { cursor: 'pointer' }, onclick: function () { m.close(); select(i); } })); }); });
            m.body.appendChild(h('div.a-note.is-warn', h('strong', { text: 'Fix ' + S.report.errors + ' error(s) before exporting:' }), ul));
        }
        if (location.protocol === 'file:') {
            m.body.appendChild(h('div.a-note.is-warn', { html: 'You opened the studio from a file. Browsers block reading project files from <code>file://</code>, so packaging needs the local server:<br><code>node tools/serve.js</code> → <code>http://localhost:8080/author.html</code><br>Or export JSON and run <code>node tools/build-scorm.js course.json</code>.' }));
        }
        var status = h('p.fe-help');
        m.body.appendChild(status);
        var go = h('button.a-btn.is-primary', { type: 'button', html: I.check + '<span>Build package</span>', disabled: !!S.report.errors });
        m.foot.appendChild(h('button.a-btn', { type: 'button', text: 'Export JSON instead', onclick: exportJson }));
        m.foot.appendChild(go);
        go.addEventListener('click', function () {
            go.disabled = true;
            status.textContent = 'Packaging…';
            var version = verSel.value;
            root.ELSPackager.build(S.course, {
                ELS: ELS, version: version,
                readFile: function (p) { return fetch(p, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (b) { return new Uint8Array(b); }); }
            }).then(function (res) {
                download((name.value.trim() || 'course-scorm') + '.zip', new Blob([res.zip], { type: 'application/zip' }));
                status.textContent = 'Done: ' + res.files.length + ' files, ' + Math.round(res.zip.length / 1024) + ' KB.' + (res.warnings.length ? ' Warnings: ' + res.warnings.join(' · ') : '');
                toast('SCORM ' + version + ' package created.', 'ok');
                go.disabled = false;
            }).catch(function (e) {
                status.textContent = 'Export failed: ' + e.message;
                toast('Export failed: ' + e.message, 'error');
                go.disabled = false;
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * File menu & boot
     * ------------------------------------------------------------------ */
    function buildMenu() {
        var menu = $('menu-file'), btn = $('btn-file');
        function item(icon, label, fn) { return h('button', { type: 'button', role: 'menuitem', html: (I[icon] || '') + '<span>' + util.esc(label) + '</span>', onclick: function () { toggle(false); fn(); } }); }
        menu.appendChild(item('plus', 'New empty course', function () {
            if (!root.confirm('Start a new empty course? The current course stays in undo history.')) return;
            S.past.push(JSON.stringify(S.course));
            setCourse({ title: 'Untitled course', lang: 'en', screens: [ELS.newScreen('title_slide', { screens: [] })] }, true);
        }));
        menu.appendChild(item('content', 'Load English sample (31 types)', function () { S.past.push(JSON.stringify(S.course)); setCourse(root.ELS_COURSES['sample-en'], true); toast('English sample loaded.', 'ok'); }));
        menu.appendChild(item('content', 'Load Arabic sample — RTL (31 types)', function () { S.past.push(JSON.stringify(S.course)); setCourse(root.ELS_COURSES['sample-ar'], true); toast('Arabic sample loaded.', 'ok'); }));
        menu.appendChild(h('hr'));
        menu.appendChild(item('down', 'Import course JSON…', importJson));
        menu.appendChild(item('up', 'Export course JSON', exportJson));
        menu.appendChild(h('hr'));
        menu.appendChild(item('play', 'Open in LMS test harness', function () { playFull('lms-test.html'); }));
        menu.appendChild(item('info', 'Validation report', showIssues));
        function toggle(v) { var open = v === undefined ? menu.hidden : v; menu.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) { var f = menu.querySelector('button'); if (f) f.focus(); } }
        btn.addEventListener('click', function () { toggle(); });
        document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) toggle(false); });
        menu.addEventListener('keydown', function (e) { if (e.key === 'Escape') { toggle(false); btn.focus(); } });
    }

    function wire() {
        $('brand-mark').innerHTML = I.lottie;
        $('btn-undo').innerHTML = I.chevronL; $('btn-redo').innerHTML = I.chevronR;
        $('btn-settings').innerHTML = I.tabs + '<span>Settings</span>';
        $('btn-play').innerHTML = I.play + '<span>Preview</span>';
        $('btn-file').innerHTML = I.menu + '<span>File</span>';
        $('btn-export').innerHTML = I.up + '<span>Export SCORM</span>';
        $('btn-add').innerHTML = I.plus + '<span>Add screen</span>';
        $('btn-restart-preview').innerHTML = I.refresh + '<span>Reset</span>';
        $('btn-undo').addEventListener('click', undo);
        $('btn-redo').addEventListener('click', redo);
        $('btn-settings').addEventListener('click', openSettings);
        $('btn-play').addEventListener('click', function () { playFull(); });
        $('btn-export').addEventListener('click', openExport);
        $('btn-add').addEventListener('click', openLibrary);
        $('status-pill').addEventListener('click', showIssues);
        $('btn-restart-preview').addEventListener('click', function () { postPreview({ type: 'els:restart' }); });
        $('course-title').addEventListener('input', function () { S.course.title = $('course-title').value; commit(false); });
        Array.prototype.forEach.call(document.querySelectorAll('[data-device]'), function (b) { b.addEventListener('click', function () { setDevice(b.getAttribute('data-device')); }); });
        $('preview').addEventListener('load', function () { sendPreview(); });
        document.addEventListener('keydown', function (e) {
            var inField = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
            var mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
            else if (mod && e.key.toLowerCase() === 'y' && !inField) { e.preventDefault(); redo(); }
            else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); exportJson(); }
            else if (mod && e.key.toLowerCase() === 'd' && !inField) { e.preventDefault(); duplicate(S.sel); }
        });
        buildMenu();
    }

    root.ELSStudio = {
        toast: toast, state: S, select: select, addFromType: addFromType, duplicate: duplicate, moveScreen: moveScreen,
        removeScreen: removeScreen, undo: undo, redo: redo, setCourse: setCourse, openLibrary: openLibrary, openSettings: openSettings,
        openExport: openExport, validate: validate
    };

    wire();
    DB.open().then(function () { return DB.get('course'); }).then(function (saved) {
        var start = saved && Array.isArray(saved.screens) ? saved : root.ELS_COURSES['sample-en'];
        setCourse(start);
        if (!saved) toast('Loaded the English sample course (all 31 screen types). Use File → New for a blank course.');
    });
})(window);
