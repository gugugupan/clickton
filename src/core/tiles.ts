import { themedWeights } from "./themes";

export type Edge = "grass" | "road" | "rail" | "water" | "city";
export type Dir = 0 | 1 | 2 | 3;
export type Rot = 0 | 1 | 2 | 3;

export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

export interface Group {
  type: Exclude<Edge, "grass">;
  dirs: Dir[];
}

export interface TileDef {
  id: number;
  key: string;
  edges: readonly [Edge, Edge, Edge, Edge];
  groups: readonly Group[];
  weight: number;
  station?: boolean;
  halt?: boolean;
  house?: boolean;
  pool?: boolean;
}

type TileSpec = Omit<TileDef, "id">;

const G = "grass", R = "road", L = "rail", W = "water", C = "city";

const SPECS: TileSpec[] = [
  { key: "grass", edges: [G, G, G, G], groups: [], weight: 6 },
  { key: "road_straight", edges: [R, G, R, G], groups: [{ type: R, dirs: [0, 2] }], weight: 10 },
  { key: "road_curve", edges: [R, R, G, G], groups: [{ type: R, dirs: [0, 1] }], weight: 8 },
  { key: "road_t", edges: [R, R, R, G], groups: [{ type: R, dirs: [0, 1, 2] }], weight: 6 },
  { key: "road_cross", edges: [R, R, R, R], groups: [{ type: R, dirs: [0, 1, 2, 3] }], weight: 4 },
  { key: "rail_straight", edges: [L, G, L, G], groups: [{ type: L, dirs: [0, 2] }], weight: 7 },
  { key: "rail_curve", edges: [L, L, G, G], groups: [{ type: L, dirs: [0, 1] }], weight: 8 },
  { key: "station", edges: [L, G, G, G], groups: [{ type: L, dirs: [0] }], weight: 2, station: true },
  {
    key: "station_road",
    edges: [L, G, R, G],
    groups: [{ type: L, dirs: [0] }, { type: R, dirs: [2] }],
    weight: 2,
    station: true,
  },
  { key: "station_through", edges: [L, G, L, G], groups: [{ type: L, dirs: [0, 2] }], weight: 5, halt: true },
  { key: "city_edge", edges: [C, G, G, G], groups: [{ type: C, dirs: [0] }], weight: 8 },
  { key: "city_corner", edges: [C, C, G, G], groups: [{ type: C, dirs: [0, 1] }], weight: 7 },
  { key: "city_full", edges: [C, C, C, C], groups: [{ type: C, dirs: [0, 1, 2, 3] }], weight: 5 },
  {
    key: "city_road",
    edges: [C, G, R, G],
    groups: [{ type: C, dirs: [0] }, { type: R, dirs: [2] }],
    weight: 6,
  },
  { key: "house_road", edges: [G, G, R, G], groups: [{ type: R, dirs: [2] }], weight: 6, house: true },
  { key: "river_straight", edges: [W, G, W, G], groups: [{ type: W, dirs: [0, 2] }], weight: 3 },
  { key: "river_curve", edges: [W, W, G, G], groups: [{ type: W, dirs: [0, 1] }], weight: 2 },
  { key: "lake", edges: [W, G, G, G], groups: [{ type: W, dirs: [0] }], weight: 1 },
  {
    key: "level_crossing",
    edges: [L, R, L, R],
    groups: [{ type: L, dirs: [0, 2] }, { type: R, dirs: [1, 3] }],
    weight: 2,
  },
  {
    key: "road_bridge",
    edges: [R, W, R, W],
    groups: [{ type: R, dirs: [0, 2] }, { type: W, dirs: [1, 3] }],
    weight: 1,
  },
  {
    key: "rail_bridge",
    edges: [L, W, L, W],
    groups: [{ type: L, dirs: [0, 2] }, { type: W, dirs: [1, 3] }],
    weight: 1,
  },
  { key: "pool", edges: [G, G, G, G], groups: [], weight: 2, pool: true },
];

export const TILES: readonly TileDef[] = SPECS.map((s, id) => ({ ...s, id }));

export const RULES_VERSION = 3;

const LEGACY_WEIGHTS: Record<number, Record<string, number>> = {
  2: { grass: 6, road_straight: 10, road_curve: 8, road_t: 6, road_cross: 4, rail_straight: 7, rail_curve: 8, station: 2, station_road: 2, station_through: 5, city_edge: 8, city_corner: 7, city_full: 5, city_road: 6, house_road: 6, river_straight: 3, river_curve: 2, lake: 1, level_crossing: 2, road_bridge: 1, rail_bridge: 1 },
  1: { grass: 10, road_straight: 7, road_curve: 6, road_t: 3, road_cross: 1, rail_straight: 6, rail_curve: 5, station: 1, station_road: 1, station_through: 3, city_edge: 5, city_corner: 4, city_full: 2, city_road: 4, house_road: 4, river_straight: 4, river_curve: 3, lake: 2, level_crossing: 1, road_bridge: 1, rail_bridge: 1 },
};

export function baseWeights(version: number): number[] {
  if (version === RULES_VERSION) return TILES.map((t) => t.weight);
  const legacy = LEGACY_WEIGHTS[version];
  if (!legacy) throw new Error(`unknown rules version ${version}`);
  return TILES.map((t) => legacy[t.key] ?? 0);
}

export function weightsFor(version: number, seed: number): number[] {
  return version >= 3 ? themedWeights(TILES, seed) : baseWeights(version);
}

export function isKnownVersion(version: number): boolean {
  return version === RULES_VERSION || version in LEGACY_WEIGHTS;
}

export const STARTER_TILE = TILES.findIndex((t) => t.key === "station_road");

export function tileByKey(key: string): TileDef {
  const t = TILES.find((t) => t.key === key);
  if (!t) throw new Error(`unknown tile ${key}`);
  return t;
}

export function edgeOf(tile: TileDef, rot: Rot, dir: Dir): Edge {
  return tile.edges[(dir - rot + 4) % 4];
}

export function rotateDir(d: Dir, rot: Rot): Dir {
  return ((d + rot) % 4) as Dir;
}

export function groupsOf(tile: TileDef, rot: Rot): Group[] {
  return tile.groups.map((g) => ({ type: g.type, dirs: g.dirs.map((d) => rotateDir(d, rot)) }));
}
