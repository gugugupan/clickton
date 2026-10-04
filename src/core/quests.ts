import type { Board } from "./board";
import {
  completedRailLines,
  edgeRegions,
  isLinkedBridge,
  isPark,
  meadowRegions,
  riverReach,
} from "./networks";
import { hash, mulberry32 } from "./rng";
import type { PlacementScore } from "./scoring";
import { specialStatus } from "./specials";
import type { Landmark, TileDef } from "./tiles";

export type QuestKind =
  | "road_closed"
  | "rail_done"
  | "park"
  | "city_closed"
  | "river_lake"
  | "bridge"
  | "special_on"
  | "meadow_size"
  | "city_size"
  | "road_size"
  | "forest"
  | "clean_streak"
  | "big_hand";

interface QuestDef {
  landmark: Landmark;
  base: number;
  growth: number;
  lead?: number;
  bias: Record<string, number>;
}

export const QUESTS: Record<QuestKind, QuestDef> = {
  road_closed: { landmark: "market", base: 3, growth: 1, bias: { road_end: 2, house_road: 1.6 } },
  rail_done: { landmark: "xmas", base: 3, growth: 1, bias: { station: 2.5, station_road: 2.5, rail_curve: 1.4, rail_straight: 1.3 } },
  park: { landmark: "garden", base: 1, growth: 1, bias: { city_edge: 1.6, city_corner: 1.6, grass: 1.5 } },
  city_closed: { landmark: "church", base: 3, growth: 1, bias: { city_edge: 1.8, city_corner: 1.8 } },
  river_lake: { landmark: "lighthouse", base: 2, growth: 1, lead: 1, bias: { lake: 3, river_straight: 2, river_curve: 2 } },
  bridge: { landmark: "watermill", base: 1, growth: 1, bias: { road_bridge: 3, rail_bridge: 3, river_straight: 1.6 } },
  special_on: { landmark: "stage", base: 1, growth: 1, bias: { zoo: 4, farm: 4, police: 4, beach: 4 } },
  meadow_size: { landmark: "windmill", base: 5, growth: 2, lead: 2, bias: { grass: 2, farm: 2, pool: 1.5 } },
  city_size: { landmark: "castle", base: 5, growth: 2, lead: 2, bias: { city_full: 2, city_corner: 1.5 } },
  road_size: { landmark: "sports", base: 6, growth: 3, lead: 3, bias: { road_straight: 1.6, road_curve: 1.6, road_t: 1.4 } },
  forest: { landmark: "lumber", base: 3, growth: 1, bias: { grass: 2.5 } },
  clean_streak: { landmark: "gingerbread", base: 4, growth: 1, bias: {} },
  big_hand: { landmark: "tavern", base: 7, growth: 1, bias: { city_full: 1.6, road_cross: 2 } },
};

export const QUEST_KINDS = Object.keys(QUESTS) as QuestKind[];
export const QUEST_SLOTS = 3;
export const BIAS_MAX = 5;
export const BIAS_RAMP = 20;

export interface Quest {
  kind: QuestKind;
  serial: number;
  target: number;
  progress: number;
  since: number;
  seen: Set<string>;
}

export interface Placement {
  tile: TileDef;
  score: PlacementScore;
}

function newKeys(keys: Iterable<string>, seen: Set<string>): string[] {
  return [...keys].filter((k) => !seen.has(k));
}

function closedRegionKeys(board: Board, type: "road" | "city"): Map<string, number> {
  return new Map(edgeRegions(board, type).filter((r) => r.closed).map((r) => [r.key, r.cells.length]));
}

function parkCells(board: Board): string[] {
  return [...board.all()].filter((p) => isPark(board, p)).map((p) => `${p.x},${p.y}`);
}

function bridgeCells(board: Board): string[] {
  return [...board.all()].filter((p) => isLinkedBridge(board, p)).map((p) => `${p.x},${p.y}`);
}

function activeSpecials(board: Board): string[] {
  return [...board.all()].filter((p) => p.tile.special && specialStatus(board, p).active).map((p) => `${p.x},${p.y}`);
}

function railKeys(board: Board): Map<string, number> {
  return new Map(completedRailLines(board).map((l) => [l.key, l.steps.length]));
}

function largest(sizes: number[]): number {
  return sizes.reduce((a, b) => Math.max(a, b), 0);
}

function metric(kind: QuestKind, board: Board): number {
  switch (kind) {
    case "river_lake":
      return riverReach(board);
    case "meadow_size":
      return largest(meadowRegions(board).map((r) => r.length));
    case "city_size":
      return largest(edgeRegions(board, "city").map((r) => r.cells.length));
    case "road_size":
      return largest(edgeRegions(board, "road").map((r) => r.cells.length));
    default:
      return 0;
  }
}

function snapshot(kind: QuestKind, board: Board): Set<string> {
  switch (kind) {
    case "road_closed":
      return new Set(closedRegionKeys(board, "road").keys());
    case "city_closed":
      return new Set(closedRegionKeys(board, "city").keys());
    case "rail_done":
      return new Set(railKeys(board).keys());
    case "park":
      return new Set(parkCells(board));
    case "bridge":
      return new Set(bridgeCells(board));
    case "special_on":
      return new Set(activeSpecials(board));
    default:
      return new Set();
  }
}

export function issueQuest(
  seed: number,
  serial: number,
  board: Board,
  active: readonly Quest[],
  tiers: Partial<Record<QuestKind, number>>,
  since = 0,
): Quest {
  const taken = new Set(active.map((q) => q.kind));
  const pool = QUEST_KINDS.filter((k) => !taken.has(k));
  const kind = pool[Math.floor(mulberry32(hash(seed, 0x9e57 + serial))() * pool.length)];
  const def = QUESTS[kind];
  let target = def.base + def.growth * (tiers[kind] ?? 0);
  if (def.lead) target = Math.max(target, metric(kind, board) + def.lead);
  return { kind, serial, target, progress: 0, since, seen: snapshot(kind, board) };
}

export function advanceQuest(q: Quest, board: Board, placed: Placement): void {
  switch (q.kind) {
    case "road_closed":
    case "city_closed": {
      const sizes = closedRegionKeys(board, q.kind === "road_closed" ? "road" : "city");
      q.progress = Math.max(q.progress, largest(newKeys(sizes.keys(), q.seen).map((k) => sizes.get(k)!)));
      break;
    }
    case "rail_done": {
      const lines = railKeys(board);
      q.progress = Math.max(q.progress, largest(newKeys(lines.keys(), q.seen).map((k) => lines.get(k)!)));
      break;
    }
    case "park":
      q.progress = newKeys(parkCells(board), q.seen).length;
      break;
    case "bridge":
      q.progress = newKeys(bridgeCells(board), q.seen).length;
      break;
    case "special_on":
      q.progress = newKeys(activeSpecials(board), q.seen).length;
      break;
    case "river_lake":
    case "meadow_size":
    case "city_size":
    case "road_size":
      q.progress = metric(q.kind, board);
      break;
    case "forest":
      if (placed.tile.key === "grass") q.progress++;
      break;
    case "clean_streak":
      q.progress = placed.score.mismatches === 0 ? q.progress + 1 : 0;
      break;
    case "big_hand":
      q.progress = Math.max(q.progress, placed.score.total);
      break;
  }
}

export function questBias(tiles: readonly TileDef[], weights: readonly number[], quests: readonly Quest[], placements = 0): number[] {
  const ramp = quests.map((q) => 1 + Math.min(1, Math.max(0, placements - q.since) / BIAS_RAMP));
  return tiles.map((t, i) => {
    let m = 1;
    quests.forEach((q, j) => (m *= (QUESTS[q.kind].bias[t.key] ?? 1) ** ramp[j]));
    return weights[i] * Math.min(BIAS_MAX, m);
  });
}

export const QUEST_RULES = { QUESTS, QUEST_SLOTS, BIAS_MAX, BIAS_RAMP };
