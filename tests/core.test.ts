import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { decodeCity, encodeCity, packCity, unpackCity, CODEC_VERSION } from "../src/core/codec";
import { Game, tileForStep, type Move } from "../src/core/game";
import { hash, mulberry32 } from "../src/core/rng";
import { POINTS, countHoleCells, scorePlacement } from "../src/core/scoring";
import { DIRS, STARTER_TILE, TILES, edgeOf, groupsOf, tileByKey, type Rot } from "../src/core/tiles";

const id = (key: string) => tileByKey(key).id;

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("hash differs by argument order", () => {
    expect(hash(1, 2)).not.toBe(hash(2, 1));
  });
});

describe("tiles", () => {
  it("every non-grass edge belongs to exactly one group of the same type", () => {
    for (const t of TILES) {
      for (const d of DIRS) {
        const owners = t.groups.filter((g) => g.dirs.includes(d));
        if (t.edges[d] === "grass") expect(owners, `${t.key} dir ${d}`).toHaveLength(0);
        else {
          expect(owners, `${t.key} dir ${d}`).toHaveLength(1);
          expect(owners[0].type).toBe(t.edges[d]);
        }
      }
    }
  });

  it("rail groups are two-ended, or one-ended only on stations", () => {
    for (const t of TILES) {
      for (const g of t.groups.filter((g) => g.type === "rail")) {
        expect(g.dirs.length, t.key).toBe(t.station ? 1 : 2);
      }
    }
  });

  it("rotation turns edges clockwise", () => {
    const curve = tileByKey("road_curve");
    expect([0, 1, 2, 3].map((d) => edgeOf(curve, 1, d as Rot))).toEqual(["grass", "road", "road", "grass"]);
    expect(groupsOf(curve, 1)[0].dirs).toEqual([1, 2]);
    expect(groupsOf(curve, 3)[0].dirs).toEqual([3, 0]);
  });
});

describe("board", () => {
  it("first tile anywhere, then only adjacent empty cells", () => {
    const b = new Board();
    expect(b.canPlace(5, 5)).toBe(true);
    b.place(0, 0, 0, 0);
    expect(b.canPlace(0, 0)).toBe(false);
    expect(b.canPlace(1, 0)).toBe(true);
    expect(b.canPlace(1, 1)).toBe(false);
    expect(() => b.place(0, 0, 2, 2)).toThrow();
    expect(b.frontier()).toHaveLength(4);
  });
});

describe("scoring", () => {
  it("scores matched edges, city double, mismatches zero", () => {
    const b = new Board();
    b.place(id("road_straight"), 0, 0, 0);
    expect(scorePlacement(b, id("road_straight"), 0, 0, 1).edgePoints).toBe(POINTS.match);
    const miss = scorePlacement(b, id("grass"), 0, 0, 1);
    expect(miss.edgePoints).toBe(0);
    expect(miss.mismatches).toBe(1);

    const c = new Board();
    c.place(id("city_edge"), 2, 0, 0);
    expect(scorePlacement(c, id("city_edge"), 0, 0, 1).edgePoints).toBe(POINTS.cityMatch);
  });

  it("perfect bonus needs four matching neighbours", () => {
    const b = new Board();
    for (const [x, y] of [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]) {
      if (b.size === 0 || b.canPlace(x, y)) b.place(id("grass"), 0, x, y);
    }
    const s = scorePlacement(b, id("grass"), 0, 0, 0);
    expect(s.perfect).toBe(true);
    expect(s.total).toBe(4 * POINTS.match + POINTS.perfect + POINTS.hole * -1);
  });

  it("penalises enclosing an empty cell and refunds filling it", () => {
    const b = new Board();
    const ring: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]];
    for (const [x, y] of ring) b.place(id("grass"), 0, x, y);
    expect(countHoleCells(b)).toBe(0);
    const closing = scorePlacement(b, id("grass"), 0, 0, 1);
    expect(closing.holeCellsAfter).toBe(1);
    expect(closing.holePoints).toBe(POINTS.hole);
    b.place(id("grass"), 0, 0, 1);
    const filling = scorePlacement(b, id("grass"), 0, 1, 1);
    expect(filling.holePoints).toBe(-POINTS.hole);
  });
});

describe("game", () => {
  it("starts with the starter tile and draws deterministically", () => {
    const g = new Game(7);
    expect(g.board.get(0, 0)?.tile.id).toBe(STARTER_TILE);
    expect(tileForStep(7, 3)).toBe(tileForStep(7, 3));
    const kinds = new Set(Array.from({ length: 400 }, (_, i) => tileForStep(123, i)));
    expect(kinds.size).toBe(TILES.length);
  });

  it("replay reproduces board and score", () => {
    const g = playRandom(99, 200);
    const r = Game.replay(99, g.moves);
    expect(r.score).toBe(g.score);
    expect(r.board.size).toBe(g.board.size);
    for (const p of g.board.all()) {
      const q = r.board.get(p.x, p.y)!;
      expect([q.tile.id, q.rot]).toEqual([p.tile.id, p.rot]);
    }
  });
});

describe("codec", () => {
  it("round-trips through bytes and the URL string", async () => {
    const g = playRandom(0xdeadbeef, 120);
    const city = { version: CODEC_VERSION, seed: g.seed, moves: g.moves };
    expect(unpackCity(packCity(city))).toEqual(city);
    const text = await encodeCity(city);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeCity(text)).toEqual(city);
  });

  it("keeps a 500-tile city under 1.5 KB of URL", async () => {
    const g = playRandom(5, 500);
    const text = await encodeCity({ version: CODEC_VERSION, seed: g.seed, moves: g.moves });
    expect(text.length).toBeLessThan(1500);
  });

  it("rejects garbage and unknown versions", async () => {
    await expect(decodeCity("not-a-city")).rejects.toThrow();
    expect(() => unpackCity(Uint8Array.from([99, 0, 0, 0, 0, 0]))).toThrow(/version/);
    expect(() => unpackCity(Uint8Array.from([CODEC_VERSION, 0, 0, 0, 0, 3]))).toThrow();
  });
});

function playRandom(seed: number, n: number): Game {
  const g = new Game(seed);
  const rnd = mulberry32(seed ^ 0x5555);
  for (let i = 0; i < n; i++) {
    const f = g.board.frontier();
    const near = f.filter((c) => Math.abs(c.x) + Math.abs(c.y) < 4 + i / 10);
    const pool = near.length ? near : f;
    const c = pool[Math.floor(rnd() * pool.length)];
    const m: Move = { x: c.x, y: c.y, rot: Math.floor(rnd() * 4) as Rot };
    g.place(m.x, m.y, m.rot);
  }
  return g;
}

describe("share link compatibility", () => {
  it("the tile set matches what this codec version was released with", async () => {
    const { tilesetFingerprint, TILESET_FINGERPRINTS } = await import("../src/core/codec");
    expect(
      tilesetFingerprint(),
      "Tiles changed: bump CODEC_VERSION and record the new fingerprint so old share links keep their meaning",
    ).toBe(TILESET_FINGERPRINTS[CODEC_VERSION]);
  });
});
