import { AnimationClip, AnimationMixer, Box3, Group, Mesh, Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Board } from "../core/board";
import { completedRailLines, completedRoadNetworks, grassExits, hasRoad, isHome, isMeadow, isPond, roadExits, type RailLine } from "../core/networks";
import { hash } from "../core/rng";
import { DIRS, DX, DY, groupsOf, type Dir } from "../core/tiles";
import catalog from "./assets.json";
import type { ModelKey, ModelLibrary } from "./models";
import { PLATE_TOP } from "./tileMeshes";

interface Rig {
  scene: Object3D;
  clips: AnimationClip[];
  height: number;
  minY: number;
}

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
};
const MEADOW_PETS = ["bunny", "chick", "cow", "pig", "deer", "fox", "dog", "cat"];
const PERSON_HEIGHT = 0.15;
const CAR_SPACING = 0.27;
const TRAIN_SPEED = 0.7;
const TURN_RADIUS = 0.13;

class Puppet {
  readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private current = "";
  private grow = 0;

  constructor(rig: Rig, height: number, private readonly clips: AnimationClip[]) {
    const body = rig.scene.clone(true);
    const scale = height / rig.height;
    body.scale.setScalar(scale);
    body.position.y = -rig.minY * scale;
    body.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = true;
    });
    this.root.add(body);
    this.root.scale.setScalar(0.001);
    this.mixer = new AnimationMixer(body);
    this.play("idle");
  }

  play(name: string): void {
    if (name === this.current) return;
    const clip = this.clips.find((c) => c.name === name) ?? this.clips.find((c) => c.name === "idle");
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    const prev = this.current ? this.mixer.existingAction(this.clips.find((c) => c.name === this.current)!) : null;
    next.reset().fadeIn(0.2).play();
    prev?.fadeOut(0.2);
    this.current = name;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 3);
      this.root.scale.setScalar(easeOutBack(this.grow));
    }
  }

  face(dx: number, dz: number, dt: number): void {
    if (Math.abs(dx) + Math.abs(dz) < 1e-5) return;
    const target = Math.atan2(dx, dz);
    let delta = target - this.root.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.root.rotation.y += delta * Math.min(1, dt * 10);
  }
}

function easeOutBack(t: number): number {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

function moveToward(pos: Vector3, target: Vector3, step: number): boolean {
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= step) {
    pos.x = target.x;
    pos.z = target.z;
    return true;
  }
  pos.x += (dx / dist) * step;
  pos.z += (dz / dist) * step;
  return false;
}

class Person {
  readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private readonly target = new Vector3();
  private cell: { x: number; y: number } | null;
  private heading: Dir | null = null;
  private wait = Math.random() * 2;
  private readonly side = (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.04);

  constructor(rig: Rig, private readonly home: { x: number; y: number }, board: Board) {
    this.puppet = new Puppet(rig, PERSON_HEIGHT, rig.clips);
    this.cell = hasRoad(board, home.x, home.y) ? { ...home } : null;
    if (!this.cell) {
      const d = DIRS.find((d) => hasRoad(board, home.x + DX[d], home.y + DY[d]));
      if (d !== undefined) this.cell = { x: home.x + DX[d], y: home.y + DY[d] };
    }
    const start = this.cell ?? home;
    this.pos.set(start.x, PLATE_TOP + 0.02, start.y);
    this.target.copy(this.pos);
    this.puppet.root.position.copy(this.pos);
    this.puppet.root.rotation.y = Math.random() * Math.PI * 2;
  }

  update(dt: number, board: Board): void {
    this.puppet.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      this.puppet.play("idle");
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

  constructor(library: ModelLibrary, start: { x: number; y: number }, model: ModelKey) {
    const size = library.size(model);
    const alongX = size ? size.x > size.z : false;
    for (const mesh of library.buildProps([{ model, x: 0, z: 0, y: 0, rotY: alongX ? -Math.PI / 2 : 0, fit: 0.17 }], "solid")) {
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

  constructor(rig: Rig, private readonly kind: string, private tile: { x: number; y: number }) {
    this.puppet = new Puppet(rig, PET_HEIGHT[kind] ?? 0.08, rig.clips);
    this.speed = kind === "bunny" ? 0.14 : kind === "cow" ? 0.06 : 0.09;
    this.pos.set(tile.x + (Math.random() - 0.5) * 0.5, PLATE_TOP + (kind === "fish" ? 0.0 : 0.035), tile.y + (Math.random() - 0.5) * 0.5);
    if (kind === "fish") this.pos.set(tile.x, PLATE_TOP + 0.005, tile.y);
    this.target.copy(this.pos);
    this.puppet.root.position.copy(this.pos);
    this.puppet.root.rotation.y = Math.random() * Math.PI * 2;
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

interface Turn {
  p: number;
  speed: number;
  trackLen: number;
  radius: number;
  tailS: number;
  headS: number;
  dir: number;
  hx: number;
  hz: number;
  fx: number;
  fz: number;
  nx: number;
  nz: number;
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
  private turn: Turn | null = null;
  private slide: { t: number; ox: number; oz: number } | null = null;

  constructor(private readonly line: RailLine, library: ModelLibrary, halts: boolean[] = []) {
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
      ? Math.max(1, Math.floor((this.length - 0.3) / CAR_SPACING))
      : Math.max(1, Math.floor((this.length - 0.1) / (2 * CAR_SPACING)) + 1);
    const kinds: ModelKey[] = ["locomotive", "tender", "wagon", "wagon"].slice(0, Math.min(4, maxCars)) as ModelKey[];
    for (const kind of kinds) {
      const size = library.size(kind);
      const car = new Group();
      const alongX = size ? size.x > size.z : false;
      for (const mesh of library.buildProps([{ model: kind, x: 0, z: 0, y: 0, rotY: alongX ? -Math.PI / 2 : 0, fit: 0.24 }], "solid")) {
        car.add(mesh);
      }
      this.cars.push(car);
      this.root.add(car);
    }
    this.head = line.loop ? 0 : Math.min(this.length - 0.04, (this.cars.length - 1) * CAR_SPACING + 0.04);
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
    const k = this.slide ? this.slide.t * this.slide.t * (3 - 2 * this.slide.t) : 1;
    const ox = this.slide ? this.slide.ox * (1 - k) : 0, oz = this.slide ? this.slide.oz * (1 - k) : 0;
    const lift = this.slide ? Math.sin(Math.PI * this.slide.t) * 0.08 : 0;
    this.poses(this.head, this.dir).forEach((p, i) => {
      this.cars[i].position.set(p.x + ox, PLATE_TOP + 0.05 + lift, p.z + oz);
      this.cars[i].rotation.y = p.yaw;
    });
  }

  private startTurn(): void {
    const n = this.cars.length;
    const h = this.sample(this.head);
    const len = Math.hypot(h.tx, h.tz) || 1;
    const fx = (h.tx / len) * this.dir, fz = (h.tz / len) * this.dir;
    this.turn = {
      p: (n - 1) * CAR_SPACING,
      speed: TRAIN_SPEED * 0.25,
      trackLen: (n - 1) * CAR_SPACING,
      radius: TURN_RADIUS,
      tailS: this.head - this.dir * (n - 1) * CAR_SPACING,
      headS: this.head,
      dir: this.dir,
      hx: h.x,
      hz: h.z,
      fx,
      fz,
      nx: fz,
      nz: -fx,
    };
  }

  private turnPose(turn: Turn, p: number): Pose & { lift: number } {
    if (p <= turn.trackLen) {
      const q = this.sample(turn.tailS + turn.dir * p);
      return { x: q.x, z: q.z, yaw: Math.atan2(q.tx * turn.dir, q.tz * turn.dir), lift: 0 };
    }
    const r = turn.radius;
    const u = p - turn.trackLen;
    const bend = Math.PI * r;
    if (u <= bend) {
      const a = u / r;
      const cx = turn.hx + turn.nx * r, cz = turn.hz + turn.nz * r;
      const x = cx - turn.nx * r * Math.cos(a) + turn.fx * r * Math.sin(a);
      const z = cz - turn.nz * r * Math.cos(a) + turn.fz * r * Math.sin(a);
      const tx = turn.nx * Math.sin(a) + turn.fx * Math.cos(a);
      const tz = turn.nz * Math.sin(a) + turn.fz * Math.cos(a);
      return { x, z, yaw: Math.atan2(tx, tz), lift: Math.sin(Math.PI * (u / bend)) * 0.06 };
    }
    const c = u - bend;
    return {
      x: turn.hx + 2 * r * turn.nx - turn.fx * c,
      z: turn.hz + 2 * r * turn.nz - turn.fz * c,
      yaw: Math.atan2(-turn.fx, -turn.fz),
      lift: 0,
    };
  }

  private updateTurn(dt: number): void {
    const turn = this.turn!;
    turn.speed = Math.min(TRAIN_SPEED * 0.6, turn.speed + dt * 0.8);
    turn.p += turn.speed * dt;
    const bend = Math.PI * turn.radius;
    const last = turn.p - (this.cars.length - 1) * CAR_SPACING;
    if (last >= turn.trackLen + bend) {
      this.dir = -turn.dir;
      this.head = turn.headS - turn.dir * (turn.p - turn.trackLen - bend);
      this.slide = { t: 0, ox: 2 * turn.radius * turn.nx, oz: 2 * turn.radius * turn.nz };
      this.turn = null;
      this.place();
      return;
    }
    this.cars.forEach((car, i) => {
      const pose = this.turnPose(turn, turn.p - i * CAR_SPACING);
      car.position.set(pose.x, PLATE_TOP + 0.05 + pose.lift, pose.z);
      car.rotation.y = pose.yaw;
    });
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
    if (this.turn) {
      this.updateTurn(dt);
      return;
    }
    if (this.slide) {
      this.slide.t = Math.min(1, this.slide.t + dt / 0.45);
      if (this.slide.t >= 1) this.slide = null;
    }
    if (this.dwell > 0) {
      this.dwell -= dt;
      if (this.dwell <= 0 && this.turnPending) {
        this.turnPending = false;
        this.startTurn();
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
  private readonly cap: number;

  constructor(private readonly library: ModelLibrary, coarse: boolean) {
    this.cap = coarse ? 80 : 160;
  }

  async load(onProgress: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const jobs: [string, string][] = [
      ...catalog.agents.people.files.map((f) => ["people", f] as [string, string]),
      ...catalog.agents.pets.files.map((f) => ["pets", f] as [string, string]),
    ];
    let done = 0;
    await Promise.all(
      jobs.map(async ([group, file], i) => {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${group}/${file}`);
        const box = new Box3().setFromObject(gltf.scene);
        const rig: Rig = { scene: gltf.scene, clips: gltf.animations, height: box.max.y - box.min.y, minY: box.min.y };
        if (group === "people") this.people[i] = rig;
        else this.pets.set(file.replace("animal-", "").replace(".glb", ""), rig);
        onProgress(++done, jobs.length);
      }),
    );
    this.people.splice(0, this.people.length, ...this.people.filter(Boolean));
  }

  clear(): void {
    this.root.clear();
    this.trains.clear();
    this.persons.clear();
    this.animals.clear();
    this.cars.length = 0;
    this.roads.clear();
  }

  sync(board: Board, seed: number): { trains: { x: number; y: number }[]; roads: { x: number; y: number }[] } {
    const newTrains: { x: number; y: number }[] = [];
    const newRoads: { x: number; y: number }[] = [];
    for (const net of completedRoadNetworks(board)) {
      if (this.roads.has(net.key)) continue;
      this.roads.add(net.key);
      newRoads.push(net.cells[0]);
      const count = Math.max(1, Math.floor(net.cells.length / 4));
      for (let i = 0; i < count && this.cars.length < this.cap / 4; i++) {
        const h = hash(seed, net.cells[0].x, net.cells[0].y, 3 + i);
        const car = new Car(this.library, net.cells[h % net.cells.length], CAR_MODELS[(h >>> 8) % CAR_MODELS.length]);
        this.cars.push(car);
        this.root.add(car.root);
      }
    }
    for (const line of completedRailLines(board)) {
      if (this.trains.has(line.key)) continue;
      const halts = line.steps.map((st) => !!board.get(st.x, st.y)?.tile.halt);
      const train = new Train(line, this.library, halts);
      this.trains.set(line.key, train);
      this.root.add(train.root);
      newTrains.push(train.start);
    }
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
    return { trains: newTrains, roads: newRoads };
  }

  update(dt: number, board: Board): void {
    for (const t of this.trains.values()) t.update(dt);
    for (const p of this.persons.values()) p.update(dt, board);
    for (const a of this.animals.values()) a.update(dt, board);
    for (const c of this.cars) c.update(dt, board);
  }
}
