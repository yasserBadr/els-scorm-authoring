#!/usr/bin/env node
/**
 * Build a SCORM package from a course file — same packager as the authoring tool.
 *
 *   node tools/build-scorm.js <course.json | courses/name.js> [--version 1.2|2004] [--out file.zip] [--force]
 *
 * Examples:
 *   node tools/build-scorm.js courses/sample-en.js --version 2004
 *   node tools/build-scorm.js my-course.json --out dist/my-course-scorm12.zip
 */
'use strict';
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var load = require('./load-runtime');
var ELS = load();
var packager = require('../js/author/packager.js');

function readCourse(file) {
    var text = fs.readFileSync(file, 'utf8');
    var t = text.trim();
    if (t.charAt(0) === '{') return JSON.parse(t);
    // courses/*.js wrapper: (window.ELS_COURSES = ...)["name"] = {...};
    var sandbox = { window: {} };
    new Function('window', text)(sandbox.window);
    var store = sandbox.window.ELS_COURSES || {};
    var keys = Object.keys(store);
    if (!keys.length) throw new Error('No course found in ' + file);
    return store[keys[0]];
}

function parseArgs(argv) {
    var a = { _: [] };
    for (var i = 0; i < argv.length; i++) {
        if (argv[i] === '--version') a.version = argv[++i];
        else if (argv[i] === '--out') a.out = argv[++i];
        else if (argv[i] === '--force') a.force = true;
        else a._.push(argv[i]);
    }
    return a;
}

function run(args) {
    var src = args._[0];
    if (!src) { console.error('Usage: node tools/build-scorm.js <course.json|courses/name.js> [--version 1.2|2004] [--out file.zip]'); process.exit(2); }
    var course = readCourse(path.resolve(src));
    var version = args.version || (course.settings && course.settings.scorm_version) || '1.2';
    return packager.build(course, {
        ELS: ELS, version: version, force: !!args.force,
        readFile: function (p) { return fs.promises.readFile(path.join(load.ROOT, p)).then(function (b) { return new Uint8Array(b); }); },
        deflate: function (bytes) { return new Uint8Array(zlib.deflateRawSync(Buffer.from(bytes), { level: 9 })); }
    }).then(function (res) {
        var slug = String(res.course.title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || String(res.course.id || 'course').replace(/[^A-Za-z0-9_-]+/g, '-');
        var out = path.resolve(args.out || path.join(load.ROOT, 'dist', slug + '-scorm' + version.replace('.', '') + '.zip'));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, Buffer.from(res.zip));
        res.warnings.forEach(function (w) { console.warn('warning:', w); });
        console.log('SCORM ' + version + ' package: ' + path.relative(process.cwd(), out) + ' (' + res.files.length + ' files, ' + Math.round(res.zip.length / 1024) + ' KB)');
        return res;
    }).catch(function (e) {
        console.error('Export failed:', e.message);
        if (e.report) Object.keys(e.report.screens).forEach(function (id) {
            e.report.screens[id].forEach(function (i) { if (i.level !== 'warning') console.error('  [' + id + '] ' + i.path + ': ' + i.message); });
        });
        process.exitCode = 1;
    });
}

if (require.main === module) run(parseArgs(process.argv.slice(2)));
module.exports = { run: run, readCourse: readCourse };
