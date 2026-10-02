import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { completedRailLines, grassExits, roadExits } from "../src/core/networks";
import { tileByKey, type Rot } from "../src/core/tiles";

function board(spec: [string, Rot, number, number][]): Board {
  const b = new Board();
  for (const [key, rot, x, y] of spec) b.place(tileByKey(key).id, rot, x, y);
  return b;
}

describe("rail lines", () => {
  it("station to station is a completed line, walked end to end", () => {
    const b = board([
      ["station", 2, 0, 0],
      ["rail_straight", 0, 0, 1],
      ["station", 0, 0, 2],
    ]);
    const lines = completedRailLines(b);
    expect(lines).toHaveLength(1);
    expect(lines[0].loop).toBe(false);
    expect(lines[0].steps.map((s) => [s.x, s.y, s.from, s.to])).toEqual([
      [0, 0, null, 2],
      [0, 1, 0, 2],
      [0, 2, 0, null],
    ]);
  });

  it("an open end means no train", () => {
    const b = board([
      ["station", 2, 0, 0],
      ["rail_straight", 0, 0, 1],
    ]);
    expect(completedRailLines(b)).toHaveLength(0);
  });

  it("rail meeting a road edge is not connected", () => {
    const b = board([
      ["station", 2, 0, 0],
      ["road_straight", 0, 0, 1],
    ]);
    expect(completedRailLines(b)).toHaveLength(0);
  });

  it("four bends make a loop", () => {
    const b = board([
      ["rail_curve", 1, 0, 0],
      ["rail_curve", 2, 1, 0],
      ["rail_curve", 3, 1, 1],
      ["rail_curve", 0, 0, 1],
    ]);
    const lines = completedRailLines(b);
    expect(lines).toHaveLength(1);
    expect(lines[0].loop).toBe(true);
    expect(lines[0].steps).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const cur = lines[0].steps[i], next = lines[0].steps[(i + 1) % 4];
      expect((cur.to! + 2) % 4).toBe(next.from);
    }
  });

  it("trains cross a level crossing", () => {
    const b = board([
      ["station", 2, 0, 0],
      ["level_crossing", 0, 0, 1],
      ["station", 0, 0, 2],
    ]);
    expect(completedRailLines(b)).toHaveLength(1);
  });
});

describe("roads and meadows", () => {
  it("road exits only where both sides are road", () => {
    const b = board([
      ["road_cross", 0, 0, 0],
      ["road_straight", 1, 1, 0],
      ["grass", 0, 0, 1],
    ]);
    expect(roadExits(b, 0, 0)).toEqual([1]);
    expect(roadExits(b, 1, 0)).toEqual([3]);
  });

  it("animals may wander into neighbouring meadows", () => {
    const b = board([
      ["grass", 0, 0, 0],
      ["grass", 0, 1, 0],
      ["city_full", 0, 0, 1],
    ]);
    expect(grassExits(b, 0, 0)).toEqual([1]);
  });
});

describe("rail completion bonus", () => {
  it("closing a loop pays per tile, plus each through station", async () => {
    const { scorePlacement, POINTS } = await import("../src/core/scoring");
    const b = board([
      ["rail_curve", 1, 0, 0],
      ["station_through", 1, 1, 0],
      ["rail_curve", 2, 2, 0],
      ["rail_curve", 3, 2, 1],
      ["rail_straight", 1, 1, 1],
    ]);
    const s = scorePlacement(b, tileByKey("rail_curve").id, 0, 0, 1);
    expect(s.loopsClosed).toBe(1);
    expect(s.railPoints).toBe(6 * POINTS.loopStep + POINTS.loopHalt);
  });

  it("short station hops get a train but no bonus; longer lines pay per tile", async () => {
    const { scorePlacement, POINTS } = await import("../src/core/scoring");
    const short = board([["station", 2, 0, 0]]);
    const hop = scorePlacement(short, tileByKey("station").id, 0, 0, 1);
    expect(hop.linesClosed).toBe(1);
    expect(hop.railPoints).toBe(0);

    const long = board([
      ["station", 2, 0, 0],
      ["rail_straight", 0, 0, 1],
    ]);
    const line = scorePlacement(long, tileByKey("station").id, 0, 0, 2);
    expect(line.railPoints).toBe(3 * POINTS.lineStep);
  });

  it("non-rail tiles never trigger the rail check", async () => {
    const { scorePlacement } = await import("../src/core/scoring");
    const b = board([["station", 2, 0, 0]]);
    expect(scorePlacement(b, tileByKey("grass").id, 0, 0, 1).railPoints).toBe(0);
  });
});
