import { AnimationClip, AnimationMixer, Group, Mesh, Object3D, Vector3 } from "three";
import type { Placed } from "../core/board";

export interface Rig {
  scene: Object3D;
  clips: AnimationClip[];
  height: number;
  minY: number;
}

export class Puppet {
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
      if ((o as Mesh).isMesh) o.frustumCulled = false;
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
    if (this.root.visible) this.mixer.update(dt);
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

export function easeOutBack(t: number): number {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export function moveToward(pos: Vector3, target: Vector3, step: number): boolean {
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

export interface Area {
  x: number;
  z: number;
  r: number;
}

export function pointIn(area: Area, out: Vector3): void {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * area.r;
  out.x = area.x + Math.cos(a) * r;
  out.z = area.z + Math.sin(a) * r;
}

export function tileArea(p: Placed, cx: number, cz: number, r: number): Area {
  const angle = (-p.rot * Math.PI) / 2;
  return { x: p.x + cx * Math.cos(angle) + cz * Math.sin(angle), z: p.y - cx * Math.sin(angle) + cz * Math.cos(angle), r };
}
