/**
 * Basic content screens: title_slide, content_slide, video, summary.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    /** Shared: image or video element from a URL. */
    ELS.media = function (src, alt, opts) {
        opts = opts || {};
        if (!src) return null;
        if (/\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(src) || /^data:video\//.test(src)) {
            return h('video.els-media', { src: src, controls: true, playsinline: true, preload: 'metadata', 'aria-label': alt || '' });
        }
        if (/\.(mp3|ogg|wav|m4a)(\?|#|$)/i.test(src) || /^data:audio\//.test(src)) {
            return h('audio.els-media', { src: src, controls: true, preload: 'metadata', 'aria-label': alt || '' });
        }
        return h('img.els-media', { src: src, alt: alt || '', loading: 'lazy', draggable: 'false' });
    };

    ELS.embedUrl = function (url) {
        var m = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w\-]{6,})/.exec(url || '');
        if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1] + '?rel=0';
        m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url || '');
        if (m) return 'https://player.vimeo.com/video/' + m[1];
        return null;
    };

    /* ------------------------------------------------------------------ */
    R.register({
        type: 'title_slide', label: 'Title slide', category: 'content', icon: ELS.icons.title, customHeader: true,
        description: 'Course or module opener with a hero image and start button.',
        fields: [
            { key: 'subtitle', label: 'Subtitle', type: 'text' },
            { key: 'body_html', label: 'Intro text', type: 'html' },
            { key: 'layout', label: 'Layout', type: 'select', default: 'hero', options: [
                { value: 'hero', label: 'Full-bleed hero' }, { value: 'split', label: 'Split (text + image)' }, { value: 'minimal', label: 'Minimal' }] },
            { key: 'background_image', label: 'Hero / side image', type: 'image' },
            { key: 'image_alt', label: 'Image description (alt text)', type: 'text', showIf: { layout: 'split' } },
            { key: 'button_label', label: 'Start button label', type: 'text', help: 'Leave empty for the default "Start". Use "-" to hide.' },
            { key: 'meta', label: 'Meta line', type: 'text', help: 'E.g. "15 min · 6 activities".' }
        ],
        template: { title: 'Welcome to the course', subtitle: 'An interactive learning experience', layout: 'hero', body_html: '<p>Use the arrows, keyboard or swipe to move between screens.</p>', meta: '10 min' },
        render: function (ctx) {
            var c = ctx.cfg;
            var layout = c.layout || 'hero';
            ctx.section.classList.add('els-title-' + layout);
            if (layout === 'hero' && c.background_image) {
                ctx.section.style.background = 'linear-gradient(120deg, rgba(10,30,50,.82), rgba(10,30,50,.35)), url("' + String(c.background_image).replace(/"/g, '%22') + '") center / cover no-repeat';
                ctx.section.classList.add('els-on-dark');
            } else if (layout === 'hero' && !c.background) {
                ctx.section.classList.add('els-hero-gradient', 'els-on-dark');
            }
            var text = h('div.els-hero-text');
            if (c.kicker) text.appendChild(h('p.els-kicker', { text: c.kicker }));
            text.appendChild(h('h1.els-title.els-hero-title', { text: c.title || '', tabindex: '-1' }));
            if (c.subtitle) text.appendChild(h('p.els-hero-sub', { text: c.subtitle }));
            if (c.lead) text.appendChild(h('p.els-lead', { text: c.lead }));
            if (!util.isEmpty(c.body_html)) text.appendChild(h('div.els-prose', { html: c.body_html }));
            if (c.meta) text.appendChild(h('p.els-hero-meta', { html: ELS.icons.clock + '<span>' + util.esc(c.meta) + '</span>' }));
            if (c.button_label !== '-' && ctx.index < ctx.screens.length - 1) {
                text.appendChild(h('div.els-actions', ELS.ui.button('<span>' + util.esc(c.button_label || ctx.t('start')) + '</span>' + ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { ctx.next(); }, 'primary lg')));
            }
            var wrap = h('div.els-hero', text);
            if (layout === 'split' && c.background_image) wrap.appendChild(h('div.els-hero-media', ELS.ui.image(c.background_image, c.image_alt)));
            ctx.el.appendChild(wrap);
            ELS.anim.stagger(text);
        }
    });

    /* ------------------------------------------------------------------ */
    R.register({
        type: 'content_slide', label: 'Content', category: 'content', icon: ELS.icons.content,
        description: 'Rich text with media in flexible layouts, or a composition of content blocks.',
        fields: [
            { key: 'layout', label: 'Layout', type: 'select', default: 'text_media', options: [
                { value: 'text', label: 'Text only' }, { value: 'text_media', label: 'Text + media' },
                { value: 'media_text', label: 'Media + text' }, { value: 'full_media', label: 'Full-width media' }] },
            { key: 'body_html', label: 'Body', type: 'html', help: 'Required unless you use content blocks.' },
            { key: 'media', label: 'Image / video', type: 'media', showIf: function (c) { return c.layout !== 'text'; } },
            { key: 'media_alt', label: 'Media description (alt text)', type: 'text', showIf: function (c) { return c.layout !== 'text'; } },
            { key: 'media_caption', label: 'Media caption', type: 'text', showIf: function (c) { return c.layout !== 'text'; } },
            { key: 'blocks', label: 'Content blocks (optional — replace body & media)', type: 'list', itemLabel: 'Block', fields: [
                { key: 'kind', label: 'Block type', type: 'select', default: 'text', options: [
                    { value: 'text', label: 'Text' }, { value: 'image', label: 'Image' }, { value: 'callout', label: 'Callout' },
                    { value: 'quote', label: 'Quote' }, { value: 'stat', label: 'Key figure' }] },
                { key: 'value', label: 'Figure', type: 'text', showIf: { kind: 'stat' } },
                { key: 'html', label: 'Text', type: 'html', showIf: function (b) { return b.kind !== 'image'; } },
                { key: 'src', label: 'Image', type: 'image', showIf: { kind: 'image' } },
                { key: 'alt', label: 'Alt text', type: 'text', showIf: { kind: 'image' } },
                { key: 'wide', label: 'Full width', type: 'bool' }
            ] }
        ],
        template: { title: 'Key ideas', layout: 'text', body_html: '<p>Write your content here. You can use <strong>bold</strong>, lists and links.</p><ul><li>First point</li><li>Second point</li></ul>' },
        validate: function (c) {
            if (util.isEmpty(c.body_html) && !(c.blocks && c.blocks.length) && !c.media) return [{ path: 'body_html', message: 'Add body text, media or at least one content block.', level: 'error' }];
            var out = [];
            if (c.media && c.layout !== 'text' && !c.media_alt && !/\.(mp4|webm|ogv|mov)/i.test(c.media)) out.push({ path: 'media_alt', message: 'Add alt text for accessibility.', level: 'warning' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg;
            if (c.blocks && c.blocks.length) {
                var grid = h('div.els-blocks');
                c.blocks.forEach(function (b) {
                    var kind = b.kind || 'text', el;
                    if (kind === 'image') el = h('figure.els-block.is-image', ELS.ui.image(b.src, b.alt), b.html ? h('figcaption', { html: b.html }) : null);
                    else if (kind === 'stat') el = h('div.els-block.is-stat', h('strong.els-stat-value', { text: b.value || '' }), h('div', { html: b.html || '' }));
                    else if (kind === 'quote') el = h('blockquote.els-block.is-quote', { html: b.html || '' });
                    else if (kind === 'callout') el = h('div.els-block.is-callout', h('span.els-callout-icon', { html: ELS.icons.bulb }), h('div', { html: b.html || '' }));
                    else el = h('div.els-block.is-text.els-prose', { html: b.html || '' });
                    if (b.wide) el.classList.add('is-wide');
                    grid.appendChild(el);
                });
                ctx.el.appendChild(grid);
                ELS.anim.stagger(grid);
                return;
            }
            var layout = c.layout || 'text';
            var text = !util.isEmpty(c.body_html) ? h('div.els-prose', { html: c.body_html }) : null;
            var media = layout !== 'text' && c.media ? h('figure.els-figure', ELS.media(c.media, c.media_alt), c.media_caption ? h('figcaption', { text: c.media_caption }) : null) : null;
            var wrap = h('div.els-layout.is-' + layout);
            if (layout === 'media_text' || layout === 'full_media') { wrap.appendChild(media); wrap.appendChild(text); }
            else { wrap.appendChild(text); wrap.appendChild(media); }
            ctx.el.appendChild(wrap);
            ELS.anim.stagger(wrap);
        }
    });

    /* ------------------------------------------------------------------ */
    R.register({
        type: 'video', label: 'Video', category: 'content', icon: ELS.icons.video,
        description: 'Video player with captions, speed control, transcript and optional watch-to-complete.',
        fields: [
            { key: 'video_url', label: 'Video (MP4/WebM file, upload, or YouTube/Vimeo URL)', type: 'media', required: true, accept: 'video/*' },
            { key: 'poster', label: 'Poster image', type: 'image' },
            { key: 'captions_url', label: 'Captions (WebVTT .vtt)', type: 'url', accept: '.vtt,text/vtt' },
            { key: 'captions_lang', label: 'Captions language code', type: 'text', default: 'en' },
            { key: 'caption', label: 'Caption below video', type: 'text' },
            { key: 'transcript_html', label: 'Transcript', type: 'html' },
            { key: 'require_complete', label: 'Learner must watch the video', type: 'bool', default: false },
            { key: 'completion_threshold', label: 'Watched % required', type: 'number', min: 10, max: 100, default: 90, showIf: { require_complete: true } }
        ],
        template: { title: 'Watch: introduction', video_url: 'media/sample.mp4', captions_url: 'media/sample-en.vtt', captions_lang: 'en', caption: 'A short introduction video.', require_complete: true, completion_threshold: 90 },
        requiresInteraction: function (c) { return !!c.require_complete && !ELS.embedUrl(c.video_url); },
        validate: function (c) {
            var out = [];
            if (c.require_complete && ELS.embedUrl(c.video_url)) out.push({ path: 'require_complete', message: 'Watch tracking only works with video files, not YouTube/Vimeo embeds. The screen will complete on view.', level: 'warning' });
            if (!c.captions_url && !c.transcript_html) out.push({ path: 'captions_url', message: 'Add captions or a transcript for accessibility.', level: 'warning' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            var embed = ELS.embedUrl(c.video_url);
            var frame = h('div.els-video-frame');
            ctx.el.appendChild(frame);
            if (embed) {
                frame.appendChild(h('iframe', { src: embed, title: c.title || 'Video', allow: 'accelerometer; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, loading: 'lazy' }));
                if (c.caption) ctx.el.appendChild(h('p.els-caption', { text: c.caption }));
                return;
            }
            var v = h('video', { controls: true, playsinline: true, preload: 'metadata', poster: c.poster || null, 'aria-label': c.title || 'Video', crossorigin: /^https?:/.test(c.video_url || '') ? 'anonymous' : null });
            v.appendChild(h('source', { src: c.video_url }));
            if (c.captions_url) v.appendChild(h('track', { kind: 'captions', src: c.captions_url, srclang: c.captions_lang || ctx.lang, label: (c.captions_lang || ctx.lang).toUpperCase(), default: true }));
            frame.appendChild(v);

            var bar = h('div.els-video-bar');
            var meter = ELS.ui.meter(t('progress'));
            var speed = h('select.els-select.els-speed', { 'aria-label': t('speed') });
            [0.75, 1, 1.25, 1.5, 2].forEach(function (r) { speed.appendChild(h('option', { value: r, text: r + '×', selected: r === 1 })); });
            speed.addEventListener('change', function () { v.playbackRate = Number(speed.value); });
            bar.appendChild(h('label.els-speed-label', h('span', { text: t('speed') }), speed));
            var status = h('span.els-video-status');
            if (c.require_complete) bar.appendChild(meter.el);
            bar.appendChild(status);
            ctx.el.appendChild(bar);
            if (c.caption) ctx.el.appendChild(h('p.els-caption', { text: c.caption }));
            if (!util.isEmpty(c.transcript_html)) {
                ctx.el.appendChild(h('details.els-transcript', h('summary', { text: t('transcript') }), h('div.els-prose', { html: c.transcript_html })));
            }

            // Watch tracking: count only time actually played (seeking ahead doesn't count).
            var stored = ctx.stored() || {};
            var watched = stored.w || 0, last = null, done = ctx.isDone();
            var threshold = (Number(c.completion_threshold) || 90) / 100;
            function update() {
                var dur = v.duration;
                if (!dur || !isFinite(dur)) return;
                var frac = Math.min(1, watched / dur);
                meter.set(frac * 100);
                if (!done && c.require_complete && frac >= threshold) {
                    done = true;
                    ctx.complete();
                    status.innerHTML = ELS.icons.check + '<span>' + util.esc(t('watched')) + '</span>';
                    status.className = 'els-video-status is-done';
                }
            }
            if (done) { status.innerHTML = ELS.icons.check + '<span>' + util.esc(t('watched')) + '</span>'; status.className = 'els-video-status is-done'; meter.set(100); }
            else if (c.require_complete) status.textContent = t('watchToContinue');
            v.addEventListener('timeupdate', function () {
                var now = v.currentTime;
                if (last !== null && !v.seeking) {
                    var d = now - last;
                    if (d > 0 && d < 1.5) watched += d;
                }
                last = now;
                update();
            });
            v.addEventListener('seeking', function () { last = null; });
            v.addEventListener('ended', function () { last = null; update(); });
            v.addEventListener('loadedmetadata', update);
            v.addEventListener('pause', function () { ctx.store({ w: Math.round(watched) }); });
            ctx.onLeave(function () { if (!v.paused) v.pause(); ctx.store({ w: Math.round(watched) }); });
        }
    });

    /* ------------------------------------------------------------------ */
    R.register({
        type: 'summary', label: 'Summary', category: 'content', icon: ELS.icons.summary,
        description: 'Lesson wrap-up with score, completion status and links to unfinished activities.',
        fields: [
            { key: 'body_html', label: 'Summary text', type: 'html' },
            { key: 'show_score', label: 'Show score', type: 'bool', default: true },
            { key: 'show_completion', label: 'Show completion status', type: 'bool', default: true },
            { key: 'show_breakdown', label: 'List activity scores', type: 'bool', default: true },
            { key: 'passed_html', label: 'Message when passed', type: 'html' },
            { key: 'failed_html', label: 'Message when not passed', type: 'html' },
            { key: 'allow_restart', label: 'Allow learner to restart the course', type: 'bool', default: false }
        ],
        template: { title: 'Summary', body_html: '<p>Here is what you covered in this lesson.</p><ul><li>Key idea one</li><li>Key idea two</li></ul>', show_score: true, show_completion: true, show_breakdown: true },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t;
            if (!util.isEmpty(c.body_html)) ctx.el.appendChild(h('div.els-prose.els-summary-text', { html: c.body_html }));
            var live = h('div.els-summary-live');
            ctx.el.appendChild(live);
            function draw() {
                live.innerHTML = '';
                var tot = ctx.totals();
                var row = h('div.els-summary-row');
                if (c.show_score !== false && tot.scored) row.appendChild(ELS.ui.ring(tot.pct, t('yourScore')));
                var facts = h('div.els-summary-facts');
                if (c.show_completion !== false) {
                    var status = tot.success === 'passed' ? 'passed' : tot.success === 'failed' ? 'failed' : (tot.complete ? 'completed' : 'incomplete');
                    facts.appendChild(h('div.els-status.is-' + status, { html: (status === 'failed' || status === 'incomplete' ? ELS.icons.info : ELS.icons.check) + '<span>' + util.esc(t(status)) + '</span>' }));
                    var pm = ELS.ui.meter(t('progress'));
                    facts.appendChild(h('div.els-fact', h('span', { text: t('progress') + ' · ' + Math.round(tot.progress * 100) + '%' }), pm.el));
                    setTimeout(function () { pm.set(tot.progress * 100); }, 50);
                }
                if (tot.scored) {
                    facts.appendChild(h('p.els-fact-line', { text: t('pointsOf', { a: Math.round(tot.score * 10) / 10, b: tot.max }) }));
                    facts.appendChild(h('p.els-fact-line.els-muted', { text: t('passMark', { n: tot.mastery }) }));
                }
                row.appendChild(facts);
                live.appendChild(row);
                var msg = tot.success === 'passed' ? c.passed_html : tot.success === 'failed' ? c.failed_html : '';
                if (!util.isEmpty(msg)) live.appendChild(h('div.els-callout.is-' + tot.success, { html: msg }));
                if (c.show_breakdown !== false && tot.scored) {
                    var list = h('ul.els-breakdown');
                    ctx.screens.forEach(function (s) {
                        if (!R.isScored(s)) return;
                        var r = ctx.resultOf(s.id), m = R.maxPoints(s);
                        var pct = r ? Math.round((r.s / m) * 100) : 0;
                        list.appendChild(h('li', h('span.els-breakdown-name', { text: s.title }),
                            h('span.els-breakdown-bar', h('i', { style: { width: (r ? pct : 0) + '%' } })),
                            h('span.els-breakdown-val', { text: r ? (Math.round(r.s * 10) / 10 + '/' + m) : t('notAttempted') })));
                    });
                    live.appendChild(list);
                }
                var todo = ctx.screens.filter(function (s, i) { return i !== ctx.index && R.requiresInteraction(s) && !ctx.isDoneId(s.id); });
                if (todo.length) {
                    var ul = h('ul.els-todo');
                    todo.forEach(function (s) {
                        ul.appendChild(h('li', ELS.ui.button('<span>' + util.esc(s.title) + '</span>' + ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { ctx.goTo(s.id); }, 'link')));
                    });
                    live.appendChild(h('div.els-todo-box', h('h3', { text: t('unanswered') }), ul));
                }
                if (c.allow_restart) live.appendChild(h('div.els-actions', ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('restart')) + '</span>', function () { ctx.restart(); }, 'ghost')));
                if (tot.success === 'passed' && ctx.isActive()) ELS.anim.confetti(live);
            }
            draw();
            ctx.onEnter(draw);
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
