import { DIRS, DX, DY, TILES, edgeOf, type Dir, type Edge, type Rot, type TileDef } from "./tiles";

export interface Placed {
  tile: TileDef;
  rot: Rot;
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function cellKey(x: number, y: number): number {
  return (x + 0x8000) * 0x10000 + (y + 0x8000);
}

export class Board {
  private readonly cells = new Map<number, Placed>();
  private bounds: Bounds | null = null;

  clone(): Board {
    const copy = new Board();
    for (const [k, v] of this.cells) copy.cells.set(k, v);
    copy.bounds = this.bounds && { ...this.bounds };
    return copy;
  }

  get size(): number {
    return this.cells.size;
  }

  get(x: number, y: number): Placed | undefined {
    return this.cells.get(cellKey(x, y));
  }

  has(x: number, y: number): boolean {
    return this.cells.has(cellKey(x, y));
  }

  all(): IterableIterator<Placed> {
    return this.cells.values();
  }

  getBounds(): Bounds | null {
    return this.bounds && { ...this.bounds };
  }

  canPlace(x: number, y: number): boolean {
    if (this.has(x, y)) return false;
    if (this.cells.size === 0) return true;
    return DIRS.some((d) => this.has(x + DX[d], y + DY[d]));
  }

  place(tileId: number, rot: Rot, x: number, y: number): Placed {
    if (!this.canPlace(x, y)) throw new Error(`cannot place at ${x},${y}`);
    const tile = TILES[tileId];
    if (!tile) throw new Error(`unknown tile id ${tileId}`);
    const placed: Placed = { tile, rot, x, y };
    this.cells.set(cellKey(x, y), placed);
    const b = this.bounds;
    this.bounds = b
      ? { minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y) }
      : { minX: x, maxX: x, minY: y, maxY: y };
    return placed;
  }

  edgeAt(x: number, y: number, dir: Dir): Edge | undefined {
    const p = this.get(x, y);
    return p && edgeOf(p.tile, p.rot, dir);
  }

  frontier(): { x: number; y: number }[] {
    if (this.cells.size === 0) return [{ x: 0, y: 0 }];
    const seen = new Set<number>();
    const out: { x: number; y: number }[] = [];
    for (const p of this.cells.values()) {
      for (const d of DIRS) {
        const nx = p.x + DX[d], ny = p.y + DY[d];
        const k = cellKey(nx, ny);
        if (seen.has(k) || this.cells.has(k)) continue;
        seen.add(k);
        out.push({ x: nx, y: ny });
      }
    }
    return out;
  }
}
