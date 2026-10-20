/**
 * Advanced & specialised screens: lottie, results_breakdown, poll, embed_html.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    /** Base URL of the project (folder that contains js/els/core.js). */
    ELS.basePath = function () {
        if (ELS._base !== undefined) return ELS._base;
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src') || '';
            var k = src.indexOf('js/els/core.js');
            if (k >= 0) return (ELS._base = src.slice(0, k));
        }
        return (ELS._base = '');
    };
    var loading = {};
    ELS.loadScript = function (src) {
        if (loading[src]) return loading[src];
        loading[src] = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src; s.async = true;
            s.onload = function () { resolve(); };
            s.onerror = function () { delete loading[src]; reject(new Error('Could not load ' + src)); };
            document.head.appendChild(s);
        });
        return loading[src];
    };

    function decodeJsonSource(src) {
        if (!src) return null;
        if (typeof src === 'object') return src;
        var s = String(src).trim();
        if (s.charAt(0) === '{') return JSON.parse(s);
        var m = /^data:[^,]*?(;base64)?,(.*)$/.exec(s);
        if (m) {
            var txt = m[1] ? decodeURIComponent(escape(atob(m[2]))) : decodeURIComponent(m[2]);
            return JSON.parse(txt);
        }
        return null; // a URL
    }
    ELS.decodeJsonSource = decodeJsonSource;

    /* ================================================================== *
     * LOTTIE
     * ================================================================== */
    R.register({
        type: 'lottie', label: 'Lottie animation', category: 'advanced', icon: ELS.icons.lottie,
        description: 'Vector animation (Lottie/Bodymovin JSON) with playback controls.',
        fields: [
            { key: 'lottie_src', label: 'Lottie JSON (URL or upload)', type: 'lottie', required: true },
            { key: 'alt', label: 'Description of the animation (for screen readers)', type: 'text' },
            { key: 'body_html', label: 'Text', type: 'html' },
            { key: 'layout', label: 'Layout', type: 'select', default: 'center', options: [{ value: 'center', label: 'Animation centred, text below' }, { value: 'side', label: 'Text beside animation' }] },
            { key: 'loop', label: 'Loop', type: 'bool', default: true },
            { key: 'autoplay', label: 'Autoplay', type: 'bool', default: true },
            { key: 'controls', label: 'Show play/pause and scrubber', type: 'bool', default: true },
            { key: 'speed', label: 'Speed', type: 'number', min: 0.1, max: 4, step: 0.1, default: 1 },
            { key: 'caption', label: 'Caption', type: 'text' }
        ],
        template: {
            title: 'How energy flows', lottie_src: 'media/sample-lottie.json', alt: 'A pulsing sun sends energy rings outward', layout: 'side',
            body_html: '<p>Sunlight reaches Earth as waves of energy. Solar panels capture part of it and convert it into electricity.</p>', loop: true, autoplay: true, controls: true, speed: 1
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            var holder = h('div.els-lottie', { role: 'img', 'aria-label': c.alt || c.title || 'Animation' });
            var controls = h('div.els-lottie-controls');
            var fig = h('figure.els-lottie-fig', holder, c.controls !== false ? controls : null, c.caption ? h('figcaption', { text: c.caption }) : null);
            var wrap = h('div.els-layout.is-' + (c.layout === 'side' ? 'media_text' : 'full_media'), fig, !util.isEmpty(c.body_html) ? h('div.els-prose', { html: c.body_html }) : null);
            ctx.el.appendChild(wrap);
            var anim = null, playing = false;
            var reduce = util.prefersReducedMotion();
            var playBtn = ELS.ui.button(ELS.icons.play, function () { if (!anim) return; if (playing) { anim.pause(); } else { anim.play(); } setPlaying(!playing); }, 'icon', { 'aria-label': t('play') });
            var scrub = h('input.els-slider', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': t('progress'), 'data-prevent-swipe': '' });
            scrub.addEventListener('input', function () { if (!anim) return; anim.goToAndStop(Number(scrub.value) / 100 * (anim.totalFrames - 1), true); setPlaying(false); });
            scrub.addEventListener('keydown', function (e) { e.stopPropagation(); });
            controls.appendChild(playBtn); controls.appendChild(scrub);
            function setPlaying(p) { playing = p; playBtn.innerHTML = p ? ELS.icons.pause : ELS.icons.play; playBtn.setAttribute('aria-label', p ? t('pause') : t('play')); }
            var data;
            try { data = decodeJsonSource(c.lottie_src); } catch (e) { holder.appendChild(h('div.els-error', { text: 'Invalid Lottie JSON: ' + e.message })); return; }
            var lib = root.lottie ? Promise.resolve() : ELS.loadScript(ELS.basePath() + 'lib/js/lottie_light.min.js');
            lib.then(function () {
                if (!root.lottie) throw new Error('Lottie library missing');
                var opts = { container: holder, renderer: 'svg', loop: c.loop !== false, autoplay: false, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } };
                if (data) opts.animationData = data; else opts.path = c.lottie_src;
                anim = root.lottie.loadAnimation(opts);
                anim.setSpeed(Number(c.speed) || 1);
                anim.addEventListener('enterFrame', function () { if (anim.totalFrames) scrub.value = String(Math.round(anim.currentFrame / (anim.totalFrames - 1) * 100)); });
                anim.addEventListener('complete', function () { setPlaying(false); });
                anim.addEventListener('DOMLoaded', function () { if (ctx.isActive() && c.autoplay !== false && !reduce) { anim.play(); setPlaying(true); } });
                anim.addEventListener('data_failed', function () { holder.appendChild(h('div.els-error', { text: 'Could not load the animation file.' })); });
            }).catch(function (e) { holder.appendChild(h('div.els-error', { text: e.message })); });
            ctx.onEnter(function () { if (anim && c.autoplay !== false && !reduce) { anim.goToAndPlay(0, true); setPlaying(true); } });
            ctx.onLeave(function () { if (anim) { anim.pause(); setPlaying(false); } });
            ctx.onDestroy(function () { if (anim) anim.destroy(); });
        }
    });

    /* ================================================================== *
     * RESULTS BREAKDOWN
     * ================================================================== */
    R.register({
        type: 'results_breakdown', label: 'Results breakdown', category: 'advanced', icon: ELS.icons.results,
        description: 'Per-topic performance analytics with targeted review advice.',
        fields: [
            { key: 'body_html', label: 'Intro', type: 'html' },
            { key: 'sections', label: 'Topics', type: 'list', minItems: 1, itemLabel: 'Topic', fields: [
                { key: 'title', label: 'Topic name', type: 'text', required: true },
                { key: 'screen_ids', label: 'Scored screens in this topic', type: 'screens', scoredOnly: true },
                { key: 'advice_html', label: 'Advice when weak', type: 'html' }
            ] },
            { key: 'weak_threshold', label: 'Weak below (%)', type: 'number', min: 0, max: 100, default: 60 },
            { key: 'show_total', label: 'Show overall result', type: 'bool', default: true }
        ],
        template: {
            title: 'Your results by topic', body_html: '<p>See where you are strong and what to review.</p>', weak_threshold: 60, show_total: true,
            sections: [{ title: 'Knowledge check', screen_ids: [], advice_html: '<p>Revisit the content screens before trying again.</p>' }]
        },
        validate: function (c, course) {
            var out = [];
            (c.sections || []).forEach(function (s, i) {
                (s.screen_ids || []).forEach(function (id) {
                    var sc = ((course && course.screens) || []).filter(function (x) { return x.id === id; })[0];
                    if (!sc) out.push({ path: 'sections[' + i + '].screen_ids', message: 'Topic "' + s.title + '" references missing screen "' + id + '".', level: 'error' });
                    else if (!R.isScored(sc)) out.push({ path: 'sections[' + i + '].screen_ids', message: 'Screen "' + id + '" is not scored.', level: 'warning' });
                });
                if (!(s.screen_ids || []).length) out.push({ path: 'sections[' + i + '].screen_ids', message: 'Topic "' + (s.title || i + 1) + '" has no screens yet.', level: 'warning' });
            });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            if (c.body_html) ctx.el.appendChild(ELS.ui.prompt(c.body_html));
            var live = h('div.els-results');
            ctx.el.appendChild(live);
            var weakAt = c.weak_threshold === undefined ? 60 : Number(c.weak_threshold);
            function draw() {
                live.innerHTML = '';
                var tot = ctx.totals();
                if (c.show_total !== false && tot.scored) {
                    live.appendChild(h('div.els-summary-row', ELS.ui.ring(tot.pct, t('overall')),
                        h('div.els-summary-facts', h('p.els-fact-line', { text: t('pointsOf', { a: Math.round(tot.score * 10) / 10, b: tot.max }) }),
                            h('p.els-muted', { text: t('passMark', { n: tot.mastery }) }))));
                }
                var grid = h('div.els-results-grid');
                (c.sections || []).forEach(function (s) {
                    var got = 0, max = 0, attempted = 0;
                    (s.screen_ids || []).forEach(function (id) {
                        var sc = ctx.screens.filter(function (x) { return x.id === id; })[0];
                        if (!sc || !R.isScored(sc)) return;
                        var m = R.maxPoints(sc), r = ctx.resultOf(id);
                        max += m; if (r) { got += Math.min(r.s, m); attempted++; }
                    });
                    var pct = max ? Math.round(got / max * 100) : 0;
                    var weak = attempted > 0 && pct < weakAt;
                    var none = attempted === 0;
                    var card = h('div.els-result-card' + (weak ? '.is-weak' : none ? '.is-none' : '.is-strong'),
                        h('div.els-result-head', h('strong', { text: s.title }), h('span.els-badge', { text: none ? t('notAttempted') : weak ? t('needsWork') : t('strong') })),
                        h('div.els-result-bar', h('i', { style: { width: '0%' } })),
                        h('span.els-result-pct', { text: none ? '—' : pct + '%' }));
                    if ((weak || none) && !util.isEmpty(s.advice_html)) card.appendChild(h('div.els-result-advice', h('strong', { text: t('reviewAdvice') }), h('div', { html: s.advice_html })));
                    if (weak || none) {
                        var links = h('div.els-result-links');
                        (s.screen_ids || []).forEach(function (id) {
                            var sc = ctx.screens.filter(function (x) { return x.id === id; })[0];
                            if (sc) links.appendChild(ELS.ui.button(util.esc(sc.title), function () { ctx.goTo(id); }, 'link'));
                        });
                        card.appendChild(links);
                    }
                    grid.appendChild(card);
                    setTimeout(function () { card.querySelector('.els-result-bar i').style.width = (none ? 0 : pct) + '%'; }, 80);
                });
                live.appendChild(grid);
                ELS.anim.stagger(grid);
            }
            draw();
            ctx.onEnter(draw);
        }
    });

    /* ================================================================== *
     * POLL / REFLECTION
     * ================================================================== */
    R.register({
        type: 'poll', label: 'Poll & reflection', category: 'advanced', icon: ELS.icons.poll,
        description: 'Unscored opinion poll or reflection, with optional benchmark results.',
        fields: [
            { key: 'prompt_html', label: 'Question', type: 'html', required: true },
            { key: 'options', label: 'Options', type: 'strings', help: 'Leave empty for a free-text reflection only.' },
            { key: 'multi', label: 'Allow multiple choices', type: 'bool', default: false },
            { key: 'allow_text', label: 'Add a free-text answer', type: 'bool', default: false },
            { key: 'text_label', label: 'Free-text label', type: 'text', showIf: { allow_text: true } },
            { key: 'show_benchmark', label: 'Show benchmark results after answering', type: 'bool', default: false },
            { key: 'benchmark', label: 'Benchmark % per option (one per line, same order)', type: 'strings', showIf: { show_benchmark: true }, help: 'Author-provided reference data (e.g. from a survey). It is not live data.' },
            { key: 'reflection_html', label: 'Reflection shown after submitting', type: 'html' },
            { key: 'report', label: 'Report the answer to the LMS (as a neutral interaction)', type: 'bool', default: true }
        ],
        template: {
            title: 'Quick poll', prompt_html: '<p>Which change would be easiest for you this month?</p>', options: ['Cycle or walk more', 'Eat less meat', 'Cut home energy use', 'Buy second-hand'],
            multi: false, allow_text: true, text_label: 'Anything else?', show_benchmark: true, benchmark: ['35', '20', '30', '15'],
            reflection_html: '<p>Small, consistent changes add up. Pick one and try it for a week.</p>', report: true
        },
        validate: function (c) {
            var out = [], n = util.list(c.options).length;
            if (!n && !c.allow_text) out.push({ path: 'options', message: 'Add options or enable the free-text answer.', level: 'error' });
            if (c.show_benchmark && util.list(c.benchmark).length !== n) out.push({ path: 'benchmark', message: 'Provide one benchmark value per option.', level: 'warning' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, opts = util.list(c.options), key = 'poll:' + ctx.id;
            ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var sel = {};
            var grp = h('div.els-options.is-poll', { role: c.multi ? 'group' : 'radiogroup' });
            var btns = opts.map(function (o, i) {
                var b = h('button.els-option', { type: 'button', role: c.multi ? 'checkbox' : 'radio', 'aria-checked': 'false', tabindex: i ? '-1' : '0' },
                    h('span.els-option-key', { text: String.fromCharCode(65 + i) }), h('span.els-option-text', { text: o }), h('span.els-poll-bar', h('i')), h('span.els-poll-pct'));
                b.addEventListener('click', function () { if (grp.classList.contains('is-locked')) return; if (!c.multi) sel = {}; sel[i] = !sel[i]; paint(); });
                grp.appendChild(b);
                return b;
            });
            if (opts.length) { ELS.ui.roving(grp, '.els-option'); ctx.el.appendChild(grp); }
            var ta = null;
            if (c.allow_text) {
                ta = h('textarea.els-textarea', { rows: '3', maxlength: '500', placeholder: c.text_label || t('typeHere'), 'aria-label': c.text_label || t('yourAnswer') });
                ctx.el.appendChild(h('label.els-field', h('span', { text: c.text_label || '' }), ta));
            }
            var submit = ELS.ui.button(t('submit'), save, 'primary');
            var note = h('span.els-attempts');
            ctx.el.appendChild(h('div.els-actions', submit, note));
            var after = h('div.els-reveal', { hidden: true, 'aria-live': 'polite' });
            ctx.el.appendChild(after);
            function paint() { btns.forEach(function (b, i) { b.classList.toggle('is-selected', !!sel[i]); b.setAttribute('aria-checked', sel[i] ? 'true' : 'false'); }); }
            function chosen() { return Object.keys(sel).filter(function (k) { return sel[k]; }).map(Number).sort(); }
            function save() {
                var ch = chosen(), txt = ta ? ta.value.trim() : '';
                if (!ch.length && !txt) { note.textContent = t('answerFirst'); return; }
                var v = { c: ch, x: txt.slice(0, 500) };
                ctx.setVar(key, v);
                ctx.complete();
                if (c.report !== false && ctx.course) {
                    ctx.score({ ratio: 0, correct: false, final: true, max: 0, response: v,
                        interaction: ch.length ? { type: c.multi ? 'choice' : 'likert', response: ch, result: 'neutral', description: util.stripHtml(c.prompt_html) }
                            : { type: 'long-fill-in', response: txt, result: 'neutral', description: util.stripHtml(c.prompt_html) } });
                }
                lock(v, true);
            }
            function lock(v, animate) {
                grp.classList.add('is-locked');
                if (ta) { ta.value = v.x || ''; ta.disabled = true; }
                submit.hidden = true;
                note.innerHTML = ELS.icons.check + ' ' + util.esc(t('saved'));
                sel = {}; (v.c || []).forEach(function (i) { sel[i] = true; }); paint();
                if (c.show_benchmark) {
                    var bm = util.list(c.benchmark).map(Number);
                    grp.classList.add('has-results');
                    btns.forEach(function (b, i) {
                        var p = isFinite(bm[i]) ? util.clamp(bm[i], 0, 100) : 0;
                        b.querySelector('.els-poll-pct').textContent = p + '%';
                        setTimeout(function () { b.querySelector('.els-poll-bar i').style.width = p + '%'; }, animate ? 60 : 0);
                    });
                    after.appendChild(h('p.els-muted', { text: t('benchmark') }));
                }
                if (!util.isEmpty(c.reflection_html)) after.appendChild(h('div.els-reveal-head', h('span', { html: ELS.icons.bulb }), h('strong', { text: t('reflection') })), h('div.els-prose', { html: c.reflection_html }));
                after.hidden = !after.children.length;
            }
            var prev = ctx.getVar(key);
            if (prev) lock(prev, false);
        }
    });

    /* ================================================================== *
     * EMBED HTML (sandboxed custom HTML/CSS/JS with a scoring bridge)
     * ================================================================== */
    function bridge(token) {
        return '<script>(function(){var T=' + JSON.stringify(token) + ';function s(m){try{parent.postMessage({__els:T,msg:m},"*")}catch(e){}}' +
            'window.ELS={complete:function(){s({type:"complete"})},setScore:function(n){s({type:"score",value:Number(n)})},' +
            'passed:function(){s({type:"status",value:"passed"})},failed:function(){s({type:"status",value:"failed"})},' +
            'setStatus:function(v){s({type:"status",value:String(v)})}};})();<\/script>';
    }

    R.register({
        type: 'embed_html', label: 'Custom HTML', category: 'advanced', icon: ELS.icons.embed,
        scored: function (c) { return !!c.scored; },
        requiresInteraction: function (c) { return (c.completion || 'on_view') !== 'on_view'; },
        description: 'Your own HTML/CSS/JS in a secure sandbox, with an API to report completion and score.',
        fields: [
            { key: 'html', label: 'HTML / CSS / JavaScript', type: 'code', required: true, help: 'Runs in a sandboxed iframe. Call ELS.complete(), ELS.setScore(0–100), ELS.passed() or ELS.failed() to report back.' },
            { key: 'completion', label: 'Completion', type: 'select', default: 'on_view', options: [
                { value: 'on_view', label: 'When viewed' }, { value: 'on_message', label: 'When the content calls ELS.complete()' }, { value: 'time_threshold', label: 'After a minimum time' }] },
            { key: 'min_seconds', label: 'Minimum seconds', type: 'number', min: 1, max: 3600, default: 30, showIf: { completion: 'time_threshold' } },
            { key: 'aspect', label: 'Size', type: 'select', default: 'fill', options: [{ value: 'fill', label: 'Fixed height' }, { value: '16:9', label: '16:9' }, { value: '4:3', label: '4:3' }] },
            { key: 'height', label: 'Height (px)', type: 'number', min: 120, max: 2000, default: 420, showIf: { aspect: 'fill' } },
            { key: 'scored', label: 'Scored via ELS.setScore()', type: 'bool', default: false },
            { key: 'points', label: 'Points', type: 'number', min: 0, default: 10, showIf: { scored: true } },
            { key: 'pass_percent', label: 'Pass at score (%)', type: 'number', min: 0, max: 100, default: 70, showIf: { scored: true } }
        ],
        template: {
            title: 'Custom interactive: carbon calculator', completion: 'on_message', aspect: 'fill', height: 380, scored: false,
            html: '<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f4f9fc;color:#1f2d3a}label{display:block;margin:12px 0 4px;font-weight:600}input{width:100%;font-size:18px}output{display:block;font-size:32px;font-weight:700;color:#3b759e;margin-top:16px}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#3b759e;color:#fff;font-size:16px;cursor:pointer}</style>\n<h2>Commute calculator</h2>\n<label for="km">Kilometres driven per day</label>\n<input id="km" type="range" min="0" max="100" value="20">\n<output id="out"></output>\n<button id="done">I\'m done</button>\n<script>\nvar km=document.getElementById("km"),out=document.getElementById("out");\nfunction u(){out.textContent=Math.round(km.value*0.17*220)+" kg CO\\u2082 / year";}\nkm.oninput=u;u();\ndocument.getElementById("done").onclick=function(){ELS.complete();this.textContent="Saved \\u2713";};\n<\/script>'
        },
        validate: function (c) {
            var out = [];
            if (c.completion === 'on_message' && !/ELS\.complete\s*\(/.test(c.html || '') && !/ELS\.(passed|failed)\s*\(/.test(c.html || '')) out.push({ path: 'html', message: 'Completion is "on message" but the code never calls ELS.complete().', level: 'warning' });
            if (c.scored && !/ELS\.setScore\s*\(/.test(c.html || '')) out.push({ path: 'html', message: 'Scored content should call ELS.setScore(0–100).', level: 'warning' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            var token = util.uid('embed');
            var frame = h('iframe.els-embed', { title: c.title || 'Interactive content', sandbox: 'allow-scripts allow-forms allow-modals allow-popups', loading: 'lazy', referrerpolicy: 'no-referrer' });
            frame.srcdoc = '<!doctype html><html lang="' + util.esc(ctx.lang) + '" dir="' + util.esc(ctx.dir) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + bridge(token) + '</head><body>' + (c.html || '') + '</body></html>';
            var box = h('div.els-embed-box' + (c.aspect && c.aspect !== 'fill' ? '.is-ratio' : ''), { style: c.aspect === '16:9' ? { aspectRatio: '16 / 9' } : c.aspect === '4:3' ? { aspectRatio: '4 / 3' } : { height: (Number(c.height) || 420) + 'px' }, 'data-prevent-swipe': '' }, frame);
            var status = h('p.els-progress-note');
            ctx.el.appendChild(box);
            ctx.el.appendChild(status);
            var lastScore = ctx.saved ? (ctx.saved.m ? ctx.saved.s / ctx.saved.m * 100 : 0) : null;
            function markDone() {
                if (!ctx.isDone()) ctx.complete();
                status.innerHTML = ELS.icons.check + '<span>' + util.esc(t('activityComplete')) + '</span>';
                status.classList.add('is-done');
            }
            function onMsg(e) {
                if (e.source !== frame.contentWindow || !e.data || e.data.__els !== token) return;
                var m = e.data.msg || {};
                if (m.type === 'complete') { if (c.scored && lastScore !== null) record(true); markDone(); }
                else if (m.type === 'score' && c.scored && isFinite(m.value)) { lastScore = util.clamp(m.value, 0, 100); record(false); }
                else if (m.type === 'status' && /^(passed|failed|completed)$/.test(m.value)) {
                    if (c.scored) { if (lastScore === null) lastScore = m.value === 'passed' ? 100 : 0; record(true, m.value); }
                    markDone();
                }
            }
            function record(final, st) {
                var pass = Number(c.pass_percent); if (!isFinite(pass)) pass = 70;
                var ok = st ? st === 'passed' : lastScore >= pass;
                ctx.score({ ratio: lastScore / 100, correct: ok, final: !!final, attempts: 1, response: Math.round(lastScore), interaction: final ? { type: 'numeric', response: Math.round(lastScore), description: c.title } : null });
            }
            root.addEventListener('message', onMsg);
            ctx.onDestroy(function () { root.removeEventListener('message', onMsg); });
            if (ctx.isDone()) markDone();
            var mode = c.completion || 'on_view';
            var timer = null, secs = 0;
            ctx.onEnter(function () {
                if (mode === 'on_view') markDone();
                if (mode === 'time_threshold' && !ctx.isDone()) {
                    var need = Number(c.min_seconds) || 30;
                    clearInterval(timer);
                    timer = setInterval(function () {
                        secs++;
                        status.textContent = t('timeLeft') + ': ' + util.formatClock(Math.max(0, need - secs));
                        if (secs >= need) { clearInterval(timer); markDone(); }
                    }, 1000);
                }
            });
            ctx.onLeave(function () { clearInterval(timer); });
            ctx.onDestroy(function () { clearInterval(timer); });
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
