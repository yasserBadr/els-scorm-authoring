/**
 * Unit tests for the ELS runtime, SCORM layer, packager and samples.
 * Run: node --test tests/
 */
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');
var load = require('../tools/load-runtime');
var ELS = load();
var packager = require('../js/author/packager.js');
var ELSZip = require('../js/author/zip.js');
var samples = require('../tools/make-samples.js');

var ALL_TYPES = ['title_slide', 'content_slide', 'video', 'summary', 'mcq', 'true_false', 'fill_blank', 'drag_drop', 'matching', 'sorting',
    'hotspot', 'accordion', 'tabs', 'flashcards', 'timeline', 'labeled_diagram', 'data_chart', 'image_compare',
    'branching', 'simulation', 'decision_scenario', 'exploration', 'worked_example',
    'game', 'term_match_race', 'escape_room', 'adaptive_practice', 'lottie', 'results_breakdown', 'poll', 'embed_html'];

/* ------------------------------------------------------------------ */
test('registry contains all 31 screen types in valid categories', function () {
    var types = ELS.registry.all().map(function (d) { return d.type; });
    assert.equal(types.length, 31);
    ALL_TYPES.forEach(function (t) { assert.ok(ELS.registry.has(t), 'missing ' + t); });
    var cats = ELS.categories.map(function (c) { return c.id; });
    ELS.registry.all().forEach(function (d) {
        assert.ok(cats.indexOf(d.category) >= 0, d.type + ' has unknown category');
        assert.equal(typeof d.render, 'function');
        assert.ok(d.label && d.description && d.icon, d.type + ' needs label/description/icon');
    });
});

test('every template produces a valid screen', function () {
    ELS.registry.all().forEach(function (d) {
        var course = { screens: [] };
        var s = ELS.newScreen(d.type, course);
        course.screens.push(s);
        var issues = ELS.schema.validateScreen(s, course).filter(function (i) { return i.level !== 'warning'; });
        // branching/results templates reference other screens that do not exist in a 1-screen course
        assert.deepEqual(issues, [], d.type + ': ' + JSON.stringify(issues));
    });
});

test('scored types and points', function () {
    var scored = ['mcq', 'true_false', 'fill_blank', 'drag_drop', 'matching', 'sorting', 'simulation', 'decision_scenario', 'term_match_race', 'escape_room', 'game', 'adaptive_practice', 'hotspot', 'labeled_diagram'];
    scored.forEach(function (t) { assert.ok(ELS.registry.isScored(ELS.newScreen(t, { screens: [] })), t + ' should be scored'); });
    assert.equal(ELS.registry.isScored({ type: 'hotspot', mode: 'explore' }), false);
    assert.equal(ELS.registry.isScored({ type: 'labeled_diagram', mode: 'display' }), false);
    assert.equal(ELS.registry.isScored({ type: 'embed_html', scored: true }), true);
    assert.equal(ELS.registry.isScored({ type: 'poll' }), false);
    assert.equal(ELS.registry.maxPoints({ type: 'labeled_diagram' }), 15);
    assert.equal(ELS.registry.maxPoints({ type: 'decision_scenario' }), 20);
    assert.equal(ELS.registry.maxPoints({ type: 'mcq', points: 7 }), 7);
});

test('validation catches common authoring errors', function () {
    var c = { screens: [] };
    var mcq = ELS.newScreen('mcq', c);
    mcq.options.forEach(function (o) { o.correct = false; });
    assert.ok(ELS.schema.validateScreen(mcq, c).some(function (i) { return /at least one option as correct/.test(i.message); }));
    mcq.options[0].correct = true; mcq.options[1].correct = true;
    assert.ok(ELS.schema.validateScreen(mcq, c).some(function (i) { return /multiple answers/.test(i.message); }));
    var fb = ELS.newScreen('fill_blank', c);
    fb.blanks.pop();
    assert.ok(ELS.schema.validateScreen(fb, c).some(function (i) { return /marker/.test(i.message); }));
    var br = ELS.newScreen('branching', c);
    br.choices[0].goto = 'nowhere';
    assert.ok(ELS.schema.validateScreen(br, c).some(function (i) { return /does not exist/.test(i.message); }));
    var ds = ELS.newScreen('decision_scenario', c);
    ds.nodes[0].choices[0].goto_node_id = 'missing';
    assert.ok(ELS.schema.validateScreen(ds, c).some(function (i) { return /missing scene/.test(i.message); }));
    var ex1 = ELS.newScreen('exploration', c), ex2 = ELS.newScreen('exploration', c);
    ex2.id = 'other';
    var course = { screens: [ex1, ex2] };
    assert.ok(ELS.schema.validateScreen(ex2, course).some(function (i) { return /already used/.test(i.message); }));
    var bad = ELS.newScreen('mcq', c); bad.id = 'has space';
    assert.ok(ELS.schema.validateScreen(bad, c).some(function (i) { return i.path === 'id'; }));
    var dup = ELS.schema.validateCourse({ screens: [ELS.newScreen('summary', c), Object.assign(ELS.newScreen('summary', c), { id: 'summary' })] });
    assert.ok(dup.errors >= 1);
});

test('sample courses (EN + AR) cover all 31 types and validate', function () {
    ['en', 'ar'].forEach(function (lang) {
        var c = samples.build(lang);
        var types = {}; c.screens.forEach(function (s) { types[s.type] = 1; });
        assert.equal(Object.keys(types).length, 31, lang);
        var r = ELS.schema.validateCourse(c);
        assert.equal(r.errors, 0, lang + ' errors');
        assert.equal(c.dir, lang === 'ar' ? 'rtl' : 'ltr');
    });
});

test('i18n: Arabic has every English key', function () {
    var en = Object.keys(ELS.strings.en), ar = ELS.strings.ar;
    var missing = en.filter(function (k) { return ar[k] === undefined; });
    assert.deepEqual(missing, []);
    var t = ELS.i18n('ar');
    assert.equal(t('of', { a: 2, b: 5 }), '2 من 5');
    assert.equal(ELS.i18n('fr')('next'), 'Next'); // falls back to English
});

test('answer normalisation is case/space tolerant and handles Arabic variants', function () {
    var n = ELS.util.normalizeAnswer;
    assert.equal(n('  Carbon   Dioxide '), n('carbon dioxide'));
    assert.notEqual(n('CO2', true), n('co2', true));
    assert.equal(n('الأكسجين'), n('الاكسجين'));
    assert.equal(n('شمسية'), n('شمسيه'));
});

test('seeded shuffle is deterministic and avoids identity', function () {
    var a = ELS.util.shuffle([1, 2, 3, 4, 5], ELS.util.rng('x'), true);
    var b = ELS.util.shuffle([1, 2, 3, 4, 5], ELS.util.rng('x'), true);
    assert.deepEqual(a, b);
    for (var i = 0; i < 50; i++) assert.notDeepEqual(ELS.util.shuffle([1, 2], ELS.util.rng(i), true), [1, 2]);
});

/* ------------------------------------------------------------------ */
test('SCORM formats: time and interactions (1.2 vs 2004)', function () {
    var f = ELS.scormFormat;
    assert.equal(f.time12(3725.5), '0001:02:05.50');
    assert.equal(f.time2004(3725.5), 'PT1H2M5.5S');
    assert.match(f.time12(0), /^\d{4}:\d{2}:\d{2}\.\d{2}$/);
    var c12 = f.interaction('1.2', { type: 'choice', response: [0, 2], correct: [1] });
    assert.deepEqual([c12.type, c12.response, c12.correct], ['choice', 'a,c', 'b']);
    var c04 = f.interaction('2004', { type: 'choice', response: [0, 2], correct: [1] });
    assert.equal(c04.response, 'a[,]c');
    assert.equal(f.interaction('1.2', { type: 'true-false', response: true }).response, 't');
    assert.equal(f.interaction('2004', { type: 'true-false', response: false }).response, 'false');
    assert.equal(f.interaction('1.2', { type: 'matching', response: [[0, 1], [1, 0]] }).response, 'a.b,b.a');
    assert.equal(f.interaction('2004', { type: 'matching', response: [[0, 1]] }).response, 'a[.]b');
    assert.equal(f.interaction('1.2', { type: 'other', response: 'x' }).type, 'performance');
    assert.equal(f.interaction('2004', { type: 'performance', response: 'x' }).type, 'other');
    assert.equal(f.interaction('1.2', { type: 'fill-in', response: ['a,b', 'c'] }).response, 'a b,c');
    assert.equal(f.id('my screen!'), 'my_screen_');
});

/** Recording mock of a SCORM API. */
function mockApi(version, preset) {
    var data = Object.assign({}, preset || {}), calls = [];
    var v12 = version === '1.2';
    var api = {};
    function rec(n, a, r) { calls.push([n].concat(a)); return r; }
    api[v12 ? 'LMSInitialize' : 'Initialize'] = function () { return rec('init', [], 'true'); };
    api[v12 ? 'LMSFinish' : 'Terminate'] = function () { return rec('term', [], 'true'); };
    api[v12 ? 'LMSCommit' : 'Commit'] = function () { return rec('commit', [], 'true'); };
    api[v12 ? 'LMSGetValue' : 'GetValue'] = function (k) { return rec('get', [k], data[k] === undefined ? '' : data[k]); };
    api[v12 ? 'LMSSetValue' : 'SetValue'] = function (k, v) { data[k] = v; return rec('set', [k, v], 'true'); };
    api[v12 ? 'LMSGetLastError' : 'GetLastError'] = function () { return '0'; };
    api[v12 ? 'LMSGetErrorString' : 'GetErrorString'] = function () { return ''; };
    api[v12 ? 'LMSGetDiagnostic' : 'GetDiagnostic'] = function () { return ''; };
    return { api: api, data: data, calls: calls };
}

function miniCourse(version) {
    return ELS.normalizeCourse({
        id: 'c1', title: 'T', settings: { scorm_version: version, mastery_score: 60 },
        screens: [
            { id: 'intro', type: 'title_slide', title: 'Hi' },
            Object.assign(ELS.newScreen('mcq', { screens: [] }), { id: 'q1', points: 10 }),
            Object.assign(ELS.newScreen('true_false', { screens: [] }), { id: 'q2', points: 10 }),
            Object.assign(ELS.newScreen('accordion', { screens: [] }), { id: 'acc', require_all: true }),
            { id: 'end', type: 'summary', title: 'End' }
        ]
    });
}

['1.2', '2004'].forEach(function (version) {
    test('tracker end-to-end against a mock LMS (SCORM ' + version + ')', function () {
        var m = mockApi(version);
        var A = ELS.SCORM.adapter(version, m.api);
        assert.ok(A.init());
        var course = miniCourse(version);
        var tr = new ELS.Tracker(course, A, { saveDelay: 0 });
        assert.equal(tr.resumed, false);
        course.screens.forEach(function (s, i) { tr.visit(s.id, i); });
        var t0 = tr.totals();
        assert.equal(t0.complete, false, 'not complete before activities');
        tr.record('q1', { ratio: 1, correct: true, final: true, attempts: 1, response: [1], interaction: { type: 'choice', response: [1], correct: [1] } });
        tr.record('q2', { ratio: 0, correct: false, final: true, attempts: 1, response: false, interaction: { type: 'true-false', response: false, correct: true } });
        tr.complete('acc');
        var t = tr.totals();
        assert.equal(t.complete, true);
        assert.equal(t.pct, 50);
        assert.equal(t.success, 'failed'); // 50 < 60
        tr.finish();
        if (version === '1.2') {
            assert.equal(m.data['cmi.core.lesson_status'], 'failed');
            assert.equal(m.data['cmi.core.score.raw'], '50');
            assert.equal(m.data['cmi.core.exit'], '');
            assert.equal(m.data['cmi.interactions.0.student_response'], 'b');
            assert.equal(m.data['cmi.interactions.1.result'], 'wrong');
            assert.match(m.data['cmi.core.session_time'], /^\d{4}:\d{2}:\d{2}\.\d{2}$/);
        } else {
            assert.equal(m.data['cmi.completion_status'], 'completed');
            assert.equal(m.data['cmi.success_status'], 'failed');
            assert.equal(m.data['cmi.score.scaled'], '0.5000');
            assert.equal(m.data['cmi.exit'], 'normal');
            assert.equal(m.data['cmi.interactions.1.result'], 'incorrect');
            assert.equal(m.data['cmi.progress_measure'], '1.0000');
            assert.match(m.data['cmi.session_time'], /^PT/);
        }
        assert.ok(m.calls.some(function (c) { return c[0] === 'term'; }));
        // Resume: new session with the stored data restores results and location.
        var m2 = mockApi(version, m.data);
        var A2 = ELS.SCORM.adapter(version, m2.api); A2.init();
        assert.equal(A2.interactionCount, 0, 'mock has no _count');
        var tr2 = new ELS.Tracker(course, A2);
        assert.equal(tr2.resumed, true);
        assert.equal(tr2.result('q1').s, 10);
        assert.equal(tr2.state.l, 4);
        assert.equal(tr2.totals().pct, 50);
    });
});

test('LMS mastery score overrides the course pass mark', function () {
    var m = mockApi('1.2', { 'cmi.student_data.mastery_score': '40' });
    var A = ELS.SCORM.adapter('1.2', m.api); A.init();
    var tr = new ELS.Tracker(miniCourse('1.2'), A, { saveDelay: 0 });
    assert.equal(tr.mastery, 40);
    var m2 = mockApi('2004', { 'cmi.scaled_passing_score': '0.9' });
    var A2 = ELS.SCORM.adapter('2004', m2.api); A2.init();
    assert.equal(new ELS.Tracker(miniCourse('2004'), A2).mastery, 90);
});

test('suspend data is trimmed to the SCORM 1.2 4096-char limit', function () {
    var m = mockApi('1.2');
    var A = ELS.SCORM.adapter('1.2', m.api); A.init();
    var course = miniCourse('1.2');
    var tr = new ELS.Tracker(course, A, { saveDelay: 0 });
    for (var i = 0; i < 40; i++) tr.setVar('x:k' + i, new Array(200).join('z'));
    tr.record('q1', { ratio: 1, correct: true, final: true, response: new Array(3000).join('r') });
    var s = tr.serialize();
    assert.ok(s.length <= 4096, 'length ' + s.length);
    assert.equal(JSON.parse(s).res.q1.s, 10, 'scores survive trimming');
});

test('no LMS → localStorage-free fallback adapter in Node works', function () {
    var A = ELS.SCORM.connect({ key: 'x' });
    assert.ok(['local', 'preview'].indexOf(A.version) >= 0);
    var tr = new ELS.Tracker(miniCourse('1.2'), A, { saveDelay: 0 });
    tr.visit('intro', 0);
    assert.equal(tr.isDone('intro'), true);
});

/* ------------------------------------------------------------------ */
test('adaptive practice: Elo targets success rate, BKT raises mastery', function () {
    var Ad = ELS.adaptive;
    var items = [1, 2, 3, 4, 5].map(function (d) { return { difficulty: d, skill: d > 3 ? 'hard' : 'easy', options: ['a', 'b'], correct: 1 }; });
    var cfg = { adaptive: { strategy: 'elo' }, target_success: 0.7 };
    var st = { theta: 0, p: {}, done: {}, n: 0, c: 0 };
    var first = Ad.next(items, st, cfg, function () { return 0; });
    assert.equal(items[first].difficulty, 2, 'theta 0 & 70% target → slightly easy item');
    Ad.update(items, st, first, true, cfg);
    assert.ok(st.theta > 0);
    var bk = { adaptive: { strategy: 'bkt' } }, s2 = { theta: 0, p: {}, done: {}, n: 0, c: 0 };
    var i = Ad.next(items, s2, bk, Math.random);
    var before = s2.p[items[i].skill];
    Ad.update(items, s2, i, true, bk);
    assert.ok(s2.p[items[i].skill] > before);
    assert.equal(Ad.shouldStop(items, { n: 5, p: {} }, cfg), true);
    assert.equal(Ad.shouldStop(items, { n: 2, p: {} }, { max_items: 2 }), true);
});

test('decision scenario best path score', function () {
    var tpl = ELS.registry.get('decision_scenario').template;
    assert.equal(ELS.decisionBestScore(tpl.nodes, 'start'), 20);
    var loop = [{ id: 'a', choices: [{ score_delta: 5, goto_node_id: 'b' }] }, { id: 'b', choices: [{ score_delta: 5, goto_node_id: 'a' }] }];
    assert.equal(ELS.decisionBestScore(loop, 'a'), 10, 'cycles terminate');
});

/* ------------------------------------------------------------------ */
test('zip writer produces valid archives (store + deflate)', async function () {
    var files = [{ path: 'a.txt', data: 'hello hello hello hello hello hello hello hello hello hello hello hello' }, { path: 'dir/ü.bin', data: new Uint8Array([1, 2, 3]) }];
    var zip = await ELSZip.build(files, { deflate: function (b) { return new Uint8Array(zlib.deflateRawSync(Buffer.from(b))); } });
    var list = ELSZip.list(zip);
    assert.equal(list.length, 2);
    assert.equal(list[0].method, 8);
    assert.equal(zlib.inflateRawSync(Buffer.from(list[0].data)).toString(), files[0].data);
    assert.equal(list[1].path, 'dir/ü.bin');
    assert.equal(list[1].crc, ELSZip.crc32(new Uint8Array([1, 2, 3])));
    assert.equal(ELSZip.crc32(ELSZip.utf8('123456789')), 0xCBF43926);
});

function readProject(p) { return fs.promises.readFile(path.join(load.ROOT, p)).then(function (b) { return new Uint8Array(b); }); }

test('packager: SCORM 1.2 and 2004 packages, asset extraction, manifests', async function () {
    var course = samples.build('en');
    // add an uploaded (data URI) image and an inline one inside HTML
    var png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    course.screens[1].blocks[3].src = png;
    course.screens[1].blocks[1].html += '<img src="' + png + '" alt="">';
    for (var v of ['1.2', '2004']) {
        var res = await packager.build(course, { ELS: ELS, version: v, readFile: readProject, deflate: function (b) { return new Uint8Array(zlib.deflateRawSync(Buffer.from(b))); } });
        assert.deepEqual(res.warnings, []);
        var names = ELSZip.list(res.zip).map(function (e) { return e.path; });
        ['imsmanifest.xml', 'index.html', 'course-data.js', 'js/els/player.js', 'js/reveal.js', 'css/elearning.css', 'lib/js/lottie_light.min.js', 'media/sample.mp4', 'img/samples/house.svg'].forEach(function (n) { assert.ok(names.indexOf(n) >= 0, v + ' missing ' + n); });
        var assets = names.filter(function (n) { return n.indexOf('assets/') === 0; });
        assert.equal(assets.length, 1, 'identical uploads are stored once');
        assert.ok(res.course.screens[1].blocks[3].src.indexOf('assets/') === 0);
        assert.ok(res.course.screens[1].blocks[1].html.indexOf('data:') < 0);
        assert.match(res.manifest, v === '1.2' ? /<schemaversion>1\.2<\/schemaversion>/ : /2004 4th Edition/);
        assert.match(res.manifest, v === '1.2' ? /adlcp:scormtype="sco"/ : /adlcp:scormType="sco"/);
        assert.match(res.manifest, v === '1.2' ? /<adlcp:masteryscore>70<\/adlcp:masteryscore>/ : /<imsss:minNormalizedMeasure>0\.70</);
        names.filter(function (n) { return n !== 'imsmanifest.xml'; }).forEach(function (n) { assert.ok(res.manifest.indexOf('href="' + n + '"') >= 0, 'manifest lists ' + n); });
        assert.equal(res.course.settings.scorm_version, v);
    }
});

test('packager refuses invalid courses and unsafe paths', async function () {
    var course = samples.build('en');
    course.screens[15].options.forEach(function (o) { o.correct = false; });
    await assert.rejects(packager.build(course, { ELS: ELS, version: '1.2', readFile: readProject }), /validation error/);
    assert.equal(packager.isLocalPath('../secret.png'), false);
    assert.equal(packager.isLocalPath('/etc/x.png'), false);
    assert.equal(packager.isLocalPath('https://x.org/a.png'), false);
    assert.equal(packager.isLocalPath('media/a.mp4'), true);
});

test('existing project files are untouched by the integration', function () {
    var idx = fs.readFileSync(path.join(load.ROOT, 'index.html'), 'utf8');
    assert.match(idx, /js\/config\.js/);
    assert.match(fs.readFileSync(path.join(load.ROOT, 'js/scormfunctions.js'), 'utf8'), /ScormProcessFinish/);
    assert.match(fs.readFileSync(path.join(load.ROOT, 'imsmanifest.xml'), 'utf8'), /questions\.html/);
});
