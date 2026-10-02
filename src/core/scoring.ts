import { Board } from "./board";
import { completedRailLines, type RailLine } from "./networks";
import { DIRS, DX, DY, TILES, edgeOf, opposite, type Edge, type Rot } from "./tiles";

export const POINTS = {
  match: 1,
  cityMatch: 2,
  perfect: 3,
  lineStep: 1,
  loopStep: 3,
  loopHalt: 5,
  minLineSteps: 3,
} as const;

export interface PlacementScore {
  matches: number;
  mismatches: number;
  edgePoints: number;
  perfect: boolean;
  railPoints: number;
  loopsClosed: number;
  linesClosed: number;
  total: number;
}

export function railBonus(line: RailLine): number {
  if (line.loop) return line.steps.length * POINTS.loopStep + line.halts * POINTS.loopHalt;
  return line.steps.length >= POINTS.minLineSteps ? line.steps.length * POINTS.lineStep : 0;
}

function closedLines(board: Board, tileId: number, rot: Rot, x: number, y: number): RailLine[] {
  if (!TILES[tileId].groups.some((g) => g.type === "rail")) return [];
  const before = new Set(completedRailLines(board).map((l) => l.key));
  const after = board.clone();
  after.place(tileId, rot, x, y);
  return completedRailLines(after).filter((l) => !before.has(l.key));
}

function edgeValue(e: Edge): number {
  return e === "city" ? POINTS.cityMatch : POINTS.match;
}

export function scorePlacement(board: Board, tileId: number, rot: Rot, x: number, y: number): PlacementScore {
  const tile = TILES[tileId];
  let matches = 0, mismatches = 0, edgePoints = 0, neighbours = 0;
  for (const d of DIRS) {
    const theirs = board.edgeAt(x + DX[d], y + DY[d], opposite(d));
    if (theirs === undefined) continue;
    neighbours++;
    const mine = edgeOf(tile, rot, d);
    if (mine === theirs) {
      matches++;
      edgePoints += edgeValue(mine);
    } else {
      mismatches++;
    }
  }
  const perfect = neighbours === 4 && mismatches === 0;
  const closed = closedLines(board, tileId, rot, x, y);
  const railPoints = closed.reduce((sum, l) => sum + railBonus(l), 0);
  return {
    matches,
    mismatches,
    edgePoints,
    perfect,
    railPoints,
    loopsClosed: closed.filter((l) => l.loop).length,
    linesClosed: closed.filter((l) => !l.loop).length,
    total: edgePoints + (perfect ? POINTS.perfect : 0) + railPoints,
  };
}
