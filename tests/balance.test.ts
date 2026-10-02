import { describe, expect, it } from "vitest";
import { balancedWeights, openRoadEnds } from "../src/core/balance";
import { Board } from "../src/core/board";
import { CODEC_VERSION, decodeCity, encodeCity } from "../src/core/codec";
import { DISCARD_EVERY, Game } from "../src/core/game";
import { TILES, tileByKey } from "../src/core/tiles";

const id = (k: string) => tileByKey(k).id;

describe("road balance", () => {
  it("open road ends push dead ends up and junctions down", () => {
    const b = new Board();
    b.place(id("road_cross"), 0, 0, 0);
    b.place(id("road_cross"), 0, 1, 0);
    expect(openRoadEnds(b)).toBe(6);
    const base = TILES.map(() => 1);
    const w = balancedWeights(TILES, base, b);
    expect(w[id("road_end")]).toBeGreaterThan(1.9);
    expect(w[id("house_road")]).toBeGreaterThan(1.9);
    expect(w[id("road_cross")]).toBeLessThan(0.55);
    expect(w[id("grass")]).toBe(1);
  });

  it("no open road ends means no adjustment", () => {
    const b = new Board();
    b.place(id("grass"), 0, 0, 0);
    expect(balancedWeights(TILES, TILES.map(() => 2), b)).toEqual(TILES.map(() => 2));
  });
});

describe("next tile and discards", () => {
  function playN(g: Game, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = g.board.frontier()[0];
      g.place(c.x, c.y, 0);
    }
  }

  it("the announced next tile is the one you get", () => {
    const g = new Game(9);
    for (let i = 0; i < 30; i++) {
      const next = g.nextTile;
      const c = g.board.frontier()[0];
      g.place(c.x, c.y, 0);
      expect(g.currentTile).toBe(next);
    }
  });

  it("one discard per ten placements, stored at most once", () => {
    const g = new Game(3);
    expect(g.discardsAvailable).toBe(0);
    expect(() => g.discard()).toThrow();
    playN(g, DISCARD_EVERY - 1);
    expect(g.discardsAvailable).toBe(0);
    playN(g, 1);
    expect(g.discardsAvailable).toBe(1);
    playN(g, DISCARD_EVERY);
    expect(g.discardsAvailable).toBe(1);
    const next = g.nextTile;
    g.discard();
    expect(g.discardsAvailable).toBe(0);
    expect(g.currentTile).toBe(next);
    expect(g.discardProgress).toBe(0);
  });

  it("links with discards replay to the same town", async () => {
    const g = new Game(21);
    playN(g, 12);
    g.discard();
    playN(g, 5);
    const city = { version: CODEC_VERSION, seed: g.seed, moves: g.moves };
    const back = await decodeCity(await encodeCity(city));
    expect(back.moves).toEqual(g.moves);
    const r = Game.replay(back.seed, back.moves, back.version);
    expect(r.score).toBe(g.score);
    expect(r.board.size).toBe(g.board.size);
    expect(r.currentTile).toBe(g.currentTile);
    expect(r.nextTile).toBe(g.nextTile);
  });
});

describe("showcase towns", () => {
  it("links can carry hand-picked tiles and replay exactly", async () => {
    const { EXPLICIT_FLAG } = await import("../src/core/game");
    const g = new Game(5, CODEC_VERSION | EXPLICIT_FLAG);
    expect(g.board.size).toBe(0);
    g.placeTile(id("city_full"), 0, 0, 0);
    g.placeTile(id("city_edge"), 0, 1, 0);
    g.placeTile(id("road_end"), 1, 0, 3);
    expect(() => g.placeTile(id("grass"), 5, 5, 0)).toThrow();
    const city = { version: g.linkVersion, seed: g.seed, moves: g.moves };
    const back = await decodeCity(await encodeCity(city));
    const r = Game.replay(back.seed, back.moves, back.version);
    expect(r.explicit).toBe(true);
    expect(r.board.get(0, 1)?.tile.key).toBe("city_edge");
    expect(r.board.get(1, 0)?.tile.key).toBe("road_end");
    expect(r.score).toBe(g.score);
  });
});
