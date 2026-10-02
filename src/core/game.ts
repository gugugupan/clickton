import { Board, type Placed } from "./board";
import { hash, mulberry32 } from "./rng";
import { scorePlacement, type PlacementScore } from "./scoring";
import { balancedWeights } from "./balance";
import { moodFor, type WorldMood } from "./themes";
import { RULES_VERSION, STARTER_TILE, TILES, weightsFor, type Rot } from "./tiles";

export interface Move {
  x: number;
  y: number;
  rot: Rot;
  skip?: boolean;
  tile?: number;
}

export const EXPLICIT_FLAG = 0x80;

export const DISCARD_EVERY = 10;
export const DISCARD_MAX = 1;
const QUEUE_VERSION = 5;

const weightCache = new Map<string, { weights: number[]; total: number }>();

function weightTable(version: number, seed: number): { weights: number[]; total: number } {
  const key = version >= 3 ? `${version}:${seed}` : String(version);
  let table = weightCache.get(key);
  if (!table) {
    const weights = weightsFor(version, seed);
    table = { weights, total: weights.reduce((a, b) => a + b, 0) };
    if (weightCache.size > 64) weightCache.clear();
    weightCache.set(key, table);
  }
  return table;
}

export function tileForStep(seed: number, step: number, version = RULES_VERSION, board?: Board): number {
  let { weights, total } = weightTable(version, seed);
  if (board && version >= QUEUE_VERSION) {
    weights = balancedWeights(TILES, weights, board);
    total = weights.reduce((a, b) => a + b, 0);
  }
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
  placements = 0;
  discards = 0;
  private readonly queue: number[] = [];
  private charges = 0;

  readonly explicit: boolean;
  readonly version: number;

  constructor(
    readonly seed: number,
    version = RULES_VERSION,
  ) {
    this.explicit = (version & EXPLICIT_FLAG) !== 0;
    this.version = version & ~EXPLICIT_FLAG;
    if (this.explicit) return;
    this.board.place(STARTER_TILE, 0, 0, 0);
    if (this.queued) this.queue.push(this.draw(0), this.draw(1));
  }

  get linkVersion(): number {
    return this.explicit ? this.version | EXPLICIT_FLAG : this.version;
  }

  static replay(seed: number, moves: readonly Move[], version = RULES_VERSION): Game {
    const g = new Game(seed, version);
    for (const m of moves) g.apply(m);
    return g;
  }

  restart(): Game {
    return new Game(this.seed, this.linkVersion);
  }

  apply(m: Move): Placed | null {
    if (m.skip) {
      this.discard();
      return null;
    }
    return m.tile !== undefined ? this.placeTile(m.tile, m.x, m.y, m.rot).placed : this.place(m.x, m.y, m.rot).placed;
  }

  placeTile(tileId: number, x: number, y: number, rot: Rot): { placed: Placed; score: PlacementScore } {
    if (!this.explicit) throw new Error("only showcase towns choose their own tiles");
    if (!this.board.canPlace(x, y)) throw new Error(`cannot place at ${x},${y}`);
    const score = scorePlacement(this.board, tileId, rot, x, y);
    const placed = this.board.place(tileId, rot, x, y);
    this.moves.push({ x, y, rot, tile: tileId });
    this.score += score.total;
    this.placements++;
    return { placed, score };
  }

  private get queued(): boolean {
    return this.version >= QUEUE_VERSION;
  }

  private draw(step: number): number {
    return tileForStep(this.seed, step, this.version, this.board);
  }

  get step(): number {
    return this.moves.length;
  }

  get mood(): WorldMood | null {
    return this.version >= 3 ? moodFor(this.seed) : null;
  }

  get currentTile(): number {
    if (this.explicit) return 0;
    return this.queued ? this.queue[this.step] : tileForStep(this.seed, this.step, this.version);
  }

  get nextTile(): number {
    if (this.explicit) return 0;
    return this.queued ? this.queue[this.step + 1] : tileForStep(this.seed, this.step + 1, this.version);
  }

  get discardsAvailable(): number {
    return this.charges;
  }

  get discardProgress(): number {
    return this.placements % DISCARD_EVERY;
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
    this.placements++;
    if (this.queued && this.placements % DISCARD_EVERY === 0) this.charges = Math.min(DISCARD_MAX, this.charges + 1);
    this.advance();
    return { placed, score };
  }

  discard(): void {
    if (this.discardsAvailable <= 0) throw new Error("no discard available");
    this.moves.push({ x: 0, y: 0, rot: 0, skip: true });
    this.discards++;
    this.charges--;
    this.advance();
  }

  private advance(): void {
    if (this.queued) this.queue.push(this.draw(this.step + 1));
  }
}
