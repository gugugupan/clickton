import { Board, type Placed } from "./board";
import { hash, mulberry32 } from "./rng";
import { scorePlacement, type PlacementScore } from "./scoring";
import { STARTER_TILE, TILES, type Rot } from "./tiles";

export interface Move {
  x: number;
  y: number;
  rot: Rot;
}

const TOTAL_WEIGHT = TILES.reduce((s, t) => s + t.weight, 0);

export function tileForStep(seed: number, step: number): number {
  let r = mulberry32(hash(seed, step))() * TOTAL_WEIGHT;
  for (const t of TILES) {
    r -= t.weight;
    if (r < 0) return t.id;
  }
  return TILES.length - 1;
}

export class Game {
  readonly board = new Board();
  readonly moves: Move[] = [];
  score = 0;

  constructor(readonly seed: number) {
    this.board.place(STARTER_TILE, 0, 0, 0);
  }

  static replay(seed: number, moves: readonly Move[]): Game {
    const g = new Game(seed);
    for (const m of moves) g.place(m.x, m.y, m.rot);
    return g;
  }

  get step(): number {
    return this.moves.length;
  }

  get currentTile(): number {
    return tileForStep(this.seed, this.step);
  }

  preview(x: number, y: number, rot: Rot): PlacementScore | null {
    if (!this.board.canPlace(x, y)) return null;
    return scorePlacement(this.board, this.currentTile, rot, x, y);
  }

  place(x: number, y: number, rot: Rot): { placed: Placed; score: PlacementScore } {
    const tileId = this.currentTile;
    if (!this.board.canPlace(x, y)) throw new Error(`cannot place at ${x},${y}`);
    const score = scorePlacement(this.board, tileId, rot, x, y);
    const placed = this.board.place(tileId, rot, x, y);
    this.moves.push({ x, y, rot });
    this.score += score.total;
    return { placed, score };
  }
}
