/**
 * ELS — E-Learning Screens core.
 *
 * Central namespace for the interactive screen system: utilities, i18n,
 * the screen-type registry, schema validation, shared UI helpers and the
 * reusable question controller used by every scored screen type.
 *
 * Plain ES5-compatible browser script (no build step), matching the rest of
 * this project. Also loadable in Node for unit tests.
 */
(function (root) {
    'use strict';

    var ELS = root.ELS = root.ELS || {};
    ELS.version = '1.0.0';
    ELS.SCHEMA_VERSION = 1;

    /* ------------------------------------------------------------------ *
     * Utilities
     * ------------------------------------------------------------------ */
    var util = ELS.util = {};

    util.esc = function (s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    util.clone = function (o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); };

    util.isEmpty = function (v) {
        if (v === undefined || v === null) return true;
        if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').trim() === '' && !/<(img|video|iframe|svg)/i.test(v);
        if (Array.isArray(v)) return v.length === 0;
        return false;
    };

    util.clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };

    var uidCounter = 0;
    util.uid = function (prefix) {
        uidCounter++;
        return (prefix || 'id') + '_' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6) + uidCounter.toString(36);
    };

    /** Deterministic PRNG (mulberry32) so shuffles can be reproducible. */
    util.rng = function (seed) {
        var a = typeof seed === 'number' ? seed : util.hash(String(seed == null ? Math.random() : seed));
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    };

    util.hash = function (str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    };

    /** Shuffle a copy of arr. If the result equals the original order (and n>1), rotate it. */
    util.shuffle = function (arr, rnd, avoidIdentity) {
        rnd = rnd || Math.random;
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rnd() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        if (avoidIdentity && a.length > 1) {
            var same = true;
            for (var k = 0; k < a.length; k++) if (a[k] !== arr[k]) { same = false; break; }
            if (same) a.push(a.shift());
        }
        return a;
    };

    /** Accept "a; b | c", "a\nb" or arrays and return a clean array of strings. */
    util.list = function (v) {
        if (v == null) return [];
        if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
        return String(v).split(/\s*[|;\n]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    };

    util.normalizeAnswer = function (s, caseSensitive) {
        s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
        // Normalise Arabic letter variants so learners are not penalised for hamza/ta-marbuta spelling.
        s = s.replace(/[ً-ْـ]/g, '');
        if (!caseSensitive) {
            s = s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
        }
        return s;
    };

    util.stripHtml = function (s) {
        return String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    };

    util.debounce = function (fn, ms) {
        var t;
        return function () {
            var self = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    };

    util.formatClock = function (sec) {
        sec = Math.max(0, Math.ceil(sec));
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    };

    util.letter = function (i) { return 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(i) || 'z'; };

    util.isRtlLang = function (lang) { return /^(ar|he|fa|ur|ps|ku|yi|dv)(-|$)/i.test(lang || ''); };

    util.prefersReducedMotion = function () {
        return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    /* ------------------------------------------------------------------ *
     * DOM helper:  h('button.btn.primary', {onclick: fn, 'aria-label': 'x'}, 'Text', childEl)
     * ------------------------------------------------------------------ */
    ELS.h = function (sel, attrs) {
        var parts = sel.split('.');
        var tagId = parts.shift().split('#');
        var el = document.createElement(tagId[0] || 'div');
        if (tagId[1]) el.id = tagId[1];
        if (parts.length) el.className = parts.join(' ');
        var start = 2;
        if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { start = 1; attrs = null; }
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v === undefined || v === null || v === false) return;
                if (k === 'html') el.innerHTML = v;
                else if (k === 'text') el.textContent = v;
                else if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
                else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) {
                    if (p.indexOf('--') === 0) el.style.setProperty(p, v[p]); else el.style[p] = v[p];
                });
                else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
                else if (v === true) el.setAttribute(k, '');
                else el.setAttribute(k, v);
            });
        }
        for (var i = start; i < arguments.length; i++) append(el, arguments[i]);
        return el;
    };
    function append(el, c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    }

    /* ------------------------------------------------------------------ *
     * i18n — learner-facing strings. Authors choose the course language.
     * ------------------------------------------------------------------ */
    ELS.strings = {
        en: {
            check: 'Check answer', tryAgain: 'Try again', submit: 'Submit', reset: 'Reset', continue: 'Continue',
            correct: 'Correct!', incorrect: 'Not quite.', partial: 'Partly correct.',
            answerFirst: 'Please complete your answer first.', attemptsLeft: 'Attempts left: {n}',
            next: 'Next', prev: 'Back', start: 'Start', menu: 'Contents', close: 'Close',
            score: 'Score', points: '{n} pts', pointsOf: '{a} / {b} points', of: '{a} of {b}',
            trueLabel: 'True', falseLabel: 'False',
            completed: 'Completed', passed: 'Passed', failed: 'Not passed', incomplete: 'In progress', notStarted: 'Not started',
            resumeTitle: 'Welcome back', resumeText: 'Would you like to continue where you left off?', resume: 'Continue', restart: 'Start over',
            locked: 'Complete this activity to continue.', alreadyDone: 'You already completed this activity.',
            selectOption: 'Choose…', dropHere: 'Drop items here', itemBank: 'Items', moveUp: 'Move up', moveDown: 'Move down',
            pickHint: 'Select an item, then select where it belongs.', matchHint: 'Select an item on the left, then its match on the right.',
            sortHint: 'Drag the items, or use the arrow buttons, to put them in the correct order.',
            flip: 'Flip card', cardOf: 'Card {a} of {b}', shuffle: 'Shuffle', gotIt: 'Got it', again: 'Review again',
            before: 'Before', after: 'After', play: 'Play', pause: 'Pause', replay: 'Replay', speed: 'Speed',
            transcript: 'Transcript', watchToContinue: 'Watch the video to continue.', watched: 'Video completed',
            explored: 'Explored {a} of {b}', exploreAll: 'Explore all items to complete this screen.',
            openAll: 'Open every section to complete this screen.',
            yourChoice: 'Your choice', yourAnswer: 'Your answer', typeHere: 'Type your answer…', saved: 'Saved',
            reflection: 'Reflection', benchmark: 'How others typically answer', otherAnswer: 'Other (please specify)',
            revealStep: 'Show next step', showRationale: 'Why?', yourExplanation: 'Explain this step in your own words…',
            step: 'Step {n}', stepOf: 'Step {a} of {b}', hint: 'Hint', showHint: 'Show hint', wrongSpot: 'That is not the right spot. Try again.',
            scenarioEnd: 'Scenario complete', restartScenario: 'Restart scenario', yourPath: 'Your path',
            timeLeft: 'Time left', timeUp: 'Time is up!', go: 'Go!', matched: 'Matched {a} of {b}', timeBonus: 'Time bonus',
            lives: 'Lives', livesLeft: 'Lives left: {n}', escaped: 'You escaped!', trapped: 'Out of lives — the door stays locked.',
            puzzleOf: 'Lock {a} of {b}', unlock: 'Unlock', wrongCode: 'Wrong answer — you lost a life.',
            level: 'Level', ability: 'Estimated mastery', practiceDone: 'Practice complete', questionN: 'Question {n}',
            explanation: 'Explanation', streak: 'Streak', gameOver: 'Game over', youWin: 'Well done!', playAgain: 'Play again',
            moves: 'Moves', pairsFound: 'Pairs found: {a}/{b}', round: 'Round {a} of {b}',
            overall: 'Overall result', strong: 'Strong', needsWork: 'Needs review', reviewAdvice: 'Recommended review',
            notAttempted: 'Not attempted', progress: 'Progress', yourScore: 'Your score', passMark: 'Pass mark: {n}%',
            unanswered: 'Activities still to complete', goTo: 'Go to screen',
            dataTable: 'Show data table', hideTable: 'Hide data table', value: 'Value', label: 'Label',
            loading: 'Loading…', lmsError: 'Could not save progress to the LMS. Your work is kept locally.',
            noLms: 'Running without an LMS — progress is saved in this browser only.',
            choose: 'Choose', chosen: 'Chosen', selected: 'Selected', notSelected: 'Not selected',
            sliderValue: 'Selected value', prediction: 'Your prediction', compare: 'Compare',
            activityComplete: 'Activity complete', marker: 'Marker {n}', region: 'Region {n}', viewDetails: 'View details',
            screen: 'Screen', selectAll: 'Select all that apply.'
        },
        ar: {
            check: 'تحقق من الإجابة', tryAgain: 'حاول مرة أخرى', submit: 'إرسال', reset: 'إعادة تعيين', continue: 'متابعة',
            correct: 'إجابة صحيحة!', incorrect: 'ليست صحيحة تمامًا.', partial: 'صحيحة جزئيًا.',
            answerFirst: 'يرجى إكمال إجابتك أولًا.', attemptsLeft: 'المحاولات المتبقية: {n}',
            next: 'التالي', prev: 'السابق', start: 'ابدأ', menu: 'المحتويات', close: 'إغلاق',
            score: 'الدرجة', points: '{n} نقطة', pointsOf: '{a} / {b} نقطة', of: '{a} من {b}',
            trueLabel: 'صحيح', falseLabel: 'خطأ',
            completed: 'مكتمل', passed: 'ناجح', failed: 'غير ناجح', incomplete: 'قيد التقدم', notStarted: 'لم يبدأ',
            resumeTitle: 'مرحبًا بعودتك', resumeText: 'هل تريد المتابعة من حيث توقفت؟', resume: 'متابعة', restart: 'البدء من جديد',
            locked: 'أكمل هذا النشاط للمتابعة.', alreadyDone: 'لقد أكملت هذا النشاط مسبقًا.',
            selectOption: 'اختر…', dropHere: 'أفلت العناصر هنا', itemBank: 'العناصر', moveUp: 'تحريك لأعلى', moveDown: 'تحريك لأسفل',
            pickHint: 'اختر عنصرًا، ثم اختر المكان الذي ينتمي إليه.', matchHint: 'اختر عنصرًا من القائمة الأولى، ثم ما يطابقه من القائمة الثانية.',
            sortHint: 'اسحب العناصر أو استخدم أزرار الأسهم لترتيبها بالترتيب الصحيح.',
            flip: 'اقلب البطاقة', cardOf: 'البطاقة {a} من {b}', shuffle: 'خلط', gotIt: 'فهمتها', again: 'راجعها مجددًا',
            before: 'قبل', after: 'بعد', play: 'تشغيل', pause: 'إيقاف مؤقت', replay: 'إعادة التشغيل', speed: 'السرعة',
            transcript: 'النص المكتوب', watchToContinue: 'شاهد الفيديو للمتابعة.', watched: 'اكتملت مشاهدة الفيديو',
            explored: 'تم استكشاف {a} من {b}', exploreAll: 'استكشف جميع العناصر لإكمال هذه الشاشة.',
            openAll: 'افتح جميع الأقسام لإكمال هذه الشاشة.',
            yourChoice: 'اختيارك', yourAnswer: 'إجابتك', typeHere: 'اكتب إجابتك…', saved: 'تم الحفظ',
            reflection: 'تأمل', benchmark: 'كيف يجيب الآخرون عادةً', otherAnswer: 'أخرى (يرجى التحديد)',
            revealStep: 'أظهر الخطوة التالية', showRationale: 'لماذا؟', yourExplanation: 'اشرح هذه الخطوة بكلماتك…',
            step: 'الخطوة {n}', stepOf: 'الخطوة {a} من {b}', hint: 'تلميح', showHint: 'أظهر التلميح', wrongSpot: 'هذا ليس المكان الصحيح. حاول مرة أخرى.',
            scenarioEnd: 'اكتمل السيناريو', restartScenario: 'أعد السيناريو', yourPath: 'مسارك',
            timeLeft: 'الوقت المتبقي', timeUp: 'انتهى الوقت!', go: 'انطلق!', matched: 'تمت مطابقة {a} من {b}', timeBonus: 'مكافأة الوقت',
            lives: 'الأرواح', livesLeft: 'الأرواح المتبقية: {n}', escaped: 'لقد نجحت في الهروب!', trapped: 'نفدت الأرواح — يبقى الباب مغلقًا.',
            puzzleOf: 'القفل {a} من {b}', unlock: 'افتح القفل', wrongCode: 'إجابة خاطئة — خسرت روحًا.',
            level: 'المستوى', ability: 'مستوى الإتقان المقدّر', practiceDone: 'اكتمل التدريب', questionN: 'السؤال {n}',
            explanation: 'الشرح', streak: 'سلسلة', gameOver: 'انتهت اللعبة', youWin: 'أحسنت!', playAgain: 'العب مجددًا',
            moves: 'الحركات', pairsFound: 'الأزواج المكتشفة: {a}/{b}', round: 'الجولة {a} من {b}',
            overall: 'النتيجة الإجمالية', strong: 'قوي', needsWork: 'يحتاج إلى مراجعة', reviewAdvice: 'مراجعة مقترحة',
            notAttempted: 'لم تتم المحاولة', progress: 'التقدم', yourScore: 'درجتك', passMark: 'درجة النجاح: {n}%',
            unanswered: 'أنشطة لم تكتمل بعد', goTo: 'انتقل إلى الشاشة',
            dataTable: 'أظهر جدول البيانات', hideTable: 'أخفِ جدول البيانات', value: 'القيمة', label: 'التسمية',
            loading: 'جارٍ التحميل…', lmsError: 'تعذّر حفظ التقدم في نظام إدارة التعلم. يتم الاحتفاظ بعملك محليًا.',
            noLms: 'يعمل بدون نظام إدارة تعلم — يُحفظ التقدم في هذا المتصفح فقط.',
            choose: 'اختر', chosen: 'تم الاختيار', selected: 'محدد', notSelected: 'غير محدد',
            sliderValue: 'القيمة المختارة', prediction: 'توقعك', compare: 'قارن',
            activityComplete: 'اكتمل النشاط', marker: 'العلامة {n}', region: 'المنطقة {n}', viewDetails: 'عرض التفاصيل',
            screen: 'الشاشة', selectAll: 'اختر كل الإجابات الصحيحة.'
        }
    };

    ELS.i18n = function (lang) {
        var base = (lang || 'en').split('-')[0];
        var dict = ELS.strings[base] || ELS.strings.en;
        return function (key, vars) {
            var s = dict[key] != null ? dict[key] : (ELS.strings.en[key] != null ? ELS.strings.en[key] : key);
            if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
            return s;
        };
    };

    /* ------------------------------------------------------------------ *
     * Icons (inline SVG, stroke = currentColor)
     * ------------------------------------------------------------------ */
    var I = function (d, extra) {
        return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (extra || '') + '>' + d + '</svg>';
    };
    ELS.icons = {
        title: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10h10M9 14h6"/>'),
        content: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h6M7 12h10M7 16h8"/>'),
        video: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
        summary: I('<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
        mcq: I('<circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2"/><path d="M11 7h9M11 17h9"/>'),
        tf: I('<path d="M4 12l4 4 8-9"/><path d="M15 15l5 5M20 15l-5 5"/>'),
        blank: I('<path d="M4 7h16M4 12h4M14 12h6M4 17h10"/><path d="M9 12h4" stroke-dasharray="1 2"/>'),
        dragdrop: I('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke-dasharray="2 2"/><path d="M11 7h4a2 2 0 0 1 2 2v2"/>'),
        matching: I('<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6l10 12M7 18L17 6"/>'),
        sorting: I('<path d="M8 4v16M4 16l4 4 4-4M14 6h7M14 11h5M14 16h3"/>'),
        hotspot: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="14" cy="11" r="2.5"/><circle cx="14" cy="11" r="5" stroke-dasharray="2 2"/>'),
        accordion: I('<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M7 14h8"/>'),
        tabs: I('<path d="M3 8h18v12H3z"/><path d="M3 8V5h6v3M9 5h6v3"/>'),
        flashcards: I('<rect x="6" y="3" width="14" height="10" rx="2"/><rect x="4" y="9" width="14" height="12" rx="2"/>'),
        timeline: I('<path d="M3 12h18"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 6v4M12 14v4M18 6v4"/>'),
        diagram: I('<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 9h4M15 15h4"/><circle cx="20" cy="9" r="1"/><circle cx="20" cy="15" r="1"/>'),
        chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
        compare: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/><path d="M9 12l-2 0M15 12l2 0"/>'),
        branching: I('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12h4a4 4 0 0 0 4-4V8M14 12h2"/>'),
        simulation: I('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M13 9l4 4-2 .5L14 15z"/>'),
        decision: I('<path d="M12 3v6M12 9l-6 6M12 9l6 6"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="3" r="1"/>'),
        exploration: I('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/><path d="M11 8v6M8 11h6"/>'),
        worked: I('<path d="M4 6h3M4 12h3M4 18h3"/><path d="M10 6h10M10 12h10M10 18h6"/>'),
        game: I('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>'),
        race: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
        escape: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.5"/>'),
        adaptive: I('<path d="M3 17l5-5 4 3 8-8"/><path d="M15 7h5v5"/>'),
        lottie: I('<path d="M4 18c4 0 4-12 8-12s4 12 8 12"/><circle cx="12" cy="6" r="1.5"/>'),
        results: I('<path d="M4 20h16"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="9" width="3" height="9"/>'),
        poll: I('<path d="M4 6h10M4 12h16M4 18h7"/><circle cx="19" cy="6" r="1"/>'),
        embed: I('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12"/>'),
        check: I('<path d="M5 12l5 5 9-11"/>'),
        cross: I('<path d="M6 6l12 12M18 6L6 18"/>'),
        chevronL: I('<path d="M15 6l-6 6 6 6"/>'),
        chevronR: I('<path d="M9 6l6 6-6 6"/>'),
        chevronD: I('<path d="M6 9l6 6 6-6"/>'),
        up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
        down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
        menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
        heart: I('<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>'),
        lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
        unlock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
        bulb: I('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
        star: I('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
        clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
        grip: I('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
        refresh: I('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
        play: I('<path d="M7 4l13 8-13 8z"/>'),
        pause: I('<path d="M7 4v16M17 4v16"/>'),
        plus: I('<path d="M12 5v14M5 12h14"/>'),
        info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>')
    };

    /* ------------------------------------------------------------------ *
     * Screen-type registry
     * ------------------------------------------------------------------ */
    ELS.categories = [
        { id: 'content', label: 'Basic content', description: 'Titles, rich content, video and summaries' },
        { id: 'assessment', label: 'Assessment', description: 'Scored questions reported to the LMS' },
        { id: 'interactive', label: 'Interactive content', description: 'Explorable content, media and data' },
        { id: 'scenario', label: 'Simulations & decisions', description: 'Branching, simulations and worked examples' },
        { id: 'game', label: 'Gamification', description: 'Games, races, escape rooms and adaptive practice' },
        { id: 'advanced', label: 'Advanced & specialized', description: 'Animation, analytics, polls and custom code' }
    ];

    var types = {}, order = [];
    ELS.registry = {
        /**
         * def = {
         *   type, label, category, icon, description,
         *   fields: [...schema fields],          // type-specific config schema
         *   template: {...},                     // starter content for new screens
         *   scored: bool | function(cfg),        // reports a score to the LMS
         *   points: function(cfg) -> max points,
         *   requiresInteraction: function(cfg),  // screen is "done" only after ctx.complete()
         *   validate: function(cfg, course) -> [{path, message, level}],
         *   render: function(ctx)                // builds the learner UI
         * }
         */
        register: function (def) {
            if (!def || !def.type || typeof def.render !== 'function') throw new Error('ELS.registry.register: type and render() are required');
            if (!types[def.type]) order.push(def.type);
            def.fields = def.fields || [];
            def.template = def.template || {};
            types[def.type] = def;
            return def;
        },
        get: function (type) { return types[type] || null; },
        has: function (type) { return !!types[type]; },
        all: function () { return order.map(function (t) { return types[t]; }); },
        byCategory: function () {
            return ELS.categories.map(function (c) {
                return { category: c, types: order.map(function (t) { return types[t]; }).filter(function (d) { return d.category === c.id; }) };
            });
        },
        isScored: function (screen) {
            var d = types[screen && screen.type];
            if (!d) return false;
            return typeof d.scored === 'function' ? !!d.scored(screen) : !!d.scored;
        },
        maxPoints: function (screen) {
            var d = types[screen.type];
            if (!d || !ELS.registry.isScored(screen)) return 0;
            var p = d.points ? d.points(screen) : screen.points;
            p = Number(p);
            return isFinite(p) && p > 0 ? p : 10;
        },
        requiresInteraction: function (screen) {
            var d = types[screen && screen.type];
            if (!d) return false;
            if (ELS.registry.isScored(screen)) return true;
            return d.requiresInteraction ? !!d.requiresInteraction(screen) : false;
        }
    };

    /* ------------------------------------------------------------------ *
     * Schema: base fields shared by every screen + validation
     *
     * Field: { key, label, type, required, help, options, min, max, step,
     *          default, showIf(cfg) , fields (for list/group), minItems,
     *          maxItems, itemLabel, placeholder, pattern }
     * Types: text, textarea, html, number, bool, select, color, image, media,
     *        url, list, group, strings, screen, screens, code, json, regions,
     *        points, background
     * ------------------------------------------------------------------ */
    ELS.baseFields = [
        { key: 'title', label: 'Screen title', type: 'text', required: true },
        { key: 'kicker', label: 'Kicker', type: 'text', help: 'Small label shown above the title, e.g. "Module 1".' },
        { key: 'lead', label: 'Lead text', type: 'textarea', help: 'Short introduction shown under the title.' },
        { key: 'hide_header', label: 'Hide title header', type: 'bool' },
        { key: 'section', label: 'Section', type: 'text', help: 'Groups screens in the learner\'s contents menu.' },
        { key: 'background', label: 'Screen background', type: 'background', help: 'Colour or image behind this screen.' },
        { key: 'notes', label: 'Speaker / facilitator notes', type: 'textarea', help: 'Shown in reveal.js speaker view (press S).' }
    ];

    /** Common assessment fields reused by the scored types. */
    ELS.assessmentFields = function (defaultPoints, opts) {
        opts = opts || {};
        var f = [
            { key: 'points', label: 'Points', type: 'number', min: 0, max: 1000, default: defaultPoints || 10 },
            { key: 'attempts', label: 'Attempts allowed', type: 'number', min: 0, max: 20, default: 1, help: '0 = unlimited (until correct).' }
        ];
        if (opts.scoring) f.push({ key: 'scoring', label: 'Scoring', type: 'select', default: 'partial', options: [
            { value: 'partial', label: 'Partial credit' }, { value: 'all_or_nothing', label: 'All or nothing' }] });
        f.push({ key: 'feedback', label: 'Feedback', type: 'group', fields: [
            { key: 'correct', label: 'When correct', type: 'html' },
            { key: 'incorrect', label: 'When incorrect', type: 'html' },
            { key: 'partial', label: 'When partly correct', type: 'html' }
        ] });
        return f;
    };

    ELS.schema = {
        fieldsFor: function (type) {
            var d = ELS.registry.get(type);
            return d ? d.fields : [];
        },
        visible: function (field, obj, root) {
            if (!field.showIf) return true;
            if (typeof field.showIf === 'function') return !!field.showIf(obj || {}, root || obj || {});
            return Object.keys(field.showIf).every(function (k) {
                var want = field.showIf[k], have = (obj || {})[k];
                return Array.isArray(want) ? want.indexOf(have) >= 0 : have === want;
            });
        },
        /** Fill missing defaults (non-destructive). */
        applyDefaults: function (fields, obj) {
            fields.forEach(function (f) {
                if (f.default !== undefined && obj[f.key] === undefined) obj[f.key] = util.clone(f.default);
                if (f.type === 'group') {
                    if (!obj[f.key] || typeof obj[f.key] !== 'object') obj[f.key] = {};
                    ELS.schema.applyDefaults(f.fields || [], obj[f.key]);
                }
                if (f.type === 'list' && Array.isArray(obj[f.key])) {
                    obj[f.key].forEach(function (it) { if (it && typeof it === 'object') ELS.schema.applyDefaults(f.fields || [], it); });
                }
            });
            return obj;
        },
        validateFields: function (fields, obj, path, issues, root) {
            obj = obj || {};
            fields.forEach(function (f) {
                if (!ELS.schema.visible(f, obj, root)) return;
                var v = obj[f.key], p = path ? path + '.' + f.key : f.key, label = f.label || f.key;
                if (f.required && util.isEmpty(v) && v !== 0 && v !== false) {
                    issues.push({ path: p, message: label + ' is required.', level: 'error' });
                    return;
                }
                if (v === undefined || v === null || v === '') return;
                if (f.type === 'number') {
                    var n = Number(v);
                    if (!isFinite(n)) issues.push({ path: p, message: label + ' must be a number.', level: 'error' });
                    else {
                        if (f.min !== undefined && n < f.min) issues.push({ path: p, message: label + ' must be ≥ ' + f.min + '.', level: 'error' });
                        if (f.max !== undefined && n > f.max) issues.push({ path: p, message: label + ' must be ≤ ' + f.max + '.', level: 'error' });
                    }
                }
                if (f.type === 'select' && f.options && !f.options.some(function (o) { return (o.value !== undefined ? o.value : o) === v; })) {
                    issues.push({ path: p, message: label + ' has an unsupported value "' + v + '".', level: 'error' });
                }
                if (f.pattern && typeof v === 'string' && !(new RegExp(f.pattern)).test(v)) {
                    issues.push({ path: p, message: label + ' has an invalid format' + (f.patternHelp ? ' (' + f.patternHelp + ')' : '') + '.', level: 'error' });
                }
                if (f.type === 'json' && typeof v === 'string') {
                    try { JSON.parse(v); } catch (e) { issues.push({ path: p, message: label + ' is not valid JSON.', level: 'error' }); }
                }
                if (f.type === 'list' || f.type === 'strings' || f.type === 'regions' || f.type === 'points' || f.type === 'screens') {
                    var arr = Array.isArray(v) ? v : [];
                    if (f.minItems && arr.length < f.minItems) issues.push({ path: p, message: label + ' needs at least ' + f.minItems + ' item(s).', level: 'error' });
                    if (f.maxItems && arr.length > f.maxItems) issues.push({ path: p, message: label + ' allows at most ' + f.maxItems + ' item(s).', level: 'error' });
                    if (f.type === 'list') arr.forEach(function (it, i) { ELS.schema.validateFields(f.fields || [], it, p + '[' + i + ']', issues, root); });
                }
                if (f.type === 'group') ELS.schema.validateFields(f.fields || [], v, p, issues, root);
            });
            return issues;
        },
        validateScreen: function (screen, course) {
            var issues = [];
            var d = ELS.registry.get(screen.type);
            if (!d) return [{ path: 'type', message: 'Unknown screen type "' + screen.type + '".', level: 'error' }];
            if (!screen.id || !/^[A-Za-z0-9_\-]{1,64}$/.test(screen.id)) issues.push({ path: 'id', message: 'Screen id must be 1–64 letters, digits, "-" or "_".', level: 'error' });
            ELS.schema.validateFields(ELS.baseFields, screen, '', issues, screen);
            var bg = screen.background;
            if (bg && typeof bg === 'object' && bg.dark && !bg.image && /^#[0-9a-f]{6}$/i.test(bg.color || '')) {
                var c = parseInt(bg.color.slice(1), 16), lum = (0.299 * (c >> 16) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
                if (lum > 0.6) issues.push({ path: 'background', message: '"Dark background" is on but the colour is light — text may be hard to read.', level: 'warning' });
            }
            ELS.schema.validateFields(d.fields, screen, '', issues, screen);
            if (d.validate) {
                try { (d.validate(screen, course || { screens: [screen] }) || []).forEach(function (x) { issues.push(x); }); }
                catch (e) { issues.push({ path: '', message: 'Validator error: ' + e.message, level: 'error' }); }
            }
            return issues;
        },
        validateCourse: function (course) {
            var out = { errors: 0, warnings: 0, screens: {}, course: [] };
            var seen = {};
            if (!course || !Array.isArray(course.screens)) { out.course.push({ path: 'screens', message: 'Course has no screens.', level: 'error' }); out.errors++; return out; }
            if (!course.screens.length) { out.course.push({ path: 'screens', message: 'Add at least one screen.', level: 'warning' }); out.warnings++; }
            course.screens.forEach(function (s) {
                var iss = ELS.schema.validateScreen(s, course);
                if (s.id) {
                    if (seen[s.id]) iss.push({ path: 'id', message: 'Duplicate screen id "' + s.id + '".', level: 'error' });
                    seen[s.id] = true;
                }
                out.screens[s.id] = iss;
                iss.forEach(function (i) { if (i.level === 'warning') out.warnings++; else out.errors++; });
            });
            var st = course.settings || {};
            if (st.mastery_score !== undefined && (st.mastery_score < 0 || st.mastery_score > 100)) { out.course.push({ path: 'settings.mastery_score', message: 'Mastery score must be 0–100.', level: 'error' }); out.errors++; }
            return out;
        }
    };

    /** Helper used by validators that reference other screens. */
    ELS.screenExists = function (course, id) {
        return !!(course && course.screens || []).filter(function (s) { return s.id === id; }).length;
    };

    /* ------------------------------------------------------------------ *
     * Course model
     * ------------------------------------------------------------------ */
    ELS.defaultTheme = {
        primary: '#3b759e', primary_dark: '#134674', accent: '#66cc00', background: '#f7fbfc',
        surface: '#ffffff', text: '#1f2d3a', font: 'Work Sans', heading_font: 'Rubik', radius: 14,
        style: 'soft'
    };
    ELS.defaultSettings = {
        scorm_version: '1.2', mastery_score: 70, completion_rule: 'all_viewed', gate: 'none',
        transition: 'slide', show_progress: true, show_menu: true, show_score: true, shuffle_seed: ''
    };

    ELS.newScreen = function (type, course, overrides) {
        var d = ELS.registry.get(type);
        if (!d) throw new Error('Unknown screen type ' + type);
        var s = util.clone(d.template) || {};
        s.type = type;
        if (!s.title) s.title = d.label;
        s.id = ELS.uniqueId(course, type.replace(/_/g, '-'));
        if (overrides) Object.keys(overrides).forEach(function (k) { s[k] = overrides[k]; });
        ELS.schema.applyDefaults(d.fields, s);
        return s;
    };

    ELS.uniqueId = function (course, base) {
        var ids = {};
        ((course && course.screens) || []).forEach(function (s) { ids[s.id] = 1; });
        base = String(base || 'screen').toLowerCase().replace(/[^a-z0-9_\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'screen';
        if (!ids[base]) return base;
        for (var i = 2; i < 10000; i++) if (!ids[base + '-' + i]) return base + '-' + i;
        return util.uid(base);
    };

    /** Normalise / migrate a course object in place (keeps unknown keys for forward compatibility). */
    ELS.normalizeCourse = function (course) {
        course = course || {};
        course.schema_version = course.schema_version || ELS.SCHEMA_VERSION;
        course.id = course.id || ('course-' + util.hash(course.title || 'course').toString(36));
        course.title = course.title || 'Untitled course';
        course.lang = course.lang || 'en';
        course.dir = course.dir || (util.isRtlLang(course.lang) ? 'rtl' : 'ltr');
        course.theme = course.theme || {};
        Object.keys(ELS.defaultTheme).forEach(function (k) { if (course.theme[k] === undefined) course.theme[k] = ELS.defaultTheme[k]; });
        course.settings = course.settings || {};
        Object.keys(ELS.defaultSettings).forEach(function (k) { if (course.settings[k] === undefined) course.settings[k] = ELS.defaultSettings[k]; });
        course.screens = Array.isArray(course.screens) ? course.screens : [];
        var seen = {};
        course.screens.forEach(function (s, i) {
            if (!s.id || seen[s.id]) s.id = ELS.uniqueId({ screens: course.screens.slice(0, i) }, s.id || s.type || 'screen');
            seen[s.id] = 1;
            var d = ELS.registry.get(s.type);
            if (d) ELS.schema.applyDefaults(d.fields, s);
        });
        return course;
    };

    /* ------------------------------------------------------------------ *
     * Animation helpers
     * ------------------------------------------------------------------ */
    ELS.anim = {
        /** Adds a staggered entrance animation to the children of el. */
        stagger: function (el, selector, baseDelay) {
            if (!el) return;
            var kids = selector ? el.querySelectorAll(selector) : el.children;
            Array.prototype.forEach.call(kids, function (k, i) {
                k.classList.add('els-anim-in');
                k.style.animationDelay = ((baseDelay || 0) + i * 60) + 'ms';
            });
        },
        pulse: function (el, cls) {
            if (!el) return;
            cls = cls || 'els-pulse';
            el.classList.remove(cls);
            void el.offsetWidth; // restart animation
            el.classList.add(cls);
        },
        countUp: function (el, to, ms, suffix) {
            if (!el) return;
            suffix = suffix || '';
            if (util.prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') { el.textContent = Math.round(to) + suffix; return; }
            var start = null; ms = ms || 900;
            function step(ts) {
                if (!start) start = ts;
                var p = Math.min(1, (ts - start) / ms), e = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(to * e) + suffix;
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        },
        confetti: function (host) {
            if (!host || util.prefersReducedMotion()) return;
            var colors = ['var(--els-primary)', 'var(--els-accent)', '#f5b301', '#e85d75', '#7c5cff'];
            var box = ELS.h('div.els-confetti', { 'aria-hidden': 'true' });
            for (var i = 0; i < 36; i++) {
                box.appendChild(ELS.h('i', { style: {
                    left: (Math.random() * 100) + '%', background: colors[i % colors.length],
                    animationDelay: (Math.random() * 250) + 'ms', '--els-dx': ((Math.random() - .5) * 220) + 'px',
                    '--els-rot': (Math.random() * 720) + 'deg'
                } }));
            }
            host.appendChild(box);
            setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 1800);
        }
    };

    /* ------------------------------------------------------------------ *
     * Shared UI pieces
     * ------------------------------------------------------------------ */
    ELS.ui = {
        /** Rich HTML prompt block (author-trusted HTML). */
        prompt: function (html, cls) {
            if (util.isEmpty(html)) return null;
            return ELS.h('div.els-prompt' + (cls ? '.' + cls : ''), { html: html });
        },
        image: function (src, alt, cls) {
            if (!src) return null;
            return ELS.h('img' + (cls ? '.' + cls : ''), { src: src, alt: alt || '', loading: 'lazy', draggable: 'false' });
        },
        button: function (label, onClick, cls, attrs) {
            var a = attrs || {};
            a.type = 'button';
            a.onclick = onClick;
            var b = ELS.h('button.els-btn' + (cls ? '.' + cls.split(' ').join('.') : ''), a);
            if (typeof label === 'string' && label.indexOf('<svg') === 0) b.innerHTML = label; else b.innerHTML = label;
            return b;
        },
        /** Feedback panel with an aria-live region. kind: correct | incorrect | partial | info */
        feedback: function () {
            var el = ELS.h('div.els-feedback', { role: 'status', 'aria-live': 'polite', hidden: true });
            return {
                el: el,
                show: function (kind, title, html) {
                    el.hidden = false;
                    el.className = 'els-feedback is-' + kind;
                    var icon = kind === 'correct' ? ELS.icons.check : kind === 'incorrect' ? ELS.icons.cross : ELS.icons.info;
                    el.innerHTML = '';
                    el.appendChild(ELS.h('span.els-feedback-icon', { html: icon }));
                    var body = ELS.h('div.els-feedback-body');
                    if (title) body.appendChild(ELS.h('strong.els-feedback-title', { text: title }));
                    if (!util.isEmpty(html)) body.appendChild(ELS.h('div.els-feedback-text', { html: html }));
                    el.appendChild(body);
                    ELS.anim.pulse(el, 'els-pop');
                },
                hide: function () { el.hidden = true; el.innerHTML = ''; }
            };
        },
        actions: function () { return ELS.h('div.els-actions'); },
        badge: function (text, cls) { return ELS.h('span.els-badge' + (cls ? '.' + cls : ''), { text: text }); },
        meter: function (label) {
            var fill = ELS.h('span.els-meter-fill');
            var el = ELS.h('div.els-meter', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label || '' }, fill);
            return { el: el, set: function (p) { p = util.clamp(Math.round(p), 0, 100); fill.style.width = p + '%'; el.setAttribute('aria-valuenow', p); } };
        },
        /** Visual "score ring" used by summary/results. */
        ring: function (pct, label) {
            var r = 52, c = 2 * Math.PI * r;
            var wrap = ELS.h('div.els-ring');
            wrap.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="els-ring-bg" cx="60" cy="60" r="' + r + '"/>' +
                '<circle class="els-ring-fg" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '"/></svg>';
            var num = ELS.h('span.els-ring-num', { text: '0%' });
            wrap.appendChild(ELS.h('div.els-ring-label', num, label ? ELS.h('small', { text: label }) : null));
            wrap.setAttribute('role', 'img');
            wrap.setAttribute('aria-label', (label ? label + ': ' : '') + Math.round(pct) + '%');
            setTimeout(function () {
                var fg = wrap.querySelector('.els-ring-fg');
                if (fg) fg.style.strokeDashoffset = (c * (1 - util.clamp(pct, 0, 100) / 100)).toFixed(1);
                ELS.anim.countUp(num, pct, 900, '%');
            }, 60);
            return wrap;
        },
        /** Makes a list of focusable elements navigable with arrow keys (roving tabindex). */
        roving: function (container, selector, opts) {
            opts = opts || {};
            container.addEventListener('keydown', function (e) {
                var keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                if (keys.indexOf(e.key) < 0) return;
                var items = Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
                var idx = items.indexOf(document.activeElement);
                if (idx < 0) return;
                var rtl = getComputedStyle(container).direction === 'rtl';
                var fwd = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
                var back = e.key === 'ArrowUp' || e.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
                var n = idx;
                if (e.key === 'Home') n = 0; else if (e.key === 'End') n = items.length - 1;
                else if (fwd) n = (idx + 1) % items.length; else if (back) n = (idx - 1 + items.length) % items.length;
                e.preventDefault(); e.stopPropagation();
                items[n].focus();
                if (opts.select) items[n].click();
            });
        }
    };

    /* ------------------------------------------------------------------ *
     * Question controller — attempts, check/retry, feedback, scoring,
     * locking and state restore for every scored question type.
     *
     *   ELS.question(ctx, {
     *     host: element to append actions/feedback to,
     *     getResponse: () -> response | null (null = incomplete),
     *     evaluate: (response) -> { ratio: 0..1, correct: bool },
     *     showResult: (response, evaluation) -> void   // mark items right/wrong
     *     applyResponse: (response) -> void            // restore UI from saved response
     *     setLocked: (bool) -> void,
     *     reset: () -> void,
     *     interaction: (response, evaluation) -> { type, response, correct, description }
     *   })
     * ------------------------------------------------------------------ */
    ELS.question = function (ctx, o) {
        var cfg = ctx.cfg, t = ctx.t;
        var maxAttempts = Number(cfg.attempts);
        if (!isFinite(maxAttempts) || maxAttempts < 0) maxAttempts = 1;
        var used = 0, locked = false, finished = false;
        var fb = ELS.ui.feedback();
        var actions = ELS.ui.actions();
        var info = ELS.h('span.els-attempts');
        var checkBtn = ELS.ui.button(t('check'), check, 'primary');
        var retryBtn = ELS.ui.button(ELS.icons.refresh + '<span>' + util.esc(t('tryAgain')) + '</span>', retry, 'ghost');
        retryBtn.hidden = true;
        actions.appendChild(checkBtn);
        actions.appendChild(retryBtn);
        actions.appendChild(info);
        o.host.appendChild(actions);
        o.host.appendChild(fb.el);

        function updateInfo() {
            if (maxAttempts > 1 && !finished) info.textContent = t('attemptsLeft', { n: maxAttempts - used });
            else info.textContent = '';
        }
        updateInfo();

        function setLocked(v) { locked = v; if (o.setLocked) o.setLocked(v); }

        function present(resp, ev, final) {
            if (o.showResult) o.showResult(resp, ev, final);
            var fbc = cfg.feedback || {};
            var kind = ev.correct ? 'correct' : (ev.ratio > 0 ? 'partial' : 'incorrect');
            var html = (kind === 'partial' ? (fbc.partial || fbc.incorrect) : fbc[kind]) || '';
            if (ev.extraHtml) html = (html ? html + ' ' : '') + ev.extraHtml;
            var pts = ctx.maxPoints ? ' · ' + t('pointsOf', { a: Math.round(ev.ratio * ctx.maxPoints), b: ctx.maxPoints }) : '';
            fb.show(kind, t(kind) + pts, html);
            if (ev.correct && final) ELS.anim.confetti(o.host);
        }

        function check() {
            if (locked) return;
            var resp = o.getResponse();
            if (resp === null || resp === undefined) {
                fb.show('info', t('answerFirst'));
                return;
            }
            var ev = o.evaluate(resp);
            used++;
            finished = ev.correct || (maxAttempts > 0 && used >= maxAttempts);
            setLocked(true);
            present(resp, ev, finished);
            checkBtn.hidden = true;
            retryBtn.hidden = finished;
            updateInfo();
            var inter = o.interaction ? o.interaction(resp, ev) : null;
            ctx.score({ ratio: ev.ratio, correct: ev.correct, response: resp, final: finished, attempts: used, interaction: inter });
            if (!finished) setTimeout(function () { retryBtn.focus(); }, 30);
        }

        function retry() {
            if (finished) return;
            fb.hide();
            if (o.reset) o.reset();
            setLocked(false);
            checkBtn.hidden = false;
            retryBtn.hidden = true;
        }

        // Restore a previous attempt (resume from LMS suspend data).
        var saved = ctx.saved;
        if (saved && saved.r !== undefined && saved.r !== null) {
            try {
                o.applyResponse(saved.r);
                used = saved.a || 1;
                finished = !!saved.f;
                var ev = o.evaluate(saved.r);
                setLocked(true);
                present(saved.r, ev, false);
                checkBtn.hidden = true;
                retryBtn.hidden = finished;
                updateInfo();
            } catch (e) { if (o.reset) o.reset(); }
        }

        return { check: check, retry: retry, feedback: fb, actions: actions, isLocked: function () { return locked; } };
    };

    /** Score ratio helper: partial credit vs all-or-nothing. */
    ELS.ratio = function (cfg, correctCount, total) {
        if (!total) return 0;
        var r = correctCount / total;
        return cfg.scoring === 'all_or_nothing' ? (r === 1 ? 1 : 0) : r;
    };

    /* ------------------------------------------------------------------ *
     * Pointer-based drag helper (mouse + touch + pen) used by drag_drop,
     * sorting, image_compare etc. Keeps reveal.js from swiping slides.
     * ------------------------------------------------------------------ */
    ELS.drag = function (el, handlers) {
        var startX, startY, dragging = false, ghost = null, pid = null;
        el.setAttribute('data-prevent-swipe', '');
        el.style.touchAction = 'none';
        el.addEventListener('pointerdown', function (e) {
            if (e.button !== 0 || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
            startX = e.clientX; startY = e.clientY; pid = e.pointerId; dragging = false;
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', up);
            document.addEventListener('pointercancel', up);
        });
        function move(e) {
            if (e.pointerId !== pid) return;
            var dx = e.clientX - startX, dy = e.clientY - startY;
            if (!dragging && Math.sqrt(dx * dx + dy * dy) > 6) {
                dragging = true;
                var r = el.getBoundingClientRect();
                ghost = el.cloneNode(true);
                ghost.classList.add('els-drag-ghost');
                ghost.style.width = r.width + 'px';
                ghost.style.left = r.left + 'px';
                ghost.style.top = r.top + 'px';
                document.body.appendChild(ghost);
                el.classList.add('is-dragging');
                if (handlers.start) handlers.start(e);
            }
            if (dragging) {
                e.preventDefault();
                var r0 = el.getBoundingClientRect();
                ghost.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
                ghost.style.left = (r0.left) + 'px';
                ghost.style.top = (r0.top) + 'px';
                if (handlers.move) handlers.move(e, pointTarget(e));
            }
        }
        function pointTarget(e) {
            if (ghost) ghost.style.display = 'none';
            var t = document.elementFromPoint(e.clientX, e.clientY);
            if (ghost) ghost.style.display = '';
            return t;
        }
        function up(e) {
            if (e.pointerId !== pid) return;
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
            if (dragging) {
                var target = pointTarget(e);
                if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
                ghost = null;
                el.classList.remove('is-dragging');
                if (handlers.drop) handlers.drop(e, target);
                // swallow the click that follows a drag
                var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); el.removeEventListener('click', stop, true); };
                el.addEventListener('click', stop, true);
                setTimeout(function () { el.removeEventListener('click', stop, true); }, 50);
            }
            dragging = false;
        }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = ELS;
})(typeof window !== 'undefined' ? window : globalThis);
