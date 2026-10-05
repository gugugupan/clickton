import type { Board } from "./board";
import { DIRS, DX, DY, edgeOf, opposite, type TileDef } from "./tiles";

export const BALANCE = {
  terminals: ["house_road", "city_road", "road_end"],
  junctions: ["road_t", "road_cross"],
  terminalPerEnd: 1 / 5,
  terminalMax: 3,
  junctionPerEnd: 1 / 6,
} as const;

export const CROSSING = { tile: "level_crossing", idle: 0.05, since: 9 } as const;

export function openRoadEnds(board: Board): number {
  let ends = 0;
  for (const p of board.all()) {
    for (const d of DIRS) {
      if (edgeOf(p.tile, p.rot, d) === "road" && !board.has(p.x + DX[d], p.y + DY[d])) ends++;
    }
  }
  return ends;
}

export function crossingWanted(board: Board): boolean {
  for (const c of board.frontier()) {
    const facing = DIRS.map((d) => board.edgeAt(c.x + DX[d], c.y + DY[d], opposite(d)));
    for (const d of DIRS) {
      if (facing[d] === "road" && (facing[(d + 1) % 4] === "rail" || facing[(d + 3) % 4] === "rail")) return true;
    }
  }
  return false;
}

export function balancedWeights(tiles: readonly TileDef[], weights: readonly number[], board: Board, version: number = CROSSING.since): number[] {
  const ends = openRoadEnds(board);
  const crossing = version >= CROSSING.since && !crossingWanted(board) ? CROSSING.idle : 1;
  const boost = Math.min(BALANCE.terminalMax, 1 + ends * BALANCE.terminalPerEnd);
  const damp = 1 / (1 + ends * BALANCE.junctionPerEnd);
  return tiles.map((t, i) => {
    if ((BALANCE.terminals as readonly string[]).includes(t.key)) return weights[i] * boost;
    if ((BALANCE.junctions as readonly string[]).includes(t.key)) return weights[i] * damp;
    if (t.key === CROSSING.tile) return weights[i] * crossing;
    return weights[i];
  });
}
