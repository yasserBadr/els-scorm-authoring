#!/usr/bin/env node
/**
 * Generates the sample courses (one screen of each of the 31 types) from the
 * registry templates, in English and Arabic (RTL), validates them, and writes
 *   courses/sample-en.js   courses/sample-ar.js
 *
 *   node tools/make-samples.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var load = require('./load-runtime');
var ELS = load();

function merge(base, over) {
    if (over === undefined) return base;
    if (Array.isArray(over)) {
        var out = Array.isArray(base) ? base.slice() : [];
        over.forEach(function (v, i) { out[i] = merge(out[i], v); });
        return out;
    }
    if (over && typeof over === 'object') {
        var o = base && typeof base === 'object' && !Array.isArray(base) ? Object.assign({}, base) : {};
        Object.keys(over).forEach(function (k) { o[k] = merge(o[k], over[k]); });
        return o;
    }
    return over;
}

/* ------------------------------------------------------------------ *
 * Course outline (English). Each entry: [type, id, section, overrides]
 * ------------------------------------------------------------------ */
var OUTLINE = [
    ['title_slide', 'intro', 'Welcome', { title: 'Energy for a Living Planet', kicker: 'Sample course · 31 interactive screen types', subtitle: 'An interactive introduction to renewable energy', meta: '20 min · 31 screens', body_html: '<p>Explore, practise and play your way through the essentials. Use the arrows, keyboard or swipe to move between screens.</p>' }],
    ['content_slide', 'why-energy', 'Learn', { title: 'Why energy choices matter', kicker: 'Module 1', lead: 'Electricity powers almost everything we do — how we make it shapes the planet.',
        blocks: [
            { kind: 'stat', value: '30%', html: '<p>of global electricity now comes from renewable sources (illustrative).</p>' },
            { kind: 'text', html: '<p><strong>Fossil fuels</strong> release carbon dioxide when burned. <strong>Renewables</strong> such as sun, wind and water are naturally replenished and emit little or no CO₂ while running.</p>' },
            { kind: 'callout', html: '<p><strong>Tip:</strong> the cleanest energy is the energy you don\'t use. Efficiency comes first.</p>' },
            { kind: 'image', src: 'img/samples/forest-after.svg', alt: 'Green hillside with young trees', html: 'Healthy ecosystems store carbon.' },
            { kind: 'quote', html: '<p>“We do not inherit the earth from our ancestors; we borrow it from our children.”</p>', wide: true }
        ] }],
    ['video', 'video', 'Learn', { title: 'Watch: energy in motion', transcript_html: '<p>Energy flows through everything around us. Choosing renewable sources keeps that flow clean. Let\'s explore how it works.</p>' }],
    ['lottie', 'lottie', 'Learn', {}],
    ['accordion', 'accordion', 'Learn', {}],
    ['tabs', 'tabs', 'Learn', {}],
    ['flashcards', 'flashcards', 'Learn', {}],
    ['timeline', 'timeline', 'Learn', {}],
    ['data_chart', 'data-chart', 'Learn', {}],
    ['image_compare', 'image-compare', 'Learn', {}],
    ['hotspot', 'hotspot', 'Explore', {}],
    ['labeled_diagram', 'labeled-diagram', 'Explore', {}],
    ['exploration', 'exploration', 'Explore', {}],
    ['branching', 'branching', 'Explore', { choices: [{ goto: 'worked-example' }, { goto: 'mcq' }] }],
    ['worked_example', 'worked-example', 'Explore', {}],
    ['mcq', 'mcq', 'Practice', {}],
    ['true_false', 'true-false', 'Practice', {}],
    ['fill_blank', 'fill-blank', 'Practice', {}],
    ['drag_drop', 'drag-drop', 'Practice', {}],
    ['matching', 'matching', 'Practice', {}],
    ['sorting', 'sorting', 'Practice', {}],
    ['simulation', 'simulation', 'Scenarios', {}],
    ['decision_scenario', 'decision-scenario', 'Scenarios', {}],
    ['game', 'game', 'Play', {}],
    ['term_match_race', 'term-match-race', 'Play', {}],
    ['escape_room', 'escape-room', 'Play', {}],
    ['adaptive_practice', 'adaptive-practice', 'Play', {}],
    ['poll', 'poll', 'Wrap-up', {}],
    ['embed_html', 'embed-html', 'Wrap-up', {}],
    ['results_breakdown', 'results-breakdown', 'Wrap-up', { sections: [
        { title: 'Core knowledge', screen_ids: ['mcq', 'true-false', 'fill-blank', 'matching'], advice_html: '<p>Revisit the accordion, tabs and flashcards in Module 1.</p>' },
        { title: 'Applying skills', screen_ids: ['drag-drop', 'sorting', 'hotspot', 'labeled-diagram', 'simulation'], advice_html: '<p>Try the simulation again and review the labelled diagram.</p>' },
        { title: 'Decisions & games', screen_ids: ['decision-scenario', 'game', 'term-match-race', 'escape-room', 'adaptive-practice'], advice_html: '<p>Replay the scenario and focus on lasting fixes.</p>' }
    ] }],
    ['summary', 'summary', 'Wrap-up', { title: 'Well done!', body_html: '<p>You explored renewable energy through 31 kinds of interaction. Earlier you estimated that <span data-exploration-ref="renewables_guess"></span>% of electricity is renewable — the answer was about 30%.</p>',
        passed_html: '<p>You passed. Share one thing you learned with a colleague today.</p>', failed_html: '<p>You are nearly there. Review the topics flagged in the results and try again.</p>', allow_restart: true }]
];

/* ------------------------------------------------------------------ *
 * Arabic overrides (merged onto the English screen)
 * ------------------------------------------------------------------ */
var AR = {
    'intro': { title: 'طاقة من أجل كوكب حي', kicker: 'دورة نموذجية · 31 نوعًا من الشاشات التفاعلية', subtitle: 'مقدمة تفاعلية إلى الطاقة المتجددة', meta: '20 دقيقة · 31 شاشة', body_html: '<p>استكشف وتدرّب والعب لتتعلم الأساسيات. استخدم الأسهم أو لوحة المفاتيح أو السحب للتنقل بين الشاشات.</p>' },
    'why-energy': { title: 'لماذا تهم خياراتنا في الطاقة', kicker: 'الوحدة 1', lead: 'الكهرباء تشغّل كل ما نفعله تقريبًا — وطريقة إنتاجها تشكّل مستقبل الكوكب.',
        blocks: [
            { value: '30%', html: '<p>من كهرباء العالم تأتي اليوم من مصادر متجددة (أرقام توضيحية).</p>' },
            { html: '<p>يطلق <strong>الوقود الأحفوري</strong> ثاني أكسيد الكربون عند حرقه. أما <strong>المصادر المتجددة</strong> مثل الشمس والرياح والمياه فتتجدد طبيعيًا ولا تطلق تقريبًا أي انبعاثات أثناء التشغيل.</p>' },
            { html: '<p><strong>نصيحة:</strong> أنظف طاقة هي الطاقة التي لا نستهلكها. الكفاءة أولًا.</p>' },
            { alt: 'تلة خضراء مغطاة بأشجار صغيرة', html: 'النظم البيئية السليمة تخزن الكربون.' },
            { html: '<p>«نحن لا نرث الأرض من أجدادنا، بل نستعيرها من أبنائنا.»</p>' }
        ] },
    'video': { title: 'شاهد: الطاقة في حركة', caption: 'فيديو تعريفي قصير.', captions_url: 'media/sample-ar.vtt', captions_lang: 'ar', transcript_html: '<p>تتدفق الطاقة في كل ما حولنا. اختيار المصادر المتجددة يحافظ على نظافة هذا التدفق. لنستكشف كيف يعمل ذلك.</p>' },
    'lottie': { title: 'كيف تتدفق الطاقة', alt: 'شمس نابضة ترسل حلقات من الطاقة', body_html: '<p>يصل ضوء الشمس إلى الأرض على شكل موجات من الطاقة. تلتقط الألواح الشمسية جزءًا منه وتحوّله إلى كهرباء.</p>' },
    'accordion': { title: 'القواعد الثلاث', intro_html: '<p>افتح كل قسم لمعرفة المزيد.</p>', items: [
        { title: 'التقليل', body_html: '<p>اشترِ أقل واختر منتجات بتغليف أقل.</p>' }, { title: 'إعادة الاستخدام', body_html: '<p>امنح الأشياء حياة ثانية قبل التخلص منها.</p>' }, { title: 'إعادة التدوير', body_html: '<p>حوّل مواد النفايات إلى منتجات جديدة.</p>' }] },
    'tabs': { title: 'مقارنة مصادر الطاقة', tabs: [
        { label: 'الشمسية', body_html: '<p>نظيفة ووفيرة، لكنها تعتمد على ضوء النهار.</p>' }, { label: 'الرياح', body_html: '<p>انبعاثات منخفضة جدًا، ويتغير الإنتاج مع سرعة الرياح.</p>' }, { label: 'المائية', body_html: '<p>إنتاج ثابت، لكن السدود الكبيرة تؤثر في الأنهار.</p>' }] },
    'flashcards': { title: 'مصطلحات أساسية', intro_html: '<p>اضغط على البطاقة لقلبها.</p>', cards: [
        { front_html: '<p>البصمة الكربونية</p>', back_html: '<p>إجمالي غازات الدفيئة الناتجة عن شخص أو منتج أو مؤسسة.</p>' }, { front_html: '<p>متجددة</p>', back_html: '<p>مورد يتجدد بشكل طبيعي.</p>' }, { front_html: '<p>إزالة الغابات</p>', back_html: '<p>قطع الغابات على نطاق واسع.</p>' }] },
    'timeline': { title: 'تاريخ موجز للعمل المناخي', events: [
        { date: '1972', title: 'مؤتمر ستوكهولم', body_html: '<p>أول مؤتمر للأمم المتحدة حول البيئة البشرية.</p>' }, { date: '1992', title: 'قمة الأرض', body_html: '<p>توقيع اتفاقية الأمم المتحدة الإطارية بشأن تغير المناخ في ريو.</p>' },
        { date: '1997', title: 'بروتوكول كيوتو', body_html: '<p>أهداف ملزمة لخفض الانبعاثات للدول الصناعية.</p>' }, { date: '2015', title: 'اتفاق باريس', body_html: '<p>اتفاق جميع الدول تقريبًا على الحد من الاحترار دون درجتين مئويتين.</p>' }] },
    'data-chart': { title: 'الكهرباء العالمية من المصادر المتجددة', prompt_html: '<p>اختر عمودًا لقراءة المزيد.</p>', y_label: 'حصة التوليد', caption: 'أرقام توضيحية لأغراض تعليمية.',
        data: [{ note: 'معظمها من الطاقة المائية.' }, {}, {}, { note: 'نمو سريع لطاقة الرياح والشمس.' }, {}] },
    'image-compare': { title: 'استعادة غابة', prompt_html: '<p>اسحب المقبض لمقارنة الموقع قبل إعادة التشجير وبعدها.</p>', before_label: 'قبل', after_label: 'بعد', alt: 'تلة جرداء مقارنة بالتلة نفسها مغطاة بأشجار صغيرة', caption: 'رسم توضيحي.' },
    'hotspot': { title: 'حدّد الألواح الشمسية', prompt_html: '<p>اضغط على جزء المنزل الذي يحوّل ضوء الشمس إلى كهرباء.</p>', image_alt: 'رسم لمنزل بسقف ونافذة وباب وحديقة', regions: [
        { label: 'ألواح السقف', content_html: '<p>تحوّل الألواح الشمسية ضوء الشمس إلى كهرباء.</p>' }, { label: 'النافذة', content_html: '<p>النوافذ تُدخل الضوء لكنها لا تولد الطاقة.</p>' }, { label: 'الشجرة', content_html: '<p>توفر الأشجار الظل وتخزن الكربون.</p>' }],
        feedback: { correct: '<p>صحيح — الألواح على السقف.</p>', incorrect: '<p>انظر إلى السقف.</p>' } },
    'labeled-diagram': { title: 'أجزاء النبات', prompt_html: '<p>سمِّ كل جزء مرقّم من النبات.</p>', image_alt: 'رسم تخطيطي لنبات مزهر', labels: [
        { text: 'الزهرة', description: 'تنتج البذور.' }, { text: 'الورقة', description: 'تصنع الغذاء بالبناء الضوئي.' }, { text: 'الساق', description: 'تنقل الماء والمغذيات.' }, { text: 'الجذور', description: 'تمتص الماء من التربة.' }],
        feedback: { correct: '<p>سمّيت جميع الأجزاء بشكل صحيح!</p>', incorrect: '<p>راجع العلامات المظللة.</p>' } },
    'exploration': { title: 'قدّم توقعًا', prompt_html: '<p>برأيك، ما النسبة المئوية لكهرباء العالم التي تأتي من مصادر متجددة اليوم؟</p>', reveal_html: '<p>الرقم الفعلي نحو <strong>30%</strong>. تقديرك: <span data-exploration-ref="renewables_guess"></span>%.</p>' },
    'branching': { title: 'اختر مسارك', prompt_html: '<p>ما مدى ثقتك بأساسيات الطاقة المتجددة؟</p>', choices: [
        { text: 'أنا جديد على الموضوع — أرني الأساسيات', feedback_html: '<p>رائع، لنبدأ بالمبادئ الأساسية.</p>' }, { text: 'أعرف الأساسيات — خذني إلى التدريب', feedback_html: '<p>لنضع معرفتك موضع التطبيق.</p>' }] },
    'worked-example': { title: 'مثال محلول: كربون المنزل', intro_html: '<p>يستهلك منزل <strong>3000 كيلوواط ساعة</strong> من الكهرباء سنويًا. وتطلق الشبكة <strong>0.4 كغ من ثاني أكسيد الكربون لكل كيلوواط ساعة</strong>. ما انبعاثاته السنوية؟</p>',
        steps: [
            { action_html: '<p>حدّد المعادلة: <em>الانبعاثات = الطاقة × معامل الانبعاث</em>.</p>', rationale_html: '<p>كل وحدة طاقة تحمل كمية ثابتة من ثاني أكسيد الكربون.</p>' },
            { action_html: '<p>اضرب: 3000 × 0.4 = <strong>1200 كغ</strong>.</p>', rationale_html: '<p>تُلغى وحدة الكيلوواط ساعة فيبقى الكيلوغرام من ثاني أكسيد الكربون.</p>' },
            { action_html: '<p>حوّل: 1200 كغ = <strong>1.2 طن</strong> سنويًا.</p>', rationale_html: '<p>الطن يسهّل مقارنة الكميات الكبيرة.</p>' }],
        self_explanation_prompt_html: '<p>بكلماتك: لماذا تُلغى وحدة الكيلوواط ساعة؟</p>' },
    'mcq': { title: 'تحقق من فهمك', prompt_html: '<p>أيٌّ مما يلي مصدر طاقة متجدد؟</p>', options: [{ text: 'الفحم', feedback: 'الفحم وقود أحفوري.' }, { text: 'الطاقة الشمسية' }, { text: 'الغاز الطبيعي' }, { text: 'الديزل' }],
        feedback: { correct: '<p>تمامًا — ضوء الشمس يتجدد طبيعيًا.</p>', incorrect: '<p>ابحث عن المصدر الذي يتجدد بشكل طبيعي.</p>' } },
    'true-false': { title: 'صح أم خطأ؟', prompt_html: '<p>إعادة تدوير علبة ألمنيوم واحدة توفر طاقة تكفي لتشغيل تلفاز نحو ثلاث ساعات.</p>',
        feedback: { correct: '<p>نعم! إعادة تدوير الألمنيوم تستهلك طاقة أقل بنحو 95%.</p>', incorrect: '<p>العبارة صحيحة — الألمنيوم المعاد تدويره يحتاج جزءًا صغيرًا من الطاقة.</p>' } },
    'fill-blank': { title: 'أكمل الجملة', prompt_html: '<p>املأ الكلمات الناقصة.</p>', text_html: '<p>تمتص النباتات {{1}} من الهواء وتطلق {{2}} خلال عملية البناء الضوئي.</p>',
        blanks: [{ accepted: ['ثاني أكسيد الكربون', 'CO2'] }, { accepted: ['الأكسجين', 'أكسجين', 'O2'] }], distractors: ['النيتروجين', 'الميثان'],
        feedback: { correct: '<p>أحسنت!</p>', incorrect: '<p>البناء الضوئي يمتص ثاني أكسيد الكربون ويطلق الأكسجين.</p>' } },
    'drag-drop': { title: 'فرز النفايات', prompt_html: '<p>اسحب كل عنصر إلى الحاوية المناسبة. يمكنك أيضًا الضغط على العنصر ثم على الحاوية.</p>',
        targets: [{ label: 'إعادة التدوير' }, { label: 'السماد' }, { label: 'نفايات عامة' }],
        items: [{ text: 'زجاجة زجاجية' }, { text: 'قشر موز' }, { text: 'جريدة' }, { text: 'بقايا القهوة' }, { text: 'كيس رقائق' }],
        feedback: { correct: '<p>فرز مثالي!</p>', incorrect: '<p>بعض العناصر في الحاوية الخطأ — تم تمييزها.</p>' } },
    'matching': { title: 'طابق المصطلحات', prompt_html: '<p>طابق كل مصطلح مع تعريفه.</p>', pairs: [
        { left: 'التنوع الحيوي', right: 'تنوع أشكال الحياة في منطقة ما' }, { left: 'الموطن', right: 'البيئة الطبيعية للكائن الحي' }, { left: 'النظام البيئي', right: 'مجتمع الكائنات وبيئتها' }, { left: 'التعرية', right: 'تآكل التربة والصخور' }],
        feedback: { correct: '<p>طابقت جميع الأزواج بشكل صحيح.</p>', incorrect: '<p>بعض الروابط غير صحيحة.</p>' } },
    'sorting': { title: 'رتّب الخطوات', prompt_html: '<p>رتّب مراحل دورة الماء بدءًا بالأولى.</p>', items: [{ text: 'التبخر' }, { text: 'التكاثف' }, { text: 'الهطول' }, { text: 'التجمّع' }], top_label: 'الأولى', bottom_label: 'الأخيرة',
        feedback: { correct: '<p>هذه هي الدورة كاملة.</p>', incorrect: '<p>يتبخر الماء، ثم يتكاثف في السحب، ثم يهطل، ثم يتجمع.</p>' } },
    'simulation': { title: 'جرّب: اضبط منظم الحرارة', prompt_html: '<p>تدرّب على خفض جدول التدفئة في تطبيق الطاقة.</p>', image_alt: 'تطبيق طاقة يعرض منظم حرارة وقائمة',
        steps: [
            { instruction_html: '<p>افتح قائمة <strong>Schedule</strong> (الجدول).</p>', hint_html: '<p>القائمة على الجانب الأيسر.</p>' },
            { instruction_html: '<p>اكتب درجة الحرارة الليلية الجديدة: <strong>17</strong> °م.</p>', accepted: ['17', '١٧', '17°'], input_label: 'درجة الحرارة الليلية (°م)' },
            { instruction_html: '<p>ما الأيام التي يجب أن يُطبق عليها الجدول؟</p>', options: ['عطلة نهاية الأسبوع فقط', 'كل يوم', 'أبدًا'] },
            { instruction_html: '<p>اضغط <strong>Save</strong> (حفظ).</p>', feedback_html: '<p>تم الحفظ! الجدول مفعّل.</p>' }],
        feedback: { correct: '<p>أداء مثالي — كل الخطوات صحيحة من المحاولة الأولى.</p>', incorrect: '<p>اكتمل النشاط. راجع الخطوات التي احتجت فيها إلى تلميح.</p>' } },
    'decision-scenario': { title: 'الصنبور المسرّب', intro_html: '<p>أنت تدير مكتبًا صغيرًا. اتخذ قرارات لتقليل هدر المياه.</p>', nodes: [
        { prompt_html: '<p>أبلغك زميل عن صنبور يقطر في المطبخ. ماذا تفعل؟</p>', choices: [
            { text_html: 'أتصل بالصيانة اليوم', feedback_html: '<p>أُصلح خلال ساعات — يوفر ذلك حتى 20 لترًا يوميًا.</p>' },
            { text_html: 'أضع دلوًا تحته مؤقتًا', feedback_html: '<p>يُجمع الماء، لكن التسرب مستمر.</p>' },
            { text_html: 'أتجاهله — إنه مجرد تقطير', feedback_html: '<p>قطرة كل ثانية تهدر أكثر من 10000 لتر سنويًا.</p>' }] },
        { prompt_html: '<p>يسألك الفريق كيف يمكن توفير المزيد من الماء. ما خطوتك التالية؟</p>', choices: [
            { text_html: 'تركيب مهويات للصنابير', feedback_html: '<p>تقلل المهويات التدفق حتى 50% دون فقدان الراحة.</p>' },
            { text_html: 'إرسال بريد تذكيري', feedback_html: '<p>التوعية تساعد قليلًا، لكن تغيير العادات صعب.</p>' }] },
        { prompt_html: '<p>بعد ثلاثة أشهر تراجع فاتورة المياه.</p>' }],
        feedback: { correct: '<p>أحدثت قراراتك فرقًا ملموسًا.</p>', incorrect: '<p>حاول مجددًا: تصرّف بسرعة واختر حلولًا دائمة.</p>' } },
    'game': { title: 'مسابقة البيئة', intro_html: '<p>أجب بسرعة لتبني سلسلة إجابات. لديك ثلاث أرواح!</p>', questions: [
        { prompt: 'ما الغاز الرئيسي المسبب لتغير المناخ؟', options: ['الأكسجين', 'ثاني أكسيد الكربون', 'الهيليوم'], explanation: 'ثاني أكسيد الكربون الناتج عن حرق الوقود الأحفوري.' },
        { prompt: 'أيٌّ من هذه قابل للتحلل الحيوي؟', options: ['كيس بلاستيكي', 'بقايا تفاحة', 'برطمان زجاجي'] },
        { prompt: 'كم توفر مصابيح LED مقارنة بالمصابيح القديمة؟', options: ['نحو 10%', 'نحو 80%', 'لا شيء'], explanation: 'تستهلك مصابيح LED طاقة أقل بنسبة تصل إلى 80%.' },
        { prompt: 'أي وسيلة نقل لها أقل انبعاثات لكل كيلومتر؟', options: ['الدراجة', 'السيارة', 'الطائرة'] }],
        pairs: [{ a: 'شمسية', b: 'الشمس' }, { a: 'رياح', b: 'توربين' }, { a: 'مائية', b: 'نهر' }, { a: 'جوفية', b: 'حرارة الأرض' }],
        words: [{ word: 'سماد', clue: 'مادة عضوية متحللة تُستخدم كسماد للتربة' }, { word: 'جليد', clue: 'ماء متجمد' }],
        feedback: { correct: '<p>لقد فزت! معرفة رائعة.</p>', incorrect: '<p>انتهت اللعبة — العب مجددًا لتحسين درجتك.</p>' } },
    'term-match-race': { title: 'سباق المفردات', prompt_html: '<p>طابق كل مصطلح مع تعريفه قبل انتهاء الوقت. كل مطابقة خاطئة تكلّف 3 ثوانٍ.</p>', pairs: [
        { term_html: 'انبعاث', definition_html: 'غاز يُطلق في الهواء' }, { term_html: 'موطن', definition_html: 'المكان الذي يعيش فيه الكائن' }, { term_html: 'متجدد', definition_html: 'يتجدد طبيعيًا' },
        { term_html: 'ملوِّث', definition_html: 'مادة تسبب التلوث' }, { term_html: 'صون', definition_html: 'حماية الطبيعة' }] },
    'escape-room': { title: 'اهرب من الدفيئة', intro_html: '<p>باب الدفيئة مقفل بثلاثة ألغاز. حُلّها لتخرج!</p>', puzzles: [
        { prompt_html: '<p>القفل 1: ما الغاز الذي تمتصه النباتات؟ <em>(الصيغة الكيميائية)</em></p>', accepted: ['CO2', 'CO₂'], hint_html: '<p>كربون + ذرتا أكسجين.</p>' },
        { prompt_html: '<p>القفل 2: كم رجلًا للحشرة؟</p>', accepted: ['6', '٦', 'ستة', 'ست'], hint_html: '<p>أكثر من أربع وأقل من ثمانٍ.</p>' },
        { prompt_html: '<p>القفل 3: رتّب الحروف: <strong>س ي ش ة م</strong></p>', accepted: ['شمسية'], hint_html: '<p>مرتبطة بالشمس.</p>' }],
        success_html: '<p>انفتح الباب — لقد هربت!</p>', fail_html: '<p>يبقى الباب مغلقًا. راجع التلميحات وحاول مجددًا.</p>' },
    'adaptive-practice': { title: 'تدريب تكيفي: الطاقة', prompt_html: '<p>تتكيف الأسئلة مع إجاباتك — توقّع أسئلة أصعب كلما تحسنت.</p>', items: [
        { prompt_html: '<p>أيها متجدد؟</p>', options: ['الرياح', 'الفحم'], skill: 'المصادر' },
        { prompt_html: '<p>تحوّل الألواح الشمسية ضوء الشمس إلى…</p>', options: ['حرارة فقط', 'كهرباء', 'رياح'], skill: 'المصادر' },
        { prompt_html: '<p>ما الوحدة التي تقيس استهلاك الكهرباء في المنزل؟</p>', options: ['كيلوواط ساعة', 'فولت', 'نيوتن'], skill: 'الوحدات' },
        { prompt_html: '<p>1000 واط لمدة 3 ساعات تساوي…</p>', options: ['3 كيلوواط ساعة', '0.3 كيلوواط ساعة', '30 كيلوواط ساعة'], skill: 'الوحدات', explain_html: '<p>1 كيلوواط × 3 ساعات = 3 كيلوواط ساعة.</p>' },
        { prompt_html: '<p>أيها له أعلى معامل قدرة؟</p>', options: ['الطاقة الشمسية الكهروضوئية', 'الطاقة الحرارية الجوفية', 'الرياح البرية'], skill: 'المصادر' },
        { prompt_html: '<p>استبدال مصباح 60 واط بمصباح LED بقدرة 9 واط يعمل 1000 ساعة سنويًا يوفر…</p>', options: ['51 كيلوواط ساعة', '5.1 كيلوواط ساعة', '510 كيلوواط ساعة'], skill: 'الوحدات', explain_html: '<p>(60 − 9) واط × 1000 ساعة = 51 كيلوواط ساعة.</p>' },
        { prompt_html: '<p>ما الذي يخزن الطاقة لاستخدامها لاحقًا؟</p>', options: ['البطارية', 'العاكس', 'العدّاد'], skill: 'المصادر' }] },
    'poll': { title: 'استطلاع سريع', prompt_html: '<p>أي تغيير سيكون الأسهل عليك هذا الشهر؟</p>', options: ['المشي أو ركوب الدراجة أكثر', 'تقليل تناول اللحوم', 'خفض استهلاك الطاقة في المنزل', 'شراء المستعمل'],
        text_label: 'هل لديك إضافة؟', reflection_html: '<p>التغييرات الصغيرة المستمرة تتراكم. اختر تغييرًا واحدًا وجرّبه لمدة أسبوع.</p>' },
    'embed-html': { title: 'نشاط مخصص: حاسبة الكربون',
        html: '<style>body{font-family:Tahoma,system-ui,sans-serif;margin:0;padding:24px;background:#f4f9fc;color:#1f2d3a}label{display:block;margin:12px 0 4px;font-weight:600}input{width:100%;font-size:18px}output{display:block;font-size:32px;font-weight:700;color:#3b759e;margin-top:16px}button{margin-top:16px;padding:10px 18px;border:0;border-radius:10px;background:#3b759e;color:#fff;font-size:16px;cursor:pointer}</style>\n<h2>حاسبة التنقل</h2>\n<label for="km">الكيلومترات المقطوعة بالسيارة يوميًا</label>\n<input id="km" type="range" min="0" max="100" value="20">\n<output id="out"></output>\n<button id="done">انتهيت</button>\n<script>\nvar km=document.getElementById("km"),out=document.getElementById("out");\nfunction u(){out.textContent=Math.round(km.value*0.17*220)+" كغ CO\\u2082 سنويًا";}\nkm.oninput=u;u();\ndocument.getElementById("done").onclick=function(){ELS.complete();this.textContent="تم الحفظ \\u2713";};\n<\/script>' },
    'results-breakdown': { title: 'نتائجك حسب الموضوع', body_html: '<p>اكتشف نقاط قوتك وما تحتاج إلى مراجعته.</p>', sections: [
        { title: 'المعرفة الأساسية', advice_html: '<p>راجع الأكورديون والتبويبات والبطاقات في الوحدة 1.</p>' },
        { title: 'تطبيق المهارات', advice_html: '<p>جرّب المحاكاة مرة أخرى وراجع الرسم التخطيطي.</p>' },
        { title: 'القرارات والألعاب', advice_html: '<p>أعد السيناريو وركّز على الحلول الدائمة.</p>' }] },
    'summary': { title: 'أحسنت!', body_html: '<p>استكشفت الطاقة المتجددة عبر 31 نوعًا من التفاعل. قدّرت سابقًا أن <span data-exploration-ref="renewables_guess"></span>% من الكهرباء متجددة — والإجابة نحو 30%.</p>',
        passed_html: '<p>لقد نجحت. شارك اليوم شيئًا تعلمته مع زميل.</p>', failed_html: '<p>أنت قريب جدًا. راجع المواضيع المشار إليها في النتائج وحاول مجددًا.</p>' }
};
var AR_SECTIONS = { 'Welcome': 'مرحبًا', 'Learn': 'تعلّم', 'Explore': 'استكشف', 'Practice': 'تدرّب', 'Scenarios': 'سيناريوهات', 'Play': 'العب', 'Wrap-up': 'الختام' };

function build(lang) {
    var course = {
        schema_version: ELS.SCHEMA_VERSION,
        id: 'els-sample-' + lang,
        title: lang === 'ar' ? 'طاقة من أجل كوكب حي — دورة نموذجية' : 'Energy for a Living Planet — sample course',
        lang: lang, dir: lang === 'ar' ? 'rtl' : 'ltr',
        theme: Object.assign({}, ELS.defaultTheme),
        settings: Object.assign({}, ELS.defaultSettings, { scorm_version: '1.2', mastery_score: 70, completion_rule: 'all_viewed', gate: 'none' }),
        screens: []
    };
    OUTLINE.forEach(function (row) {
        var type = row[0], id = row[1], section = row[2], over = row[3];
        var s = ELS.newScreen(type, course);
        s = merge(s, over);
        s.id = id;
        s.section = section;
        if (lang === 'ar') {
            s = merge(s, AR[id] || {});
            s.section = AR_SECTIONS[section] || section;
        }
        course.screens.push(s);
    });
    return ELS.normalizeCourse(course);
}

function write(lang) {
    var course = build(lang);
    var report = ELS.schema.validateCourse(course);
    if (report.errors) {
        Object.keys(report.screens).forEach(function (id) { report.screens[id].forEach(function (i) { if (i.level !== 'warning') console.error(lang, id, i.path, i.message); }); });
        throw new Error(lang + ': sample course has ' + report.errors + ' validation error(s)');
    }
    var types = {};
    course.screens.forEach(function (s) { types[s.type] = 1; });
    var file = path.join(load.ROOT, 'courses', 'sample-' + lang + '.js');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '/* Generated by tools/make-samples.js — sample course covering all ' + Object.keys(types).length + ' screen types (' + lang + '). */\n' +
        '(window.ELS_COURSES = window.ELS_COURSES || {})[' + JSON.stringify('sample-' + lang) + '] = ' + JSON.stringify(course, null, 1) + ';\n');
    console.log('wrote', path.relative(load.ROOT, file), '—', course.screens.length, 'screens,', Object.keys(types).length, 'types,', report.warnings, 'warning(s)');
    return course;
}

if (require.main === module) { write('en'); write('ar'); }
module.exports = { build: build, merge: merge };
