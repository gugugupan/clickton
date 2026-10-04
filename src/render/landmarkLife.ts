import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import type { Placed } from "../core/board";
import type { ModelKey, ModelLibrary } from "./models";
import { Puppet, moveToward, pointIn, type Area, type Rig } from "./puppet";
import { glowTexture } from "./scene";
import { PLATE_TOP, type LandmarkProp } from "./tileMeshes";

export interface Spot {
  x: number;
  z: number;
}

export function onTile(p: Placed, x: number, z: number, rotY = 0): { x: number; z: number; yaw: number } {
  const angle = (-p.rot * Math.PI) / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: p.x + x * cos + z * sin, z: p.y - x * sin + z * cos, yaw: rotY + angle };
}

export interface Life {
  readonly root: Group;
  update(dt: number, night: number): void;
}

export class Spinner implements Life {
  readonly root = new Group();
  private readonly part: Mesh | null;
  private readonly axis: "x" | "y" | "z" = "z";

  constructor(library: ModelLibrary, whole: LandmarkProp, part: ModelKey, p: Placed, private readonly speed: number) {
    const at = onTile(p, whole.x, whole.z, whole.rotY);
    this.root.position.set(at.x, PLATE_TOP + whole.lift, at.z);
    this.root.rotation.y = at.yaw;
    this.root.scale.setScalar(library.scaleFor(whole));
    this.part = library.solidMesh(part);
    const size = library.size(part);
    if (size) this.axis = size.x <= size.y && size.x <= size.z ? "x" : size.z <= size.y ? "z" : "y";
    if (this.part) {
      this.part.position.copy(library.offset(part, whole.model) ?? new Vector3());
      this.part.castShadow = false;
      this.root.add(this.part);
    }
  }

  update(dt: number): void {
    if (this.part) this.part.rotation[this.axis] += this.speed * dt;
  }
}

export class Shuttle implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private toB = true;
  private wait = 1;

  constructor(
    rig: Rig,
    height: number,
    private readonly a: Spot,
    private b: Spot,
    carry: Mesh[],
    private readonly bedtime = 0.6,
  ) {
    this.puppet = new Puppet(rig, height, rig.clips);
    this.root = this.puppet.root;
    for (const m of carry) {
      m.castShadow = false;
      this.root.add(m);
    }
    this.pos.set(a.x, PLATE_TOP + 0.02, a.z);
    this.root.position.copy(this.pos);
  }

  retarget(b: Spot): void {
    this.b = b;
  }

  update(dt: number, night: number): void {
    this.root.visible = night <= this.bedtime;
    if (!this.root.visible) return;
    this.puppet.update(dt);
    if (this.wait > 0) {
      this.wait -= dt;
      this.puppet.play("interact-right");
      return;
    }
    const goal = this.toB ? this.b : this.a;
    const target = new Vector3(goal.x, this.pos.y, goal.z);
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    if (moveToward(this.pos, target, dt * 0.14)) {
      this.toB = !this.toB;
      this.wait = 1.5 + Math.random() * 1.5;
    } else {
      this.puppet.play("walk");
      this.puppet.face(dx, dz, dt);
    }
    this.root.position.copy(this.pos);
  }
}

export interface FlyStyle {
  height: number;
  ground: number;
  arc: number;
  speed: number;
  rest: [number, number];
  fly: string;
  perch: string;
  sleepAt: number;
}

export const BEE: FlyStyle = { height: 0.07, ground: 0.03, arc: 0.04, speed: 0.22, rest: [0.2, 0.9], fly: "idle", perch: "idle", sleepAt: 0.5 };
export const PARROT: FlyStyle = { height: 0.09, ground: 0.03, arc: 0.3, speed: 0.45, rest: [2, 5], fly: "run", perch: "eat", sleepAt: 0.6 };

export class Flyer implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private t = 1;
  private span = 1;
  private wait = Math.random() * 2;
  private bob = Math.random() * 6;

  constructor(
    rig: Rig,
    height: number,
    private readonly area: Area,
    private readonly style: FlyStyle,
    private readonly land: (x: number, z: number) => boolean = () => true,
  ) {
    this.puppet = new Puppet(rig, height, rig.clips);
    this.root = this.puppet.root;
    pointIn(area, this.to);
    this.to.y = PLATE_TOP + style.ground;
    this.from.copy(this.to);
    this.root.position.copy(this.to);
  }

  update(dt: number, night: number): void {
    this.root.visible = night <= this.style.sleepAt;
    if (!this.root.visible) return;
    this.puppet.update(dt);
    this.bob += dt * 7;
    if (this.t >= 1) {
      this.root.position.copy(this.to);
      this.root.position.y += this.style.height * 0.25 * Math.sin(this.bob) * (this.style === BEE ? 1 : 0);
      this.puppet.play(this.style.perch);
      if ((this.wait -= dt) > 0) return;
      this.from.copy(this.to);
      for (let i = 0; i < 6; i++) {
        pointIn(this.area, this.to);
        if (this.land(this.to.x, this.to.z)) break;
        this.to.copy(this.from);
      }
      this.to.y = PLATE_TOP + this.style.ground + (this.style === BEE ? this.style.height * Math.random() : 0);
      this.span = Math.max(0.3, this.from.distanceTo(this.to) / this.style.speed);
      this.t = 0;
      return;
    }
    this.t = Math.min(1, this.t + dt / this.span);
    const k = this.t * this.t * (3 - 2 * this.t);
    this.root.position.lerpVectors(this.from, this.to, k);
    this.root.position.y += Math.sin(Math.PI * this.t) * this.style.arc + (this.style === BEE ? this.style.height : 0);
    this.puppet.play(this.style.fly);
    this.puppet.face(this.to.x - this.from.x, this.to.z - this.from.z, dt);
    if (this.t >= 1) this.wait = this.style.rest[0] + Math.random() * (this.style.rest[1] - this.style.rest[0]);
  }
}

export class Jumper implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private t = 1;
  private wait = 1 + Math.random() * 3;
  private readonly from = new Vector3();
  private readonly to = new Vector3();

  constructor(rig: Rig, private cells: Spot[]) {
    this.puppet = new Puppet(rig, 0.06, rig.clips);
    this.root = this.puppet.root;
    this.root.visible = false;
  }

  setCells(cells: Spot[]): void {
    this.cells = cells;
  }

  update(dt: number, night: number): void {
    if (this.t >= 1) {
      this.root.visible = false;
      if ((this.wait -= dt) > 0 || night > 0.6 || !this.cells.length) return;
      const c = this.cells[Math.floor(Math.random() * this.cells.length)];
      const a = Math.random() * Math.PI * 2;
      this.from.set(c.x + (Math.random() - 0.5) * 0.3, PLATE_TOP, c.z + (Math.random() - 0.5) * 0.3);
      this.to.set(this.from.x + Math.cos(a) * 0.22, PLATE_TOP, this.from.z + Math.sin(a) * 0.22);
      this.root.rotation.y = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      this.t = 0;
      this.wait = 1.5 + Math.random() * 3.5;
    }
    this.root.visible = true;
    this.puppet.update(dt);
    this.t = Math.min(1, this.t + dt / 0.75);
    this.root.position.lerpVectors(this.from, this.to, this.t);
    this.root.position.y += Math.sin(Math.PI * this.t) * 0.16;
    this.root.rotation.x = (this.t - 0.5) * 2.2;
  }
}

export class Beam implements Life {
  readonly root = new Group();
  private readonly sweep = new Group();
  private readonly material = new MeshBasicMaterial({
    color: 0xfff1cf,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  private readonly glow = new SpriteMaterial({ map: glowTexture(), color: 0xfff1cf, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });

  constructor(at: Vector3) {
    this.root.position.copy(at);
    const cone = new ConeGeometry(0.2, 2.4, 20, 1, true);
    cone.translate(0, -1.2, 0);
    cone.rotateZ(Math.PI / 2);
    const beam = new Mesh(cone, this.material);
    beam.rotation.z = -0.06;
    this.sweep.add(beam);
    this.root.add(this.sweep);
    const lamp = new Sprite(this.glow);
    lamp.scale.setScalar(0.3);
    this.root.add(lamp);
  }

  update(dt: number, night: number): void {
    this.sweep.rotation.y += dt * 0.9;
    this.material.opacity = night * 0.22;
    this.glow.opacity = night;
    this.root.visible = night > 0.02;
  }
}

export class Snow implements Life {
  readonly root = new Group();
  private readonly points: Points;
  private readonly material = new PointsMaterial({
    color: 0xffffff,
    map: glowTexture(),
    size: 3,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  private readonly drift: number[] = [];
  private time = 0;

  constructor(centre: Spot, radius = 1.3, count = 80) {
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      pos.push(centre.x + (Math.random() - 0.5) * 2 * radius, PLATE_TOP + Math.random() * 1.3, centre.z + (Math.random() - 0.5) * 2 * radius);
      this.drift.push(Math.random() * 6);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
    this.root.add(this.points);
  }

  setPixelSize(px: number): void {
    this.material.size = Math.min(14, Math.max(2, px));
  }

  update(dt: number): void {
    this.time += dt;
    const attr = this.points.geometry.getAttribute("position") as Float32BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      let y = attr.getY(i) - dt * 0.16;
      if (y < PLATE_TOP + 0.01) y = PLATE_TOP + 1.3;
      attr.setY(i, y);
      attr.setX(i, attr.getX(i) + Math.sin(this.time * 1.3 + this.drift[i]) * dt * 0.04);
    }
    attr.needsUpdate = true;
  }
}

function walkTo(puppet: Puppet, pos: Vector3, goal: Spot, speed: number, dt: number, anim = "walk"): boolean {
  const target = new Vector3(goal.x, pos.y, goal.z);
  const dx = target.x - pos.x, dz = target.z - pos.z;
  const done = moveToward(pos, target, dt * speed);
  if (!done) {
    puppet.play(anim);
    puppet.face(dx, dz, dt);
  }
  puppet.root.position.copy(pos);
  return done;
}

export class Performer implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private clock = Math.random() * 3;

  constructor(
    rig: Rig,
    height: number,
    at: Spot,
    yaw: number,
    private readonly anims: string[],
    private readonly show: (night: number) => boolean = () => true,
    lift = 0.02,
    carry: Mesh[] = [],
  ) {
    this.puppet = new Puppet(rig, height, rig.clips);
    this.root = this.puppet.root;
    this.root.position.set(at.x, PLATE_TOP + lift, at.z);
    this.root.rotation.y = yaw;
    for (const m of carry) {
      m.castShadow = false;
      this.root.add(m);
    }
  }

  update(dt: number, night: number): void {
    this.root.visible = this.show(night);
    if (!this.root.visible) return;
    this.puppet.update(dt);
    this.clock += dt;
    this.puppet.play(this.anims[Math.floor(this.clock / 2.6) % this.anims.length]);
  }
}

export class Patrol implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private muster: { at: Spot; face: Spot; left: number } | null = null;

  constructor(rig: Rig, height: number, private readonly path: Spot[], private index: number) {
    this.puppet = new Puppet(rig, height, rig.clips);
    this.root = this.puppet.root;
    const start = path[index];
    this.pos.set(start.x, PLATE_TOP + 0.02, start.z);
    this.root.position.copy(this.pos);
  }

  gather(at: Spot, face: Spot, seconds: number): void {
    this.muster = { at, face, left: seconds };
  }

  update(dt: number): void {
    this.puppet.update(dt);
    if (this.muster) {
      const m = this.muster;
      if (!walkTo(this.puppet, this.pos, m.at, 0.16, dt)) return;
      this.puppet.face(m.face.x - this.pos.x, m.face.z - this.pos.z, dt);
      this.puppet.play("interact-right");
      if ((m.left -= dt) <= 0) this.muster = null;
      return;
    }
    if (walkTo(this.puppet, this.pos, this.path[this.index], 0.1, dt)) this.index = (this.index + 1) % this.path.length;
  }
}

export class Parade implements Life {
  readonly root = new Group();
  private readonly puppets: Puppet[];
  private path: { x: number; z: number; s: number }[] = [];
  private s = 0;
  private wait: number;
  private static readonly GAP = 0.13;

  constructor(rigs: Rig[], height: number, private readonly route: () => Spot[], private readonly every: number) {
    this.puppets = rigs.map((r) => new Puppet(r, height, r.clips));
    for (const p of this.puppets) this.root.add(p.root);
    this.root.visible = false;
    this.wait = 6 + Math.random() * every * 0.5;
  }

  private at(s: number): { x: number; z: number; tx: number; tz: number } {
    const pts = this.path;
    const c = Math.max(0, Math.min(pts[pts.length - 1].s, s));
    let i = 1;
    while (i < pts.length - 1 && pts[i].s < c) i++;
    const a = pts[i - 1], b = pts[i];
    const k = b.s > a.s ? (c - a.s) / (b.s - a.s) : 0;
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, tx: b.x - a.x, tz: b.z - a.z };
  }

  update(dt: number, night: number): void {
    if (!this.path.length) {
      if ((this.wait -= dt) > 0 || night > 0.3) return;
      const pts = this.route();
      this.wait = this.every * (0.7 + Math.random() * 0.6);
      if (pts.length < 2) return;
      let s = 0;
      this.path = pts.map((p, i) => ({ ...p, s: i ? (s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z)) : 0 }));
      this.s = 0;
      this.root.visible = true;
    }
    this.s += dt * 0.11;
    const end = this.path[this.path.length - 1].s;
    this.puppets.forEach((p, i) => {
      const s = this.s - Math.max(0, i - 1) * Parade.GAP;
      p.root.visible = s >= 0 && s <= end;
      if (!p.root.visible) return;
      const at = this.at(s);
      const len = Math.hypot(at.tx, at.tz) || 1;
      const side = i < 2 ? (i === 0 ? -0.035 : 0.035) : 0;
      p.root.position.set(at.x - (at.tz / len) * side, PLATE_TOP + 0.02, at.z + (at.tx / len) * side);
      p.face(at.tx, at.tz, dt);
      p.play("walk");
      p.update(dt);
    });
    if (this.s - (this.puppets.length - 2) * Parade.GAP > end) {
      this.path = [];
      this.root.visible = false;
    }
  }
}

export class Match implements Life {
  readonly root = new Group();
  private readonly kids: Puppet[];
  private readonly spots: Vector3[];
  private readonly ball: Mesh | null;
  private holder = 0;
  private flight = -1;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private hold = 0.8;

  constructor(rigs: Rig[], ball: Mesh | null, private readonly area: Area, private readonly bedtime = 0.5) {
    this.kids = rigs.map((r) => new Puppet(r, 0.11, r.clips));
    this.spots = this.kids.map(() => {
      const v = new Vector3(0, PLATE_TOP + 0.02, 0);
      pointIn(area, v);
      return v;
    });
    this.kids.forEach((k, i) => {
      k.root.position.copy(this.spots[i]);
      this.root.add(k.root);
    });
    this.ball = ball;
    if (ball) {
      ball.castShadow = false;
      this.root.add(ball);
    }
  }

  update(dt: number, night: number): void {
    this.root.visible = night <= this.bedtime;
    if (!this.root.visible) return;
    this.kids.forEach((k, i) => {
      k.update(dt);
      const pos = k.root.position;
      const reached = moveToward(pos, this.spots[i], dt * 0.2);
      if (!reached) {
        k.play("sprint");
        k.face(this.spots[i].x - pos.x, this.spots[i].z - pos.z, dt);
      } else if (i !== this.holder || this.flight >= 0) {
        k.play("idle");
        const h = this.kids[this.holder].root.position;
        k.face(h.x - pos.x, h.z - pos.z, dt);
      }
    });
    const holder = this.kids[this.holder];
    if (this.flight < 0) {
      this.ball?.position.set(holder.root.position.x, PLATE_TOP + 0.02, holder.root.position.z + 0.03);
      if ((this.hold -= dt) > 0) return;
      const next = (this.holder + 1) % this.kids.length;
      holder.play("attack-kick-right");
      this.from.copy(holder.root.position);
      this.to.copy(this.kids[next].root.position);
      this.flight = 0;
      this.holder = next;
      pointIn(this.area, this.spots[(next + 1) % this.kids.length]);
      return;
    }
    this.flight = Math.min(1, this.flight + dt / 0.9);
    this.ball?.position.lerpVectors(this.from, this.to, this.flight);
    if (this.ball) {
      this.ball.position.y = PLATE_TOP + 0.02 + Math.sin(Math.PI * this.flight) * 0.08;
      this.ball.rotation.x += dt * 8;
    }
    if (this.flight >= 1) {
      this.flight = -1;
      this.hold = 0.6 + Math.random() * 0.8;
    }
  }
}

export class Lumberjack implements Life {
  readonly root = new Group();
  private readonly jack: Puppet;
  private readonly pos = new Vector3();
  private state: "grow" | "walk" | "chop" | "fall" | "carry" | "rest" = "grow";
  private t = 0;
  private readonly log: Mesh;

  constructor(
    rig: Rig,
    private readonly tree: Mesh,
    private readonly treeScale: number,
    private readonly stump: Spot,
    private readonly mill: Spot,
    log: Mesh,
  ) {
    this.jack = new Puppet(rig, 0.15, rig.clips);
    this.pos.set(mill.x, PLATE_TOP + 0.02, mill.z);
    this.jack.root.position.copy(this.pos);
    this.root.add(this.jack.root);
    tree.position.set(stump.x, PLATE_TOP, stump.z);
    tree.scale.setScalar(treeScale * 0.2);
    this.root.add(tree);
    this.log = log;
    log.visible = false;
    this.jack.root.add(log);
  }

  update(dt: number, night: number): void {
    this.jack.update(dt);
    this.jack.root.visible = night <= 0.6;
    this.t += dt;
    switch (this.state) {
      case "grow": {
        const k = Math.min(1, this.t / 10);
        this.tree.scale.setScalar(this.treeScale * (0.2 + 0.8 * k));
        this.tree.rotation.x = 0;
        this.jack.play("idle");
        if (k >= 1 && night <= 0.6) [this.state, this.t] = ["walk", 0];
        break;
      }
      case "walk":
        if (walkTo(this.jack, this.pos, { x: this.stump.x + 0.1, z: this.stump.z + 0.05 }, 0.12, dt)) [this.state, this.t] = ["chop", 0];
        break;
      case "chop":
        this.jack.face(this.stump.x - this.pos.x, this.stump.z - this.pos.z, dt);
        this.jack.play("attack-melee-right");
        if (this.t > 3.2) [this.state, this.t] = ["fall", 0];
        break;
      case "fall": {
        const k = Math.min(1, this.t / 1.1);
        this.tree.rotation.z = (k * k * Math.PI) / 2;
        if (this.t > 1.6) {
          this.tree.scale.setScalar(0.0001);
          this.log.visible = true;
          [this.state, this.t] = ["carry", 0];
        }
        break;
      }
      case "carry":
        if (walkTo(this.jack, this.pos, this.mill, 0.1, dt)) {
          this.log.visible = false;
          [this.state, this.t] = ["rest", 0];
        }
        break;
      case "rest":
        this.jack.play("pick-up");
        if (this.t > 1.5) {
          this.tree.rotation.z = 0;
          [this.state, this.t] = ["grow", 0];
        }
        break;
    }
  }
}

export class Hopper implements Life {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly target = new Vector3();
  private hop = 0;
  private wait = Math.random() * 2;

  constructor(mesh: Mesh, scale: number, private readonly area: Area) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = false;
    this.body.add(mesh);
    this.body.scale.setScalar(scale);
    this.root.add(this.body);
    pointIn(area, this.root.position);
    this.root.position.y = PLATE_TOP + 0.04;
    this.target.copy(this.root.position);
  }

  update(dt: number, night: number): void {
    this.root.visible = night <= 0.6;
    if (!this.root.visible) return;
    const pos = this.root.position;
    if (moveToward(pos, this.target, dt * 0.12)) {
      this.body.position.y = 0;
      if ((this.wait -= dt) > 0) return;
      pointIn(this.area, this.target);
      this.target.y = pos.y;
      this.wait = 0.8 + Math.random() * 2;
      return;
    }
    this.hop += dt * 9;
    this.body.position.y = Math.abs(Math.sin(this.hop)) * 0.035;
    this.root.rotation.y = Math.atan2(this.target.x - pos.x, this.target.z - pos.z);
  }
}

export class Queue implements Life {
  readonly root = new Group();
  private readonly kids: Puppet[];
  private readonly order: number[];
  private clock = 0;
  private entering = -1;

  constructor(rigs: Rig[], private readonly door: Spot, private readonly slots: Spot[]) {
    this.kids = rigs.map((r) => new Puppet(r, 0.1, r.clips));
    this.order = this.kids.map((_, i) => i);
    this.kids.forEach((k, i) => {
      k.root.position.set(slots[i].x, PLATE_TOP + 0.02, slots[i].z);
      this.root.add(k.root);
    });
  }

  update(dt: number, night: number): void {
    this.root.visible = night <= 0.5;
    if (!this.root.visible) return;
    this.clock += dt;
    if (this.clock > 5 && this.entering < 0) {
      this.clock = 0;
      this.entering = this.order.shift()!;
      this.order.push(this.entering);
    }
    this.kids.forEach((k, i) => {
      k.update(dt);
      const pos = k.root.position;
      if (i === this.entering) {
        if (walkTo(k, pos, this.door, 0.14, dt)) {
          const back = this.slots[this.slots.length - 1];
          pos.set(back.x, pos.y, back.z);
          k.root.position.copy(pos);
          this.entering = -1;
        }
        return;
      }
      const slot = this.slots[this.order.indexOf(i)];
      if (!slot) return;
      if (walkTo(k, pos, slot, 0.12, dt)) {
        k.play("idle");
        k.face(this.door.x - pos.x, this.door.z - pos.z, dt);
      }
    });
  }
}

export class Stagger implements Life {
  readonly root: Group;
  private readonly puppet: Puppet;
  private readonly pos = new Vector3();
  private goal: Spot | null = null;
  private wait = 4 + Math.random() * 10;
  private sway = 0;

  constructor(rig: Rig, private readonly door: Spot, private readonly home: () => Spot | null) {
    this.puppet = new Puppet(rig, 0.15, rig.clips);
    this.root = this.puppet.root;
    this.root.visible = false;
  }

  update(dt: number, night: number): void {
    if (!this.goal) {
      this.root.visible = false;
      if ((this.wait -= dt) > 0 || night < 0.5) return;
      this.goal = this.home();
      this.wait = 14 + Math.random() * 16;
      if (!this.goal) return;
      this.pos.set(this.door.x, PLATE_TOP + 0.02, this.door.z);
      this.root.visible = true;
    }
    this.puppet.update(dt);
    this.sway += dt * 3.2;
    const dx = this.goal.x - this.pos.x, dz = this.goal.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    if (walkTo(this.puppet, this.pos, this.goal, 0.07, dt)) {
      this.goal = null;
      return;
    }
    const wobble = Math.sin(this.sway) * 0.05 * Math.min(1, len);
    this.root.position.set(this.pos.x - (dz / len) * wobble, this.pos.y, this.pos.z + (dx / len) * wobble);
    this.root.rotation.z = Math.sin(this.sway * 0.7) * 0.15;
  }
}

export class Glow implements Life {
  readonly root = new Group();
  private readonly material = new SpriteMaterial({ map: glowTexture(), color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });

  constructor(at: Vector3, size: number) {
    const s = new Sprite(this.material);
    s.scale.setScalar(size);
    s.position.copy(at);
    this.root.add(s);
  }

  update(_dt: number, night: number): void {
    this.material.opacity = night * 0.9;
    this.root.visible = night > 0.02;
  }
}

export class Flag implements Life {
  readonly root = new Group();
  private readonly cloth: Mesh;
  private t = Math.random() * 6;

  constructor(at: Vector3, color: number) {
    const pole = new Mesh(new ConeGeometry(0.006, 0.16, 6), new MeshBasicMaterial({ color: 0x8a7a6c }));
    pole.position.y = 0.08;
    this.root.add(pole);
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute([0, 0.16, 0, 0.1, 0.135, 0, 0, 0.11, 0], 3));
    this.cloth = new Mesh(geo, new MeshBasicMaterial({ color, side: DoubleSide }));
    this.root.add(this.cloth);
    this.root.position.copy(at);
  }

  update(dt: number): void {
    this.t += dt;
    this.cloth.rotation.y = Math.sin(this.t * 2.4) * 0.5 + 0.4;
  }
}
