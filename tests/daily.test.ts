import { describe, expect, it } from "vitest";
import { decodeCity, encodeCity } from "../src/core/codec";
import { CHALLENGE_TILES, dayLabel, seedForDay, todayNumber } from "../src/core/daily";
import { Game } from "../src/core/game";

describe("daily challenge", () => {
  it("the day turns over at midnight Japan time", () => {
    const beforeMidnightJst = Date.UTC(2026, 9, 1, 14, 59);
    const afterMidnightJst = Date.UTC(2026, 9, 1, 15, 1);
    expect(dayLabel(todayNumber(beforeMidnightJst))).toBe("2026-10-01");
    expect(dayLabel(todayNumber(afterMidnightJst))).toBe("2026-10-02");
  });

  it("everyone gets the same tiles on the same day", () => {
    const day = todayNumber(Date.UTC(2026, 9, 2, 3));
    const a = Game.daily(day), b = Game.daily(day);
    expect(a.seed).toBe(seedForDay(day));
    expect([a.currentTile, a.nextTile]).toEqual([b.currentTile, b.nextTile]);
    expect(Game.daily(day + 1).seed).not.toBe(a.seed);
  });

  it("ends after the tile limit and the link remembers the day", async () => {
    const day = 20730;
    const g = Game.daily(day);
    while (!g.finished) {
      const c = g.board.frontier()[0];
      g.place(c.x, c.y, 0);
    }
    expect(g.placements).toBe(CHALLENGE_TILES);
    expect(() => g.place(g.board.frontier()[0].x, g.board.frontier()[0].y, 0)).toThrow();
    const back = await decodeCity(await encodeCity({ version: g.linkVersion, seed: g.seed, moves: g.moves, day: g.day }));
    expect(back.day).toBe(day);
    const r = Game.replay(back.seed, back.moves, back.version, back.day);
    expect(r.challenge).toBe(true);
    expect(r.finished).toBe(true);
    expect(r.score).toBe(g.score);
  });
});
