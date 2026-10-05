import { LANDMARK_EMOJI, landmarkTile } from "../core/landmarks";
import { questDef, type Quest, type QuestKind } from "../core/quests";
import { TILES, tileByKey, type Rot } from "../core/tiles";
import { t } from "../i18n";
import type { Look } from "../render/looks";
import { drawTilePreview } from "./tilePreview";

type Cell = [string, Rot] | null;

const EXAMPLES: Record<QuestKind, Cell[][]> = {
  road_closed: [[["road_end", 1], ["road_straight", 1], ["road_end", 3]]],
  rail_done: [[["station", 1], ["rail_straight", 1], ["station", 3]]],
  park: [
    [null, ["city_full", 0], null],
    [["city_full", 0], ["grass", 0], ["city_full", 0]],
    [null, ["grass", 0], null],
  ],
  city_closed: [
    [["city_corner", 1], ["city_corner", 2]],
    [["city_corner", 0], ["city_corner", 3]],
  ],
  river_lake: [[["river_straight", 1], ["river_straight", 1], ["lake", 3]]],
  bridge: [
    [null, ["river_straight", 0], null],
    [["road_end", 1], ["road_bridge", 1], ["road_end", 3]],
    [null, ["river_straight", 0], null],
  ],
  special_on: [[["road_end", 1], ["zoo", 1]]],
  meadow_size: [
    [["grass", 0], ["grass", 0], ["pool", 0]],
    [["grass", 0], ["lake", 2], ["grass", 0]],
  ],
  city_size: [
    [["city_edge", 1], ["city_full", 0], ["city_edge", 3]],
    [["city_edge", 1], ["city_full", 0], null],
  ],
  road_size: [
    [["road_straight", 1], ["road_t", 1], ["road_straight", 1]],
    [null, ["road_curve", 0], ["road_end", 3]],
  ],
  forest: [[["grass", 0], ["grass", 0], ["grass", 0]]],
  forest_size: [
    [["forest_edge", 1], ["forest_full", 0], ["forest_edge", 3]],
    [null, ["forest_edge", 0], null],
  ],
  clean_streak: [[["road_straight", 1], ["road_straight", 1], ["road_curve", 2]]],
  big_hand: [
    [null, ["city_edge", 2], null],
    [["city_edge", 1], ["city_full", 0], ["city_edge", 3]],
    [null, ["city_edge", 0], null],
  ],
};

const $ = (id: string) => document.getElementById(id)!;

export function openQuestDetail(q: Quest, look: Look): void {
  const def = questDef(q.kind);
  const lmTile = TILES[landmarkTile(def.landmark)];
  $("qd-title").textContent = t(`quest_${q.kind}` as Parameters<typeof t>[0], q.target);
  $("qd-count").textContent = `${Math.min(q.progress, q.target)} / ${q.target}`;
  ($("qd-fill") as HTMLElement).style.width = `${Math.min(100, (q.progress / q.target) * 100)}%`;
  $("qd-how").textContent = t(`how_${q.kind}` as Parameters<typeof t>[0], q.target);
  $("qd-reward-icon").textContent = LANDMARK_EMOJI[def.landmark];
  $("qd-reward-name").textContent = `${t(`tile_${lmTile.key}` as Parameters<typeof t>[0])} + ${t("questSkip")}`;
  $("qd-reward-bonus").textContent = t(`bonus_${def.landmark}` as Parameters<typeof t>[0]);
  const grid = $("qd-example");
  const rows = EXAMPLES[q.kind];
  grid.style.gridTemplateColumns = `repeat(${Math.max(...rows.map((r) => r.length))}, 48px)`;
  grid.replaceChildren();
  $("quest-detail").classList.add("open");
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) {
        grid.append(document.createElement("span"));
        continue;
      }
      const canvas = document.createElement("canvas");
      canvas.title = t(`tile_${cell[0]}` as Parameters<typeof t>[0]);
      grid.append(canvas);
      drawTilePreview(canvas, tileByKey(cell[0]), cell[1], look);
    }
  }
}

export function closeQuestDetail(): void {
  $("quest-detail").classList.remove("open");
}
