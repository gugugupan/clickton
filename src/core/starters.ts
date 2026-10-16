import { hash } from "./rng";
import { tileByKey, type Rot } from "./tiles";

export const STARTER_TOWN_VERSION = 12;

type Spec = [key: string, rot: Rot, x: number, y: number];

export const STARTER_TOWNS: Record<string, Spec[]> = {
  classic: [
    ["station_plaza", 3, 0, 0],
    ["city_street", 0, 0, -1],
    ["road_straight", 1, 1, 0],
    ["rail_straight", 1, -1, 0],
    ["pool", 0, 0, 1],
    ["city_corner", 0, 1, -1],
    ["city_corner", 3, -1, -1],
    ["forest_corner", 1, 1, 1],
    ["field_corner", 2, -1, 1],
  ],
  metropolis: [
    ["city_full", 0, 0, 0],
    ["city_road", 2, 0, -1],
    ["city_road", 0, 0, 1],
    ["city_road", 3, 1, 0],
    ["city_full", 0, -1, 0],
    ["city_corner", 0, 1, -1],
    ["city_corner", 1, 1, 1],
    ["city_corner", 2, -1, -1],
    ["city_corner", 3, -1, 1],
  ],
  railway: [
    ["station_through", 0, 0, 0],
    ["rail_straight", 0, 0, -1],
    ["rail_straight", 0, 0, 1],
    ["house_road", 3, 1, 0],
    ["city_edge", 3, -1, 0],
    ["forest_corner", 0, 1, -1],
    ["field_corner", 3, -1, -1],
    ["grass", 0, 1, 1],
    ["city_corner", 2, -1, 1],
  ],
  waterside: [
    ["road_bridge", 0, 0, 0],
    ["river_straight", 1, 1, 0],
    ["lake", 1, -1, 0],
    ["road_straight", 0, 0, -1],
    ["road_straight", 0, 0, 1],
    ["beach", 0, 1, -1],
    ["house_road", 2, -1, -1],
    ["city_corner", 1, 1, 1],
    ["forest_corner", 2, -1, 1],
  ],
  countryside: [
    ["farm", 0, 0, 0],
    ["pool", 0, 0, -1],
    ["grass", 0, -1, 0],
    ["field_edge", 1, 1, 0],
    ["house_road", 0, 0, 1],
    ["field_corner", 0, 1, -1],
    ["field_corner", 1, 1, 1],
    ["forest_corner", 3, -1, -1],
    ["house_road", 1, -1, 1],
  ],
  crossroads: [
    ["road_cross", 0, 0, 0],
    ["road_straight", 0, 0, -1],
    ["road_straight", 0, 0, 1],
    ["road_straight", 1, 1, 0],
    ["road_straight", 1, -1, 0],
    ["city_corner", 0, 1, -1],
    ["city_corner", 3, -1, -1],
    ["city_corner", 1, 1, 1],
    ["forest_corner", 2, -1, 1],
  ],
  village: [
    ["road_t", 1, 0, 0],
    ["house_road", 1, 1, 0],
    ["house_road", 3, -1, 0],
    ["road_straight", 0, 0, 1],
    ["park", 0, 0, -1],
    ["city_corner", 0, 1, -1],
    ["city_corner", 3, -1, -1],
    ["forest_corner", 1, 1, 1],
    ["forest_corner", 2, -1, 1],
  ],
};

export interface StarterPlacement {
  tile: number;
  rot: Rot;
  x: number;
  y: number;
}

export function starterTown(theme: string, turn: number): StarterPlacement[] {
  const specs = STARTER_TOWNS[theme] ?? STARTER_TOWNS.classic;
  return specs.map(([key, rot, x, y]) => {
    let [px, py] = [x, y];
    for (let i = 0; i < turn; i++) [px, py] = [-py, px];
    return { tile: tileByKey(key).id, rot: ((rot + turn) % 4) as Rot, x: px + 0, y: py + 0 };
  });
}

export function starterTurn(seed: number): number {
  return hash(seed, 0x57a7) % 4;
}
