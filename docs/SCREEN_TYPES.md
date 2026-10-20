# Screen types reference (31 types)

> Generated from the screen registry by `node tools/make-docs.js` — do not edit by hand.

Every screen is a JSON object `{ "id", "type", "title", … }` inside `course.screens`. The schemas below are exactly what the authoring studio edits and what `ELS.schema.validateScreen()` checks.

## Fields shared by every screen

| Field | Label | Type | Notes |
|---|---|---|---|
| `id` | Screen id | text | **required**, 1–64 of `A-Z a-z 0-9 _ -`, unique in the course; used by branching, results and as the LMS interaction id |
| `type` | Screen type | text | **required**, one of the 31 types below |
| `title` | Screen title | text | **required** |
| `kicker` | Kicker | text | Small label shown above the title, e.g. "Module 1". |
| `lead` | Lead text | textarea | Short introduction shown under the title. |
| `hide_header` | Hide title header | bool |  |
| `section` | Section | text | Groups screens in the learner's contents menu. |
| `background` | Screen background | background | Colour or image behind this screen. |
| `notes` | Speaker / facilitator notes | textarea | Shown in reveal.js speaker view (press S). |

Scored types also share `points`, `attempts` (0 = unlimited until correct) and `feedback.correct / incorrect / partial`; most multi-part types add `scoring`: `partial` or `all_or_nothing`.

## Overview

| # | Type | Category | Scored | Completion | LMS interaction |
|---|---|---|---|---|---|
| 1 | [`title_slide`](#title_slide) Title slide | Basic content | no | on view | — |
| 2 | [`content_slide`](#content_slide) Content | Basic content | no | on view | — |
| 3 | [`video`](#video) Video | Basic content | no | after required interaction | — |
| 4 | [`summary`](#summary) Summary | Basic content | no | on view | — |
| 5 | [`mcq`](#mcq) Multiple choice | Assessment | yes | when final answer recorded | choice |
| 6 | [`true_false`](#true_false) True / false | Assessment | yes | when final answer recorded | true-false |
| 7 | [`fill_blank`](#fill_blank) Fill in the blanks | Assessment | yes | when final answer recorded | fill-in |
| 8 | [`drag_drop`](#drag_drop) Drag and drop | Assessment | yes | when final answer recorded | matching |
| 9 | [`matching`](#matching) Matching pairs | Assessment | yes | when final answer recorded | matching |
| 10 | [`sorting`](#sorting) Sorting / sequence | Assessment | yes | when final answer recorded | sequencing |
| 11 | [`hotspot`](#hotspot) Image hotspots | Interactive content | yes (quiz mode) | when final answer recorded | choice (quiz mode) |
| 12 | [`accordion`](#accordion) Accordion | Interactive content | no | after required interaction | — |
| 13 | [`tabs`](#tabs) Tabs | Interactive content | no | on view, or after interaction when configured | — |
| 14 | [`flashcards`](#flashcards) Flashcards | Interactive content | no | after required interaction | — |
| 15 | [`timeline`](#timeline) Timeline | Interactive content | no | on view, or after interaction when configured | — |
| 16 | [`labeled_diagram`](#labeled_diagram) Labeled diagram | Interactive content | yes (quiz mode) | when final answer recorded | matching (quiz mode) |
| 17 | [`data_chart`](#data_chart) Data chart | Interactive content | no | on view | — |
| 18 | [`image_compare`](#image_compare) Before / after | Interactive content | no | on view | — |
| 19 | [`branching`](#branching) Branching | Simulations & decisions | no | after required interaction | — |
| 20 | [`simulation`](#simulation) Simulation | Simulations & decisions | yes | when final answer recorded | performance / other |
| 21 | [`decision_scenario`](#decision_scenario) Decision scenario | Simulations & decisions | yes | when final answer recorded | performance / other |
| 22 | [`exploration`](#exploration) Exploration | Simulations & decisions | no | after required interaction | — |
| 23 | [`worked_example`](#worked_example) Worked example | Simulations & decisions | no | on view, or after interaction when configured | — |
| 24 | [`game`](#game) Educational game | Gamification | yes | when final answer recorded | performance / other |
| 25 | [`term_match_race`](#term_match_race) Term match race | Gamification | yes | when final answer recorded | matching |
| 26 | [`escape_room`](#escape_room) Escape room | Gamification | yes | when final answer recorded | performance / other |
| 27 | [`adaptive_practice`](#adaptive_practice) Adaptive practice | Gamification | yes | when final answer recorded | performance / other |
| 28 | [`lottie`](#lottie) Lottie animation | Advanced & specialized | no | on view | — |
| 29 | [`results_breakdown`](#results_breakdown) Results breakdown | Advanced & specialized | no | on view | — |
| 30 | [`poll`](#poll) Poll & reflection | Advanced & specialized | no | on view | likert / choice / long-fill-in (neutral) |
| 31 | [`embed_html`](#embed_html) Custom HTML | Advanced & specialized | yes (optional) | after required interaction | numeric (when scored) |

## Basic content

_Titles, rich content, video and summaries._

### title_slide

**Title slide** — Course or module opener with a hero image and start button.

Hero opener. "Start" moves to the next screen; layout `hero`, `split` or `minimal`.

| Field | Label | Type | Notes |
|---|---|---|---|
| `subtitle` | Subtitle | text |  |
| `body_html` | Intro text | html |  |
| `layout` | Layout | select: `hero` / `split` / `minimal` | default `"hero"` |
| `background_image` | Hero / side image | image |  |
| `image_alt` | Image description (alt text) | text | conditional |
| `button_label` | Start button label | text | Leave empty for the default "Start". Use "-" to hide. |
| `meta` | Meta line | text | E.g. "15 min · 6 activities". |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Welcome to the course",
  "subtitle": "An interactive learning experience",
  "layout": "hero",
  "body_html": "<p>Use the arrows, keyboard or swipe to move between screens.</p>",
  "meta": "10 min"
}
```
</details>

### content_slide

**Content** — Rich text with media in flexible layouts, or a composition of content blocks.

Either `body_html` + `media` in one of four layouts, or a grid of `blocks` (text, image, callout, quote, key figure).

| Field | Label | Type | Notes |
|---|---|---|---|
| `layout` | Layout | select: `text` / `text_media` / `media_text` / `full_media` | default `"text_media"` |
| `body_html` | Body | html | Required unless you use content blocks. |
| `media` | Image / video | media | conditional |
| `media_alt` | Media description (alt text) | text | conditional |
| `media_caption` | Media caption | text | conditional |
| `blocks` | Content blocks (optional — replace body & media) | list |  |
| `blocks[].kind` | Block type | select: `text` / `image` / `callout` / `quote` / `stat` | default `"text"` |
| `blocks[].value` | Figure | text | conditional |
| `blocks[].html` | Text | html | conditional |
| `blocks[].src` | Image | image | conditional |
| `blocks[].alt` | Alt text | text | conditional |
| `blocks[].wide` | Full width | bool |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Key ideas",
  "layout": "text",
  "body_html": "<p>Write your content here. You can use <strong>bold</strong>, lists and links.</p><ul><li>First point</li><li>Second point</li></ul>"
}
```
</details>

### video

**Video** — Video player with captions, speed control, transcript and optional watch-to-complete.

Native player for MP4/WebM with WebVTT captions, speed control and transcript. With `require_complete` only time actually played counts (seeking ahead does not). YouTube/Vimeo URLs are embedded but cannot be tracked.

| Field | Label | Type | Notes |
|---|---|---|---|
| `video_url` | Video (MP4/WebM file, upload, or YouTube/Vimeo URL) | media | **required** |
| `poster` | Poster image | image |  |
| `captions_url` | Captions (WebVTT .vtt) | url |  |
| `captions_lang` | Captions language code | text | default `"en"` |
| `caption` | Caption below video | text |  |
| `transcript_html` | Transcript | html |  |
| `require_complete` | Learner must watch the video | bool | default `false` |
| `completion_threshold` | Watched % required | number | default `90`, conditional |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Watch: introduction",
  "video_url": "media/sample.mp4",
  "captions_url": "media/sample-en.vtt",
  "captions_lang": "en",
  "caption": "A short introduction video.",
  "require_complete": true,
  "completion_threshold": 90
}
```
</details>

### summary

**Summary** — Lesson wrap-up with score, completion status and links to unfinished activities.

Re-computed every time it is shown: score ring, pass/fail, progress, per-activity scores and links to unfinished activities. Optional restart.

| Field | Label | Type | Notes |
|---|---|---|---|
| `body_html` | Summary text | html |  |
| `show_score` | Show score | bool | default `true` |
| `show_completion` | Show completion status | bool | default `true` |
| `show_breakdown` | List activity scores | bool | default `true` |
| `passed_html` | Message when passed | html |  |
| `failed_html` | Message when not passed | html |  |
| `allow_restart` | Allow learner to restart the course | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Summary",
  "body_html": "<p>Here is what you covered in this lesson.</p><ul><li>Key idea one</li><li>Key idea two</li></ul>",
  "show_score": true,
  "show_completion": true,
  "show_breakdown": true
}
```
</details>

## Assessment

_Scored questions reported to the LMS._

### mcq

**Multiple choice** — Single or multiple answer question with per-option feedback. Default points: **10**.

Single or multiple answer. Partial credit for multi-select = (right − wrong) / correct options, or all-or-nothing. Per-option feedback.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Question | html | **required** |
| `image` | Illustration | image |  |
| `image_alt` | Illustration alt text | text | conditional |
| `options` | Options | list | min 2, max 26 |
| `options[].text` | Option text | text | **required** |
| `options[].correct` | Correct | bool |  |
| `options[].feedback` | Feedback for this option | text |  |
| `multi_select` | Allow multiple answers | bool | default `false` |
| `shuffle` | Shuffle options | bool | default `true` |
| `columns` | Option layout | select: `list` / `grid` | default `"list"` |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Check your understanding",
  "prompt_html": "<p>Which of these is a renewable energy source?</p>",
  "options": [
    {
      "text": "Coal",
      "correct": false,
      "feedback": "Coal is a fossil fuel."
    },
    {
      "text": "Solar power",
      "correct": true
    },
    {
      "text": "Natural gas",
      "correct": false
    },
    {
      "text": "Diesel",
      "correct": false
    }
  ],
  "multi_select": false,
  "shuffle": true,
  "points": 10,
  "attempts": 2,
  "scoring": "all_or_nothing",
  "feedback": {
    "correct": "<p>Exactly — sunlight is replenished naturally.</p>",
    "incorrect": "<p>Look for the source that is naturally replenished.</p>"
  }
}
```
</details>

### true_false

**True / false** — A statement the learner judges as true or false. Default points: **10**.

Two large answer cards.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Statement | html | **required** |
| `correct` | Correct answer | select: `true` / `false` | **required**, default `true` |
| `true_label` | Label for "True" | text |  |
| `false_label` | Label for "False" | text |  |
| `image` | Illustration | image |  |
| `image_alt` | Illustration alt text | text | conditional |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "True or false?",
  "prompt_html": "<p>Recycling one aluminium can saves enough energy to run a TV for about three hours.</p>",
  "correct": true,
  "points": 10,
  "attempts": 1,
  "feedback": {
    "correct": "<p>Yes! Recycling aluminium uses about 95% less energy than making it new.</p>",
    "incorrect": "<p>It is true — recycled aluminium needs a fraction of the energy.</p>"
  }
}
```
</details>

### fill_blank

**Fill in the blanks** — Text with gaps answered by typing, dropdowns or a word bank. Default points: **10**.

Mark gaps with `{{1}}`, `{{2}}`… Modes: type, dropdown, word bank. Answers are trimmed, case-insensitive (unless set) and tolerant of Arabic letter variants.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Instructions | html |  |
| `text_html` | Text with blanks | html | **required** — Mark each gap with {{1}}, {{2}}… in order. Without markers the blanks are listed below the instructions. |
| `blanks` | Blanks | list | min 1 |
| `blanks[].accepted` | Accepted answers | strings | **required** — One per line. The first is shown as the model answer. |
| `blanks[].label` | Label (when no markers are used) | text |  |
| `mode` | Answer mode | select: `type` / `dropdown` / `word_bank` | default `"type"` |
| `distractors` | Extra wrong words | strings | conditional |
| `case_sensitive` | Case sensitive | bool | default `false` |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Complete the sentence",
  "prompt_html": "<p>Fill in the missing words.</p>",
  "text_html": "<p>Plants absorb {{1}} from the air and release {{2}} through photosynthesis.</p>",
  "blanks": [
    {
      "accepted": [
        "carbon dioxide",
        "CO2"
      ]
    },
    {
      "accepted": [
        "oxygen",
        "O2"
      ]
    }
  ],
  "mode": "type",
  "distractors": [
    "nitrogen",
    "methane"
  ],
  "case_sensitive": false,
  "points": 10,
  "attempts": 2,
  "scoring": "partial",
  "feedback": {
    "correct": "<p>Well done!</p>",
    "incorrect": "<p>Photosynthesis takes in CO₂ and gives off O₂.</p>"
  }
}
```
</details>

### drag_drop

**Drag and drop** — Sort items into the correct categories by dragging (or tapping) them. Default points: **10**.

Categorise items into zones by pointer drag (mouse, touch, pen) or tap-to-place (keyboard accessible). Wrong items return to the bank on retry.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Instructions | html | **required** |
| `targets` | Drop zones | list | min 1, max 8 |
| `targets[].label` | Zone label | text | **required** |
| `targets[].image` | Zone image | image |  |
| `items` | Draggable items | list | min 2 |
| `items[].text` | Item text | text | **required** |
| `items[].image` | Item image | image |  |
| `items[].target` | Correct zone | select | **required** |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Sort the waste",
  "prompt_html": "<p>Drag each item into the right bin. You can also tap an item and then tap a bin.</p>",
  "targets": [
    {
      "id": "recycle",
      "label": "Recycling"
    },
    {
      "id": "compost",
      "label": "Compost"
    },
    {
      "id": "landfill",
      "label": "General waste"
    }
  ],
  "items": [
    {
      "text": "Glass bottle",
      "target": "recycle"
    },
    {
      "text": "Banana peel",
      "target": "compost"
    },
    {
      "text": "Newspaper",
      "target": "recycle"
    },
    {
      "text": "Coffee grounds",
      "target": "compost"
    },
    {
      "text": "Chip packet",
      "target": "landfill"
    }
  ],
  "points": 10,
  "attempts": 2,
  "scoring": "partial",
  "feedback": {
    "correct": "<p>Perfectly sorted!</p>",
    "incorrect": "<p>Some items are in the wrong bin — they are highlighted.</p>"
  }
}
```
</details>

### matching

**Matching pairs** — Connect each item on the left with its partner on the right. Default points: **10**.

Select a left item then its right partner; coloured connector lines are drawn. Right column is shuffled.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Instructions | html |  |
| `pairs` | Pairs | list | min 2, max 12 |
| `pairs[].left` | Left item | text | **required** |
| `pairs[].right` | Matching right item | text | **required** |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Match the terms",
  "prompt_html": "<p>Match each term with its definition.</p>",
  "pairs": [
    {
      "left": "Biodiversity",
      "right": "Variety of life in an area"
    },
    {
      "left": "Habitat",
      "right": "Natural home of an organism"
    },
    {
      "left": "Ecosystem",
      "right": "Community of organisms and their environment"
    },
    {
      "left": "Erosion",
      "right": "Wearing away of soil and rock"
    }
  ],
  "points": 10,
  "attempts": 2,
  "scoring": "partial",
  "feedback": {
    "correct": "<p>All pairs matched correctly.</p>",
    "incorrect": "<p>Some connections are wrong.</p>"
  }
}
```
</details>

### sorting

**Sorting / sequence** — Put steps or items into the correct order. Default points: **10**.

Reorder by drag, ↑/↓ buttons or Alt/Ctrl+Arrow keys. Never starts in the correct order.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Instructions | html |  |
| `items` | Items (in the correct order) | list | min 2, max 15 |
| `items[].text` | Text | text | **required** |
| `top_label` | Label for first position | text |  |
| `bottom_label` | Label for last position | text |  |
| `points` | Points | number | default `10` |
| `attempts` | Attempts allowed | number | default `1` — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Put the steps in order",
  "prompt_html": "<p>Order the stages of the water cycle, starting with the first.</p>",
  "items": [
    {
      "text": "Evaporation"
    },
    {
      "text": "Condensation"
    },
    {
      "text": "Precipitation"
    },
    {
      "text": "Collection"
    }
  ],
  "top_label": "First",
  "bottom_label": "Last",
  "points": 10,
  "attempts": 2,
  "scoring": "partial",
  "feedback": {
    "correct": "<p>That is the full cycle.</p>",
    "incorrect": "<p>Water evaporates, condenses into clouds, falls, then collects.</p>"
  }
}
```
</details>

## Interactive content

_Explorable content, media and data._

### hotspot

**Image hotspots** — Clickable regions on an image — explore content or find the right spot (quiz). Default points: **10**.

Regions use % coordinates (responsive). Quiz: pick the right spot (visible or hidden regions, click-anywhere hit testing). Explore: reveal each region's content; optional "open every region" completion.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Prompt | html | **required** |
| `image` | Image | image | **required** |
| `image_alt` | Image description (alt text) | text |  |
| `mode` | Mode | select: `quiz` / `explore` | default `"quiz"` |
| `show_regions` | Show region outlines | bool | default `true`, conditional |
| `require_all` | Learner must open every region | bool | default `false`, conditional |
| `regions` | Regions | regions | min 1 |
| `regions[].label` | Label | text | **required** |
| `regions[].shape` | Shape | select: `rect` / `circle` | default `"rect"` |
| `regions[].x` | X (%) | number | default `10` |
| `regions[].y` | Y (%) | number | default `10` |
| `regions[].w` | Width (%) | number | default `20`, conditional |
| `regions[].h` | Height (%) | number | default `20`, conditional |
| `regions[].r` | Radius (% of width) | number | default `8`, conditional |
| `regions[].correct` | Correct spot (quiz) | bool | conditional |
| `regions[].content_html` | Content / feedback shown on click | html |  |
| `points` | Points | number | default `10`, conditional |
| `attempts` | Attempts allowed | number | default `1`, conditional — 0 = unlimited (until correct). |
| `feedback` | Feedback | group | conditional |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Spot the solar panels",
  "prompt_html": "<p>Click the part of the house that turns sunlight into electricity.</p>",
  "image": "img/samples/house.svg",
  "image_alt": "Illustration of a house with roof, window, door and garden",
  "mode": "quiz",
  "show_regions": true,
  "regions": [
    {
      "id": "r1",
      "label": "Roof panels",
      "shape": "rect",
      "x": 27,
      "y": 27,
      "w": 41,
      "h": 15,
      "correct": true,
      "content_html": "<p>Solar panels convert sunlight into electricity.</p>"
    },
    {
      "id": "r2",
      "label": "Window",
      "shape": "rect",
      "x": 30,
      "y": 50,
      "w": 16,
      "h": 16,
      "correct": false,
      "content_html": "<p>Windows let in light, but do not generate power.</p>"
    },
    {
      "id": "r3",
      "label": "Tree",
      "shape": "circle",
      "x": 87,
      "y": 55,
      "r": 8,
      "correct": false,
      "content_html": "<p>Trees provide shade and store carbon.</p>"
    }
  ],
  "points": 10,
  "attempts": 2,
  "feedback": {
    "correct": "<p>Right — the panels on the roof.</p>",
    "incorrect": "<p>Look up at the roof.</p>"
  }
}
```
</details>

### accordion

**Accordion** — Expandable sections that reveal content on demand.

Single- or multi-open sections; optional "open every section" completion.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Intro | html |  |
| `items` | Sections | list | min 1 |
| `items[].title` | Heading | text | **required** |
| `items[].body_html` | Content | html | **required** |
| `items[].image` | Image | image |  |
| `items[].image_alt` | Image alt text | text | conditional |
| `allow_multiple` | Allow several sections open at once | bool | default `false` |
| `require_all` | Learner must open every section | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "The three Rs",
  "intro_html": "<p>Open each section to learn more.</p>",
  "allow_multiple": false,
  "require_all": true,
  "items": [
    {
      "title": "Reduce",
      "body_html": "<p>Buy less and choose products with less packaging.</p>"
    },
    {
      "title": "Reuse",
      "body_html": "<p>Give items a second life before throwing them away.</p>"
    },
    {
      "title": "Recycle",
      "body_html": "<p>Turn waste materials into new products.</p>"
    }
  ]
}
```
</details>

### tabs

**Tabs** — Tabbed panels to compare or organise related content.

ARIA tablist (top, side, pills) with arrow-key navigation; optional "view every tab" completion.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Intro | html |  |
| `tabs` | Tabs | list | min 1, max 10 |
| `tabs[].label` | Tab label | text | **required** |
| `tabs[].body_html` | Content | html | **required** |
| `tabs[].image` | Image | image |  |
| `tabs[].image_alt` | Image alt text | text | conditional |
| `style` | Style | select: `top` / `side` / `pills` | default `"top"` |
| `require_all` | Learner must view every tab | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Energy sources compared",
  "style": "top",
  "require_all": false,
  "tabs": [
    {
      "label": "Solar",
      "body_html": "<p>Clean and abundant, but depends on daylight.</p>"
    },
    {
      "label": "Wind",
      "body_html": "<p>Very low emissions; output varies with wind speed.</p>"
    },
    {
      "label": "Hydro",
      "body_html": "<p>Reliable output, but large dams affect rivers.</p>"
    }
  ]
}
```
</details>

### flashcards

**Flashcards** — Flip cards for recall practice, as a grid or a self-rated study deck.

3D flip cards as a grid or a self-rated study deck ("Got it" / "Review again", shuffle).

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Intro | html |  |
| `cards` | Cards | list | min 1 |
| `cards[].front_html` | Front | html | **required** |
| `cards[].back_html` | Back | html | **required** |
| `cards[].front_image` | Front image | image |  |
| `cards[].back_image` | Back image | image |  |
| `cards[].alt` | Image alt text | text |  |
| `layout` | Layout | select: `grid` / `deck` | default `"grid"` |
| `require_all` | Learner must flip every card | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Key terms",
  "intro_html": "<p>Tap a card to flip it.</p>",
  "layout": "grid",
  "require_all": true,
  "cards": [
    {
      "front_html": "<p>Carbon footprint</p>",
      "back_html": "<p>Total greenhouse gases caused by a person, product or organisation.</p>"
    },
    {
      "front_html": "<p>Renewable</p>",
      "back_html": "<p>A resource that is naturally replenished.</p>"
    },
    {
      "front_html": "<p>Deforestation</p>",
      "back_html": "<p>Large-scale removal of forests.</p>"
    }
  ]
}
```
</details>

### timeline

**Timeline** — Chronological events explored step by step or as a vertical story.

Horizontal stepper with progress bar, or vertical expandable story.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Intro | html |  |
| `events` | Events | list | min 1 |
| `events[].date` | Date / label | text | **required** |
| `events[].title` | Title | text | **required** |
| `events[].body_html` | Details | html |  |
| `events[].image` | Image | image |  |
| `events[].image_alt` | Image alt text | text | conditional |
| `layout` | Layout | select: `horizontal` / `vertical` | default `"horizontal"` |
| `require_all` | Learner must view every event | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "A short history of climate action",
  "layout": "horizontal",
  "require_all": false,
  "events": [
    {
      "date": "1972",
      "title": "Stockholm Conference",
      "body_html": "<p>The first UN conference on the human environment.</p>"
    },
    {
      "date": "1992",
      "title": "Earth Summit",
      "body_html": "<p>The UN Framework Convention on Climate Change is signed in Rio.</p>"
    },
    {
      "date": "1997",
      "title": "Kyoto Protocol",
      "body_html": "<p>Binding emission targets for industrialised countries.</p>"
    },
    {
      "date": "2015",
      "title": "Paris Agreement",
      "body_html": "<p>Nearly every nation agrees to limit warming well below 2 °C.</p>"
    }
  ]
}
```
</details>

### labeled_diagram

**Labeled diagram** — Numbered markers on an image — explore the labels or name each part (quiz). Default points: **15**.

Numbered markers at % positions. Quiz: name each marker from a dropdown. Display: hover/tap callouts with a legend.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Prompt | html |  |
| `image` | Diagram image | image | **required** |
| `image_alt` | Diagram description (alt text) | text |  |
| `mode` | Mode | select: `quiz` / `display` | default `"quiz"` |
| `labels` | Labels | points | min 2 |
| `labels[].text` | Label text | text | **required** |
| `labels[].x` | X (%) | number | default `50` |
| `labels[].y` | Y (%) | number | default `50` |
| `labels[].description` | Description (display mode) | text |  |
| `points` | Points | number | default `15`, conditional |
| `attempts` | Attempts allowed | number | default `1`, conditional — 0 = unlimited (until correct). |
| `scoring` | Scoring | select: `partial` / `all_or_nothing` | default `"partial"`, conditional |
| `feedback` | Feedback | group | conditional |
| `feedback.correct` | When correct | html |  |
| `feedback.incorrect` | When incorrect | html |  |
| `feedback.partial` | When partly correct | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Parts of a plant",
  "prompt_html": "<p>Name each numbered part of the plant.</p>",
  "image": "img/samples/plant.svg",
  "image_alt": "Diagram of a flowering plant",
  "mode": "quiz",
  "labels": [
    {
      "id": "l1",
      "text": "Flower",
      "x": 50,
      "y": 14,
      "description": "Produces seeds."
    },
    {
      "id": "l2",
      "text": "Leaf",
      "x": 70,
      "y": 45,
      "description": "Makes food by photosynthesis."
    },
    {
      "id": "l3",
      "text": "Stem",
      "x": 50,
      "y": 58,
      "description": "Carries water and nutrients."
    },
    {
      "id": "l4",
      "text": "Roots",
      "x": 50,
      "y": 88,
      "description": "Absorb water from the soil."
    }
  ],
  "points": 15,
  "attempts": 2,
  "scoring": "partial",
  "feedback": {
    "correct": "<p>All parts named correctly!</p>",
    "incorrect": "<p>Check the highlighted markers.</p>"
  }
}
```
</details>

### data_chart

**Data chart** — Animated bar, line, pie or donut chart with tooltips, notes and a data table.

Deterministic inline SVG (no library): column, horizontal bar, line, pie, donut. Animated, tooltips, notes per point, accessible data table, mirrored in RTL.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Intro | html |  |
| `chart_type` | Chart type | select: `bar` / `hbar` / `line` / `pie` / `donut` | default `"bar"` |
| `data` | Data points | list | min 1, max 24 |
| `data[].label` | Label | text | **required** |
| `data[].value` | Value | number | **required** |
| `data[].color` | Colour (optional) | color |  |
| `data[].note` | Note shown when selected | text |  |
| `unit` | Unit suffix | text | E.g. "%", " t", " GW". |
| `y_label` | Axis title | text |  |
| `max_value` | Axis maximum (optional) | number |  |
| `show_values` | Show values on chart | bool | default `true` |
| `caption` | Caption / source | text |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Global electricity from renewables",
  "prompt_html": "<p>Select a bar to read more.</p>",
  "chart_type": "bar",
  "unit": "%",
  "y_label": "Share of generation",
  "show_values": true,
  "data": [
    {
      "label": "2000",
      "value": 18,
      "note": "Mostly hydropower."
    },
    {
      "label": "2010",
      "value": 20
    },
    {
      "label": "2015",
      "value": 23
    },
    {
      "label": "2020",
      "value": 28,
      "note": "Rapid growth of wind and solar."
    },
    {
      "label": "2023",
      "value": 30
    }
  ],
  "caption": "Illustrative figures for teaching purposes."
}
```
</details>

### image_compare

**Before / after** — Drag a slider to compare two images.

Before/after slider built on a native range input (drag + keyboard).

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Intro | html |  |
| `before_image` | Before image | image | **required** |
| `after_image` | After image | image | **required** |
| `before_label` | Before label | text |  |
| `after_label` | After label | text |  |
| `alt` | Description of the comparison (alt text) | text |  |
| `start` | Start position (%) | number | default `50` |
| `caption` | Caption | text |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Restoring a forest",
  "prompt_html": "<p>Drag the handle to compare the site before and after replanting.</p>",
  "before_image": "img/samples/forest-before.svg",
  "after_image": "img/samples/forest-after.svg",
  "before_label": "Before",
  "after_label": "After",
  "alt": "A bare hillside with stumps compared with the same hillside covered in young trees",
  "start": 50,
  "caption": "Illustration."
}
```
</details>

## Simulations & decisions

_Branching, simulations and worked examples._

### branching

**Branching** — A choice that sends the learner to different screens of the course.

Each choice jumps to a target screen (or the default target / next screen) after optional feedback. The choice is remembered.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Situation / question | html | **required** |
| `image` | Image | image |  |
| `image_alt` | Image alt text | text | conditional |
| `choices` | Choices | list | min 2, max 6 |
| `choices[].text` | Choice text | text | **required** |
| `choices[].goto` | Go to screen | screen |  |
| `choices[].feedback_html` | Feedback before moving on | html |  |
| `default_goto` | Default target (when a choice has none) | screen | Leave empty to continue to the next screen. |
| `auto_advance` | Jump immediately (skip feedback) | bool | default `false` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Choose your path",
  "prompt_html": "<p>How confident are you with the basics of renewable energy?</p>",
  "choices": [
    {
      "text": "I am new to this — show me the basics",
      "goto": "",
      "feedback_html": "<p>Great, let's start with the fundamentals.</p>"
    },
    {
      "text": "I know the basics — take me to the practice",
      "goto": "",
      "feedback_html": "<p>Let's put your knowledge to work.</p>"
    }
  ]
}
```
</details>

### simulation

**Simulation** — Step-by-step "try it" simulation: click the right spot, type a value or pick an action. Default points: **10**.

Software/procedure walkthrough: click a target area, type a value, or choose an option per step. Hints after mistakes; score = steps right first time.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Scenario intro | html |  |
| `image` | Default screen image | image | **required** |
| `image_alt` | Image description | text |  |
| `steps` | Steps | list | min 1 |
| `steps[].instruction_html` | Instruction | html | **required** |
| `steps[].image` | Screen image for this step (optional) | image |  |
| `steps[].action` | Learner action | select: `click` / `input` / `choice` | default `"click"` |
| `steps[].target` | Target area | rect | conditional |
| `steps[].accepted` | Accepted values | strings | conditional |
| `steps[].input_label` | Input label | text | conditional |
| `steps[].options` | Options | strings | conditional |
| `steps[].correct_option` | Correct option number (1 = first) | number | default `1`, conditional |
| `steps[].hint_html` | Hint (shown after a mistake) | html |  |
| `steps[].feedback_html` | Confirmation after success | html |  |
| `points` | Points | number | default `10` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | All steps right first time | html |  |
| `feedback.incorrect` | Completed with mistakes | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Try it: set the thermostat",
  "prompt_html": "<p>Practise lowering the heating schedule in the energy app.</p>",
  "image": "img/samples/app.svg",
  "image_alt": "Energy app showing a thermostat and menu",
  "steps": [
    {
      "instruction_html": "<p>Open the <strong>Schedule</strong> menu.</p>",
      "action": "click",
      "target": {
        "x": 6,
        "y": 26,
        "w": 26,
        "h": 10
      },
      "hint_html": "<p>The menu is on the left side.</p>"
    },
    {
      "instruction_html": "<p>Type the new night temperature: <strong>17</strong> °C.</p>",
      "action": "input",
      "accepted": [
        "17",
        "17°",
        "17 °C"
      ],
      "input_label": "Night temperature (°C)"
    },
    {
      "instruction_html": "<p>Which days should the schedule apply to?</p>",
      "action": "choice",
      "options": [
        "Weekends only",
        "Every day",
        "Never"
      ],
      "correct_option": 2
    },
    {
      "instruction_html": "<p>Press <strong>Save</strong>.</p>",
      "action": "click",
      "target": {
        "x": 70,
        "y": 80,
        "w": 22,
        "h": 11
      },
      "feedback_html": "<p>Saved! The schedule is active.</p>"
    }
  ],
  "points": 10,
  "feedback": {
    "correct": "<p>Flawless — every step right first time.</p>",
    "incorrect": "<p>Done. Review the steps where you needed a hint.</p>"
  }
}
```
</details>

### decision_scenario

**Decision scenario** — A story where each decision has consequences, feedback and a score impact. Default points: **20**.

Node graph of scenes with decisions, consequences and score deltas. Course score = scenario points / best achievable path; pass when ≥ `pass_score`.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Scenario intro | html |  |
| `nodes` | Scenes | list | min 1 |
| `nodes[].id` | Scene id | text | **required** |
| `nodes[].prompt_html` | What happens | html | **required** |
| `nodes[].image` | Scene image | image |  |
| `nodes[].image_alt` | Image alt text | text | conditional |
| `nodes[].choices` | Decisions (leave empty for an ending) | list |  |
| `nodes[].choices[].text_html` | Decision | text | **required** |
| `nodes[].choices[].feedback_html` | Consequence | html |  |
| `nodes[].choices[].score_delta` | Score change | number | default `0` |
| `nodes[].choices[].goto_node_id` | Next scene | select |  |
| `start_node_id` | First scene | select |  |
| `pass_score` | Pass score (scenario points) | number | Default: more than 0. |
| `points` | Course points | number | default `20` |
| `attempts` | Attempts allowed | number | default `2` — 0 = unlimited. |
| `feedback` | Final feedback | group |  |
| `feedback.correct` | Passed | html |  |
| `feedback.incorrect` | Not passed | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "The leaking tap",
  "intro_html": "<p>You manage a small office. Make decisions to cut water waste.</p>",
  "start_node_id": "start",
  "pass_score": 15,
  "points": 20,
  "attempts": 2,
  "nodes": [
    {
      "id": "start",
      "prompt_html": "<p>A colleague reports a dripping tap in the kitchen. What do you do?</p>",
      "choices": [
        {
          "id": "c1",
          "text_html": "Call maintenance today",
          "feedback_html": "<p>Fixed within hours — that saves up to 20 litres a day.</p>",
          "score_delta": 10,
          "goto_node_id": "next"
        },
        {
          "id": "c2",
          "text_html": "Put a bucket under it for now",
          "feedback_html": "<p>The water is collected, but the leak continues.</p>",
          "score_delta": 2,
          "goto_node_id": "next"
        },
        {
          "id": "c3",
          "text_html": "Ignore it — it is only a drip",
          "feedback_html": "<p>A drip a second wastes over 10,000 litres a year.</p>",
          "score_delta": -5,
          "goto_node_id": "next"
        }
      ]
    },
    {
      "id": "next",
      "prompt_html": "<p>The team asks how to save more water. What is your next step?</p>",
      "choices": [
        {
          "id": "c4",
          "text_html": "Install tap aerators",
          "feedback_html": "<p>Aerators cut flow by up to 50% with no loss of comfort.</p>",
          "score_delta": 10,
          "goto_node_id": "end"
        },
        {
          "id": "c5",
          "text_html": "Send a reminder email",
          "feedback_html": "<p>Awareness helps a little, but habits are hard to change.</p>",
          "score_delta": 3,
          "goto_node_id": "end"
        }
      ]
    },
    {
      "id": "end",
      "prompt_html": "<p>Three months later you review the water bill.</p>",
      "choices": []
    }
  ],
  "feedback": {
    "correct": "<p>Your decisions made a measurable difference.</p>",
    "incorrect": "<p>Try again: act quickly and choose lasting fixes.</p>"
  }
}
```
</details>

### exploration

**Exploration** — Capture a prediction, opinion or estimate and replay it later in the course.

Free text, choice, prediction or slider. Stored under `store_key` and replayed anywhere with `<span data-exploration-ref="key"></span>`.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Question / prompt | html | **required** |
| `store_key` | Storage key | text | **required** — Show the answer later with <span data-exploration-ref="KEY"></span>. |
| `input_kind` | Input type | select: `text` / `choice` / `prediction` / `slider` | default `"text"` |
| `choices` | Choices | strings | conditional |
| `placeholder` | Placeholder | text | conditional |
| `min_length` | Minimum characters | number | default `0`, conditional |
| `min_value` | Slider minimum | number | default `0`, conditional |
| `max_value` | Slider maximum | number | default `100`, conditional |
| `step` | Slider step | number | default `1`, conditional |
| `unit` | Unit | text | conditional |
| `reveal_html` | Revealed after submitting | html | E.g. the actual answer for a prediction. |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Make a prediction",
  "prompt_html": "<p>What percentage of the world's electricity do you think comes from renewables today?</p>",
  "store_key": "renewables_guess",
  "input_kind": "slider",
  "min_value": 0,
  "max_value": 100,
  "step": 1,
  "unit": "%",
  "reveal_html": "<p>The actual figure is about <strong>30%</strong>. Your estimate: <span data-exploration-ref=\"renewables_guess\"></span>%.</p>"
}
```
</details>

### worked_example

**Worked example** — A solved problem shown step by step, with optional fading of rationale.

Fading: full, partial (rationale behind "Why?"), problem-only (reveal step by step). Optional self-explanation (kept in course state only).

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Problem statement | html |  |
| `steps` | Steps | list | min 2 |
| `steps[].action_html` | What is done | html | **required** |
| `steps[].rationale_html` | Why (rationale) | html | **required** |
| `steps[].image` | Supporting image | image |  |
| `steps[].caption` | Image caption | text |  |
| `fading` | Fading | select: `full` / `partial` / `problem_only` | default `"full"` |
| `self_explanation_prompt_html` | Self-explanation prompt | html | Optional free-text reflection (kept in the course state, not sent to the LMS). |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Worked example: household carbon",
  "intro_html": "<p>A household uses <strong>3,000 kWh</strong> of electricity a year. The grid emits <strong>0.4 kg CO₂ per kWh</strong>. What are its yearly emissions?</p>",
  "fading": "partial",
  "steps": [
    {
      "action_html": "<p>Identify the formula: <em>emissions = energy × emission factor</em>.</p>",
      "rationale_html": "<p>Each unit of energy carries a fixed amount of CO₂.</p>"
    },
    {
      "action_html": "<p>Multiply: 3,000 × 0.4 = <strong>1,200 kg</strong>.</p>",
      "rationale_html": "<p>The units kWh cancel out, leaving kg of CO₂.</p>"
    },
    {
      "action_html": "<p>Convert: 1,200 kg = <strong>1.2 tonnes CO₂</strong> per year.</p>",
      "rationale_html": "<p>Tonnes make large quantities easier to compare.</p>"
    }
  ],
  "self_explanation_prompt_html": "<p>In your own words: why do the kWh units cancel out?</p>"
}
```
</details>

## Gamification

_Games, races, escape rooms and adaptive practice._

### game

**Educational game** — Configurable game: quiz show with lives & streaks, memory match, or word scramble. Default points: **25**.

Templates: quiz show (timer, lives, streak bonus), memory match (moves), word scramble (lives, hints). Best play is kept; pass at `pass_ratio`.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Intro | html |  |
| `template` | Game template | select: `quiz_show` / `memory` / `word_scramble` | default `"quiz_show"` |
| `questions` | Questions | list | min 1, conditional |
| `questions[].prompt` | Question | text | **required** |
| `questions[].options` | Options | strings | **required** |
| `questions[].correct` | Correct option number (1 = first) | number | default `1` |
| `questions[].explanation` | Explanation | text |  |
| `pairs` | Card pairs | list | min 2, max 12, conditional |
| `pairs[].a` | Card A | text | **required** |
| `pairs[].b` | Matching card B | text | **required** |
| `words` | Words | list | min 1, conditional |
| `words[].word` | Word | text | **required** |
| `words[].clue` | Clue | text | **required** |
| `lives` | Lives (0 = unlimited) | number | default `3`, conditional |
| `seconds_per_question` | Seconds per question (0 = no timer) | number | default `20`, conditional |
| `time_limit_sec` | Overall time limit in seconds (0 = none) | number | default `0`, conditional |
| `hints` | Hints available | number | default `2`, conditional |
| `pass_ratio` | Pass ratio (0–1) | number | default `0.6` |
| `points` | Course points | number | default `25` |
| `attempts` | Plays counted (0 = unlimited) | number | default `3` |
| `feedback` | Feedback | group |  |
| `feedback.correct` | Win | html |  |
| `feedback.incorrect` | Lose | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Eco quiz show",
  "intro_html": "<p>Answer fast to build a streak. You have three lives!</p>",
  "template": "quiz_show",
  "lives": 3,
  "seconds_per_question": 20,
  "pass_ratio": 0.6,
  "points": 25,
  "attempts": 3,
  "questions": [
    {
      "prompt": "Which gas is the main driver of climate change?",
      "options": [
        "Oxygen",
        "Carbon dioxide",
        "Helium"
      ],
      "correct": 2,
      "explanation": "CO₂ from burning fossil fuels."
    },
    {
      "prompt": "Which of these is biodegradable?",
      "options": [
        "Plastic bag",
        "Apple core",
        "Glass jar"
      ],
      "correct": 2
    },
    {
      "prompt": "What does LED lighting save compared to old bulbs?",
      "options": [
        "About 10%",
        "About 80%",
        "Nothing"
      ],
      "correct": 2,
      "explanation": "LEDs use up to 80% less energy."
    },
    {
      "prompt": "Which transport mode has the lowest emissions per km?",
      "options": [
        "Bicycle",
        "Car",
        "Plane"
      ],
      "correct": 1
    }
  ],
  "pairs": [
    {
      "a": "Solar",
      "b": "Sun"
    },
    {
      "a": "Wind",
      "b": "Turbine"
    },
    {
      "a": "Hydro",
      "b": "River"
    },
    {
      "a": "Geothermal",
      "b": "Earth heat"
    }
  ],
  "words": [
    {
      "word": "compost",
      "clue": "Decomposed organic matter used as fertiliser"
    },
    {
      "word": "glacier",
      "clue": "Slow-moving river of ice"
    }
  ],
  "feedback": {
    "correct": "<p>You won! Great knowledge.</p>",
    "incorrect": "<p>Game over — play again to improve your score.</p>"
  }
}
```
</details>

### term_match_race

**Term match race** — Timed race to match terms with their definitions. Default points: **15**.

Timed matching; wrong matches cost seconds. Score = 80% × matched ratio + 20% time bonus when all matched.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Instructions | html |  |
| `pairs` | Terms | list | min 2, max 16 |
| `pairs[].term_html` | Term | text | **required** |
| `pairs[].definition_html` | Definition | text | **required** |
| `time_limit_sec` | Time limit (seconds) | number | default `60` |
| `penalty_sec` | Time penalty for a wrong match (seconds) | number | default `3` |
| `points` | Points | number | default `15` |
| `attempts` | Races counted (0 = unlimited) | number | default `3` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Vocabulary race",
  "prompt_html": "<p>Match every term to its definition before time runs out. Wrong matches cost 3 seconds.</p>",
  "time_limit_sec": 60,
  "penalty_sec": 3,
  "points": 15,
  "attempts": 3,
  "pairs": [
    {
      "term_html": "Emission",
      "definition_html": "Gas released into the air"
    },
    {
      "term_html": "Habitat",
      "definition_html": "Where an organism lives"
    },
    {
      "term_html": "Renewable",
      "definition_html": "Naturally replenished"
    },
    {
      "term_html": "Pollutant",
      "definition_html": "Substance that contaminates"
    },
    {
      "term_html": "Conservation",
      "definition_html": "Protection of nature"
    }
  ]
}
```
</details>

### escape_room

**Escape room** — Solve a sequence of locked puzzles before you run out of lives. Default points: **20**.

Puzzles unlock in sequence; a wrong answer costs a life and shows the hint. Score = solved / total.

| Field | Label | Type | Notes |
|---|---|---|---|
| `intro_html` | Story intro | html |  |
| `puzzles` | Locks / puzzles | list | min 1 |
| `puzzles[].prompt_html` | Puzzle | html | **required** |
| `puzzles[].image` | Clue image | image |  |
| `puzzles[].image_alt` | Image alt text | text | conditional |
| `puzzles[].accepted` | Accepted answers | strings | **required** |
| `puzzles[].hint_html` | Hint (after a wrong answer) | html |  |
| `puzzles[].case_sensitive` | Case sensitive | bool | default `false` |
| `lives` | Lives | number | default `3` |
| `points` | Points | number | default `20` |
| `attempts` | Attempts (0 = unlimited) | number | default `2` |
| `success_html` | Escape message | html |  |
| `fail_html` | Failure message | html |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Escape the greenhouse",
  "intro_html": "<p>The greenhouse door is locked by three puzzles. Solve them to get out!</p>",
  "lives": 3,
  "points": 20,
  "attempts": 2,
  "puzzles": [
    {
      "id": "p1",
      "prompt_html": "<p>Lock 1: What gas do plants absorb? <em>(chemical formula)</em></p>",
      "accepted": [
        "CO2",
        "CO₂"
      ],
      "hint_html": "<p>Carbon + two oxygens.</p>"
    },
    {
      "id": "p2",
      "prompt_html": "<p>Lock 2: How many legs does an insect have?</p>",
      "accepted": [
        "6",
        "six"
      ],
      "hint_html": "<p>More than four, fewer than eight.</p>"
    },
    {
      "id": "p3",
      "prompt_html": "<p>Lock 3: Unscramble: <strong>L O S A R</strong></p>",
      "accepted": [
        "solar"
      ],
      "hint_html": "<p>Related to the sun.</p>"
    }
  ],
  "success_html": "<p>The door swings open — you escaped!</p>",
  "fail_html": "<p>The door stays shut. Review the hints and try again.</p>"
}
```
</details>

### adaptive_practice

**Adaptive practice** — Practice that adapts question difficulty to the learner (Elo or BKT). Default points: **20**.

Elo: picks the item whose predicted success is closest to `target_success` and updates ability. BKT: per-skill mastery (p-init 0.3, transit 0.15, slip 0.1, guess 0.2), optional mastery stop.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Intro | html |  |
| `items` | Question bank | list | min 3 |
| `items[].prompt_html` | Question | html | **required** |
| `items[].options` | Options | strings | **required** |
| `items[].correct` | Correct option number (1 = first) | number | default `1` |
| `items[].difficulty` | Difficulty (1 easy – 5 hard) | number | default `3` |
| `items[].skill` | Skill tag | text |  |
| `items[].explain_html` | Explanation | html |  |
| `adaptive` | Adaptivity | group |  |
| `adaptive.strategy` | Strategy | select: `elo` / `bkt` | default `"elo"` |
| `target_success` | Target success rate (0–1) | number | default `0.7` |
| `max_items` | Max questions (0 = all) | number | default `0` |
| `mastery_stop` | Stop early when all skills are mastered (BKT) | bool | default `false` |
| `pass_ratio` | Pass ratio (0–1) | number | default `0.6` |
| `points` | Points | number | default `20` |
| `attempts` | Attempts (0 = unlimited) | number | default `2` |
| `seed` | Random seed (optional) | text |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Adaptive practice: energy",
  "prompt_html": "<p>Questions adapt to your answers — expect harder ones as you improve.</p>",
  "adaptive": {
    "strategy": "elo"
  },
  "target_success": 0.7,
  "max_items": 6,
  "pass_ratio": 0.6,
  "points": 20,
  "attempts": 2,
  "items": [
    {
      "prompt_html": "<p>Which is renewable?</p>",
      "options": [
        "Wind",
        "Coal"
      ],
      "correct": 1,
      "difficulty": 1,
      "skill": "sources"
    },
    {
      "prompt_html": "<p>Solar panels convert sunlight into…</p>",
      "options": [
        "Heat only",
        "Electricity",
        "Wind"
      ],
      "correct": 2,
      "difficulty": 2,
      "skill": "sources"
    },
    {
      "prompt_html": "<p>What unit measures electrical energy use at home?</p>",
      "options": [
        "kWh",
        "Volt",
        "Newton"
      ],
      "correct": 1,
      "difficulty": 2,
      "skill": "units"
    },
    {
      "prompt_html": "<p>1,000 W used for 3 hours equals…</p>",
      "options": [
        "3 kWh",
        "0.3 kWh",
        "30 kWh"
      ],
      "correct": 1,
      "difficulty": 3,
      "skill": "units",
      "explain_html": "<p>1 kW × 3 h = 3 kWh.</p>"
    },
    {
      "prompt_html": "<p>Which has the highest capacity factor?</p>",
      "options": [
        "Solar PV",
        "Geothermal",
        "Onshore wind"
      ],
      "correct": 2,
      "difficulty": 4,
      "skill": "sources"
    },
    {
      "prompt_html": "<p>A 60 W bulb replaced by a 9 W LED, used 1,000 h a year, saves…</p>",
      "options": [
        "51 kWh",
        "5.1 kWh",
        "510 kWh"
      ],
      "correct": 1,
      "difficulty": 5,
      "skill": "units",
      "explain_html": "<p>(60 − 9) W × 1,000 h = 51,000 Wh = 51 kWh.</p>"
    },
    {
      "prompt_html": "<p>Which stores energy for later use?</p>",
      "options": [
        "Battery",
        "Inverter",
        "Meter"
      ],
      "correct": 1,
      "difficulty": 3,
      "skill": "sources"
    }
  ]
}
```
</details>

## Advanced & specialized

_Animation, analytics, polls and custom code._

### lottie

**Lottie animation** — Vector animation (Lottie/Bodymovin JSON) with playback controls.

lottie-web (light SVG renderer, bundled in `lib/js`) loaded on demand; play/pause and scrubber; respects reduced-motion.

| Field | Label | Type | Notes |
|---|---|---|---|
| `lottie_src` | Lottie JSON (URL or upload) | lottie | **required** |
| `alt` | Description of the animation (for screen readers) | text |  |
| `body_html` | Text | html |  |
| `layout` | Layout | select: `center` / `side` | default `"center"` |
| `loop` | Loop | bool | default `true` |
| `autoplay` | Autoplay | bool | default `true` |
| `controls` | Show play/pause and scrubber | bool | default `true` |
| `speed` | Speed | number | default `1` |
| `caption` | Caption | text |  |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "How energy flows",
  "lottie_src": "media/sample-lottie.json",
  "alt": "A pulsing sun sends energy rings outward",
  "layout": "side",
  "body_html": "<p>Sunlight reaches Earth as waves of energy. Solar panels capture part of it and convert it into electricity.</p>",
  "loop": true,
  "autoplay": true,
  "controls": true,
  "speed": 1
}
```
</details>

### results_breakdown

**Results breakdown** — Per-topic performance analytics with targeted review advice.

Groups scored screens into topics, shows per-topic %, flags topics below `weak_threshold` with advice and links.

| Field | Label | Type | Notes |
|---|---|---|---|
| `body_html` | Intro | html |  |
| `sections` | Topics | list | min 1 |
| `sections[].title` | Topic name | text | **required** |
| `sections[].screen_ids` | Scored screens in this topic | screens |  |
| `sections[].advice_html` | Advice when weak | html |  |
| `weak_threshold` | Weak below (%) | number | default `60` |
| `show_total` | Show overall result | bool | default `true` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Your results by topic",
  "body_html": "<p>See where you are strong and what to review.</p>",
  "weak_threshold": 60,
  "show_total": true,
  "sections": [
    {
      "title": "Knowledge check",
      "screen_ids": [],
      "advice_html": "<p>Revisit the content screens before trying again.</p>"
    }
  ]
}
```
</details>

### poll

**Poll & reflection** — Unscored opinion poll or reflection, with optional benchmark results.

Unscored. Optional benchmark bars (author-supplied reference data — not live aggregation) and reflection. Reported as a neutral interaction.

| Field | Label | Type | Notes |
|---|---|---|---|
| `prompt_html` | Question | html | **required** |
| `options` | Options | strings | Leave empty for a free-text reflection only. |
| `multi` | Allow multiple choices | bool | default `false` |
| `allow_text` | Add a free-text answer | bool | default `false` |
| `text_label` | Free-text label | text | conditional |
| `show_benchmark` | Show benchmark results after answering | bool | default `false` |
| `benchmark` | Benchmark % per option (one per line, same order) | strings | conditional — Author-provided reference data (e.g. from a survey). It is not live data. |
| `reflection_html` | Reflection shown after submitting | html |  |
| `report` | Report the answer to the LMS (as a neutral interaction) | bool | default `true` |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Quick poll",
  "prompt_html": "<p>Which change would be easiest for you this month?</p>",
  "options": [
    "Cycle or walk more",
    "Eat less meat",
    "Cut home energy use",
    "Buy second-hand"
  ],
  "multi": false,
  "allow_text": true,
  "text_label": "Anything else?",
  "show_benchmark": true,
  "benchmark": [
    "35",
    "20",
    "30",
    "15"
  ],
  "reflection_html": "<p>Small, consistent changes add up. Pick one and try it for a week.</p>",
  "report": true
}
```
</details>

### embed_html

**Custom HTML** — Your own HTML/CSS/JS in a secure sandbox, with an API to report completion and score.

Runs in a sandboxed iframe (`allow-scripts`, no same-origin). Bridge: `ELS.complete()`, `ELS.setScore(0–100)`, `ELS.passed()`, `ELS.failed()`. Messages are accepted only from that frame with a per-render token.

| Field | Label | Type | Notes |
|---|---|---|---|
| `html` | HTML / CSS / JavaScript | code | **required** — Runs in a sandboxed iframe. Call ELS.complete(), ELS.setScore(0–100), ELS.passed() or ELS.failed() to report back. |
| `completion` | Completion | select: `on_view` / `on_message` / `time_threshold` | default `"on_view"` |
| `min_seconds` | Minimum seconds | number | default `30`, conditional |
| `aspect` | Size | select: `fill` / `16:9` / `4:3` | default `"fill"` |
| `height` | Height (px) | number | default `420`, conditional |
| `scored` | Scored via ELS.setScore() | bool | default `false` |
| `points` | Points | number | default `10`, conditional |
| `pass_percent` | Pass at score (%) | number | default `70`, conditional |

<details><summary>Starter template (JSON)</summary>

```json
{
  "title": "Custom interactive: carbon calculator",
  "completion": "on_message",
  "aspect": "fill",
  "height": 380,
  "scored": false,
  "html": "<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f4f9fc;color:#1f2d3a}label{display:block;margin:12px 0 4px;font-weight:600}input{width:100%;font-size:18px}output{display:block;font-size:32px;font-weight:700;color:#3b759e;margin-top:16px}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#3b759e;color:#fff;font-size:16px;cursor:pointer}</style>\n<h2>Commute calculator</h2>\n<label for=\"km\">Kilometres driven per day</label>\n<input id=\"km\" type=\"range\" min=\"0\" max=\"100\" value=\"20\">\n<output id=\"out\"></output>\n<button id=\"done\">I'm done</button>\n<script>\nvar km=document.getElementById(\"km\"),out=document.getElementById(\"out\");\nfunction u(){out.textContent=Math.round(km.value*0.17*220)+\" kg CO\\u2082 / year\";}\nkm.oninput=u;u();\ndocument.getElementById(\"done\").onclick=function(){ELS.complete();this.textContent=\"Saved \\u2713\";};\n</script>"
}
```
</details>
