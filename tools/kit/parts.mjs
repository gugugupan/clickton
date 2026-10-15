const KENNEY_SIZE = 512;

export function kenney(col, row, t = 0.35) {
  return { u: (col * 32 + 16) / KENNEY_SIZE, v: (row * 128 + 8 + t * 112) / KENNEY_SIZE };
}

export const TOWN = {
  wall: kenney(14, 2),
  wallShade: kenney(15, 2, 0.7),
  white: kenney(7, 2, 0.15),
  whiteShade: kenney(7, 2, 0.7),
  roof: kenney(1, 1, 0.2),
  flatRoof: kenney(1, 2, 0.75),
  roofLight: kenney(0, 1),
  trim: kenney(3, 2, 0.6),
  glass: kenney(11, 1, 0.75),
  door: kenney(10, 2),
  wood: kenney(13, 2, 0.5),
  woodDark: kenney(11, 2, 0.6),
  brick: kenney(5, 3, 0.5),
  awning: kenney(4, 3),
  bread: kenney(3, 1, 0.45),
  crust: kenney(5, 1, 0.7),
  leaf: kenney(3, 3, 0.4),
  flower: kenney(6, 1),
};

export const NATURE_EXTRAS = {
  blossom: { col: 1, row: 0, top: [255, 196, 216], bottom: [196, 84, 128] },
  leafLight: { col: 2, row: 0, top: [218, 236, 128], bottom: [118, 176, 62] },
  leafDeep: { col: 3, row: 0, top: [88, 152, 98], bottom: [22, 84, 60] },
  stem: { col: 4, row: 0, top: [252, 246, 230], bottom: [214, 200, 176] },
  flowerYellow: { col: 1, row: 1, top: [255, 238, 140], bottom: [232, 170, 50] },
  flowerWhite: { col: 2, row: 1, top: [255, 255, 255], bottom: [222, 216, 232] },
  flowerPurple: { col: 3, row: 1, top: [216, 192, 255], bottom: [140, 100, 200] },
  capRed: { col: 4, row: 1, top: [244, 116, 92], bottom: [178, 58, 48] },
  capBrown: { col: 5, row: 1, top: [222, 172, 120], bottom: [150, 100, 64] },
};

const column = (u, v0, v1) => (t) => ({ u, v: v0 + Math.min(0.95, Math.max(0.05, t)) * (v1 - v0) });

export const NATURE = {
  leaf: column(0.0625, 0, 0.25),
  bark: column(0.0625, 0.25, 0.5),
  stone: column(0.0625, 0.5, 0.75),
  ...Object.fromEntries(Object.entries(NATURE_EXTRAS).map(([k, e]) => [k, column((e.col * 128 + 64) / 1024, e.row * 0.25, (e.row + 1) * 0.25)])),
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mean = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Shape {
  constructor() {
    this.position = [];
    this.normal = [];
    this.uv = [];
    this.frames = [(p) => p];
  }

  get tris() {
    return this.position.length / 9;
  }

  at(x, y, z, rotY, draw) {
    const parent = this.frames[this.frames.length - 1];
    const c = Math.cos(rotY ?? 0), s = Math.sin(rotY ?? 0);
    this.frames.push((p) => parent([p[0] * c + p[2] * s + x, p[1] + y, -p[0] * s + p[2] * c + z]));
    draw();
    this.frames.pop();
    return this;
  }

  world(p) {
    return this.frames[this.frames.length - 1](p);
  }

  tri(a, b, c, paint, inside) {
    let [wa, wb, wc] = [a, b, c].map((p) => this.world(p));
    let n = norm(cross(sub(wb, wa), sub(wc, wa)));
    if (inside && dot(n, sub(mean([wa, wb, wc]), this.world(inside))) < 0) {
      [wb, wc] = [wc, wb];
      n = [-n[0], -n[1], -n[2]];
    }
    for (const p of [wa, wb, wc]) {
      const uv = typeof paint === "function" ? paint(p, n) : paint;
      this.position.push(...p);
      this.normal.push(...n);
      this.uv.push(uv.u, uv.v);
    }
  }

  face(pts, paint, inside) {
    for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0], pts[i], pts[i + 1], paint, inside);
  }

  hexa(p, paint, skip = []) {
    const inside = mean(p);
    const faces = { bottom: [0, 1, 2, 3], top: [4, 5, 6, 7], s0: [0, 1, 5, 4], s1: [1, 2, 6, 5], s2: [2, 3, 7, 6], s3: [3, 0, 4, 7] };
    const single = typeof paint === "function" || paint.u !== undefined;
    for (const [key, ids] of Object.entries(faces)) {
      if (skip.includes(key)) continue;
      this.face(ids.map((i) => p[i]), single ? paint : (paint[key] ?? paint.all), inside);
    }
    return this;
  }

  box(x0, y0, z0, x1, y1, z1, paint, skip) {
    return this.hexa(
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
      paint,
      skip ?? (y0 <= 0 ? ["bottom"] : []),
    );
  }

  slab(a, b, c, d, thickness, paint) {
    const up = norm(cross(sub(b, a), sub(d, a)));
    const off = (p) => [p[0] + up[0] * thickness, p[1] + up[1] * thickness, p[2] + up[2] * thickness];
    return this.hexa([a, b, c, d, off(a), off(b), off(c), off(d)], paint);
  }

  gable(x0, x1, z0, z1, y, h, paint) {
    const zm = (z0 + z1) / 2;
    const inside = [(x0 + x1) / 2, y + h / 3, zm];
    for (const x of [x0, x1]) this.face([[x, y, z0], [x, y, z1], [x, y + h, zm]], paint, inside);
    return this;
  }

  frustum(n, r0, r1, y0, y1, paint, { phase = 0, cap = true, base = false } = {}) {
    const ring = (r, y) => Array.from({ length: n }, (_, i) => {
      const a = phase + (i / n) * Math.PI * 2;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
    const lo = ring(r0, y0), hi = ring(r1, y1);
    const inside = [0, (y0 + y1) / 2, 0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r1 > 0) this.face([lo[i], lo[j], hi[j], hi[i]], paint, inside);
      else this.tri(lo[i], lo[j], [0, y1, 0], paint, inside);
    }
    if (cap && r1 > 0) this.face(hi, paint, [0, y0 - 1, 0]);
    if (base) this.face(lo, paint, [0, y1 + 1, 0]);
    return this;
  }

  blob(r, squash, seed, paint, jitter = 0.16) {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
    let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const mid = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!mid.has(key)) {
        verts.push(norm(mean([verts[a], verts[b]])));
        mid.set(key, verts.length - 1);
      }
      return mid.get(key);
    };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
    const rand = rng(seed);
    verts = verts.map((v) => {
      const k = r * (1 - jitter / 2 + rand() * jitter);
      return [v[0] * k, v[1] * k * squash, v[2] * k];
    });
    for (const [a, b, c] of faces) this.tri(verts[a], verts[b], verts[c], paint, [0, 0, 0]);
    return this;
  }

  beam(p0, p1, w, h, paint) {
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dz);
    return this.at((p0[0] + p1[0]) / 2, p0[1], (p0[2] + p1[2]) / 2, Math.atan2(-dz, dx), () => this.box(-len / 2, 0, -w / 2, len / 2, h, w / 2, paint, []));
  }

  limb(p0, p1, r0, r1, paint) {
    const axis = norm(sub(p1, p0));
    const side = norm(cross(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const up = cross(side, axis);
    const ring = (c, r) => [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => [0, 1, 2].map((k) => c[k] + (side[k] * a + up[k] * b) * r));
    return this.hexa([...ring(p0, r0), ...ring(p1, r1)], paint);
  }

  starCone(n, rOuter, rInner, y0, y1, paint, phase = 0) {
    const ring = Array.from({ length: n * 2 }, (_, i) => {
      const a = phase + (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 ? rInner : rOuter;
      return [Math.cos(a) * r, y0 - (i % 2 ? 0 : 0.06 * rOuter), Math.sin(a) * r];
    });
    const apex = [0, y1, 0], under = [0, y0 + (y1 - y0) * 0.18, 0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      this.tri(a, b, apex, paint, [0, y0 + (y1 - y0) * 0.3, 0]);
      this.tri(b, a, under, paint, [0, y1 + 1, 0]);
    }
    return this;
  }

  quadUp(pts, y, paint) {
    this.face(pts.map(([x, z]) => [x, y, z]), paint, [mean(pts.map(([x, z]) => [x, 0, z]))[0], y - 1, mean(pts.map(([x, z]) => [0, 0, z]))[2]]);
    return this;
  }
}
