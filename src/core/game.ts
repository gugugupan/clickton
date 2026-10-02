import { Board, type Placed } from "./board";
import { hash, mulberry32 } from "./rng";
import { scorePlacement, type PlacementScore } from "./scoring";
import { RULES_VERSION, STARTER_TILE, TILES, weightsFor, type Rot } from "./tiles";

export interface Move {
  x: number;
  y: number;
  rot: Rot;
}

const weightCache = new Map<number, { weights: number[]; total: number }>();

function weightTable(version: number): { weights: number[]; total: number } {
  let table = weightCache.get(version);
  if (!table) {
    const weights = weightsFor(version);
    table = { weights, total: weights.reduce((a, b) => a + b, 0) };
    weightCache.set(version, table);
  }
  return table;
}

export function tileForStep(seed: number, step: number, version = RULES_VERSION): number {
  const { weights, total } = weightTable(version);
  let r = mulberry32(hash(seed, step))() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return TILES[i].id;
  }
  return TILES.length - 1;
}

export class Game {
  readonly board = new Board();
  readonly moves: Move[] = [];
  score = 0;

  constructor(
    readonly seed: number,
    readonly version = RULES_VERSION,
  ) {
    this.board.place(STARTER_TILE, 0, 0, 0);
  }

  static replay(seed: number, moves: readonly Move[], version = RULES_VERSION): Game {
    const g = new Game(seed, version);
    for (const m of moves) g.place(m.x, m.y, m.rot);
    return g;
  }

  get step(): number {
    return this.moves.length;
  }

  get currentTile(): number {
    return tileForStep(this.seed, this.step, this.version);
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
