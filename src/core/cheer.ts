import type { Board } from "./board";
import { edgeRegions } from "./networks";
import { DIRS, DX, DY, edgeOf, opposite, type Edge, type Rot, type TileDef } from "./tiles";

export type CheerTier = 0 | 2 | 3 | 4;

export interface CheerInput {
  questsDone: number;
  loopsClosed: number;
  linesClosed: number;
  opened: number;
}

export function matchedEdges(board: Board, tile: TileDef, rot: Rot, x: number, y: number): (Edge | null)[] {
  return DIRS.map((d) => {
    const mine = edgeOf(tile, rot, d);
    return board.edgeAt(x + DX[d], y + DY[d], opposite(d)) === mine ? mine : null;
  });
}

export function closedRegionsAt(board: Board, x: number, y: number): number[] {
  return (["city", "forest", "field", "water"] as const)
    .flatMap((type) => edgeRegions(board, type))
    .filter((r) => r.closed && r.cells.some((c) => c.x === x && c.y === y))
    .map((r) => r.cells.length);
}

export function cheerTier(input: CheerInput, closedSizes: readonly number[]): CheerTier {
  if (input.questsDone > 0) return 4;
  if (input.loopsClosed > 0 || closedSizes.some((n) => n >= 6)) return 3;
  if (input.opened > 0 || input.linesClosed > 0 || closedSizes.length > 0) return 2;
  return 0;
}
