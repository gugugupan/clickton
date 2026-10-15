import { TOWN as C } from "../parts.mjs";
import { window2 } from "./common.mjs";

function crossDoor(s, w, h) {
  s.box(-w / 2 - 0.025, 0, 0, w / 2 + 0.025, h + 0.025, 0.014, C.white, []);
  s.box(-w / 2, 0, 0.006, w / 2, h, 0.024, C.redShade, []);
  const len = Math.hypot(w, h), ang = Math.atan2(h, w);
  for (const sign of [1, -1]) {
    s.at(0, h / 2, 0.026, 0, () => {
      const c = Math.cos(ang * sign), si = Math.sin(ang * sign);
      const hx = (len / 2) * c, hy = (len / 2) * si, t = 0.014;
      s.face([[-hx - t * si, -hy + t * c, 0], [hx - t * si, hy + t * c, 0], [hx + t * si, hy - t * c, 0], [-hx + t * si, -hy - t * c, 0]], C.white, [0, 0, -1]);
    });
  }
}

export const barn = {
  name: "barn",
  atlas: "town",
  build(s) {
    s.box(-0.62, 0, -0.42, 0.62, 0.04, 0.42, C.stoneShade);
    s.box(-0.56, 0.04, -0.36, 0.56, 0.5, 0.36, { all: C.red, top: C.redShade });
    for (const x of [-0.56, 0.56]) {
      s.face([[x, 0.5, -0.36], [x, 0.5, 0.36], [x, 0.7, 0.2], [x, 0.7, -0.2]], C.red, [0, 0.55, 0]);
      s.face([[x, 0.7, -0.2], [x, 0.7, 0.2], [x, 0.84, 0]], C.red, [0, 0.6, 0]);
    }
    const roof = [[0.42, 0.48], [0.22, 0.7], [0, 0.85]];
    const slope = (z0, y0, z1, y1, sign) =>
      s.slab([-0.62, y0, z0 * sign], [0.62, y0, z0 * sign], [0.62, y1, z1 * sign], [-0.62, y1, z1 * sign], 0.04, C.flatRoof);
    slope(roof[0][0], roof[0][1], roof[1][0], roof[1][1], 1);
    slope(roof[1][0], roof[1][1], roof[2][0], roof[2][1], 1);
    s.at(0, 0, 0, Math.PI, () => {
      slope(roof[0][0], roof[0][1], roof[1][0], roof[1][1], 1);
      slope(roof[1][0], roof[1][1], roof[2][0], roof[2][1], 1);
    });
    s.box(-0.64, 0.84, -0.03, 0.64, 0.89, 0.03, C.trim, []);
    s.at(0.56, 0.04, 0, Math.PI / 2, () => crossDoor(s, 0.34, 0.36));
    s.at(-0.56, 0.04, 0, -Math.PI / 2, () => crossDoor(s, 0.34, 0.36));
    s.at(0.56, 0.58, 0, Math.PI / 2, () => s.box(-0.07, 0, 0, 0.07, 0.1, 0.02, C.white, []));
    for (const x of [-0.3, 0, 0.3]) s.at(x, 0.24, 0.36, 0, () => window2(s, 0.12, 0.12));
    s.box(0.62, 0.04, 0.12, 0.74, 0.12, 0.3, C.wood, []);
    s.box(0.64, 0.12, 0.14, 0.72, 0.16, 0.28, C.bread, []);
  },
};

export const silo = {
  name: "silo",
  atlas: "town",
  build(s) {
    s.frustum(10, 0.26, 0.26, 0, 0.05, C.stoneShade);
    s.frustum(10, 0.22, 0.22, 0.05, 1.05, C.white, { cap: false });
    for (const y of [0.3, 0.55, 0.8]) s.frustum(10, 0.228, 0.228, y, y + 0.03, C.whiteShade, { cap: false });
    s.frustum(10, 0.24, 0.16, 1.05, 1.17, C.flatRoof, { base: true });
    s.frustum(10, 0.16, 0, 1.17, 1.25, C.flatRoof);
    s.at(0, 0, 0.22, 0, () => {
      for (let y = 0.1; y < 1.0; y += 0.08) s.box(-0.04, y, 0, 0.04, y + 0.012, 0.03, C.trim, []);
      for (const x of [-0.045, 0.045]) s.box(x - 0.006, 0.08, 0.02, x + 0.006, 1.02, 0.032, C.trim, []);
    });
  },
};

export const farmhouse = {
  name: "farmhouse",
  atlas: "town",
  build(s) {
    s.box(-0.5, 0, -0.38, 0.5, 0.05, 0.42, C.trim);
    s.box(-0.44, 0.05, -0.32, 0.44, 0.78, 0.3, { all: C.wall, top: C.wallShade });
    s.gable(-0.44, 0.44, -0.32, 0.3, 0.78, 0.26, C.wall);
    s.slab([-0.5, 0.75, 0.38], [0.5, 0.75, 0.38], [0.5, 1.05, -0.01], [-0.5, 1.05, -0.01], 0.045, C.roof);
    s.slab([0.5, 0.75, -0.4], [-0.5, 0.75, -0.4], [-0.5, 1.05, -0.01], [0.5, 1.05, -0.01], 0.045, C.roof);
    s.box(-0.52, 1.04, -0.04, 0.52, 1.1, 0.03, C.roofLight, []);
    s.box(-0.3, 0.8, -0.24, -0.18, 1.2, -0.12, C.brick, []);
    s.box(-0.32, 1.2, -0.26, -0.16, 1.24, -0.1, C.trim, []);

    s.box(-0.44, 0.05, 0.3, 0.44, 0.08, 0.5, C.wood, ["bottom"]);
    for (const x of [-0.4, -0.13, 0.13, 0.4]) s.box(x - 0.018, 0.08, 0.47, x + 0.018, 0.4, 0.49, C.white, []);
    s.slab([-0.47, 0.42, 0.53], [0.47, 0.42, 0.53], [0.47, 0.47, 0.3], [-0.47, 0.47, 0.3], 0.025, C.roof);
    for (const x of [-0.4, -0.2, 0.2, 0.4]) s.box(x - 0.01, 0.08, 0.475, x + 0.01, 0.2, 0.485, C.white, []);
    s.box(-0.4, 0.19, 0.47, 0.4, 0.21, 0.49, C.white, []);

    s.at(0, 0.05, 0.3, 0, () => {
      s.box(-0.09, 0, 0, 0.09, 0.3, 0.016, C.trim, []);
      s.box(-0.07, 0, 0.006, 0.07, 0.28, 0.028, C.woodDark, []);
    });
    for (const x of [-0.27, 0.27]) s.at(x, 0.15, 0.3, 0, () => window2(s, 0.13, 0.14));
    for (const x of [-0.22, 0.22]) s.at(x, 0.5, 0.3, 0, () => window2(s, 0.12, 0.13, { box: true }));
    s.at(0.44, 0.3, 0, Math.PI / 2, () => window2(s, 0.13, 0.15));
    s.at(-0.44, 0.3, 0, -Math.PI / 2, () => window2(s, 0.13, 0.15));
    s.at(0, 0.3, -0.32, Math.PI, () => window2(s, 0.13, 0.15));
  },
};
