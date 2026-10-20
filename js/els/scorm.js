/**
 * ELS SCORM layer — SCORM 1.2 + SCORM 2004 (3rd/4th ed.) run-time adapters,
 * a localStorage fallback for standalone use, and the course Tracker that
 * turns screen results into LMS score / completion / pass-fail / interactions
 * and suspend data (resume).
 *
 * API discovery follows the ADL algorithm used by js/scormfunctions.js
 * (Rustici Software, CC-BY 3.0) but searches for both API_1484_11 and API.
 */
(function (root) {
    'use strict';
    var ELS = root.ELS = root.ELS || {};
    var util = ELS.util;

    /* ------------------------------------------------------------------ *
     * API discovery
     * ------------------------------------------------------------------ */
    function scan(win, name) {
        var tries = 0;
        try {
            while (win && !win[name] && win.parent && win.parent !== win && tries < 10) { tries++; win = win.parent; }
            return win && win[name] ? win[name] : null;
        } catch (e) { return null; } // cross-origin parent
    }
    function find(name) {
        var api = scan(root, name);
        if (!api && root.opener) {
            try { api = scan(root.opener, name); } catch (e) { api = null; }
        }
        if (!api && root.top && root.top.opener) {
            try { api = scan(root.top.opener, name); } catch (e) { api = null; }
        }
        return api;
    }

    /* ------------------------------------------------------------------ *
     * Time / format helpers
     * ------------------------------------------------------------------ */
    var fmt = ELS.scormFormat = {
        pad: function (n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; },
        /** SCORM 1.2 CMITimespan HHHH:MM:SS.SS */
        time12: function (sec) {
            sec = Math.max(0, sec);
            var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
            return fmt.pad(h, 4) + ':' + fmt.pad(m, 2) + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
        },
        /** SCORM 2004 ISO-8601 duration */
        time2004: function (sec) {
            sec = Math.max(0, sec);
            var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round((sec % 60) * 100) / 100;
            return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + s + 'S';
        },
        clock12: function (d) { return fmt.pad(d.getHours(), 2) + ':' + fmt.pad(d.getMinutes(), 2) + ':' + fmt.pad(d.getSeconds(), 2); },
        stamp2004: function (d) {
            return d.getFullYear() + '-' + fmt.pad(d.getMonth() + 1, 2) + '-' + fmt.pad(d.getDate(), 2) + 'T' + fmt.clock12(d);
        },
        id: function (s) { return String(s).replace(/[^A-Za-z0-9_\-.]/g, '_').slice(0, 250) || 'q'; },
        text: function (s, max) { return util.stripHtml(s).replace(/[\[\]]/g, '').slice(0, max || 250); },
        token: function (i) { return util.letter(Number(i)); },
        /**
         * Convert a normalised interaction to per-version strings.
         * inter = { type, response, correct, description }
         *   true-false: response bool
         *   choice/likert/sequencing: array of indices
         *   matching: array of [left, right] index pairs
         *   fill-in: array of strings
         *   performance/other/numeric: string|number
         */
        interaction: function (version, inter) {
            var v12 = version === '1.2';
            var sep = v12 ? ',' : '[,]', dot = v12 ? '.' : '[.]';
            function enc(type, val) {
                if (val === undefined || val === null) return '';
                switch (type) {
                    case 'true-false': return v12 ? (val ? 't' : 'f') : (val ? 'true' : 'false');
                    case 'choice': case 'sequencing': case 'likert':
                        return (Array.isArray(val) ? val : [val]).map(fmt.token).join(type === 'likert' ? '' : sep);
                    case 'matching':
                        return (val || []).map(function (p) { return fmt.token(p[0]) + dot + fmt.token(p[1]); }).join(sep);
                    case 'fill-in':
                        return (Array.isArray(val) ? val : [val]).map(function (x) { return fmt.text(x, 60).replace(/,/g, ' '); }).join(sep).slice(0, 250);
                    case 'numeric': return String(Number(val) || 0);
                    default: return fmt.text(typeof val === 'string' ? val : JSON.stringify(val), 250);
                }
            }
            var type = inter.type || 'other';
            if (v12 && (type === 'other' || type === 'long-fill-in')) type = 'performance';
            if (!v12 && type === 'performance') type = 'other';
            if (type === 'likert' && Array.isArray(inter.response)) inter.response = inter.response.slice(0, 1);
            return {
                type: type,
                response: enc(type, inter.response),
                correct: inter.correct === undefined ? null : enc(type, inter.correct),
                description: inter.description ? fmt.text(inter.description, 250) : ''
            };
        }
    };

    /* ------------------------------------------------------------------ *
     * Adapters — common interface
     * ------------------------------------------------------------------ */
    function baseAdapter(version, api, onError) {
        var A = { version: version, api: api, initialized: false, terminated: false, errors: [], interactionCount: 0 };
        var v12 = version === '1.2';
        var fn = v12 ? { init: 'LMSInitialize', get: 'LMSGetValue', set: 'LMSSetValue', commit: 'LMSCommit', term: 'LMSFinish', err: 'LMSGetLastError', str: 'LMSGetErrorString', diag: 'LMSGetDiagnostic' }
            : { init: 'Initialize', get: 'GetValue', set: 'SetValue', commit: 'Commit', term: 'Terminate', err: 'GetLastError', str: 'GetErrorString', diag: 'GetDiagnostic' };

        function lastError(call) {
            try {
                var code = String(api[fn.err]());
                if (code && code !== '0') {
                    var msg = call + ' → ' + code + ' ' + api[fn.str](code) + ' ' + (api[fn.diag](code) || '');
                    A.errors.push(msg);
                    if (onError) onError(msg, code);
                    return code;
                }
            } catch (e) { /* ignore */ }
            return '0';
        }
        A.call = function (name, a, b) {
            try {
                var r = b === undefined ? api[fn[name]](a === undefined ? '' : a) : api[fn[name]](a, b);
                if (name !== 'get' && String(r) === 'false') lastError(name + (a ? ' ' + a : ''));
                if (name === 'get') { var code = String(api[fn.err]()); if (code !== '0' && code !== '403') lastError('get ' + a); }
                return r;
            } catch (e) {
                A.errors.push(name + ': ' + e.message);
                if (onError) onError(name + ': ' + e.message);
                return name === 'get' ? '' : 'false';
            }
        };
        A.get = function (k) { return A.call('get', k); };
        A.set = function (k, v) { return String(A.call('set', k, String(v))) === 'true'; };
        A.init = function () {
            var r = A.call('init', '');
            A.initialized = String(r) === 'true';
            if (A.initialized) {
                var n = parseInt(A.get('cmi.interactions._count'), 10);
                A.interactionCount = isFinite(n) ? n : 0;
            }
            return A.initialized;
        };
        A.commit = function () { if (A.initialized && !A.terminated) return A.call('commit', ''); };
        A.terminate = function () {
            if (!A.initialized || A.terminated) return;
            A.terminated = true;
            A.call('term', '');
        };
        A.getSuspend = function () { return A.get('cmi.suspend_data') || ''; };
        A.setSuspend = function (s) { return A.set('cmi.suspend_data', s); };
        A.getLocation = function () { return A.get(v12 ? 'cmi.core.lesson_location' : 'cmi.location') || ''; };
        A.setLocation = function (s) { return A.set(v12 ? 'cmi.core.lesson_location' : 'cmi.location', String(s).slice(0, 255)); };
        A.getEntry = function () { return A.get(v12 ? 'cmi.core.entry' : 'cmi.entry'); };
        A.getLearnerName = function () { return A.get(v12 ? 'cmi.core.student_name' : 'cmi.learner_name'); };
        A.getMastery = function () {
            var v = v12 ? parseFloat(A.get('cmi.student_data.mastery_score')) : parseFloat(A.get('cmi.scaled_passing_score')) * 100;
            return isFinite(v) ? v : null;
        };
        A.suspendLimit = v12 ? 4096 : 64000;
        A.setScore = function (pct) {
            pct = Math.round(util.clamp(pct, 0, 100) * 100) / 100;
            if (v12) {
                A.set('cmi.core.score.min', 0); A.set('cmi.core.score.max', 100); A.set('cmi.core.score.raw', pct);
            } else {
                A.set('cmi.score.min', 0); A.set('cmi.score.max', 100); A.set('cmi.score.raw', pct);
                A.set('cmi.score.scaled', (pct / 100).toFixed(4));
            }
        };
        /** st = { complete: bool, success: 'passed'|'failed'|null, progress: 0..1 } */
        A.setStatus = function (st) {
            if (v12) {
                var s = st.complete ? (st.success || 'completed') : 'incomplete';
                A.set('cmi.core.lesson_status', s);
            } else {
                A.set('cmi.completion_status', st.complete ? 'completed' : 'incomplete');
                A.set('cmi.success_status', st.success || 'unknown');
                if (typeof st.progress === 'number') A.set('cmi.progress_measure', util.clamp(st.progress, 0, 1).toFixed(4));
            }
        };
        A.setSessionTime = function (sec) { A.set(v12 ? 'cmi.core.session_time' : 'cmi.session_time', v12 ? fmt.time12(sec) : fmt.time2004(sec)); };
        A.setExit = function (suspend) {
            if (v12) A.set('cmi.core.exit', suspend ? 'suspend' : '');
            else A.set('cmi.exit', suspend ? 'suspend' : 'normal');
        };
        A.addInteraction = function (i) {
            var n = A.interactionCount++;
            var p = 'cmi.interactions.' + n + '.';
            var e = fmt.interaction(version, i);
            A.set(p + 'id', fmt.id(i.id));
            A.set(p + 'type', e.type);
            if (e.correct !== null && e.correct !== '') A.set(p + 'correct_responses.0.pattern', e.correct);
            A.set(p + (v12 ? 'student_response' : 'learner_response'), e.response);
            A.set(p + 'result', i.result === 'neutral' ? 'neutral' : (i.result === 'correct' ? 'correct' : (v12 ? 'wrong' : 'incorrect')));
            if (i.weighting !== undefined) A.set(p + 'weighting', i.weighting);
            if (i.latency !== undefined) A.set(p + 'latency', v12 ? fmt.time12(i.latency) : fmt.time2004(i.latency));
            var now = new Date();
            if (v12) A.set(p + 'time', fmt.clock12(now));
            else {
                A.set(p + 'timestamp', fmt.stamp2004(now));
                if (e.description) A.set(p + 'description', e.description);
            }
            return n;
        };
        return A;
    }

    /** Standalone adapter: no LMS. Persists to localStorage (or memory in preview). */
    function localAdapter(key, persist) {
        var store = {};
        var ls = null;
        if (persist) { try { ls = root.localStorage; ls.getItem('x'); } catch (e) { ls = null; } }
        if (ls) { try { store = JSON.parse(ls.getItem(key) || '{}') || {}; } catch (e) { store = {}; } }
        function save() { if (ls) { try { ls.setItem(key, JSON.stringify(store)); } catch (e) { /* quota */ } } }
        var A = {
            version: persist ? 'local' : 'preview', initialized: true, errors: [], interactions: [], suspendLimit: 64000,
            init: function () { return true; }, commit: function () { save(); }, terminate: function () { save(); },
            get: function (k) { return store[k] || ''; }, set: function (k, v) { store[k] = String(v); return true; },
            getSuspend: function () { return store.suspend || ''; }, setSuspend: function (s) { store.suspend = s; },
            getLocation: function () { return store.location || ''; }, setLocation: function (s) { store.location = String(s); },
            getEntry: function () { return store.suspend ? 'resume' : 'ab-initio'; },
            getLearnerName: function () { return ''; }, getMastery: function () { return null; },
            setScore: function (p) { store.score = p; }, setStatus: function (s) { store.status = JSON.stringify(s); },
            setSessionTime: function () { }, setExit: function () { },
            addInteraction: function (i) { A.interactions.push(i); return A.interactions.length - 1; },
            clear: function () { store = {}; if (ls) { try { ls.removeItem(key); } catch (e) { } } }
        };
        return A;
    }

    ELS.SCORM = {
        find: find,
        /**
         * opts: { version: 'auto'|'1.2'|'2004', preview: bool, key, onError }
         */
        connect: function (opts) {
            opts = opts || {};
            if (opts.preview) return localAdapter('', false);
            var want = opts.version || 'auto';
            var api2004 = (want === 'auto' || want === '2004') ? find('API_1484_11') : null;
            var api12 = !api2004 && (want === 'auto' || want === '1.2') ? find('API') : null;
            // If the preferred version isn't present, fall back to whatever the LMS offers.
            if (!api2004 && !api12) { api2004 = find('API_1484_11'); if (!api2004) api12 = find('API'); }
            var A = null;
            if (api2004) A = baseAdapter('2004', api2004, opts.onError);
            else if (api12) A = baseAdapter('1.2', api12, opts.onError);
            if (A && A.init()) return A;
            if (A && opts.onError) opts.onError('Initialize failed');
            return localAdapter('els:' + (opts.key || 'course'), true);
        },
        local: localAdapter,
        adapter: baseAdapter
    };

    /* ------------------------------------------------------------------ *
     * Tracker — owns the learner state and LMS reporting.
     *
     * State (kept compact for the 4096-char SCORM 1.2 suspend_data limit):
     *  { v:1, l: location index, vis: {id:1}, dn: {id:1}, res: {id: Result}, vars: {} , t: seconds }
     * Result: { s: score, m: max, c: 1|0, f: final 1|0, a: attempts, r: response, d: extra data }
     * ------------------------------------------------------------------ */
    ELS.Tracker = function (course, adapter, opts) {
        opts = opts || {};
        var self = this;
        this.course = course;
        this.adapter = adapter;
        this.listeners = [];
        this.state = { v: 1, l: 0, vis: {}, dn: {}, res: {}, vars: {} };
        this.started = Date.now();
        this.resumed = false;
        this.finished = false;

        var raw = adapter.getSuspend();
        if (raw) {
            try {
                var st = JSON.parse(raw);
                if (st && st.v === 1) { this.state = st; this.resumed = true; }
            } catch (e) { /* corrupted suspend data — start fresh */ }
        }
        ['vis', 'dn', 'res', 'vars'].forEach(function (k) { if (!self.state[k]) self.state[k] = {}; });
        var lmsMastery = adapter.getMastery ? adapter.getMastery() : null;
        this.mastery = lmsMastery !== null && lmsMastery !== undefined ? lmsMastery : Number(course.settings.mastery_score);
        if (!isFinite(this.mastery)) this.mastery = 0;
        this._save = util.debounce(function () { self.flush(); }, opts.saveDelay === undefined ? 400 : opts.saveDelay);
    };

    var T = ELS.Tracker.prototype;

    T.on = function (fn) { this.listeners.push(fn); };
    T.emit = function (what, data) { var s = this; this.listeners.forEach(function (fn) { try { fn(what, data, s); } catch (e) { } }); };

    T.screenIndex = function (id) {
        for (var i = 0; i < this.course.screens.length; i++) if (this.course.screens[i].id === id) return i;
        return -1;
    };

    T.visit = function (id, index) {
        this.state.vis[id] = 1;
        this.state.l = index;
        var s = this.course.screens[index];
        if (s && !ELS.registry.requiresInteraction(s)) this.state.dn[id] = 1;
        this.emit('visit', id);
        this._save();
    };

    T.complete = function (id) {
        if (this.state.dn[id]) return;
        this.state.dn[id] = 1;
        this.emit('complete', id);
        this._save();
    };

    T.isDone = function (id) { return !!this.state.dn[id]; };
    T.result = function (id) { return this.state.res[id] || null; };

    /** r = { ratio, correct, response, final, attempts, interaction, data, max } */
    T.record = function (id, r) {
        var screen = this.course.screens[this.screenIndex(id)];
        var max = r.max !== undefined ? r.max : ELS.registry.maxPoints(screen || { type: '' });
        var score = Math.round(util.clamp(r.ratio || 0, 0, 1) * max * 100) / 100;
        var res = { s: score, m: max, c: r.correct ? 1 : 0, f: r.final ? 1 : 0, a: r.attempts || 1 };
        if (r.response !== undefined) res.r = r.response;
        if (r.data !== undefined) res.d = r.data;
        this.state.res[id] = res;
        if (r.final) this.state.dn[id] = 1;
        if (r.interaction && this.adapter.addInteraction) {
            var i = r.interaction;
            try {
                this.adapter.addInteraction({
                    id: id, type: i.type, response: i.response, correct: i.correct, description: i.description || (screen && screen.title),
                    result: i.result || (r.correct ? 'correct' : 'incorrect'), weighting: max, latency: i.latency
                });
            } catch (e) { /* keep going even if interactions are rejected */ }
        }
        this.emit('record', id);
        this.flush();
    };

    T.setVar = function (k, v) {
        this.state.vars[k] = typeof v === 'string' ? v.slice(0, 500) : v;
        this.emit('var', k);
        this._save();
    };
    T.getVar = function (k) { return this.state.vars[k]; };

    T.reset = function () {
        this.state = { v: 1, l: 0, vis: {}, dn: {}, res: {}, vars: {} };
        this.finished = false;
        if (this.adapter.clear) this.adapter.clear();
        this.flush();
        this.emit('reset');
    };

    /** Aggregate score / completion / pass status. */
    T.totals = function () {
        var self = this, screens = this.course.screens;
        var score = 0, max = 0, scored = 0, answered = 0, done = 0;
        screens.forEach(function (s) {
            if (self.state.dn[s.id]) done++;
            if (!ELS.registry.isScored(s)) return;
            scored++;
            var m = ELS.registry.maxPoints(s);
            max += m;
            var r = self.state.res[s.id];
            if (r) { score += Math.min(r.s, m); if (r.f) answered++; }
        });
        var pct = max ? (score / max) * 100 : 0;
        var rule = this.course.settings.completion_rule;
        var lastVisited = screens.length && this.state.vis[screens[screens.length - 1].id];
        var complete = rule === 'reached_end' ? !!lastVisited : (screens.length > 0 && done === screens.length);
        var allAnswered = answered === scored;
        var success = null;
        if (scored && allAnswered) success = pct >= this.mastery ? 'passed' : 'failed';
        if (!scored && complete) success = 'passed';
        return {
            score: score, max: max, pct: Math.round(pct * 100) / 100, scored: scored, answered: answered,
            done: done, total: screens.length, progress: screens.length ? done / screens.length : 0,
            complete: complete, success: success, mastery: this.mastery
        };
    };

    T.serialize = function () {
        var s = JSON.stringify(this.state);
        var limit = this.adapter.suspendLimit || 4096;
        if (s.length <= limit) return s;
        // Too large for this LMS: drop stored responses (scores are kept), then free-text vars.
        var slim = util.clone(this.state);
        Object.keys(slim.res).forEach(function (k) { delete slim.res[k].r; delete slim.res[k].d; });
        s = JSON.stringify(slim);
        if (s.length <= limit) return s;
        Object.keys(slim.vars).forEach(function (k) { if (typeof slim.vars[k] === 'string') slim.vars[k] = slim.vars[k].slice(0, 40); });
        s = JSON.stringify(slim);
        if (s.length <= limit) return s;
        slim.vars = {}; slim.vis = {};
        return JSON.stringify(slim).slice(0, limit);
    };

    T.flush = function () {
        var a = this.adapter, tot = this.totals();
        a.setSuspend(this.serialize());
        a.setLocation(this.state.l);
        if (tot.scored) a.setScore(tot.pct);
        var success = tot.complete ? tot.success : (this.course.settings.scorm_version === '2004' ? tot.success : null);
        a.setStatus({ complete: tot.complete, success: success, progress: tot.progress });
        a.commit();
        this.emit('flush', tot);
        return tot;
    };

    /** Called on unload: session time, exit mode, final commit, terminate. */
    T.finish = function () {
        if (this.finished) return;
        this.finished = true;
        var tot = this.flush();
        var a = this.adapter;
        a.setSessionTime((Date.now() - this.started) / 1000);
        a.setExit(!tot.complete);
        a.commit();
        a.terminate();
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = ELS;
})(typeof window !== 'undefined' ? window : globalThis);
