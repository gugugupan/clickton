import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { cheerTier, closedRegionsAt, matchedEdges } from "../src/core/cheer";
import { tileByKey, type Rot } from "../src/core/tiles";

function board(spec: [string, Rot, number, number][]): Board {
  const b = new Board();
  for (const [key, rot, x, y] of spec) b.place(tileByKey(key).id, rot, x, y);
  return b;
}

const none = { questsDone: 0, loopsClosed: 0, linesClosed: 0, opened: 0 };

describe("celebration tiers", () => {
  it("lists only the edges that match a neighbour", () => {
    const b = board([["grass", 0, 0, 0], ["city_edge", 0, 1, 0], ["grass", 0, -1, 0]]);
    expect(matchedEdges(b, tileByKey("grass"), 0, 0, 0)).toEqual([null, "grass", null, "grass"]);
  });

  it("finds a region closed by the placed tile", () => {
    const open = board([["city_edge", 2, 0, 0]]);
    expect(closedRegionsAt(open, 0, 0)).toEqual([]);
    const closed = board([["city_edge", 2, 0, 0], ["city_edge", 0, 0, 1]]);
    expect(closedRegionsAt(closed, 0, 1)).toEqual([2]);
  });

  it("picks the highest tier", () => {
    expect(cheerTier(none, [])).toBe(0);
    expect(cheerTier({ ...none, opened: 1 }, [])).toBe(2);
    expect(cheerTier(none, [3])).toBe(2);
    expect(cheerTier(none, [6])).toBe(3);
    expect(cheerTier({ ...none, loopsClosed: 1, opened: 2 }, [])).toBe(3);
    expect(cheerTier({ ...none, questsDone: 1, loopsClosed: 1 }, [8])).toBe(4);
  });
});
