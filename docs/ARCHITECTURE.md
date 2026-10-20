# ELS architecture — interactive screens, authoring and SCORM

ELS ("e-learning screens") extends this reveal.js + SCORM template with 31 interactive screen types, an authoring studio and SCORM 1.2 / 2004 packaging. It keeps the project's stack: static HTML, plain ES5 browser scripts, no build step and no runtime dependencies beyond reveal.js (and lottie-web for the Lottie type only).

```
author.html ──(course JSON)──► live preview iframe: course.html?preview=1
     │                                   │
     │ export (js/author/packager.js)    │ js/els/player.js  ── reveal.js (slides, transitions, RTL)
     ▼                                   │        │
SCORM zip: index.html + course-data.js   │        ├─ js/els/core.js      registry · schema · i18n · UI · question controller
           + runtime + media + manifest  │        ├─ js/els/types/*.js   31 screen types (6 modules)
                                         │        └─ js/els/scorm.js     SCORM 1.2/2004 adapters · Tracker · suspend data
```

## Files

| Path | Purpose |
|---|---|
| `js/els/core.js` | Namespace, utilities, seeded RNG, i18n (English + Arabic), icons, **screen registry**, **schema validation**, course model/defaults, animation helpers, shared UI (feedback, meters, score ring, roving focus), **question controller**, pointer-drag helper |
| `js/els/scorm.js` | API discovery (`API_1484_11`, `API`), adapters for SCORM 1.2 / 2004 / local storage / preview, data-model formatting, **Tracker** (state, scoring, completion, pass/fail, interactions, suspend data) |
| `js/els/types/content.js` | `title_slide`, `content_slide`, `video`, `summary` |
| `js/els/types/assessment.js` | `mcq`, `true_false`, `fill_blank`, `drag_drop`, `matching`, `sorting` |
| `js/els/types/interactive.js` | `hotspot`, `accordion`, `tabs`, `flashcards`, `timeline`, `labeled_diagram`, `data_chart`, `image_compare` |
| `js/els/types/scenarios.js` | `branching`, `simulation`, `decision_scenario`, `exploration`, `worked_example` |
| `js/els/types/games.js` | `game`, `term_match_race`, `escape_room`, `adaptive_practice` (+ Elo/BKT engine `ELS.adaptive`) |
| `js/els/types/advanced.js` | `lottie`, `results_breakdown`, `poll`, `embed_html` |
| `js/els/player.js` | Renders a course into reveal.js, app chrome (top bar, contents drawer, bottom navigation), gating, branching, resume, live-preview messaging, `ELS.boot()`, `ELS.enhanceDeck()` |
| `css/elearning.css` | Design system (tokens from the Greenpeace theme), all screen styles, RTL via logical properties, responsive breakpoints, reduced motion |
| `course.html` | Learner player (`?course=sample-ar` for the Arabic sample) |
| `interactive-slides.html` | Hand-written reveal.js deck that embeds interactive screens with `data-els-type` |
| `author.html`, `js/author/*.js`, `css/author.css` | Authoring studio, form engine, zip writer, SCORM packager |
| `lms-test.html` | Strict mock LMS (SCORM 1.2 / 2004) with call log, data model and resume testing |
| `courses/*.js` | Course data (`window.ELS_COURSES[name] = {…}`) — generated samples |
| `tools/` | `serve.js` (static server), `build-scorm.js` (CLI packager), `make-samples.js`, `make-docs.js`, `load-runtime.js` |
| `tests/` | `unit.test.js` (Node, `node --test`), `e2e.html` (browser, all 31 types in the mock LMS) |

The original `index.html`, `questions.html`, `js/config.js`, `js/questions.js` and `js/scormfunctions.js` are unchanged and keep working as before.

## Course model

```json
{
  "schema_version": 1, "id": "my-course", "title": "…", "lang": "en", "dir": "ltr",
  "theme":    { "primary": "#3b759e", "primary_dark": "#134674", "accent": "#66cc00", "background": "#f7fbfc",
                "surface": "#ffffff", "text": "#1f2d3a", "font": "Work Sans", "heading_font": "Rubik", "radius": 14, "style": "soft" },
  "settings": { "scorm_version": "1.2", "mastery_score": 70, "completion_rule": "all_viewed", "gate": "none",
                "transition": "slide", "show_progress": true, "show_menu": true, "show_score": true, "shuffle_seed": "" },
  "screens":  [ { "id": "intro", "type": "title_slide", "title": "Welcome", … } ]
}
```

`ELS.normalizeCourse()` fills defaults and repairs ids, so older or partial course files keep loading (forward-compatible: unknown keys are preserved). Field-level schemas for every type are listed in [SCREEN_TYPES.md](SCREEN_TYPES.md).

## Screen registry

Each type is one `ELS.registry.register(def)` call — no core changes are needed to add a type.

```js
ELS.registry.register({
  type: 'quote_reveal',                 // unique id used in course JSON
  label: 'Quote reveal', category: 'content', icon: ELS.icons.content,
  description: 'Shown in the studio library.',
  fields: [                             // schema → studio form + validation
    { key: 'quote_html', label: 'Quote', type: 'html', required: true },
    { key: 'author', label: 'Author', type: 'text' }
  ],
  template: { title: 'A thought', quote_html: '<p>…</p>' },   // starter content for new screens
  scored: false,                        // or true / function (cfg) → bool
  requiresInteraction: function (cfg) { return true; },       // completes only via ctx.complete()
  validate: function (cfg, course) { return []; },            // extra rules → [{ path, message, level }]
  render: function (ctx) {
    var btn = ELS.ui.button(ctx.t('continue'), function () { reveal.hidden = false; ctx.complete(); }, 'primary');
    var reveal = ELS.h('blockquote', { html: ctx.cfg.quote_html, hidden: true });
    ctx.el.appendChild(btn); ctx.el.appendChild(reveal);
  }
});
```

Put the file in `js/els/types/`, add a `<script>` tag to `course.html` and `author.html`, and add it to `RUNTIME` in `js/author/packager.js` and `FILES` in `tools/load-runtime.js`. The studio library, forms, validation, preview, export and contents menu pick it up automatically.

**Field types** understood by the form engine and validator: `text`, `textarea`, `html` (rich text with source view), `number`, `bool`, `select` (static `options` or dynamic `optionsFrom(root, course)`), `color`, `image`, `media`, `url`, `lottie`, `strings` (one per line), `list` (repeatable sub-form, `minItems`/`maxItems`), `group`, `screen`, `screens`, `code`, `json`, `id` (auto), `regions` / `points` / `rect` (visual editors on an image), `background`. Any field can use `showIf` (object or function), `required`, `min`/`max`, `pattern`, `default`, `help`.

### Render context (`ctx`)

| Member | Description |
|---|---|
| `cfg`, `id`, `index`, `course`, `screens` | The screen config and course |
| `el`, `section` | Body container and the reveal `<section>` |
| `t(key, vars)`, `lang`, `dir` | Learner-facing strings in the course language |
| `saved` | Previous result for resume: `{ s: score, m: max, c: correct, f: final, a: attempts, r: response, d: data }` |
| `maxPoints` | Points available on this screen |
| `score({ ratio, correct, final, attempts, response, interaction })` | Record a scored result (and an LMS interaction) |
| `complete()` / `isDone()` | Mark interaction-required screens complete |
| `store(obj)` / `stored()`, `setVar(k, v)` / `getVar(k)` | Persisted per-screen and course variables (suspend data) |
| `goTo(id)`, `next()`, `restart()` | Navigation (branching ignores gating) |
| `onEnter(fn)`, `onLeave(fn)`, `onDestroy(fn)` | Lifecycle (start/stop timers, pause media) |
| `totals()`, `resultOf(id)` | Course-wide results (summary, results breakdown) |
| `rng(salt)` | Seeded RNG (stable when `settings.shuffle_seed` is set) |

### Question controller

`ELS.question(ctx, { host, getResponse, evaluate, showResult, applyResponse, setLocked, reset, interaction })` gives every question type the same behaviour: Check / Try again buttons, attempts (`attempts`, 0 = until correct), feedback (correct / partly correct / incorrect + per-option feedback), points display, locking, confetti, LMS interaction recording and restoring a saved attempt after resume. Responses are stored in original (unshuffled) index terms, so shuffling never breaks resume.

## Tracking and SCORM

`ELS.SCORM.connect()` searches the window, its parents and opener for `API_1484_11` (2004) or `API` (1.2), preferring `settings.scorm_version` but falling back to whatever the LMS provides. Without an LMS it uses `localStorage` (standalone use); the studio preview uses an in-memory adapter.

**Tracker state** (JSON in `cmi.suspend_data`): `{ v:1, l: location, vis:{id:1}, dn:{id:1}, res:{id:{s,m,c,f,a,r,d}}, vars:{…} }`. If it exceeds the SCORM 1.2 limit (4096 chars) responses are dropped first, then long free text — scores and completion are always kept.

| Concept | Rule | SCORM 1.2 | SCORM 2004 |
|---|---|---|---|
| Screen done | non-interactive: on view; interactive: `ctx.complete()`; scored: final attempt | — | — |
| Progress | done screens / all screens | — | `cmi.progress_measure` |
| Complete | `all_viewed`: every screen done · `reached_end`: last screen visited | `lesson_status` `completed`/`passed`/`failed` vs `incomplete` | `cmi.completion_status` |
| Score | Σ screen scores / Σ max points × 100 | `cmi.core.score.raw/min/max` | `cmi.score.raw/min/max/scaled` |
| Pass/fail | when every scored screen is final: score ≥ mastery (LMS `mastery_score` / `scaled_passing_score` overrides the course value) | `passed` / `failed` | `cmi.success_status` |
| Interactions | one record per check attempt (id = screen id, type, response, correct pattern, result, weighting, time/latency, description) | `cmi.interactions.n.*` (`student_response`, `wrong`) | `cmi.interactions.n.*` (`learner_response`, `incorrect`, `[,]` / `[.]` delimiters) |
| Resume | location + suspend data; learner chooses Continue / Start over | `cmi.core.lesson_location`, `cmi.core.entry` | `cmi.location`, `cmi.entry` |
| Session | session time and exit mode on unload / pagehide | `cmi.core.session_time` (`HHHH:MM:SS.SS`), `cmi.core.exit=suspend` | `cmi.session_time` (ISO 8601), `cmi.exit=suspend/normal` |

Commits happen after every scored result and are debounced for other changes; `Terminate`/`LMSFinish` is called once on `pagehide`/`unload`. LMS errors are captured from `GetLastError` and shown to the learner as a non-blocking notice instead of the original template's `alert()`s.

## Player

`ELS.Player` renders each screen into a `<section>` and initialises reveal.js full-size (`width/height 100%`, `minScale = maxScale = 1`), so screens are responsive CSS layouts rather than scaled slides. It adds a top bar (course, section, progress, score), a contents drawer (with done/locked states) and a bottom navigation bar. Navigation gating (`settings.gate`) is enforced for buttons, keyboard and swipe. reveal.js' `rtl` option and `dir="rtl"` on `<html>` drive RTL; all styles use logical properties. Keys aimed at focused controls (Space on buttons, arrows in selects/video, roving focus groups, sliders) are kept from reveal's slide navigation.

`ELS.enhanceDeck()` reuses the same renderer and tracker for `<section data-els-type="…">` elements in a hand-written reveal.js presentation (see `interactive-slides.html`).

## Authoring studio

`author.html` (`js/author/app.js`) keeps the course in memory with undo/redo snapshots, autosaves to IndexedDB, validates on every change and posts the course to the preview iframe (`course.html?preview=1`, message `els:course`; the player answers `els:hello`, `els:ready`, `els:slide`). The form engine (`js/author/forms.js`) renders any registry schema. Templates are saved to `localStorage`. "Preview" and "LMS test harness" open the current course in a new tab through a same-origin `localStorage` hand-off (`?course=__author`).

## Packaging

`ELSPackager.build(course, { ELS, version, readFile })` validates the course, extracts uploaded `data:` URIs to `assets/` (deduplicated by CRC), collects referenced project files (relative paths only; `..` and absolute paths are refused), adds the runtime (and lottie-web only when used), writes `index.html`, `course-data.js` and `imsmanifest.xml` (1.2 with `adlcp:masteryscore`, or 2004 4th edition with a primary objective `minNormalizedMeasure`), then zips with DEFLATE (`CompressionStream` in browsers, zlib in Node). The same module runs in the studio and in `tools/build-scorm.js`.

## Security notes

Course HTML fields are author-trusted (as in the original template, where authors write HTML directly). Learner input is always inserted as text. `embed_html` runs in a sandboxed iframe without `allow-same-origin`; its postMessage bridge only accepts messages from that frame carrying a per-render token. The preview accepts course messages only from its parent window. The course loader only accepts simple names (`courses/<name>.js`).
