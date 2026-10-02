import { PALETTE } from "./palette";

export interface Look {
  grass: number;
  grassStud: number;
  water: number;
  waterLight: number;
  table: number;
  background: number;
  sky: number;
  ground: number;
  towerChance: number;
  shopChance: number;
  lilyChance: number;
  streetFurniture: number;
  trees: number;
  bushes: number;
  flowers: number;
  landmark: number;
}

export const DEFAULT_LOOK: Look = {
  grass: PALETTE.grass,
  grassStud: PALETTE.grassStud,
  water: PALETTE.water,
  waterLight: PALETTE.waterLight,
  table: PALETTE.table,
  background: PALETTE.background,
  sky: 0xfffaf2,
  ground: 0xd9cfc3,
  towerChance: 0.75,
  shopChance: 0,
  lilyChance: 0.6,
  streetFurniture: 0.2,
  trees: 0.28,
  bushes: 0.12,
  flowers: 0.1,
  landmark: 0.06,
};

const LOOKS: Record<string, Partial<Look>> = {
  metropolis: {
    grass: 0x9fb896,
    grassStud: 0xa9c1a0,
    water: 0x95aec0,
    table: 0xebe7e1,
    background: 0xf2f0ec,
    sky: 0xf6f7fa,
    towerChance: 0.95,
    shopChance: 0.3,
    streetFurniture: 0.32,
    trees: 0.18,
    flowers: 0.04,
  },
  railway: {
    grass: 0xb0c690,
    grassStud: 0xbacf9c,
    table: 0xf1e7d6,
    background: 0xf7efe2,
    sky: 0xfff4e4,
    ground: 0xdcc9ad,
  },
  waterside: {
    grass: 0xa0cd9c,
    grassStud: 0xacd6a8,
    water: 0x7fb4dc,
    waterLight: 0xaed4ee,
    table: 0xedf1ee,
    background: 0xf1f6f4,
    sky: 0xf2f9ff,
    ground: 0xc9d6d3,
    lilyChance: 0.95,
    trees: 0.24,
    bushes: 0.16,
  },
  countryside: {
    grass: 0xa6cf8e,
    grassStud: 0xb3d89c,
    table: 0xf4ecd8,
    background: 0xf8f1e2,
    sky: 0xfff6e2,
    streetFurniture: 0.08,
    trees: 0.36,
    bushes: 0.16,
    flowers: 0.24,
    landmark: 0.14,
  },
  crossroads: {
    table: 0xefe9e2,
    background: 0xf5f1eb,
    streetFurniture: 0.36,
    trees: 0.22,
  },
  village: {
    grass: 0xb1ca98,
    grassStud: 0xbcd3a5,
    table: 0xf3ebdd,
    background: 0xf7f0e5,
    sky: 0xfff7ea,
    towerChance: 0.2,
    flowers: 0.2,
    trees: 0.3,
    landmark: 0.1,
  },
};

export function lookFor(theme: string | null | undefined): Look {
  return { ...DEFAULT_LOOK, ...(theme ? LOOKS[theme] : undefined) };
}
