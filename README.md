# Clickton · 咔哒镇 · カチッとタウン

An endless, cozy tile-placement brick town. Draw a random 1×1 tile, rotate it, and click it into place next to your town. Matching edges score points, enclosed gaps cost points, and the town comes alive: finished railways get trains, houses bring people, meadows fill with animals. There is no ending — stop whenever you like and share your town as a URL.

Inspired by LEGO Loco and Carcassonne. Not affiliated with the LEGO Group.

## Rules (v1)

- Tile edges: grass, road, rail, water, city. Loose matching — any tile can go next to any tile; only matching edges score.
- Score per placement: +1 per matching edge (+2 for city), +3 when all four neighbours match, −2 per newly enclosed empty cell (refunded when filled).
- Share links store the seed and the move sequence (`#c=...`), so a 500-tile town is about 1.1 KB of URL.

## Development

```bash
npm install
npm run dev     # http://localhost:5189
npm test
npm run build
```

Code layout: `src/core/` is pure game logic (no three.js) and is fully unit-tested in `tests/`.
