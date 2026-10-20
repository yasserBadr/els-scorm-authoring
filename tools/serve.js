#!/usr/bin/env node
/**
 * Tiny static file server (no dependencies) for authoring and previewing.
 * The authoring tool needs http:// (not file://) to package SCORM zips.
 *
 *   node tools/serve.js [port]      → http://localhost:8080/author.html
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var PORT = Number(process.argv[2] || process.env.PORT || 8080);
var TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.vtt': 'text/vtt; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip'
};

http.createServer(function (req, res) {
    var url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/') url = '/author.html';
    var file = path.normalize(path.join(ROOT, url));
    if (file.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(file, function (err, st) {
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found: ' + url); }
        var type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
        var range = req.headers.range;
        if (range && /^bytes=/.test(range)) {
            // Range support so <video> can seek.
            var parts = range.replace('bytes=', '').split('-');
            var start = parseInt(parts[0], 10) || 0, end = parts[1] ? parseInt(parts[1], 10) : st.size - 1;
            res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-cache' });
            return fs.createReadStream(file, { start: start, end: end }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
    });
}).listen(PORT, function () {
    console.log('ELS authoring server: http://localhost:' + PORT + '/author.html');
    console.log('Sample course:        http://localhost:' + PORT + '/course.html  (Arabic: ?course=sample-ar)');
});
