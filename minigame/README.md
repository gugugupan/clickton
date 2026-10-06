# Clickton WeChat mini game (feasibility spike)

`npm run build:wx` writes `game.js` (bundle of `wx/main.ts`) and `models/` (meshopt-free copies of
`public/models`, one subpackage per pack) into this folder. Open this folder in WeChat DevTools.

The spike reuses `src/core` and `src/render` unchanged through `wx/adapter.ts`
(fake `window`/`document`, touch → pointer events, `fetch` over the package file system,
`wx.createImage`, `wx.createWebAudioContext`). It builds a 60-tile demo town.

- tap an empty cell next to the town: place the current tile (best rotation)
- tap the stats box: add 30 tiles (stress test)
- drag / pinch: pan / zoom

`project.config.json` uses `touristappid`, which runs in the DevTools simulator only.
Real-device preview needs a mini game AppID (put it in `project.private.config.json`, gitignored).

## No-DevTools check

`wx/sim/` runs `minigame/game.js` in a DOM-less Web Worker with a fake `wx`
(OffscreenCanvas, stubbed audio): start the Vite dev server and open `/wx/sim/`.
It catches adapter gaps; it says nothing about iOS performance.
