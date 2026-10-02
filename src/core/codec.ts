import type { Move } from "./game";
import { moodFor, THEMES } from "./themes";
import { RULES_VERSION, TILES, baseWeights, isKnownVersion, type Rot } from "./tiles";

export const CODEC_VERSION = RULES_VERSION;

export const TILESET_FINGERPRINTS: Record<number, string> = {
  1: "e1ff7eb5",
  2: "550aafc3",
  3: "7eafaf96",
};

export function tilesetFingerprint(version = CODEC_VERSION): string {
  const weights = baseWeights(version);
  const tiles = TILES.filter((_, i) => weights[i] > 0)
    .map((t) => `${t.key}:${weights[t.id]}:${t.edges.join(",")}`)
    .join("|");
  const text = version >= 3 ? `${tiles}#${JSON.stringify(THEMES)}#${moodFor(1).jitter.city.toFixed(6)}` : tiles;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export interface SavedCity {
  version: number;
  seed: number;
  moves: Move[];
}

const zigzag = (n: number) => (n << 1) ^ (n >> 31);
const unzigzag = (n: number) => (n >>> 1) ^ -(n & 1);

function writeVarint(out: number[], n: number): void {
  n >>>= 0;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}

class Reader {
  private i = 0;
  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.i >= this.bytes.length;
  }

  byte(): number {
    if (this.i >= this.bytes.length) throw new Error("unexpected end of data");
    return this.bytes[this.i++];
  }

  varint(): number {
    let n = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const b = this.byte();
      n |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return n >>> 0;
    }
    throw new Error("varint too long");
  }
}

export function packCity(city: SavedCity): Uint8Array {
  const out: number[] = [city.version];
  const s = city.seed >>> 0;
  out.push(s & 0xff, (s >>> 8) & 0xff, (s >>> 16) & 0xff, (s >>> 24) & 0xff);
  writeVarint(out, city.moves.length);
  let px = 0, py = 0;
  for (const m of city.moves) {
    writeVarint(out, (zigzag(m.x - px) << 2) | m.rot);
    writeVarint(out, zigzag(m.y - py));
    px = m.x;
    py = m.y;
  }
  return Uint8Array.from(out);
}

export function unpackCity(bytes: Uint8Array): SavedCity {
  const r = new Reader(bytes);
  const version = r.byte();
  if (!isKnownVersion(version)) throw new Error(`unsupported version ${version}`);
  const seed = (r.byte() | (r.byte() << 8) | (r.byte() << 16) | (r.byte() << 24)) >>> 0;
  const count = r.varint();
  const moves: Move[] = [];
  let px = 0, py = 0;
  for (let i = 0; i < count; i++) {
    const a = r.varint();
    const x = px + unzigzag(a >>> 2);
    const y = py + unzigzag(r.varint());
    moves.push({ x, y, rot: (a & 3) as Rot });
    px = x;
    py = y;
  }
  if (!r.done) throw new Error("trailing data");
  return { version, seed, moves };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function encodeCity(city: SavedCity): Promise<string> {
  return toBase64Url(await pipe(packCity(city), new CompressionStream("deflate-raw")));
}

export async function decodeCity(text: string): Promise<SavedCity> {
  return unpackCity(await pipe(fromBase64Url(text), new DecompressionStream("deflate-raw")));
}
