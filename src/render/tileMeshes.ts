import type { BufferGeometry } from "three";
import type { Rng } from "../core/rng";
import { DIRS, DX, DY, type Dir, type Edge, type Group, type Rot, type TileDef } from "../core/tiles";
import { PartBuilder } from "./bricks";
import type { ModelKey, Prop } from "./models";
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

function drawWater(b: PartBuilder, paths: Path[], hub: boolean): void {
  for (const p of paths) {
    strip(b, p, 0.38, 0.014, PLATE_TOP, PALETTE.water);
    strip(b, p, 0.06, 0.004, PLATE_TOP + 0.014, PALETTE.waterLight, 0.07);
  }
  if (hub) b.cylinder(0.21, 0.016, 0, PLATE_TOP, 0, PALETTE.water, 20);
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

function drawCap(b: PartBuilder, d: Dir, type: Edge): void {
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
    box(0.44, 0.03, 0.09, 0.445, PLATE_TOP, PALETTE.grass);
  } else if (type === "city") {
    box(0.94, 0.06, 0.03, 0.475, PLATE_TOP, PALETTE.paving);
  }
}

export interface TileBuild {
  base: BufferGeometry;
  props: Prop[];
}

export function buildTile(tile: TileDef, rot: Rot, rng: Rng, around?: readonly (Edge | undefined)[]): TileBuild {
  const b = new PartBuilder();
  const props: Prop[] = [];
  const prop = (
    model: ModelKey,
    x: number,
    z: number,
    o: Pick<Prop, "fit" | "height" | "maxHeight" | "size"> & { lift?: number; rotY?: number },
  ) => props.push({ model, x, z, y: PLATE_TOP + (o.lift ?? 0), rotY: o.rotY ?? 0, fit: o.fit, height: o.height, maxHeight: o.maxHeight, size: o.size });
  b.box(PLATE_SIZE, PLATE_TOP, PLATE_SIZE, 0, 0, 0, PALETTE.grass);

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
    drawWater(b, paths, g.dirs.length === 1);
    if (hasBridge) continue;
    for (const p of paths) {
      if (rng() > 0.6) continue;
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
    if (g.type === "road") drawRoad(b, paths, g.dirs.length !== 2 && !tile.station, y);
    if (g.type === "rail") drawRail(b, paths, y + (tile.groups.some((o) => o.type === "road") ? 0.004 : 0));
    if (hasBridge && g.type !== "water") drawBridgeRails(b, g.dirs, y + 0.02);
  }

  if (tile.station) {
    b.box(0.2, 0.05, 0.05, 0, PLATE_TOP + 0.02, 0.01, PALETTE.bufferStop);
    b.box(0.08, 0.012, 0.052, 0, PLATE_TOP + 0.06, 0.01, PALETTE.white);
    b.box(0.14, 0.05, 0.48, -0.24, PLATE_TOP, -0.24, PALETTE.platform);
    prop("canopy", -0.25, -0.24, { size: { x: 0.46, y: 0.2, z: 0.16 }, rotY: Math.PI / 2, lift: 0.05 });
    prop("station_house", 0, 0.2, { fit: 0.38, maxHeight: 0.28 });
    prop("crate", -0.24, -0.4, { fit: 0.08, lift: 0.05 });
    prop("barrel", -0.24, -0.29, { fit: 0.055, lift: 0.05 });
    prop("sack", -0.22, -0.2, { fit: 0.06, lift: 0.05, rotY: 0.6 });
    prop("streetlight", 0.25, 0.37, { height: 0.24 });
    occupy(-1, -1);
    occupy(-1, 0);
    occupy(0, 1);
  }
  if (tile.halt) {
    b.box(0.14, 0.05, 0.92, -0.24, PLATE_TOP, 0, PALETTE.platform);
    prop("canopy_wide", -0.25, 0, { size: { x: 0.88, y: 0.2, z: 0.16 }, rotY: Math.PI / 2, lift: 0.05 });
    prop("station_house", 0.28, 0, { fit: 0.34, maxHeight: 0.26, rotY: -Math.PI / 2 });
    prop("crate", -0.24, 0.38, { fit: 0.07, lift: 0.05 });
    prop("barrel", -0.24, -0.4, { fit: 0.05, lift: 0.05 });
    prop("streetlight", 0.27, 0.35, { height: 0.22 });
    occupy(-1, -1);
    occupy(-1, 0);
    occupy(-1, 1);
    occupy(1, 0);
  }
  if (tile.house) {
    prop(pick(rng, HOUSES), 0, -SLOT, { fit: 0.34, maxHeight: 0.38 });
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
      const centre = sx === 0 && sz === 0;
      const downtown = g.dirs.length === 4;
      const pool = downtown ? (centre && rng() < 0.75 ? TOWERS : SHOPS) : centre ? SHOPS : HOUSES;
      const tall = pool === TOWERS;
      prop(pick(rng, pool), sx * SLOT, sz * SLOT, {
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
      if (mine !== "grass" && theirs !== undefined && theirs !== mine) drawCap(b, c, mine);
    }
  }

  const hasRoad = tile.groups.some((g) => g.type === "road");
  for (let sx = -1; sx <= 1; sx++) {
    for (let sz = -1; sz <= 1; sz++) {
      if (occupied.has(`${sx},${sz}`)) continue;
      const x = sx * SLOT, z = sz * SLOT;
      b.studGrid(x, z, 0.2, 2, PLATE_TOP, PALETTE.grassStud);
      const roll = rng();
      const jx = x + (rng() - 0.5) * 0.08, jz = z + (rng() - 0.5) * 0.08;
      const spin = rng() * Math.PI * 2;
      if (tile.groups.length === 0 && sx === 0 && sz === 0 && roll < 0.06) {
        prop("watertower", x, z, { height: 0.5, rotY: pick(rng, QUARTERS) });
      } else if (hasRoad && roll < 0.2) {
        if (roll < 0.11) prop("streetlight", jx, jz, { height: 0.24 });
        else if (roll < 0.17) prop("bench", jx, jz, { fit: 0.12, rotY: pick(rng, QUARTERS) });
        else prop("hydrant", jx, jz, { height: 0.06 });
      } else if (roll < 0.28) prop(pick(rng, TREES), jx, jz, { fit: 0.24 + rng() * 0.06, maxHeight: 0.3 + rng() * 0.1, rotY: spin });
      else if (roll < 0.4) prop(pick(rng, BUSHES), jx, jz, { fit: 0.15, rotY: spin });
      else if (roll < 0.46) prop(pick(rng, ROCKS), jx, jz, { fit: 0.11, rotY: spin });
      else if (roll < 0.56) prop(pick(rng, TUFTS), jx, jz, { fit: 0.13, rotY: spin });
      else if (roll < 0.66) {
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
  return { base, props };
}
