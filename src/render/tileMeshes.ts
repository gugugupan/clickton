import type { BufferGeometry } from "three";
import type { Rng } from "../core/rng";
import { DIRS, DX, DY, type Dir, type Edge, type Group, type Landmark, type Rot, type Special, type TileDef } from "../core/tiles";
import { PartBuilder } from "./bricks";
import { DEFAULT_LOOK, type Look } from "./looks";
import { BUILDING_VARIANTS, type ModelKey, type Prop } from "./models";
import { PALETTE } from "./palette";

export const PLATE_SIZE = 0.98;
export const PLATE_TOP = 0.1;
const HALF = 0.49;
const SLOT = 0.32;

type Pt = { x: number; z: number };

interface Path {
  length: number;
  at(t: number, offset: number): Pt;
  angle(t: number): number;
}

function linePath(a: Pt, b: Pt): Path {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const nx = -dz / length, nz = dx / length;
  return {
    length,
    at: (t, o) => ({ x: a.x + dx * t + nx * o, z: a.z + dz * t + nz * o }),
    angle: () => Math.atan2(dx, dz),
  };
}

function arcPath(c: Pt, r: number, a0: number, a1: number): Path {
  return {
    length: Math.abs(a1 - a0) * r,
    at: (t, o) => {
      const a = a0 + (a1 - a0) * t;
      const rr = r + o * Math.sign(a1 - a0);
      return { x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr };
    },
    angle: (t) => {
      const a = a0 + (a1 - a0) * t;
      const tx = -Math.sin(a) * Math.sign(a1 - a0), tz = Math.cos(a) * Math.sign(a1 - a0);
      return Math.atan2(tx, tz);
    },
  };
}

const edgeMid = (d: Dir): Pt => ({ x: DX[d] * HALF, z: DY[d] * HALF });

function pathsFor(g: Group): Path[] {
  const [a, b] = g.dirs;
  if (g.dirs.length === 2 && (a + 2) % 4 === b) return [linePath(edgeMid(a), edgeMid(b))];
  if (g.dirs.length === 2) {
    const corner = { x: (DX[a] + DX[b]) * HALF, z: (DY[a] + DY[b]) * HALF };
    const pa = edgeMid(a), pb = edgeMid(b);
    const a0 = Math.atan2(pa.z - corner.z, pa.x - corner.x);
    let a1 = Math.atan2(pb.z - corner.z, pb.x - corner.x);
    if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    return [arcPath(corner, HALF, a0, a1)];
  }
  return g.dirs.map((d) => linePath(edgeMid(d), { x: 0, z: 0 }));
}

function strip(b: PartBuilder, path: Path, width: number, h: number, y: number, hex: number, offset = 0): void {
  const n = Math.max(1, Math.round(path.length / 0.08));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = path.at(t, offset);
    b.box(width, h, (path.length / n) * 1.08, p.x, y, p.z, hex, path.angle(t));
  }
}

function drawRoad(b: PartBuilder, paths: Path[], hub: boolean, y: number): void {
  for (const p of paths) {
    strip(b, p, 0.3, 0.02, y, PALETTE.road);
    const dashes = Math.max(1, Math.round(p.length / 0.16));
    for (let i = 0; i < dashes; i++) {
      const t = (i + 0.5) / dashes;
      const q = p.at(t, 0);
      b.box(0.024, 0.006, 0.07, q.x, y + 0.02, q.z, PALETTE.roadLine, p.angle(t));
    }
  }
  if (hub) b.box(0.3, 0.02, 0.3, 0, y, 0, PALETTE.road);
}

function drawRail(b: PartBuilder, paths: Path[], y: number): void {
  for (const p of paths) {
    strip(b, p, 0.24, 0.018, y, PALETTE.ballast);
    const sleepers = Math.max(1, Math.round(p.length / 0.085));
    for (let i = 0; i < sleepers; i++) {
      const t = (i + 0.5) / sleepers;
      const q = p.at(t, 0);
      b.box(0.2, 0.012, 0.03, q.x, y + 0.018, q.z, PALETTE.sleeper, p.angle(t));
    }
    strip(b, p, 0.022, 0.02, y + 0.03, PALETTE.rail, 0.06);
    strip(b, p, 0.022, 0.02, y + 0.03, PALETTE.rail, -0.06);
  }
}

function drawWater(b: PartBuilder, paths: Path[], hub: boolean, look: Look): void {
  for (const p of paths) {
    strip(b, p, 0.38, 0.014, PLATE_TOP, look.water);
    strip(b, p, 0.06, 0.004, PLATE_TOP + 0.014, look.waterLight, 0.07);
  }
  if (hub) b.cylinder(0.21, 0.016, 0, PLATE_TOP, 0, look.water, 20);
}

function drawBridgeRails(b: PartBuilder, dirs: Dir[], y: number): void {
  const along = dirs[0] % 2 === 0;
  for (const side of [-1, 1]) {
    const x = along ? side * 0.165 : 0, z = along ? 0 : side * 0.165;
    b.box(along ? 0.025 : 0.44, 0.05, along ? 0.44 : 0.025, x, y, z, PALETTE.platform);
  }
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

const HOUSES = [..."abcdefghijklmnorstu"].map((c) => `house_${c}`) as ModelKey[];
const SHOPS = [..."abcdefghi"].map((c) => `shop_${c}`) as ModelKey[];
const TOWERS = [..."abcde"].map((c) => `skyscraper_${c}`) as ModelKey[];
const TREES: ModelKey[] = ["tree_1", "tree_2", "tree_3", "tree_4", "tree_5"];
const BUSHES: ModelKey[] = ["bush_1", "bush_2", "bush_3"];
const ROCKS: ModelKey[] = ["rock_1", "rock_2"];
const TUFTS: ModelKey[] = ["grass_1", "grass_2"];
const LILIES: ModelKey[] = ["lily_a", "lily_b"];
const QUARTERS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

function drawCap(b: PartBuilder, d: Dir, type: Edge, look: Look): void {
  const along = d % 2 === 0;
  const box = (w: number, h: number, depth: number, r: number, y: number, hex: number, lateral = 0) => {
    const x = DX[d] * r + (along ? lateral : 0), z = DY[d] * r + (along ? 0 : lateral);
    if (along) b.box(w, h, depth, x, y, z, hex);
    else b.box(depth, h, w, x, y, z, hex);
  };
  if (type === "rail") {
    box(0.22, 0.05, 0.05, 0.42, PLATE_TOP + 0.02, PALETTE.bufferStop);
    box(0.08, 0.012, 0.052, 0.42, PLATE_TOP + 0.06, PALETTE.white);
  } else if (type === "road") {
    for (const side of [-0.12, 0.12]) box(0.025, 0.07, 0.025, 0.43, PLATE_TOP + 0.02, PALETTE.trunk, side);
    box(0.3, 0.03, 0.025, 0.43, PLATE_TOP + 0.06, PALETTE.barrier);
    box(0.08, 0.032, 0.027, 0.43, PLATE_TOP + 0.06, PALETTE.white);
  } else if (type === "water") {
    box(0.44, 0.03, 0.09, 0.445, PLATE_TOP, look.grass);
  } else if (type === "city") {
    box(0.94, 0.06, 0.03, 0.475, PLATE_TOP, PALETTE.paving);
  }
}

function fence(b: PartBuilder, x0: number, z0: number, x1: number, z1: number, gate: number): void {
  const post = (x: number, z: number) => b.box(0.025, 0.07, 0.025, x, PLATE_TOP, z, PALETTE.trunk);
  const railX = (xa: number, xb: number, z: number) => {
    if (xb - xa < 0.01) return;
    b.box(xb - xa, 0.015, 0.012, (xa + xb) / 2, PLATE_TOP + 0.045, z, PALETTE.trunk);
    b.box(xb - xa, 0.015, 0.012, (xa + xb) / 2, PLATE_TOP + 0.02, z, PALETTE.trunk);
  };
  const railZ = (za: number, zb: number, x: number) => {
    b.box(0.012, 0.015, zb - za, x, PLATE_TOP + 0.045, (za + zb) / 2, PALETTE.trunk);
    b.box(0.012, 0.015, zb - za, x, PLATE_TOP + 0.02, (za + zb) / 2, PALETTE.trunk);
  };
  railX(x0, x1, z0);
  railX(x0, -gate, z1);
  railX(gate, x1, z1);
  railZ(z0, z1, x0);
  railZ(z0, z1, x1);
  for (const x of [x0, x1, -gate, gate]) post(x, z1);
  for (const x of [x0, x1]) post(x, z0);
}

type PropFn = (
  model: ModelKey,
  x: number,
  z: number,
  o: Pick<Prop, "fit" | "height" | "maxHeight" | "size" | "variant"> & { lift?: number; rotY?: number },
) => void;

function drawSpecial(b: PartBuilder, kind: Special, rng: Rng, prop: PropFn, look: Look): void {
  if (kind === "zoo") {
    b.studGrid(0, -0.08, 0.7, 4, PLATE_TOP, look.grassStud);
    fence(b, -0.42, -0.43, 0.42, 0.27, 0.11);
    b.box(0.03, 0.16, 0.03, -0.12, PLATE_TOP, 0.27, PALETTE.trunk);
    b.box(0.03, 0.16, 0.03, 0.12, PLATE_TOP, 0.27, PALETTE.trunk);
    b.box(0.28, 0.05, 0.02, 0, PLATE_TOP + 0.15, 0.27, PALETTE.bufferStop);
    b.cylinder(0.11, 0.016, -0.2, PLATE_TOP, -0.02, look.water, 16);
    prop(pick(rng, TREES), -0.28, -0.3, { fit: 0.2, maxHeight: 0.3, rotY: rng() * 6 });
    prop(pick(rng, TREES), 0.29, -0.28, { fit: 0.2, maxHeight: 0.3, rotY: rng() * 6 });
    prop(pick(rng, ROCKS), 0.27, 0.08, { fit: 0.12, rotY: rng() * 6 });
    prop(pick(rng, BUSHES), 0.02, -0.33, { fit: 0.14, rotY: rng() * 6 });
  } else if (kind === "farm") {
    b.studGrid(0.12, 0.08, 0.5, 3, PLATE_TOP, look.grassStud);
    fence(b, -0.44, -0.44, 0.44, 0.42, 0.1);
    b.box(0.26, 0.16, 0.2, -0.22, PLATE_TOP, -0.24, PALETTE.barn);
    b.cone(0.2, 0.1, -0.22, PLATE_TOP + 0.16, -0.24, PALETTE.roofs[2], 4, Math.PI / 4);
    b.box(0.08, 0.1, 0.005, -0.22, PLATE_TOP, -0.138, PALETTE.trunk);
    for (const [x, z, h] of [[0.22, -0.28, 0], [0.31, -0.28, 0], [0.265, -0.28, 0.07]]) {
      b.box(0.08, 0.07, 0.1, x, PLATE_TOP + h, z, PALETTE.hay);
    }
    prop("wheelbarrow", 0.25, 0.22, { fit: 0.12, rotY: 0.7 });
    prop("sack", -0.3, 0.05, { fit: 0.06 });
    prop("crate", -0.3, 0.16, { fit: 0.07 });
  } else if (kind === "police") {
    b.box(0.62, 0.012, 0.44, 0, PLATE_TOP, -0.15, PALETTE.paving);
    prop("shop_c", 0, -0.18, { fit: 0.36, maxHeight: 0.38, variant: 3 });
    prop("car_police", 0.27, 0.2, { fit: 0.17, rotY: Math.PI });
    prop("streetlight", -0.27, 0.24, { height: 0.22 });
    b.box(0.015, 0.2, 0.015, -0.3, PLATE_TOP, -0.38, PALETTE.trunk);
    b.box(0.08, 0.05, 0.005, -0.26, PLATE_TOP + 0.15, -0.38, PALETTE.walls[2]);
  } else if (kind === "beach") {
    b.box(0.94, 0.014, 0.94, 0, PLATE_TOP, 0, PALETTE.sand);
    prop("parasol_a", -0.18, -0.16, { fit: 0.2, lift: 0.014, rotY: rng() * 6 });
    prop("parasol_b", 0.2, 0.14, { fit: 0.2, lift: 0.014, rotY: rng() * 6 });
    for (const [x, z, c] of [[-0.05, -0.22, 0], [0.32, 0.02, 2], [-0.3, 0.2, 4]]) {
      b.box(0.14, 0.006, 0.07, x, PLATE_TOP + 0.014, z, PALETTE.walls[c]);
    }
    for (let i = 0; i < 4; i++) {
      b.cylinder(0.012, 0.01, (rng() - 0.5) * 0.8, PLATE_TOP + 0.014, (rng() - 0.5) * 0.8, PALETTE.white, 6);
    }
  }
}

export interface LandmarkProp {
  model: ModelKey;
  x: number;
  z: number;
  rotY: number;
  lift: number;
  height?: number;
  fit?: number;
  maxHeight?: number;
}

export const LANDMARK_PROPS = {
  windmill: { model: "lm_windmill", x: 0, z: -0.05, rotY: 0, lift: 0, height: 0.6 },
  watermill: { model: "lm_watermill", x: 0.27, z: 0, rotY: -Math.PI / 2, lift: 0, fit: 0.42, maxHeight: 0.42 },
  lighthouse: { model: "lm_tower", x: 0.3, z: 0.3, rotY: 0, lift: 0.04, height: 0.58 },
  castle: { model: "lm_castle", x: 0, z: 0, rotY: 0, lift: 0, fit: 0.8, maxHeight: 0.8 },
  church: { model: "lm_church", x: 0, z: 0, rotY: 0, lift: 0, fit: 0.66, maxHeight: 0.7 },
} satisfies Record<string, LandmarkProp>;

function drawLandmark(b: PartBuilder, kind: Landmark, rng: Rng, prop: PropFn, look: Look): void {
  const flowers = (x: number, z: number, n: number, spread: number) => {
    for (let i = 0; i < n; i++) {
      b.cylinder(0.025, 0.03, x + (rng() - 0.5) * spread, PLATE_TOP + 0.01, z + (rng() - 0.5) * spread, pick(rng, PALETTE.flowers), 6);
    }
  };
  switch (kind) {
    case "market":
      b.box(0.8, 0.012, 0.56, 0, PLATE_TOP, -0.16, PALETTE.paving);
      prop("lm_market", 0, -0.2, { fit: 0.5, maxHeight: 0.42 });
      prop("crate", -0.3, 0.12, { fit: 0.08, lift: 0.012 });
      prop("barrel", -0.32, 0.25, { fit: 0.06 });
      prop("sack", 0.3, 0.14, { fit: 0.07, lift: 0.012, rotY: 0.5 });
      prop("lantern", 0.3, 0.3, { height: 0.14 });
      break;
    case "xmas":
      b.box(0.94, 0.014, 0.94, 0, PLATE_TOP, 0, PALETTE.white);
      prop("xmas_tree", 0, -0.06, { height: 0.5, lift: 0.014 });
      prop("snowman", 0.28, 0.26, { height: 0.18, lift: 0.014, rotY: -0.6 });
      for (const [x, z] of [[-0.17, 0.12], [0.16, 0.1], [-0.12, -0.25]]) prop("present", x, z, { fit: 0.07, lift: 0.014, rotY: rng() * 6 });
      break;
    case "garden":
      b.studGrid(0, 0, 0.8, 5, PLATE_TOP, look.grassStud);
      b.cylinder(0.13, 0.02, 0, PLATE_TOP, 0, PALETTE.platform, 20);
      b.cylinder(0.1, 0.026, 0, PLATE_TOP, 0, look.water, 20);
      for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) flowers(x, z, 7, 0.22);
      prop(pick(rng, BUSHES), 0, -0.34, { fit: 0.13 });
      prop(pick(rng, BUSHES), 0, 0.34, { fit: 0.13 });
      prop("bench", -0.3, 0, { fit: 0.13, rotY: Math.PI / 2 });
      b.box(0.012, 0.13, 0.012, -0.16, PLATE_TOP, 0.12, PALETTE.trunk);
      b.box(0.012, 0.13, 0.012, -0.11, PLATE_TOP, 0.12, PALETTE.trunk);
      b.box(0.08, 0.06, 0.008, -0.135, PLATE_TOP + 0.08, 0.115, PALETTE.white);
      break;
    case "church":
      prop(LANDMARK_PROPS.church.model, LANDMARK_PROPS.church.x, LANDMARK_PROPS.church.z, LANDMARK_PROPS.church);
      break;
    case "castle":
      prop(LANDMARK_PROPS.castle.model, LANDMARK_PROPS.castle.x, LANDMARK_PROPS.castle.z, LANDMARK_PROPS.castle);
      break;
    case "lighthouse":
      b.cylinder(0.13, 0.04, 0.3, PLATE_TOP, 0.3, PALETTE.platform, 14);
      prop(LANDMARK_PROPS.lighthouse.model, LANDMARK_PROPS.lighthouse.x, LANDMARK_PROPS.lighthouse.z, LANDMARK_PROPS.lighthouse);
      prop(pick(rng, ROCKS), -0.32, 0.32, { fit: 0.12 });
      break;
    case "watermill":
      prop(LANDMARK_PROPS.watermill.model, LANDMARK_PROPS.watermill.x, LANDMARK_PROPS.watermill.z, LANDMARK_PROPS.watermill);
      prop("sack", -0.32, -0.3, { fit: 0.07 });
      prop(pick(rng, TREES), -0.3, 0.28, { fit: 0.2, maxHeight: 0.3 });
      break;
    case "stage":
      b.box(0.8, 0.012, 0.66, 0, PLATE_TOP, -0.1, PALETTE.paving);
      b.box(0.62, 0.06, 0.34, 0, PLATE_TOP, -0.2, PALETTE.trunk);
      b.box(0.62, 0.3, 0.03, 0, PLATE_TOP + 0.06, -0.36, PALETTE.walls[4]);
      for (const x of [-0.29, 0.29]) b.box(0.06, 0.3, 0.07, x, PLATE_TOP + 0.06, -0.32, PALETTE.bufferStop);
      b.box(0.68, 0.05, 0.12, 0, PLATE_TOP + 0.36, -0.32, PALETTE.bufferStop);
      for (const x of [-0.22, 0.22]) prop("bench", x, 0.14, { fit: 0.14, lift: 0.012, rotY: Math.PI });
      prop("lantern", -0.34, 0.3, { height: 0.14 });
      prop("lantern", 0.34, 0.3, { height: 0.14 });
      break;
    case "windmill":
      prop(LANDMARK_PROPS.windmill.model, LANDMARK_PROPS.windmill.x, LANDMARK_PROPS.windmill.z, LANDMARK_PROPS.windmill);
      for (const [x, z] of [[0.3, 0.28], [0.21, 0.32]]) b.cylinder(0.05, 0.06, x, PLATE_TOP, z, PALETTE.hay, 10);
      prop("wheelbarrow", -0.28, 0.27, { fit: 0.12, rotY: 0.5 });
      break;
    case "sports":
      b.box(0.82, 0.012, 0.6, 0, PLATE_TOP, -0.15, 0x8fb584);
      b.box(0.82, 0.004, 0.015, 0, PLATE_TOP + 0.012, -0.15, PALETTE.white);
      b.cylinder(0.08, 0.004, 0, PLATE_TOP + 0.012, -0.15, PALETTE.white, 16);
      b.cylinder(0.065, 0.006, 0, PLATE_TOP + 0.012, -0.15, 0x8fb584, 16);
      prop("basketball", -0.25, -0.3, { fit: 0.05, lift: 0.012 });
      prop("bench", 0.3, 0.27, { fit: 0.13 });
      break;
    case "lumber":
      prop("lm_lumber", -0.1, -0.12, { fit: 0.48, maxHeight: 0.4 });
      for (let i = 0; i < 3; i++) b.box(0.22, 0.04, 0.04, 0.22, PLATE_TOP + i * 0.035, 0.22 + (i % 2) * 0.05, PALETTE.trunk);
      prop("tree_2", -0.32, 0.3, { fit: 0.22, maxHeight: 0.34 });
      b.cylinder(0.03, 0.02, 0.32, PLATE_TOP, -0.3, PALETTE.trunk, 10);
      break;
    case "gingerbread":
      prop("gingerbread_house", 0, -0.08, { fit: 0.42, maxHeight: 0.4 });
      flowers(-0.25, 0.27, 6, 0.2);
      break;
    case "tavern":
      b.box(0.6, 0.012, 0.5, 0, PLATE_TOP, -0.18, PALETTE.paving);
      prop("lm_tavern", 0, -0.16, { fit: 0.38, maxHeight: 0.36 });
      prop("barrel", 0.3, 0.12, { fit: 0.06 });
      prop("barrel", 0.36, 0.2, { fit: 0.06 });
      prop("lantern", -0.3, 0.2, { height: 0.14 });
      break;
  }
}

export interface TileBuild {
  base: BufferGeometry;
  props: Prop[];
  lights: { x: number; y: number; z: number }[];
}

export function buildTile(
  tile: TileDef,
  rot: Rot,
  rng: Rng,
  around?: readonly (Edge | undefined)[],
  look: Look = DEFAULT_LOOK,
  lakes: readonly boolean[] = [],
): TileBuild {
  const b = new PartBuilder();
  const props: Prop[] = [];
  const prop = (
    model: ModelKey,
    x: number,
    z: number,
    o: Pick<Prop, "fit" | "height" | "maxHeight" | "size" | "variant"> & { lift?: number; rotY?: number },
  ) =>
    props.push({
      model,
      x,
      z,
      y: PLATE_TOP + (o.lift ?? 0),
      rotY: o.rotY ?? 0,
      fit: o.fit,
      height: o.height,
      maxHeight: o.maxHeight,
      size: o.size,
      variant: o.variant,
    });
  b.box(PLATE_SIZE, PLATE_TOP, PLATE_SIZE, 0, 0, 0, look.grass);

  const occupied = new Set<string>();
  const occupy = (sx: number, sz: number) => occupied.add(`${sx},${sz}`);
  const hasBridge = tile.groups.some((g) => g.type === "water") && tile.groups.some((g) => g.type !== "water");

  for (const g of tile.groups) {
    if (g.type === "city") {
      for (const d of g.dirs) {
        for (let s = -1; s <= 1; s++) occupy(DX[d] !== 0 ? DX[d] : s, DY[d] !== 0 ? DY[d] : s);
      }
      if (g.dirs.length >= 2) occupy(0, 0);
      continue;
    }
    for (const d of g.dirs) occupy(DX[d], DY[d]);
    occupy(0, 0);
  }

  for (const g of tile.groups.filter((g) => g.type === "water")) {
    const paths = pathsFor(g);
    drawWater(b, paths, g.dirs.length === 1, look);
    if (hasBridge) continue;
    for (const p of paths) {
      if (rng() > look.lilyChance) continue;
      const q = p.at(0.25 + rng() * 0.5, (rng() - 0.5) * 0.18);
      prop(pick(rng, LILIES), q.x, q.z, { fit: 0.08, lift: 0.016, rotY: rng() * Math.PI * 2 });
    }
    if (g.dirs.length === 1) prop("waterplant", 0.08, 0.06, { fit: 0.08, lift: 0.016, rotY: rng() * Math.PI * 2 });
  }
  for (const g of tile.groups) {
    const y = PLATE_TOP;
    let paths = g.type === "road" || g.type === "rail" ? pathsFor(g) : [];
    if (tile.station && g.type === "rail") paths = [linePath(edgeMid(g.dirs[0]), { x: 0, z: -0.02 })];
    if (tile.station && g.type === "road") paths = [linePath(edgeMid(g.dirs[0]), { x: 0, z: 0.36 })];
    if ((tile.special || tile.landmark) && g.type === "road") paths = [linePath(edgeMid(g.dirs[0]), { x: 0, z: 0.26 })];
    if (g.type === "road") drawRoad(b, paths, g.dirs.length !== 2 && !tile.station && !tile.special && !tile.landmark, y);
    if (g.type === "rail") drawRail(b, paths, y + (tile.groups.some((o) => o.type === "road") ? 0.004 : 0));
    if (hasBridge && g.type !== "water") drawBridgeRails(b, g.dirs, y + 0.02);
  }

  if (tile.station) {
    b.box(0.2, 0.05, 0.05, 0, PLATE_TOP + 0.02, 0.01, PALETTE.bufferStop);
    b.box(0.08, 0.012, 0.052, 0, PLATE_TOP + 0.06, 0.01, PALETTE.white);
    b.box(0.14, 0.05, 0.48, -0.24, PLATE_TOP, -0.24, PALETTE.platform);
    prop("canopy", -0.25, -0.24, { size: { x: 0.46, y: 0.2, z: 0.16 }, rotY: Math.PI / 2, lift: 0.05 });
    const plaza = tile.groups.some((g) => g.type === "city");
    prop("station_house", plaza ? -0.1 : 0, 0.2, { fit: plaza ? 0.32 : 0.38, maxHeight: 0.28, variant: 1 + Math.floor(rng() * (BUILDING_VARIANTS - 1)) });
    prop("crate", -0.24, -0.4, { fit: 0.08, lift: 0.05 });
    prop("barrel", -0.24, -0.29, { fit: 0.055, lift: 0.05 });
    prop("sack", -0.22, -0.2, { fit: 0.06, lift: 0.05, rotY: 0.6 });
    prop("streetlight", plaza ? -0.36 : 0.25, 0.37, { height: 0.24 });
    occupy(-1, -1);
    occupy(-1, 0);
    occupy(0, 1);
  }
  if (tile.special) {
    for (let sx = -1; sx <= 1; sx++) for (let sz = -1; sz <= 1; sz++) occupy(sx, sz);
    drawSpecial(b, tile.special, rng, prop, look);
  }
  if (tile.landmark) {
    for (let sx = -1; sx <= 1; sx++) for (let sz = -1; sz <= 1; sz++) occupy(sx, sz);
    drawLandmark(b, tile.landmark, rng, prop, look);
  }
  if (tile.deadEnd) {
    b.cylinder(0.2, 0.02, 0, PLATE_TOP, 0, PALETTE.road, 20);
    b.cylinder(0.075, 0.035, 0, PLATE_TOP, 0, look.grass, 14);
    b.studGrid(0, 0, 0.08, 1, PLATE_TOP + 0.035, look.grassStud);
  }
  if (tile.pool) {
    const orth = (c: number) => lakes[(c + rot) % 4] ?? false;
    const diag = (c: number) => lakes[4 + ((c + rot) % 4)] ?? false;
    b.cylinder(0.27, 0.02, 0, PLATE_TOP, 0, PALETTE.platform, 24);
    b.cylinder(0.23, 0.026, 0, PLATE_TOP, 0, look.water, 24);
    for (const c of DIRS) {
      if (!orth(c)) continue;
      const along = c % 2 === 0;
      const cx = DX[c] * 0.25, cz = DY[c] * 0.25;
      b.box(along ? 0.54 : 0.5, 0.02, along ? 0.5 : 0.54, cx, PLATE_TOP, cz, PALETTE.platform);
      b.box(along ? 0.46 : 0.5, 0.026, along ? 0.5 : 0.46, cx, PLATE_TOP, cz, look.water);
      occupy(DX[c], DY[c]);
      const next = ((c + 1) % 4) as Dir;
      if (orth(next) && diag(c)) {
        const sx = DX[c] + DX[next], sz = DY[c] + DY[next];
        b.box(0.5, 0.026, 0.5, sx * 0.25, PLATE_TOP, sz * 0.25, look.water);
        occupy(sx, sz);
      }
    }
    b.cylinder(0.08, 0.004, 0.06, PLATE_TOP + 0.026, -0.05, look.waterLight, 12);
    for (let i = 0; i < 2; i++) {
      const a = rng() * Math.PI * 2, r = 0.08 + rng() * 0.1;
      prop(pick(rng, LILIES), Math.cos(a) * r, Math.sin(a) * r, { fit: 0.07, lift: 0.026, rotY: rng() * Math.PI * 2 });
    }
    occupy(0, 0);
  }
  if (tile.halt) {
    b.box(0.14, 0.05, 0.92, -0.24, PLATE_TOP, 0, PALETTE.platform);
    prop("canopy_wide", -0.25, 0, { size: { x: 0.88, y: 0.2, z: 0.16 }, rotY: Math.PI / 2, lift: 0.05 });
    prop("station_house", 0.28, 0, {
      fit: 0.34,
      maxHeight: 0.26,
      rotY: -Math.PI / 2,
      variant: 1 + Math.floor(rng() * (BUILDING_VARIANTS - 1)),
    });
    prop("crate", -0.24, 0.38, { fit: 0.07, lift: 0.05 });
    prop("barrel", -0.24, -0.4, { fit: 0.05, lift: 0.05 });
    prop("streetlight", 0.27, 0.35, { height: 0.22 });
    occupy(-1, -1);
    occupy(-1, 0);
    occupy(-1, 1);
    occupy(1, 0);
  }
  if (tile.house) {
    prop(pick(rng, HOUSES), 0, -SLOT, { fit: 0.34, maxHeight: 0.38, variant: Math.floor(rng() * BUILDING_VARIANTS) });
    occupy(0, -1);
  }

  for (const g of tile.groups.filter((g) => g.type === "city")) {
    const slots = new Set<string>();
    for (const d of g.dirs) {
      for (let s = -1; s <= 1; s++) slots.add(`${DX[d] !== 0 ? DX[d] : s},${DY[d] !== 0 ? DY[d] : s}`);
    }
    if (g.dirs.length >= 2) slots.add("0,0");
    for (const key of slots) {
      const [sx, sz] = key.split(",").map(Number);
      b.box(SLOT, 0.01, SLOT, sx * SLOT, PLATE_TOP, sz * SLOT, PALETTE.paving);
      if (tile.landmark) continue;
      const centre = sx === 0 && sz === 0;
      const downtown = g.dirs.length === 4;
      const pool = downtown
        ? centre && rng() < look.towerChance
          ? TOWERS
          : SHOPS
        : centre || rng() < look.shopChance
          ? SHOPS
          : HOUSES;
      const tall = pool === TOWERS;
      prop(pick(rng, pool), sx * SLOT, sz * SLOT, {
        variant: Math.floor(rng() * BUILDING_VARIANTS),
        fit: tall ? 0.26 : 0.29,
        maxHeight: tall ? 0.8 : pool === SHOPS ? 0.5 : 0.36,
        lift: 0.01,
        rotY: pick(rng, QUARTERS),
      });
    }
  }

  if (around) {
    for (const c of DIRS) {
      const mine = tile.edges[c];
      const theirs = around[(c + rot) % 4];
      if (mine !== "grass" && theirs !== undefined && theirs !== mine) drawCap(b, c, mine, look);
    }
  }

  const hasRoad = tile.groups.some((g) => g.type === "road");
  for (let sx = -1; sx <= 1; sx++) {
    for (let sz = -1; sz <= 1; sz++) {
      if (occupied.has(`${sx},${sz}`)) continue;
      const x = sx * SLOT, z = sz * SLOT;
      b.studGrid(x, z, 0.2, 2, PLATE_TOP, look.grassStud);
      const roll = rng();
      const jx = x + (rng() - 0.5) * 0.08, jz = z + (rng() - 0.5) * 0.08;
      const spin = rng() * Math.PI * 2;
      const fur = look.streetFurniture;
      const treeT = look.trees, bushT = treeT + look.bushes, rockT = bushT + 0.06, tuftT = rockT + 0.1;
      if (tile.groups.length === 0 && sx === 0 && sz === 0 && roll < look.landmark) {
        prop("watertower", x, z, { height: 0.5, rotY: pick(rng, QUARTERS) });
      } else if (hasRoad && roll < fur) {
        if (roll < fur * 0.55) prop("streetlight", jx, jz, { height: 0.24 });
        else if (roll < fur * 0.85) prop("bench", jx, jz, { fit: 0.12, rotY: pick(rng, QUARTERS) });
        else prop("hydrant", jx, jz, { height: 0.06 });
      } else if (roll < treeT) prop(pick(rng, TREES), jx, jz, { fit: 0.24 + rng() * 0.06, maxHeight: 0.3 + rng() * 0.1, rotY: spin });
      else if (roll < bushT) prop(pick(rng, BUSHES), jx, jz, { fit: 0.15, rotY: spin });
      else if (roll < rockT) prop(pick(rng, ROCKS), jx, jz, { fit: 0.11, rotY: spin });
      else if (roll < tuftT) prop(pick(rng, TUFTS), jx, jz, { fit: 0.13, rotY: spin });
      else if (roll < tuftT + look.flowers) {
        for (let i = 0; i < 3; i++) {
          b.cylinder(0.03, 0.03, x + (rng() - 0.5) * 0.2, PLATE_TOP + 0.035, z + (rng() - 0.5) * 0.2, pick(rng, PALETTE.flowers), 6);
        }
      }
    }
  }

  const angle = (-rot * Math.PI) / 2;
  const base = b.build();
  base.rotateY(angle);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (const p of props) {
    const x = p.x, z = p.z;
    p.x = x * cos + z * sin;
    p.z = -x * sin + z * cos;
    p.rotY += angle;
  }
  const lights = props
    .filter((p) => p.model === "streetlight" || p.model === "lantern")
    .map((p) => ({ x: p.x, y: (p.y ?? PLATE_TOP) + (p.height ?? 0.22) * (p.model === "lantern" ? 0.6 : 0.92), z: p.z }));
  return { base, props, lights };
}
