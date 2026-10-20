/**
 * ELS Studio form engine — renders an editable form for any schema used by
 * the screen registry (ELS.registry type `fields`, ELS.baseFields, course
 * settings). Edits mutate the bound object in place and call onChange.
 *
 *   var form = new ELSForm(host, { fields, obj, root, course, onChange(structural), openState: {} });
 *   form.render(); form.paintIssues(issues);
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, I = ELS.icons;

    /** Files shipped with the project that authors can pick without uploading. */
    var ASSET_LIBRARY = root.ELS_ASSET_LIBRARY = [
        { path: 'img/samples/house.svg', kind: 'image', label: 'House (hotspot sample)' },
        { path: 'img/samples/plant.svg', kind: 'image', label: 'Plant diagram' },
        { path: 'img/samples/forest-before.svg', kind: 'image', label: 'Forest — before' },
        { path: 'img/samples/forest-after.svg', kind: 'image', label: 'Forest — after' },
        { path: 'img/samples/app.svg', kind: 'image', label: 'App screenshot (simulation)' },
        { path: 'img/greenpeace.svg', kind: 'image', label: 'Greenpeace logo' },
        { path: 'media/sample.mp4', kind: 'video', label: 'Sample video (8 s)' },
        { path: 'media/sample-en.vtt', kind: 'captions', label: 'Captions — English' },
        { path: 'media/sample-ar.vtt', kind: 'captions', label: 'Captions — Arabic' },
        { path: 'media/sample-lottie.json', kind: 'lottie', label: 'Lottie — pulsing sun' }
    ];

    var SUMMARY_KEYS = ['title', 'label', 'text', 'left', 'term_html', 'prompt', 'prompt_html', 'front_html', 'date', 'word', 'a', 'instruction_html', 'action_html', 'text_html', 'id'];

    function summary(item, idx) {
        for (var i = 0; i < SUMMARY_KEYS.length; i++) {
            var v = item && item[SUMMARY_KEYS[i]];
            if (typeof v === 'string' && util.stripHtml(v)) return util.stripHtml(v).slice(0, 80);
        }
        return '';
    }

    function shortId(prefix) { return (prefix || 'i') + Math.random().toString(36).slice(2, 7); }

    function newItem(fields, list) {
        var o = {};
        fields.forEach(function (f) {
            if (f.type === 'id') o[f.key] = shortId(f.key === 'id' ? 'i' : f.key);
            else if (f.key === 'id' && f.type === 'text') {
                var n = (list || []).length + 1, ids = (list || []).map(function (x) { return x.id; });
                while (ids.indexOf('scene-' + n) >= 0) n++;
                o.id = 'scene-' + n;
            } else if (f.default !== undefined) o[f.key] = util.clone(f.default);
            else if (f.type === 'list') o[f.key] = [];
            else if (f.type === 'group') o[f.key] = ELS.schema.applyDefaults(f.fields || [], {});
        });
        return o;
    }

    function readFileAsDataUri(file, cb) {
        var fr = new FileReader();
        fr.onload = function () {
            var uri = String(fr.result);
            var ext = (file.name.split('.').pop() || '').toLowerCase();
            var fix = { vtt: 'text/vtt', json: 'application/json', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm' };
            if (fix[ext]) uri = uri.replace(/^data:[^;,]*/, 'data:' + fix[ext]);
            cb(uri);
        };
        fr.readAsDataURL(file);
    }

    function kindOf(src) {
        if (!src) return '';
        if (/^data:video\/|\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(src) || /youtu\.?be|vimeo\.com/i.test(src)) return 'video';
        if (/^data:audio\/|\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(src)) return 'audio';
        if (/^data:image\/|\.(png|jpe?g|gif|svg|webp|avif)(\?|#|$)/i.test(src) || /^https?:/.test(src)) return 'image';
        return 'file';
    }

    function Form(host, opts) {
        this.host = host;
        this.opts = opts;
        this.open = opts.openState || {};
        this.active = opts.activeState || {};
    }
    var F = Form.prototype;

    F.changed = function (structural) {
        if (this.opts.onChange) this.opts.onChange(!!structural);
        if (structural) this.render();
    };

    F.render = function () {
        var scroller = this.opts.scroller || this.host;
        var st = scroller.scrollTop;
        var focusPath = null, focusSel = null;
        var ae = document.activeElement;
        if (ae && this.host.contains(ae)) {
            var w = ae.closest('[data-path]');
            if (w) { focusPath = w.getAttribute('data-path'); focusSel = ae.tagName; }
        }
        this.host.innerHTML = '';
        this.host.appendChild(this.fieldset(this.opts.fields, this.opts.obj, '', this.opts.root || this.opts.obj));
        scroller.scrollTop = st;
        if (focusPath) {
            var again = this.host.querySelector('[data-path="' + focusPath.replace(/"/g, '\\"') + '"] ' + focusSel.toLowerCase());
            if (again) try { again.focus({ preventScroll: true }); } catch (e) { }
        }
        if (this.issues) this.paintIssues(this.issues);
    };

    F.fieldset = function (fields, obj, path, rootObj) {
        var box = h('div.fe');
        var self = this;
        fields.forEach(function (f) {
            if (f.section) { box.appendChild(h('h3.fe-section-title', { text: f.section })); return; }
            var el = self.field(f, obj, path ? path + '.' + f.key : f.key, rootObj);
            if (el) box.appendChild(el);
        });
        return box;
    };

    F.field = function (f, obj, path, rootObj) {
        var self = this;
        if (f.type === 'id') { if (!obj[f.key]) obj[f.key] = shortId(); return null; }
        if (!ELS.schema.visible(f, obj, rootObj)) return null;
        var wrap = h('div.fe-field', { 'data-path': path });
        var id = 'fe-' + path.replace(/[^\w]/g, '_');
        var label = f.label || f.key;
        var labelEl = h('label', { for: id }, h('span', label, f.required ? h('span.fe-req', { text: '*' }) : null));
        var ctl = null;
        var set = function (v, structural) {
            if (v === undefined) delete obj[f.key]; else obj[f.key] = v;
            self.changed(structural);
        };
        switch (f.type) {
            case 'text':
            case 'url-text':
                ctl = h('input.fe-input', { id: id, type: 'text', dir: 'auto', value: obj[f.key] == null ? '' : obj[f.key], placeholder: f.placeholder || '' });
                ctl.addEventListener('input', function () { set(ctl.value); });
                break;
            case 'textarea':
                ctl = h('textarea.fe-input', { id: id, dir: 'auto', rows: '3' });
                ctl.value = obj[f.key] || '';
                ctl.addEventListener('input', function () { set(ctl.value); });
                break;
            case 'number':
                var structNum = !!self.opts.numbersStructural; // numbers inside visual editors redraw the canvas
                ctl = h('input.fe-input', { id: id, type: 'number', value: obj[f.key] == null ? '' : obj[f.key], min: f.min, max: f.max, step: f.step || 'any' });
                ctl.addEventListener('input', function () { set(ctl.value === '' ? undefined : Number(ctl.value)); });
                ctl.addEventListener('change', function () { if (structNum) self.changed(true); });
                break;
            case 'bool':
                var cb = h('input', { id: id, type: 'checkbox', checked: !!obj[f.key] });
                cb.addEventListener('change', function () { set(cb.checked, true); });
                wrap.appendChild(h('label.fe-switch', cb, h('span', label)));
                if (f.help) wrap.appendChild(h('div.fe-help', { text: f.help }));
                return wrap;
            case 'select':
            case 'screen':
                ctl = this.select(f, obj, id, rootObj, set);
                break;
            case 'color':
                var cur = obj[f.key] || '';
                var picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#3b759e', 'aria-label': label });
                var txt = h('input.fe-input', { id: id, type: 'text', value: cur, placeholder: 'auto' });
                picker.addEventListener('input', function () { txt.value = picker.value; set(picker.value); });
                txt.addEventListener('change', function () { set(txt.value.trim() || undefined); if (/^#[0-9a-f]{6}$/i.test(txt.value)) picker.value = txt.value; });
                ctl = h('div.fe-color', picker, txt);
                break;
            case 'image': case 'media': case 'url': case 'lottie':
                ctl = this.media(f, obj, id, set);
                break;
            case 'html':
                ctl = this.rte(f, obj, id, set);
                break;
            case 'code': case 'json':
                ctl = h('textarea.fe-input.fe-code', { id: id, spellcheck: 'false', rows: '12' });
                ctl.value = obj[f.key] || '';
                ctl.addEventListener('input', function () { set(ctl.value); });
                ctl.addEventListener('keydown', function (e) {
                    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var s = ctl.selectionStart; ctl.setRangeText('  ', s, ctl.selectionEnd, 'end'); set(ctl.value); }
                });
                break;
            case 'strings':
                ctl = h('textarea.fe-input', { id: id, dir: 'auto', rows: '4', placeholder: 'One per line' });
                ctl.value = util.list(obj[f.key]).join('\n');
                ctl.addEventListener('input', function () { set(ctl.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)); });
                break;
            case 'screens':
                ctl = this.screens(f, obj, set);
                break;
            case 'group':
                if (!obj[f.key] || typeof obj[f.key] !== 'object') obj[f.key] = {};
                var fs = h('fieldset.fe-group', { 'data-path': path }, h('legend', { text: label }));
                fs.appendChild(this.fieldset(f.fields || [], obj[f.key], path, rootObj));
                return fs;
            case 'list':
                ctl = this.list(f, obj, path, rootObj);
                labelEl = h('div.fe-label', h('span', label, f.required || f.minItems ? h('span.fe-req', { text: f.minItems ? ' (min ' + f.minItems + ')' : '*' }) : null), h('span.fe-help', { text: (obj[f.key] || []).length + ' item(s)' }));
                break;
            case 'regions': case 'points':
                ctl = this.canvasList(f, obj, path, rootObj);
                labelEl = h('div.fe-label', h('span', label), h('span.fe-help', { text: (obj[f.key] || []).length + ' item(s)' }));
                break;
            case 'rect':
                ctl = this.rectEditor(f, obj, rootObj, set);
                break;
            case 'background':
                ctl = this.background(f, obj, id, set);
                break;
            default:
                ctl = h('input.fe-input', { id: id, type: 'text', value: obj[f.key] == null ? '' : String(obj[f.key]) });
                ctl.addEventListener('input', function () { set(ctl.value); });
        }
        wrap.appendChild(labelEl);
        wrap.appendChild(ctl);
        if (f.help) wrap.appendChild(h('div.fe-help', { text: f.help }));
        return wrap;
    };

    F.optionsFor = function (f, rootObj) {
        var course = this.opts.course;
        var opts;
        if (f.type === 'screen') {
            opts = [{ value: '', label: '— Next screen —' }].concat(((course && course.screens) || []).map(function (s, i) { return { value: s.id, label: (i + 1) + '. ' + (s.title || s.id) }; }));
        } else if (f.optionsFrom) opts = f.optionsFrom(rootObj, course) || [];
        else opts = f.options || [];
        return opts.map(function (o) { return typeof o === 'object' ? o : { value: o, label: String(o) }; });
    };

    F.select = function (f, obj, id, rootObj, set) {
        var opts = this.optionsFor(f, rootObj);
        var sel = h('select.fe-input', { id: id });
        var cur = obj[f.key];
        var found = false;
        if (!f.required || cur === undefined || cur === '') {
            if (!opts.some(function (o) { return o.value === '' || o.value === undefined; })) sel.appendChild(h('option', { value: '-1', text: f.type === 'select' && !f.required && f.default === undefined ? '—' : 'Choose…' }));
        }
        opts.forEach(function (o, i) {
            var on = o.value === cur || (cur !== undefined && cur !== null && String(o.value) === String(cur));
            if (on) found = true;
            sel.appendChild(h('option', { value: String(i), text: o.label, selected: on }));
        });
        if (!found && cur !== undefined && cur !== '' && cur !== null) sel.appendChild(h('option', { value: 'keep', text: String(cur) + ' (missing)', selected: true }));
        sel.addEventListener('change', function () {
            if (sel.value === 'keep') return;
            var i = Number(sel.value);
            set(i < 0 ? undefined : opts[i].value, true);
        });
        return sel;
    };

    F.media = function (f, obj, id, set) {
        var self = this;
        var v = obj[f.key] || '';
        var kind = f.type === 'lottie' ? 'lottie' : f.type === 'url' ? 'captions' : (kindOf(v) || (f.type === 'image' ? 'image' : 'video'));
        var thumb = h('div.fe-thumb');
        if (v && (kind === 'image')) thumb.appendChild(h('img', { src: v, alt: '' }));
        else if (v && kind === 'video' && !/youtu|vimeo/i.test(v)) thumb.appendChild(h('video', { src: v, muted: true, preload: 'metadata' }));
        else thumb.innerHTML = f.type === 'lottie' ? I.lottie : f.type === 'url' ? I.content : (v ? I.video : I.plus);
        var isData = /^data:/.test(v);
        var input = h('input.fe-input', { id: id, type: 'text', value: isData ? '' : v, placeholder: isData ? 'Uploaded file · ' + Math.round(v.length * 0.75 / 1024) + ' KB (embedded)' : (f.type === 'media' ? 'Path, URL, or YouTube/Vimeo link' : 'Path or URL') });
        input.addEventListener('change', function () { set(input.value.trim() || undefined, true); });
        var accept = f.accept || (f.type === 'image' ? 'image/*' : f.type === 'lottie' ? '.json,application/json' : f.type === 'url' ? '.vtt,text/vtt' : 'image/*,video/*,audio/*');
        var file = h('input', { type: 'file', accept: accept, 'aria-label': 'Upload file' });
        file.addEventListener('change', function () {
            var fl = file.files && file.files[0];
            if (!fl) return;
            if (fl.size > 12 * 1024 * 1024) { ELSForm.notify('That file is ' + Math.round(fl.size / 1048576) + ' MB — too large to embed. Put it in the project media/ folder and enter its path instead.', 'error'); return; }
            if (fl.size > 2 * 1024 * 1024) ELSForm.notify('Large file embedded (' + Math.round(fl.size / 1048576) + ' MB). Consider referencing a file in media/ to keep the course light.');
            readFileAsDataUri(fl, function (uri) {
                if (f.type === 'lottie') {
                    try { ELS.decodeJsonSource(uri); } catch (e) { ELSForm.notify('That file is not valid JSON.', 'error'); return; }
                }
                set(uri, true);
            });
        });
        var up = h('label.a-btn.is-sm.fe-file', { html: I.plus + '<span>Upload</span>' }, file);
        var libKind = f.type === 'image' ? ['image'] : f.type === 'lottie' ? ['lottie'] : f.type === 'url' ? ['captions'] : ['image', 'video'];
        var lib = h('select.fe-input', { 'aria-label': 'Project assets', style: { height: '28px', fontSize: '12.5px', flex: '1', minWidth: '0' } });
        lib.appendChild(h('option', { value: '', text: 'Project assets…' }));
        ASSET_LIBRARY.filter(function (a) { return libKind.indexOf(a.kind) >= 0; }).forEach(function (a) { lib.appendChild(h('option', { value: a.path, text: a.label })); });
        lib.addEventListener('change', function () { if (lib.value) set(lib.value, true); });
        var clear = h('button.a-btn.is-sm', { type: 'button', title: 'Remove', html: I.cross, disabled: !v, onclick: function () { set(undefined, true); } });
        return h('div.fe-media', thumb, h('div.fe-media-ctl', input, h('div.fe-media-btns', up, lib, clear)));
    };

    F.rte = function (f, obj, id, set) {
        var area = h('div.fe-rte-area', { id: id, contenteditable: 'true', dir: 'auto', role: 'textbox', 'aria-multiline': 'true', 'data-placeholder': f.placeholder || 'Type here…' });
        area.innerHTML = obj[f.key] || '';
        var src = h('textarea.fe-rte-src', { hidden: true, spellcheck: 'false', 'aria-label': 'HTML source' });
        var sourceMode = false;
        function value() {
            var html = area.innerHTML.replace(/<br>$/, '').trim();
            if (!util.stripHtml(html) && !/<(img|video|iframe|svg|span[^>]+data-exploration-ref)/i.test(html)) return '';
            return html;
        }
        area.addEventListener('input', function () { set(value()); });
        area.addEventListener('focus', function () { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { } });
        area.addEventListener('paste', function (e) {
            var text = (e.clipboardData || window.clipboardData).getData('text/plain');
            if (text) { e.preventDefault(); document.execCommand('insertText', false, text); }
        });
        src.addEventListener('input', function () { set(src.value); });
        function cmd(c, arg) { return function (e) { e.preventDefault(); area.focus(); document.execCommand(c, false, arg); set(value()); }; }
        var bar = h('div.fe-rte-bar', { role: 'toolbar', 'aria-label': 'Formatting' },
            h('button', { type: 'button', title: 'Bold', html: '<b>B</b>', onmousedown: cmd('bold') }),
            h('button', { type: 'button', title: 'Italic', html: '<i>I</i>', onmousedown: cmd('italic') }),
            h('button', { type: 'button', title: 'Underline', html: '<u>U</u>', onmousedown: cmd('underline') }),
            h('span.sep'),
            h('button', { type: 'button', title: 'Heading', text: 'H', onmousedown: cmd('formatBlock', 'h3') }),
            h('button', { type: 'button', title: 'Paragraph', text: '¶', onmousedown: cmd('formatBlock', 'p') }),
            h('button', { type: 'button', title: 'Bulleted list', text: '•', onmousedown: cmd('insertUnorderedList') }),
            h('button', { type: 'button', title: 'Numbered list', text: '1.', onmousedown: cmd('insertOrderedList') }),
            h('span.sep'),
            h('button', { type: 'button', title: 'Link', text: '🔗', onmousedown: function (e) {
                e.preventDefault();
                var url = window.prompt('Link URL (https://…)');
                if (url && /^(https?:|mailto:|#)/i.test(url)) { area.focus(); document.execCommand('createLink', false, url); set(value()); }
            } }),
            h('button', { type: 'button', title: 'Clear formatting', text: 'Tx', onmousedown: cmd('removeFormat') }));
        var keys = ((this.opts.course && this.opts.course.screens) || []).filter(function (s) { return s.type === 'exploration' && s.store_key; }).map(function (s) { return s.store_key; });
        if (keys.length) {
            var vsel = h('select', { title: 'Insert learner answer from an exploration screen', style: { height: '26px', border: '0', background: 'none', fontSize: '12px', color: '#61707d' } },
                h('option', { value: '', text: '{x} Insert answer…' }), keys.map(function (k) { return h('option', { value: k, text: k }); }));
            vsel.addEventListener('change', function () {
                if (!vsel.value) return;
                area.focus();
                document.execCommand('insertHTML', false, '<span data-exploration-ref="' + util.esc(vsel.value) + '"></span>&nbsp;');
                vsel.value = '';
                set(value());
            });
            bar.appendChild(vsel);
        }
        var toggle = h('button', { type: 'button', title: 'Edit HTML source', text: '</>', 'aria-pressed': 'false', onclick: function () {
            sourceMode = !sourceMode;
            toggle.setAttribute('aria-pressed', sourceMode);
            if (sourceMode) { src.value = obj[f.key] || ''; src.hidden = false; area.hidden = true; src.focus(); }
            else { area.innerHTML = obj[f.key] || ''; src.hidden = true; area.hidden = false; }
        } });
        bar.appendChild(h('span.sep'));
        bar.appendChild(toggle);
        return h('div.fe-rte', bar, area, src);
    };

    F.screens = function (f, obj, set) {
        var course = this.opts.course || { screens: [] };
        var cur = obj[f.key] || [];
        var box = h('div.fe-checks');
        var list = course.screens.filter(function (s) { return !f.scoredOnly || ELS.registry.isScored(s); });
        if (!list.length) box.appendChild(h('span.fe-help', { text: f.scoredOnly ? 'No scored screens in this course yet.' : 'No screens.' }));
        list.forEach(function (s) {
            var cb = h('input', { type: 'checkbox', checked: cur.indexOf(s.id) >= 0 });
            cb.addEventListener('change', function () {
                var next = (obj[f.key] || []).filter(function (x) { return x !== s.id; });
                if (cb.checked) next.push(s.id);
                set(next);
            });
            box.appendChild(h('label', cb, h('span', { text: (course.screens.indexOf(s) + 1) + '. ' + (s.title || s.id) })));
        });
        return box;
    };

    F.background = function (f, obj, id, set) {
        var self = this;
        var bg = obj[f.key] && typeof obj[f.key] === 'object' ? obj[f.key] : (obj[f.key] ? { color: obj[f.key] } : {});
        function put(k, v) {
            // Build from the current value: non-structural edits don't re-render this closure.
            var cur = obj[f.key] && typeof obj[f.key] === 'object' ? obj[f.key] : (obj[f.key] ? { color: obj[f.key] } : {});
            var next = Object.assign({}, cur);
            if (v === undefined || v === '' || v === false) delete next[k]; else next[k] = v;
            set(Object.keys(next).length ? next : undefined, k !== 'color');
        }
        var picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(bg.color || '') ? bg.color : '#ffffff', 'aria-label': 'Background colour' });
        var useColor = h('input', { type: 'checkbox', checked: !!bg.color });
        picker.addEventListener('input', function () { useColor.checked = true; put('color', picker.value); });
        useColor.addEventListener('change', function () { put('color', useColor.checked ? picker.value : undefined); });
        var imgObj = { image: bg.image };
        var img = this.media({ key: 'image', type: 'image' }, imgObj, id + '_img', function (v) { put('image', v); });
        var dark = h('input', { type: 'checkbox', checked: !!bg.dark });
        dark.addEventListener('change', function () { put('dark', dark.checked); });
        return h('div', h('div.fe-row', h('label.fe-switch', useColor, h('span', { text: 'Colour' })), picker),
            h('div', { style: { marginTop: '8px' } }, img),
            h('label.fe-switch', { style: { marginTop: '8px' } }, dark, h('span', { text: 'Dark background (light text, dims image)' })));
    };

    /* ---------------- Lists ---------------- */
    F.list = function (f, obj, path, rootObj) {
        var self = this;
        if (!Array.isArray(obj[f.key])) obj[f.key] = [];
        var arr = obj[f.key];
        var box = h('div.fe-list');
        arr.forEach(function (item, i) {
            var ipath = path + '[' + i + ']';
            var openKey = ipath;
            if (self.open[openKey] === undefined) self.open[openKey] = arr.length <= 3;
            var sum = summary(item, i);
            var head = h('div.fe-item-head',
                h('button.fe-item-toggle', { type: 'button', 'aria-expanded': String(!!self.open[openKey]), onclick: function () { self.open[openKey] = !self.open[openKey]; self.render(); } },
                    h('span.fe-item-num', { text: String(i + 1) }),
                    h('span.fe-item-sum' + (sum ? '' : '.is-empty'), { text: sum || (f.itemLabel || 'Item') + ' ' + (i + 1) }),
                    item && item.correct === true ? h('span.fe-badge-ok', { text: '✓ correct' }) : null,
                    h('span.fe-item-chev', { html: I.chevronD })),
                h('button.a-ibtn', { type: 'button', title: 'Move up', 'aria-label': 'Move up', html: I.up, disabled: i === 0, onclick: function () { self.move(arr, i, i - 1, path); } }),
                h('button.a-ibtn', { type: 'button', title: 'Move down', 'aria-label': 'Move down', html: I.down, disabled: i === arr.length - 1, onclick: function () { self.move(arr, i, i + 1, path); } }),
                h('button.a-ibtn', { type: 'button', title: 'Duplicate', 'aria-label': 'Duplicate', html: I.plus, onclick: function () {
                    var copy = util.clone(item);
                    (f.fields || []).forEach(function (sf) { if (sf.type === 'id') copy[sf.key] = shortId(); });
                    if (copy && copy.id && (f.fields || []).some(function (sf) { return sf.key === 'id' && sf.type === 'text'; })) copy.id = copy.id + '-copy';
                    arr.splice(i + 1, 0, copy); self.open[path + '[' + (i + 1) + ']'] = true; self.changed(true);
                } }),
                h('button.a-ibtn.is-danger', { type: 'button', title: 'Delete', 'aria-label': 'Delete', html: I.cross, onclick: function () {
                    arr.splice(i, 1); self.shiftOpen(path, i, -1); self.changed(true);
                } }));
            var body = h('div.fe-item-body');
            if (self.open[openKey]) body.appendChild(self.fieldset(f.fields || [], item, ipath, rootObj));
            box.appendChild(h('div.fe-item' + (self.open[openKey] ? '.is-open' : ''), { 'data-item-path': ipath }, head, body));
        });
        var add = h('button.a-btn.is-sm.fe-add', { type: 'button', html: I.plus + '<span>Add ' + util.esc((f.itemLabel || 'item').toLowerCase()) + '</span>', disabled: f.maxItems && arr.length >= f.maxItems, onclick: function () {
            arr.push(newItem(f.fields || [], arr));
            self.open[path + '[' + (arr.length - 1) + ']'] = true;
            self.changed(true);
        } });
        box.appendChild(add);
        return box;
    };

    F.move = function (arr, from, to, path) {
        if (to < 0 || to >= arr.length) return;
        var it = arr.splice(from, 1)[0];
        arr.splice(to, 0, it);
        var a = this.open[path + '[' + from + ']'], b = this.open[path + '[' + to + ']'];
        this.open[path + '[' + to + ']'] = a; this.open[path + '[' + from + ']'] = b;
        this.changed(true);
    };
    F.shiftOpen = function (path, at) {
        var self = this, keys = Object.keys(this.open).filter(function (k) { return k.indexOf(path + '[') === 0; });
        var vals = {};
        keys.forEach(function (k) { var m = /^\[(\d+)\]/.exec(k.slice(path.length)); if (m && k === path + m[0]) vals[Number(m[1])] = self.open[k]; delete self.open[k]; });
        Object.keys(vals).forEach(function (n) { n = Number(n); if (n < at) self.open[path + '[' + n + ']'] = vals[n]; else if (n > at) self.open[path + '[' + (n - 1) + ']'] = vals[n]; });
    };

    /* ---------------- Visual editors ---------------- */
    function pct(e, layer) {
        var r = layer.getBoundingClientRect();
        return { x: util.clamp((e.clientX - r.left) / r.width * 100, 0, 100), y: util.clamp((e.clientY - r.top) / r.height * 100, 0, 100), ar: r.height / r.width };
    }
    function round(v) { return Math.round(v * 2) / 2; }

    F.canvasList = function (f, obj, path, rootObj) {
        var self = this;
        if (!Array.isArray(obj[f.key])) obj[f.key] = [];
        var arr = obj[f.key];
        var points = f.type === 'points';
        var img = rootObj[f.imageKey];
        var wrap = h('div');
        if (img) {
            var layer = h('div.fe-canvas-layer');
            var canvas = h('div.fe-canvas', h('img', { src: img, alt: '' }), layer);
            var activeKey = path;
            arr.forEach(function (it, i) {
                var el;
                if (points) {
                    el = h('div.fe-pt', { text: String(i + 1), style: { left: it.x + '%', top: it.y + '%' }, title: it.text || '' });
                } else {
                    var circle = it.shape === 'circle';
                    el = h('div.fe-rg' + (circle ? '.is-circle' : '') + (it.correct ? '.is-correct' : ''), { text: String(i + 1), title: it.label || '',
                        style: circle ? { left: it.x + '%', top: it.y + '%', width: (2 * (it.r || 5)) + '%', aspectRatio: '1 / 1' } : { left: it.x + '%', top: it.y + '%', width: it.w + '%', height: it.h + '%' } });
                    el.appendChild(h('span.fe-rg-handle'));
                }
                if (self.active[activeKey] === i) el.classList.add('is-active');
                el.setAttribute('data-i', i);
                layer.appendChild(el);
            });
            var drag = null, draft = null;
            layer.addEventListener('pointerdown', function (e) {
                if (e.button !== 0) return;
                var p = pct(e, layer);
                var t = e.target.closest('[data-i]');
                layer.setPointerCapture(e.pointerId);
                if (t) {
                    var i = Number(t.getAttribute('data-i'));
                    var it = arr[i];
                    drag = { mode: e.target.classList.contains('fe-rg-handle') ? 'resize' : 'move', i: i, el: t, start: p, orig: util.clone(it) };
                    self.active[activeKey] = i;
                    self.open[path + '[' + i + ']'] = true;
                    Array.prototype.forEach.call(layer.children, function (c) { c.classList.toggle('is-active', c === t); });
                } else {
                    if (points) {
                        var np = newItem(f.fields || [], arr);
                        np.x = round(p.x); np.y = round(p.y); np.text = np.text || 'Label ' + (arr.length + 1);
                        arr.push(np); self.active[activeKey] = arr.length - 1; self.open[path + '[' + (arr.length - 1) + ']'] = true;
                        self.changed(true);
                        return;
                    }
                    drag = { mode: 'draw', start: p };
                    draft = h('div.fe-draft', { style: { left: p.x + '%', top: p.y + '%', width: '0', height: '0' } });
                    layer.appendChild(draft);
                }
                e.preventDefault();
            });
            layer.addEventListener('pointermove', function (e) {
                if (!drag) return;
                var p = pct(e, layer), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
                if (drag.mode === 'draw') {
                    var x = Math.min(p.x, drag.start.x), y = Math.min(p.y, drag.start.y);
                    draft.style.left = x + '%'; draft.style.top = y + '%';
                    draft.style.width = Math.abs(dx) + '%'; draft.style.height = Math.abs(dy) + '%';
                    return;
                }
                var it = arr[drag.i], o = drag.orig;
                if (drag.mode === 'move') {
                    it.x = round(util.clamp(o.x + dx, 0, 100)); it.y = round(util.clamp(o.y + dy, 0, 100));
                } else if (it.shape === 'circle') {
                    it.r = round(util.clamp(Math.max(Math.abs(p.x - it.x), Math.abs(p.y - it.y) * p.ar), 1, 50));
                } else {
                    it.w = round(util.clamp(o.w + dx, 1, 100 - it.x)); it.h = round(util.clamp(o.h + dy, 1, 100 - it.y));
                }
                var el = drag.el;
                el.style.left = it.x + '%'; el.style.top = it.y + '%';
                if (!points) { if (it.shape === 'circle') el.style.width = (2 * it.r) + '%'; else { el.style.width = it.w + '%'; el.style.height = it.h + '%'; } }
            });
            var end = function (e) {
                if (!drag) return;
                var d = drag; drag = null;
                if (d.mode === 'draw') {
                    var p = pct(e, layer);
                    if (draft && draft.parentNode) draft.parentNode.removeChild(draft);
                    var w = Math.abs(p.x - d.start.x), hh = Math.abs(p.y - d.start.y);
                    if (w >= 2 && hh >= 2) {
                        var rg = newItem(f.fields || [], arr);
                        rg.shape = 'rect'; rg.x = round(Math.min(p.x, d.start.x)); rg.y = round(Math.min(p.y, d.start.y)); rg.w = round(w); rg.h = round(hh);
                        rg.label = rg.label || 'Region ' + (arr.length + 1);
                        arr.push(rg); self.active[activeKey] = arr.length - 1; self.open[path + '[' + (arr.length - 1) + ']'] = true;
                        self.changed(true);
                    }
                    return;
                }
                self.changed(true);
            };
            layer.addEventListener('pointerup', end);
            layer.addEventListener('pointercancel', end);
            wrap.appendChild(canvas);
            wrap.appendChild(h('div.fe-canvas-hint', { text: points ? 'Click the image to add a label; drag a marker to move it.' : 'Drag on the image to draw a region; drag a region to move it, or its corner to resize.' }));
        } else wrap.appendChild(h('div.fe-help', { text: 'Choose an image above to place items visually.' }));
        var prevNum = this.opts.numbersStructural;
        this.opts.numbersStructural = true;
        wrap.appendChild(this.list(f, obj, path, rootObj));
        this.opts.numbersStructural = prevNum;
        return wrap;
    };

    F.rectEditor = function (f, obj, rootObj, set) {
        var self = this;
        var img = obj[f.imageKey] || rootObj[f.rootImageKey || f.imageKey];
        var r = obj[f.key] || null;
        var wrap = h('div');
        if (!img) { wrap.appendChild(h('div.fe-help', { text: 'Choose a screen image to draw the target area.' })); return wrap; }
        var layer = h('div.fe-canvas-layer');
        var canvas = h('div.fe-canvas', h('img', { src: img, alt: '' }), layer);
        var box = null;
        if (r) { box = h('div.fe-rg.is-correct.is-active', { style: { left: r.x + '%', top: r.y + '%', width: r.w + '%', height: r.h + '%' } }, h('span.fe-rg-handle')); layer.appendChild(box); }
        var drag = null, draft = null;
        layer.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            layer.setPointerCapture(e.pointerId);
            var p = pct(e, layer);
            if (box && box.contains(e.target)) drag = { mode: e.target.classList.contains('fe-rg-handle') ? 'resize' : 'move', start: p, orig: util.clone(r) };
            else { drag = { mode: 'draw', start: p }; draft = h('div.fe-draft', { style: { left: p.x + '%', top: p.y + '%' } }); layer.appendChild(draft); }
            e.preventDefault();
        });
        layer.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var p = pct(e, layer), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
            if (drag.mode === 'draw') {
                draft.style.left = Math.min(p.x, drag.start.x) + '%'; draft.style.top = Math.min(p.y, drag.start.y) + '%';
                draft.style.width = Math.abs(dx) + '%'; draft.style.height = Math.abs(dy) + '%';
                return;
            }
            var o = drag.orig;
            if (drag.mode === 'move') { r.x = round(util.clamp(o.x + dx, 0, 100 - o.w)); r.y = round(util.clamp(o.y + dy, 0, 100 - o.h)); }
            else { r.w = round(util.clamp(o.w + dx, 1, 100 - r.x)); r.h = round(util.clamp(o.h + dy, 1, 100 - r.y)); }
            box.style.left = r.x + '%'; box.style.top = r.y + '%'; box.style.width = r.w + '%'; box.style.height = r.h + '%';
        });
        var end = function (e) {
            if (!drag) return;
            var d = drag; drag = null;
            if (d.mode === 'draw') {
                var p = pct(e, layer);
                if (draft && draft.parentNode) draft.parentNode.removeChild(draft);
                var w = Math.abs(p.x - d.start.x), hh = Math.abs(p.y - d.start.y);
                if (w >= 1.5 && hh >= 1.5) set({ x: round(Math.min(p.x, d.start.x)), y: round(Math.min(p.y, d.start.y)), w: round(w), h: round(hh) }, true);
                return;
            }
            set(r, true);
        };
        layer.addEventListener('pointerup', end);
        layer.addEventListener('pointercancel', end);
        wrap.appendChild(canvas);
        wrap.appendChild(h('div.fe-canvas-hint', { text: r ? 'Target: x ' + r.x + '%, y ' + r.y + '%, ' + r.w + '×' + r.h + '% — drag to move or redraw.' : 'Drag on the image to mark where the learner must click.' }));
        return wrap;
    };

    /* ---------------- Issues ---------------- */
    F.paintIssues = function (issues) {
        this.issues = issues || [];
        var host = this.host;
        Array.prototype.forEach.call(host.querySelectorAll('.fe-error'), function (e) { e.parentNode.removeChild(e); });
        Array.prototype.forEach.call(host.querySelectorAll('.has-error'), function (e) { e.classList.remove('has-error'); });
        this.issues.forEach(function (is) {
            if (is.level === 'warning') return;
            var p = is.path, target = null;
            while (p && !target) {
                target = host.querySelector('[data-path="' + p.replace(/"/g, '\\"') + '"]') || host.querySelector('[data-item-path="' + p.replace(/"/g, '\\"') + '"]');
                if (!target) p = p.replace(/(\.[^.\[\]]+|\[\d+\])$/, '') === p ? '' : p.replace(/(\.[^.\[\]]+|\[\d+\])$/, '');
            }
            if (!target) return;
            target.classList.add('has-error');
            if (target.classList.contains('fe-field')) target.appendChild(h('div.fe-error', { text: is.message }));
            var item = target.closest('.fe-item');
            while (item) { item.classList.add('has-error'); item = item.parentElement && item.parentElement.closest('.fe-item'); }
        });
    };

    var ELSForm = root.ELSForm = Form;
    ELSForm.notify = function (msg, kind) { if (root.ELSStudio && root.ELSStudio.toast) root.ELSStudio.toast(msg, kind); else alert(msg); };
    ELSForm.summary = summary;
    ELSForm.kindOf = kindOf;
})(window);
