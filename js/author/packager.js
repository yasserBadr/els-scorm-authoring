/**
 * SCORM packager — turns a course JSON into a self-contained SCORM 1.2 or
 * SCORM 2004 (4th edition) zip: player runtime, course data, referenced
 * media (uploaded data: URIs are extracted to assets/), imsmanifest.xml.
 *
 * Works in the browser (authoring tool) and in Node (tools/build-scorm.js).
 *
 *   ELSPackager.build(course, {
 *     ELS,                          // runtime namespace (registry/validation)
 *     version: '1.2' | '2004',
 *     readFile: path -> Promise<Uint8Array|string>,   // relative to project root
 *     deflate: optional compressor passed to ELSZip,
 *     force: false                  // package even with validation errors
 *   }) -> Promise<{ zip, files, warnings, manifest, course }>
 */
(function (root, factory) {
    var zip = typeof module !== 'undefined' && module.exports ? require('./zip.js') : root.ELSZip;
    var api = factory(zip);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ELSPackager = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ELSZip) {
    'use strict';

    var RUNTIME = [
        'css/reset.css', 'css/reveal.css', 'css/elearning.css',
        'js/reveal.js',
        'js/els/core.js', 'js/els/scorm.js',
        'js/els/types/content.js', 'js/els/types/assessment.js', 'js/els/types/interactive.js',
        'js/els/types/scenarios.js', 'js/els/types/games.js', 'js/els/types/advanced.js',
        'js/els/player.js',
        'plugin/notes/notes.js', 'plugin/notes/notes.html',
        'LICENSE'
    ];
    var LOTTIE = ['lib/js/lottie_light.min.js', 'lib/js/lottie-LICENSE.md'];
    var MEDIA_EXT = /\.(png|jpe?g|gif|svg|webp|avif|mp4|webm|ogv|mov|mp3|ogg|oga|wav|m4a|vtt|json|pdf)$/i;
    var MIME_EXT = {
        'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/avif': 'avif',
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
        'audio/mp4': 'm4a', 'text/vtt': 'vtt', 'application/json': 'json', 'application/pdf': 'pdf'
    };

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function b64ToBytes(b64) {
        if (typeof atob === 'function') {
            var bin = atob(b64), out = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        }
        return Uint8Array.from(Buffer.from(b64, 'base64'));
    }

    function decodeDataUri(uri) {
        var m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/.exec(uri);
        if (!m) return null;
        var mime = (m[1] || 'application/octet-stream').toLowerCase();
        var bytes = m[3] ? b64ToBytes(m[4].replace(/\s+/g, '')) : ELSZip.utf8(decodeURIComponent(m[4]));
        return { mime: mime, bytes: bytes, ext: MIME_EXT[mime] || 'bin' };
    }

    /** Walk every string in obj, letting fn return a replacement. */
    function walk(obj, fn) {
        if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) obj[i] = typeof obj[i] === 'string' ? fn(obj[i]) : (walk(obj[i], fn), obj[i]); return; }
        if (obj && typeof obj === 'object') Object.keys(obj).forEach(function (k) { if (typeof obj[k] === 'string') obj[k] = fn(obj[k]); else walk(obj[k], fn); });
    }

    function isLocalPath(p) {
        if (!p || /^(https?:|data:|blob:|mailto:|tel:|javascript:|#|\/\/|\/)/i.test(p)) return false;
        if (p.split(/[\\/]/).indexOf('..') >= 0) return false;
        return MEDIA_EXT.test(p.split(/[?#]/)[0]);
    }

    /** Extract data: URIs to asset files and collect local file references. */
    function prepareAssets(course) {
        var assets = {}, refs = {}, warnings = [];
        function store(uri) {
            var d = decodeDataUri(uri);
            if (!d) return uri;
            var name = 'assets/' + ELSZip.crc32(d.bytes).toString(16) + '-' + d.bytes.length.toString(36) + '.' + d.ext;
            assets[name] = d.bytes;
            return name;
        }
        walk(course.screens, function (s) {
            if (/^data:/i.test(s)) return store(s);
            if (s.indexOf('data:') >= 0 && /<|url\(/i.test(s)) {
                s = s.replace(/((?:src|href|poster)\s*=\s*["'])(data:[^"']+)(["'])/gi, function (_, a, uri, b) { return a + store(uri) + b; });
                s = s.replace(/url\((["']?)(data:[^)"']+)\1\)/gi, function (_, q, uri) { return 'url(' + q + store(uri) + q + ')'; });
            }
            var clean = s.trim();
            if (isLocalPath(clean) && clean.indexOf('assets/') !== 0) refs[clean.split(/[?#]/)[0]] = 1;
            if (/[<]|url\(/.test(s)) {
                s.replace(/(?:src|href|poster|data)\s*=\s*["']([^"']+)["']/gi, function (_, p) { if (isLocalPath(p)) refs[p.split(/[?#]/)[0]] = 1; return _; });
                s.replace(/url\((["']?)([^)"']+)\1\)/gi, function (_, q, p) { if (isLocalPath(p)) refs[p.split(/[?#]/)[0]] = 1; return _; });
            }
            return s;
        });
        // Extracted uploads are already in `assets`; everything else must be read from the project.
        return { assets: assets, refs: Object.keys(refs).filter(function (r) { return !assets[r]; }), warnings: warnings };
    }

    function indexHtml(course) {
        var scripts = ['js/reveal.js', 'js/els/core.js', 'js/els/scorm.js', 'js/els/types/content.js', 'js/els/types/assessment.js',
            'js/els/types/interactive.js', 'js/els/types/scenarios.js', 'js/els/types/games.js', 'js/els/types/advanced.js', 'js/els/player.js', 'course-data.js'];
        return '<!doctype html>\n<html lang="' + esc(course.lang) + '" dir="' + esc(course.dir) + '">\n<head>\n<meta charset="utf-8">\n' +
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(course.title) + '</title>\n' +
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&family=Tajawal:wght@400;500;700&display=swap">\n' +
            '<link rel="stylesheet" href="css/reset.css">\n<link rel="stylesheet" href="css/reveal.css">\n<link rel="stylesheet" href="css/elearning.css">\n</head>\n<body>\n' +
            '<div class="reveal"><div class="slides"></div></div>\n' +
            scripts.map(function (s) { return '<script src="' + s + '"></script>'; }).join('\n') +
            '\n<script>ELS.boot();</script>\n</body>\n</html>\n';
    }

    function manifest(course, version, files, scored) {
        var id = String(course.id || 'course').replace(/[^A-Za-z0-9_\-.]/g, '_');
        var title = esc(course.title);
        var mastery = Number(course.settings.mastery_score);
        var fileXml = files.map(function (f) { return '      <file href="' + esc(f) + '"/>'; }).join('\n');
        if (version === '2004') {
            var seq = scored && isFinite(mastery) ? '\n        <imsss:sequencing>\n          <imsss:objectives>\n            <imsss:primaryObjective objectiveID="PRIMARYOBJ" satisfiedByMeasure="true">\n' +
                '              <imsss:minNormalizedMeasure>' + (mastery / 100).toFixed(2) + '</imsss:minNormalizedMeasure>\n            </imsss:primaryObjective>\n          </imsss:objectives>\n        </imsss:sequencing>' : '';
            return '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<manifest identifier="' + id + '" version="1"\n' +
                '  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"\n  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"\n  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"\n' +
                '  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"\n  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"\n  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
                '  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">\n' +
                '  <metadata>\n    <schema>ADL SCORM</schema>\n    <schemaversion>2004 4th Edition</schemaversion>\n  </metadata>\n' +
                '  <organizations default="ORG-' + id + '">\n    <organization identifier="ORG-' + id + '">\n      <title>' + title + '</title>\n' +
                '      <item identifier="ITEM-' + id + '" identifierref="RES-' + id + '">\n        <title>' + title + '</title>' + seq + '\n      </item>\n' +
                '      <imsss:sequencing>\n        <imsss:controlMode choice="true" flow="true"/>\n      </imsss:sequencing>\n' +
                '    </organization>\n  </organizations>\n' +
                '  <resources>\n    <resource identifier="RES-' + id + '" type="webcontent" adlcp:scormType="sco" href="index.html">\n' + fileXml + '\n    </resource>\n  </resources>\n</manifest>\n';
        }
        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<manifest identifier="' + id + '" version="1.0"\n  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n' +
            '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
            '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">\n' +
            '  <metadata>\n    <schema>ADL SCORM</schema>\n    <schemaversion>1.2</schemaversion>\n  </metadata>\n' +
            '  <organizations default="ORG-' + id + '">\n    <organization identifier="ORG-' + id + '">\n      <title>' + title + '</title>\n' +
            '      <item identifier="ITEM-' + id + '" identifierref="RES-' + id + '" isvisible="true">\n        <title>' + title + '</title>\n' +
            (scored && isFinite(mastery) ? '        <adlcp:masteryscore>' + Math.round(mastery) + '</adlcp:masteryscore>\n' : '') +
            '      </item>\n    </organization>\n  </organizations>\n' +
            '  <resources>\n    <resource identifier="RES-' + id + '" type="webcontent" adlcp:scormtype="sco" href="index.html">\n' + fileXml + '\n    </resource>\n  </resources>\n</manifest>\n';
    }

    function build(course, opts) {
        var ELS = opts.ELS;
        var version = opts.version === '2004' ? '2004' : '1.2';
        var c = ELS.normalizeCourse(JSON.parse(JSON.stringify(course)));
        c.settings.scorm_version = version;
        var report = ELS.schema.validateCourse(c);
        if (report.errors && !opts.force) {
            var e = new Error('The course has ' + report.errors + ' validation error(s). Fix them before exporting.');
            e.report = report;
            return Promise.reject(e);
        }
        var prep = prepareAssets(c);
        var warnings = prep.warnings.slice();
        var scored = c.screens.some(function (s) { return ELS.registry.isScored(s); });
        var needLottie = c.screens.some(function (s) { return s.type === 'lottie'; });
        var paths = RUNTIME.concat(needLottie ? LOTTIE : []).concat(prep.refs);
        var out = {};
        var reads = paths.map(function (p) {
            return Promise.resolve().then(function () { return opts.readFile(p); }).then(function (data) {
                if (data === null || data === undefined) throw new Error('missing');
                out[p] = data;
            }).catch(function () {
                if (RUNTIME.indexOf(p) >= 0 || LOTTIE.indexOf(p) >= 0) warnings.push('Runtime file could not be read: ' + p);
                else warnings.push('Referenced file not found and not packaged: ' + p);
            });
        });
        return Promise.all(reads).then(function () {
            Object.keys(prep.assets).forEach(function (k) { out[k] = prep.assets[k]; });
            out['index.html'] = indexHtml(c);
            out['course-data.js'] = '/* Course data — generated by the ELS authoring tool. */\n(window.ELS_COURSES = window.ELS_COURSES || {}).course = ' + JSON.stringify(c) + ';\n';
            var files = Object.keys(out).sort(function (a, b) { return a === 'index.html' ? -1 : b === 'index.html' ? 1 : a < b ? -1 : 1; });
            var man = manifest(c, version, files, scored);
            out['imsmanifest.xml'] = man;
            var list = ['imsmanifest.xml'].concat(files).map(function (p) { return { path: p, data: out[p] }; });
            return ELSZip.build(list, { deflate: opts.deflate }).then(function (zip) {
                return { zip: zip, files: list.map(function (f) { return f.path; }), warnings: warnings, manifest: man, course: c };
            });
        });
    }

    return { build: build, manifest: manifest, prepareAssets: prepareAssets, indexHtml: indexHtml, decodeDataUri: decodeDataUri, isLocalPath: isLocalPath, RUNTIME: RUNTIME };
});
