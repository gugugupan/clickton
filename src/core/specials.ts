import type { Board, Placed } from "./board";
import { completedRoadNetworks, isMeadow } from "./networks";
import { DIRS, DX, DY } from "./tiles";

export interface SpecialStatus {
  active: boolean;
  count: number;
}

const WATERY = new Set(["pool", "lake", "river_straight", "river_curve"]);

export function specialStatus(board: Board, p: Placed, roadCells?: Set<string>): SpecialStatus {
  const neighbours = DIRS.map((d) => board.get(p.x + DX[d], p.y + DY[d]));
  switch (p.tile.special) {
    case "zoo":
    case "police": {
      const cells = roadCells ?? completedRoadCells(board);
      const active = cells.has(`${p.x},${p.y}`);
      return { active, count: active ? 1 : 0 };
    }
    case "farm": {
      const meadows = neighbours.filter((n) => n && isMeadow(n)).length;
      return { active: meadows >= 2, count: meadows >= 2 ? meadows : 0 };
    }
    case "beach": {
      const water = neighbours.filter((n) => n && WATERY.has(n.tile.key)).length;
      return { active: water > 0, count: water > 0 ? 1 + water : 0 };
    }
    default:
      return { active: false, count: 0 };
  }
}

export function completedRoadCells(board: Board): Set<string> {
  const cells = new Set<string>();
  for (const net of completedRoadNetworks(board)) for (const c of net.cells) cells.add(`${c.x},${c.y}`);
  return cells;
}
