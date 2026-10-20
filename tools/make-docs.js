#!/usr/bin/env node
/**
 * Generates docs/SCREEN_TYPES.md from the screen registry (schemas, defaults,
 * scoring and tracking), so the reference always matches the code.
 *   node tools/make-docs.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var load = require('./load-runtime');
var ELS = load();

// How each type reports to the LMS (cmi.interactions type), for the reference table.
var INTERACTION = {
    mcq: 'choice', true_false: 'true-false', fill_blank: 'fill-in', drag_drop: 'matching', matching: 'matching', sorting: 'sequencing',
    hotspot: 'choice (quiz mode)', labeled_diagram: 'matching (quiz mode)', simulation: 'performance / other', decision_scenario: 'performance / other',
    game: 'performance / other', term_match_race: 'matching', escape_room: 'performance / other', adaptive_practice: 'performance / other',
    poll: 'likert / choice / long-fill-in (neutral)', embed_html: 'numeric (when scored)'
};
var NOTES = {
    title_slide: 'Hero opener. "Start" moves to the next screen; layout `hero`, `split` or `minimal`.',
    content_slide: 'Either `body_html` + `media` in one of four layouts, or a grid of `blocks` (text, image, callout, quote, key figure).',
    video: 'Native player for MP4/WebM with WebVTT captions, speed control and transcript. With `require_complete` only time actually played counts (seeking ahead does not). YouTube/Vimeo URLs are embedded but cannot be tracked.',
    summary: 'Re-computed every time it is shown: score ring, pass/fail, progress, per-activity scores and links to unfinished activities. Optional restart.',
    mcq: 'Single or multiple answer. Partial credit for multi-select = (right − wrong) / correct options, or all-or-nothing. Per-option feedback.',
    true_false: 'Two large answer cards.',
    fill_blank: 'Mark gaps with `{{1}}`, `{{2}}`… Modes: type, dropdown, word bank. Answers are trimmed, case-insensitive (unless set) and tolerant of Arabic letter variants.',
    drag_drop: 'Categorise items into zones by pointer drag (mouse, touch, pen) or tap-to-place (keyboard accessible). Wrong items return to the bank on retry.',
    matching: 'Select a left item then its right partner; coloured connector lines are drawn. Right column is shuffled.',
    sorting: 'Reorder by drag, ↑/↓ buttons or Alt/Ctrl+Arrow keys. Never starts in the correct order.',
    hotspot: 'Regions use % coordinates (responsive). Quiz: pick the right spot (visible or hidden regions, click-anywhere hit testing). Explore: reveal each region\'s content; optional "open every region" completion.',
    accordion: 'Single- or multi-open sections; optional "open every section" completion.',
    tabs: 'ARIA tablist (top, side, pills) with arrow-key navigation; optional "view every tab" completion.',
    flashcards: '3D flip cards as a grid or a self-rated study deck ("Got it" / "Review again", shuffle).',
    timeline: 'Horizontal stepper with progress bar, or vertical expandable story.',
    labeled_diagram: 'Numbered markers at % positions. Quiz: name each marker from a dropdown. Display: hover/tap callouts with a legend.',
    data_chart: 'Deterministic inline SVG (no library): column, horizontal bar, line, pie, donut. Animated, tooltips, notes per point, accessible data table, mirrored in RTL.',
    image_compare: 'Before/after slider built on a native range input (drag + keyboard).',
    branching: 'Each choice jumps to a target screen (or the default target / next screen) after optional feedback. The choice is remembered.',
    simulation: 'Software/procedure walkthrough: click a target area, type a value, or choose an option per step. Hints after mistakes; score = steps right first time.',
    decision_scenario: 'Node graph of scenes with decisions, consequences and score deltas. Course score = scenario points / best achievable path; pass when ≥ `pass_score`.',
    exploration: 'Free text, choice, prediction or slider. Stored under `store_key` and replayed anywhere with `<span data-exploration-ref="key"></span>`.',
    worked_example: 'Fading: full, partial (rationale behind "Why?"), problem-only (reveal step by step). Optional self-explanation (kept in course state only).',
    game: 'Templates: quiz show (timer, lives, streak bonus), memory match (moves), word scramble (lives, hints). Best play is kept; pass at `pass_ratio`.',
    term_match_race: 'Timed matching; wrong matches cost seconds. Score = 80% × matched ratio + 20% time bonus when all matched.',
    escape_room: 'Puzzles unlock in sequence; a wrong answer costs a life and shows the hint. Score = solved / total.',
    adaptive_practice: 'Elo: picks the item whose predicted success is closest to `target_success` and updates ability. BKT: per-skill mastery (p-init 0.3, transit 0.15, slip 0.1, guess 0.2), optional mastery stop.',
    lottie: 'lottie-web (light SVG renderer, bundled in `lib/js`) loaded on demand; play/pause and scrubber; respects reduced-motion.',
    results_breakdown: 'Groups scored screens into topics, shows per-topic %, flags topics below `weak_threshold` with advice and links.',
    poll: 'Unscored. Optional benchmark bars (author-supplied reference data — not live aggregation) and reflection. Reported as a neutral interaction.',
    embed_html: 'Runs in a sandboxed iframe (`allow-scripts`, no same-origin). Bridge: `ELS.complete()`, `ELS.setScore(0–100)`, `ELS.passed()`, `ELS.failed()`. Messages are accepted only from that frame with a per-render token.'
};

function fieldRows(fields, prefix) {
    var rows = [];
    fields.forEach(function (f) {
        if (f.section || f.type === 'id') return;
        var key = (prefix ? prefix + '.' : '') + f.key;
        var type = f.type;
        if (f.options) type += ': ' + f.options.map(function (o) { return '`' + (typeof o === 'object' ? o.value : o) + '`'; }).join(' / ');
        var notes = [];
        if (f.required) notes.push('**required**');
        if (f.minItems) notes.push('min ' + f.minItems);
        if (f.maxItems) notes.push('max ' + f.maxItems);
        if (f.default !== undefined) notes.push('default `' + JSON.stringify(f.default) + '`');
        if (f.showIf) notes.push('conditional');
        rows.push('| `' + key + '` | ' + (f.label || f.key).replace(/\|/g, '/') + ' | ' + type.replace(/\|/g, '/') + ' | ' + notes.join(', ') + (f.help ? (notes.length ? ' — ' : '') + f.help.replace(/\|/g, '/') : '') + ' |');
        if ((f.type === 'list' || f.type === 'regions' || f.type === 'points') && f.fields) rows = rows.concat(fieldRows(f.fields, key + '[]'));
        if (f.type === 'group' && f.fields) rows = rows.concat(fieldRows(f.fields, key));
    });
    return rows;
}

function build() {
    var out = [];
    out.push('# Screen types reference (31 types)');
    out.push('');
    out.push('> Generated from the screen registry by `node tools/make-docs.js` — do not edit by hand.');
    out.push('');
    out.push('Every screen is a JSON object `{ "id", "type", "title", … }` inside `course.screens`. The schemas below are exactly what the authoring studio edits and what `ELS.schema.validateScreen()` checks.');
    out.push('');
    out.push('## Fields shared by every screen');
    out.push('');
    out.push('| Field | Label | Type | Notes |');
    out.push('|---|---|---|---|');
    out.push('| `id` | Screen id | text | **required**, 1–64 of `A-Z a-z 0-9 _ -`, unique in the course; used by branching, results and as the LMS interaction id |');
    out.push('| `type` | Screen type | text | **required**, one of the 31 types below |');
    out = out.concat(fieldRows(ELS.baseFields));
    out.push('');
    out.push('Scored types also share `points`, `attempts` (0 = unlimited until correct) and `feedback.correct / incorrect / partial`; most multi-part types add `scoring`: `partial` or `all_or_nothing`.');
    out.push('');
    out.push('## Overview');
    out.push('');
    out.push('| # | Type | Category | Scored | Completion | LMS interaction |');
    out.push('|---|---|---|---|---|---|');
    var n = 0;
    ELS.registry.byCategory().forEach(function (g) {
        g.types.forEach(function (d) {
            n++;
            var t = ELS.newScreen(d.type, { screens: [] });
            var scored = ELS.registry.isScored(t);
            var alt = d.type === 'hotspot' ? ' (quiz mode)' : d.type === 'labeled_diagram' ? ' (quiz mode)' : d.type === 'embed_html' ? ' (optional)' : '';
            var completion = scored ? 'when final answer recorded' : (ELS.registry.requiresInteraction(t) || d.requiresInteraction ? 'after required interaction' : 'on view');
            if (d.requiresInteraction && !scored && !ELS.registry.requiresInteraction(t)) completion = 'on view, or after interaction when configured';
            out.push('| ' + n + ' | [`' + d.type + '`](#' + d.type.replace(/_/g, '_') + ') ' + d.label + ' | ' + g.category.label + ' | ' + (scored || alt ? 'yes' + alt : 'no') + ' | ' + completion + ' | ' + (INTERACTION[d.type] || '—') + ' |');
        });
    });
    ELS.registry.byCategory().forEach(function (g) {
        out.push('');
        out.push('## ' + g.category.label);
        out.push('');
        out.push('_' + g.category.description + '._');
        g.types.forEach(function (d) {
            var t = ELS.newScreen(d.type, { screens: [] });
            out.push('');
            out.push('### ' + d.type);
            out.push('');
            out.push('**' + d.label + '** — ' + d.description + (ELS.registry.isScored(t) ? ' Default points: **' + ELS.registry.maxPoints(t) + '**.' : ''));
            out.push('');
            if (NOTES[d.type]) { out.push(NOTES[d.type]); out.push(''); }
            out.push('| Field | Label | Type | Notes |');
            out.push('|---|---|---|---|');
            out = out.concat(fieldRows(d.fields));
            out.push('');
            out.push('<details><summary>Starter template (JSON)</summary>');
            out.push('');
            out.push('```json');
            out.push(JSON.stringify(d.template, null, 2));
            out.push('```');
            out.push('</details>');
        });
    });
    out.push('');
    return out.join('\n');
}

if (require.main === module) {
    var file = path.join(load.ROOT, 'docs', 'SCREEN_TYPES.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, build());
    console.log('wrote', path.relative(load.ROOT, file));
}
module.exports = build;
