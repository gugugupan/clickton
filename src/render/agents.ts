import {
  AdditiveBlending,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  Box3,
  Camera,
  Frustum,
  Group,
  Matrix4,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Board, Placed } from "../core/board";
import { completedRoadCells, specialStatus } from "../core/specials";
import { completedRailLines, completedRoadNetworks, edgeRegions, grassExits, hasRoad, isHome, isMeadow, isPond, regionAt, roadExits, type RailLine } from "../core/networks";
import { hash } from "../core/rng";
import { DIRS, DX, DY, groupsOf, type Dir, type Special } from "../core/tiles";
import catalog from "./assets.json";
import { modelUrl, type ModelKey, type ModelLibrary } from "./models";
import { glowTexture } from "./scene";
import { LANDMARK_PROPS, PLATE_TOP } from "./tileMeshes";
import {
  BEE,
  Beam,
  Flag,
  Flyer,
  Glow,
  Hopper,
  Jumper,
  Lumberjack,
  Match,
  PARROT,
  Parade,
  Patrol,
  Performer,
  Queue,
  Shuttle,
  Snow,
  Spinner,
  Stagger,
  onTile,
  type Life,
  type Spot,
} from "./landmarkLife";
import { Puppet, easeOutBack, moveToward, pointIn, tileArea, type Area, type Rig } from "./puppet";

const PET_HEIGHT: Record<string, number> = {
  bunny: 0.08,
  chick: 0.06,
  cow: 0.13,
  pig: 0.1,
  deer: 0.13,
  fox: 0.09,
  dog: 0.09,
  cat: 0.08,
  beaver: 0.08,
  fish: 0.06,
  lion: 0.1,
  tiger: 0.1,
  elephant: 0.16,
  giraffe: 0.2,
  panda: 0.1,
  monkey: 0.08,
  penguin: 0.07,
  crab: 0.045,
  bee: 0.04,
  parrot: 0.07,
  caterpillar: 0.04,
  polar: 0.12,
};
const MEADOW_PETS = ["bunny", "chick", "cow", "pig", "deer", "fox", "dog", "cat"];
const ZOO_PETS = ["lion", "tiger", "elephant", "giraffe", "panda", "monkey"];
const FARM_PETS = ["cow", "pig", "chick"];
const OFFICER = 9;
const PERSON_HEIGHT = 0.15;
const CAR_SPACING = 0.27;
const TRAIN_SPEED = 0.7;
const SIDING_OFFSET = 0.2;
const GIFT_TENDER: ModelKey[] = ["locomotive", "tender_gifts_a", "wagon"];
const GIFT_TRAIN: ModelKey[] = ["locomotive", "tender_gifts_a", "tender_gifts_b"];
const GIFT_LOOP_MIN = 8;
const NOON = 0.3;

function gateOf(farm: Placed, from: Placed): Spot {
  const dx = from.x - farm.x, dz = from.y - farm.y;
  const len = Math.hypot(dx, dz) || 1;
  return { x: farm.x + (dx / len) * 0.38, z: farm.y + (dz / len) * 0.38 };
}

class Person {
  readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private readonly target = new Vector3();
  private cell: { x: number; y: number } | null;
  private heading: Dir | null = null;
  private wait = Math.random() * 2;
  private readonly side = (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.04);
  readonly bedtime = 0.25 + Math.random() * 0.65;

  constructor(
    rig: Rig,
    private readonly home: { x: number; y: number },
    board: Board,
    private readonly stay?: { area: Area; idle: string },
  ) {
    this.puppet = new Puppet(rig, PERSON_HEIGHT, rig.clips);
    this.cell = !stay && hasRoad(board, home.x, home.y) ? { ...home } : null;
    if (!this.cell && !stay) {
      const d = DIRS.find((d) => hasRoad(board, home.x + DX[d], home.y + DY[d]));
      if (d !== undefined) this.cell = { x: home.x + DX[d], y: home.y + DY[d] };
    }
    const start = this.cell ?? home;
    this.pos.set(start.x, PLATE_TOP + 0.02, start.y);
    if (stay) pointIn(stay.area, this.pos);
    this.target.copy(this.pos);
    this.puppet.root.position.copy(this.pos);
    this.puppet.root.rotation.y = Math.random() * Math.PI * 2;
  }

  update(dt: number, board: Board): void {
    this.puppet.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      this.puppet.play(this.stay?.idle ?? "idle");
      return;
    }
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    if (!moveToward(this.pos, this.target, dt * 0.22)) {
      this.puppet.play("walk");
      this.puppet.face(dx, dz, dt);
      this.puppet.root.position.copy(this.pos);
      return;
    }
    this.puppet.root.position.copy(this.pos);
    if (this.stay) {
      this.wait = 2 + Math.random() * 5;
      pointIn(this.stay.area, this.target);
      return;
    }
    if (Math.random() < 0.25) this.wait = 1 + Math.random() * 2.5;
    this.chooseNext(board);
  }

  private chooseNext(board: Board): void {
    if (!this.cell) {
      this.target.set(this.home.x + (Math.random() - 0.5) * 0.6, this.pos.y, this.home.y + (Math.random() - 0.5) * 0.6);
      return;
    }
    const exits = roadExits(board, this.cell.x, this.cell.y);
    if (!exits.length) {
      this.target.set(this.cell.x + (Math.random() - 0.5) * 0.2, this.pos.y, this.cell.y + (Math.random() - 0.5) * 0.2);
      return;
    }
    const back = this.heading === null ? null : ((this.heading + 2) % 4) as Dir;
    const forward = exits.filter((d) => d !== back);
    const options = forward.length && Math.random() < 0.85 ? forward : exits;
    const d = options[Math.floor(Math.random() * options.length)];
    this.heading = d;
    this.cell = { x: this.cell.x + DX[d], y: this.cell.y + DY[d] };
    const node = nodePosition(board, this.cell.x, this.cell.y);
    this.target.set(node.x - DY[d] * this.side, this.pos.y, node.z + DX[d] * this.side);
  }
}

function nodePosition(board: Board, x: number, y: number): { x: number; z: number } {
  const p = board.get(x, y);
  if (p?.tile.station) {
    const road = groupsOf(p.tile, p.rot).find((g) => g.type === "road");
    if (road) return { x: x + DX[road.dirs[0]] * 0.3, z: y + DY[road.dirs[0]] * 0.3 };
  }
  return { x, z: y };
}

const CAR_MODELS: ModelKey[] = ["car_hatchback", "car_sedan", "car_stationwagon", "car_taxi", "car_police"];
const CAR_LANE = 0.065;

class Car {
  readonly root = new Group();
  private readonly pos = new Vector3();
  private readonly target = new Vector3();
  private cell: { x: number; y: number };
  private heading: Dir | null = null;
  private grow = 0;
  private readonly speed = 0.38 + Math.random() * 0.14;

  constructor(library: ModelLibrary, start: { x: number; y: number }, model: ModelKey, light?: SpriteMaterial) {
    const size = library.size(model);
    if (light) {
      const lamp = new Sprite(light);
      lamp.position.set(0, 0.05, 0.11);
      lamp.scale.setScalar(0.14);
      this.root.add(lamp);
    }
    const alongX = size ? size.x > size.z : false;
    for (const mesh of library.buildProps([{ model, x: 0, z: 0, y: 0, rotY: alongX ? -Math.PI / 2 : 0, fit: 0.17 }], "solid")) {
      mesh.castShadow = false;
      this.root.add(mesh);
    }
    this.cell = { ...start };
    this.pos.set(start.x, PLATE_TOP + 0.02, start.y);
    this.target.copy(this.pos);
    this.root.position.copy(this.pos);
    this.root.scale.setScalar(0.001);
  }

  update(dt: number, board: Board): void {
    if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 3);
      this.root.scale.setScalar(easeOutBack(this.grow));
    }
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    if (!moveToward(this.pos, this.target, dt * this.speed)) {
      const want = Math.atan2(dx, dz);
      let delta = want - this.root.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.root.rotation.y += delta * Math.min(1, dt * 8);
      this.root.position.copy(this.pos);
      return;
    }
    this.root.position.copy(this.pos);
    const exits = roadExits(board, this.cell.x, this.cell.y);
    if (!exits.length) return;
    const back = this.heading === null ? null : (((this.heading + 2) % 4) as Dir);
    const forward = exits.filter((d) => d !== back);
    const options = forward.length ? forward : exits;
    const d = options[Math.floor(Math.random() * options.length)];
    this.heading = d;
    this.cell = { x: this.cell.x + DX[d], y: this.cell.y + DY[d] };
    const node = nodePosition(board, this.cell.x, this.cell.y);
    this.target.set(node.x - DY[d] * CAR_LANE, this.pos.y, node.z + DX[d] * CAR_LANE);
  }
}

class Animal {
  readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private readonly target = new Vector3();
  private wait = Math.random() * 3;
  private readonly speed: number;

  constructor(
    rig: Rig,
    private readonly kind: string,
    private tile: { x: number; y: number },
    private readonly area?: Area,
  ) {
    this.puppet = new Puppet(rig, PET_HEIGHT[kind] ?? 0.08, rig.clips);
    this.speed = kind === "bunny" ? 0.14 : kind === "caterpillar" ? 0.025 : kind === "cow" || kind === "elephant" || kind === "polar" ? 0.06 : 0.09;
    this.pos.set(tile.x + (Math.random() - 0.5) * 0.5, PLATE_TOP + (kind === "fish" ? 0.0 : 0.035), tile.y + (Math.random() - 0.5) * 0.5);
    if (kind === "fish") this.pos.set(tile.x, PLATE_TOP + 0.005, tile.y);
    if (area) pointIn(area, this.pos);
    this.target.copy(this.pos);
    this.puppet.root.position.copy(this.pos);
    this.puppet.root.rotation.y = Math.random() * Math.PI * 2;
  }

  rest(dt: number): void {
    this.puppet.update(dt);
    this.puppet.play("idle");
    this.wait = Math.max(this.wait, 1 + Math.random() * 2);
  }

  update(dt: number, board: Board): void {
    this.puppet.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
    if (!moveToward(this.pos, this.target, dt * this.speed)) {
      this.puppet.play("walk");
      this.puppet.face(dx, dz, dt);
      this.puppet.root.position.copy(this.pos);
      return;
    }
    this.wait = 1.5 + Math.random() * 4;
    this.puppet.play(this.kind !== "fish" && Math.random() < 0.5 ? "eat" : "idle");
    if (this.kind === "fish") {
      const a = Math.random() * Math.PI * 2, r = 0.05 + Math.random() * 0.1;
      this.target.set(this.tile.x + Math.cos(a) * r, this.pos.y, this.tile.y + Math.sin(a) * r);
      this.wait = 0.3 + Math.random();
      return;
    }
    if (this.area) {
      pointIn(this.area, this.target);
      return;
    }
    const exits = grassExits(board, this.tile.x, this.tile.y);
    if (exits.length && Math.random() < 0.2) {
      const d = exits[Math.floor(Math.random() * exits.length)];
      this.tile = { x: this.tile.x + DX[d], y: this.tile.y + DY[d] };
    }
    this.target.set(this.tile.x + (Math.random() - 0.5) * 0.7, this.pos.y, this.tile.y + (Math.random() - 0.5) * 0.7);
  }
}

interface Pose {
  x: number;
  z: number;
  yaw: number;
}

interface Runaround {
  phase: "lift" | "run" | "drop" | "done";
  t: number;
  unit: number;
  dir: number;
  head: number;
  newHead: number;
  ox: number;
  oz: number;
  s: number;
  speed: number;
  from: Pose[];
}

interface TrackPoint {
  x: number;
  z: number;
  s: number;
}

function trackPoints(line: RailLine, marks: number[] = []): TrackPoint[] {
  const pts: { x: number; z: number }[] = [];
  const push = (x: number, z: number) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - x, last.z - z) > 1e-4) pts.push({ x, z });
  };
  const segment = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.03));
    for (let i = 0; i <= n; i++) push(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
  };
  for (const st of line.steps) {
    marks.push(pts.length);
    const edge = (d: Dir) => ({ x: st.x + DX[d] * 0.5, z: st.y + DY[d] * 0.5 });
    const stop = (d: Dir) => ({ x: st.x + DX[d] * 0.02, z: st.y + DY[d] * 0.02 });
    if (st.from === null && st.to !== null) {
      const a = stop(st.to), b = edge(st.to);
      segment(a.x, a.z, b.x, b.z);
    } else if (st.to === null && st.from !== null) {
      const a = edge(st.from), b = stop(st.from);
      segment(a.x, a.z, b.x, b.z);
    } else if (st.from !== null && st.to !== null) {
      const a = edge(st.from), b = edge(st.to);
      if ((st.from + 2) % 4 === st.to) segment(a.x, a.z, b.x, b.z);
      else {
        const cx = st.x + (DX[st.from] + DX[st.to]) * 0.5, cz = st.y + (DY[st.from] + DY[st.to]) * 0.5;
        const a0 = Math.atan2(a.z - cz, a.x - cx);
        const a1 = Math.atan2(b.z - cz, b.x - cx);
        const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
        for (let i = 0; i <= 16; i++) {
          const ang = a0 + (delta * i) / 16;
          push(cx + Math.cos(ang) * 0.5, cz + Math.sin(ang) * 0.5);
        }
      }
    }
  }
  if (line.loop) push(pts[0].x, pts[0].z);
  let s = 0;
  return pts.map((p, i) => {
    if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    return { ...p, s };
  });
}

class Train {
  readonly root = new Group();
  private readonly cars: Group[] = [];
  private readonly points: TrackPoint[];
  private readonly length: number;
  private head: number;
  private dir = 1;
  private dwell = 0;
  private grow = 0;
  private readonly stops: number[] = [];
  private nextStop = 0;
  private served: number | null = null;
  private turnPending = false;
  private runaround: Runaround | null = null;

  constructor(
    private readonly line: RailLine,
    library: ModelLibrary,
    halts: boolean[] = [],
    light?: SpriteMaterial,
    consist: ModelKey[] = ["locomotive", "tender", "wagon"],
    offset = 0,
  ) {
    const marks: number[] = [];
    this.points = trackPoints(line, marks);
    this.length = this.points[this.points.length - 1].s;
    line.steps.forEach((_, i) => {
      if (!halts[i]) return;
      const start = this.points[Math.min(marks[i], this.points.length - 1)].s;
      const end = i + 1 < marks.length ? this.points[Math.min(marks[i + 1], this.points.length - 1)].s : this.length;
      this.stops.push((start + end) / 2);
    });
    const maxCars = line.loop
      ? Math.floor((this.length - 0.3) / CAR_SPACING)
      : Math.floor((this.length - 0.08) / CAR_SPACING) - 1;
    const kinds = consist.slice(0, Math.max(1, Math.min(3, maxCars)));
    for (const kind of kinds) {
      const size = library.size(kind);
      const car = new Group();
      const alongX = size ? size.x > size.z : false;
      for (const mesh of library.buildProps([{ model: kind, x: 0, z: 0, y: 0, rotY: alongX ? -Math.PI / 2 : 0, fit: 0.24 }], "solid")) {
        mesh.castShadow = false;
        car.add(mesh);
      }
      if (light && kind === "locomotive") {
        const lamp = new Sprite(light);
        lamp.position.set(0, 0.1, 0.14);
        lamp.scale.setScalar(0.18);
        car.add(lamp);
      }
      this.cars.push(car);
      this.root.add(car);
    }
    this.head = line.loop ? offset * this.length : Math.min(this.length - 0.04, (this.cars.length - 1) * CAR_SPACING + 0.04);
    this.root.scale.setScalar(0.001);
    this.place();
  }

  private sample(s: number): { x: number; z: number; tx: number; tz: number } {
    const pts = this.points;
    if (this.line.loop) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length, s));
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].s <= s) lo = mid;
      else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    const tx = b.x - a.x, tz = b.z - a.z;
    return { x: a.x + tx * t, z: a.z + tz * t, tx, tz };
  }

  private poses(head: number, dir: number): Pose[] {
    return this.cars.map((_, i) => {
      const p = this.sample(head - dir * i * CAR_SPACING);
      return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) + (dir < 0 ? Math.PI : 0) };
    });
  }

  private place(): void {
    this.poses(this.head, this.dir).forEach((p, i) => {
      this.cars[i].position.set(p.x, PLATE_TOP + 0.05, p.z);
      this.cars[i].rotation.y = p.yaw;
    });
  }

  private pose(s: number, dir: number): Pose {
    const p = this.sample(s);
    return { x: p.x, z: p.z, yaw: Math.atan2(p.tx, p.tz) + (dir < 0 ? Math.PI : 0) };
  }

  private startRunaround(): void {
    const n = this.cars.length;
    const unit = Math.min(2, n);
    const wagons = n - unit;
    const h = this.sample(this.head);
    const len = Math.hypot(h.tx, h.tz) || 1;
    const fx = (h.tx / len) * this.dir, fz = (h.tz / len) * this.dir;
    const side = wagons > 0 ? SIDING_OFFSET : 0;
    this.runaround = {
      phase: "lift",
      t: 0,
      unit,
      dir: this.dir,
      head: this.head,
      newHead: this.head - this.dir * (wagons > 0 ? unit + n - 1 : n - 1) * CAR_SPACING,
      ox: fz * side,
      oz: -fx * side,
      s: this.head - this.dir * (unit - 1) * CAR_SPACING,
      speed: 0,
      from: this.poses(this.head, this.dir).slice(0, unit),
    };
  }

  private unitPose(r: Runaround, j: number, offset: number, lift: number): void {
    const p = this.pose(r.s + r.dir * j * CAR_SPACING, -r.dir);
    this.cars[j].position.set(p.x + r.ox * offset, PLATE_TOP + 0.05 + lift, p.z + r.oz * offset);
    this.cars[j].rotation.y = p.yaw;
  }

  private updateRunaround(dt: number): void {
    const r = this.runaround!;
    if (r.phase === "lift") {
      r.t = Math.min(1, r.t + dt / 0.6);
      const k = r.t * r.t * (3 - 2 * r.t);
      const a = r.from[0], b = r.from[r.unit - 1];
      const cx = (a.x + b.x) / 2, cz = (a.z + b.z) / 2;
      const spin = Math.PI * k;
      const snap = r.t ** 4;
      for (let j = 0; j < r.unit; j++) {
        const f = r.from[j];
        const dx = f.x - cx, dz = f.z - cz;
        const rx = cx + dx * Math.cos(spin) + dz * Math.sin(spin) + r.ox * k;
        const rz = cz - dx * Math.sin(spin) + dz * Math.cos(spin) + r.oz * k;
        const end = this.pose(r.s + r.dir * j * CAR_SPACING, -r.dir);
        this.cars[j].position.set(
          rx * (1 - snap) + (end.x + r.ox) * snap,
          PLATE_TOP + 0.05 + Math.sin(Math.PI * r.t) * 0.08,
          rz * (1 - snap) + (end.z + r.oz) * snap,
        );
        this.cars[j].rotation.y = f.yaw + spin;
      }
      if (r.t >= 1) r.phase = r.unit === this.cars.length ? "done" : "run";
    } else if (r.phase === "run") {
      const left = Math.max(0, (r.s - r.newHead) * r.dir);
      r.speed = Math.min(TRAIN_SPEED * 0.6, r.speed + dt * 0.9, 0.12 + left * 1.2);
      r.s -= r.dir * Math.min(r.speed * dt, left);
      for (let j = 0; j < r.unit; j++) this.unitPose(r, j, 1, 0);
      if (left <= r.speed * dt + 1e-6) {
        r.s = r.newHead;
        r.phase = "drop";
        r.t = 0;
      }
    } else if (r.phase === "drop") {
      r.t = Math.min(1, r.t + dt / 0.45);
      const k = r.t * r.t * (3 - 2 * r.t);
      for (let j = 0; j < r.unit; j++) this.unitPose(r, j, 1 - k, Math.sin(Math.PI * r.t) * 0.06);
      if (r.t >= 1) r.phase = "done";
    }
    if (r.phase !== "done") return;
    const unitCars = this.cars.slice(0, r.unit);
    const wagonCars = this.cars.slice(r.unit).reverse();
    this.cars.splice(0, this.cars.length, ...unitCars, ...wagonCars);
    this.head = r.newHead;
    this.dir = -r.dir;
    this.runaround = null;
    this.dwell = wagonCars.length ? 0.8 : 0.3;
    this.place();
  }

  get start(): { x: number; y: number } {
    return { x: this.line.steps[0].x, y: this.line.steps[0].y };
  }

  update(dt: number): void {
    if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 2.5);
      this.root.scale.setScalar(1);
      for (const car of this.cars) car.scale.setScalar(easeOutBack(this.grow));
    }
    if (this.runaround) {
      this.updateRunaround(dt);
      return;
    }
    if (this.dwell > 0) {
      this.dwell -= dt;
      if (this.dwell <= 0 && this.turnPending) {
        this.turnPending = false;
        this.startRunaround();
      }
      return;
    }
    if (this.line.loop) {
      if (!this.stops.length) {
        this.head += TRAIN_SPEED * dt;
      } else {
        const half = ((this.cars.length - 1) * CAR_SPACING) / 2;
        const stop = this.stops[this.nextStop % this.stops.length];
        let ahead = (((stop - (this.head - half)) % this.length) + this.length) % this.length;
        const nearStop = ahead < 0.05 || ahead > this.length - 0.05;
        if (this.served === stop && nearStop) ahead = this.length;
        else {
          if (this.served === stop) this.served = null;
          if (ahead > this.length - 1e-4) ahead = 0;
        }
        const step = TRAIN_SPEED * Math.min(1, 0.25 + ahead / 0.45) * dt;
        if (ahead <= step) {
          this.head += ahead;
          this.dwell = 2;
          this.served = stop;
          this.nextStop++;
        } else {
          this.head += step;
        }
      }
    } else {
      const half = ((this.cars.length - 1) * CAR_SPACING) / 2;
      const end = this.dir > 0 ? this.length - 0.04 : 0.04;
      let target = end;
      let halt = false;
      for (const stop of this.stops) {
        const at = stop + this.dir * half;
        const ahead = (at - this.head) * this.dir;
        if (stop !== this.served && ahead >= 0 && (at - end) * this.dir < 0 && ahead < (target - this.head) * this.dir) {
          target = at;
          halt = true;
        }
      }
      const toTarget = Math.max(0, (target - this.head) * this.dir);
      const speed = TRAIN_SPEED * Math.min(1, 0.2 + toTarget / 0.4);
      this.head += this.dir * Math.min(speed * dt, toTarget);
      if (toTarget <= speed * dt) {
        this.head = target;
        this.dwell = halt ? 2 : 1.4;
        this.turnPending = !halt;
        this.served = halt ? this.stops.find((st) => Math.abs(st + this.dir * half - target) < 1e-6) ?? null : null;
      }
    }
    this.place();
  }
}

export class Agents {
  readonly root = new Group();
  private readonly people: Rig[] = [];
  private readonly pets = new Map<string, Rig>();
  private readonly trains = new Map<string, Train>();
  private readonly persons = new Map<string, Person>();
  private readonly animals = new Map<string, Animal>();
  private readonly cars: Car[] = [];
  private readonly roads = new Set<string>();
  private readonly specials = new Map<string, number>();
  private readonly lives: Life[] = [];
  private readonly landmarks = new Set<string>();
  private readonly shuttles = new Map<string, Shuttle>();
  private readonly jumpers = new Map<string, Jumper>();
  private readonly snows: Snow[] = [];
  private readonly guards: { castle: Placed; patrols: Patrol[] }[] = [];
  private clock = -1;
  stages = 0;
  private gifts = false;
  private readonly headlight = new SpriteMaterial({
    map: glowTexture(),
    color: 0xfff1cf,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly frustum = new Frustum();
  private readonly projScreen = new Matrix4();
  private readonly cap: number;

  constructor(private readonly library: ModelLibrary, coarse: boolean) {
    this.cap = coarse ? 80 : 160;
  }

  async load(onProgress: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const jobs: [string, string][] = [
      ...catalog.agents.people.files.map((f) => ["people", f] as [string, string]),
      ...catalog.agents.pets.files.map((f) => ["pets", f] as [string, string]),
    ];
    let done = 0;
    await Promise.all(
      jobs.map(async ([group, file], i) => {
        const gltf = await loader.loadAsync(modelUrl(group, file));
        const box = new Box3().setFromObject(gltf.scene);
        const rig: Rig = { scene: gltf.scene, clips: gltf.animations, height: box.max.y - box.min.y, minY: box.min.y };
        if (group === "people") this.people[i] = rig;
        else this.pets.set(file.replace("animal-", "").replace(".glb", ""), rig);
        onProgress(++done, jobs.length);
      }),
    );
    this.people.splice(0, this.people.length, ...this.people.filter(Boolean));
  }

  census(): { cars: number; trains: number; animals: number } {
    return { cars: this.cars.length, trains: this.trains.size, animals: this.animals.size };
  }

  clear(): void {
    this.root.clear();
    this.trains.clear();
    this.persons.clear();
    this.animals.clear();
    this.cars.length = 0;
    this.roads.clear();
    this.specials.clear();
    this.lives.length = 0;
    this.landmarks.clear();
    this.shuttles.clear();
    this.jumpers.clear();
    this.snows.length = 0;
    this.guards.length = 0;
    this.stages = 0;
    this.gifts = false;
  }

  sync(
    board: Board,
    seed: number,
  ): { trains: { x: number; y: number }[]; roads: { x: number; y: number }[]; specials: { kind: Special; x: number; y: number }[] } {
    const opened: { kind: Special; x: number; y: number }[] = [];
    const roadCells = completedRoadCells(board);
    for (const p of board.all()) {
      if (!p.tile.special) continue;
      const key = `${p.x},${p.y}`;
      const status = specialStatus(board, p, roadCells);
      const had = this.specials.get(key) ?? 0;
      if (status.count <= had) continue;
      if (had === 0) opened.push({ kind: p.tile.special, x: p.x, y: p.y });
      this.spawnSpecial(p, seed, had, status.count, board);
      this.specials.set(key, status.count);
    }
    const newTrains: { x: number; y: number }[] = [];
    const newRoads: { x: number; y: number }[] = [];
    for (const net of completedRoadNetworks(board)) {
      if (this.roads.has(net.key)) continue;
      this.roads.add(net.key);
      newRoads.push(net.cells[0]);
      const count = Math.max(1, Math.floor(net.cells.length / 4));
      for (let i = 0; i < count && this.cars.length < this.cap / 4; i++) {
        const h = hash(seed, net.cells[0].x, net.cells[0].y, 3 + i);
        const car = new Car(this.library, net.cells[h % net.cells.length], CAR_MODELS[(h >>> 8) % CAR_MODELS.length], this.headlight);
        this.cars.push(car);
        this.root.add(car.root);
      }
    }
    const gifts = [...board.all()].some((p) => p.tile.landmark === "xmas");
    if (gifts !== this.gifts) {
      this.gifts = gifts;
      for (const t of this.trains.values()) this.root.remove(t.root);
      this.trains.clear();
    }
    for (const line of completedRailLines(board)) {
      if (this.trains.has(line.key)) continue;
      const halts = line.steps.map((st) => !!board.get(st.x, st.y)?.tile.halt);
      const train = new Train(line, this.library, halts, this.headlight, gifts ? GIFT_TENDER : undefined);
      this.trains.set(line.key, train);
      this.root.add(train.root);
      newTrains.push(train.start);
      if (gifts && line.loop && !halts.some(Boolean) && line.steps.length >= GIFT_LOOP_MIN) {
        const extra = new Train(line, this.library, halts, this.headlight, GIFT_TRAIN, 0.5);
        this.trains.set(`gift:${line.key}`, extra);
        this.root.add(extra.root);
      }
    }
    this.syncLandmarks(board, seed);
    for (const p of board.all()) {
      const key = `${p.x},${p.y}`;
      if (isHome(p) && !this.persons.has(key) && this.persons.size < this.cap && this.people.length) {
        const rig = this.people[hash(seed, p.x, p.y, 1) % this.people.length];
        const person = new Person(rig, { x: p.x, y: p.y }, board);
        this.persons.set(key, person);
        this.root.add(person.puppet.root);
      }
      if (isMeadow(p) && !this.animals.has(key) && this.animals.size < this.cap) {
        const h = hash(seed, p.x, p.y, 2);
        const kind = isPond(p) ? (h % 3 === 0 ? "beaver" : "fish") : MEADOW_PETS[h % MEADOW_PETS.length];
        const rig = this.pets.get(kind);
        if (!rig) continue;
        const animal = new Animal(rig, kind, { x: p.x, y: p.y });
        this.animals.set(key, animal);
        this.root.add(animal.puppet.root);
      }
    }
    return { trains: newTrains, roads: newRoads, specials: opened };
  }

  private addLife(life: Life): void {
    this.lives.push(life);
    this.root.add(life.root);
  }

  private nearest(board: Board, p: Placed, test: (q: Placed) => boolean, radius = 3): Placed | undefined {
    let best: Placed | undefined, bestD = Infinity;
    for (const q of board.all()) {
      const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
      if (d > 0 && d <= radius && d < bestD && test(q)) [best, bestD] = [q, d];
    }
    return best;
  }

  private syncLandmarks(board: Board, seed: number): void {
    const water = edgeRegions(board, "water");
    for (const p of board.all()) {
      if (!p.tile.landmark) continue;
      const key = `${p.x},${p.y}`;
      if (!this.landmarks.has(key)) {
        this.landmarks.add(key);
        this.spawnLandmark(p, board, seed);
      }
      const farm = p.tile.landmark === "windmill" && this.nearest(board, p, (q) => q.tile.special === "farm" || isMeadow(q));
      if (farm) this.shuttles.get(key)?.retarget(gateOf(farm, p));
      const fish = this.jumpers.get(key);
      if (fish) fish.setCells((regionAt(water, p.x, p.y)?.cells ?? []).map((c) => ({ x: c.x, z: c.y })));
    }
  }

  private spawnLandmark(p: Placed, board: Board, seed: number): void {
    const h = (i: number) => hash(seed, p.x, p.y, 70 + i);
    const key = `${p.x},${p.y}`;
    const spot = (x: number, z: number): Spot => onTile(p, x, z);
    switch (p.tile.landmark) {
      case "windmill": {
        this.addLife(new Spinner(this.library, LANDMARK_PROPS.windmill, "windmill_fan", p, 0.9));
        const rig = this.people[h(0) % this.people.length];
        if (!rig) break;
        const barrow = this.library.buildProps([{ model: "wheelbarrow", x: 0, z: 0.12, y: 0, rotY: Math.PI / 2, fit: 0.14 }], "solid");
        const farm = this.nearest(board, p, (q) => q.tile.special === "farm" || isMeadow(q));
        const shuttle = new Shuttle(rig, PERSON_HEIGHT, spot(0.18, 0.22), farm ? gateOf(farm, p) : spot(-0.3, 0.3), barrow);
        this.shuttles.set(key, shuttle);
        this.addLife(shuttle);
        break;
      }
      case "market": {
        this.addPerson(h(1), p, board, tileArea(p, 0, -0.32, 0.04), "interact-right");
        for (let i = 0; i < 2; i++) this.addPerson(h(2 + i), p, board, tileArea(p, 0, 0.02, 0.14), "idle");
        for (let i = 0; i < 2 && this.people.length; i++) {
          const walker = new Person(this.people[h(4 + i) % this.people.length], { x: p.x, y: p.y }, board);
          this.persons.set(`${key}:walker:${i}`, walker);
          this.root.add(walker.puppet.root);
        }
        break;
      }
      case "garden": {
        const flowers = tileArea(p, 0, 0, 0.36);
        const bee = this.pets.get("bee");
        if (bee) for (let i = 0; i < 3; i++) this.addLife(new Flyer(bee, PET_HEIGHT.bee, flowers, BEE));
        const parrot = this.pets.get("parrot");
        const land = (x: number, z: number) => board.has(Math.round(x), Math.round(z));
        if (parrot) this.addLife(new Flyer(parrot, PET_HEIGHT.parrot, { x: p.x, z: p.y, r: 1.2 }, PARROT, land));
        this.addAnimal("caterpillar", p, flowers);
        this.addPerson(h(6), p, board, tileArea(p, -0.14, 0.2, 0.01), "interact-right");
        break;
      }
      case "lighthouse": {
        const lp = LANDMARK_PROPS.lighthouse;
        const at = onTile(p, lp.x, lp.z);
        this.addLife(new Beam(new Vector3(at.x, PLATE_TOP + lp.lift + lp.height * 0.86, at.z)));
        this.addAnimal("beaver", p, tileArea(p, 0, 0, 0.12));
        const fish = this.pets.get("fish");
        if (fish) {
          const jumper = new Jumper(fish, []);
          this.jumpers.set(key, jumper);
          this.addLife(jumper);
        }
        break;
      }
      case "church": {
        const rigs = [0, 1, 2, 3, 4].map((i) => this.people[h(10 + i) % this.people.length]).filter(Boolean);
        const route = () => {
          const road = this.nearest(board, p, (q) => roadExits(board, q.x, q.y).length > 0);
          return road ? [spot(0, 0.3), ...this.roadWalk(board, road, h(20) + Math.floor(Math.random() * 1000), 7)] : [];
        };
        this.addLife(new Parade(rigs, PERSON_HEIGHT, route, 45));
        break;
      }
      case "castle": {
        const c = 0.4;
        const path = [spot(-c, -c), spot(c, -c), spot(c, c), spot(-c, c)];
        const rig = this.people[OFFICER % this.people.length];
        if (!rig) break;
        const patrols = [0, 2].map((i) => new Patrol(rig, PERSON_HEIGHT, path, i));
        patrols.forEach((pt) => this.addLife(pt));
        this.guards.push({ castle: p, patrols });
        const cp = LANDMARK_PROPS.castle;
        const top = (this.library.size(cp.model)?.y ?? 0.5) * this.library.scaleFor(cp);
        const at = onTile(p, 0, 0);
        this.addLife(new Flag(new Vector3(at.x, PLATE_TOP + top - 0.02, at.z), 0xe0a193));
        break;
      }
      case "watermill": {
        this.addLife(new Spinner(this.library, LANDMARK_PROPS.watermill, "watermill_wheel", p, -0.8));
        const rod = new Mesh(new BoxGeometry(0.006, 0.006, 0.22), new MeshBasicMaterial({ color: 0x8a7a6c }));
        rod.position.set(0.03, 0.08, 0.1);
        rod.rotation.x = -0.5;
        const bank = spot(-0.22, 0.3);
        const water = spot(0, 0.3);
        const rig = this.people[h(30) % this.people.length];
        if (rig) this.addLife(new Performer(rig, PERSON_HEIGHT, bank, Math.atan2(water.x - bank.x, water.z - bank.z), ["sit"], (n) => n <= 0.7, 0.02, [rod]));
        const miller = this.people[h(31) % this.people.length];
        const road = this.nearest(board, p, (q) => hasRoad(board, q.x, q.y));
        if (miller) {
          const sack = this.library.buildProps([{ model: "sack", x: 0, z: 0.06, y: 0.07, rotY: 0, fit: 0.07 }], "solid");
          const shuttle = new Shuttle(miller, PERSON_HEIGHT, spot(0.12, -0.3), road ? gateOf(road, p) : spot(-0.3, -0.3), sack);
          this.shuttles.set(key, shuttle);
          this.addLife(shuttle);
        }
        break;
      }
      case "stage": {
        this.stages++;
        const show = (n: number) => n > 0.35;
        const facing = (at: Spot, look: Spot) => Math.atan2(look.x - at.x, look.z - at.z);
        const front = spot(0, 0.3);
        const back = spot(0, -0.5);
        const acts: [number, string[]][] = [
          [-0.13, ["emote-yes", "interact-left"]],
          [0.13, ["holding-both", "emote-yes"]],
        ];
        acts.forEach(([x, anims], i) => {
          const rig = this.people[h(40 + i) % this.people.length];
          const at = spot(x, -0.22);
          if (rig) this.addLife(new Performer(rig, PERSON_HEIGHT, at, facing(at, front), anims, show, 0.08));
        });
        const cat = this.pets.get("cat");
        const mid = spot(0, -0.12);
        if (cat) this.addLife(new Performer(cat, PET_HEIGHT.cat, mid, facing(mid, front), ["dance"], show, 0.08));
        for (const [i, x] of [-0.28, -0.16, 0.16, 0.28].entries()) {
          const rig = this.people[h(44 + i) % this.people.length];
          const at = spot(x, 0.14);
          if (rig) this.addLife(new Performer(rig, PERSON_HEIGHT, at, facing(at, back), ["sit"], show, 0.03));
        }
        break;
      }
      case "sports": {
        const rigs = [0, 1, 2].map((i) => this.people[h(50 + i) % this.people.length]).filter(Boolean);
        const ball = this.library.solidMesh("football");
        if (ball) ball.scale.setScalar(this.library.scaleFor({ model: "football", fit: 0.045 }));
        this.addLife(new Match(rigs, ball, tileArea(p, 0, -0.15, 0.26)));
        for (const [i, x] of [-0.3, 0.32].entries()) {
          const rig = this.people[h(55 + i) % this.people.length];
          const at = spot(x, 0.24);
          const field = spot(0, -0.15);
          if (rig) this.addLife(new Performer(rig, PERSON_HEIGHT, at, Math.atan2(field.x - at.x, field.z - at.z), ["idle", "emote-yes"], (n) => n <= 0.5));
        }
        break;
      }
      case "lumber": {
        const rig = this.people[h(60) % this.people.length];
        const tree = this.library.solidMesh("tree_3");
        if (rig && tree) {
          const log = new Mesh(new BoxGeometry(0.03, 0.03, 0.16), new MeshStandardMaterial({ color: 0xa08670, roughness: 0.9 }));
          log.position.set(0.05, 0.1, 0.03);
          const scale = this.library.scaleFor({ model: "tree_3", fit: 0.24, maxHeight: 0.36 });
          this.addLife(new Lumberjack(rig, tree, scale, spot(0.32, -0.3), spot(0.05, 0.12), log));
        }
        const koala = this.pets.get("koala");
        const perch = spot(-0.32, 0.3);
        if (koala) this.addLife(new Performer(koala, 0.06, perch, h(61) % 6, ["idle", "eat"], () => true, 0.31));
        break;
      }
      case "gingerbread": {
        const man = this.library.solidMesh("gingerbread_man");
        if (man) {
          const scale = this.library.scaleFor({ model: "gingerbread_man", fit: 0.09 });
          const half = (this.library.size("gingerbread_man")?.z ?? 0) / 2;
          for (let i = 0; i < 2; i++) {
            const body = man.clone();
            body.position.y = half;
            this.addLife(new Hopper(body, scale, { x: p.x, z: p.y, r: 0.4 }));
          }
        }
        const rigs = [0, 1, 2].map((i) => this.people[h(65 + i) % this.people.length]).filter(Boolean);
        if (rigs.length === 3) this.addLife(new Queue(rigs, spot(0, 0.06), [spot(0, 0.2), spot(0.07, 0.29), spot(0.14, 0.38)]));
        break;
      }
      case "tavern": {
        const door = spot(0, 0.06);
        this.addLife(new Glow(new Vector3(door.x, PLATE_TOP + 0.12, door.z), 0.5));
        const rig = this.people[h(70) % this.people.length];
        const home = () => {
          const q = this.nearest(board, p, isHome, 4);
          return q ? { x: q.x, z: q.y } : null;
        };
        if (rig) this.addLife(new Stagger(rig, door, home));
        for (const [i, kind] of ["cat", "dog"].entries()) {
          const pet = this.pets.get(kind);
          const at = spot(i ? 0.14 : -0.14, 0.14);
          if (pet) this.addLife(new Performer(pet, PET_HEIGHT[kind], at, Math.atan2(door.x - at.x, door.z - at.z) + Math.PI, ["idle", "eat"]));
        }
        break;
      }
      case "xmas": {
        const snow = new Snow({ x: p.x, z: p.y });
        this.snows.push(snow);
        this.addLife(snow);
        this.addAnimal("polar", p, tileArea(p, -0.2, 0.22, 0.14));
        break;
      }
    }
  }

  private roadWalk(board: Board, start: Placed, seed: number, steps: number): Spot[] {
    const out: Spot[] = [];
    let cell = { x: start.x, y: start.y };
    let heading: Dir | null = null;
    for (let i = 0; i < steps; i++) {
      const node = nodePosition(board, cell.x, cell.y);
      out.push({ x: node.x, z: node.z });
      const exits = roadExits(board, cell.x, cell.y);
      const back: Dir | null = heading === null ? null : (((heading + 2) % 4) as Dir);
      const forward: Dir[] = exits.filter((d) => d !== back);
      const options: Dir[] = forward.length ? forward : exits;
      if (!options.length) break;
      const d: Dir = options[hash(seed, i) % options.length];
      heading = d;
      cell = { x: cell.x + DX[d], y: cell.y + DY[d] };
    }
    return out;
  }

  private addAnimal(kind: string, p: Placed, area: Area): void {
    const rig = this.pets.get(kind);
    if (!rig) return;
    const a = new Animal(rig, kind, { x: p.x, y: p.y }, area);
    this.animals.set(`${p.x},${p.y}:${kind}:${this.animals.size}`, a);
    this.root.add(a.puppet.root);
  }

  private addPerson(index: number, p: Placed, board: Board, area: Area, idle: string): void {
    const rig = this.people[index % this.people.length];
    if (!rig) return;
    const person = new Person(rig, { x: p.x, y: p.y }, board, { area, idle });
    this.persons.set(`${p.x},${p.y}:visitor:${this.persons.size}`, person);
    this.root.add(person.puppet.root);
  }

  private spawnSpecial(p: Placed, seed: number, from: number, to: number, board: Board): void {
    const h = (i: number) => hash(seed, p.x, p.y, 40 + i);
    if (p.tile.special === "zoo" && from === 0) {
      const pen = tileArea(p, 0, -0.1, 0.24);
      for (let i = 0; i < 3; i++) this.addAnimal(ZOO_PETS[h(i) % ZOO_PETS.length], p, pen);
      for (let i = 0; i < 2; i++) this.addPerson(h(10 + i), p, board, tileArea(p, 0, 0.36, 0.1), "idle");
    } else if (p.tile.special === "farm") {
      const pen = tileArea(p, 0.1, 0.1, 0.24);
      for (let i = from; i < to; i++) this.addAnimal(FARM_PETS[h(i) % FARM_PETS.length], p, pen);
    } else if (p.tile.special === "police" && from === 0) {
      this.addPerson(OFFICER, p, board, tileArea(p, -0.08, 0.06, 0.05), "idle");
      const car = new Car(this.library, { x: p.x, y: p.y }, "car_police", this.headlight);
      this.cars.push(car);
      this.root.add(car.root);
    } else if (p.tile.special === "beach") {
      const sand = tileArea(p, 0, 0, 0.32);
      for (let i = from; i < to; i++) this.addAnimal(i === 0 ? "penguin" : "crab", p, sand);
      if (from === 0) for (let i = 0; i < 2; i++) this.addPerson(h(20 + i), p, board, sand, "sit");
    }
  }

  update(dt: number, board: Board, view?: { camera: Camera; pixelsPerUnit: number }, night = 0, clock = -1): void {
    if (this.clock >= 0 && clock >= NOON && this.clock < NOON) {
      for (const g of this.guards) {
        const gate = onTile(g.castle, 0, 0.44);
        g.patrols.forEach((pt, i) => pt.gather({ x: gate.x + (i ? 0.07 : -0.07), z: gate.z }, { x: gate.x, z: gate.z }, 5));
      }
    }
    this.clock = clock;
    this.headlight.opacity = night;
    if (view) {
      view.camera.updateMatrixWorld();
      this.frustum.setFromProjectionMatrix(
        this.projScreen.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse),
      );
      const tiny = view.pixelsPerUnit * PERSON_HEIGHT < 4;
      for (const list of [this.persons.values(), this.animals.values()]) {
        for (const a of list) {
          const root = a.puppet.root;
          const home = a instanceof Person && night > a.bedtime;
          root.visible = !tiny && !home && this.frustum.containsPoint(root.position);
        }
      }
    }
    for (const t of this.trains.values()) t.update(dt);
    for (const p of this.persons.values()) if (night <= p.bedtime) p.update(dt, board);
    for (const a of this.animals.values()) {
      if (night > 0.6) a.rest(dt);
      else a.update(dt, board);
    }
    for (const c of this.cars) c.update(dt, board);
    if (view) for (const s of this.snows) s.setPixelSize(0.045 * view.pixelsPerUnit * Math.min(2, window.devicePixelRatio || 1));
    for (const l of this.lives) l.update(dt, night);
  }
}
