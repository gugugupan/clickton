import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { decodeCity, encodeCity } from "../src/core/codec";
import { CHALLENGE_FLAG, Game, INVENTORY_MAX, QUEST_DISCARD_MAX, type Move } from "../src/core/game";
import { LANDMARKS, landmarkTile } from "../src/core/landmarks";
import { isPark } from "../src/core/networks";
import { BIAS_MAX, BIAS_RAMP, QUESTS, QUEST_SLOTS, advanceQuest, issueQuest, questBias, type Quest } from "../src/core/quests";
import { scorePlacement } from "../src/core/scoring";
import { TILES, tileByKey, type Rot } from "../src/core/tiles";

const id = (k: string) => tileByKey(k).id;
const score = (b: Board, key: string, x: number, y: number, rot: Rot = 0) => scorePlacement(b, id(key), rot, x, y);

function greedy(g: Game): void {
  const cells = g.board.frontier().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 8);
  let best = { x: cells[0].x, y: cells[0].y, rot: 0 as Rot, total: -Infinity };
  for (const c of cells) {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const s = g.preview(c.x, c.y, rot)!.total;
      if (s > best.total) best = { ...c, rot, total: s };
    }
  }
  g.place(best.x, best.y, best.rot);
}

describe("landmark tiles", () => {
  it("every landmark has exactly one tile, never drawn at random", () => {
    for (const l of LANDMARKS) {
      expect(TILES.filter((t) => t.landmark === l)).toHaveLength(1);
      expect(TILES[landmarkTile(l)].weight).toBe(0);
    }
  });

  it("every quest rewards a different landmark", () => {
    const rewards = Object.values(QUESTS).map((q) => q.landmark);
    expect(new Set(rewards).size).toBe(rewards.length);
    expect(rewards.length).toBeGreaterThanOrEqual(10);
  });

  it("a windmill scores its meadows", () => {
    const b = new Board();
    b.place(id("grass"), 0, 0, 0);
    b.place(id("grass"), 0, 0, 1);
    b.place(id("pool"), 0, 1, 1);
    const s = scorePlacement(b, landmarkTile("windmill"), 0, 1, 0);
    expect(s.landmarkPoints).toBe(3);
    expect(s.total).toBe(s.edgePoints + 3);
  });
});

describe("quest checks", () => {
  it("a park is grass ringed by town on three sides", () => {
    const b = new Board();
    b.place(id("grass"), 0, 0, 0);
    b.place(id("city_full"), 0, 0, -1);
    b.place(id("city_full"), 0, 1, 0);
    b.place(id("city_full"), 0, -1, 0);
    expect(isPark(b, b.get(0, 0)!)).toBe(false);
    b.place(id("grass"), 0, 0, 1);
    expect(isPark(b, b.get(0, 0)!)).toBe(true);
  });

  it("only roads closed after the quest starts count", () => {
    const b = new Board();
    b.place(id("road_end"), 2, 0, 0);
    b.place(id("road_end"), 0, 0, 1);
    const q: Quest = { ...issueQuest(1, 0, b, [], {}), kind: "road_closed", target: 3, progress: 0, since: 0, seen: new Set(["road:0,0:2"]) };
    advanceQuest(q, b, { tile: TILES[id("grass")], score: score(b, "grass", 5, 5) });
    expect(q.progress).toBe(0);
    const c = new Board();
    c.place(id("road_end"), 1, 0, 0);
    c.place(id("road_straight"), 1, 1, 0);
    c.place(id("road_end"), 3, 2, 0);
    advanceQuest(q, c, { tile: TILES[id("road_end")], score: score(b, "grass", 5, 5) });
    expect(q.progress).toBe(3);
  });

  it("size quests always ask for more than the town already has", () => {
    const b = new Board();
    for (let x = 0; x < 9; x++) b.place(id("grass"), 0, x, 0);
    const active: Quest[] = [];
    for (let serial = 0; serial < 40; serial++) {
      const q = issueQuest(7, serial, b, active, {});
      if (q.kind === "meadow_size") expect(q.target).toBeGreaterThanOrEqual(9 + QUESTS.meadow_size.lead!);
    }
  });

  it("quest bias boosts the tiles a quest needs, more the longer it waits, capped", () => {
    const q = { kind: "road_closed", since: 10 } as Quest;
    const fresh = questBias(TILES, TILES.map(() => 1), [q], 10);
    const stale = questBias(TILES, TILES.map(() => 1), [q], 10 + BIAS_RAMP);
    expect(fresh[id("road_end")]).toBe(QUESTS.road_closed.bias.road_end);
    expect(stale[id("road_end")]).toBe(QUESTS.road_closed.bias.road_end ** 2);
    expect(fresh[id("grass")]).toBe(1);
    const s = { kind: "special_on", since: 0 } as Quest;
    expect(questBias(TILES, TILES.map(() => 1), [s], BIAS_RAMP)[id("zoo")]).toBe(BIAS_MAX);
  });
});

describe("quests in a town", () => {
  it("towns get three different quests, daily challenges and old towns none", () => {
    const g = new Game(11);
    expect(g.quests).toHaveLength(QUEST_SLOTS);
    expect(new Set(g.quests.map((q) => q.kind)).size).toBe(QUEST_SLOTS);
    expect(Game.daily(20000).quests).toHaveLength(0);
    expect(new Game(11, 7).quests).toHaveLength(0);
    expect(new Game(11, 8 | CHALLENGE_FLAG).discardMax).toBe(1);
  });

  it("finished quests pay a skip and a landmark, then the next tile once the shelf is full", () => {
    const g = new Game(4);
    let rewards = 0;
    for (let i = 0; i < 400 && rewards <= INVENTORY_MAX; i++) {
      const before = g.discardsAvailable;
      greedy(g);
      for (const done of g.lastDone) {
        rewards++;
        if (!done.stored) expect(g.currentTile).toBe(done.landmark);
      }
      if (g.lastDone.length) expect(g.discardsAvailable).toBe(Math.min(QUEST_DISCARD_MAX, before + g.lastDone.length + (g.placements % 10 === 0 ? 1 : 0)));
      expect(g.quests).toHaveLength(QUEST_SLOTS);
    }
    expect(rewards).toBeGreaterThan(INVENTORY_MAX);
    expect(g.inventory).toHaveLength(INVENTORY_MAX);
  });

  it("stored landmarks can be placed later and links replay them", async () => {
    const g = new Game(4);
    while (g.inventory.length === 0) greedy(g);
    const current = g.currentTile, next = g.nextTile;
    const lm = g.inventory[0];
    const c = g.board.frontier()[0];
    g.placeLandmark(lm, c.x, c.y, 1);
    expect(g.board.get(c.x, c.y)?.tile.id).toBe(lm);
    expect(g.currentTile).toBe(current);
    expect(g.nextTile).toBe(next);
    expect(() => g.placeLandmark(lm, c.x + 50, c.y, 0)).toThrow();
    for (let i = 0; i < 20; i++) greedy(g);
    if (g.discardsAvailable > 0) g.discard();
    greedy(g);

    const back = await decodeCity(await encodeCity({ version: g.linkVersion, seed: g.seed, moves: g.moves }));
    expect(back.moves).toEqual(g.moves as Move[]);
    const r = Game.replay(back.seed, back.moves, back.version);
    expect(r.score).toBe(g.score);
    expect(r.inventory).toEqual(g.inventory);
    expect(r.quests.map((q) => [q.kind, q.target, q.progress])).toEqual(g.quests.map((q) => [q.kind, q.target, q.progress]));
    expect(r.currentTile).toBe(g.currentTile);
    expect(r.nextTile).toBe(g.nextTile);
  });
});

describe("rules v9 forest quest", () => {
  it("v8 keeps the grass-counting quest, v9 asks for a real forest", async () => {
    const { questKinds } = await import("../src/core/quests");
    expect(questKinds(8)).toContain("forest");
    expect(questKinds(8)).not.toContain("forest_size");
    expect(questKinds(9)).toContain("forest_size");
    expect(questKinds(9)).not.toContain("forest");
    expect(questKinds(9).length).toBe(questKinds(8).length);
  });

  it("forest_size tracks the biggest forest", async () => {
    const { issueQuest, advanceQuest } = await import("../src/core/quests");
    const { scorePlacement } = await import("../src/core/scoring");
    const b = new Board();
    const q = { ...issueQuest(1, 0, b, [], {}), kind: "forest_size" as const, target: 3, progress: 0 };
    const put = (key: string, rot: 0 | 1 | 2 | 3, x: number, y: number) => {
      const score = scorePlacement(b, id(key), rot, x, y);
      b.place(id(key), rot, x, y);
      advanceQuest(q, b, { tile: tileByKey(key), score });
    };
    put("forest_edge", 1, 0, 0);
    put("forest_full", 0, 1, 0);
    expect(q.progress).toBe(2);
    put("forest_edge", 3, 2, 0);
    expect(q.progress).toBe(3);
  });
});
