import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial, type Camera } from "three";

export const FIREWORK_COLORS = [0xff8f78, 0xffcf5a, 0x7fb3f5, 0x86d36f, 0xc39cf5, 0xff9cc6] as const;
export const CONFETTI_COLORS = [0xe0a193, 0xedd39b, 0x9dbbd1, 0xa9c89b, 0xc9b8d6] as const;

const GRAVITY = 0.9;
const ROCKET_GRAVITY = 3.2;

interface Shell {
  x: number;
  z: number;
  height: number;
  count: number;
  speed: number;
  colors: number[];
  delay: number;
}

const vertexShader = `
attribute float aSize;
attribute vec4 aColor;
attribute vec3 aShape;
varying vec3 vShape;
uniform float uPx;
uniform float uMinPx;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vShape = aShape;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aSize * uPx, aSize * uMinPx);
}`;

const fragmentShader = `
uniform float uNight;
varying vec4 vColor;
varying vec3 vShape;
void main() {
  if (vShape.x > 0.5) {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vShape.y), s = sin(vShape.y);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    if (abs(p.x) > 0.44 * max(vShape.z, 0.12) || abs(p.y) > 0.2) discard;
    gl_FragColor = vec4(vColor.rgb * (0.72 + 0.28 * vShape.z), vColor.a);
    return;
  }
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float disc = smoothstep(1.0, 0.72, d);
  float core = pow(1.0 - d, 1.6);
  float alpha = vColor.a * mix(disc, core, uNight);
  vec3 rgb = mix(vColor.rgb, vec3(1.0), uNight * core * 0.45);
  gl_FragColor = vec4(rgb, alpha);
}`;

export class Fireworks {
  readonly points: Points;
  private readonly capacity: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly rgb: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly drag: Float32Array;
  private readonly twinkle: Uint8Array;
  private readonly trail: Uint8Array;
  private readonly confetti: Uint8Array;
  private readonly spin: Float32Array;
  private readonly fall: Float32Array;
  private readonly shapeAttr: BufferAttribute;
  private readonly rocket: Int16Array;
  private readonly colorAttr: BufferAttribute;
  private readonly sizeAttr: BufferAttribute;
  private readonly posAttr: BufferAttribute;
  private readonly material: ShaderMaterial;
  private readonly shells: Shell[] = [];
  private readonly launched: Shell[] = [];
  private readonly tasks: { wait: number; run: () => void }[] = [];
  private count = 0;
  onBurst: ((kind: "shell" | "popper", strength: number) => void) | null = null;
  camera: Camera | null = null;

  constructor(capacity = 2000) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.rgb = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.twinkle = new Uint8Array(capacity);
    this.trail = new Uint8Array(capacity);
    this.confetti = new Uint8Array(capacity);
    this.spin = new Float32Array(capacity * 3);
    this.fall = new Float32Array(capacity);
    this.shapeAttr = new BufferAttribute(new Float32Array(capacity * 3), 3);
    this.rocket = new Int16Array(capacity).fill(-1);
    const geometry = new BufferGeometry();
    this.posAttr = new BufferAttribute(new Float32Array(capacity * 3), 3);
    this.colorAttr = new BufferAttribute(new Float32Array(capacity * 4), 4);
    this.sizeAttr = new BufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute("position", this.posAttr);
    geometry.setAttribute("aColor", this.colorAttr);
    geometry.setAttribute("aSize", this.sizeAttr);
    geometry.setAttribute("aShape", this.shapeAttr);
    geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uPx: { value: 1 }, uMinPx: { value: 120 }, uNight: { value: 0 } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  get busy(): boolean {
    return this.count > 0 || this.shells.length > 0 || this.tasks.length > 0;
  }

  screenRight(): { x: number; z: number } {
    const e = this.camera?.matrixWorld.elements;
    if (!e) return { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
    const len = Math.hypot(e[0], e[2]) || 1;
    return { x: e[0] / len, z: e[2] / len };
  }

  later(wait: number, run: () => void): void {
    this.tasks.push({ wait, run });
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: number, life: number, size: number, drag: number, twinkle = false): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.rgb.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.drag[i] = drag;
    this.twinkle[i] = twinkle ? 1 : 0;
    this.trail[i] = 0;
    this.confetti[i] = 0;
    this.fall[i] = 0.45;
    this.rocket[i] = -1;
    return i;
  }

  sparkle(x: number, z: number, color: number, count = 10, y = 0.16): void {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2, spread = 0.3 + Math.random() * 0.4;
      const up = 0.9 + Math.random() * 0.7;
      const c = n % 3 === 0 ? 0xfff4d6 : color;
      this.spawn(x, y, z, Math.cos(a) * spread, up, Math.sin(a) * spread, c, 0.7 + Math.random() * 0.4, 0.075 + Math.random() * 0.03, 2.4, n % 2 === 0);
    }
  }

  popper(x: number, z: number, dirX: number, dirZ: number, count = 11, lift = 1.5, quiet = false): void {
    const len = Math.hypot(dirX, lift, dirZ);
    const [ax, ay, az] = [dirX / len, lift / len, dirZ / len];
    for (let n = 0; n < 3; n++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, 0.2, z, ax * 0.8 + Math.cos(a) * 0.4, ay * 0.8 + Math.random() * 0.3, az * 0.8 + Math.sin(a) * 0.4, 0xfff6e0, 0.3, 0.06, 4);
    }
    for (let n = 0; n < count; n++) {
      const speed = 2.4 + Math.random() * 1.6;
      const jx = (Math.random() - 0.5) * 0.9, jy = (Math.random() - 0.5) * 0.6, jz = (Math.random() - 0.5) * 0.9;
      const color = CONFETTI_COLORS[(n + Math.floor(Math.random() * 5)) % CONFETTI_COLORS.length];
      const i = this.spawn(x, 0.2, z, (ax + jx) * speed, (ay + jy) * speed, (az + jz) * speed, color, 2.4 + Math.random() * 1.4, 0.07 + Math.random() * 0.03, 3.2);
      if (i < 0) break;
      this.confetti[i] = 1;
      this.fall[i] = 0.32;
      this.spin.set([Math.random() * Math.PI * 2, (Math.random() - 0.5) * 8, 4 + Math.random() * 8], i * 3);
    }
    if (!quiet) this.onBurst?.("popper", Math.min(1, 0.5 + count / 30));
  }

  shell(x: number, z: number, opts: Partial<Omit<Shell, "x" | "z">> = {}): void {
    this.shells.push({
      x,
      z,
      height: opts.height ?? 1.15,
      count: opts.count ?? 70,
      speed: opts.speed ?? 1.75,
      colors: opts.colors ?? [FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]],
      delay: opts.delay ?? 0,
    });
  }

  private launch(s: Shell): void {
    const i = this.spawn(s.x, 0.15, s.z, 0, 0, 0, 0xfff1d0, 99, 0.07, 0);
    if (i < 0) return;
    this.launched.push(s);
    this.rocket[i] = this.launched.length - 1;
    const rise = Math.sqrt(2 * ROCKET_GRAVITY * s.height);
    this.vel.set([(Math.random() - 0.5) * 0.15, rise, (Math.random() - 0.5) * 0.15], i * 3);
  }

  private burst(x: number, y: number, z: number, s: Shell): void {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let n = 0; n < s.count; n++) {
      const yy = 1 - (n / (s.count - 1)) * 2;
      const r = Math.sqrt(1 - yy * yy);
      const a = n * golden;
      const speed = s.speed * (0.85 + Math.random() * 0.3);
      const color = s.colors[n % s.colors.length];
      const j = this.spawn(x, y, z, Math.cos(a) * r * speed, yy * speed + 0.15, Math.sin(a) * r * speed, color, 1.2 + Math.random() * 0.6, 0.055 + Math.random() * 0.02, 1.05, n % 4 === 0);
      if (j >= 0) this.trail[j] = 1;
    }
    for (let n = 0; n < Math.round(s.count / 4); n++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const speed = s.speed * 0.45 * Math.random();
      this.spawn(x, y, z, Math.cos(a) * Math.cos(e) * speed, Math.sin(e) * speed, Math.sin(a) * Math.cos(e) * speed, 0xfff6e0, 0.8 + Math.random() * 0.8, 0.04, 1.8, true);
    }
    this.onBurst?.("shell", Math.min(1.4, s.count / 80));
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.rgb.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size[i] = this.size[last];
    this.drag[i] = this.drag[last];
    this.twinkle[i] = this.twinkle[last];
    this.trail[i] = this.trail[last];
    this.confetti[i] = this.confetti[last];
    this.fall[i] = this.fall[last];
    this.spin.copyWithin(i * 3, last * 3, last * 3 + 3);
    this.rocket[i] = this.rocket[last];
  }

  update(dt: number, pixelsPerUnit: number, night: number, pixelRatio = 1): void {
    for (let k = this.tasks.length - 1; k >= 0; k--) {
      if ((this.tasks[k].wait -= dt) > 0) continue;
      const [task] = this.tasks.splice(k, 1);
      task.run();
    }
    this.material.uniforms.uMinPx.value = 110 * pixelRatio;
    for (let k = this.shells.length - 1; k >= 0; k--) {
      const s = this.shells[k];
      s.delay -= dt;
      if (s.delay <= 0) {
        this.shells.splice(k, 1);
        this.launch(s);
      }
    }
    for (let i = this.count - 1; i >= 0; i--) {
      const r = this.rocket[i];
      if (r >= 0) {
        this.vel[i * 3 + 1] -= ROCKET_GRAVITY * dt;
        if (this.vel[i * 3 + 1] <= 0.3) {
          const [x, y, z] = [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]];
          this.kill(i);
          this.burst(x, y, z, this.launched[r]);
          continue;
        }
        if (Math.random() < 0.8) {
          this.spawn(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], (Math.random() - 0.5) * 0.1, -0.2, (Math.random() - 0.5) * 0.1, 0xffd9a0, 0.4, 0.045, 3);
        }
      } else {
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) {
          this.kill(i);
          continue;
        }
        if (this.trail[i] && this.count < this.capacity * 0.7 && this.age[i] < this.life[i] * 0.7 && Math.random() < 0.45) {
          const fade = 0.55 + 0.45 * (1 - this.age[i] / this.life[i]);
          const mixed = [0, 1, 2].reduce((hex, k) => (hex << 8) | Math.round((this.rgb[i * 3 + k] * fade + 1 - fade) * 255), 0);
          this.spawn(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], 0, -0.05, 0, mixed, 0.32, this.size[i] * 0.6, 4);
        }
        const k = Math.exp(-this.drag[i] * dt);
        this.vel[i * 3] *= k;
        this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - GRAVITY * this.fall[i] * dt;
        if (this.confetti[i]) {
          const sway = Math.sin(this.age[i] * 4.5 + this.spin[i * 3]) * 0.9 * dt;
          this.vel[i * 3] += sway;
          this.vel[i * 3 + 2] -= sway * 0.6;
        }
        this.vel[i * 3 + 2] *= k;
      }
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (!this.busy) this.launched.length = 0;

    const pos = this.posAttr.array as Float32Array;
    const col = this.colorAttr.array as Float32Array;
    const siz = this.sizeAttr.array as Float32Array;
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = this.pos[i * 3];
      pos[i * 3 + 1] = this.pos[i * 3 + 1];
      pos[i * 3 + 2] = this.pos[i * 3 + 2];
      const t = this.rocket[i] >= 0 ? 0 : this.age[i] / this.life[i];
      const sh = this.shapeAttr.array as Float32Array;
      if (this.confetti[i]) {
        const age = this.age[i];
        sh[i * 3] = 1;
        sh[i * 3 + 1] = this.spin[i * 3] + age * this.spin[i * 3 + 1];
        sh[i * 3 + 2] = Math.abs(Math.cos(this.spin[i * 3] * 2 + age * this.spin[i * 3 + 2]));
        col.set([this.rgb[i * 3], this.rgb[i * 3 + 1], this.rgb[i * 3 + 2], t < 0.75 ? 1 : (1 - t) * 4], i * 4);
        siz[i] = this.size[i];
        continue;
      }
      sh[i * 3] = 0;
      let a = Math.pow(1 - t, 1.3);
      if (this.twinkle[i] && t > 0.35) a *= 0.45 + 0.55 * Math.abs(Math.sin(this.age[i] * 26 + i));
      col.set([this.rgb[i * 3], this.rgb[i * 3 + 1], this.rgb[i * 3 + 2], a], i * 4);
      siz[i] = this.size[i] * (1 - t * 0.45);
    }
    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.shapeAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.count);
    this.material.uniforms.uPx.value = pixelsPerUnit;
    this.material.uniforms.uNight.value = night;
    const blending = night > 0.5 ? AdditiveBlending : NormalBlending;
    if (this.material.blending !== blending) {
      this.material.blending = blending;
      this.material.needsUpdate = true;
    }
  }
}

export type CelebrationTier = 1 | 2 | 3 | 4;

const EDGE_OFFSETS: [number, number][] = [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]];

export const EDGE_SPARK: Record<string, number> = {
  grass: 0x86d36f,
  city: 0xff8f78,
  road: 0xffcf5a,
  rail: 0xc39cf5,
  water: 0x7fb3f5,
  forest: 0x5fc77a,
  field: 0xffd77a,
};

export function celebrate(
  fw: Fireworks,
  tier: CelebrationTier,
  x: number,
  z: number,
  edges: (number | null)[] = FIREWORK_COLORS.slice(0, 4),
  centre = { x, z },
  night = false,
): void {
  if (tier === 1) {
    edges.forEach((color, i) => {
      if (color === null) return;
      const [dx, dz] = EDGE_OFFSETS[i % 4];
      if (night) fw.sparkle(x + dx, z + dz, color, 16);
      else fw.popper(x + dx, z + dz, dx * 0.6, dz * 0.6, 3, 2.2, true);
    });
    return;
  }
  if (!night) {
    if (tier === 2) popperPair(fw, x, z);
    else if (tier === 3) {
      popperPair(fw, x, z);
      fw.later(0.45, () => popperPair(fw, x + 0.6, z - 0.6));
      fw.later(0.9, () => popperPair(fw, x - 0.6, z + 0.6));
    } else {
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.3;
        fw.later(i * 0.75, () => popperPair(fw, centre.x + Math.cos(a) * r, centre.z + Math.sin(a) * r));
      }
      fw.later(3.9, () => {
        popperPair(fw, centre.x, centre.z, 15);
        fw.later(0.25, () => popperPair(fw, centre.x, centre.z, 15));
      });
    }
    return;
  }
  if (tier === 2) {
    fw.shell(x, z, { height: 1.1, count: 60 });
    return;
  }
  if (tier === 3) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.random();
      fw.shell(x + Math.cos(a) * 0.45, z + Math.sin(a) * 0.45, { height: 1.0 + i * 0.2, count: 64, delay: i * 0.45 });
    }
    return;
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.4;
    const two = [FIREWORK_COLORS[i % FIREWORK_COLORS.length], FIREWORK_COLORS[(i + 2) % FIREWORK_COLORS.length]];
    fw.shell(centre.x + Math.cos(a) * r, centre.z + Math.sin(a) * r, { height: 1.3 + Math.random() * 0.6, count: 80, speed: 1.9, colors: two, delay: i * 0.5 + Math.random() * 0.2 });
  }
  fw.shell(centre.x, centre.z, { height: 2.0, count: 140, speed: 2.5, colors: [...FIREWORK_COLORS], delay: 3.6 });
}

export function popperPair(fw: Fireworks, x: number, z: number, count?: number): void {
  const r = fw.screenRight();
  fw.popper(x + r.x * 0.12, z + r.z * 0.12, r.x * 0.9, r.z * 0.9, count);
  fw.popper(x - r.x * 0.12, z - r.z * 0.12, -r.x * 0.9, -r.z * 0.9, count);
}
