import { TOWN as C } from "../parts.mjs";
import { doubleDoor, window2 } from "./common.mjs";

const FRONT = [-0.98, -0.76, -0.54, 0.54, 0.76, 0.98];
const BACK = [-0.8, -0.4, 0, 0.4, 0.8];

function clock(s, r) {
  const ring = (rad, z) => Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * rad, Math.sin((i * Math.PI) / 4) * rad, z]);
  s.face(ring(r + 0.018, 0.008), C.trim, [0, 0, -1]);
  s.face(ring(r, 0.014), C.white, [0, 0, -1]);
  s.box(-0.006, -0.004, 0.014, 0.006, r * 0.75, 0.022, C.trim, []);
  s.box(-0.004, -0.006, 0.014, r * 0.55, 0.006, 0.022, C.trim, []);
}

export default {
  name: "school",
  atlas: "town",
  build(s) {
    s.box(-1.16, 0, -0.5, 1.16, 0.05, 0.5, C.trim);
    s.box(-1.08, 0.05, -0.42, 1.08, 0.86, 0.42, { all: C.wall, top: C.wallShade });
    s.box(-1.1, 0.44, -0.44, 1.1, 0.48, 0.44, C.white, []);
    s.gable(-1.08, 1.08, -0.42, 0.42, 0.86, 0.26, C.wall);
    s.slab([-1.14, 0.83, 0.5], [1.14, 0.83, 0.5], [1.14, 1.13, 0], [-1.14, 1.13, 0], 0.045, C.roof);
    s.slab([1.14, 0.83, -0.5], [-1.14, 0.83, -0.5], [-1.14, 1.13, 0], [1.14, 1.13, 0], 0.045, C.roof);
    s.box(-1.16, 1.125, -0.035, 1.16, 1.18, 0.035, C.roofLight, []);

    s.box(-0.27, 0.05, 0.3, 0.27, 1.02, 0.58, { all: C.white, top: C.whiteShade });
    s.box(-0.29, 0.44, 0.3, 0.29, 0.48, 0.6, C.wall, []);
    s.slab([-0.32, 0.99, 0.25], [-0.32, 0.99, 0.64], [0, 1.22, 0.64], [0, 1.22, 0.25], 0.04, C.roof);
    s.slab([0.32, 0.99, 0.64], [0.32, 0.99, 0.25], [0, 1.22, 0.25], [0, 1.22, 0.64], 0.04, C.roof);
    s.face([[-0.27, 1.02, 0.58], [0.27, 1.02, 0.58], [0, 1.2, 0.58]], C.white, [0, 1.05, 0.3]);
    s.at(0, 1.08, 0.58, 0, () => clock(s, 0.06));

    s.at(0, 0.05, 0.58, 0, () => doubleDoor(s, 0.2, 0.3));
    s.box(-0.24, 0, 0.58, 0.24, 0.025, 0.7, C.whiteShade, ["bottom"]);
    s.box(-0.2, 0.025, 0.58, 0.2, 0.05, 0.65, C.whiteShade, []);
    s.box(-0.16, 0.38, 0.58, 0.16, 0.42, 0.6, C.bread, []);
    s.at(0, 0.6, 0.58, 0, () => window2(s, 0.22, 0.18));

    s.box(-0.09, 1.1, -0.09, 0.09, 1.34, 0.09, C.white, []);
    s.at(0, 1.2, 0.09, 0, () => clock(s, 0.055));
    s.at(0, 1.2, -0.09, Math.PI, () => clock(s, 0.055));
    s.frustum(4, 0.17, 0, 1.34, 1.52, C.roof, { phase: Math.PI / 4, cap: false });
    s.frustum(4, 0.17, 0.17, 1.33, 1.35, C.roofLight, { phase: Math.PI / 4, base: true });
    s.frustum(6, 0.012, 0.012, 1.5, 1.6, C.trim, { cap: false });

    for (const y of [0.15, 0.58]) {
      for (const x of FRONT) s.at(x, y, 0.42, 0, () => window2(s, 0.14, 0.18, { box: y > 0.5 && Math.abs(x) < 0.7 }));
      for (const x of BACK) s.at(x, y, -0.42, Math.PI, () => window2(s, 0.14, 0.18));
      s.at(1.08, y, 0, Math.PI / 2, () => window2(s, 0.16, 0.18));
      s.at(-1.08, y, 0, -Math.PI / 2, () => window2(s, 0.16, 0.18));
    }

    s.box(0.86, 0, 0.62, 0.92, 0.04, 0.68, C.whiteShade, []);
    s.box(0.882, 0.04, 0.642, 0.898, 0.9, 0.658, C.white, []);
    s.box(0.898, 0.72, 0.646, 1.04, 0.84, 0.654, C.awning, []);
  },
};
