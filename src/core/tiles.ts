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
  house?: boolean;
}

type TileSpec = Omit<TileDef, "id">;

const G = "grass", R = "road", L = "rail", W = "water", C = "city";

const SPECS: TileSpec[] = [
  { key: "grass", edges: [G, G, G, G], groups: [], weight: 10 },
  { key: "road_straight", edges: [R, G, R, G], groups: [{ type: R, dirs: [0, 2] }], weight: 7 },
  { key: "road_curve", edges: [R, R, G, G], groups: [{ type: R, dirs: [0, 1] }], weight: 6 },
  { key: "road_t", edges: [R, R, R, G], groups: [{ type: R, dirs: [0, 1, 2] }], weight: 3 },
  { key: "road_cross", edges: [R, R, R, R], groups: [{ type: R, dirs: [0, 1, 2, 3] }], weight: 1 },
  { key: "rail_straight", edges: [L, G, L, G], groups: [{ type: L, dirs: [0, 2] }], weight: 6 },
  { key: "rail_curve", edges: [L, L, G, G], groups: [{ type: L, dirs: [0, 1] }], weight: 5 },
  { key: "station", edges: [L, G, G, G], groups: [{ type: L, dirs: [0] }], weight: 2, station: true },
  {
    key: "station_road",
    edges: [L, G, R, G],
    groups: [{ type: L, dirs: [0] }, { type: R, dirs: [2] }],
    weight: 2,
    station: true,
  },
  { key: "city_edge", edges: [C, G, G, G], groups: [{ type: C, dirs: [0] }], weight: 5 },
  { key: "city_corner", edges: [C, C, G, G], groups: [{ type: C, dirs: [0, 1] }], weight: 4 },
  { key: "city_full", edges: [C, C, C, C], groups: [{ type: C, dirs: [0, 1, 2, 3] }], weight: 2 },
  {
    key: "city_road",
    edges: [C, G, R, G],
    groups: [{ type: C, dirs: [0] }, { type: R, dirs: [2] }],
    weight: 4,
  },
  { key: "house_road", edges: [G, G, R, G], groups: [{ type: R, dirs: [2] }], weight: 4, house: true },
  { key: "river_straight", edges: [W, G, W, G], groups: [{ type: W, dirs: [0, 2] }], weight: 4 },
  { key: "river_curve", edges: [W, W, G, G], groups: [{ type: W, dirs: [0, 1] }], weight: 3 },
  { key: "lake", edges: [W, G, G, G], groups: [{ type: W, dirs: [0] }], weight: 2 },
  {
    key: "level_crossing",
    edges: [L, R, L, R],
    groups: [{ type: L, dirs: [0, 2] }, { type: R, dirs: [1, 3] }],
    weight: 1,
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
];

export const TILES: readonly TileDef[] = SPECS.map((s, id) => ({ ...s, id }));

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
