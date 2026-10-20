/**
 * Assessment screens: mcq, true_false, fill_blank, drag_drop, matching, sorting.
 * All use ELS.question() for attempts, feedback, scoring and resume.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    function setDisabled(container, sel, v) {
        Array.prototype.forEach.call(container.querySelectorAll(sel), function (b) { b.disabled = v; });
    }

    /* ================================================================== *
     * MCQ
     * ================================================================== */
    R.register({
        type: 'mcq', label: 'Multiple choice', category: 'assessment', icon: ELS.icons.mcq, scored: true,
        description: 'Single or multiple answer question with per-option feedback.',
        fields: [
            { key: 'prompt_html', label: 'Question', type: 'html', required: true },
            { key: 'image', label: 'Illustration', type: 'image' },
            { key: 'image_alt', label: 'Illustration alt text', type: 'text', showIf: function (c) { return !!c.image; } },
            { key: 'options', label: 'Options', type: 'list', minItems: 2, maxItems: 26, itemLabel: 'Option', fields: [
                { key: 'text', label: 'Option text', type: 'text', required: true },
                { key: 'correct', label: 'Correct', type: 'bool' },
                { key: 'feedback', label: 'Feedback for this option', type: 'text' }
            ] },
            { key: 'multi_select', label: 'Allow multiple answers', type: 'bool', default: false },
            { key: 'shuffle', label: 'Shuffle options', type: 'bool', default: true },
            { key: 'columns', label: 'Option layout', type: 'select', default: 'list', options: [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid (2 columns)' }] }
        ].concat(ELS.assessmentFields(10, { scoring: true })),
        template: {
            title: 'Check your understanding', prompt_html: '<p>Which of these is a renewable energy source?</p>',
            options: [{ text: 'Coal', correct: false, feedback: 'Coal is a fossil fuel.' }, { text: 'Solar power', correct: true }, { text: 'Natural gas', correct: false }, { text: 'Diesel', correct: false }],
            multi_select: false, shuffle: true, points: 10, attempts: 2, scoring: 'all_or_nothing',
            feedback: { correct: '<p>Exactly — sunlight is replenished naturally.</p>', incorrect: '<p>Look for the source that is naturally replenished.</p>' }
        },
        validate: function (c) {
            var out = [], n = (c.options || []).filter(function (o) { return o.correct; }).length;
            if (!n) out.push({ path: 'options', message: 'Mark at least one option as correct.', level: 'error' });
            if (n > 1 && !c.multi_select) out.push({ path: 'multi_select', message: 'More than one correct option: enable "Allow multiple answers".', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, opts = c.options || [];
            var multi = !!c.multi_select;
            var order = opts.map(function (_, i) { return i; });
            if (c.shuffle !== false) order = util.shuffle(order, ctx.rng('opts'));
            var selected = {};
            var top = h('div.els-q-top');
            top.appendChild(ELS.ui.prompt(c.prompt_html));
            if (c.image) top.appendChild(h('figure.els-q-figure', ELS.ui.image(c.image, c.image_alt)));
            ctx.el.appendChild(top);
            if (multi) ctx.el.appendChild(h('p.els-hint', { text: t('selectAll') }));
            var group = h('div.els-options' + (c.columns === 'grid' ? '.is-grid' : ''), { role: multi ? 'group' : 'radiogroup', 'aria-label': util.stripHtml(c.prompt_html).slice(0, 120) });
            var btns = [];
            order.forEach(function (oi, pos) {
                var o = opts[oi];
                var b = h('button.els-option', { type: 'button', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false', tabindex: pos === 0 ? '0' : '-1', 'data-i': oi },
                    h('span.els-option-key', { text: String.fromCharCode(65 + pos) }),
                    h('span.els-option-text', { text: o.text }),
                    h('span.els-option-mark', { 'aria-hidden': 'true' }));
                b.addEventListener('click', function () { toggle(oi); });
                btns[oi] = b;
                group.appendChild(b);
            });
            ELS.ui.roving(group, '.els-option');
            ctx.el.appendChild(group);
            ELS.anim.stagger(group);
            function toggle(i) {
                if (q && q.isLocked()) return;
                if (!multi) selected = {};
                selected[i] = !selected[i];
                paint();
            }
            function paint() {
                opts.forEach(function (_, i) {
                    btns[i].setAttribute('aria-checked', selected[i] ? 'true' : 'false');
                    btns[i].classList.toggle('is-selected', !!selected[i]);
                });
            }
            var correctSet = opts.map(function (o, i) { return o.correct ? i : -1; }).filter(function (i) { return i >= 0; });
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () {
                    var r = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number).sort(function (a, b) { return a - b; });
                    return r.length ? r : null;
                },
                evaluate: function (r) {
                    var good = r.filter(function (i) { return opts[i] && opts[i].correct; }).length;
                    var bad = r.length - good;
                    var exact = good === correctSet.length && bad === 0;
                    var ratio = multi ? Math.max(0, (good - bad) / correctSet.length) : (exact ? 1 : 0);
                    if (c.scoring === 'all_or_nothing') ratio = exact ? 1 : 0;
                    var extra = r.map(function (i) { return opts[i] && opts[i].feedback ? '<p class="els-option-fb"><strong>' + util.esc(opts[i].text) + ':</strong> ' + util.esc(opts[i].feedback) + '</p>' : ''; }).join('');
                    return { ratio: ratio, correct: exact, extraHtml: extra };
                },
                showResult: function (r, ev, final) {
                    opts.forEach(function (o, i) {
                        var sel = r.indexOf(i) >= 0;
                        btns[i].classList.toggle('is-correct', sel && !!o.correct);
                        btns[i].classList.toggle('is-wrong', sel && !o.correct);
                        btns[i].classList.toggle('is-missed', !!final && !sel && !!o.correct);
                    });
                },
                applyResponse: function (r) { selected = {}; r.forEach(function (i) { selected[i] = true; }); paint(); },
                setLocked: function (v) { group.classList.toggle('is-locked', v); btns.forEach(function (b) { b.setAttribute('aria-disabled', v ? 'true' : 'false'); }); },
                reset: function () { selected = {}; btns.forEach(function (b) { b.classList.remove('is-correct', 'is-wrong', 'is-missed'); }); paint(); },
                interaction: function (r) { return { type: 'choice', response: r, correct: correctSet, description: util.stripHtml(c.prompt_html) }; }
            });
        }
    });

    /* ================================================================== *
     * TRUE / FALSE
     * ================================================================== */
    R.register({
        type: 'true_false', label: 'True / false', category: 'assessment', icon: ELS.icons.tf, scored: true,
        description: 'A statement the learner judges as true or false.',
        fields: [
            { key: 'prompt_html', label: 'Statement', type: 'html', required: true },
            { key: 'correct', label: 'Correct answer', type: 'select', required: true, default: true, options: [{ value: true, label: 'True' }, { value: false, label: 'False' }] },
            { key: 'true_label', label: 'Label for "True"', type: 'text' },
            { key: 'false_label', label: 'Label for "False"', type: 'text' },
            { key: 'image', label: 'Illustration', type: 'image' },
            { key: 'image_alt', label: 'Illustration alt text', type: 'text', showIf: function (c) { return !!c.image; } }
        ].concat(ELS.assessmentFields(10)),
        template: {
            title: 'True or false?', prompt_html: '<p>Recycling one aluminium can saves enough energy to run a TV for about three hours.</p>', correct: true, points: 10, attempts: 1,
            feedback: { correct: '<p>Yes! Recycling aluminium uses about 95% less energy than making it new.</p>', incorrect: '<p>It is true — recycled aluminium needs a fraction of the energy.</p>' }
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, choice = null;
            var top = h('div.els-q-top', ELS.ui.prompt(c.prompt_html), c.image ? h('figure.els-q-figure', ELS.ui.image(c.image, c.image_alt)) : null);
            ctx.el.appendChild(top);
            var group = h('div.els-tf', { role: 'radiogroup' });
            var btn = {};
            [true, false].forEach(function (val, k) {
                var b = h('button.els-tf-card', { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: k === 0 ? '0' : '-1' },
                    h('span.els-tf-icon', { html: val ? ELS.icons.check : ELS.icons.cross }),
                    h('span', { text: val ? (c.true_label || t('trueLabel')) : (c.false_label || t('falseLabel')) }));
                b.addEventListener('click', function () { if (q.isLocked()) return; choice = val; paint(); });
                btn[val] = b;
                group.appendChild(b);
            });
            ELS.ui.roving(group, '.els-tf-card');
            ctx.el.appendChild(group);
            function paint() { [true, false].forEach(function (v) { btn[v].setAttribute('aria-checked', choice === v ? 'true' : 'false'); btn[v].classList.toggle('is-selected', choice === v); }); }
            var correct = c.correct === true || c.correct === 'true';
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { return choice; },
                evaluate: function (r) { return { ratio: r === correct ? 1 : 0, correct: r === correct }; },
                showResult: function (r, ev) { btn[r].classList.add(ev.correct ? 'is-correct' : 'is-wrong'); },
                applyResponse: function (r) { choice = r; paint(); },
                setLocked: function (v) { group.classList.toggle('is-locked', v); },
                reset: function () { choice = null; [true, false].forEach(function (v) { btn[v].classList.remove('is-correct', 'is-wrong'); }); paint(); },
                interaction: function (r) { return { type: 'true-false', response: r, correct: correct, description: util.stripHtml(c.prompt_html) }; }
            });
        }
    });

    /* ================================================================== *
     * FILL IN THE BLANK
     * ================================================================== */
    R.register({
        type: 'fill_blank', label: 'Fill in the blanks', category: 'assessment', icon: ELS.icons.blank, scored: true,
        description: 'Text with gaps answered by typing, dropdowns or a word bank.',
        fields: [
            { key: 'prompt_html', label: 'Instructions', type: 'html' },
            { key: 'text_html', label: 'Text with blanks', type: 'html', required: true, help: 'Mark each gap with {{1}}, {{2}}… in order. Without markers the blanks are listed below the instructions.' },
            { key: 'blanks', label: 'Blanks', type: 'list', minItems: 1, itemLabel: 'Blank', fields: [
                { key: 'accepted', label: 'Accepted answers', type: 'strings', required: true, help: 'One per line. The first is shown as the model answer.' },
                { key: 'label', label: 'Label (when no markers are used)', type: 'text' }
            ] },
            { key: 'mode', label: 'Answer mode', type: 'select', default: 'type', options: [
                { value: 'type', label: 'Type the answer' }, { value: 'dropdown', label: 'Choose from a dropdown' }, { value: 'word_bank', label: 'Word bank (tap to place)' }] },
            { key: 'distractors', label: 'Extra wrong words', type: 'strings', showIf: function (c) { return c.mode && c.mode !== 'type'; } },
            { key: 'case_sensitive', label: 'Case sensitive', type: 'bool', default: false }
        ].concat(ELS.assessmentFields(10, { scoring: true })),
        template: {
            title: 'Complete the sentence', prompt_html: '<p>Fill in the missing words.</p>',
            text_html: '<p>Plants absorb {{1}} from the air and release {{2}} through photosynthesis.</p>',
            blanks: [{ accepted: ['carbon dioxide', 'CO2'] }, { accepted: ['oxygen', 'O2'] }],
            mode: 'type', distractors: ['nitrogen', 'methane'], case_sensitive: false, points: 10, attempts: 2, scoring: 'partial',
            feedback: { correct: '<p>Well done!</p>', incorrect: '<p>Photosynthesis takes in CO₂ and gives off O₂.</p>' }
        },
        validate: function (c) {
            var out = [], n = (c.blanks || []).length;
            var markers = (String(c.text_html || '').match(/\{\{\s*\d+\s*\}\}/g) || []).length;
            if (markers && markers !== n) out.push({ path: 'text_html', message: 'Found ' + markers + ' {{n}} marker(s) but ' + n + ' blank(s).', level: 'error' });
            (c.blanks || []).forEach(function (b, i) { if (!util.list(b.accepted).length) out.push({ path: 'blanks[' + i + '].accepted', message: 'Blank ' + (i + 1) + ' needs at least one accepted answer.', level: 'error' }); });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, blanks = c.blanks || [], mode = c.mode || 'type';
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var inputs = [];
            var words = [];
            if (mode !== 'type') {
                blanks.forEach(function (b) { var a = util.list(b.accepted)[0]; if (a) words.push(a); });
                util.list(c.distractors).forEach(function (d) { words.push(d); });
                words = util.shuffle(words, ctx.rng('words'));
            }
            function makeInput(i) {
                var label = (blanks[i] && blanks[i].label) || t('step', { n: i + 1 });
                var el;
                if (mode === 'dropdown') {
                    el = h('select.els-blank.els-select', { 'aria-label': label });
                    el.appendChild(h('option', { value: '', text: t('selectOption') }));
                    words.forEach(function (w) { el.appendChild(h('option', { value: w, text: w })); });
                } else if (mode === 'word_bank') {
                    el = h('button.els-blank.is-slot', { type: 'button', 'aria-label': label, 'data-value': '' });
                    el.textContent = ' ';
                    el.addEventListener('click', function () {
                        if (q.isLocked()) return;
                        if (el.getAttribute('data-value')) { setSlot(el, ''); } else { active = i; paintSlots(); }
                    });
                } else {
                    el = h('input.els-blank', { type: 'text', 'aria-label': label, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
                    el.addEventListener('input', function () { el.style.width = Math.max(6, el.value.length + 2) + 'ch'; });
                    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); q.check(); } });
                }
                inputs[i] = el;
                return el;
            }
            var text = h('div.els-blank-text.els-prose');
            var html = String(c.text_html || '');
            if (/\{\{\s*\d+\s*\}\}/.test(html)) {
                text.innerHTML = html.replace(/\{\{\s*(\d+)\s*\}\}/g, function (_, n) { return '<span class="els-blank-slot" data-n="' + (Number(n) - 1) + '"></span>'; });
                Array.prototype.forEach.call(text.querySelectorAll('.els-blank-slot'), function (slot) {
                    var i = Number(slot.getAttribute('data-n'));
                    if (i >= 0 && i < blanks.length && !inputs[i]) slot.appendChild(makeInput(i));
                });
            } else {
                text.innerHTML = html;
                var ol = h('ol.els-blank-list');
                blanks.forEach(function (b, i) { ol.appendChild(h('li', b.label ? h('span', { text: b.label + ' ' }) : null, makeInput(i))); });
                text.appendChild(ol);
            }
            ctx.el.appendChild(text);
            // Word bank
            var active = 0, bank = null;
            function setSlot(el, val) { el.setAttribute('data-value', val); el.textContent = val || ' '; el.classList.toggle('is-filled', !!val); paintBank(); }
            function paintSlots() { inputs.forEach(function (x, k) { x.classList.toggle('is-active', k === active && !x.getAttribute('data-value')); }); }
            function used() { var u = {}; inputs.forEach(function (x) { var v = x.getAttribute('data-value'); if (v) u[v] = (u[v] || 0) + 1; }); return u; }
            function paintBank() {
                if (!bank) return;
                var u = used(), seen = {};
                Array.prototype.forEach.call(bank.children, function (chip) {
                    var w = chip.getAttribute('data-w'); seen[w] = (seen[w] || 0) + 1;
                    chip.disabled = seen[w] <= (u[w] || 0);
                });
                paintSlots();
            }
            if (mode === 'word_bank') {
                bank = h('div.els-word-bank', { role: 'group', 'aria-label': t('itemBank') });
                words.forEach(function (w) {
                    bank.appendChild(h('button.els-chip-btn', { type: 'button', 'data-w': w, text: w, onclick: function () {
                        if (q.isLocked()) return;
                        var target = inputs[active] && !inputs[active].getAttribute('data-value') ? active : inputs.findIndex(function (x) { return !x.getAttribute('data-value'); });
                        if (target < 0) return;
                        setSlot(inputs[target], w);
                        var nextEmpty = inputs.findIndex(function (x) { return !x.getAttribute('data-value'); });
                        active = nextEmpty < 0 ? 0 : nextEmpty;
                        paintSlots();
                    } }));
                });
                ctx.el.appendChild(bank);
                paintSlots();
            }
            function val(el) { return mode === 'word_bank' ? el.getAttribute('data-value') || '' : el.value; }
            function setVal(el, v) { if (mode === 'word_bank') setSlot(el, v || ''); else { el.value = v || ''; if (el.tagName === 'INPUT') el.style.width = Math.max(6, el.value.length + 2) + 'ch'; } }
            function isRight(i, v) {
                var acc = util.list(blanks[i].accepted);
                return acc.some(function (a) { return util.normalizeAnswer(a, c.case_sensitive) === util.normalizeAnswer(v, c.case_sensitive); });
            }
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () {
                    var r = inputs.map(val);
                    return r.every(function (x) { return String(x).trim() === ''; }) ? null : r;
                },
                evaluate: function (r) {
                    var good = r.filter(function (v, i) { return isRight(i, v); }).length;
                    return { ratio: ELS.ratio(c, good, blanks.length), correct: good === blanks.length };
                },
                showResult: function (r, ev, final) {
                    inputs.forEach(function (el, i) {
                        var ok = isRight(i, r[i]);
                        el.classList.toggle('is-correct', ok); el.classList.toggle('is-wrong', !ok);
                        var old = el.parentNode.querySelector('.els-model-answer'); if (old) old.parentNode.removeChild(old);
                        if (!ok && final) el.insertAdjacentElement('afterend', h('span.els-model-answer', { text: util.list(blanks[i].accepted)[0] }));
                    });
                },
                applyResponse: function (r) { inputs.forEach(function (el, i) { setVal(el, r[i]); }); },
                setLocked: function (v) {
                    inputs.forEach(function (el) { if (el.tagName === 'BUTTON') el.setAttribute('aria-disabled', v); else el.disabled = v; });
                    if (bank) bank.classList.toggle('is-locked', v);
                },
                reset: function () {
                    inputs.forEach(function (el, i) {
                        el.classList.remove('is-correct', 'is-wrong');
                        // keep correct answers, clear wrong ones
                        if (!isRight(i, val(el))) setVal(el, '');
                    });
                    active = Math.max(0, inputs.findIndex(function (x) { return !val(x); }));
                    paintBank();
                },
                interaction: function (r) { return { type: 'fill-in', response: r, correct: blanks.map(function (b) { return util.list(b.accepted)[0]; }), description: util.stripHtml(c.text_html) }; }
            });
        }
    });

    /* ================================================================== *
     * DRAG & DROP (categorise items into targets)
     * ================================================================== */
    R.register({
        type: 'drag_drop', label: 'Drag and drop', category: 'assessment', icon: ELS.icons.dragdrop, scored: true,
        description: 'Sort items into the correct categories by dragging (or tapping) them.',
        fields: [
            { key: 'prompt_html', label: 'Instructions', type: 'html', required: true },
            { key: 'targets', label: 'Drop zones', type: 'list', minItems: 1, maxItems: 8, itemLabel: 'Zone', fields: [
                { key: 'id', type: 'id' },
                { key: 'label', label: 'Zone label', type: 'text', required: true },
                { key: 'image', label: 'Zone image', type: 'image' }
            ] },
            { key: 'items', label: 'Draggable items', type: 'list', minItems: 2, itemLabel: 'Item', fields: [
                { key: 'text', label: 'Item text', type: 'text', required: true },
                { key: 'image', label: 'Item image', type: 'image' },
                { key: 'target', label: 'Correct zone', type: 'select', required: true, optionsFrom: function (root) {
                    return (root.targets || []).map(function (z) { return { value: z.id, label: z.label || z.id }; });
                } }
            ] }
        ].concat(ELS.assessmentFields(10, { scoring: true })),
        template: {
            title: 'Sort the waste', prompt_html: '<p>Drag each item into the right bin. You can also tap an item and then tap a bin.</p>',
            targets: [{ id: 'recycle', label: 'Recycling' }, { id: 'compost', label: 'Compost' }, { id: 'landfill', label: 'General waste' }],
            items: [{ text: 'Glass bottle', target: 'recycle' }, { text: 'Banana peel', target: 'compost' }, { text: 'Newspaper', target: 'recycle' }, { text: 'Coffee grounds', target: 'compost' }, { text: 'Chip packet', target: 'landfill' }],
            points: 10, attempts: 2, scoring: 'partial', feedback: { correct: '<p>Perfectly sorted!</p>', incorrect: '<p>Some items are in the wrong bin — they are highlighted.</p>' }
        },
        validate: function (c) {
            var ids = (c.targets || []).map(function (z) { return z.id; }), out = [];
            (c.items || []).forEach(function (it, i) { if (it.target && ids.indexOf(it.target) < 0) out.push({ path: 'items[' + i + '].target', message: 'Item ' + (i + 1) + ' points to a zone that no longer exists.', level: 'error' }); });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, items = c.items || [], targets = c.targets || [];
            ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            ctx.el.appendChild(h('p.els-hint', { text: t('pickHint') }));
            var place = items.map(function () { return null; }); // item index -> target id
            var picked = null;
            var board = h('div.els-dd');
            var bank = h('div.els-dd-bank', { role: 'group', 'aria-label': t('itemBank'), 'data-zone': '' });
            var zonesWrap = h('div.els-dd-zones');
            var zoneEls = {};
            targets.forEach(function (z) {
                var list = h('div.els-dd-list');
                var zone = h('div.els-dd-zone', { 'data-zone': z.id },
                    h('div.els-dd-zone-head', z.image ? ELS.ui.image(z.image, '') : null, h('span', { text: z.label })), list);
                var btn = h('button.els-dd-zone-btn', { type: 'button', 'aria-label': t('choose') + ': ' + z.label, onclick: function () { if (picked !== null) move(picked, z.id); } });
                zone.appendChild(btn);
                zone.addEventListener('click', function (e) { if (picked !== null && e.target !== btn && !(e.target.closest && e.target.closest('.els-dd-item'))) move(picked, z.id); });
                zoneEls[z.id] = { zone: zone, list: list };
                zonesWrap.appendChild(zone);
            });
            var order = util.shuffle(items.map(function (_, i) { return i; }), ctx.rng('dd'));
            var chips = [];
            order.forEach(function (i) {
                var it = items[i];
                var chip = h('button.els-dd-item', { type: 'button', 'aria-pressed': 'false', 'data-i': i }, it.image ? ELS.ui.image(it.image, '') : null, h('span', { text: it.text }));
                chip.addEventListener('click', function () {
                    if (q.isLocked()) return;
                    picked = picked === i ? null : i;
                    paint();
                });
                ELS.drag(chip, {
                    start: function () { if (q.isLocked()) return; picked = i; paint(); },
                    move: function (e, el) {
                        Array.prototype.forEach.call(board.querySelectorAll('.is-over'), function (z) { z.classList.remove('is-over'); });
                        var z = el && el.closest && el.closest('[data-zone]'); if (z) z.classList.add('is-over');
                    },
                    drop: function (e, el) {
                        Array.prototype.forEach.call(board.querySelectorAll('.is-over'), function (z) { z.classList.remove('is-over'); });
                        if (q.isLocked()) return;
                        var z = el && el.closest && el.closest('[data-zone]');
                        if (z) move(i, z.getAttribute('data-zone') || null);
                        picked = null; paint();
                    }
                });
                chips[i] = chip;
                bank.appendChild(chip);
            });
            bank.addEventListener('click', function (e) { if (picked !== null && (e.target === bank)) move(picked, null); });
            board.appendChild(bank);
            board.appendChild(zonesWrap);
            ctx.el.appendChild(board);
            function move(i, zoneId) {
                if (q.isLocked()) return;
                place[i] = zoneId || null;
                picked = null;
                var chip = chips[i];
                (zoneId ? zoneEls[zoneId].list : bank).appendChild(chip);
                ELS.anim.pulse(chip, 'els-pop');
                paint();
                chip.focus();
            }
            function paint() {
                chips.forEach(function (ch, i) { ch.classList.toggle('is-picked', picked === i); ch.setAttribute('aria-pressed', picked === i ? 'true' : 'false'); });
                board.classList.toggle('has-picked', picked !== null);
                bank.classList.toggle('is-empty', place.every(function (p) { return p !== null; }));
            }
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { return place.some(function (p) { return p === null; }) ? null : place.slice(); },
                evaluate: function (r) {
                    var good = r.filter(function (z, i) { return items[i].target === z; }).length;
                    return { ratio: ELS.ratio(c, good, items.length), correct: good === items.length };
                },
                showResult: function (r) { chips.forEach(function (ch, i) { var ok = items[i].target === r[i]; ch.classList.toggle('is-correct', ok); ch.classList.toggle('is-wrong', !ok); }); },
                applyResponse: function (r) { r.forEach(function (z, i) { place[i] = z; (z && zoneEls[z] ? zoneEls[z].list : bank).appendChild(chips[i]); }); paint(); },
                setLocked: function (v) { board.classList.toggle('is-locked', v); chips.forEach(function (ch) { ch.setAttribute('aria-disabled', v ? 'true' : 'false'); }); },
                reset: function () {
                    chips.forEach(function (ch, i) {
                        if (ch.classList.contains('is-wrong')) { place[i] = null; bank.appendChild(ch); }
                        ch.classList.remove('is-correct', 'is-wrong');
                    });
                    paint();
                },
                interaction: function (r) {
                    var tIdx = function (id) { return Math.max(0, targets.map(function (z) { return z.id; }).indexOf(id)); };
                    return { type: 'matching', response: r.map(function (z, i) { return [i, tIdx(z)]; }), correct: items.map(function (it, i) { return [i, tIdx(it.target)]; }), description: util.stripHtml(c.prompt_html) };
                }
            });
        }
    });

    /* ================================================================== *
     * MATCHING
     * ================================================================== */
    R.register({
        type: 'matching', label: 'Matching pairs', category: 'assessment', icon: ELS.icons.matching, scored: true,
        description: 'Connect each item on the left with its partner on the right.',
        fields: [
            { key: 'prompt_html', label: 'Instructions', type: 'html' },
            { key: 'pairs', label: 'Pairs', type: 'list', minItems: 2, maxItems: 12, itemLabel: 'Pair', fields: [
                { key: 'left', label: 'Left item', type: 'text', required: true },
                { key: 'right', label: 'Matching right item', type: 'text', required: true }
            ] }
        ].concat(ELS.assessmentFields(10, { scoring: true })),
        template: {
            title: 'Match the terms', prompt_html: '<p>Match each term with its definition.</p>',
            pairs: [{ left: 'Biodiversity', right: 'Variety of life in an area' }, { left: 'Habitat', right: 'Natural home of an organism' }, { left: 'Ecosystem', right: 'Community of organisms and their environment' }, { left: 'Erosion', right: 'Wearing away of soil and rock' }],
            points: 10, attempts: 2, scoring: 'partial', feedback: { correct: '<p>All pairs matched correctly.</p>', incorrect: '<p>Some connections are wrong.</p>' }
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, pairs = c.pairs || [];
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            ctx.el.appendChild(h('p.els-hint', { text: t('matchHint') }));
            var resp = pairs.map(function () { return null; });   // left index -> right index
            var activeLeft = null;
            var wrap = h('div.els-match');
            var colL = h('div.els-match-col', { role: 'group' }), colR = h('div.els-match-col', { role: 'group' });
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'els-match-lines'); svg.setAttribute('aria-hidden', 'true');
            var L = [], Rb = [];
            pairs.forEach(function (p, i) {
                var b = h('button.els-match-item', { type: 'button', 'aria-pressed': 'false' }, h('span.els-match-num'), h('span', { text: p.left }));
                b.addEventListener('click', function () { if (q.isLocked()) return; if (resp[i] !== null && activeLeft !== i) { resp[i] = null; } activeLeft = activeLeft === i ? null : i; paint(); });
                L[i] = b; colL.appendChild(b);
            });
            util.shuffle(pairs.map(function (_, i) { return i; }), ctx.rng('match'), true).forEach(function (ri) {
                var b = h('button.els-match-item.is-right', { type: 'button' }, h('span.els-match-num'), h('span', { text: pairs[ri].right }));
                b.addEventListener('click', function () {
                    if (q.isLocked()) return;
                    var owner = resp.indexOf(ri);
                    if (activeLeft === null) { if (owner >= 0) { resp[owner] = null; paint(); } return; }
                    if (owner >= 0) resp[owner] = null;
                    resp[activeLeft] = ri;
                    var nextFree = resp.indexOf(null);
                    activeLeft = nextFree >= 0 ? nextFree : null;
                    paint();
                    if (activeLeft !== null) L[activeLeft].focus();
                });
                Rb[ri] = b; colR.appendChild(b);
            });
            wrap.appendChild(colL); wrap.appendChild(svg); wrap.appendChild(colR);
            ctx.el.appendChild(wrap);
            var marks = {};
            function paint() {
                pairs.forEach(function (_, i) {
                    var n = resp[i] !== null ? String(i + 1) : '';
                    L[i].querySelector('.els-match-num').textContent = n || '';
                    L[i].classList.toggle('is-active', activeLeft === i);
                    L[i].classList.toggle('is-paired', resp[i] !== null);
                    L[i].setAttribute('aria-pressed', activeLeft === i ? 'true' : 'false');
                    L[i].setAttribute('data-c', i % 6);
                });
                pairs.forEach(function (_, ri) {
                    var owner = resp.indexOf(ri);
                    Rb[ri].querySelector('.els-match-num').textContent = owner >= 0 ? String(owner + 1) : '';
                    Rb[ri].classList.toggle('is-paired', owner >= 0);
                    Rb[ri].setAttribute('data-c', owner >= 0 ? owner % 6 : '');
                    Rb[ri].setAttribute('aria-label', pairs[ri].right + (owner >= 0 ? ' — ' + pairs[owner].left : ''));
                });
                wrap.classList.toggle('has-active', activeLeft !== null);
                lines();
            }
            function lines() {
                while (svg.firstChild) svg.removeChild(svg.firstChild);
                var box = wrap.getBoundingClientRect();
                if (!box.width) return;
                svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
                var rtl = getComputedStyle(wrap).direction === 'rtl';
                resp.forEach(function (ri, i) {
                    if (ri === null) return;
                    var a = L[i].getBoundingClientRect(), b = Rb[ri].getBoundingClientRect();
                    var x1 = (rtl ? a.left : a.right) - box.left, y1 = a.top + a.height / 2 - box.top;
                    var x2 = (rtl ? b.right : b.left) - box.left, y2 = b.top + b.height / 2 - box.top;
                    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    var mx = (x1 + x2) / 2;
                    path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2);
                    path.setAttribute('class', 'c' + (i % 6) + (marks[i] ? ' ' + marks[i] : ''));
                    svg.appendChild(path);
                });
            }
            var onResize = util.debounce(lines, 80);
            root.addEventListener('resize', onResize);
            ctx.onDestroy(function () { root.removeEventListener('resize', onResize); });
            ctx.onEnter(function () { setTimeout(lines, 50); setTimeout(lines, 700); });
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { return resp.some(function (x) { return x === null; }) ? null : resp.slice(); },
                evaluate: function (r) { var good = r.filter(function (ri, i) { return ri === i; }).length; return { ratio: ELS.ratio(c, good, pairs.length), correct: good === pairs.length }; },
                showResult: function (r) {
                    marks = {};
                    r.forEach(function (ri, i) { var ok = ri === i; marks[i] = ok ? 'ok' : 'bad'; L[i].classList.toggle('is-correct', ok); L[i].classList.toggle('is-wrong', !ok); });
                    lines();
                },
                applyResponse: function (r) { resp = r.slice(); activeLeft = null; paint(); },
                setLocked: function (v) { wrap.classList.toggle('is-locked', v); if (v) { activeLeft = null; paint(); } },
                reset: function () {
                    resp = resp.map(function (ri, i) { return ri === i ? ri : null; });
                    marks = {};
                    L.forEach(function (b) { b.classList.remove('is-correct', 'is-wrong'); });
                    activeLeft = resp.indexOf(null); if (activeLeft < 0) activeLeft = null;
                    paint();
                },
                interaction: function (r) { return { type: 'matching', response: r.map(function (ri, i) { return [i, ri]; }), correct: pairs.map(function (_, i) { return [i, i]; }), description: util.stripHtml(c.prompt_html) || c.title }; }
            });
            if (!(ctx.saved && ctx.saved.r)) { activeLeft = 0; }
            paint();
        }
    });

    /* ================================================================== *
     * SORTING / SEQUENCING
     * ================================================================== */
    R.register({
        type: 'sorting', label: 'Sorting / sequence', category: 'assessment', icon: ELS.icons.sorting, scored: true,
        description: 'Put steps or items into the correct order.',
        fields: [
            { key: 'prompt_html', label: 'Instructions', type: 'html' },
            { key: 'items', label: 'Items (in the correct order)', type: 'list', minItems: 2, maxItems: 15, itemLabel: 'Item', fields: [
                { key: 'text', label: 'Text', type: 'text', required: true }
            ] },
            { key: 'top_label', label: 'Label for first position', type: 'text' },
            { key: 'bottom_label', label: 'Label for last position', type: 'text' }
        ].concat(ELS.assessmentFields(10, { scoring: true })),
        template: {
            title: 'Put the steps in order', prompt_html: '<p>Order the stages of the water cycle, starting with the first.</p>',
            items: [{ text: 'Evaporation' }, { text: 'Condensation' }, { text: 'Precipitation' }, { text: 'Collection' }],
            top_label: 'First', bottom_label: 'Last', points: 10, attempts: 2, scoring: 'partial',
            feedback: { correct: '<p>That is the full cycle.</p>', incorrect: '<p>Water evaporates, condenses into clouds, falls, then collects.</p>' }
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, items = c.items || [];
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            ctx.el.appendChild(h('p.els-hint', { text: t('sortHint') }));
            var order = util.shuffle(items.map(function (_, i) { return i; }), ctx.rng('sort'), true);
            var list = h('ol.els-sort', { 'aria-label': util.stripHtml(c.prompt_html) || c.title });
            var wrap = h('div.els-sort-wrap', c.top_label ? h('div.els-sort-cap', { text: '▲ ' + c.top_label }) : null, list, c.bottom_label ? h('div.els-sort-cap', { text: '▼ ' + c.bottom_label }) : null);
            var rows = [];
            items.forEach(function (it, i) {
                var up = h('button.els-icon-btn.sm', { type: 'button', 'aria-label': t('moveUp') + ': ' + it.text, html: ELS.icons.up, onclick: function () { shift(i, -1); } });
                var down = h('button.els-icon-btn.sm', { type: 'button', 'aria-label': t('moveDown') + ': ' + it.text, html: ELS.icons.down, onclick: function () { shift(i, 1); } });
                var handle = h('span.els-sort-handle', { html: ELS.icons.grip });
                var li = h('li.els-sort-item', { tabindex: '0', 'data-i': i, 'aria-label': it.text }, handle, h('span.els-sort-pos'), h('span.els-sort-text', { text: it.text }), h('span.els-sort-btns', up, down));
                li.addEventListener('keydown', function (e) {
                    if (q.isLocked()) return;
                    if ((e.altKey || e.ctrlKey || e.shiftKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); e.stopPropagation(); shift(i, e.key === 'ArrowUp' ? -1 : 1); li.focus(); }
                    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault(); e.stopPropagation();
                        var pos = order.indexOf(i), np = pos + (e.key === 'ArrowUp' ? -1 : 1);
                        if (np >= 0 && np < order.length) rows[order[np]].focus();
                    }
                });
                ELS.drag(li, {
                    move: function (e, el) {
                        if (q.isLocked()) return;
                        var over = el && el.closest && el.closest('.els-sort-item');
                        if (!over || over === li) return;
                        var j = Number(over.getAttribute('data-i'));
                        var a = order.indexOf(i), b = order.indexOf(j);
                        order.splice(a, 1); order.splice(b, 0, i);
                        draw();
                    },
                    drop: function () { draw(); }
                });
                rows[i] = li;
            });
            function shift(i, d) {
                if (q.isLocked()) return;
                var a = order.indexOf(i), b = a + d;
                if (b < 0 || b >= order.length) return;
                order.splice(a, 1); order.splice(b, 0, i);
                draw();
                ELS.anim.pulse(rows[i], 'els-pop');
                rows[i].focus();
            }
            function draw() {
                order.forEach(function (i, pos) {
                    list.appendChild(rows[i]);
                    rows[i].querySelector('.els-sort-pos').textContent = String(pos + 1);
                    var bt = rows[i].querySelectorAll('.els-sort-btns button');
                    bt[0].disabled = pos === 0; bt[1].disabled = pos === order.length - 1;
                });
            }
            draw();
            ctx.el.appendChild(wrap);
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { return order.slice(); },
                evaluate: function (r) { var good = r.filter(function (i, pos) { return i === pos; }).length; return { ratio: ELS.ratio(c, good, items.length), correct: good === items.length }; },
                showResult: function (r, ev, final) {
                    r.forEach(function (i, pos) {
                        var ok = i === pos;
                        rows[i].classList.toggle('is-correct', ok); rows[i].classList.toggle('is-wrong', !ok);
                        var old = rows[i].querySelector('.els-model-answer'); if (old) old.parentNode.removeChild(old);
                        if (!ok && final) rows[i].appendChild(h('span.els-model-answer', { text: '→ ' + (i + 1) }));
                    });
                },
                applyResponse: function (r) { order = r.slice(); draw(); },
                setLocked: function (v) { wrap.classList.toggle('is-locked', v); setDisabled(list, 'button', v); if (!v) draw(); },
                reset: function () { rows.forEach(function (r) { r.classList.remove('is-correct', 'is-wrong'); }); draw(); },
                interaction: function (r) { return { type: 'sequencing', response: r, correct: items.map(function (_, i) { return i; }), description: util.stripHtml(c.prompt_html) || c.title }; }
            });
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
