import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { accessCell, crossingClosed, destinationsOf, findRoute, lineStations, pickRole, rolesAvailable, strollRoute } from "../src/core/routes";
import { completedRailLines } from "../src/core/networks";
import { tileByKey, type Rot } from "../src/core/tiles";

function board(spec: [string, Rot, number, number][]): Board {
  const b = new Board();
  for (const [key, rot, x, y] of spec) b.place(tileByKey(key).id, rot, x, y);
  return b;
}

describe("routes", () => {
  const town = board([
    ["house_road", 0, 0, 0],
    ["road_straight", 0, 0, 1],
    ["road_t", 3, 0, 2],
    ["road_straight", 1, 1, 2],
    ["city_road", 1, 2, 2],
    ["grass", 0, -1, 2],
    ["park", 0, 1, 1],
  ]);

  it("finds the road route between two cells", () => {
    const route = findRoute(town, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(route?.map((c) => `${c.x},${c.y}`)).toEqual(["0,0", "0,1", "0,2", "1,2", "2,2"]);
  });

  it("strolls along connected road without turning back", () => {
    const walk = strollRoute(town, { x: 0, y: 0 }, 6, () => 0);
    expect(walk[0]).toEqual({ x: 0, y: 0 });
    for (let i = 1; i < walk.length; i++) {
      expect(Math.abs(walk[i].x - walk[i - 1].x) + Math.abs(walk[i].y - walk[i - 1].y)).toBe(1);
      expect(findRoute(town, walk[i - 1], walk[i])).not.toBeNull();
    }
    expect(new Set(walk.map((c) => `${c.x},${c.y}`)).size).toBe(walk.length);
  });

  it("returns null when the target is off the network", () => {
    expect(findRoute(town, { x: 0, y: 0 }, { x: -1, y: 2 })).toBeNull();
  });

  it("reaches a roadless tile through a neighbouring road", () => {
    expect(accessCell(town, 1, 1)).not.toBeNull();
    expect(accessCell(town, 0, 1)).toEqual({ x: 0, y: 1 });
  });

  it("lists destinations and only the roles the town supports", () => {
    const dests = destinationsOf(town);
    expect(dests.filter((d) => d.errand === "shop").map((d) => `${d.x},${d.y}`)).toEqual(["2,2"]);
    expect(dests.some((d) => d.errand === "park")).toBe(true);
    expect(rolesAvailable(dests).sort()).toEqual(["commuter", "shopper", "stroller"]);
    expect(pickRole(0, [])).toBeNull();
    for (const roll of [0, 0.3, 0.6, 0.99]) expect(["commuter", "shopper", "stroller"]).toContain(pickRole(roll, dests));
  });

  it("lists the stations a rail line stops at", () => {
    const rail = board([
      ["station", 2, 0, 0],
      ["rail_straight", 0, 0, 1],
      ["station_through", 0, 0, 2],
      ["rail_straight", 0, 0, 3],
      ["station", 0, 0, 4],
    ]);
    const [line] = completedRailLines(rail);
    expect(line.loop).toBe(false);
    expect(lineStations(rail, line).map((c) => `${c.x},${c.y}`).sort()).toEqual(["0,0", "0,2", "0,4"]);
  });

  it("closes a crossing only while a train car is near", () => {
    expect(crossingClosed({ x: 3, y: 2 }, [{ x: 3.4, z: 2.3 }])).toBe(true);
    expect(crossingClosed({ x: 3, y: 2 }, [{ x: 4, z: 2 }, { x: 3, z: 3.1 }])).toBe(false);
  });
});

