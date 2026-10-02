import type { BufferGeometry } from "three";
import type { Rng } from "../core/rng";
import { DIRS, DX, DY, type Dir, type Edge, type Group, type Rot, type TileDef } from "../core/tiles";
import { PartBuilder } from "./bricks";
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

function building(b: PartBuilder, rng: Rng, x: number, z: number, tall: boolean): void {
  const levels = 1 + Math.floor(rng() * (tall ? 3 : 2)) + (tall ? 1 : 0);
  const h = levels * 0.08;
  const w = 0.24 + rng() * 0.04;
  b.box(w, h, w, x, PLATE_TOP + 0.01, z, pick(rng, PALETTE.walls));
  const top = PLATE_TOP + 0.01 + h;
  if (rng() < 0.7) b.cone(w * 0.78, 0.12, x, top, z, pick(rng, PALETTE.roofs), 4, Math.PI / 4);
  else b.studGrid(x, z, w * 0.7, 2, top, pick(rng, PALETTE.walls));
}

function tree(b: PartBuilder, rng: Rng, x: number, z: number): void {
  b.cylinder(0.025, 0.08, x, PLATE_TOP, z, PALETTE.trunk, 6);
  const leaf = pick(rng, PALETTE.foliage);
  if (rng() < 0.5) {
    b.cone(0.11, 0.22, x, PLATE_TOP + 0.06, z, leaf, 8);
  } else {
    b.cylinder(0.1, 0.1, x, PLATE_TOP + 0.07, z, leaf, 10);
    b.cylinder(0.065, 0.06, x, PLATE_TOP + 0.17, z, leaf, 10);
  }
}

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

export function buildTileGeometry(
  tile: TileDef,
  rot: Rot,
  rng: Rng,
  around?: readonly (Edge | undefined)[],
): BufferGeometry {
  const b = new PartBuilder();
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
    drawWater(b, pathsFor(g), g.dirs.length === 1);
  }
  for (const g of tile.groups) {
    const y = PLATE_TOP;
    let paths = g.type === "road" || g.type === "rail" ? pathsFor(g) : [];
    if (tile.station && g.type === "rail") paths = [linePath(edgeMid(g.dirs[0]), { x: 0, z: -0.02 })];
    if (tile.station && g.type === "road") paths = [linePath(edgeMid(g.dirs[0]), { x: 0, z: 0.3 })];
    if (g.type === "road") drawRoad(b, paths, g.dirs.length !== 2 && !tile.station, y);
    if (g.type === "rail") drawRail(b, paths, y + (tile.groups.some((o) => o.type === "road") ? 0.004 : 0));
    if (hasBridge && g.type !== "water") drawBridgeRails(b, g.dirs, y + 0.02);
  }

  if (tile.station) {
    b.box(0.2, 0.05, 0.05, 0, PLATE_TOP + 0.02, 0.01, PALETTE.bufferStop);
    b.box(0.08, 0.012, 0.052, 0, PLATE_TOP + 0.06, 0.01, PALETTE.white);
    b.box(0.14, 0.05, 0.48, -0.24, PLATE_TOP, -0.24, PALETTE.platform);
    for (const z of [-0.42, -0.08]) b.box(0.02, 0.14, 0.02, -0.28, PLATE_TOP + 0.05, z, PALETTE.trunk);
    b.box(0.2, 0.02, 0.44, -0.25, PLATE_TOP + 0.19, -0.24, PALETTE.roofs[0]);
    b.box(0.38, 0.16, 0.18, 0, PLATE_TOP, 0.19, PALETTE.walls[3]);
    b.box(0.03, 0.08, 0.005, 0, PLATE_TOP, 0.282, PALETTE.trunk);
    b.box(0.44, 0.04, 0.24, 0, PLATE_TOP + 0.16, 0.19, PALETTE.roofs[1]);
    occupy(-1, -1);
    occupy(-1, 0);
    occupy(0, 1);
  }
  if (tile.house) {
    building(b, rng, 0, -SLOT, false);
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
      building(b, rng, sx * SLOT, sz * SLOT, sx === 0 && sz === 0);
    }
  }

  if (around) {
    for (const c of DIRS) {
      const mine = tile.edges[c];
      const theirs = around[(c + rot) % 4];
      if (mine !== "grass" && theirs !== undefined && theirs !== mine) drawCap(b, c, mine);
    }
  }

  for (let sx = -1; sx <= 1; sx++) {
    for (let sz = -1; sz <= 1; sz++) {
      if (occupied.has(`${sx},${sz}`)) continue;
      const x = sx * SLOT, z = sz * SLOT;
      b.studGrid(x, z, 0.2, 2, PLATE_TOP, PALETTE.grassStud);
      const roll = rng();
      if (roll < 0.28) tree(b, rng, x + (rng() - 0.5) * 0.08, z + (rng() - 0.5) * 0.08);
      else if (roll < 0.4) {
        for (let i = 0; i < 3; i++) {
          b.cylinder(0.03, 0.03, x + (rng() - 0.5) * 0.2, PLATE_TOP + 0.035, z + (rng() - 0.5) * 0.2, pick(rng, PALETTE.flowers), 6);
        }
      }
    }
  }

  const geo = b.build();
  geo.rotateY((-rot * Math.PI) / 2);
  return geo;
}
