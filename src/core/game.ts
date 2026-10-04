import { Board, type Placed } from "./board";
import { hash, mulberry32 } from "./rng";
import { scorePlacement, type PlacementScore } from "./scoring";
import { balancedWeights } from "./balance";
import { CHALLENGE_TILES, seedForDay } from "./daily";
import { moodFor, type WorldMood } from "./themes";
import { landmarkTile } from "./landmarks";
import { QUESTS, QUEST_SLOTS, advanceQuest, issueQuest, questBias, type Quest, type QuestKind } from "./quests";
import { RULES_VERSION, TILES, starterFor, weightsFor, type Rot } from "./tiles";

export interface Move {
  x: number;
  y: number;
  rot: Rot;
  skip?: boolean;
  tile?: number;
  landmark?: number;
}

export interface QuestDone {
  kind: QuestKind;
  landmark: number;
  stored: boolean;
}

export const EXPLICIT_FLAG = 0x80;
export const CHALLENGE_FLAG = 0x40;
export const VERSION_MASK = 0x3f;

export const DISCARD_EVERY = 10;
export const DISCARD_MAX = 1;
export const QUEST_DISCARD_MAX = 3;
export const INVENTORY_MAX = 3;
const QUEUE_VERSION = 5;
const QUEST_VERSION = 8;

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

export function tileForStep(
  seed: number,
  step: number,
  version = RULES_VERSION,
  board?: Board,
  quests: readonly Quest[] = [],
  placements = 0,
): number {
  let { weights, total } = weightTable(version, seed);
  if (board && version >= QUEUE_VERSION) {
    weights = balancedWeights(TILES, weights, board);
    if (quests.length) weights = questBias(TILES, weights, quests, placements);
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
  readonly quests: Quest[] = [];
  readonly inventory: number[] = [];
  questsDone = 0;
  lastDone: QuestDone[] = [];
  private readonly queue: number[] = [];
  private cursor = 0;
  private charges = 0;
  private questSerial = 0;
  private readonly tiers: Partial<Record<QuestKind, number>> = {};

  readonly explicit: boolean;
  readonly challenge: boolean;
  readonly version: number;

  constructor(
    readonly seed: number,
    version = RULES_VERSION,
    readonly day = 0,
  ) {
    this.explicit = (version & EXPLICIT_FLAG) !== 0;
    this.challenge = (version & CHALLENGE_FLAG) !== 0;
    this.version = version & VERSION_MASK;
    if (this.explicit) return;
    const starter = starterFor(this.version);
    this.board.place(starter.tile, starter.rot, 0, 0);
    if (this.questsOn) while (this.quests.length < QUEST_SLOTS) this.quests.push(this.issue());
    if (this.queued) this.advance();
  }

  get questsOn(): boolean {
    return this.version >= QUEST_VERSION && !this.challenge && !this.explicit;
  }

  get discardMax(): number {
    return this.questsOn ? QUEST_DISCARD_MAX : DISCARD_MAX;
  }

  private issue(): Quest {
    return issueQuest(this.seed, this.questSerial++, this.board, this.quests, this.tiers, this.placements);
  }

  get linkVersion(): number {
    return this.version | (this.explicit ? EXPLICIT_FLAG : 0) | (this.challenge ? CHALLENGE_FLAG : 0);
  }

  get finished(): boolean {
    return this.challenge && this.placements >= CHALLENGE_TILES;
  }

  get remaining(): number {
    return Math.max(0, CHALLENGE_TILES - this.placements);
  }

  static daily(day: number): Game {
    return new Game(seedForDay(day), RULES_VERSION | CHALLENGE_FLAG, day);
  }

  static replay(seed: number, moves: readonly Move[], version = RULES_VERSION, day = 0): Game {
    const g = new Game(seed, version, day);
    for (const m of moves) g.apply(m);
    return g;
  }

  restart(): Game {
    return new Game(this.seed, this.linkVersion, this.day);
  }

  apply(m: Move): Placed | null {
    if (m.skip) {
      this.discard();
      return null;
    }
    if (m.landmark !== undefined) return this.placeLandmark(m.landmark, m.x, m.y, m.rot).placed;
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
    return tileForStep(this.seed, step, this.version, this.board, this.quests, this.placements);
  }

  get step(): number {
    return this.moves.length;
  }

  get mood(): WorldMood | null {
    return this.version >= 3 ? moodFor(this.seed) : null;
  }

  get currentTile(): number {
    if (this.explicit) return 0;
    return this.queued ? this.queue[this.cursor] : tileForStep(this.seed, this.cursor, this.version);
  }

  get nextTile(): number {
    if (this.explicit) return 0;
    return this.queued ? this.queue[this.cursor + 1] : tileForStep(this.seed, this.cursor + 1, this.version);
  }

  get discardsAvailable(): number {
    return this.charges;
  }

  get discardProgress(): number {
    return this.placements % DISCARD_EVERY;
  }

  preview(x: number, y: number, rot: Rot, tileId = this.currentTile): PlacementScore | null {
    if (!this.board.canPlace(x, y)) return null;
    return scorePlacement(this.board, tileId, rot, x, y);
  }

  place(x: number, y: number, rot: Rot): { placed: Placed; score: PlacementScore } {
    if (this.finished) throw new Error("the daily challenge is over");
    const tileId = this.currentTile;
    if (!this.board.canPlace(x, y)) throw new Error(`cannot place at ${x},${y}`);
    const score = scorePlacement(this.board, tileId, rot, x, y);
    const placed = this.board.place(tileId, rot, x, y);
    this.moves.push({ x, y, rot });
    this.settle(placed, score);
    this.cursor++;
    this.advance();
    return { placed, score };
  }

  placeLandmark(tileId: number, x: number, y: number, rot: Rot): { placed: Placed; score: PlacementScore } {
    const slot = this.inventory.indexOf(tileId);
    if (slot < 0) throw new Error(`landmark ${tileId} is not in the inventory`);
    if (!this.board.canPlace(x, y)) throw new Error(`cannot place at ${x},${y}`);
    const score = scorePlacement(this.board, tileId, rot, x, y);
    const placed = this.board.place(tileId, rot, x, y);
    this.inventory.splice(slot, 1);
    this.moves.push({ x, y, rot, landmark: tileId });
    this.settle(placed, score);
    this.advance();
    return { placed, score };
  }

  private settle(placed: Placed, score: PlacementScore): void {
    this.score += score.total;
    this.placements++;
    if (this.queued && this.placements % DISCARD_EVERY === 0) this.charges = Math.min(this.discardMax, this.charges + 1);
    this.lastDone = [];
    if (!this.questsOn) return;
    let forced = 0;
    this.quests.forEach((q, i) => {
      advanceQuest(q, this.board, { tile: placed.tile, score });
      if (q.progress < q.target) return;
      this.tiers[q.kind] = (this.tiers[q.kind] ?? 0) + 1;
      this.questsDone++;
      this.charges = Math.min(this.discardMax, this.charges + 1);
      const landmark = landmarkTile(QUESTS[q.kind].landmark);
      const stored = this.inventory.length < INVENTORY_MAX;
      if (stored) this.inventory.push(landmark);
      else this.queue.splice(this.cursor + 1 + forced++, 0, landmark);
      this.lastDone.push({ kind: q.kind, landmark, stored });
      this.quests[i] = this.issue();
    });
  }

  discard(): void {
    if (this.discardsAvailable <= 0) throw new Error("no discard available");
    this.moves.push({ x: 0, y: 0, rot: 0, skip: true });
    this.discards++;
    this.charges--;
    this.cursor++;
    this.advance();
  }

  private advance(): void {
    if (!this.queued) return;
    while (this.queue.length < this.cursor + 2) this.queue.push(this.draw(this.queue.length));
  }
}
