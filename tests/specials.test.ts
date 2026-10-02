import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { specialStatus } from "../src/core/specials";
import { tileByKey, type Rot } from "../src/core/tiles";

function board(spec: [string, Rot, number, number][]): Board {
  const b = new Board();
  for (const [key, rot, x, y] of spec) b.place(tileByKey(key).id, rot, x, y);
  return b;
}

describe("special tiles", () => {
  it("a zoo opens once its road joins a finished road network", () => {
    const open = board([["zoo", 0, 0, 0], ["road_straight", 0, 0, 1]]);
    expect(specialStatus(open, open.get(0, 0)!).active).toBe(false);
    const done = board([["zoo", 0, 0, 0], ["road_straight", 0, 0, 1], ["house_road", 2, 0, 2]]);
    expect(specialStatus(done, done.get(0, 0)!).active).toBe(true);
  });

  it("a police station patrols only a finished network", () => {
    const b = board([["police", 0, 0, 0], ["road_end", 0, 0, 1]]);
    expect(specialStatus(b, b.get(0, 0)!).active).toBe(true);
  });

  it("a farm needs two neighbouring meadows and grows with more", () => {
    const one = board([["farm", 0, 0, 0], ["grass", 0, 1, 0]]);
    expect(specialStatus(one, one.get(0, 0)!).active).toBe(false);
    const three = board([["farm", 0, 0, 0], ["grass", 0, 1, 0], ["grass", 0, -1, 0], ["city_full", 0, 0, 1]]);
    expect(specialStatus(three, three.get(0, 0)!)).toEqual({ active: true, count: 2 });
  });

  it("a beach needs a lake or river next to it", () => {
    const dry = board([["beach", 0, 0, 0], ["grass", 0, 1, 0]]);
    expect(specialStatus(dry, dry.get(0, 0)!).active).toBe(false);
    const wet = board([["beach", 0, 0, 0], ["pool", 0, 1, 0]]);
    expect(specialStatus(wet, wet.get(0, 0)!).active).toBe(true);
  });
});

describe("meadows", () => {
  it("only grass and water tiles count as meadows", async () => {
    const { isMeadow } = await import("../src/core/networks");
    const b = board([["grass", 0, 0, 0], ["road_end", 0, 1, 0], ["city_edge", 0, 2, 0], ["pool", 0, 3, 0], ["lake", 0, 4, 0]]);
    expect([0, 1, 2, 3, 4].map((x) => isMeadow(b.get(x, 0)!))).toEqual([true, false, false, true, true]);
  });
});
