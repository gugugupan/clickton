import { hash, mulberry32 } from "./rng";
import type { TileDef } from "./tiles";

export type Category = "city" | "road" | "rail" | "grass" | "water" | "cross";

export const CATEGORIES: readonly Category[] = ["city", "road", "rail", "grass", "water", "cross"];

export function categoryOf(tile: TileDef): Category {
  const k = tile.key;
  if (k.startsWith("city") || k === "house_road") return "city";
  if (k === "level_crossing" || k.endsWith("_bridge")) return "cross";
  if (k.startsWith("road")) return "road";
  if (k.startsWith("rail") || k.startsWith("station")) return "rail";
  if (k === "grass") return "grass";
  return "water";
}

export interface Theme {
  key: string;
  emoji: string;
  categories: Partial<Record<Category, number>>;
  tiles: Record<string, number>;
}

export const THEMES: readonly Theme[] = [
  { key: "classic", emoji: "⚖️", categories: {}, tiles: {} },
  {
    key: "metropolis",
    emoji: "🏙️",
    categories: { city: 1.8, road: 1.3, grass: 0.5, water: 0.5 },
    tiles: { city_full: 1.4 },
  },
  {
    key: "railway",
    emoji: "🚂",
    categories: { rail: 2, city: 0.8 },
    tiles: { rail_curve: 1.25, level_crossing: 1.5 },
  },
  {
    key: "waterside",
    emoji: "🌊",
    categories: { water: 3, grass: 1.5, rail: 0.7 },
    tiles: { road_bridge: 3, rail_bridge: 3 },
  },
  {
    key: "countryside",
    emoji: "🌾",
    categories: { grass: 3, road: 0.8 },
    tiles: { house_road: 2, city_full: 0.3, pool: 2 },
  },
  {
    key: "crossroads",
    emoji: "🚦",
    categories: { road: 1.8 },
    tiles: { road_t: 1.4, road_cross: 1.4, level_crossing: 2 },
  },
  {
    key: "village",
    emoji: "🏡",
    categories: {},
    tiles: { house_road: 1.5, city_edge: 1.3, city_full: 0.5 },
  },
];

export interface WorldMood {
  theme: Theme;
  jitter: Record<Category, number>;
}

export function moodFor(seed: number): WorldMood {
  const theme = THEMES[hash(seed, 0x7e3a) % THEMES.length];
  const rnd = mulberry32(hash(seed, 0x1177));
  const jitter = Object.fromEntries(CATEGORIES.map((c) => [c, 0.8 + rnd() * 0.45])) as Record<Category, number>;
  return { theme, jitter };
}

export function themedWeights(tiles: readonly TileDef[], base: readonly number[], seed: number): number[] {
  const { theme, jitter } = moodFor(seed);
  return tiles.map((t, i) => {
    const c = categoryOf(t);
    return base[i] * (theme.categories[c] ?? 1) * (theme.tiles[t.key] ?? 1) * jitter[c];
  });
}
