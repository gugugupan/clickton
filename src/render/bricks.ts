import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const STUD_RADIUS = 0.045;
export const STUD_HEIGHT = 0.035;

const color = new Color();

export class PartBuilder {
  private readonly parts: BufferGeometry[] = [];

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
