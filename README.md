# visi-ai

Тестовый мост GitHub → Visiology 3.17.1.

- `loader.js` — минимальный код, который один раз вставляется в пользовательский виджет Visiology.
- `widget.js` — основная логика, которую можно менять через Git.
- `index.html` — точка входа GitHub Pages.

Тестовая схема:

Visiology custom widget → GitHub Pages → widget.js → `window.visiAiRender(w)`
