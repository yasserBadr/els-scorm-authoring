<div dir="rtl">

# ELS — منصة تأليف دروس تعليمية تفاعلية مع تصدير SCORM

أداة لإنشاء دروس إلكترونية تفاعلية حديثة متوافقة مع معيار SCORM، مبنية على reveal.js. تضم **31 نوعًا من الشاشات التفاعلية**، وأداة تأليف مرئية بمعاينة مباشرة، وتصديرًا لحزم **SCORM 1.2** و**SCORM 2004**. تدعم المنصة الواجهات العربية من اليمين إلى اليسار (RTL) بالكامل.

[English version below ↓](#english)

## المزايا

- **31 نوعًا من الشاشات**، كلها قابلة للتعديل والمعاينة والتصدير.
- **أداة تأليف مرئية (ELS Studio)**:
  - مكتبة شاشات مصنفة بمعاينة حية.
  - إضافة الشاشات ونسخها وحذفها وإعادة ترتيبها بالسحب.
  - رسم مناطق النقر والعلامات مباشرة على الصور.
  - تراجع وإعادة (Ctrl+Z / Ctrl+Y) وحفظ تلقائي.
  - حفظ أي شاشة كقالب لإعادة استخدامها.
- **معاينة مباشرة** بثلاثة أحجام: سطح المكتب واللوحي والجوال.
- **تتبع SCORM كامل**:
  - التقدم والإكمال والدرجة والنجاح أو الرسوب.
  - تسجيل إجابة كل سؤال (Interactions).
  - استئناف الدرس من حيث توقف المتعلم.
- **تصميم حديث متجاوب** يشبه التطبيقات لا شرائح العرض، مع حركات سلسة ودعم للوحة المفاتيح وقارئات الشاشة.
- **دعم العربية**: اتجاه من اليمين لليسار، ونصوص الواجهة مترجمة.
- **بدون أي اعتماديات**: يكفي Node.js 18 أو أحدث، ولا حاجة لتشغيل `npm install`.

## أنواع الشاشات

| الفئة | الأنواع |
|---|---|
| المحتوى الأساسي | شاشة العنوان، المحتوى، الفيديو، الملخص |
| التقييم | اختيار من متعدد، صح وخطأ، ملء الفراغات، السحب والإفلات، التوصيل، الترتيب |
| المحتوى التفاعلي | مناطق النقر على الصور، الأكورديون، التبويبات، البطاقات، الخط الزمني، الرسم التوضيحي المعنون، الرسوم البيانية، مقارنة قبل وبعد |
| المحاكاة والقرارات | التفرع، المحاكاة، سيناريو القرارات، الاستكشاف، المثال المحلول |
| الألعاب | لعبة تعليمية (مسابقة / ذاكرة / ترتيب حروف)، سباق المصطلحات، غرفة الهروب، التدريب التكيفي |
| متقدم | رسوم Lottie المتحركة، تحليل النتائج، الاستطلاع، كود HTML مخصص |

## التشغيل

1. نزّل المشروع وافتح الطرفية داخل مجلده.
2. شغّل الخادم المحلي:

</div>

```bash
node tools/serve.js
```

<div dir="rtl">

3. افتح الصفحات التالية في المتصفح:

| الصفحة | الرابط |
|---|---|
| أداة التأليف | http://localhost:8080/author.html |
| الدورة التجريبية (إنجليزي) | http://localhost:8080/course.html |
| الدورة التجريبية (عربي) | http://localhost:8080/course.html?course=sample-ar |
| اختبار التتبع (محاكي نظام إدارة التعلم) | http://localhost:8080/lms-test.html |

## إنشاء دورة وتصديرها

1. افتح أداة التأليف. من قائمة **File** اختر **New empty course** لبدء دورة جديدة، أو عدّل الدورة التجريبية.
2. اضغط **Add screen** واختر نوع الشاشة من المكتبة.
3. عدّل المحتوى من اللوحة اليمنى، وتابع النتيجة في المعاينة.
4. من **Settings** اختر اللغة واتجاه النص وألوان التصميم ودرجة النجاح وإصدار SCORM.
5. اضغط **Export SCORM** لتنزيل ملف zip، ثم ارفعه إلى نظام إدارة التعلم (Moodle وغيره).

يمكنك أيضًا التصدير من سطر الأوامر:

</div>

```bash
node tools/build-scorm.js courses/sample-ar.js --version 2004
```

<div dir="rtl">

## الاختبارات

- اختبارات الوحدات: `npm test`
- اختبار شامل لكل الشاشات داخل محاكي نظام إدارة التعلم: افتح الرابط `http://localhost:8080/tests/e2e.html?course=sample-ar&version=2004`

## التوثيق

- [docs/SCREEN_TYPES.md](docs/SCREEN_TYPES.md): كل نوع شاشة وحقوله وطريقة تتبعه.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): البنية الداخلية وطريقة إضافة نوع شاشة جديد.
- [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md): تقرير التنفيذ والاختبارات والقيود.

</div>

---

<a id="english"></a>

# ELS — Interactive e-learning authoring with SCORM export

ELS is a tool for building modern, interactive SCORM courses on top of reveal.js:
- **31 interactive screen types**;
- a visual **authoring studio** with live preview;
- **SCORM 1.2 / 2004** export;
- full **Arabic / RTL** support.

## Features

- **31 screen types**: every one is editable, previewable and exportable.
- **ELS Studio**:
  - categorized screen library with live previews;
  - add, duplicate, delete and drag-reorder screens;
  - schema-driven forms;
  - visual hotspot, marker and target editors;
  - theme and language settings;
  - templates, undo/redo and autosave;
  - JSON import/export.
- **Live preview** in desktop, tablet and mobile frames.
- **SCORM tracking**: progress, completion, score, pass/fail, question-level interactions, suspend/resume, session time.
- **Modern learner experience**: responsive, animated, keyboard accessible, LTR and RTL.
- **Zero dependencies**: Node 18+ only, with no `npm install`. The only bundled library is lottie-web, used for the Lottie screen.

| Category | Types |
|---|---|
| Basic content | `title_slide`, `content_slide`, `video`, `summary` |
| Assessment | `mcq`, `true_false`, `fill_blank`, `drag_drop`, `matching`, `sorting` |
| Interactive content | `hotspot`, `accordion`, `tabs`, `flashcards`, `timeline`, `labeled_diagram`, `data_chart`, `image_compare` |
| Simulations & decisions | `branching`, `simulation`, `decision_scenario`, `exploration`, `worked_example` |
| Gamification | `game`, `term_match_race`, `escape_room`, `adaptive_practice` |
| Advanced | `lottie`, `results_breakdown`, `poll`, `embed_html` |

## Quick start

```bash
node tools/serve.js
```

| Page | URL |
|---|---|
| Authoring studio | http://localhost:8080/author.html |
| Sample course (English) | http://localhost:8080/course.html |
| Sample course (Arabic, RTL) | http://localhost:8080/course.html?course=sample-ar |
| LMS test harness | http://localhost:8080/lms-test.html |
| Interactive screens inside a hand-written deck | http://localhost:8080/interactive-slides.html |

## Commands

```bash
node tools/build-scorm.js courses/sample-en.js --version 2004
npm test
node tools/make-samples.js
node tools/make-docs.js
```

| Command | Purpose |
|---|---|
| `node tools/build-scorm.js courses/sample-en.js --version 2004` | Build a SCORM zip into `dist/` |
| `npm test` | Unit tests (`node --test`) |
| `node tools/make-samples.js` | Regenerate the sample courses |
| `node tools/make-docs.js` | Regenerate `docs/SCREEN_TYPES.md` |

For browser end-to-end tests, open `http://localhost:8080/tests/e2e.html?course=sample-en&version=1.2`.

## Project structure

```
author.html, js/author/     Authoring studio, form engine, SCORM packager, zip writer
course.html, js/els/        Learner player, screen registry, 31 types, SCORM runtime
css/elearning.css           Design system (LTR + RTL, responsive)
courses/                    Course data (sample-en, sample-ar)
lms-test.html               Strict mock LMS (SCORM 1.2 / 2004)
tools/, tests/, docs/       CLI tools, tests, documentation
index.html, questions.html  Original reveal.js presentation template (unchanged)
```

## Using screens in a hand-written reveal.js deck

Add a section with a type and its JSON configuration:

```html
<section data-els-type="mcq"><script type="application/json">{ … }</script></section>
```

Then:
1. Load `css/elearning.css` and the `js/els/*` scripts.
2. Call `ELS.enhanceDeck()`.

See `interactive-slides.html` for a working example.

## Original presentation template

The original reveal.js presentation workflow still works as before:
- `index.html` and `questions.html` are the example presentations.
- `js/scormfunctions.js` is the minimal SCORM 1.2 wrapper.
- `imsmanifest.xml` lists the SCOs. Zip the folder and upload it to your LMS.

## Documentation

- [docs/SCREEN_TYPES.md](docs/SCREEN_TYPES.md): every screen type, its fields and how it is tracked.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): registry, render context, SCORM mapping, and how to add a new type.
- [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md): what was built, tests and limitations.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Screen-type specifications follow [edumints-scorm-mcp](https://github.com/kemalyy/edumints-scorm-mcp) (MIT); no code was copied from it.
