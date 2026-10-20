/**
 * Gamification screens: game (quiz show / memory / word scramble),
 * term_match_race, escape_room, adaptive_practice.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS, util = ELS.util, h = ELS.h, R = ELS.registry;

    /** Shared "attempt" bookkeeping for game-style screens (best score is kept). */
    function gameAttempts(ctx) {
        var c = ctx.cfg;
        var max = Number(c.attempts); if (!isFinite(max) || max < 0) max = 2;
        var used = ctx.saved ? ctx.saved.a || 1 : 0;
        var bestRatio = ctx.saved ? (ctx.saved.m ? ctx.saved.s / ctx.saved.m : 0) : 0;
        var finalized = !!(ctx.saved && ctx.saved.f);
        return {
            max: max,
            used: function () { return used; },
            final: function () { return finalized; },
            left: function () { return max === 0 ? Infinity : Math.max(0, max - used); },
            /** Record a finished run; returns whether it is final. */
            finish: function (ratio, passed, response, interaction) {
                used++;
                var keep = Math.max(ratio, bestRatio);
                bestRatio = keep;
                finalized = passed || (max > 0 && used >= max);
                ctx.score({ ratio: keep, correct: passed || (ctx.saved && ctx.saved.c === 1), final: finalized, attempts: used, response: response, interaction: interaction });
                return finalized;
            },
            best: function () { return bestRatio; }
        };
    }
    ELS.gameAttempts = gameAttempts;

    function hud(items) {
        var bar = h('div.els-hud');
        items.forEach(function (it) { if (it) bar.appendChild(it); });
        return bar;
    }
    function stat(icon, label) {
        var val = h('strong');
        var el = h('span.els-hud-stat', { title: label }, h('span', { html: ELS.icons[icon] }), h('span.els-sr-only', { text: label }), val);
        return { el: el, set: function (v) { val.textContent = v; ELS.anim.pulse(el, 'els-pop'); } };
    }
    function timerBar() {
        var fill = h('i');
        var el = h('div.els-timer', { role: 'timer', 'aria-live': 'off' }, fill);
        return { el: el, set: function (frac) { fill.style.width = (util.clamp(frac, 0, 1) * 100) + '%'; el.classList.toggle('is-low', frac < 0.25); } };
    }
    /** Interval-based countdown that pauses when the screen is left. */
    function countdown(ctx, seconds, onTick, onEnd) {
        var left = seconds, iv = null, running = false, wanted = false;
        function tick() { left = Math.max(0, left - 0.1); onTick(left); if (left <= 0) { stop(); onEnd(); } }
        function run() { if (running || seconds <= 0 || left <= 0) return; running = true; iv = setInterval(tick, 100); }
        function pause() { running = false; clearInterval(iv); }
        function start() { wanted = true; run(); }
        function stop() { wanted = false; pause(); }
        // Leaving the screen pauses the clock; coming back resumes an unfinished round.
        ctx.onLeave(pause);
        ctx.onEnter(function () { if (wanted) run(); });
        ctx.onDestroy(stop);
        return { start: start, stop: stop, left: function () { return left; }, add: function (d) { left = Math.max(0, left + d); }, reset: function (s) { stop(); left = s === undefined ? seconds : s; } };
    }
    function endCard(ctx, title, kind, detail, html, again) {
        var fb = ELS.ui.feedback();
        fb.show(kind, title + (detail ? ' · ' + detail : ''), html || '');
        var box = h('div.els-game-end', fb.el);
        if (again) box.appendChild(h('div.els-actions', again));
        return box;
    }

    /* ================================================================== *
     * GAME (configurable templates)
     * ================================================================== */
    R.register({
        type: 'game', label: 'Educational game', category: 'game', icon: ELS.icons.game, scored: true,
        points: function (c) { return c.points === undefined ? 25 : c.points; },
        description: 'Configurable game: quiz show with lives & streaks, memory match, or word scramble.',
        fields: [
            { key: 'intro_html', label: 'Intro', type: 'html' },
            { key: 'template', label: 'Game template', type: 'select', default: 'quiz_show', options: [
                { value: 'quiz_show', label: 'Quiz show (timer, lives, streaks)' }, { value: 'memory', label: 'Memory match' }, { value: 'word_scramble', label: 'Word scramble' }] },
            { key: 'questions', label: 'Questions', type: 'list', minItems: 1, itemLabel: 'Question', showIf: { template: 'quiz_show' }, fields: [
                { key: 'prompt', label: 'Question', type: 'text', required: true },
                { key: 'options', label: 'Options', type: 'strings', required: true },
                { key: 'correct', label: 'Correct option number (1 = first)', type: 'number', min: 1, default: 1 },
                { key: 'explanation', label: 'Explanation', type: 'text' }
            ] },
            { key: 'pairs', label: 'Card pairs', type: 'list', minItems: 2, maxItems: 12, itemLabel: 'Pair', showIf: { template: 'memory' }, fields: [
                { key: 'a', label: 'Card A', type: 'text', required: true },
                { key: 'b', label: 'Matching card B', type: 'text', required: true }
            ] },
            { key: 'words', label: 'Words', type: 'list', minItems: 1, itemLabel: 'Word', showIf: { template: 'word_scramble' }, fields: [
                { key: 'word', label: 'Word', type: 'text', required: true },
                { key: 'clue', label: 'Clue', type: 'text', required: true }
            ] },
            { key: 'lives', label: 'Lives (0 = unlimited)', type: 'number', min: 0, max: 10, default: 3, showIf: { template: ['quiz_show', 'word_scramble'] } },
            { key: 'seconds_per_question', label: 'Seconds per question (0 = no timer)', type: 'number', min: 0, max: 300, default: 20, showIf: { template: 'quiz_show' } },
            { key: 'time_limit_sec', label: 'Overall time limit in seconds (0 = none)', type: 'number', min: 0, max: 1800, default: 0, showIf: { template: ['memory', 'word_scramble'] } },
            { key: 'hints', label: 'Hints available', type: 'number', min: 0, max: 20, default: 2, showIf: { template: 'word_scramble' } },
            { key: 'pass_ratio', label: 'Pass ratio (0–1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.6 },
            { key: 'points', label: 'Course points', type: 'number', min: 0, default: 25 },
            { key: 'attempts', label: 'Plays counted (0 = unlimited)', type: 'number', min: 0, max: 20, default: 3 },
            { key: 'feedback', label: 'Feedback', type: 'group', fields: [{ key: 'correct', label: 'Win', type: 'html' }, { key: 'incorrect', label: 'Lose', type: 'html' }] }
        ],
        template: {
            title: 'Eco quiz show', intro_html: '<p>Answer fast to build a streak. You have three lives!</p>', template: 'quiz_show', lives: 3, seconds_per_question: 20, pass_ratio: 0.6, points: 25, attempts: 3,
            questions: [
                { prompt: 'Which gas is the main driver of climate change?', options: ['Oxygen', 'Carbon dioxide', 'Helium'], correct: 2, explanation: 'CO₂ from burning fossil fuels.' },
                { prompt: 'Which of these is biodegradable?', options: ['Plastic bag', 'Apple core', 'Glass jar'], correct: 2 },
                { prompt: 'What does LED lighting save compared to old bulbs?', options: ['About 10%', 'About 80%', 'Nothing'], correct: 2, explanation: 'LEDs use up to 80% less energy.' },
                { prompt: 'Which transport mode has the lowest emissions per km?', options: ['Bicycle', 'Car', 'Plane'], correct: 1 }
            ],
            pairs: [{ a: 'Solar', b: 'Sun' }, { a: 'Wind', b: 'Turbine' }, { a: 'Hydro', b: 'River' }, { a: 'Geothermal', b: 'Earth heat' }],
            words: [{ word: 'compost', clue: 'Decomposed organic matter used as fertiliser' }, { word: 'glacier', clue: 'Slow-moving river of ice' }],
            feedback: { correct: '<p>You won! Great knowledge.</p>', incorrect: '<p>Game over — play again to improve your score.</p>' }
        },
        validate: function (c) {
            var out = [], tpl = c.template || 'quiz_show';
            if (tpl === 'quiz_show') (c.questions || []).forEach(function (q, i) {
                var n = util.list(q.options).length;
                if (n < 2) out.push({ path: 'questions[' + i + '].options', message: 'Question ' + (i + 1) + ' needs at least two options.', level: 'error' });
                else if (!(q.correct >= 1 && q.correct <= n)) out.push({ path: 'questions[' + i + '].correct', message: 'Question ' + (i + 1) + ': correct option must be 1–' + n + '.', level: 'error' });
            });
            if (tpl === 'quiz_show' && !(c.questions || []).length) out.push({ path: 'questions', message: 'Add at least one question.', level: 'error' });
            if (tpl === 'memory' && (c.pairs || []).length < 2) out.push({ path: 'pairs', message: 'Add at least two pairs.', level: 'error' });
            if (tpl === 'word_scramble' && !(c.words || []).length) out.push({ path: 'words', message: 'Add at least one word.', level: 'error' });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, tpl = c.template || 'quiz_show';
            var att = gameAttempts(ctx);
            var passRatio = c.pass_ratio === undefined ? 0.6 : Number(c.pass_ratio);
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var arena = h('div.els-game.is-' + tpl);
            ctx.el.appendChild(arena);
            function splash(again) {
                arena.innerHTML = '';
                var best = att.used() ? h('p.els-muted', { text: t('yourScore') + ': ' + Math.round(att.best() * 100) + '%' }) : null;
                var startBtn = ELS.ui.button(ELS.icons.play + '<span>' + util.esc(again ? t('playAgain') : t('start')) + '</span>', play, 'primary lg');
                arena.appendChild(h('div.els-game-splash', h('span.els-game-icon', { html: ELS.icons.game }), best,
                    att.final() ? h('p', { text: t('alreadyDone') }) : null,
                    !att.final() ? startBtn : null,
                    !att.final() && att.max ? h('span.els-attempts', { text: t('attemptsLeft', { n: att.left() }) }) : null));
            }
            function done(ratio, won, detail, response) {
                var passed = ratio >= passRatio && won !== false;
                var final = att.finish(ratio, passed, response, { type: 'performance', response: tpl + ' ' + Math.round(ratio * 100) + '%', description: c.title });
                var fbc = c.feedback || {};
                arena.innerHTML = '';
                arena.appendChild(endCard(ctx, passed ? t('youWin') : t('gameOver'), passed ? 'correct' : 'incorrect',
                    detail + ' · ' + t('pointsOf', { a: Math.round(att.best() * ctx.maxPoints), b: ctx.maxPoints }), passed ? fbc.correct : fbc.incorrect,
                    final ? null : ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('playAgain')) + '</span>', play, 'ghost')));
                if (passed) ELS.anim.confetti(arena);
            }
            function play() {
                arena.innerHTML = '';
                if (tpl === 'memory') memory(); else if (tpl === 'word_scramble') scramble(); else quizShow();
            }

            /* ---- Quiz show ---- */
            function quizShow() {
                var qs = c.questions || [], i = 0, lives = Number(c.lives) || 0, score = 0, streak = 0, correct = 0;
                var sLives = stat('heart', t('lives')), sScore = stat('star', t('score')), sStreak = stat('adaptive', t('streak'));
                var tb = timerBar();
                var stage = h('div.els-game-stage', { 'aria-live': 'polite' });
                arena.appendChild(hud([lives ? sLives.el : null, sScore.el, sStreak.el]));
                if (Number(c.seconds_per_question) > 0) arena.appendChild(tb.el);
                arena.appendChild(stage);
                sLives.set(lives ? '♥'.repeat(lives) : ''); sScore.set(0); sStreak.set(0);
                var per = Number(c.seconds_per_question) || 0;
                var cd = countdown(ctx, per, function (left) { tb.set(left / per); }, function () { answer(-1); });
                function ask() {
                    if (i >= qs.length || (c.lives > 0 && lives <= 0)) return finish();
                    var q = qs[i];
                    stage.innerHTML = '';
                    stage.appendChild(h('p.els-badge', { text: t('round', { a: i + 1, b: qs.length }) }));
                    stage.appendChild(h('h3.els-game-q', { text: q.prompt }));
                    var grid = h('div.els-game-options');
                    util.list(q.options).forEach(function (o, k) {
                        grid.appendChild(ELS.ui.button('<span class="els-option-key">' + String.fromCharCode(65 + k) + '</span><span>' + util.esc(o) + '</span>', function () { answer(k); }, 'game-opt'));
                    });
                    stage.appendChild(grid);
                    ELS.anim.stagger(grid);
                    cd.reset(per); tb.set(1); cd.start();
                    setTimeout(function () { var b = grid.querySelector('button'); if (b && ctx.isActive()) b.focus(); }, 60);
                }
                function answer(k) {
                    cd.stop();
                    var q = qs[i], right = k + 1 === Number(q.correct);
                    var btns = stage.querySelectorAll('.els-game-options button');
                    Array.prototype.forEach.call(btns, function (b, n) { b.disabled = true; if (n + 1 === Number(q.correct)) b.classList.add('is-correct'); else if (n === k) b.classList.add('is-wrong'); });
                    if (right) {
                        correct++; streak++;
                        var bonus = per ? Math.round(50 * cd.left() / per) : 0;
                        score += 100 + bonus + (streak > 1 ? (streak - 1) * 25 : 0);
                        ELS.anim.confetti(stage);
                    } else {
                        streak = 0;
                        if (c.lives > 0) { lives--; sLives.set(lives ? '♥'.repeat(lives) : '✕'); }
                        ELS.anim.pulse(stage, 'els-shake');
                    }
                    sScore.set(score); sStreak.set(streak);
                    var fb = ELS.ui.feedback();
                    fb.show(right ? 'correct' : 'incorrect', k < 0 ? t('timeUp') : t(right ? 'correct' : 'incorrect'), q.explanation ? util.esc(q.explanation) : '');
                    stage.appendChild(fb.el);
                    var nx = ELS.ui.button('<span>' + util.esc(t('next')) + '</span>', function () { i++; ask(); }, 'primary');
                    stage.appendChild(h('div.els-actions', nx));
                    nx.focus();
                }
                function finish() {
                    cd.stop();
                    var won = !(c.lives > 0 && lives <= 0);
                    done(qs.length ? correct / qs.length : 0, won, t('score') + ' ' + score + ' · ' + correct + '/' + qs.length, { s: score, c: correct });
                }
                ask();
            }

            /* ---- Memory ---- */
            function memory() {
                var pairs = c.pairs || [], cards = [];
                pairs.forEach(function (p, i) { cards.push({ k: i, text: p.a }); cards.push({ k: i, text: p.b }); });
                cards = util.shuffle(cards, ctx.rng('mem' + att.used()));
                var moves = 0, found = 0, open = [], busy = false;
                var sMoves = stat('refresh', t('moves')), sFound = stat('star', t('pairsFound', { a: 0, b: pairs.length }));
                var limit = Number(c.time_limit_sec) || 0, tb = timerBar();
                arena.appendChild(hud([sMoves.el, sFound.el]));
                if (limit) arena.appendChild(tb.el);
                var grid = h('div.els-memory', { style: { '--els-cols': cards.length > 12 ? 6 : 4 } });
                arena.appendChild(grid);
                sMoves.set(0); sFound.set('0/' + pairs.length);
                var cd = countdown(ctx, limit, function (left) { tb.set(left / limit); }, function () { end(false); });
                cards.forEach(function (cd2, idx) {
                    var b = h('button.els-mem-card', { type: 'button', 'aria-label': t('flip') + ' ' + (idx + 1) }, h('span.els-mem-inner', h('span.els-mem-back', { html: ELS.icons.star }), h('span.els-mem-front', { text: cd2.text })));
                    b.addEventListener('click', function () {
                        if (busy || b.classList.contains('is-open') || b.classList.contains('is-matched')) return;
                        if (limit) cd.start();
                        b.classList.add('is-open'); b.setAttribute('aria-label', cd2.text);
                        open.push({ b: b, c: cd2 });
                        if (open.length === 2) {
                            moves++; sMoves.set(moves);
                            if (open[0].c.k === open[1].c.k) {
                                open.forEach(function (o) { o.b.classList.add('is-matched'); o.b.disabled = true; });
                                open = []; found++; sFound.set(found + '/' + pairs.length);
                                if (found === pairs.length) setTimeout(function () { end(true); }, 500);
                            } else {
                                busy = true;
                                setTimeout(function () { open.forEach(function (o) { o.b.classList.remove('is-open'); o.b.setAttribute('aria-label', t('flip')); }); open = []; busy = false; }, 900);
                            }
                        }
                    });
                    grid.appendChild(b);
                });
                function end(complete) {
                    cd.stop();
                    var n = pairs.length;
                    var ratio = complete ? util.clamp(1 - (moves - n) / (n * 3), 0.3, 1) : found / n * 0.5;
                    done(ratio, complete, t('moves') + ' ' + moves + ' · ' + t('pairsFound', { a: found, b: n }), { m: moves, f: found });
                }
            }

            /* ---- Word scramble ---- */
            function scramble() {
                var words = c.words || [], i = 0, solved = 0, lives = Number(c.lives) || 0, hints = Number(c.hints) || 0, hinted = 0;
                var sLives = stat('heart', t('lives')), sHints = stat('bulb', t('hint')), sSolved = stat('star', t('score'));
                var limit = Number(c.time_limit_sec) || 0, tb = timerBar();
                arena.appendChild(hud([lives ? sLives.el : null, sHints.el, sSolved.el]));
                if (limit) arena.appendChild(tb.el);
                var stage = h('div.els-game-stage', { 'aria-live': 'polite' });
                arena.appendChild(stage);
                sLives.set(lives ? '♥'.repeat(lives) : ''); sHints.set(hints); sSolved.set('0/' + words.length);
                var cd = countdown(ctx, limit, function (left) { tb.set(left / limit); }, function () { finish(false); });
                if (limit) cd.start();
                function ask() {
                    if (i >= words.length) return finish(true);
                    var w = String(words[i].word || '');
                    var letters = w.split('');
                    var mixed = util.shuffle(letters, ctx.rng('w' + i + att.used()), true).join('');
                    if (mixed.toLowerCase() === w.toLowerCase() && w.length > 1) mixed = w.split('').reverse().join('');
                    var reveal = 0;
                    stage.innerHTML = '';
                    stage.appendChild(h('p.els-badge', { text: t('round', { a: i + 1, b: words.length }) }));
                    stage.appendChild(h('p.els-game-clue', { text: words[i].clue }));
                    stage.appendChild(h('div.els-scramble', { dir: 'auto' }, mixed.split('').map(function (ch) { return h('span', { text: ch.toUpperCase() }); })));
                    var inp = h('input.els-input.els-scramble-input', { type: 'text', autocomplete: 'off', 'aria-label': words[i].clue, dir: 'auto' });
                    var hintLine = h('p.els-muted');
                    var go = ELS.ui.button(t('submit'), submit, 'primary');
                    var hintBtn = ELS.ui.button(ELS.icons.bulb + '<span>' + util.esc(t('showHint')) + '</span>', function () {
                        if (hints <= 0) return;
                        hints--; hinted++; reveal++; sHints.set(hints);
                        hintLine.textContent = w.slice(0, reveal).toUpperCase() + '…';
                        hintBtn.disabled = hints <= 0 || reveal >= w.length - 1;
                    }, 'ghost');
                    hintBtn.disabled = hints <= 0;
                    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
                    stage.appendChild(h('div.els-inline-form', inp, go, hintBtn));
                    stage.appendChild(hintLine);
                    setTimeout(function () { if (ctx.isActive()) inp.focus(); }, 60);
                    function submit() {
                        if (util.normalizeAnswer(inp.value) === util.normalizeAnswer(w)) {
                            solved++; sSolved.set(solved + '/' + words.length);
                            ELS.anim.confetti(stage);
                            i++; setTimeout(ask, 600);
                        } else {
                            ELS.anim.pulse(stage, 'els-shake');
                            if (lives > 0) { lives--; sLives.set(lives ? '♥'.repeat(lives) : '✕'); if (!lives) return finish(false); }
                            inp.select();
                        }
                    }
                }
                function finish(complete) {
                    cd.stop();
                    var ratio = words.length ? util.clamp((solved - hinted * 0.25) / words.length, 0, 1) : 0;
                    done(ratio, complete, solved + '/' + words.length, { s: solved, h: hinted });
                }
                ask();
            }
            splash(false);
        }
    });

    /* ================================================================== *
     * TERM MATCH RACE
     * ================================================================== */
    R.register({
        type: 'term_match_race', label: 'Term match race', category: 'game', icon: ELS.icons.race, scored: true,
        points: function (c) { return c.points === undefined ? 15 : c.points; },
        description: 'Timed race to match terms with their definitions.',
        fields: [
            { key: 'prompt_html', label: 'Instructions', type: 'html' },
            { key: 'pairs', label: 'Terms', type: 'list', minItems: 2, maxItems: 16, itemLabel: 'Term', fields: [
                { key: 'term_html', label: 'Term', type: 'text', required: true },
                { key: 'definition_html', label: 'Definition', type: 'text', required: true }
            ] },
            { key: 'time_limit_sec', label: 'Time limit (seconds)', type: 'number', min: 10, max: 600, default: 60 },
            { key: 'penalty_sec', label: 'Time penalty for a wrong match (seconds)', type: 'number', min: 0, max: 30, default: 3 },
            { key: 'points', label: 'Points', type: 'number', min: 0, default: 15 },
            { key: 'attempts', label: 'Races counted (0 = unlimited)', type: 'number', min: 0, max: 20, default: 3 }
        ],
        template: {
            title: 'Vocabulary race', prompt_html: '<p>Match every term to its definition before time runs out. Wrong matches cost 3 seconds.</p>', time_limit_sec: 60, penalty_sec: 3, points: 15, attempts: 3,
            pairs: [{ term_html: 'Emission', definition_html: 'Gas released into the air' }, { term_html: 'Habitat', definition_html: 'Where an organism lives' }, { term_html: 'Renewable', definition_html: 'Naturally replenished' }, { term_html: 'Pollutant', definition_html: 'Substance that contaminates' }, { term_html: 'Conservation', definition_html: 'Protection of nature' }]
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, pairs = c.pairs || [];
            var att = gameAttempts(ctx);
            var limit = Number(c.time_limit_sec) || 60, penalty = Number(c.penalty_sec);
            if (!isFinite(penalty)) penalty = 3;
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var arena = h('div.els-race');
            ctx.el.appendChild(arena);
            function splash() {
                arena.innerHTML = '';
                arena.appendChild(h('div.els-game-splash', h('span.els-game-icon', { html: ELS.icons.race }),
                    h('p', { text: t('timeLeft') + ': ' + util.formatClock(limit) }),
                    att.used() ? h('p.els-muted', { text: t('yourScore') + ': ' + Math.round(att.best() * 100) + '%' }) : null,
                    att.final() ? h('p', { text: t('alreadyDone') }) : ELS.ui.button(ELS.icons.play + '<span>' + util.esc(t('go')) + '</span>', race, 'primary lg'),
                    !att.final() && att.max ? h('span.els-attempts', { text: t('attemptsLeft', { n: att.left() }) }) : null));
            }
            function race() {
                arena.innerHTML = '';
                var matched = 0, wrong = 0, sel = null, over = false;
                var clock = stat('clock', t('timeLeft')), prog = stat('star', t('matched', { a: 0, b: pairs.length }));
                var tb = timerBar();
                arena.appendChild(hud([clock.el, prog.el]));
                arena.appendChild(tb.el);
                var colT = h('div.els-race-col'), colD = h('div.els-race-col');
                var board = h('div.els-race-board', colT, colD);
                arena.appendChild(board);
                clock.set(util.formatClock(limit)); prog.set('0/' + pairs.length);
                var cd = countdown(ctx, limit, function (left) { tb.set(left / limit); clock.el.querySelector('strong').textContent = util.formatClock(left); }, function () { finish(); });
                var terms = util.shuffle(pairs.map(function (_, i) { return i; }), ctx.rng('rt' + att.used()));
                var defs = util.shuffle(pairs.map(function (_, i) { return i; }), ctx.rng('rd' + att.used()), true);
                var tBtns = {}, dBtns = {};
                terms.forEach(function (i) {
                    var b = ELS.ui.button(util.esc(pairs[i].term_html), function () { if (over) return; sel = sel === i ? null : i; paint(); }, 'race-item');
                    tBtns[i] = b; colT.appendChild(b);
                });
                defs.forEach(function (i) {
                    var b = ELS.ui.button(util.esc(pairs[i].definition_html), function () {
                        if (over || sel === null) { if (sel === null && !over) ELS.anim.pulse(colT, 'els-shake'); return; }
                        if (sel === i) {
                            [tBtns[i], b].forEach(function (x) { x.classList.add('is-matched'); x.disabled = true; });
                            matched++; prog.set(matched + '/' + pairs.length); sel = null;
                            if (matched === pairs.length) finish();
                            else { var nxt = colT.querySelector('button:not([disabled])'); if (nxt) nxt.focus(); }
                        } else {
                            wrong++; cd.add(-penalty);
                            b.classList.add('is-wrong'); ELS.anim.pulse(b, 'els-shake');
                            setTimeout(function () { b.classList.remove('is-wrong'); }, 600);
                        }
                        paint();
                    }, 'race-item is-def');
                    dBtns[i] = b; colD.appendChild(b);
                });
                function paint() { Object.keys(tBtns).forEach(function (k) { tBtns[k].classList.toggle('is-selected', String(sel) === k); tBtns[k].setAttribute('aria-pressed', String(sel) === k ? 'true' : 'false'); }); board.classList.toggle('has-selection', sel !== null); }
                cd.start();
                var first = colT.querySelector('button'); if (first) first.focus();
                function finish() {
                    if (over) return;
                    over = true; cd.stop();
                    var all = matched === pairs.length;
                    var ratio = (matched / pairs.length) * 0.8 + (all ? 0.2 * (cd.left() / limit) : 0);
                    var final = att.finish(util.clamp(ratio, 0, 1), all, { m: matched, w: wrong, l: Math.round(cd.left()) },
                        { type: 'matching', response: Object.keys(tBtns).filter(function (k) { return tBtns[k].disabled; }).map(function (k) { return [Number(k), Number(k)]; }), correct: pairs.map(function (_, i) { return [i, i]; }), description: c.title });
                    var end = endCard(ctx, all ? t('youWin') : t('timeUp'), all ? 'correct' : 'partial',
                        t('matched', { a: matched, b: pairs.length }) + (all ? ' · ' + t('timeBonus') + ' +' + Math.round(20 * cd.left() / limit) + '%' : '') + ' · ' + t('pointsOf', { a: Math.round(att.best() * ctx.maxPoints), b: ctx.maxPoints }),
                        '', final ? null : ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('playAgain')) + '</span>', race, 'ghost'));
                    arena.appendChild(end);
                    if (all) ELS.anim.confetti(arena);
                    var btn = end.querySelector('button'); if (btn) btn.focus();
                }
            }
            splash();
        }
    });

    /* ================================================================== *
     * ESCAPE ROOM
     * ================================================================== */
    R.register({
        type: 'escape_room', label: 'Escape room', category: 'game', icon: ELS.icons.escape, scored: true,
        points: function (c) { return c.points === undefined ? 20 : c.points; },
        description: 'Solve a sequence of locked puzzles before you run out of lives.',
        fields: [
            { key: 'intro_html', label: 'Story intro', type: 'html' },
            { key: 'puzzles', label: 'Locks / puzzles', type: 'list', minItems: 1, itemLabel: 'Puzzle', fields: [
                { key: 'id', type: 'id' },
                { key: 'prompt_html', label: 'Puzzle', type: 'html', required: true },
                { key: 'image', label: 'Clue image', type: 'image' },
                { key: 'image_alt', label: 'Image alt text', type: 'text', showIf: function (p) { return !!p.image; } },
                { key: 'accepted', label: 'Accepted answers', type: 'strings', required: true },
                { key: 'hint_html', label: 'Hint (after a wrong answer)', type: 'html' },
                { key: 'case_sensitive', label: 'Case sensitive', type: 'bool', default: false }
            ] },
            { key: 'lives', label: 'Lives', type: 'number', min: 1, max: 10, default: 3 },
            { key: 'points', label: 'Points', type: 'number', min: 0, default: 20 },
            { key: 'attempts', label: 'Attempts (0 = unlimited)', type: 'number', min: 0, max: 20, default: 2 },
            { key: 'success_html', label: 'Escape message', type: 'html' },
            { key: 'fail_html', label: 'Failure message', type: 'html' }
        ],
        template: {
            title: 'Escape the greenhouse', intro_html: '<p>The greenhouse door is locked by three puzzles. Solve them to get out!</p>', lives: 3, points: 20, attempts: 2,
            puzzles: [
                { id: 'p1', prompt_html: '<p>Lock 1: What gas do plants absorb? <em>(chemical formula)</em></p>', accepted: ['CO2', 'CO₂'], hint_html: '<p>Carbon + two oxygens.</p>' },
                { id: 'p2', prompt_html: '<p>Lock 2: How many legs does an insect have?</p>', accepted: ['6', 'six'], hint_html: '<p>More than four, fewer than eight.</p>' },
                { id: 'p3', prompt_html: '<p>Lock 3: Unscramble: <strong>L O S A R</strong></p>', accepted: ['solar'], hint_html: '<p>Related to the sun.</p>' }
            ],
            success_html: '<p>The door swings open — you escaped!</p>', fail_html: '<p>The door stays shut. Review the hints and try again.</p>'
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, puzzles = c.puzzles || [];
            var att = gameAttempts(ctx);
            if (c.intro_html) ctx.el.appendChild(ELS.ui.prompt(c.intro_html));
            var room = h('div.els-escape');
            ctx.el.appendChild(room);
            function splash() {
                room.innerHTML = '';
                var door = h('div.els-door' + (ctx.saved && ctx.saved.c ? '.is-open' : ''), h('span', { html: ctx.saved && ctx.saved.c ? ELS.icons.unlock : ELS.icons.lock }));
                room.appendChild(h('div.els-game-splash', door,
                    att.used() ? h('p.els-muted', { text: t('yourScore') + ': ' + Math.round(att.best() * 100) + '%' }) : null,
                    att.final() ? h('p', { text: ctx.saved && ctx.saved.c ? t('escaped') : t('alreadyDone') }) : ELS.ui.button(ELS.icons.play + '<span>' + util.esc(att.used() ? t('playAgain') : t('start')) + '</span>', play, 'primary lg'),
                    !att.final() && att.max ? h('span.els-attempts', { text: t('attemptsLeft', { n: att.left() }) }) : null));
            }
            function play() {
                room.innerHTML = '';
                var i = 0, lives = Number(c.lives) || 3, solved = 0, errors = 0;
                var locks = h('div.els-locks', puzzles.map(function (_, k) { return h('span.els-lock', { html: ELS.icons.lock, 'aria-label': t('puzzleOf', { a: k + 1, b: puzzles.length }) }); }));
                var sLives = stat('heart', t('lives'));
                room.appendChild(hud([sLives.el, locks]));
                sLives.set('♥'.repeat(lives));
                var stage = h('div.els-escape-stage', { 'aria-live': 'polite' });
                room.appendChild(stage);
                function show() {
                    if (i >= puzzles.length) return end(true);
                    var p = puzzles[i];
                    Array.prototype.forEach.call(locks.children, function (l, k) { l.classList.toggle('is-current', k === i); });
                    stage.innerHTML = '';
                    var inp = h('input.els-input', { type: 'text', autocomplete: 'off', 'aria-label': t('yourAnswer'), placeholder: t('typeHere') });
                    var fb = ELS.ui.feedback();
                    var go = ELS.ui.button(ELS.icons.unlock + '<span>' + util.esc(t('unlock')) + '</span>', submit, 'primary');
                    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
                    stage.appendChild(h('div.els-escape-card', h('span.els-badge', { text: t('puzzleOf', { a: i + 1, b: puzzles.length }) }),
                        h('div.els-prose', { html: p.prompt_html || '' }), p.image ? ELS.ui.image(p.image, p.image_alt, 'els-escape-img') : null,
                        h('div.els-inline-form', inp, go), fb.el));
                    ELS.anim.pulse(stage.firstChild, 'els-fade-in');
                    setTimeout(function () { if (ctx.isActive()) inp.focus(); }, 60);
                    function submit() {
                        if (!inp.value.trim()) return;
                        var ok = util.list(p.accepted).some(function (a) { return util.normalizeAnswer(a, p.case_sensitive) === util.normalizeAnswer(inp.value, p.case_sensitive); });
                        if (ok) {
                            solved++;
                            var lk = locks.children[i]; lk.innerHTML = ELS.icons.unlock; lk.classList.add('is-open');
                            ELS.anim.pulse(lk, 'els-pop');
                            i++; inp.disabled = true; go.disabled = true;
                            fb.show('correct', t('correct'));
                            setTimeout(show, 700);
                        } else {
                            lives--; errors++;
                            sLives.set(lives > 0 ? '♥'.repeat(lives) : '✕');
                            ELS.anim.pulse(stage, 'els-shake');
                            if (lives <= 0) return end(false);
                            fb.show('incorrect', t('wrongCode') + ' ' + t('livesLeft', { n: lives }), p.hint_html || '');
                            inp.select();
                        }
                    }
                }
                function end(escaped) {
                    var ratio = puzzles.length ? solved / puzzles.length : 0;
                    var final = att.finish(ratio, escaped, { s: solved, e: errors },
                        { type: 'performance', response: 'solved ' + solved + '/' + puzzles.length + ' errors ' + errors, correct: 'solved ' + puzzles.length + '/' + puzzles.length, description: c.title });
                    stage.innerHTML = '';
                    var door = h('div.els-door' + (escaped ? '.is-open' : ''), h('span', { html: escaped ? ELS.icons.unlock : ELS.icons.lock }));
                    stage.appendChild(door);
                    stage.appendChild(endCard(ctx, escaped ? t('escaped') : t('trapped'), escaped ? 'correct' : 'incorrect',
                        t('pointsOf', { a: Math.round(att.best() * ctx.maxPoints), b: ctx.maxPoints }), escaped ? c.success_html : c.fail_html,
                        final ? null : ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('playAgain')) + '</span>', play, 'ghost')));
                    if (escaped) ELS.anim.confetti(stage);
                }
                show();
            }
            splash();
        }
    });

    /* ================================================================== *
     * ADAPTIVE PRACTICE (Elo or Bayesian Knowledge Tracing)
     * ================================================================== */
    var Adaptive = ELS.adaptive = {
        prob: function (theta, b) { return 1 / (1 + Math.exp(-(theta - b))); },
        diff: function (d) { return (util.clamp(Number(d) || 3, 1, 5) - 3); }, // 1..5 -> -2..2
        bkt: { init: 0.3, transit: 0.15, slip: 0.1, guess: 0.2 },
        bktUpdate: function (pL, right) {
            var p = Adaptive.bkt;
            var post = right ? pL * (1 - p.slip) / (pL * (1 - p.slip) + (1 - pL) * p.guess) : pL * p.slip / (pL * p.slip + (1 - pL) * (1 - p.guess));
            return post + (1 - post) * p.transit;
        },
        /** Pick the next unanswered item index. */
        next: function (items, state, cfg, rnd) {
            var target = cfg.target_success === undefined ? 0.7 : Number(cfg.target_success);
            var pool = items.map(function (_, i) { return i; }).filter(function (i) { return !state.done[i]; });
            if (!pool.length) return -1;
            var best = -1, bestCost = Infinity;
            if ((cfg.adaptive || {}).strategy === 'bkt') {
                var skills = {};
                pool.forEach(function (i) { var s = items[i].skill || 'general'; if (state.p[s] === undefined) state.p[s] = Adaptive.bkt.init; skills[s] = 1; });
                var open = Object.keys(skills).filter(function (s) { return state.p[s] < 0.95; });
                var skill = (open.length ? open : Object.keys(skills)).sort(function (a, b) { return state.p[a] - state.p[b]; })[0];
                var want = 1 + 4 * state.p[skill];
                pool.filter(function (i) { return (items[i].skill || 'general') === skill; }).forEach(function (i) {
                    var cost = Math.abs((Number(items[i].difficulty) || 3) - want) + rnd() * 0.01;
                    if (cost < bestCost) { bestCost = cost; best = i; }
                });
                return best;
            }
            pool.forEach(function (i) {
                var cost = Math.abs(Adaptive.prob(state.theta, Adaptive.diff(items[i].difficulty)) - target) + rnd() * 0.01;
                if (cost < bestCost) { bestCost = cost; best = i; }
            });
            return best;
        },
        update: function (items, state, i, right, cfg) {
            state.done[i] = 1; state.n++; if (right) state.c++;
            if ((cfg.adaptive || {}).strategy === 'bkt') {
                var s = items[i].skill || 'general';
                state.p[s] = Adaptive.bktUpdate(state.p[s] === undefined ? Adaptive.bkt.init : state.p[s], right);
            } else {
                var pr = Adaptive.prob(state.theta, Adaptive.diff(items[i].difficulty));
                var k = 0.8 / (1 + 0.15 * state.n);
                state.theta = util.clamp(state.theta + k * ((right ? 1 : 0) - pr) * 2, -3, 3);
            }
        },
        mastery: function (state, cfg) {
            if ((cfg.adaptive || {}).strategy === 'bkt') {
                var ks = Object.keys(state.p);
                return ks.length ? ks.reduce(function (s, k) { return s + state.p[k]; }, 0) / ks.length : Adaptive.bkt.init;
            }
            return Adaptive.prob(state.theta, 0);
        },
        shouldStop: function (items, state, cfg) {
            var max = Number(cfg.max_items) || 0;
            if (max && state.n >= max) return true;
            if (state.n >= items.length) return true;
            if (cfg.mastery_stop && (cfg.adaptive || {}).strategy === 'bkt' && state.n >= 3) {
                var ks = Object.keys(state.p);
                if (ks.length && ks.every(function (k) { return state.p[k] >= 0.95; })) return true;
            }
            return false;
        }
    };

    R.register({
        type: 'adaptive_practice', label: 'Adaptive practice', category: 'game', icon: ELS.icons.adaptive, scored: true,
        points: function (c) { return c.points === undefined ? 20 : c.points; },
        description: 'Practice that adapts question difficulty to the learner (Elo or BKT).',
        fields: [
            { key: 'prompt_html', label: 'Intro', type: 'html' },
            { key: 'items', label: 'Question bank', type: 'list', minItems: 3, itemLabel: 'Item', fields: [
                { key: 'prompt_html', label: 'Question', type: 'html', required: true },
                { key: 'options', label: 'Options', type: 'strings', required: true },
                { key: 'correct', label: 'Correct option number (1 = first)', type: 'number', min: 1, default: 1 },
                { key: 'difficulty', label: 'Difficulty (1 easy – 5 hard)', type: 'number', min: 1, max: 5, default: 3 },
                { key: 'skill', label: 'Skill tag', type: 'text' },
                { key: 'explain_html', label: 'Explanation', type: 'html' }
            ] },
            { key: 'adaptive', label: 'Adaptivity', type: 'group', fields: [
                { key: 'strategy', label: 'Strategy', type: 'select', default: 'elo', options: [{ value: 'elo', label: 'Elo rating (difficulty matching)' }, { value: 'bkt', label: 'Bayesian Knowledge Tracing (per skill)' }] }
            ] },
            { key: 'target_success', label: 'Target success rate (0–1)', type: 'number', min: 0.3, max: 0.95, step: 0.05, default: 0.7 },
            { key: 'max_items', label: 'Max questions (0 = all)', type: 'number', min: 0, default: 0 },
            { key: 'mastery_stop', label: 'Stop early when all skills are mastered (BKT)', type: 'bool', default: false },
            { key: 'pass_ratio', label: 'Pass ratio (0–1)', type: 'number', min: 0, max: 1, step: 0.05, default: 0.6 },
            { key: 'points', label: 'Points', type: 'number', min: 0, default: 20 },
            { key: 'attempts', label: 'Attempts (0 = unlimited)', type: 'number', min: 0, max: 20, default: 2 },
            { key: 'seed', label: 'Random seed (optional)', type: 'text' }
        ],
        template: {
            title: 'Adaptive practice: energy', prompt_html: '<p>Questions adapt to your answers — expect harder ones as you improve.</p>', adaptive: { strategy: 'elo' }, target_success: 0.7, max_items: 6, pass_ratio: 0.6, points: 20, attempts: 2,
            items: [
                { prompt_html: '<p>Which is renewable?</p>', options: ['Wind', 'Coal'], correct: 1, difficulty: 1, skill: 'sources' },
                { prompt_html: '<p>Solar panels convert sunlight into…</p>', options: ['Heat only', 'Electricity', 'Wind'], correct: 2, difficulty: 2, skill: 'sources' },
                { prompt_html: '<p>What unit measures electrical energy use at home?</p>', options: ['kWh', 'Volt', 'Newton'], correct: 1, difficulty: 2, skill: 'units' },
                { prompt_html: '<p>1,000 W used for 3 hours equals…</p>', options: ['3 kWh', '0.3 kWh', '30 kWh'], correct: 1, difficulty: 3, skill: 'units', explain_html: '<p>1 kW × 3 h = 3 kWh.</p>' },
                { prompt_html: '<p>Which has the highest capacity factor?</p>', options: ['Solar PV', 'Geothermal', 'Onshore wind'], correct: 2, difficulty: 4, skill: 'sources' },
                { prompt_html: '<p>A 60 W bulb replaced by a 9 W LED, used 1,000 h a year, saves…</p>', options: ['51 kWh', '5.1 kWh', '510 kWh'], correct: 1, difficulty: 5, skill: 'units', explain_html: '<p>(60 − 9) W × 1,000 h = 51,000 Wh = 51 kWh.</p>' },
                { prompt_html: '<p>Which stores energy for later use?</p>', options: ['Battery', 'Inverter', 'Meter'], correct: 1, difficulty: 3, skill: 'sources' }
            ]
        },
        validate: function (c) {
            var out = [];
            (c.items || []).forEach(function (it, i) {
                var n = util.list(it.options).length;
                if (n < 2) out.push({ path: 'items[' + i + '].options', message: 'Item ' + (i + 1) + ' needs at least two options.', level: 'error' });
                else if (!(it.correct >= 1 && it.correct <= n)) out.push({ path: 'items[' + i + '].correct', message: 'Item ' + (i + 1) + ': correct option must be 1–' + n + '.', level: 'error' });
            });
            return out;
        },
        render: function (ctx) {
            var c = ctx.cfg, t = ctx.t, items = c.items || [];
            var att = gameAttempts(ctx);
            var passRatio = c.pass_ratio === undefined ? 0.6 : Number(c.pass_ratio);
            if (c.prompt_html) ctx.el.appendChild(ELS.ui.prompt(c.prompt_html));
            var box = h('div.els-adaptive');
            ctx.el.appendChild(box);
            var meter = ELS.ui.meter(t('ability'));
            function summary(state, fromSaved) {
                box.innerHTML = '';
                var ratio = state.n ? state.c / state.n : 0;
                var passed = ratio >= passRatio;
                var final = fromSaved ? att.final() : att.finish(ratio, passed, null, { type: 'performance', response: state.c + '/' + state.n + ' mastery ' + Math.round(Adaptive.mastery(state, c) * 100) + '%', description: c.title });
                if (!fromSaved) {
                    var st = ctx.stored() || {}; st.last = { n: state.n, c: state.c, theta: state.theta, p: state.p }; ctx.store(st);
                }
                var skills = h('ul.els-breakdown');
                Object.keys(state.p || {}).forEach(function (k) {
                    var pct = Math.round(state.p[k] * 100);
                    skills.appendChild(h('li', h('span.els-breakdown-name', { text: k }), h('span.els-breakdown-bar', h('i', { style: { width: pct + '%' } })), h('span.els-breakdown-val', { text: pct + '%' })));
                });
                box.appendChild(h('h3', { text: t('practiceDone') }));
                box.appendChild(h('div.els-summary-row', ELS.ui.ring(Adaptive.mastery(state, c) * 100, t('ability')),
                    h('div.els-summary-facts', h('p.els-fact-line', { text: state.c + ' / ' + state.n + ' ' + t('correct') }),
                        h('p.els-fact-line', { text: t('pointsOf', { a: Math.round(att.best() * ctx.maxPoints), b: ctx.maxPoints }) }),
                        h('p.els-muted', { text: t('passMark', { n: Math.round(passRatio * 100) }) }))));
                if (skills.children.length) box.appendChild(skills);
                if (!final) box.appendChild(h('div.els-actions', ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('playAgain')) + '</span>', start, 'ghost'), h('span.els-attempts', { text: att.max ? t('attemptsLeft', { n: att.left() }) : '' })));
                if (passed && !fromSaved) ELS.anim.confetti(box);
            }
            function start() {
                var state = { theta: 0, p: {}, done: {}, n: 0, c: 0 };
                var rnd = util.rng((c.seed || '') + ':' + ctx.id + ':' + att.used() + (c.seed ? '' : ':' + Date.now()));
                box.innerHTML = '';
                var head = h('div.els-adaptive-head', h('span.els-adaptive-label', { text: t('ability') }), meter.el);
                var stage = h('div.els-adaptive-stage', { 'aria-live': 'polite' });
                box.appendChild(head); box.appendChild(stage);
                meter.set(Adaptive.mastery(state, c) * 100);
                function ask() {
                    if (Adaptive.shouldStop(items, state, c)) return summary(state);
                    var i = Adaptive.next(items, state, c, rnd);
                    if (i < 0) return summary(state);
                    var it = items[i];
                    stage.innerHTML = '';
                    var d = util.clamp(Number(it.difficulty) || 3, 1, 5);
                    stage.appendChild(h('div.els-adaptive-meta', h('span.els-badge', { text: t('questionN', { n: state.n + 1 }) }),
                        h('span.els-difficulty', { 'aria-label': t('level') + ' ' + d + '/5' }, [1, 2, 3, 4, 5].map(function (k) { return h('i', { class: k <= d ? 'is-on' : '' }); })),
                        it.skill ? h('span.els-chip', { text: it.skill }) : null));
                    stage.appendChild(h('div.els-prose', { html: it.prompt_html || '' }));
                    var grp = h('div.els-options');
                    util.list(it.options).forEach(function (o, k) {
                        var b = h('button.els-option', { type: 'button' }, h('span.els-option-key', { text: String.fromCharCode(65 + k) }), h('span.els-option-text', { text: o }), h('span.els-option-mark'));
                        b.addEventListener('click', function () { answer(i, k, grp); });
                        grp.appendChild(b);
                    });
                    ELS.ui.roving(grp, '.els-option');
                    stage.appendChild(grp);
                    ELS.anim.stagger(grp);
                }
                function answer(i, k, grp) {
                    var it = items[i], right = k + 1 === Number(it.correct);
                    Array.prototype.forEach.call(grp.children, function (b, n) { b.disabled = true; if (n + 1 === Number(it.correct)) b.classList.add(right ? 'is-correct' : 'is-missed'); else if (n === k) b.classList.add('is-wrong'); });
                    Adaptive.update(items, state, i, right, c);
                    meter.set(Adaptive.mastery(state, c) * 100);
                    var fb = ELS.ui.feedback();
                    fb.show(right ? 'correct' : 'incorrect', t(right ? 'correct' : 'incorrect'), it.explain_html || '');
                    stage.appendChild(fb.el);
                    var nx = ELS.ui.button('<span>' + util.esc(t('next')) + '</span>', ask, 'primary');
                    stage.appendChild(h('div.els-actions', nx));
                    nx.focus();
                }
                ask();
            }
            var last = (ctx.stored() || {}).last;
            if (ctx.saved && last) summary(last, true);
            else start();
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
