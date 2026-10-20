/**
 * Loads the ELS runtime (registry, schemas, templates, SCORM tracker) in Node
 * so tools and tests can use exactly the same code as the browser.
 * Rendering functions are not called here, so no DOM is required.
 */
'use strict';
var path = require('path');
var ROOT = path.resolve(__dirname, '..');

var FILES = [
    'js/els/core.js', 'js/els/scorm.js',
    'js/els/types/content.js', 'js/els/types/assessment.js', 'js/els/types/interactive.js',
    'js/els/types/scenarios.js', 'js/els/types/games.js', 'js/els/types/advanced.js'
];

module.exports = function loadRuntime() {
    if (globalThis.ELS && globalThis.ELS.registry && globalThis.ELS.registry.all().length) return globalThis.ELS;
    FILES.forEach(function (f) { require(path.join(ROOT, f)); });
    return globalThis.ELS;
};
module.exports.ROOT = ROOT;
module.exports.RUNTIME_FILES = FILES;
