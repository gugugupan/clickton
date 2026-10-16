import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { Game } from "../src/core/game";
import { completedRailLines, completedRoadNetworks, edgeRegions } from "../src/core/networks";
import { STARTER_TOWNS, starterTown } from "../src/core/starters";
import { THEMES } from "../src/core/themes";
import { DIRS, DX, DY, TILES, edgeOf, opposite } from "../src/core/tiles";

function build(theme: string, turn: number): Board {
  const b = new Board();
  for (const p of starterTown(theme, turn)) b.place(p.tile, p.rot, p.x, p.y);
  return b;
}

describe("starter towns", () => {
  it("has a layout for every theme", () => {
    for (const t of THEMES) expect(STARTER_TOWNS[t.key], t.key).toHaveLength(9);
  });

  for (const t of THEMES) {
    for (let turn = 0; turn < 4; turn++) {
      it(`${t.key} turned ${turn} fits together and leads outside`, () => {
        const b = build(t.key, turn);
        expect([...b.all()]).toHaveLength(9);
        let exits = 0;
        for (const p of b.all()) {
          for (const d of DIRS) {
            const mine = edgeOf(p.tile, p.rot, d);
            const theirs = b.edgeAt(p.x + DX[d], p.y + DY[d], opposite(d));
            if (theirs !== undefined) expect(theirs, `${p.tile.key}@${p.x},${p.y} dir ${d}`).toBe(mine);
            else if (mine === "road" || mine === "rail" || mine === "water") exits++;
          }
        }
        expect(exits).toBeGreaterThan(0);
        expect(completedRoadNetworks(b)).toHaveLength(0);
        expect(completedRailLines(b)).toHaveLength(0);
        expect(edgeRegions(b, "city").filter((r) => r.closed)).toHaveLength(0);
      });
    }
  }

  it("uses only known tiles", () => {
    for (const specs of Object.values(STARTER_TOWNS)) for (const [key] of specs) expect(TILES.some((x) => x.key === key), key).toBe(true);
  });

  it("size quests start from the starter town, not from zero", () => {
    for (let seed = 1; seed < 400; seed++) {
      const g = new Game(seed);
      for (const q of g.quests) {
        const type = ({ city_size: "city", road_size: "road", forest_size: "forest" } as const)[q.kind as "city_size"];
        if (!type) continue;
        const now = Math.max(0, ...edgeRegions(g.board, type).map((r) => r.cells.length));
        expect(q.target - now, `${g.mood!.theme.key} ${q.kind}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

