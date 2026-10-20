/**
 * Simulations and decision-based learning:
 * branching, simulation, decision_scenario, exploration, worked_example.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    /* ================================================================== *
     * BRANCHING
     * ================================================================== */
    R.register({
        type: 'branching', label: 'Branching', category: 'scenario', icon: ELS.icons.branching,
        requiresInteraction: function () { return true; },
        description: 'A choice that sends the learner to different screens of the course.',
        fields: [
            { key: 'prompt_html', label: 'Situation / question', type: 'html', required: true },
            { key: 'image', label: 'Image', type: 'image' },
            { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (c) { return !!c.image; } },
            { key: 'choices', label: 'Choices', type: 'list', minItems: 2, maxItems: 6, itemLabel: 'Choice', fields: [
                { key: 'text', label: 'Choice text', type: 'text', required: true },
                { key: 'goto', label: 'Go to screen', type: 'screen' },
                { key: 'feedback_html', label: 'Feedback before moving on', type: 'html' }
            ] },
            { key: 'default_goto', label: 'Default target (when a choice has none)', type: 'screen', help: 'Leave empty to continue to the next screen.' },
            { key: 'auto_advance', label: 'Jump immediately (skip feedback)', type: 'bool', default: false }
        ],
        template: {
            title: 'Choose your path', prompt_html: '<p>How confident are you with the basics of renewable energy?</p>',
            choices: [{ text: 'I am new to this — show me the basics', goto: '', feedback_html: '<p>Great, let\'s start with the fundamentals.</p>' }, { text: 'I know the basics — take me to the practice', goto: '', feedback_html: '<p>Let\'s put your knowledge to work.</p>' }]
        },
        validate: function (c, course) {
            var out = [];
            (c.choices || []).forEach(function (ch, i) { if (ch.goto && !ELS.screenExists(course, ch.goto)) out.push({ path: 'choices[' + i + '].goto', message: 'Choice ' + (i + 1) + ' points to a screen that does not exist.', level: 'error' }); });
            if (c.default_goto && !ELS.screenExists(course, c.default_goto)) out.push({ path: 'default_goto', message: 'Default target screen does not exist.', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, choices = c.choices || [];
            var layout = h('div.els-branch');
            var text = h('div.els-branch-main', ELS.ui.prompt(c.prompt_html));
            if (c.image) layout.appendChild(h('figure.els-branch-media', ELS.ui.image(c.image, c.image_alt)));
            layout.appendChild(text);
            var list = h('div.els-choice-list', { role: 'group' });
            var fb = ELS.ui.feedback();
            var cont = h('div.els-actions', { hidden: true });
            var chosen = ctx.getVar('b:' + ctx.id);
            var btns = choices.map(function (ch, i) {
                var b = h('button.els-choice-card', { type: 'button', 'aria-pressed': 'false' }, h('span.els-choice-arrow', { html: ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'] }), h('span', { text: ch.text }));
                b.addEventListener('click', function () { pick(i); });
                list.appendChild(b);
                return b;
            });
            text.appendChild(list); text.appendChild(fb.el); text.appendChild(cont);
            ctx.el.appendChild(layout);
            ELS.anim.stagger(list);
            function target(i) { var ch = choices[i]; return (ch && ch.goto) || c.default_goto || ''; }
            function go(i) { var id = target(i); if (id && ctx.goTo(id)) return; ctx.next(); }
            function pick(i) {
                chosen = i;
                ctx.setVar('b:' + ctx.id, i);
                ctx.complete();
                btns.forEach(function (b, k) { b.classList.toggle('is-selected', k === i); b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
                if (c.auto_advance || util.isEmpty(choices[i].feedback_html)) { go(i); return; }
                fb.show('info', t('yourChoice') + ': ' + choices[i].text, choices[i].feedback_html);
                cont.innerHTML = '';
                cont.appendChild(ELS.ui.button('<span>' + util.esc(t('continue')) + '</span>' + ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { go(i); }, 'primary'));
                cont.hidden = false;
                cont.querySelector('button').focus();
            }
            if (typeof chosen === 'number' && btns[chosen]) { btns[chosen].classList.add('is-selected'); btns[chosen].setAttribute('aria-pressed', 'true'); }
        }
    });

    /* ================================================================== *
     * SIMULATION (software / procedure walkthrough)
     * ================================================================== */
    R.register({
        type: 'simulation', label: 'Simulation', category: 'scenario', icon: ELS.icons.simulation, scored: true,
        description: 'Step-by-step "try it" simulation: click the right spot, type a value or pick an action.',
        fields: [
            { key: 'prompt_html', label: 'Scenario intro', type: 'html' },
            { key: 'image', label: 'Default screen image', type: 'image', required: true },
            { key: 'image_alt', label: 'Image description', type: 'text' },
            { key: 'steps', label: 'Steps', type: 'list', minItems: 1, itemLabel: 'Step', fields: [
                { key: 'instruction_html', label: 'Instruction', type: 'html', required: true },
                { key: 'image', label: 'Screen image for this step (optional)', type: 'image' },
                { key: 'action', label: 'Learner action', type: 'select', default: 'click', options: [{ value: 'click', label: 'Click a target area' }, { value: 'input', label: 'Type a value' }, { value: 'choice', label: 'Choose an option' }] },
                { key: 'target', label: 'Target area', type: 'rect', imageKey: 'image', rootImageKey: 'image', showIf: { action: 'click' } },
                { key: 'accepted', label: 'Accepted values', type: 'strings', showIf: { action: 'input' } },
                { key: 'input_label', label: 'Input label', type: 'text', showIf: { action: 'input' } },
                { key: 'options', label: 'Options', type: 'strings', showIf: { action: 'choice' } },
                { key: 'correct_option', label: 'Correct option number (1 = first)', type: 'number', min: 1, default: 1, showIf: { action: 'choice' } },
                { key: 'hint_html', label: 'Hint (shown after a mistake)', type: 'html' },
                { key: 'feedback_html', label: 'Confirmation after success', type: 'html' }
            ] },
            { key: 'points', label: 'Points', type: 'number', min: 0, default: 10 },
            { key: 'feedback', label: 'Feedback', type: 'group', fields: [{ key: 'correct', label: 'All steps right first time', type: 'html' }, { key: 'incorrect', label: 'Completed with mistakes', type: 'html' }] }
        ],
        template: {
            title: 'Try it: set the thermostat', prompt_html: '<p>Practise lowering the heating schedule in the energy app.</p>', image: 'img/samples/app.svg', image_alt: 'Energy app showing a thermostat and menu',
            steps: [
                { instruction_html: '<p>Open the <strong>Schedule</strong> menu.</p>', action: 'click', target: { x: 6, y: 26, w: 26, h: 10 }, hint_html: '<p>The menu is on the left side.</p>' },
                { instruction_html: '<p>Type the new night temperature: <strong>17</strong> °C.</p>', action: 'input', accepted: ['17', '17°', '17 °C'], input_label: 'Night temperature (°C)' },
                { instruction_html: '<p>Which days should the schedule apply to?</p>', action: 'choice', options: ['Weekends only', 'Every day', 'Never'], correct_option: 2 },
                { instruction_html: '<p>Press <strong>Save</strong>.</p>', action: 'click', target: { x: 70, y: 80, w: 22, h: 11 }, feedback_html: '<p>Saved! The schedule is active.</p>' }
            ],
            points: 10, feedback: { correct: '<p>Flawless — every step right first time.</p>', incorrect: '<p>Done. Review the steps where you needed a hint.</p>' }
        },
        validate: function (c) {
            var out = [];
            (c.steps || []).forEach(function (s, i) {
                var p = 'steps[' + i + ']';
                if ((s.action || 'click') === 'click' && !(s.target && s.target.w > 0 && s.target.h > 0)) out.push({ path: p + '.target', message: 'Step ' + (i + 1) + ' needs a target area.', level: 'error' });
                if (s.action === 'input' && !util.list(s.accepted).length) out.push({ path: p + '.accepted', message: 'Step ' + (i + 1) + ' needs at least one accepted value.', level: 'error' });
                if (s.action === 'choice') {
                    var n = util.list(s.options).length;
                    if (n < 2) out.push({ path: p + '.options', message: 'Step ' + (i + 1) + ' needs at least two options.', level: 'error' });
                    else if (!(s.correct_option >= 1 && s.correct_option <= n)) out.push({ path: p + '.correct_option', message: 'Step ' + (i + 1) + ': correct option must be between 1 and ' + n + '.', level: 'error' });
                }
            });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, steps = c.steps || [];
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var cur = 0, misses = steps.map(function () { return 0; }), practice = false;
            var dots = h('div.els-steps-dots', { 'aria-hidden': 'true' }, steps.map(function () { return h('i'); }));
            var instr = h('div.els-sim-instr', { 'aria-live': 'polite' });
            var stage = ELS.ui.stage(c.image, c.image_alt);
            var device = h('div.els-sim-device', stage.el);
            var controls = h('div.els-sim-controls');
            var fb = ELS.ui.feedback();
            var wrap = h('div.els-sim', h('div.els-sim-head', instr, dots), device, controls, fb.el);
            ctx.el.appendChild(wrap);
            var targetBtn = h('button.els-sim-target', { type: 'button' });
            stage.layer.addEventListener('click', function (e) {
                var s = steps[cur];
                if (!s || (s.action || 'click') !== 'click' || wrap.classList.contains('is-finished')) return;
                if (e.target === targetBtn) return;
                var r = stage.layer.getBoundingClientRect();
                var m = h('span.els-click-marker.is-wrong', { style: { left: ((e.clientX - r.left) / r.width * 100) + '%', top: ((e.clientY - r.top) / r.height * 100) + '%' } });
                stage.layer.appendChild(m);
                setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 900);
                miss();
            });
            targetBtn.addEventListener('click', function (e) { e.stopPropagation(); success(); });
            function show() {
                var s = steps[cur];
                Array.prototype.forEach.call(dots.children, function (d, k) { d.className = k < cur ? 'is-done' : k === cur ? 'is-current' : ''; });
                instr.innerHTML = '';
                instr.appendChild(h('span.els-badge', { text: t('stepOf', { a: cur + 1, b: steps.length }) }));
                instr.appendChild(h('div.els-prose', { html: s.instruction_html || '' }));
                stage.img.src = s.image || c.image || '';
                controls.innerHTML = '';
                fb.hide();
                if (targetBtn.parentNode) targetBtn.parentNode.removeChild(targetBtn);
                var action = s.action || 'click';
                stage.el.classList.toggle('is-clickable', action === 'click');
                if (action === 'click') {
                    var tg = s.target || { x: 0, y: 0, w: 0, h: 0 };
                    targetBtn.style.left = tg.x + '%'; targetBtn.style.top = tg.y + '%'; targetBtn.style.width = tg.w + '%'; targetBtn.style.height = tg.h + '%';
                    targetBtn.setAttribute('aria-label', util.stripHtml(s.instruction_html));
                    targetBtn.classList.remove('is-hinted');
                    stage.layer.appendChild(targetBtn);
                } else if (action === 'input') {
                    var inp = h('input.els-input', { type: 'text', autocomplete: 'off', 'aria-label': s.input_label || t('yourAnswer'), placeholder: s.input_label || t('typeHere') });
                    var go = ELS.ui.button(t('submit'), function () {
                        var ok = util.list(s.accepted).some(function (a) { return util.normalizeAnswer(a) === util.normalizeAnswer(inp.value); });
                        if (ok) success(); else { miss(); inp.select(); }
                    }, 'primary');
                    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
                    controls.appendChild(h('div.els-inline-form', h('label', { text: s.input_label || '' }), inp, go));
                    setTimeout(function () { if (ctx.isActive()) inp.focus(); }, 50);
                } else {
                    var opts = util.list(s.options);
                    var grp = h('div.els-choice-list.is-row');
                    opts.forEach(function (o, k) {
                        grp.appendChild(ELS.ui.button(util.esc(o), function (e) {
                            if (k + 1 === Number(s.correct_option)) success(); else { e.currentTarget.classList.add('is-wrong'); e.currentTarget.disabled = true; miss(); }
                        }, 'choice-card'));
                    });
                    controls.appendChild(grp);
                }
            }
            function miss() {
                misses[cur]++;
                ELS.anim.pulse(device, 'els-shake');
                var s = steps[cur];
                fb.show('incorrect', (s.action || 'click') === 'click' ? t('wrongSpot') : t('incorrect'), misses[cur] >= 1 ? (s.hint_html || '') : '');
                if (misses[cur] >= 2 && (s.action || 'click') === 'click') targetBtn.classList.add('is-hinted');
            }
            function success() {
                var s = steps[cur];
                ELS.anim.pulse(device, 'els-flash-ok');
                if (cur < steps.length - 1) {
                    if (!util.isEmpty(s.feedback_html)) fb.show('correct', t('correct'), s.feedback_html);
                    cur++;
                    setTimeout(show, util.isEmpty(s.feedback_html) ? 350 : 1100);
                } else finish();
            }
            function finish(fromSaved) {
                wrap.classList.add('is-finished');
                if (targetBtn.parentNode) targetBtn.parentNode.removeChild(targetBtn);
                Array.prototype.forEach.call(dots.children, function (d) { d.className = 'is-done'; });
                var clean = misses.filter(function (m) { return m === 0; }).length;
                var ratio = steps.length ? clean / steps.length : 0;
                var all = clean === steps.length;
                if (!practice && !fromSaved) {
                    ctx.score({ ratio: ratio, correct: all, final: true, attempts: 1, response: misses.slice(),
                        interaction: { type: 'performance', response: misses.map(function (m, i) { return 's' + (i + 1) + ':' + (m ? m + 'x' : 'ok'); }).join(' '), correct: steps.map(function (_, i) { return 's' + (i + 1) + ':ok'; }).join(' '), description: c.title } });
                }
                var saved = fromSaved ? ctx.saved : null;
                var shownRatio = saved ? saved.s / saved.m : ratio;
                instr.innerHTML = '';
                instr.appendChild(h('span.els-badge.is-success', { text: t('activityComplete') }));
                controls.innerHTML = '';
                var fbc = c.feedback || {};
                fb.show(all || (saved && saved.c) ? 'correct' : 'partial', (practice ? '' : t('pointsOf', { a: Math.round(shownRatio * ctx.maxPoints), b: ctx.maxPoints }) + ' · ') + t('explored', { a: steps.length, b: steps.length }),
                    (all || (saved && saved.c) ? fbc.correct : fbc.incorrect) || '');
                controls.appendChild(ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('replay')) + '</span>', function () {
                    practice = true; cur = 0; misses = steps.map(function () { return 0; }); wrap.classList.remove('is-finished'); show();
                }, 'ghost'));
                if (all && !fromSaved && !practice) ELS.anim.confetti(wrap);
            }
            if (!steps.length) return;
            if (ctx.saved && ctx.saved.f) { if (Array.isArray(ctx.saved.r)) misses = ctx.saved.r; finish(true); }
            else show();
        }
    });

    /* ================================================================== *
     * DECISION SCENARIO (node graph with consequences and score deltas)
     * ================================================================== */
    function bestPath(nodes, startId) {
        var byId = {};
        nodes.forEach(function (n) { byId[n.id] = n; });
        function walk(id, seen, depth) {
            var n = byId[id];
            if (!n || seen[id] || depth > 40) return 0;
            seen[id] = 1;
            var best = 0;
            (n.choices || []).forEach(function (ch, k) {
                var v = Number(ch.score_delta) || 0;
                var next = ch.goto_node_id ? walk(ch.goto_node_id, Object.assign({}, seen), depth + 1) : 0;
                if (k === 0 || v + next > best) best = v + next;
            });
            return best;
        }
        return walk(startId, {}, 0);
    }
    ELS.decisionBestScore = bestPath;

    R.register({
        type: 'decision_scenario', label: 'Decision scenario', category: 'scenario', icon: ELS.icons.decision, scored: true,
        points: function (c) { return c.points === undefined ? 20 : c.points; },
        description: 'A story where each decision has consequences, feedback and a score impact.',
        fields: [
            { key: 'intro_html', label: 'Scenario intro', type: 'html' },
            { key: 'nodes', label: 'Scenes', type: 'list', minItems: 1, itemLabel: 'Scene', itemTitleKey: 'id', fields: [
                { key: 'id', label: 'Scene id', type: 'text', required: true, pattern: '^[A-Za-z0-9_\\-]+$', patternHelp: 'letters, digits, - or _' },
                { key: 'prompt_html', label: 'What happens', type: 'html', required: true },
                { key: 'image', label: 'Scene image', type: 'image' },
                { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (n) { return !!n.image; } },
                { key: 'choices', label: 'Decisions (leave empty for an ending)', type: 'list', itemLabel: 'Decision', fields: [
                    { key: 'id', type: 'id' },
                    { key: 'text_html', label: 'Decision', type: 'text', required: true },
                    { key: 'feedback_html', label: 'Consequence', type: 'html' },
                    { key: 'score_delta', label: 'Score change', type: 'number', default: 0 },
                    { key: 'goto_node_id', label: 'Next scene', type: 'select', optionsFrom: function (root) {
                        return [{ value: '', label: '— End scenario —' }].concat((root.nodes || []).map(function (n) { return { value: n.id, label: n.id }; }));
                    } }
                ] }
            ] },
            { key: 'start_node_id', label: 'First scene', type: 'select', optionsFrom: function (root) { return (root.nodes || []).map(function (n) { return { value: n.id, label: n.id }; }); } },
            { key: 'pass_score', label: 'Pass score (scenario points)', type: 'number', help: 'Default: more than 0.' },
            { key: 'points', label: 'Course points', type: 'number', min: 0, default: 20 },
            { key: 'attempts', label: 'Attempts allowed', type: 'number', min: 0, max: 20, default: 2, help: '0 = unlimited.' },
            { key: 'feedback', label: 'Final feedback', type: 'group', fields: [{ key: 'correct', label: 'Passed', type: 'html' }, { key: 'incorrect', label: 'Not passed', type: 'html' }] }
        ],
        template: {
            title: 'The leaking tap', intro_html: '<p>You manage a small office. Make decisions to cut water waste.</p>', start_node_id: 'start', pass_score: 15, points: 20, attempts: 2,
            nodes: [
                { id: 'start', prompt_html: '<p>A colleague reports a dripping tap in the kitchen. What do you do?</p>', choices: [
                    { id: 'c1', text_html: 'Call maintenance today', feedback_html: '<p>Fixed within hours — that saves up to 20 litres a day.</p>', score_delta: 10, goto_node_id: 'next' },
                    { id: 'c2', text_html: 'Put a bucket under it for now', feedback_html: '<p>The water is collected, but the leak continues.</p>', score_delta: 2, goto_node_id: 'next' },
                    { id: 'c3', text_html: 'Ignore it — it is only a drip', feedback_html: '<p>A drip a second wastes over 10,000 litres a year.</p>', score_delta: -5, goto_node_id: 'next' }] },
                { id: 'next', prompt_html: '<p>The team asks how to save more water. What is your next step?</p>', choices: [
                    { id: 'c4', text_html: 'Install tap aerators', feedback_html: '<p>Aerators cut flow by up to 50% with no loss of comfort.</p>', score_delta: 10, goto_node_id: 'end' },
                    { id: 'c5', text_html: 'Send a reminder email', feedback_html: '<p>Awareness helps a little, but habits are hard to change.</p>', score_delta: 3, goto_node_id: 'end' }] },
                { id: 'end', prompt_html: '<p>Three months later you review the water bill.</p>', choices: [] }
            ],
            feedback: { correct: '<p>Your decisions made a measurable difference.</p>', incorrect: '<p>Try again: act quickly and choose lasting fixes.</p>' }
        },
        validate: function (c) {
            var out = [], ids = {};
            (c.nodes || []).forEach(function (n, i) {
                if (n.id && ids[n.id]) out.push({ path: 'nodes[' + i + '].id', message: 'Duplicate scene id "' + n.id + '".', level: 'error' });
                ids[n.id] = 1;
            });
            (c.nodes || []).forEach(function (n, i) {
                (n.choices || []).forEach(function (ch, k) {
                    if (ch.goto_node_id && !ids[ch.goto_node_id]) out.push({ path: 'nodes[' + i + '].choices[' + k + '].goto_node_id', message: 'Scene "' + n.id + '" decision ' + (k + 1) + ' points to missing scene "' + ch.goto_node_id + '".', level: 'error' });
                });
                if ((n.choices || []).length === 1) out.push({ path: 'nodes[' + i + '].choices', message: 'Scene "' + n.id + '" has only one decision — add another or make it an ending.', level: 'warning' });
            });
            if (c.start_node_id && !ids[c.start_node_id]) out.push({ path: 'start_node_id', message: 'First scene does not exist.', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, nodes = c.nodes || [];
            var byId = {}; nodes.forEach(function (n) { byId[n.id] = n; });
            var startId = c.start_node_id && byId[c.start_node_id] ? c.start_node_id : (nodes[0] && nodes[0].id);
            var best = Math.max(1, bestPath(nodes, startId));
            var passScore = c.pass_score !== undefined && c.pass_score !== '' && c.pass_score !== null ? Number(c.pass_score) : 1;
            var maxAttempts = Number(c.attempts); if (!isFinite(maxAttempts) || maxAttempts < 0) maxAttempts = 1;
            var used = ctx.saved ? ctx.saved.a || 1 : 0;
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var scoreChip = h('span.els-chip', { html: ELS.icons.star + '<span>0</span>' });
            var crumbs = h('ol.els-crumbs', { 'aria-label': t('yourPath') });
            var scene = h('div.els-scene', { 'aria-live': 'polite' });
            ctx.el.appendChild(h('div.els-scenario', h('div.els-scenario-bar', crumbs, scoreChip), scene));
            var total = 0, path = [], steps = 0;
            function setScore(v) { total = v; scoreChip.querySelector('span').textContent = (v > 0 ? '+' : '') + v; }
            function showNode(id) {
                var n = byId[id];
                steps++;
                if (!n || steps > 60) return end();
                scene.innerHTML = '';
                var card = h('div.els-scene-card');
                if (n.image) card.appendChild(h('figure.els-scene-media', ELS.ui.image(n.image, n.image_alt)));
                var body = h('div.els-scene-body', h('div.els-prose', { html: n.prompt_html || '' }));
                card.appendChild(body);
                scene.appendChild(card);
                ELS.anim.pulse(card, 'els-fade-in');
                var chs = n.choices || [];
                if (!chs.length) return end(n);
                var list = h('div.els-choice-list');
                chs.forEach(function (ch, k) {
                    list.appendChild(ELS.ui.button('<span class="els-choice-arrow">' + ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'] + '</span><span>' + util.esc(ch.text_html) + '</span>', function () { decide(n, ch, k, list, body); }, 'choice-card'));
                });
                body.appendChild(list);
                ELS.anim.stagger(list);
            }
            function decide(n, ch, k, list, body) {
                Array.prototype.forEach.call(list.children, function (b, i) { b.disabled = true; b.classList.toggle('is-selected', i === k); });
                var d = Number(ch.score_delta) || 0;
                setScore(total + d);
                path.push(n.id + '.' + (ch.id || k));
                crumbs.appendChild(h('li', { text: ch.text_html, class: d > 0 ? 'is-good' : d < 0 ? 'is-bad' : '' }));
                var fbx = ELS.ui.feedback();
                fbx.show(d > 0 ? 'correct' : d < 0 ? 'incorrect' : 'info', (d > 0 ? '+' : '') + d, ch.feedback_html || '');
                body.appendChild(fbx.el);
                var btn = ELS.ui.button('<span>' + util.esc(t('continue')) + '</span>' + ELS.icons[ctx.dir === 'rtl' ? 'chevronL' : 'chevronR'], function () { if (ch.goto_node_id) showNode(ch.goto_node_id); else end(); }, 'primary');
                body.appendChild(h('div.els-actions', btn));
                btn.focus();
            }
            function end(n, restored) {
                var passed = total >= passScore;
                var ratio = util.clamp(total / best, 0, 1);
                if (!restored) {
                    used++;
                    var final = passed || (maxAttempts > 0 && used >= maxAttempts);
                    ctx.score({ ratio: ratio, correct: passed, final: final, attempts: used, response: { p: path, s: total },
                        interaction: { type: 'performance', response: path.join(' '), description: c.title } });
                }
                var finalNow = restored ? !!(ctx.saved && ctx.saved.f) : (passed || (maxAttempts > 0 && used >= maxAttempts));
                var box = h('div.els-scene-end');
                box.appendChild(h('h3', { text: t('scenarioEnd') }));
                var fbc = c.feedback || {};
                var fbx = ELS.ui.feedback();
                fbx.show(passed ? 'correct' : 'incorrect', t('score') + ': ' + total + ' · ' + t('pointsOf', { a: Math.round(ratio * ctx.maxPoints), b: ctx.maxPoints }), (passed ? fbc.correct : fbc.incorrect) || '');
                box.appendChild(fbx.el);
                if (!finalNow) box.appendChild(h('div.els-actions', ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('restartScenario')) + '</span>', restart, 'ghost'),
                    h('span.els-attempts', { text: maxAttempts ? t('attemptsLeft', { n: maxAttempts - used }) : '' })));
                if (n) scene.appendChild(box); else { scene.innerHTML = ''; scene.appendChild(box); }
                if (passed && !restored) ELS.anim.confetti(box);
            }
            function restart() { total = 0; path = []; steps = 0; crumbs.innerHTML = ''; setScore(0); showNode(startId); }
            if (ctx.saved && ctx.saved.r && ctx.saved.r.p) {
                setScore(ctx.saved.r.s || 0);
                path = ctx.saved.r.p;
                path.forEach(function (p) {
                    var parts = p.split('.'), nd = byId[parts[0]], ch = nd && (nd.choices || []).filter(function (x, k) { return (x.id || String(k)) === parts[1]; })[0];
                    if (ch) crumbs.appendChild(h('li', { text: ch.text_html, class: ch.score_delta > 0 ? 'is-good' : ch.score_delta < 0 ? 'is-bad' : '' }));
                });
                end(null, true);
            } else if (startId) showNode(startId);
        }
    });

    /* ================================================================== *
     * EXPLORATION (learner input stored and replayed later)
     * ================================================================== */
    R.register({
        type: 'exploration', label: 'Exploration', category: 'scenario', icon: ELS.icons.exploration,
        requiresInteraction: function () { return true; },
        description: 'Capture a prediction, opinion or estimate and replay it later in the course.',
        fields: [
            { key: 'prompt_html', label: 'Question / prompt', type: 'html', required: true },
            { key: 'store_key', label: 'Storage key', type: 'text', required: true, pattern: '^[a-z0-9_\\-]{1,64}$', patternHelp: 'lowercase letters, digits, - or _', help: 'Show the answer later with <span data-exploration-ref="KEY"></span>.' },
            { key: 'input_kind', label: 'Input type', type: 'select', default: 'text', options: [{ value: 'text', label: 'Free text' }, { value: 'choice', label: 'Choice' }, { value: 'prediction', label: 'Prediction (choice, then reveal)' }, { value: 'slider', label: 'Slider estimate' }] },
            { key: 'choices', label: 'Choices', type: 'strings', showIf: { input_kind: ['choice', 'prediction'] } },
            { key: 'placeholder', label: 'Placeholder', type: 'text', showIf: { input_kind: 'text' } },
            { key: 'min_length', label: 'Minimum characters', type: 'number', min: 0, max: 500, default: 0, showIf: { input_kind: 'text' } },
            { key: 'min_value', label: 'Slider minimum', type: 'number', default: 0, showIf: { input_kind: 'slider' } },
            { key: 'max_value', label: 'Slider maximum', type: 'number', default: 100, showIf: { input_kind: 'slider' } },
            { key: 'step', label: 'Slider step', type: 'number', default: 1, showIf: { input_kind: 'slider' } },
            { key: 'unit', label: 'Unit', type: 'text', showIf: { input_kind: 'slider' } },
            { key: 'reveal_html', label: 'Revealed after submitting', type: 'html', help: 'E.g. the actual answer for a prediction.' }
        ],
        template: {
            title: 'Make a prediction', prompt_html: '<p>What percentage of the world\'s electricity do you think comes from renewables today?</p>',
            store_key: 'renewables_guess', input_kind: 'slider', min_value: 0, max_value: 100, step: 1, unit: '%',
            reveal_html: '<p>The actual figure is about <strong>30%</strong>. Your estimate: <span data-exploration-ref="renewables_guess"></span>%.</p>'
        },
        validate: function (c, course) {
            var out = [];
            var dup = ((course && course.screens) || []).filter(function (s) { return s.type === 'exploration' && s.store_key === c.store_key && s.id !== c.id; });
            if (c.store_key && dup.length) out.push({ path: 'store_key', message: 'Storage key "' + c.store_key + '" is already used by screen "' + dup[0].id + '".', level: 'error' });
            if ((c.input_kind === 'choice' || c.input_kind === 'prediction') && util.list(c.choices).length < 2) out.push({ path: 'choices', message: 'Add at least two choices.', level: 'error' });
            if (c.input_kind === 'slider' && Number(c.max_value) <= Number(c.min_value)) out.push({ path: 'max_value', message: 'Slider maximum must be greater than the minimum.', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, kind = c.input_kind || 'text', key = 'x:' + c.store_key;
            ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var form = h('div.els-explore-form');
            var reveal = h('div.els-reveal', { hidden: true, 'aria-live': 'polite' });
            var value = null, input;
            if (kind === 'text') {
                input = h('textarea.els-textarea', { rows: '4', maxlength: '500', placeholder: c.placeholder || t('typeHere'), 'aria-label': util.stripHtml(c.prompt_html).slice(0, 120) });
                form.appendChild(input);
            } else if (kind === 'slider') {
                var min = Number(c.min_value) || 0, max = Number(c.max_value), step = Number(c.step) || 1;
                if (!isFinite(max)) max = 100;
                var out = h('output.els-slider-out', { text: String(Math.round((min + max) / 2 / step) * step) + (c.unit || '') });
                input = h('input.els-slider', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(Math.round((min + max) / 2 / step) * step), 'aria-label': t('sliderValue'), 'data-prevent-swipe': '' });
                input.addEventListener('input', function () { out.textContent = input.value + (c.unit || ''); });
                input.addEventListener('keydown', function (e) { e.stopPropagation(); });
                form.appendChild(h('div.els-slider-wrap', h('span.els-muted', { text: min + (c.unit || '') }), input, h('span.els-muted', { text: max + (c.unit || '') })));
                form.appendChild(out);
            } else {
                var grp = h('div.els-options', { role: 'radiogroup' });
                util.list(c.choices).forEach(function (ch, i) {
                    var b = h('button.els-option', { type: 'button', role: 'radio', 'aria-checked': 'false', tabindex: i ? '-1' : '0' }, h('span.els-option-key', { text: String.fromCharCode(65 + i) }), h('span.els-option-text', { text: ch }));
                    b.addEventListener('click', function () {
                        if (form.classList.contains('is-locked')) return;
                        value = ch;
                        Array.prototype.forEach.call(grp.children, function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); x.classList.toggle('is-selected', x === b); });
                    });
                    grp.appendChild(b);
                });
                ELS.ui.roving(grp, '.els-option');
                form.appendChild(grp);
            }
            var submit = ELS.ui.button(t('submit'), save, 'primary');
            var edit = ELS.ui.button(t('reset'), unlock, 'ghost');
            edit.hidden = true;
            var msg = h('span.els-attempts');
            form.appendChild(h('div.els-actions', submit, edit, msg));
            ctx.el.appendChild(form);
            ctx.el.appendChild(reveal);
            function current() {
                if (kind === 'text') return input.value.trim();
                if (kind === 'slider') return Number(input.value);
                return value;
            }
            function save() {
                var v = current();
                if (v === null || v === '' || (kind === 'text' && v.length < (Number(c.min_length) || 1))) {
                    msg.textContent = kind === 'text' && c.min_length ? t('answerFirst') + ' (' + c.min_length + '+)' : t('answerFirst');
                    return;
                }
                ctx.setVar(key, v);
                ctx.complete();
                lock(v);
            }
            function lock(v) {
                form.classList.add('is-locked');
                if (input) input.disabled = true;
                submit.hidden = true; edit.hidden = false;
                msg.innerHTML = ELS.icons.check + ' ' + util.esc(t('saved'));
                if (!util.isEmpty(c.reveal_html)) {
                    reveal.innerHTML = '';
                    reveal.appendChild(h('div.els-reveal-head', h('span', { html: ELS.icons.bulb }), h('strong', { text: kind === 'prediction' ? t('prediction') + ': ' + v : t('reflection') })));
                    reveal.appendChild(h('div.els-prose', { html: c.reveal_html }));
                    // resolve references inside the reveal immediately
                    Array.prototype.forEach.call(reveal.querySelectorAll('[data-exploration-ref]'), function (el) {
                        var rv = ctx.getVar('x:' + el.getAttribute('data-exploration-ref'));
                        el.textContent = rv === undefined ? '—' : String(rv); el.classList.add('els-ref');
                    });
                    reveal.hidden = false;
                    ELS.anim.pulse(reveal, 'els-pop');
                }
            }
            function unlock() {
                form.classList.remove('is-locked');
                if (input) input.disabled = false;
                submit.hidden = false; edit.hidden = true; msg.textContent = ''; reveal.hidden = true;
            }
            var prev = ctx.getVar(key);
            if (prev !== undefined && prev !== null) {
                if (kind === 'text' || kind === 'slider') { input.value = prev; if (kind === 'slider') input.dispatchEvent(new Event('input')); }
                else { value = prev; Array.prototype.forEach.call(form.querySelectorAll('.els-option'), function (b) { var on = b.querySelector('.els-option-text').textContent === prev; b.classList.toggle('is-selected', on); b.setAttribute('aria-checked', on); }); }
                lock(prev);
            }
        }
    });

    /* ================================================================== *
     * WORKED EXAMPLE (with fading)
     * ================================================================== */
    R.register({
        type: 'worked_example', label: 'Worked example', category: 'scenario', icon: ELS.icons.worked,
        requiresInteraction: function (c) { return c.fading === 'problem_only'; },
        description: 'A solved problem shown step by step, with optional fading of rationale.',
        fields: [
            { key: 'intro_html', label: 'Problem statement', type: 'html' },
            { key: 'steps', label: 'Steps', type: 'list', minItems: 2, itemLabel: 'Step', fields: [
                { key: 'action_html', label: 'What is done', type: 'html', required: true },
                { key: 'rationale_html', label: 'Why (rationale)', type: 'html', required: true },
                { key: 'image', label: 'Supporting image', type: 'image' },
                { key: 'caption', label: 'Image caption', type: 'text' }
            ] },
            { key: 'fading', label: 'Fading', type: 'select', default: 'full', options: [
                { value: 'full', label: 'Full — show every step and rationale' }, { value: 'partial', label: 'Partial — rationale behind "Why?"' }, { value: 'problem_only', label: 'Problem only — reveal steps one at a time' }] },
            { key: 'self_explanation_prompt_html', label: 'Self-explanation prompt', type: 'html', help: 'Optional free-text reflection (kept in the course state, not sent to the LMS).' }
        ],
        template: {
            title: 'Worked example: household carbon', intro_html: '<p>A household uses <strong>3,000 kWh</strong> of electricity a year. The grid emits <strong>0.4 kg CO₂ per kWh</strong>. What are its yearly emissions?</p>', fading: 'partial',
            steps: [
                { action_html: '<p>Identify the formula: <em>emissions = energy × emission factor</em>.</p>', rationale_html: '<p>Each unit of energy carries a fixed amount of CO₂.</p>' },
                { action_html: '<p>Multiply: 3,000 × 0.4 = <strong>1,200 kg</strong>.</p>', rationale_html: '<p>The units kWh cancel out, leaving kg of CO₂.</p>' },
                { action_html: '<p>Convert: 1,200 kg = <strong>1.2 tonnes CO₂</strong> per year.</p>', rationale_html: '<p>Tonnes make large quantities easier to compare.</p>' }
            ],
            self_explanation_prompt_html: '<p>In your own words: why do the kWh units cancel out?</p>'
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, steps = c.steps || [], fading = c.fading || 'full';
            if (c.intro_html) ctx.el.appendChild(h('div.els-problem', h('span.els-problem-icon', { html: ELS.icons.bulb }), h('div.els-prose', { html: c.intro_html })));
            var list = h('ol.els-worked');
            var shown = fading === 'problem_only' ? ((ctx.stored() || {}).n || 0) : steps.length;
            var items = steps.map(function (s, i) {
                var why = h('div.els-worked-why', h('strong', { text: t('showRationale') + ' ' }), h('div', { html: s.rationale_html || '' }));
                var li = h('li.els-worked-step', h('span.els-worked-num', { text: String(i + 1) }),
                    h('div.els-worked-body', h('div.els-prose', { html: s.action_html || '' }), s.image ? h('figure.els-figure', ELS.ui.image(s.image, s.caption || ''), s.caption ? h('figcaption', { text: s.caption }) : null) : null, why));
                if (fading === 'partial') {
                    why.hidden = true;
                    var btn = ELS.ui.button(ELS.icons.info + '<span>' + util.esc(t('showRationale')) + '</span>', function () { why.hidden = !why.hidden; btn.setAttribute('aria-expanded', !why.hidden); if (!why.hidden) ELS.anim.pulse(why, 'els-fade-in'); }, 'link', { 'aria-expanded': 'false' });
                    li.querySelector('.els-worked-body').insertBefore(btn, why);
                }
                list.appendChild(li);
                return li;
            });
            ctx.el.appendChild(list);
            var more = null;
            function paint() {
                items.forEach(function (li, i) { li.hidden = i >= shown; });
                if (more) more.hidden = shown >= steps.length;
                // Only the step-by-step reveal needs interaction; other modes complete on view.
                if (fading === 'problem_only' && shown >= steps.length) ctx.complete();
            }
            if (fading === 'problem_only') {
                more = ELS.ui.button(ELS.icons.plus + '<span>' + util.esc(t('revealStep')) + '</span>', function () {
                    shown = Math.min(steps.length, shown + 1);
                    var s = ctx.stored() || {}; s.n = shown; ctx.store(s);
                    paint();
                    ELS.anim.pulse(items[shown - 1], 'els-fade-in');
                }, 'primary');
                ctx.el.appendChild(h('div.els-actions', more));
            } else ELS.anim.stagger(list);
            paint();
            if (!util.isEmpty(c.self_explanation_prompt_html)) {
                var st = ctx.stored() || {};
                var ta = h('textarea.els-textarea', { rows: '3', maxlength: '500', placeholder: t('yourExplanation'), 'aria-label': util.stripHtml(c.self_explanation_prompt_html) });
                ta.value = st.e || '';
                var savedNote = h('span.els-attempts');
                ta.addEventListener('input', util.debounce(function () { var s = ctx.stored() || {}; s.e = ta.value.slice(0, 500); ctx.store(s); savedNote.textContent = t('saved'); }, 600));
                ctx.el.appendChild(h('div.els-self-explain', h('div.els-prose', { html: c.self_explanation_prompt_html }), ta, savedNote));
            }
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
