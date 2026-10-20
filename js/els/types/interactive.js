/**
 * Interactive content screens: hotspot, accordion, tabs, flashcards, timeline,
 * labeled_diagram, data_chart, image_compare.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    /** Image with an absolutely positioned overlay layer (coordinates in %). */
    ELS.ui.stage = function (src, alt) {
        var img = h('img.els-stage-img', { src: src || '', alt: alt || '', draggable: 'false' });
        var layer = h('div.els-stage-layer');
        var el = h('div.els-stage', { 'data-prevent-swipe': '' }, img, layer);
        return { el: el, img: img, layer: layer };
    };

    /** Persisted "visited" set for explore-style screens; completes when all visited. */
    function visitTracker(ctx, total, requireAll, onChange) {
        var st = ctx.stored() || {};
        var seen = st.v || {};
        return {
            seen: seen,
            mark: function (k) {
                if (seen[k]) return;
                seen[k] = 1;
                ctx.store({ v: seen });
                var n = Object.keys(seen).length;
                if (requireAll && n >= total) ctx.complete();
                if (onChange) onChange(n);
            },
            count: function () { return Object.keys(seen).length; }
        };
    }
    ELS.visitTracker = visitTracker;

    function progressNote(ctx, total, requireAll, msgKey) {
        var el = h('p.els-progress-note');
        function set(n) {
            el.innerHTML = (n >= total ? ELS.icons.check : ELS.icons.info) + '<span>' + util.esc(ctx.t('explored', { a: Math.min(n, total), b: total })) + (requireAll && n < total ? ' — ' + util.esc(ctx.t(msgKey)) : '') + '</span>';
            el.classList.toggle('is-done', n >= total);
        }
        return { el: el, set: set };
    }

    function regionStyle(rg) {
        if (rg.shape === 'circle') {
            var r = Number(rg.r) || 5;
            return { left: Number(rg.x) + '%', top: Number(rg.y) + '%', width: (2 * r) + '%', aspectRatio: '1 / 1', borderRadius: '50%', transform: 'translate(-50%, -50%)' };
        }
        return { left: Number(rg.x) + '%', top: Number(rg.y) + '%', width: Number(rg.w) + '%', height: Number(rg.h) + '%' };
    }
    function hitRegion(rg, px, py, aspect) {
        if (rg.shape === 'circle') {
            var dx = px - rg.x, dy = (py - rg.y) * aspect; // convert y% of height into % of width
            return Math.sqrt(dx * dx + dy * dy) <= rg.r;
        }
        return px >= rg.x && px <= rg.x + rg.w && py >= rg.y && py <= rg.y + rg.h;
    }

    /* ================================================================== *
     * HOTSPOT
     * ================================================================== */
    R.register({
        type: 'hotspot', label: 'Image hotspots', category: 'interactive', icon: ELS.icons.hotspot,
        scored: function (c) { return c.mode !== 'explore'; },
        requiresInteraction: function (c) { return c.mode === 'explore' && !!c.require_all; },
        description: 'Clickable regions on an image — explore content or find the right spot (quiz).',
        fields: [
            { key: 'prompt_html', label: 'Prompt', type: 'html', required: true },
            { key: 'image', label: 'Image', type: 'image', required: true },
            { key: 'image_alt', label: 'Image description (alt text)', type: 'text' },
            { key: 'mode', label: 'Mode', type: 'select', default: 'quiz', options: [{ value: 'quiz', label: 'Quiz — pick the correct spot' }, { value: 'explore', label: 'Explore — reveal information' }] },
            { key: 'show_regions', label: 'Show region outlines', type: 'bool', default: true, showIf: { mode: 'quiz' } },
            { key: 'require_all', label: 'Learner must open every region', type: 'bool', default: false, showIf: { mode: 'explore' } },
            { key: 'regions', label: 'Regions', type: 'regions', imageKey: 'image', minItems: 1, itemLabel: 'Region', fields: [
                { key: 'id', type: 'id' },
                { key: 'label', label: 'Label', type: 'text', required: true },
                { key: 'shape', label: 'Shape', type: 'select', default: 'rect', options: [{ value: 'rect', label: 'Rectangle' }, { value: 'circle', label: 'Circle' }] },
                { key: 'x', label: 'X (%)', type: 'number', min: 0, max: 100, step: 0.5, default: 10 },
                { key: 'y', label: 'Y (%)', type: 'number', min: 0, max: 100, step: 0.5, default: 10 },
                { key: 'w', label: 'Width (%)', type: 'number', min: 1, max: 100, step: 0.5, default: 20, showIf: function (r) { return r.shape !== 'circle'; } },
                { key: 'h', label: 'Height (%)', type: 'number', min: 1, max: 100, step: 0.5, default: 20, showIf: function (r) { return r.shape !== 'circle'; } },
                { key: 'r', label: 'Radius (% of width)', type: 'number', min: 1, max: 50, step: 0.5, default: 8, showIf: { shape: 'circle' } },
                { key: 'correct', label: 'Correct spot (quiz)', type: 'bool', showIf: function (r, s) { return s.mode !== 'explore'; } },
                { key: 'content_html', label: 'Content / feedback shown on click', type: 'html' }
            ] }
        ].concat(ELS.assessmentFields(10).map(function (f) { f.showIf = { mode: 'quiz' }; return f; })),
        template: {
            title: 'Spot the solar panels', prompt_html: '<p>Click the part of the house that turns sunlight into electricity.</p>',
            image: 'img/samples/house.svg', image_alt: 'Illustration of a house with roof, window, door and garden', mode: 'quiz', show_regions: true,
            regions: [
                { id: 'r1', label: 'Roof panels', shape: 'rect', x: 27, y: 27, w: 41, h: 15, correct: true, content_html: '<p>Solar panels convert sunlight into electricity.</p>' },
                { id: 'r2', label: 'Window', shape: 'rect', x: 30, y: 50, w: 16, h: 16, correct: false, content_html: '<p>Windows let in light, but do not generate power.</p>' },
                { id: 'r3', label: 'Tree', shape: 'circle', x: 87, y: 55, r: 8, correct: false, content_html: '<p>Trees provide shade and store carbon.</p>' }
            ],
            points: 10, attempts: 2, feedback: { correct: '<p>Right — the panels on the roof.</p>', incorrect: '<p>Look up at the roof.</p>' }
        },
        validate: function (c) {
            var out = [];
            if (c.mode !== 'explore' && !(c.regions || []).some(function (r) { return r.correct; })) out.push({ path: 'regions', message: 'Quiz mode needs at least one region marked correct.', level: 'error' });
            if (c.mode !== 'explore' && c.require_all) out.push({ path: 'require_all', message: '"Must open every region" only applies to explore mode.', level: 'warning' });
            if (!c.image_alt) out.push({ path: 'image_alt', message: 'Add alt text for the image.', level: 'warning' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, regions = c.regions || [], quiz = c.mode !== 'explore';
            ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var stage = ELS.ui.stage(c.image, c.image_alt);
            var grid = h('div.els-hotspot' + (quiz ? '.is-quiz' : '.is-explore'));
            grid.appendChild(stage.el);
            var panel = h('div.els-hotspot-panel', { 'aria-live': 'polite' });
            if (!quiz) grid.appendChild(panel);
            ctx.el.appendChild(grid);
            if (quiz && c.show_regions === false) stage.el.classList.add('is-hidden-regions');
            var btns = [];
            var pick = null, marker = null;
            regions.forEach(function (rg, i) {
                var b = h('button.els-region', { type: 'button', style: regionStyle(rg), 'aria-label': quiz ? t('region', { n: i + 1 }) + (c.show_regions === false ? '' : ': ' + rg.label) : rg.label, 'aria-pressed': 'false' },
                    h('span.els-region-dot', { text: quiz ? '' : String(i + 1) }));
                b.addEventListener('click', function (e) { e.stopPropagation(); choose(i); });
                btns.push(b);
                stage.layer.appendChild(b);
            });
            var vt, note;
            if (!quiz) {
                note = progressNote(ctx, regions.length, !!c.require_all, 'exploreAll');
                vt = visitTracker(ctx, regions.length, !!c.require_all, note.set);
                ctx.el.appendChild(note.el);
                note.set(vt.count());
                Object.keys(vt.seen).forEach(function (k) { var i = regions.findIndex(function (r) { return (r.id || '') === k; }); if (btns[i]) btns[i].classList.add('is-visited'); });
                panel.appendChild(h('p.els-muted', { text: t('viewDetails') + ' →' }));
            } else if (c.show_regions === false) {
                stage.layer.addEventListener('click', function (e) {
                    if (q.isLocked()) return;
                    var r = stage.layer.getBoundingClientRect();
                    var px = (e.clientX - r.left) / r.width * 100, py = (e.clientY - r.top) / r.height * 100;
                    var hit = -1;
                    regions.forEach(function (rg, i) { if (hit < 0 && hitRegion(rg, px, py, r.height / r.width)) hit = i; });
                    choose(hit, px, py);
                });
            }
            function choose(i, px, py) {
                if (quiz) {
                    if (q.isLocked()) return;
                    pick = i < 0 ? { miss: true, x: Math.round(px), y: Math.round(py) } : i;
                    paint();
                    return;
                }
                btns.forEach(function (b, k) { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
                btns[i].classList.add('is-visited');
                var rg = regions[i];
                panel.innerHTML = '';
                panel.appendChild(h('h3', { text: rg.label }));
                if (rg.content_html) panel.appendChild(h('div.els-prose', { html: rg.content_html }));
                ELS.anim.pulse(panel, 'els-pop');
                vt.mark(rg.id || String(i));
            }
            function paint() {
                btns.forEach(function (b, k) { b.classList.toggle('is-selected', pick === k); b.setAttribute('aria-pressed', pick === k ? 'true' : 'false'); });
                if (marker) { marker.parentNode.removeChild(marker); marker = null; }
                var p = pick;
                if (p !== null && typeof p === 'object') {
                    marker = h('span.els-click-marker', { style: { left: p.x + '%', top: p.y + '%' } });
                    stage.layer.appendChild(marker);
                }
            }
            if (!quiz) return;
            var correctIdx = regions.map(function (r, i) { return r.correct ? i : -1; }).filter(function (i) { return i >= 0; });
            var q = ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { return pick; },
                evaluate: function (r) {
                    var ok = typeof r === 'number' && !!(regions[r] && regions[r].correct);
                    var rg = typeof r === 'number' ? regions[r] : null;
                    return { ratio: ok ? 1 : 0, correct: ok, extraHtml: rg && rg.content_html ? rg.content_html : '' };
                },
                showResult: function (r, ev, final) {
                    btns.forEach(function (b, k) {
                        b.classList.toggle('is-correct', r === k && ev.correct);
                        b.classList.toggle('is-wrong', r === k && !ev.correct);
                        b.classList.toggle('is-missed', !!final && !ev.correct && !!regions[k].correct);
                    });
                    if (marker) marker.classList.add(ev.correct ? 'is-correct' : 'is-wrong');
                },
                applyResponse: function (r) { pick = r; paint(); },
                setLocked: function (v) { grid.classList.toggle('is-locked', v); },
                reset: function () { pick = null; btns.forEach(function (b) { b.classList.remove('is-correct', 'is-wrong', 'is-missed'); }); paint(); },
                interaction: function (r) {
                    return { type: 'choice', response: typeof r === 'number' ? [r] : [], correct: correctIdx, description: util.stripHtml(c.prompt_html) };
                }
            });
        }
    });

    /* ================================================================== *
     * ACCORDION
     * ================================================================== */
    R.register({
        type: 'accordion', label: 'Accordion', category: 'interactive', icon: ELS.icons.accordion,
        requiresInteraction: function (c) { return !!c.require_all; },
        description: 'Expandable sections that reveal content on demand.',
        fields: [
            { key: 'intro_html', label: 'Intro', type: 'html' },
            { key: 'items', label: 'Sections', type: 'list', minItems: 1, itemLabel: 'Section', fields: [
                { key: 'title', label: 'Heading', type: 'text', required: true },
                { key: 'body_html', label: 'Content', type: 'html', required: true },
                { key: 'image', label: 'Image', type: 'image' },
                { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (i) { return !!i.image; } }
            ] },
            { key: 'allow_multiple', label: 'Allow several sections open at once', type: 'bool', default: false },
            { key: 'require_all', label: 'Learner must open every section', type: 'bool', default: false }
        ],
        template: {
            title: 'The three Rs', intro_html: '<p>Open each section to learn more.</p>', allow_multiple: false, require_all: true,
            items: [{ title: 'Reduce', body_html: '<p>Buy less and choose products with less packaging.</p>' }, { title: 'Reuse', body_html: '<p>Give items a second life before throwing them away.</p>' }, { title: 'Recycle', body_html: '<p>Turn waste materials into new products.</p>' }]
        },
        render: function (ctx) {
            var c = ctx.cfg, items = c.items || [];
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var note = progressNote(ctx, items.length, !!c.require_all, 'openAll');
            var vt = visitTracker(ctx, items.length, !!c.require_all, note.set);
            var acc = h('div.els-accordion');
            var heads = [];
            items.forEach(function (it, i) {
                var pid = 'acc-' + ctx.id + '-' + i;
                var head = h('button.els-acc-head', { type: 'button', 'aria-expanded': 'false', 'aria-controls': pid, id: pid + '-h' },
                    h('span.els-acc-num', { text: String(i + 1) }), h('span.els-acc-title', { text: it.title }), h('span.els-acc-chev', { html: ELS.icons.chevronD }));
                var body = h('div.els-acc-panel', { id: pid, role: 'region', 'aria-labelledby': pid + '-h' },
                    h('div.els-acc-inner', h('div.els-prose', { html: it.body_html || '' }), it.image ? ELS.ui.image(it.image, it.image_alt, 'els-acc-img') : null));
                head.addEventListener('click', function () { toggle(i); });
                heads.push(head);
                var item = h('div.els-acc-item', head, body);
                if (vt.seen[i]) item.classList.add('is-visited');
                acc.appendChild(item);
            });
            ELS.ui.roving(acc, '.els-acc-head');
            function toggle(i) {
                var open = heads[i].getAttribute('aria-expanded') !== 'true';
                if (open && !c.allow_multiple) heads.forEach(function (hd, k) { if (k !== i) set(k, false); });
                set(i, open);
                if (open) { vt.mark(String(i)); heads[i].parentNode.classList.add('is-visited'); }
            }
            function set(i, open) {
                heads[i].setAttribute('aria-expanded', open ? 'true' : 'false');
                heads[i].parentNode.classList.toggle('is-open', open);
            }
            ctx.el.appendChild(acc);
            ctx.el.appendChild(note.el);
            note.set(vt.count());
            ELS.anim.stagger(acc);
        }
    });

    /* ================================================================== *
     * TABS
     * ================================================================== */
    R.register({
        type: 'tabs', label: 'Tabs', category: 'interactive', icon: ELS.icons.tabs,
        requiresInteraction: function (c) { return !!c.require_all; },
        description: 'Tabbed panels to compare or organise related content.',
        fields: [
            { key: 'intro_html', label: 'Intro', type: 'html' },
            { key: 'tabs', label: 'Tabs', type: 'list', minItems: 1, maxItems: 10, itemLabel: 'Tab', fields: [
                { key: 'label', label: 'Tab label', type: 'text', required: true },
                { key: 'body_html', label: 'Content', type: 'html', required: true },
                { key: 'image', label: 'Image', type: 'image' },
                { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (i) { return !!i.image; } }
            ] },
            { key: 'style', label: 'Style', type: 'select', default: 'top', options: [{ value: 'top', label: 'Tabs on top' }, { value: 'side', label: 'Vertical (side) tabs' }, { value: 'pills', label: 'Pills' }] },
            { key: 'require_all', label: 'Learner must view every tab', type: 'bool', default: false }
        ],
        template: {
            title: 'Energy sources compared', style: 'top', require_all: false,
            tabs: [{ label: 'Solar', body_html: '<p>Clean and abundant, but depends on daylight.</p>' }, { label: 'Wind', body_html: '<p>Very low emissions; output varies with wind speed.</p>' }, { label: 'Hydro', body_html: '<p>Reliable output, but large dams affect rivers.</p>' }]
        },
        render: function (ctx) {
            var c = ctx.cfg, tabs = c.tabs || [];
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var note = progressNote(ctx, tabs.length, !!c.require_all, 'exploreAll');
            var vt = visitTracker(ctx, tabs.length, !!c.require_all, note.set);
            var list = h('div.els-tablist', { role: 'tablist', 'aria-orientation': c.style === 'side' ? 'vertical' : 'horizontal' });
            var panels = h('div.els-tabpanels');
            var tabBtns = [], panelEls = [];
            tabs.forEach(function (tb, i) {
                var id = 'tab-' + ctx.id + '-' + i;
                var b = h('button.els-tab', { type: 'button', role: 'tab', id: id, 'aria-controls': id + '-p', 'aria-selected': 'false', tabindex: '-1', text: tb.label });
                b.addEventListener('click', function () { select(i); });
                var p = h('div.els-tabpanel', { role: 'tabpanel', id: id + '-p', 'aria-labelledby': id, tabindex: '0', hidden: true },
                    h('div.els-prose', { html: tb.body_html || '' }), tb.image ? ELS.ui.image(tb.image, tb.image_alt, 'els-tab-img') : null);
                tabBtns.push(b); panelEls.push(p);
                list.appendChild(b); panels.appendChild(p);
            });
            ELS.ui.roving(list, '.els-tab', { select: true });
            function select(i) {
                tabBtns.forEach(function (b, k) { var on = k === i; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; panelEls[k].hidden = !on; });
                ELS.anim.pulse(panelEls[i], 'els-fade-in');
                vt.mark(String(i));
                tabBtns[i].classList.add('is-visited');
            }
            ctx.el.appendChild(h('div.els-tabs.is-' + (c.style || 'top'), list, panels));
            ctx.el.appendChild(note.el);
            if (tabs.length) {
                Object.keys(vt.seen).forEach(function (k) { if (tabBtns[k]) tabBtns[k].classList.add('is-visited'); });
                ctx.onEnter(function () { if (!tabBtns.some(function (b) { return b.getAttribute('aria-selected') === 'true'; })) select(0); });
            }
            note.set(vt.count());
        }
    });

    /* ================================================================== *
     * FLASHCARDS
     * ================================================================== */
    R.register({
        type: 'flashcards', label: 'Flashcards', category: 'interactive', icon: ELS.icons.flashcards,
        requiresInteraction: function (c) { return !!c.require_all; },
        description: 'Flip cards for recall practice, as a grid or a self-rated study deck.',
        fields: [
            { key: 'intro_html', label: 'Intro', type: 'html' },
            { key: 'cards', label: 'Cards', type: 'list', minItems: 1, itemLabel: 'Card', fields: [
                { key: 'front_html', label: 'Front', type: 'html', required: true },
                { key: 'back_html', label: 'Back', type: 'html', required: true },
                { key: 'front_image', label: 'Front image', type: 'image' },
                { key: 'back_image', label: 'Back image', type: 'image' },
                { key: 'alt', label: 'Image alt text', type: 'text' }
            ] },
            { key: 'layout', label: 'Layout', type: 'select', default: 'grid', options: [{ value: 'grid', label: 'Grid of cards' }, { value: 'deck', label: 'Study deck (one at a time)' }] },
            { key: 'require_all', label: 'Learner must flip every card', type: 'bool', default: false }
        ],
        template: {
            title: 'Key terms', intro_html: '<p>Tap a card to flip it.</p>', layout: 'grid', require_all: true,
            cards: [{ front_html: '<p>Carbon footprint</p>', back_html: '<p>Total greenhouse gases caused by a person, product or organisation.</p>' }, { front_html: '<p>Renewable</p>', back_html: '<p>A resource that is naturally replenished.</p>' }, { front_html: '<p>Deforestation</p>', back_html: '<p>Large-scale removal of forests.</p>' }]
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, cards = c.cards || [];
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var note = progressNote(ctx, cards.length, !!c.require_all, 'exploreAll');
            var vt = visitTracker(ctx, cards.length, !!c.require_all, note.set);
            function card(cd, i) {
                var face = function (cls, html, img) { return h('div.els-card-face.' + cls, img ? ELS.ui.image(img, cd.alt) : null, h('div.els-card-html', { html: html || '' })); };
                var b = h('button.els-card', { type: 'button', 'aria-pressed': 'false', 'aria-label': t('flip') + ': ' + util.stripHtml(cd.front_html) },
                    h('div.els-card-inner', face('is-front', cd.front_html, cd.front_image), face('is-back', cd.back_html, cd.back_image)));
                b.addEventListener('click', function () {
                    var on = !b.classList.contains('is-flipped');
                    b.classList.toggle('is-flipped', on);
                    b.setAttribute('aria-pressed', on ? 'true' : 'false');
                    if (on) { vt.mark(String(i)); b.classList.add('is-visited'); }
                });
                if (vt.seen[i]) b.classList.add('is-visited');
                return b;
            }
            if (c.layout === 'deck') {
                var st = ctx.stored() || {};
                var known = st.k || {};
                var order = cards.map(function (_, i) { return i; }), pos = 0;
                var holder = h('div.els-deck-stage');
                var counter = h('span.els-deck-count');
                var prev = ELS.ui.button(ELS.icons[ctx.dir === 'rtl' ? 'chevronR' : 'chevronL'], function () { show(pos - 1); }, 'icon', { 'aria-label': t('prev') });
                var next = ELS.ui.button(ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { show(pos + 1); }, 'icon', { 'aria-label': t('next') });
                var rate = h('div.els-deck-rate',
                    ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('again')) + '</span>', function () { mark(false); }, 'ghost'),
                    ELS.ui.button(ELS.icons.check + '<span>' + util.esc(t('gotIt')) + '</span>', function () { mark(true); }, 'success'));
                var shuffleBtn = ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('shuffle')) + '</span>', function () { order = util.shuffle(order); show(0); }, 'link');
                ctx.el.appendChild(h('div.els-deck', holder, h('div.els-deck-bar', prev, counter, next), rate, h('div.els-actions', shuffleBtn)));
                var show = function (p) {
                    pos = (p + order.length) % order.length;
                    holder.innerHTML = '';
                    var cardEl = card(cards[order[pos]], order[pos]);
                    if (known[order[pos]]) cardEl.classList.add('is-known');
                    holder.appendChild(cardEl);
                    ELS.anim.pulse(cardEl, 'els-fade-in');
                    counter.textContent = t('cardOf', { a: pos + 1, b: order.length }) + ' · ✓ ' + Object.keys(known).filter(function (k) { return known[k]; }).length;
                };
                var mark = function (ok) {
                    known[order[pos]] = ok ? 1 : 0;
                    var s = ctx.stored() || {}; s.k = known; s.v = vt.seen; ctx.store(s);
                    vt.mark(String(order[pos]));
                    show(pos + 1);
                };
                show(0);
            } else {
                var grid = h('div.els-cards');
                cards.forEach(function (cd, i) { grid.appendChild(card(cd, i)); });
                ctx.el.appendChild(grid);
                ELS.anim.stagger(grid);
            }
            ctx.el.appendChild(note.el);
            note.set(vt.count());
        }
    });

    /* ================================================================== *
     * TIMELINE
     * ================================================================== */
    R.register({
        type: 'timeline', label: 'Timeline', category: 'interactive', icon: ELS.icons.timeline,
        requiresInteraction: function (c) { return !!c.require_all; },
        description: 'Chronological events explored step by step or as a vertical story.',
        fields: [
            { key: 'intro_html', label: 'Intro', type: 'html' },
            { key: 'events', label: 'Events', type: 'list', minItems: 1, itemLabel: 'Event', fields: [
                { key: 'date', label: 'Date / label', type: 'text', required: true },
                { key: 'title', label: 'Title', type: 'text', required: true },
                { key: 'body_html', label: 'Details', type: 'html' },
                { key: 'image', label: 'Image', type: 'image' },
                { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (e) { return !!e.image; } }
            ] },
            { key: 'layout', label: 'Layout', type: 'select', default: 'horizontal', options: [{ value: 'horizontal', label: 'Horizontal stepper' }, { value: 'vertical', label: 'Vertical story' }] },
            { key: 'require_all', label: 'Learner must view every event', type: 'bool', default: false }
        ],
        template: {
            title: 'A short history of climate action', layout: 'horizontal', require_all: false,
            events: [{ date: '1972', title: 'Stockholm Conference', body_html: '<p>The first UN conference on the human environment.</p>' }, { date: '1992', title: 'Earth Summit', body_html: '<p>The UN Framework Convention on Climate Change is signed in Rio.</p>' }, { date: '1997', title: 'Kyoto Protocol', body_html: '<p>Binding emission targets for industrialised countries.</p>' }, { date: '2015', title: 'Paris Agreement', body_html: '<p>Nearly every nation agrees to limit warming well below 2 °C.</p>' }]
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, evs = c.events || [];
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var note = progressNote(ctx, evs.length, !!c.require_all, 'exploreAll');
            var vt = visitTracker(ctx, evs.length, !!c.require_all, note.set);
            if (c.layout === 'vertical') {
                var list = h('ol.els-vtimeline');
                evs.forEach(function (ev, i) {
                    var det = h('div.els-vt-detail', { hidden: true }, ev.body_html ? h('div.els-prose', { html: ev.body_html }) : null, ev.image ? ELS.ui.image(ev.image, ev.image_alt) : null);
                    var btn = h('button.els-vt-head', { type: 'button', 'aria-expanded': 'false' }, h('span.els-vt-date', { text: ev.date }), h('span.els-vt-title', { text: ev.title }), h('span.els-acc-chev', { html: ELS.icons.chevronD }));
                    btn.addEventListener('click', function () {
                        var open = det.hidden; det.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                        li.classList.toggle('is-open', open);
                        if (open) { vt.mark(String(i)); li.classList.add('is-visited'); ELS.anim.pulse(det, 'els-fade-in'); }
                    });
                    var li = h('li.els-vt-item' + (vt.seen[i] ? '.is-visited' : ''), h('span.els-vt-dot'), h('div.els-vt-card', btn, det));
                    list.appendChild(li);
                });
                ctx.el.appendChild(list);
                ELS.anim.stagger(list);
            } else {
                var track = h('div.els-htimeline', { role: 'tablist', 'aria-orientation': 'horizontal' });
                var panel = h('div.els-ht-panel', { role: 'tabpanel', tabindex: '0', 'aria-live': 'polite' });
                var dots = [];
                var cur = 0;
                evs.forEach(function (ev, i) {
                    var d = h('button.els-ht-stop', { type: 'button', role: 'tab', 'aria-selected': 'false', tabindex: '-1' }, h('span.els-ht-dot'), h('span.els-ht-date', { text: ev.date }), h('span.els-ht-title', { text: ev.title }));
                    d.addEventListener('click', function () { select(i); });
                    if (vt.seen[i]) d.classList.add('is-visited');
                    dots.push(d); track.appendChild(d);
                });
                ELS.ui.roving(track, '.els-ht-stop', { select: true });
                var prev = ELS.ui.button(ELS.icons[ctx.dir === 'rtl' ? 'chevronR' : 'chevronL'], function () { select(cur - 1); }, 'icon', { 'aria-label': t('prev') });
                var next = ELS.ui.button(ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { select(cur + 1); }, 'icon', { 'aria-label': t('next') });
                var bar = h('div.els-ht-bar', h('span.els-ht-fill'));
                ctx.el.appendChild(h('div.els-ht', h('div.els-ht-scroll', { 'data-prevent-swipe': '' }, bar, track), h('div.els-ht-body', prev, panel, next)));
                var select = function (i) {
                    if (i < 0 || i >= evs.length) return;
                    cur = i;
                    dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === i ? 'true' : 'false'); d.tabIndex = k === i ? 0 : -1; d.classList.toggle('is-past', k < i); });
                    dots[i].classList.add('is-visited');
                    bar.firstChild.style.width = (evs.length > 1 ? (i / (evs.length - 1)) * 100 : 100) + '%';
                    var ev = evs[i];
                    panel.innerHTML = '';
                    panel.appendChild(h('div.els-ht-card', h('span.els-badge', { text: ev.date }), h('h3', { text: ev.title }),
                        ev.body_html ? h('div.els-prose', { html: ev.body_html }) : null, ev.image ? ELS.ui.image(ev.image, ev.image_alt, 'els-ht-img') : null));
                    ELS.anim.pulse(panel.firstChild, 'els-fade-in');
                    prev.disabled = i === 0; next.disabled = i === evs.length - 1;
                    try { dots[i].scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { }
                    vt.mark(String(i));
                };
                if (evs.length) select(0);
            }
            ctx.el.appendChild(note.el);
            note.set(vt.count());
        }
    });

    /* ================================================================== *
     * LABELED DIAGRAM
     * ================================================================== */
    R.register({
        type: 'labeled_diagram', label: 'Labeled diagram', category: 'interactive', icon: ELS.icons.diagram,
        scored: function (c) { return c.mode !== 'display'; },
        points: function (c) { return c.points === undefined ? 15 : c.points; },
        description: 'Numbered markers on an image — explore the labels or name each part (quiz).',
        fields: [
            { key: 'prompt_html', label: 'Prompt', type: 'html' },
            { key: 'image', label: 'Diagram image', type: 'image', required: true },
            { key: 'image_alt', label: 'Diagram description (alt text)', type: 'text' },
            { key: 'mode', label: 'Mode', type: 'select', default: 'quiz', options: [{ value: 'quiz', label: 'Quiz — name each marker' }, { value: 'display', label: 'Display — explore labels' }] },
            { key: 'labels', label: 'Labels', type: 'points', imageKey: 'image', minItems: 2, itemLabel: 'Label', fields: [
                { key: 'id', type: 'id' },
                { key: 'text', label: 'Label text', type: 'text', required: true },
                { key: 'x', label: 'X (%)', type: 'number', min: 0, max: 100, step: 0.5, default: 50 },
                { key: 'y', label: 'Y (%)', type: 'number', min: 0, max: 100, step: 0.5, default: 50 },
                { key: 'description', label: 'Description (display mode)', type: 'text' }
            ] }
        ].concat(ELS.assessmentFields(15, { scoring: true }).map(function (f) { f.showIf = { mode: 'quiz' }; return f; })),
        template: {
            title: 'Parts of a plant', prompt_html: '<p>Name each numbered part of the plant.</p>', image: 'img/samples/plant.svg', image_alt: 'Diagram of a flowering plant', mode: 'quiz',
            labels: [{ id: 'l1', text: 'Flower', x: 50, y: 14, description: 'Produces seeds.' }, { id: 'l2', text: 'Leaf', x: 70, y: 45, description: 'Makes food by photosynthesis.' }, { id: 'l3', text: 'Stem', x: 50, y: 58, description: 'Carries water and nutrients.' }, { id: 'l4', text: 'Roots', x: 50, y: 88, description: 'Absorb water from the soil.' }],
            points: 15, attempts: 2, scoring: 'partial', feedback: { correct: '<p>All parts named correctly!</p>', incorrect: '<p>Check the highlighted markers.</p>' }
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, labels = c.labels || [], quiz = c.mode !== 'display';
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var stage = ELS.ui.stage(c.image, c.image_alt);
            var legend = h('ol.els-legend');
            var wrap = h('div.els-diagram' + (quiz ? '.is-quiz' : '.is-display'), stage.el, legend);
            ctx.el.appendChild(wrap);
            var markers = [], selects = [], items = [];
            labels.forEach(function (lb, i) {
                var m = h('button.els-marker', { type: 'button', style: { left: lb.x + '%', top: lb.y + '%' }, 'aria-label': t('marker', { n: i + 1 }) + (quiz ? '' : ': ' + lb.text), text: String(i + 1) });
                if (!quiz) {
                    var tip = h('span.els-marker-tip', h('strong', { text: lb.text }), lb.description ? h('span', { text: lb.description }) : null);
                    m.appendChild(tip);
                    m.addEventListener('click', function () { focusLabel(i); });
                } else m.addEventListener('click', function () { selects[i].focus(); });
                markers.push(m); stage.layer.appendChild(m);
            });
            if (quiz) {
                var names = util.shuffle(labels.map(function (l) { return l.text; }), ctx.rng('labels'));
                labels.forEach(function (lb, i) {
                    var sel = h('select.els-select', { 'aria-label': t('marker', { n: i + 1 }) });
                    sel.appendChild(h('option', { value: '', text: t('selectOption') }));
                    names.forEach(function (n) { sel.appendChild(h('option', { value: n, text: n })); });
                    sel.addEventListener('focus', function () { markers[i].classList.add('is-active'); });
                    sel.addEventListener('blur', function () { markers[i].classList.remove('is-active'); });
                    sel.addEventListener('change', function () { markers[i].classList.toggle('is-filled', !!sel.value); });
                    selects.push(sel);
                    var li = h('li.els-legend-item', h('span.els-legend-num', { text: String(i + 1) }), sel);
                    items.push(li); legend.appendChild(li);
                });
            } else {
                var vt = visitTracker(ctx, labels.length, false);
                labels.forEach(function (lb, i) {
                    var li = h('li.els-legend-item', { tabindex: '0' }, h('span.els-legend-num', { text: String(i + 1) }), h('div', h('strong', { text: lb.text }), lb.description ? h('p', { text: lb.description }) : null));
                    li.addEventListener('mouseenter', function () { markers[i].classList.add('is-active'); });
                    li.addEventListener('mouseleave', function () { markers[i].classList.remove('is-active'); });
                    li.addEventListener('focus', function () { focusLabel(i); });
                    li.addEventListener('click', function () { focusLabel(i); });
                    items.push(li); legend.appendChild(li);
                });
                var focusLabel = function (i) {
                    markers.forEach(function (m, k) { m.classList.toggle('is-active', k === i); });
                    items.forEach(function (li, k) { li.classList.toggle('is-active', k === i); });
                    vt.mark(String(i));
                };
                return;
            }
            ELS.question(ctx, {
                host: ctx.el,
                getResponse: function () { var r = selects.map(function (s) { return s.value; }); return r.some(function (v) { return !v; }) ? null : r; },
                evaluate: function (r) { var good = r.filter(function (v, i) { return v === labels[i].text; }).length; return { ratio: ELS.ratio(c, good, labels.length), correct: good === labels.length }; },
                showResult: function (r, ev, final) {
                    r.forEach(function (v, i) {
                        var ok = v === labels[i].text;
                        markers[i].classList.toggle('is-correct', ok); markers[i].classList.toggle('is-wrong', !ok);
                        items[i].classList.toggle('is-correct', ok); items[i].classList.toggle('is-wrong', !ok);
                        var old = items[i].querySelector('.els-model-answer'); if (old) old.parentNode.removeChild(old);
                        if (!ok && final) items[i].appendChild(h('span.els-model-answer', { text: labels[i].text }));
                    });
                },
                applyResponse: function (r) { r.forEach(function (v, i) { selects[i].value = v; markers[i].classList.toggle('is-filled', !!v); }); },
                setLocked: function (v) { selects.forEach(function (s) { s.disabled = v; }); },
                reset: function () {
                    selects.forEach(function (s, i) { if (s.value !== labels[i].text) { s.value = ''; markers[i].classList.remove('is-filled'); } });
                    markers.concat(items).forEach(function (m) { m.classList.remove('is-correct', 'is-wrong'); });
                },
                interaction: function (r) {
                    var idx = function (txt) { return Math.max(0, labels.map(function (l) { return l.text; }).indexOf(txt)); };
                    return { type: 'matching', response: r.map(function (v, i) { return [i, idx(v)]; }), correct: labels.map(function (_, i) { return [i, i]; }), description: util.stripHtml(c.prompt_html) || c.title };
                }
            });
        }
    });

    /* ================================================================== *
     * DATA CHART — deterministic inline SVG, no libraries
     * ================================================================== */
    /** Round a raw tick step up to 1, 2, 2.5 or 5 × 10^n so axis labels stay readable. */
    function niceStep(v) {
        if (!(v > 0)) return 1;
        var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
        return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    }
    var PALETTE = ['var(--els-primary)', 'var(--els-accent)', '#f2a900', '#e2556f', '#7a5cf0', '#1fa5a5', '#8a6d3b', '#5b6b79'];
    ELS.chartSvg = function (cfg, rtl) {
        var data = (cfg.data || []).map(function (d, i) { return { label: String(d.label || ''), value: Number(d.value) || 0, color: d.color || PALETTE[i % PALETTE.length], note: d.note || '' }; });
        var type = cfg.chart_type || 'bar', unit = cfg.unit || '';
        var W = 640, H = 360, NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('class', 'els-chart-svg is-' + type);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', (cfg.title || '') + ': ' + data.map(function (d) { return d.label + ' ' + d.value + unit; }).join(', '));
        function el(name, attrs, text) { var e = document.createElementNS(NS, name); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text !== undefined) e.textContent = text; svg.appendChild(e); return e; }
        var marks = [];
        if (!data.length) return { svg: svg, marks: marks, data: data };
        if (type === 'pie' || type === 'donut') {
            var total = data.reduce(function (s, d) { return s + Math.max(0, d.value); }, 0) || 1;
            var cx = 200, cy = H / 2, r = 150, ir = type === 'donut' ? 80 : 0, a0 = -Math.PI / 2;
            data.forEach(function (d, i) {
                var frac = Math.max(0, d.value) / total, a1 = a0 + frac * Math.PI * 2;
                var large = a1 - a0 > Math.PI ? 1 : 0;
                var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2); };
                var dPath = frac >= 0.9999 ? 'M' + p(r, 0) + ' A' + r + ' ' + r + ' 0 1 1 ' + p(r, Math.PI) + ' A' + r + ' ' + r + ' 0 1 1 ' + p(r, 0) + 'Z'
                    : 'M' + (ir ? p(ir, a0) : cx + ' ' + cy) + ' L' + p(r, a0) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p(r, a1) + (ir ? ' L' + p(ir, a1) + ' A' + ir + ' ' + ir + ' 0 ' + large + ' 0 ' + p(ir, a0) : '') + 'Z';
                var path = el('path', { d: dPath, fill: d.color, class: 'els-mark', 'data-i': i, tabindex: '0', style: 'animation-delay:' + (i * 90) + 'ms' });
                marks.push(path);
                a0 = a1;
                // legend
                var ly = 40 + i * 30;
                el('rect', { x: 400, y: ly - 12, width: 16, height: 16, rx: 4, fill: d.color });
                el('text', { x: 426, y: ly + 1, class: 'els-chart-legend' }, d.label + ' — ' + Math.round(frac * 100) + '%');
            });
            if (ir) el('text', { x: cx, y: cy + 8, 'text-anchor': 'middle', class: 'els-chart-total' }, String(Math.round(total * 100) / 100) + unit);
            return { svg: svg, marks: marks, data: data };
        }
        var ordered = rtl ? data.slice().reverse() : data;
        var dataMax = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([cfg.max_value ? Number(cfg.max_value) : 0]));
        var step = niceStep(dataMax / 4), ticks = Math.max(1, Math.ceil(dataMax / step - 1e-9)), vmax = step * ticks;
        var horizontal = type === 'hbar';
        var padL = horizontal ? 150 : 56, padR = 24, padT = 24, padB = horizontal ? 36 : 64;
        var iw = W - padL - padR, ih = H - padT - padB;
        for (var g = 0; g <= ticks; g++) {
            var v = step * g;
            if (horizontal) {
                var gx = padL + iw * g / ticks;
                el('line', { x1: gx, y1: padT, x2: gx, y2: padT + ih, class: 'els-chart-grid' });
                el('text', { x: gx, y: H - 12, 'text-anchor': 'middle', class: 'els-chart-tick' }, String(Math.round(v * 100) / 100));
            } else {
                var gy = padT + ih - ih * g / ticks;
                el('line', { x1: padL, y1: gy, x2: W - padR, y2: gy, class: 'els-chart-grid' });
                el('text', { x: padL - 8, y: gy + 4, 'text-anchor': 'end', class: 'els-chart-tick' }, String(Math.round(v * 100) / 100));
            }
        }
        var n = ordered.length, slot = (horizontal ? ih : iw) / n;
        var pts = [];
        ordered.forEach(function (d, k) {
            var i = data.indexOf(d);
            var frac = Math.max(0, d.value) / vmax;
            if (horizontal) {
                var by = padT + k * slot + slot * 0.18, bh = slot * 0.64, bw = iw * frac;
                marks[i] = el('rect', { x: padL, y: by, width: Math.max(1, bw), height: bh, rx: 6, fill: d.color, class: 'els-mark is-hbar', 'data-i': i, tabindex: '0', style: 'animation-delay:' + (k * 70) + 'ms' });
                el('text', { x: padL - 10, y: by + bh / 2 + 5, 'text-anchor': 'end', class: 'els-chart-label' }, d.label);
                if (cfg.show_values !== false) el('text', { x: padL + bw + 8, y: by + bh / 2 + 5, class: 'els-chart-value' }, d.value + unit);
            } else {
                var cxp = padL + k * slot + slot / 2;
                var y = padT + ih - ih * frac;
                if (type === 'line') {
                    pts.push(cxp.toFixed(1) + ',' + y.toFixed(1));
                    marks[i] = el('circle', { cx: cxp, cy: y, r: 7, fill: d.color === PALETTE[i % PALETTE.length] ? 'var(--els-primary)' : d.color, class: 'els-mark is-point', 'data-i': i, tabindex: '0', style: 'animation-delay:' + (300 + k * 70) + 'ms' });
                } else {
                    var bw2 = Math.min(72, slot * 0.62);
                    marks[i] = el('rect', { x: cxp - bw2 / 2, y: y, width: bw2, height: Math.max(1, padT + ih - y), rx: 6, fill: d.color, class: 'els-mark is-bar', 'data-i': i, tabindex: '0', style: 'animation-delay:' + (k * 70) + 'ms' });
                }
                el('text', { x: cxp, y: H - padB + 22, 'text-anchor': 'middle', class: 'els-chart-label' }, d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label);
                if (cfg.show_values !== false) el('text', { x: cxp, y: y - 10, 'text-anchor': 'middle', class: 'els-chart-value' }, d.value + unit);
            }
        });
        if (type === 'line' && pts.length) {
            var line = el('polyline', { points: pts.join(' '), class: 'els-chart-line', fill: 'none' });
            svg.insertBefore(line, svg.querySelector('.els-mark'));
        }
        el('line', { x1: padL, y1: padT + ih, x2: W - padR, y2: padT + ih, class: 'els-chart-axis' });
        if (cfg.y_label) el('text', { x: 14, y: padT + ih / 2, transform: 'rotate(-90 14 ' + (padT + ih / 2) + ')', 'text-anchor': 'middle', class: 'els-chart-tick' }, cfg.y_label);
        return { svg: svg, marks: marks, data: data };
    };

    R.register({
        type: 'data_chart', label: 'Data chart', category: 'interactive', icon: ELS.icons.chart,
        description: 'Animated bar, line, pie or donut chart with tooltips, notes and a data table.',
        fields: [
            { key: 'prompt_html', label: 'Intro', type: 'html' },
            { key: 'chart_type', label: 'Chart type', type: 'select', default: 'bar', options: [
                { value: 'bar', label: 'Column' }, { value: 'hbar', label: 'Horizontal bar' }, { value: 'line', label: 'Line' }, { value: 'pie', label: 'Pie' }, { value: 'donut', label: 'Donut' }] },
            { key: 'data', label: 'Data points', type: 'list', minItems: 1, maxItems: 24, itemLabel: 'Point', fields: [
                { key: 'label', label: 'Label', type: 'text', required: true },
                { key: 'value', label: 'Value', type: 'number', required: true },
                { key: 'color', label: 'Colour (optional)', type: 'color' },
                { key: 'note', label: 'Note shown when selected', type: 'text' }
            ] },
            { key: 'unit', label: 'Unit suffix', type: 'text', help: 'E.g. "%", " t", " GW".' },
            { key: 'y_label', label: 'Axis title', type: 'text' },
            { key: 'max_value', label: 'Axis maximum (optional)', type: 'number' },
            { key: 'show_values', label: 'Show values on chart', type: 'bool', default: true },
            { key: 'caption', label: 'Caption / source', type: 'text' }
        ],
        template: {
            title: 'Global electricity from renewables', prompt_html: '<p>Select a bar to read more.</p>', chart_type: 'bar', unit: '%', y_label: 'Share of generation', show_values: true,
            data: [{ label: '2000', value: 18, note: 'Mostly hydropower.' }, { label: '2010', value: 20 }, { label: '2015', value: 23 }, { label: '2020', value: 28, note: 'Rapid growth of wind and solar.' }, { label: '2023', value: 30 }],
            caption: 'Illustrative figures for teaching purposes.'
        },
        validate: function (c) {
            var out = [];
            (c.data || []).forEach(function (d, i) { if (d.value !== undefined && d.value !== '' && !isFinite(Number(d.value))) out.push({ path: 'data[' + i + '].value', message: 'Value must be numeric.', level: 'error' }); });
            if ((c.chart_type === 'pie' || c.chart_type === 'donut') && (c.data || []).some(function (d) { return Number(d.value) < 0; })) out.push({ path: 'data', message: 'Pie charts cannot show negative values.', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var info = h('div.els-chart-info', { 'aria-live': 'polite' });
            var box = h('figure.els-chart');
            var built = null;
            function draw() {
                box.innerHTML = '';
                built = ELS.chartSvg(c, ctx.dir === 'rtl');
                box.appendChild(built.svg);
                if (c.caption) box.appendChild(h('figcaption', { text: c.caption }));
                built.marks.forEach(function (m, i) {
                    if (!m) return;
                    var d = built.data[i];
                    var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                    title.textContent = d.label + ': ' + d.value + (c.unit || '');
                    m.appendChild(title);
                    var pick = function () {
                        built.marks.forEach(function (x) { if (x) x.classList.toggle('is-dim', x !== m); });
                        info.innerHTML = '';
                        info.appendChild(h('strong', { text: d.label + ': ' + d.value + (c.unit || '') }));
                        if (d.note) info.appendChild(h('span', { text: ' — ' + d.note }));
                    };
                    m.addEventListener('click', pick); m.addEventListener('focus', pick);
                    m.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
                });
            }
            draw();
            ctx.el.appendChild(box);
            ctx.el.appendChild(info);
            var table = h('table.els-table', { hidden: true }, h('thead', h('tr', h('th', { text: t('label') }), h('th', { text: t('value') }))),
                h('tbody', (c.data || []).map(function (d) { return h('tr', h('td', { text: d.label }), h('td', { text: d.value + (c.unit || '') })); })));
            var toggle = ELS.ui.button(t('dataTable'), function () { table.hidden = !table.hidden; toggle.textContent = table.hidden ? t('dataTable') : t('hideTable'); toggle.setAttribute('aria-expanded', !table.hidden); }, 'link', { 'aria-expanded': 'false' });
            ctx.el.appendChild(h('div.els-actions', toggle));
            ctx.el.appendChild(table);
            ctx.onEnter(function () { draw(); }); // replay the entrance animation
        }
    });

    /* ================================================================== *
     * IMAGE COMPARE
     * ================================================================== */
    R.register({
        type: 'image_compare', label: 'Before / after', category: 'interactive', icon: ELS.icons.compare,
        description: 'Drag a slider to compare two images.',
        fields: [
            { key: 'prompt_html', label: 'Intro', type: 'html' },
            { key: 'before_image', label: 'Before image', type: 'image', required: true },
            { key: 'after_image', label: 'After image', type: 'image', required: true },
            { key: 'before_label', label: 'Before label', type: 'text' },
            { key: 'after_label', label: 'After label', type: 'text' },
            { key: 'alt', label: 'Description of the comparison (alt text)', type: 'text' },
            { key: 'start', label: 'Start position (%)', type: 'number', min: 0, max: 100, default: 50 },
            { key: 'caption', label: 'Caption', type: 'text' }
        ],
        template: {
            title: 'Restoring a forest', prompt_html: '<p>Drag the handle to compare the site before and after replanting.</p>',
            before_image: 'img/samples/forest-before.svg', after_image: 'img/samples/forest-after.svg', before_label: 'Before', after_label: 'After',
            alt: 'A bare hillside with stumps compared with the same hillside covered in young trees', start: 50, caption: 'Illustration.'
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var pos = util.clamp(Number(c.start) || 50, 0, 100);
            var after = h('img.els-cmp-img', { src: c.after_image || '', alt: c.alt || '', draggable: 'false' });
            var before = h('img.els-cmp-img', { src: c.before_image || '', alt: '', draggable: 'false' });
            var beforeWrap = h('div.els-cmp-before', before);
            var handle = h('div.els-cmp-handle', { 'aria-hidden': 'true' }, h('span', { html: ELS.icons.chevronL + ELS.icons.chevronR }));
            var range = h('input.els-cmp-range', { type: 'range', min: '0', max: '100', step: '1', value: String(pos), 'aria-label': (c.before_label || t('before')) + ' / ' + (c.after_label || t('after')), 'data-prevent-swipe': '' });
            var box = h('div.els-cmp', { dir: 'ltr', 'data-prevent-swipe': '' }, after, beforeWrap, handle,
                h('span.els-cmp-tag.is-before', { text: c.before_label || t('before') }), h('span.els-cmp-tag.is-after', { text: c.after_label || t('after') }), range);
            function set(p) {
                pos = p;
                beforeWrap.style.clipPath = 'inset(0 ' + (100 - p) + '% 0 0)';
                handle.style.left = p + '%';
                range.setAttribute('aria-valuetext', Math.round(p) + '%');
            }
            range.addEventListener('input', function () { set(Number(range.value)); });
            range.addEventListener('keydown', function (e) { e.stopPropagation(); }); // keep arrows for the slider, not slide navigation
            set(pos);
            ctx.el.appendChild(box);
            if (c.caption) ctx.el.appendChild(h('p.els-caption', { text: c.caption }));
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
