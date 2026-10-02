# Clickton · 咔哒镇 · カチッとタウン

An endless, cozy tile-placement brick town. Draw a random 1×1 tile, rotate it, and click it into place next to your town. Matching edges score points, enclosed gaps cost points, and the town comes alive: finished railways get trains, houses bring people, meadows fill with animals. There is no ending — stop whenever you like and share your town as a URL.

Inspired by LEGO Loco and Carcassonne. Not affiliated with the LEGO Group.

## Rules (v1)

- Tile edges: grass, road, rail, water, city. Loose matching — any tile can go next to any tile; only matching edges score.
- Score per placement: +1 per matching edge (+2 for city), +3 when all four neighbours match, −2 per newly enclosed empty cell (refunded when filled).
- Every new town rolls a world theme from its seed (Classic, Metropolis, Railway country, Waterside, Countryside, Crossroads, Quiet village) plus a ±20 % jitter per tile category, so each game feels different.
- Share links store the seed and the move sequence (`#c=...`), so a 500-tile town is about 1.1 KB of URL.

## Development

```bash
npm install
npm run dev     # http://localhost:5189
npm test
npm run build
```

Code layout: `src/core/` is pure game logic (no three.js) and is fully unit-tested in `tests/`.

## Assets

3D models are CC0 packs: [KayKit](https://kaylousberg.com/game-assets) by Kay Lousberg (City Builder Bits street props, Medieval Hexagon props and water plants, Forest Nature Pack, Holiday Bits train) and [Kenney](https://kenney.nl) (City Kit Suburban houses, City Kit Commercial shops and towers, Blocky Characters, Cube Pets). Only the models listed in `src/render/assets.json` are committed under `public/models/` (each pack keeps its license file). To refresh them, put the original packs in `assets-raw/` (gitignored) and run `npm run assets`. Base plates, roads, rails, water and end caps are generated in code.

Dev helpers: `/?demo=300` builds a random 300-tile town (dev server only); `/gallery.html` is the local asset picker.
