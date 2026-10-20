/**
 * ELS Player — renders a course (JSON) into the project's reveal.js engine,
 * adds the learner app chrome (top bar, contents drawer, bottom navigation),
 * wires screen contexts to the SCORM Tracker and supports:
 *   - resume (suspend data + location)
 *   - navigation gating, branching (goTo), exploration references
 *   - live preview from the authoring tool (postMessage, no LMS)
 *   - enhancing hand-written reveal.js decks (ELS.enhanceDeck)
 */
(function (root) {
    'use strict';
    var ELS = root.ELS = root.ELS || {};
    var util = ELS.util, h = ELS.h;

    function Player(course, opts) {
        this.opts = opts || {};
        this.preview = !!this.opts.preview;
        this.contexts = [];
        this.current = -1;
        this.allowJump = false;
        this.load(course, this.opts.startIndex);
    }
    var P = Player.prototype;

    /* ------------------------------------------------------------------ *
     * Setup
     * ------------------------------------------------------------------ */
    P.load = function (course, startIndex) {
        var self = this;
        this.course = ELS.normalizeCourse(util.clone(course));
        this.t = ELS.i18n(this.course.lang);
        this.applyTheme();
        if (!this.tracker || this.preview) {
            if (!this.adapter || this.preview) {
                this.adapter = ELS.SCORM.connect({
                    preview: this.preview, version: this.course.settings.scorm_version, key: this.course.id,
                    onError: util.debounce(function () { self.toast(self.t('lmsError'), 'warn'); }, 1500)
                });
            }
            this.tracker = new ELS.Tracker(this.course, this.adapter, { saveDelay: this.preview ? 0 : 400 });
            this.tracker.on(function () { self.updateChrome(); });
        }
        this.buildChrome();
        this.buildSlides();
        if (!this.revealReady) this.initReveal(startIndex);
        else {
            // Direction / transition may change between loads (live preview of another course).
            root.Reveal.configure({ rtl: this.course.dir === 'rtl', transition: this.course.settings.transition || 'slide' });
            root.Reveal.sync();
            this.go(startIndex || 0, true);
            this.onSlide(true);
        }
    };

    P.applyTheme = function () {
        var th = this.course.theme, de = document.documentElement;
        de.lang = this.course.lang;
        de.dir = this.course.dir;
        var vars = {
            '--els-primary': th.primary, '--els-primary-dark': th.primary_dark, '--els-accent': th.accent,
            '--els-bg': th.background, '--els-surface': th.surface, '--els-text': th.text,
            '--els-radius': (Number(th.radius) || 0) + 'px',
            '--els-font': '"' + th.font + '", "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif',
            '--els-heading-font': '"' + th.heading_font + '", "' + th.font + '", "Segoe UI", Tahoma, "Noto Sans Arabic", Arial, sans-serif'
        };
        Object.keys(vars).forEach(function (k) { de.style.setProperty(k, vars[k]); });
        document.body.classList.add('els-app');
        document.body.classList.toggle('els-rtl', this.course.dir === 'rtl');
        document.body.setAttribute('data-els-style', th.style || 'soft');
        if (!this.preview) document.title = this.course.title;
    };

    P.buildChrome = function () {
        var self = this, t = this.t, st = this.course.settings;
        if (!this.chrome) {
            var c = this.chrome = {};
            c.top = h('header.els-topbar', { role: 'banner' });
            c.menuBtn = h('button.els-icon-btn', { type: 'button', 'aria-label': t('menu'), 'aria-expanded': 'false', html: ELS.icons.menu, onclick: function () { self.toggleMenu(); } });
            c.title = h('div.els-topbar-title');
            c.courseTitle = h('strong');
            c.screenLabel = h('span.els-topbar-sub');
            c.title.appendChild(c.courseTitle); c.title.appendChild(c.screenLabel);
            c.score = h('span.els-chip.els-score-chip', { hidden: true });
            c.progress = ELS.ui.meter(t('progress'));
            c.progress.el.classList.add('els-top-progress');
            c.top.appendChild(c.menuBtn); c.top.appendChild(c.title); c.top.appendChild(c.score); c.top.appendChild(c.progress.el);

            c.nav = h('nav.els-nav', { 'aria-label': 'Screen navigation' });
            c.prev = h('button.els-btn.ghost.els-nav-prev', { type: 'button', onclick: function () { self.prev(); } });
            c.next = h('button.els-btn.primary.els-nav-next', { type: 'button', onclick: function () { self.next(); } });
            c.counter = h('span.els-nav-counter', { 'aria-live': 'off' });
            c.dots = h('div.els-nav-dots', { 'aria-hidden': 'true' });
            c.nav.appendChild(c.prev); c.nav.appendChild(h('div.els-nav-mid', c.dots, c.counter)); c.nav.appendChild(c.next);

            c.drawer = h('aside.els-drawer', { 'aria-label': t('menu'), hidden: true });
            c.scrim = h('div.els-scrim', { hidden: true, onclick: function () { self.toggleMenu(false); } });
            c.live = h('div.els-sr-only', { 'aria-live': 'polite', role: 'status' });
            c.toasts = h('div.els-toasts', { 'aria-live': 'assertive' });

            var reveal = document.querySelector('.reveal');
            document.body.insertBefore(c.top, document.body.firstChild);
            reveal.parentNode.insertBefore(c.nav, reveal.nextSibling);
            document.body.appendChild(c.scrim);
            document.body.appendChild(c.drawer);
            document.body.appendChild(c.live);
            document.body.appendChild(c.toasts);
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !c.drawer.hidden) self.toggleMenu(false); });
        }
        var c2 = this.chrome;
        c2.prev.innerHTML = ELS.icons[this.course.dir === 'rtl' ? 'chevronR' : 'chevronL'] + '<span>' + util.esc(t('prev')) + '</span>';
        c2.next.innerHTML = '<span>' + util.esc(t('next')) + '</span>' + ELS.icons[this.course.dir === 'rtl' ? 'chevronL' : 'chevronR'];
        c2.courseTitle.textContent = this.course.title;
        c2.menuBtn.hidden = st.show_menu === false;
        c2.progress.el.hidden = st.show_progress === false;
        document.body.classList.toggle('els-has-nav', true);
    };

    /* ------------------------------------------------------------------ *
     * Slides
     * ------------------------------------------------------------------ */
    P.destroyContexts = function () {
        this.contexts.forEach(function (ctx) {
            ctx._leave.forEach(function (fn) { try { fn(); } catch (e) { } });
            ctx._destroy.forEach(function (fn) { try { fn(); } catch (e) { } });
        });
        this.contexts = [];
    };

    P.buildSlides = function () {
        var self = this;
        this.destroyContexts();
        var slides = document.querySelector('.reveal .slides');
        slides.innerHTML = '';
        this.sections = [];
        this.menuItems = null; // rebuilt below; screens may call ctx.complete() while rendering
        this.course.screens.forEach(function (screen, i) {
            var sec = self.renderScreen(screen, i);
            slides.appendChild(sec);
            self.sections.push(sec);
        });
        if (!this.course.screens.length) {
            slides.appendChild(h('section.els-screen', h('div.els-screen-inner', h('div.els-empty', { text: 'This course has no screens yet.' }))));
        }
        this.buildMenu();
    };

    P.renderScreen = function (screen, index) {
        var self = this, def = ELS.registry.get(screen.type);
        var sec = h('section.els-screen.els-type-' + screen.type, { id: 's-' + screen.id, 'data-els-id': screen.id, 'data-els-type': screen.type });
        this.applyBackground(sec, screen.background);
        var inner = h('div.els-screen-inner');
        sec.appendChild(inner);
        var ctx = this.makeContext(screen, index, sec, inner);
        this.contexts[index] = ctx;
        if (!def) {
            inner.appendChild(h('div.els-error', { text: 'Unknown screen type: ' + screen.type }));
            return sec;
        }
        if (!def.customHeader && !screen.hide_header) {
            var head = h('header.els-screen-head');
            if (screen.kicker) head.appendChild(h('p.els-kicker', { text: screen.kicker }));
            head.appendChild(h('h2.els-title', { text: screen.title || '', tabindex: '-1' }));
            if (screen.lead) head.appendChild(h('p.els-lead', { text: screen.lead }));
            if (ELS.registry.isScored(screen) && this.course.settings.show_score !== false) {
                head.appendChild(h('span.els-chip.els-points-chip', { html: ELS.icons.star + '<span>' + util.esc(this.t('points', { n: ctx.maxPoints })) + '</span>' }));
            }
            inner.appendChild(head);
        }
        var body = h('div.els-body');
        inner.appendChild(body);
        ctx.el = body;
        try { def.render(ctx); }
        catch (e) {
            body.appendChild(h('div.els-error', { text: 'This screen could not be displayed: ' + e.message }));
            if (root.console) console.error('[ELS] render failed for', screen.id, e);
        }
        if (screen.notes) sec.appendChild(h('aside.notes', { text: screen.notes }));
        return sec;
    };

    P.applyBackground = function (sec, bg) {
        if (!bg) return;
        if (typeof bg === 'string') bg = /^(#|rgb|hsl)/.test(bg) ? { color: bg } : { image: bg };
        var layers = [];
        // "Dark" without a colour or image falls back to the theme's deep colour so light text stays readable.
        if (bg.dark && !bg.image && !bg.color) layers.push('linear-gradient(135deg, var(--els-primary-dark), var(--els-primary))');
        if (bg.image && bg.dark) layers.push('linear-gradient(rgba(8,20,32,.62), rgba(8,20,32,.62))');
        if (bg.image) layers.push('url("' + String(bg.image).replace(/"/g, '%22') + '") center / cover no-repeat');
        if (bg.color) layers.push(bg.color);
        if (layers.length) sec.style.background = layers.join(', ');
        if (bg.dark) sec.classList.add('els-on-dark');
    };

    P.makeContext = function (screen, index, sec, inner) {
        var self = this, tracker = this.tracker;
        var seedBase = this.course.settings.shuffle_seed;
        var ctx = {
            id: screen.id, cfg: screen, index: index, course: this.course, screens: this.course.screens,
            t: this.t, lang: this.course.lang, dir: this.course.dir, section: sec, inner: inner, preview: this.preview,
            saved: tracker.result(screen.id), maxPoints: ELS.registry.maxPoints(screen),
            _enter: [], _leave: [], _destroy: [],
            rng: function (salt) { return util.rng(seedBase ? seedBase + ':' + screen.id + ':' + (salt || '') : undefined); },
            score: function (r) { tracker.record(screen.id, r); self.updateChrome(); },
            complete: function () { tracker.complete(screen.id); self.updateChrome(); },
            isDone: function () { return tracker.isDone(screen.id); },
            store: function (data) { tracker.setVar('_' + screen.id, data); },
            stored: function () { return tracker.getVar('_' + screen.id); },
            setVar: function (k, v) { tracker.setVar(k, v); },
            getVar: function (k) { return tracker.getVar(k); },
            totals: function () { return tracker.totals(); },
            resultOf: function (id) { return tracker.result(id); },
            isDoneId: function (id) { return tracker.isDone(id); },
            goTo: function (id) { var i = tracker.screenIndex(id); if (i >= 0) self.go(i, true); return i >= 0; },
            goToIndex: function (i) { self.go(i, true); },
            next: function () { self.next(true); },
            onEnter: function (fn) { ctx._enter.push(fn); },
            onLeave: function (fn) { ctx._leave.push(fn); },
            onDestroy: function (fn) { ctx._destroy.push(fn); },
            toast: function (m, k) { self.toast(m, k); },
            isActive: function () { return self.current === index; },
            restart: function () { self.restart(); }
        };
        return ctx;
    };

    /* ------------------------------------------------------------------ *
     * reveal.js integration
     * ------------------------------------------------------------------ */
    P.initReveal = function (startIndex) {
        var self = this, R = root.Reveal;
        var st = this.course.settings;
        // reveal.js dispatches a synthetic bubbling "resize" event from its wrapper; if it reaches
        // window it re-triggers layout (and loops forever while the stage has zero size).
        var wrapper = document.querySelector('.reveal');
        wrapper.addEventListener('resize', function (e) { if (e.target === wrapper) e.stopPropagation(); });
        ELS.guardKeys(wrapper);
        R.initialize({
            width: '100%', height: '100%', margin: 0, minScale: 1, maxScale: 1, center: false,
            controls: false, progress: false, slideNumber: false, hash: false, history: false,
            overview: false, help: false, rtl: this.course.dir === 'rtl', transition: st.transition || 'slide',
            transitionSpeed: 'default', backgroundTransition: 'fade', keyboard: true, touch: true,
            fragments: false, pause: false, autoPlayMedia: false,
            dependencies: this.opts.dependencies || []
        });
        R.addEventListener('ready', function () {
            self.revealReady = true;
            var target = startIndex || 0;
            // Capture the saved location before the first visit() overwrites it.
            var resumeAt = !self.preview && self.tracker.resumed && self.tracker.state.l > 0 && startIndex === undefined ? self.tracker.state.l : 0;
            if (!resumeAt && target) self.go(target, true);
            self.onSlide(true);
            if (resumeAt) self.askResume(resumeAt);
            if (self.preview && root.parent !== root) root.parent.postMessage({ type: 'els:ready' }, '*');
        });
        R.addEventListener('slidechanged', function () { self.onSlide(); });
        if (!this.preview) {
            var fin = function () { self.tracker.finish(); };
            root.addEventListener('pagehide', fin);
            root.addEventListener('beforeunload', fin);
            root.addEventListener('unload', fin);
            document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') self.tracker.flush(); });
        }
    };

    P.indexNow = function () { var ix = root.Reveal.getIndices(); return ix ? ix.h : 0; };

    P.isBlocking = function (i) {
        var s = this.course.screens[i], gate = this.course.settings.gate;
        if (!s || gate === 'none' || !gate) return false;
        if (this.tracker.isDone(s.id)) return false;
        if (gate === 'scored') return ELS.registry.isScored(s);
        return ELS.registry.requiresInteraction(s);
    };
    /** Furthest index the learner may reach linearly. */
    P.maxReachable = function () {
        for (var i = 0; i < this.course.screens.length; i++) if (this.isBlocking(i)) return i;
        return this.course.screens.length - 1;
    };

    P.onSlide = function (silent) {
        var idx = this.indexNow(), prev = this.current;
        // Gate: undo forward navigation past an incomplete required activity (keyboard/swipe).
        if (!this.allowJump && prev >= 0 && idx > prev && idx > this.maxReachable()) {
            this.toast(this.t('locked'), 'warn');
            this.allowJump = true;
            root.Reveal.slide(prev); // stay on the screen the learner was on
            this.allowJump = false;
            return;
        }
        this.allowJump = false;
        if (prev === idx && !silent) return;
        if (prev >= 0 && this.contexts[prev] && prev !== idx) this.contexts[prev]._leave.forEach(function (fn) { try { fn(); } catch (e) { } });
        this.current = idx;
        var ctx = this.contexts[idx];
        if (!ctx) { this.updateChrome(); return; }
        this.tracker.visit(ctx.id, idx);
        this.fillRefs(ctx.section);
        ctx._enter.forEach(function (fn) { try { fn(); } catch (e) { if (root.console) console.error(e); } });
        this.updateChrome();
        var sec = ctx.section;
        sec.scrollTop = 0;
        var head = sec.querySelector('.els-title, h1, h2');
        if (head && !silent) {
            if (!head.hasAttribute('tabindex')) head.setAttribute('tabindex', '-1');
            try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); }
        }
        this.chrome.live.textContent = this.t('of', { a: idx + 1, b: this.course.screens.length }) + ': ' + (ctx.cfg.title || '');
        if (this.preview && root.parent !== root) root.parent.postMessage({ type: 'els:slide', index: idx }, '*');
    };

    P.go = function (i, force) {
        i = util.clamp(i, 0, Math.max(0, this.course.screens.length - 1));
        if (force) this.allowJump = true;
        root.Reveal.slide(i);
        if (force) setTimeout(function (self) { self.allowJump = false; }, 0, this);
    };
    P.next = function (force) {
        var i = this.indexNow();
        if (!force && this.isBlocking(i)) {
            this.toast(this.t('locked'), 'warn');
            var sec = this.sections[i];
            ELS.anim.pulse(sec && sec.querySelector('.els-actions, .els-body'), 'els-shake');
            return;
        }
        this.go(i + 1, true);
    };
    P.prev = function () { this.go(this.indexNow() - 1, true); };

    /** Fill <span data-exploration-ref="key"> with stored learner input. */
    P.fillRefs = function (scope) {
        var tracker = this.tracker;
        Array.prototype.forEach.call(scope.querySelectorAll('[data-exploration-ref]'), function (el) {
            var v = tracker.getVar('x:' + el.getAttribute('data-exploration-ref'));
            el.textContent = v === undefined || v === null || v === '' ? '—' : (Array.isArray(v) ? v.join(', ') : String(v));
            el.classList.add('els-ref');
        });
    };

    /* ------------------------------------------------------------------ *
     * Chrome updates
     * ------------------------------------------------------------------ */
    P.updateChrome = function () {
        if (!this.chrome || !this.tracker) return;
        var c = this.chrome, t = this.t, tot = this.tracker.totals(), n = this.course.screens.length, i = Math.max(0, this.current);
        var s = this.course.screens[i];
        c.screenLabel.textContent = s ? ((s.section ? s.section + ' · ' : '') + t('of', { a: i + 1, b: n })) : '';
        c.progress.set(tot.progress * 100);
        c.prev.disabled = i <= 0;
        c.next.disabled = i >= n - 1;
        c.next.classList.toggle('is-blocked', this.isBlocking(i));
        c.counter.textContent = t('of', { a: Math.min(i + 1, n), b: n });
        if (tot.scored && this.course.settings.show_score !== false) {
            c.score.hidden = false;
            c.score.innerHTML = ELS.icons.star + '<span>' + Math.round(tot.pct) + '%</span>';
            c.score.title = t('score');
        } else c.score.hidden = true;
        // progress dots (compact for long courses)
        if (c.dots.children.length !== n) {
            c.dots.innerHTML = '';
            for (var k = 0; k < n; k++) c.dots.appendChild(h('i'));
        }
        var self = this;
        Array.prototype.forEach.call(c.dots.children, function (d, k) {
            var sc = self.course.screens[k];
            d.className = (k === i ? 'is-current ' : '') + (sc && self.tracker.isDone(sc.id) ? 'is-done' : '');
        });
        this.updateMenu();
    };

    P.buildMenu = function () {
        var self = this, c = this.chrome, t = this.t;
        c.drawer.innerHTML = '';
        var head = h('div.els-drawer-head', h('strong', { text: this.course.title }),
            h('button.els-icon-btn', { type: 'button', 'aria-label': t('close'), html: ELS.icons.cross, onclick: function () { self.toggleMenu(false); } }));
        c.drawer.appendChild(head);
        c.drawerStatus = h('div.els-drawer-status');
        c.drawer.appendChild(c.drawerStatus);
        var list = h('ol.els-toc');
        var lastSection = null;
        this.menuItems = [];
        this.course.screens.forEach(function (s, i) {
            if (s.section && s.section !== lastSection) {
                list.appendChild(h('li.els-toc-section', { text: s.section }));
                lastSection = s.section;
            }
            var def = ELS.registry.get(s.type);
            var btn = h('button.els-toc-item', { type: 'button', onclick: function () { if (i <= self.maxReachable() || self.tracker.state.vis[s.id]) { self.go(i, true); self.toggleMenu(false); } else self.toast(t('locked'), 'warn'); } },
                h('span.els-toc-icon', { html: def ? def.icon || '' : '' }),
                h('span.els-toc-text', { text: s.title || s.id }),
                h('span.els-toc-state'));
            self.menuItems.push(btn);
            list.appendChild(h('li', btn));
        });
        c.drawer.appendChild(list);
    };

    P.updateMenu = function () {
        if (!this.menuItems) return;
        var self = this, tot = this.tracker.totals(), t = this.t, reach = this.maxReachable();
        this.menuItems.forEach(function (btn, i) {
            var s = self.course.screens[i];
            if (!s) return;
            var done = self.tracker.isDone(s.id), cur = i === self.current;
            btn.classList.toggle('is-current', cur);
            btn.classList.toggle('is-done', done);
            btn.classList.toggle('is-locked', i > reach && !self.tracker.state.vis[s.id]);
            if (cur) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
            btn.querySelector('.els-toc-state').innerHTML = done ? ELS.icons.check : (i > reach ? ELS.icons.lock : '');
        });
        var status = tot.complete ? (tot.success === 'failed' ? t('failed') : (tot.success === 'passed' && tot.scored ? t('passed') : t('completed'))) : t('incomplete');
        this.chrome.drawerStatus.textContent = t('progress') + ': ' + Math.round(tot.progress * 100) + '% · ' + status + (tot.scored ? ' · ' + t('score') + ': ' + Math.round(tot.pct) + '%' : '');
    };

    P.toggleMenu = function (force) {
        var c = this.chrome, open = force === undefined ? c.drawer.hidden : force;
        c.drawer.hidden = !open; c.scrim.hidden = !open;
        c.menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('els-menu-open', open);
        if (open) { var cur = c.drawer.querySelector('.is-current') || c.drawer.querySelector('button'); if (cur) cur.focus(); }
        else c.menuBtn.focus();
    };

    P.toast = function (msg, kind) {
        if (!this.chrome) return;
        var el = h('div.els-toast.is-' + (kind || 'info'), { text: msg });
        this.chrome.toasts.appendChild(el);
        setTimeout(function () { el.classList.add('is-out'); }, 2600);
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
    };

    P.askResume = function (at) {
        var self = this, t = this.t;
        var dlg = h('div.els-modal', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'els-resume-title' });
        var box = h('div.els-modal-box',
            h('h2#els-resume-title', { text: t('resumeTitle') }),
            h('p', { text: t('resumeText') }),
            h('div.els-actions',
                ELS.ui.button(t('resume'), function () { close(); self.go(at, true); }, 'primary'),
                ELS.ui.button(t('restart'), function () { close(); self.restart(); }, 'ghost')));
        dlg.appendChild(box);
        document.body.appendChild(dlg);
        box.querySelector('button').focus();
        function close() { dlg.parentNode.removeChild(dlg); }
    };

    P.restart = function () {
        this.tracker.reset();
        this.current = -1;
        this.buildSlides();
        root.Reveal.sync();
        this.go(0, true);
        this.onSlide(true);
    };

    ELS.Player = Player;

    /**
     * reveal.js listens for Space/arrows on document to change slides. Keys aimed at a
     * focused control (button activation, select/video arrows) must stay with that control.
     */
    ELS.guardKeys = function (wrapper) {
        if (!wrapper || wrapper._elsGuard) return;
        wrapper._elsGuard = true;
        wrapper.addEventListener('keydown', function (e) {
            var t = e.target;
            if (!t || t === wrapper || t.tagName === 'SECTION') return;
            var tag = t.tagName;
            var control = /^(BUTTON|A|SELECT|SUMMARY|VIDEO|AUDIO|IFRAME|INPUT|TEXTAREA|LABEL)$/.test(tag) || t.isContentEditable || (t.hasAttribute && t.hasAttribute('role'));
            if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') { if (control) e.stopPropagation(); return; }
            if (/^Arrow|^Page|^Home$|^End$/.test(e.key) && /^(SELECT|VIDEO|AUDIO)$/.test(tag)) e.stopPropagation();
        });
    };

    /* ------------------------------------------------------------------ *
     * Boot helper for course.html / exported packages
     *   ELS.boot({ preview: bool })
     * Course source (first match): window.ELS_COURSES[?course=name] → 'course' → 'sample-en'
     * ------------------------------------------------------------------ */
    ELS.boot = function (opts) {
        opts = opts || {};
        var q = {};
        (root.location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
            if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
        });
        var preview = opts.preview || q.preview === '1';
        var dependencies = [{ src: 'plugin/notes/notes.js', async: true }];
        if (preview) {
            var player = null, pending = null;
            root.addEventListener('message', function (e) {
                if (e.source !== root.parent || !e.data || typeof e.data !== 'object') return;
                if (e.data.type === 'els:course') {
                    if (!player) player = ELS.player = new Player(e.data.course, { preview: true, startIndex: e.data.index || 0, dependencies: [] });
                    else if (!player.revealReady) pending = e.data;
                    else player.load(e.data.course, e.data.index || 0);
                } else if (e.data.type === 'els:goto' && player && player.revealReady) {
                    player.go(e.data.index, true);
                } else if (e.data.type === 'els:restart' && player && player.revealReady) {
                    player.restart();
                }
            });
            var poll = setInterval(function () {
                if (player && player.revealReady && pending) { player.load(pending.course, pending.index || 0); pending = null; }
                if (player && player.revealReady && !pending) clearInterval(poll);
            }, 100);
            if (root.parent !== root) root.parent.postMessage({ type: 'els:hello' }, '*');
            return null;
        }
        var store = root.ELS_COURSES || {};
        if (q.course === '__author') {
            // Opened from the authoring tool ("Preview" / LMS test harness): same-origin localStorage hand-off.
            try { store.__author = JSON.parse(root.localStorage.getItem('els-author-preview')); } catch (e) { store.__author = null; }
        }
        var name = q.course && /^[A-Za-z0-9_\-]+$/.test(q.course) ? q.course : null;
        function start() {
            var course = (name && store[name]) || store.course || store['sample-en'];
            if (!course) { document.body.appendChild(h('div.els-error', { text: 'No course data found.' })); return; }
            ELS.player = new Player(course, { dependencies: dependencies });
        }
        if (name && !store[name]) {
            // Load courses/<name>.js on demand (only simple names are accepted).
            var s = document.createElement('script');
            s.src = 'courses/' + name + '.js';
            s.onload = function () { store = root.ELS_COURSES || {}; start(); };
            s.onerror = function () { name = null; start(); };
            document.head.appendChild(s);
        } else start();
        return true;
    };

    /* ------------------------------------------------------------------ *
     * Enhance an existing hand-written reveal.js deck:
     *   <section data-els-type="mcq"><script type="application/json">{...}</script></section>
     * Call after Reveal.initialize (see docs/SCREEN_TYPES.md).
     * ------------------------------------------------------------------ */
    ELS.enhanceDeck = function (opts) {
        opts = opts || {};
        var secs = Array.prototype.slice.call(document.querySelectorAll('.reveal .slides section[data-els-type]'));
        var screens = secs.map(function (sec, i) {
            var cfg = {};
            var js = sec.querySelector('script[type="application/json"]');
            if (js) { try { cfg = JSON.parse(js.textContent); } catch (e) { cfg = { title: 'Invalid JSON' }; } }
            cfg.type = sec.getAttribute('data-els-type');
            cfg.id = cfg.id || sec.id || ('els-' + (i + 1));
            return cfg;
        });
        var course = ELS.normalizeCourse({ id: opts.id || document.title, title: document.title, lang: document.documentElement.lang || 'en', settings: opts.settings || {}, screens: screens });
        course.settings.completion_rule = 'all_viewed';
        var t = ELS.i18n(course.lang);
        var adapter = ELS.SCORM.connect({ version: course.settings.scorm_version, key: course.id });
        var tracker = new ELS.Tracker(course, adapter);
        var fake = { course: course, t: t, preview: false, tracker: tracker, current: -1, toast: function (m) { if (root.console) console.info(m); },
            go: function (i) { var s = secs[i]; if (s && root.Reveal) { var ix = root.Reveal.getIndices(s); root.Reveal.slide(ix.h, ix.v); } },
            next: function () { root.Reveal.next(); }, updateChrome: function () { }, restart: function () { tracker.reset(); } };
        var ctxs = [];
        document.body.classList.add('els-enhanced');
        ELS.guardKeys(document.querySelector('.reveal'));
        screens.forEach(function (screen, i) {
            var sec = secs[i];
            Array.prototype.slice.call(sec.childNodes).forEach(function (n) { if (n.nodeName === 'SCRIPT') sec.removeChild(n); });
            sec.classList.add('els-screen', 'els-type-' + screen.type);
            var inner = h('div.els-screen-inner');
            sec.appendChild(inner);
            var ctx = P.makeContext.call(fake, screen, i, sec, inner);
            var def = ELS.registry.get(screen.type);
            if (!def.customHeader && screen.title) inner.appendChild(h('header.els-screen-head', h('h2.els-title', { text: screen.title })));
            ctx.el = h('div.els-body');
            inner.appendChild(ctx.el);
            try { def.render(ctx); } catch (e) { ctx.el.appendChild(h('div.els-error', { text: e.message })); }
            ctxs.push(ctx);
        });
        if (root.Reveal) {
            var onChange = function (ev) {
                var i = secs.indexOf(ev.currentSlide);
                ctxs.forEach(function (c, k) { if (k !== i) c._leave.forEach(function (fn) { fn(); }); });
                if (i >= 0) { tracker.visit(ctxs[i].id, i); P.fillRefs.call(fake, secs[i]); ctxs[i]._enter.forEach(function (fn) { fn(); }); }
            };
            root.Reveal.addEventListener('slidechanged', onChange);
            if (root.Reveal.isReady()) onChange({ currentSlide: root.Reveal.getCurrentSlide() });
            else root.Reveal.addEventListener('ready', onChange);
        }
        root.addEventListener('pagehide', function () { tracker.finish(); });
        root.addEventListener('beforeunload', function () { tracker.finish(); });
        return { course: course, tracker: tracker, contexts: ctxs };
    };
})(typeof window !== 'undefined' ? window : globalThis);
