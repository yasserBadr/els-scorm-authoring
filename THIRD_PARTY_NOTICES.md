# Third-party notices

| Component | Location | License |
|---|---|---|
| reveal.js 3.8.0 (Hakim El Hattab and contributors) | `js/reveal.js`, `css/reveal.css`, `plugin/` | MIT (see `LICENSE`) |
| jQuery 3.4.1 | `js/jquery.min.js` | MIT |
| scormfunctions.js (Rustici Software, modified by Osvaldo Gago) | `js/scormfunctions.js` | CC BY 3.0 US. The new `js/els/scorm.js` follows the same ADL API-discovery approach, extended to SCORM 2004. |
| lottie-web 5.12.2, light build (Airbnb / Bodymovin) | `lib/js/lottie_light.min.js` | MIT (see `lib/js/lottie-LICENSE.md`). Only used by the `lottie` screen type and packaged only when a course uses it. |

## Reference project

The 31 screen types, their names and their configuration fields follow the public specification in
[kemalyy/edumints-scorm-mcp — docs/SCREEN_TYPES.md](https://github.com/kemalyy/edumints-scorm-mcp/blob/main/docs/SCREEN_TYPES.md) (MIT license).
That project is a Python MCP server. No source code from it was copied here. The screen types were implemented independently in this project's JavaScript/reveal.js stack, using its documented schemas as the functional reference.

## Fonts

Rubik, Work Sans and Tajawal are loaded from Google Fonts (SIL Open Font License) when online. Exported packages fall back to system fonts when offline.
