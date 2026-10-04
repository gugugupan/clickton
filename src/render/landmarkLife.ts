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
