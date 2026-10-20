/**
 * Minimal ZIP writer (no dependencies). Stores files with DEFLATE when a
 * compressor is available (CompressionStream in browsers, zlib in Node) and
 * falls back to STORE. Produces standard zip files accepted by LMSs.
 *
 *   ELSZip.build([{ path: 'a.txt', data: Uint8Array|string }], { deflate: async fn }) -> Promise<Uint8Array>
 */
(function (root, factory) {
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ELSZip = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    var CRC_TABLE = (function () {
        var t = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function utf8(str) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        return Uint8Array.from(Buffer.from(str, 'utf8'));
    }

    function dosTime(d) {
        return {
            time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xFFFF,
            date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF
        };
    }

    /** Browser deflate-raw via CompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+). */
    function browserDeflate() {
        if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null;
        try { new CompressionStream('deflate-raw'); } catch (e) { return null; }
        return function (bytes) {
            var cs = new CompressionStream('deflate-raw');
            var stream = new Blob([bytes]).stream().pipeThrough(cs);
            return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
        };
    }

    function build(files, opts) {
        opts = opts || {};
        var deflate = opts.deflate === undefined ? browserDeflate() : opts.deflate;
        var now = dosTime(opts.date || new Date());
        var entries = [];
        var seq = Promise.resolve();
        files.forEach(function (f) {
            seq = seq.then(function () {
                var data = typeof f.data === 'string' ? utf8(f.data) : f.data;
                var crc = crc32(data);
                var name = utf8(f.path.replace(/\\/g, '/').replace(/^\/+/, ''));
                var tryDeflate = deflate && data.length > 64 && !/\.(png|jpe?g|gif|webp|mp4|webm|mp3|m4a|zip|woff2?)$/i.test(f.path);
                return (tryDeflate ? Promise.resolve(deflate(data)) : Promise.resolve(null)).then(function (comp) {
                    var useDeflate = comp && comp.length < data.length;
                    entries.push({ name: name, crc: crc, size: data.length, method: useDeflate ? 8 : 0, body: useDeflate ? comp : data });
                });
            });
        });
        return seq.then(function () {
            var chunks = [], central = [], offset = 0;
            entries.forEach(function (e) {
                var lh = new DataView(new ArrayBuffer(30));
                lh.setUint32(0, 0x04034b50, true);
                lh.setUint16(4, 20, true);              // version needed
                lh.setUint16(6, 0x0800, true);          // UTF-8 names
                lh.setUint16(8, e.method, true);
                lh.setUint16(10, now.time, true);
                lh.setUint16(12, now.date, true);
                lh.setUint32(14, e.crc, true);
                lh.setUint32(18, e.body.length, true);
                lh.setUint32(22, e.size, true);
                lh.setUint16(26, e.name.length, true);
                lh.setUint16(28, 0, true);
                chunks.push(new Uint8Array(lh.buffer), e.name, e.body);
                var ch = new DataView(new ArrayBuffer(46));
                ch.setUint32(0, 0x02014b50, true);
                ch.setUint16(4, 20, true);
                ch.setUint16(6, 20, true);
                ch.setUint16(8, 0x0800, true);
                ch.setUint16(10, e.method, true);
                ch.setUint16(12, now.time, true);
                ch.setUint16(14, now.date, true);
                ch.setUint32(16, e.crc, true);
                ch.setUint32(20, e.body.length, true);
                ch.setUint32(24, e.size, true);
                ch.setUint16(28, e.name.length, true);
                ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
                ch.setUint32(38, 0, true);
                ch.setUint32(42, offset, true);
                central.push(new Uint8Array(ch.buffer), e.name);
                offset += 30 + e.name.length + e.body.length;
            });
            var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
            var end = new DataView(new ArrayBuffer(22));
            end.setUint32(0, 0x06054b50, true);
            end.setUint16(8, entries.length, true);
            end.setUint16(10, entries.length, true);
            end.setUint32(12, cdSize, true);
            end.setUint32(16, offset, true);
            var all = chunks.concat(central, [new Uint8Array(end.buffer)]);
            var total = all.reduce(function (s, c) { return s + c.length; }, 0);
            var out = new Uint8Array(total), pos = 0;
            all.forEach(function (c) { out.set(c, pos); pos += c.length; });
            return out;
        });
    }

    /** Reads a zip produced by build() (STORE or DEFLATE via provided inflate) — used by tests. */
    function list(bytes) {
        var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        var eocd = -1;
        for (var i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        if (eocd < 0) throw new Error('Not a zip file');
        var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), out = [];
        var dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
        for (var n = 0; n < count; n++) {
            var method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
            var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
            var nameBytes = bytes.subarray(p + 46, p + 46 + nlen);
            var name = dec ? dec.decode(nameBytes) : Buffer.from(nameBytes).toString('utf8');
            var lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true);
            out.push({ path: name, method: method, crc: crc, size: size, compressedSize: csize, data: bytes.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + csize) });
            p += 46 + nlen + xlen + clen;
        }
        return out;
    }

    return { build: build, list: list, crc32: crc32, utf8: utf8 };
});
