import { describe, expect, it } from "vitest";
import { tileForStep } from "../src/core/game";
import { THEMES, categoryOf, moodFor, type Category } from "../src/core/themes";
import { TILES } from "../src/core/tiles";
import { hasKey } from "../src/i18n";

function seedFor(theme: string): number {
  for (let s = 1; s < 10000; s++) if (moodFor(s).theme.key === theme) return s;
  throw new Error(`no seed for ${theme}`);
}

function share(seed: number, cat: Category, n = 4000): number {
  let hits = 0;
  for (let i = 0; i < n; i++) if (categoryOf(TILES[tileForStep(seed, i)]) === cat) hits++;
  return hits / n;
}

describe("world themes", () => {
  it("the theme and jitter are fixed by the seed", () => {
    expect(moodFor(77)).toEqual(moodFor(77));
    const seen = new Set(Array.from({ length: 400 }, (_, s) => moodFor(s).theme.key));
    expect(seen.size).toBe(THEMES.length);
  });

  it("themes really change what you draw", () => {
    expect(share(seedFor("waterside"), "water")).toBeGreaterThan(2 * share(seedFor("metropolis"), "water"));
    expect(share(seedFor("metropolis"), "city")).toBeGreaterThan(share(seedFor("countryside"), "city"));
    expect(share(seedFor("railway"), "rail")).toBeGreaterThan(1.4 * share(seedFor("waterside"), "rail"));
    expect(share(seedFor("countryside"), "grass")).toBeGreaterThan(2 * share(seedFor("metropolis"), "grass"));
  });

  it("every theme has a name and a description", () => {
    for (const t of THEMES) {
      expect(hasKey(`theme_${t.key}`), t.key).toBe(true);
      expect(hasKey(`theme_${t.key}_desc`), t.key).toBe(true);
    }
  });

  it("pre-theme rules versions ignore the theme", () => {
    const water = (seed: number) => {
      let hits = 0;
      for (let i = 0; i < 4000; i++) if (categoryOf(TILES[tileForStep(seed, i, 2)]) === "water") hits++;
      return hits / 4000;
    };
    expect(Math.abs(water(seedFor("waterside")) - water(seedFor("metropolis")))).toBeLessThan(0.025);
  });
});
