import type { Board } from "./board";
import { DIRS, DX, DY, edgeOf, type TileDef } from "./tiles";

export const BALANCE = {
  terminals: ["house_road", "city_road", "road_end"],
  junctions: ["road_t", "road_cross"],
  terminalPerEnd: 1 / 5,
  terminalMax: 3,
  junctionPerEnd: 1 / 6,
} as const;

export function openRoadEnds(board: Board): number {
  let ends = 0;
  for (const p of board.all()) {
    for (const d of DIRS) {
      if (edgeOf(p.tile, p.rot, d) === "road" && !board.has(p.x + DX[d], p.y + DY[d])) ends++;
    }
  }
  return ends;
}

export function balancedWeights(tiles: readonly TileDef[], weights: readonly number[], board: Board): number[] {
  const ends = openRoadEnds(board);
  const boost = Math.min(BALANCE.terminalMax, 1 + ends * BALANCE.terminalPerEnd);
  const damp = 1 / (1 + ends * BALANCE.junctionPerEnd);
  return tiles.map((t, i) => {
    if ((BALANCE.terminals as readonly string[]).includes(t.key)) return weights[i] * boost;
    if ((BALANCE.junctions as readonly string[]).includes(t.key)) return weights[i] * damp;
    return weights[i];
  });
}
