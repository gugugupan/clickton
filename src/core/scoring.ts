import { Board, cellKey, type Bounds } from "./board";
import { DIRS, DX, DY, TILES, edgeOf, opposite, type Edge, type Rot } from "./tiles";

export const POINTS = {
  match: 1,
  cityMatch: 2,
  perfect: 3,
  hole: -2,
} as const;

export interface PlacementScore {
  matches: number;
  mismatches: number;
  edgePoints: number;
  perfect: boolean;
  holeCellsBefore: number;
  holeCellsAfter: number;
  holePoints: number;
  total: number;
}

export function countHoleCells(board: Board, extra?: { x: number; y: number }): number {
  const b = board.getBounds();
  if (!b && !extra) return 0;
  const bounds: Bounds = b ?? { minX: extra!.x, maxX: extra!.x, minY: extra!.y, maxY: extra!.y };
  if (extra) {
    bounds.minX = Math.min(bounds.minX, extra.x);
    bounds.maxX = Math.max(bounds.maxX, extra.x);
    bounds.minY = Math.min(bounds.minY, extra.y);
    bounds.maxY = Math.max(bounds.maxY, extra.y);
  }
  const minX = bounds.minX - 1, maxX = bounds.maxX + 1;
  const minY = bounds.minY - 1, maxY = bounds.maxY + 1;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const extraKey = extra ? cellKey(extra.x, extra.y) : -1;
  const solid = (x: number, y: number) => board.has(x, y) || cellKey(x, y) === extraKey;

  const outside = new Uint8Array(w * h);
  const stack: number[] = [0];
  outside[0] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = (i % w) + minX, y = Math.floor(i / w) + minY;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const ni = (ny - minY) * w + (nx - minX);
      if (outside[ni] || solid(nx, ny)) continue;
      outside[ni] = 1;
      stack.push(ni);
    }
  }

  let holes = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!outside[(y - minY) * w + (x - minX)] && !solid(x, y)) holes++;
    }
  }
  return holes;
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
  const holeCellsBefore = countHoleCells(board);
  const holeCellsAfter = countHoleCells(board, { x, y });
  const holePoints = (holeCellsAfter - holeCellsBefore) * POINTS.hole;
  return {
    matches,
    mismatches,
    edgePoints,
    perfect,
    holeCellsBefore,
    holeCellsAfter,
    holePoints,
    total: edgePoints + (perfect ? POINTS.perfect : 0) + holePoints,
  };
}
