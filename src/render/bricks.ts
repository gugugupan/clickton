import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const STUD_RADIUS = 0.045;
export const STUD_HEIGHT = 0.035;

const color = new Color();

type V3 = [number, number, number];

export interface Edge2 {
  x: number;
  z: number;
}

function facing(out: number[], a: V3, b: V3, c: V3, want: V3): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const ok = nx * want[0] + ny * want[1] + nz * want[2] >= 0;
  out.push(...a, ...(ok ? b : c), ...(ok ? c : b));
}

export class PartBuilder {
  private readonly parts: BufferGeometry[] = [];

  get empty(): boolean {
    return this.parts.length === 0;
  }

  ribbon(left: readonly Edge2[], right: readonly Edge2[], y: number, h: number, hex: number): this {
    const pos: number[] = [];
    const top = y + h;
    const quad = (a: V3, b: V3, c: V3, d: V3, want: V3) => {
      facing(pos, a, b, c, want);
      facing(pos, a, c, d, want);
    };
    for (let i = 0; i + 1 < left.length; i++) {
      const l0 = left[i], l1 = left[i + 1], r0 = right[i], r1 = right[i + 1];
      quad([l0.x, top, l0.z], [l1.x, top, l1.z], [r1.x, top, r1.z], [r0.x, top, r0.z], [0, 1, 0]);
      const outL: V3 = [l0.x - r0.x, 0, l0.z - r0.z];
      const outR: V3 = [r0.x - l0.x, 0, r0.z - l0.z];
      quad([l0.x, y, l0.z], [l1.x, y, l1.z], [l1.x, top, l1.z], [l0.x, top, l0.z], outL);
      quad([r0.x, y, r0.z], [r1.x, y, r1.z], [r1.x, top, r1.z], [r0.x, top, r0.z], outR);
    }
    for (const [i, j] of [
      [0, 1],
      [left.length - 1, left.length - 2],
    ]) {
      const l = left[i], r = right[i], ln = left[j];
      const want: V3 = [l.x - ln.x, 0, l.z - ln.z];
      quad([l.x, y, l.z], [r.x, y, r.z], [r.x, top, r.z], [l.x, top, l.z], want);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return this.add(g, 0, 0, 0, hex);
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, hex: number, rotY = 0): this {
    const g = new BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    return this.add(g, x, y + h / 2, z, hex);
  }

  cylinder(r: number, h: number, x: number, y: number, z: number, hex: number, segments = 10): this {
    return this.add(new CylinderGeometry(r, r, h, segments), x, y + h / 2, z, hex);
  }

  cone(r: number, h: number, x: number, y: number, z: number, hex: number, segments = 8, rotY = 0): this {
    const g = new ConeGeometry(r, h, segments);
    if (rotY) g.rotateY(rotY);
    return this.add(g, x, y + h / 2, z, hex);
  }

  stud(x: number, y: number, z: number, hex: number): this {
    return this.cylinder(STUD_RADIUS, STUD_HEIGHT, x, y, z, hex, 8);
  }

  studGrid(cx: number, cz: number, size: number, n: number, y: number, hex: number): this {
    const pitch = size / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.stud(cx - size / 2 + pitch * (i + 0.5), y, cz - size / 2 + pitch * (j + 0.5), hex);
      }
    }
    return this;
  }

  private add(g: BufferGeometry, x: number, y: number, z: number, hex: number): this {
    g.translate(x, y, z);
    g.deleteAttribute("uv");
    color.setHex(hex);
    const n = g.getAttribute("position").count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    g.setAttribute("color", new BufferAttribute(colors, 3));
    if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i));
    this.parts.push(g);
    return this;
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error("failed to merge tile geometry");
    return merged;
  }
}
