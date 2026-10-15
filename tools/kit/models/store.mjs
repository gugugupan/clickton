import { TOWN as C } from "../parts.mjs";
import { awning, ribbon } from "./common.mjs";

const W = 0.75, D = 0.65, TOP = 1.3;

function storefront(s, w) {
  s.at(0, 0.1, 0, 0, () => ribbon(s, w, 0.27, 0.2));
  s.box(-w / 2 - 0.04, 0.06, 0, w / 2 + 0.04, 0.09, 0.05, C.white, []);
  s.at(0, 0, 0.02, 0, () => awning(s, -w / 2 - 0.03, w / 2 + 0.03, 0.44, 0.16, 0.06, 10));
}

function upper(s, w) {
  for (const y of [0.55, 0.97]) s.at(0, y, 0, 0, () => ribbon(s, w, 0.24, 0.13));
}

export default {
  name: "dept_store",
  atlas: "town",
  build(s) {
    s.box(-W - 0.05, 0, -D - 0.05, W + 0.05, 0.05, D + 0.05, C.trim);
    s.box(-W, 0.05, -D, W, TOP, D, { all: C.white, top: C.flatRoof });
    for (const y of [0.46, 0.88]) s.box(-W - 0.02, y, -D - 0.02, W + 0.02, y + 0.04, D + 0.02, C.trim, []);
    s.box(-W - 0.02, TOP, -D - 0.02, W + 0.02, TOP + 0.08, -D + 0.04, C.whiteShade, []);
    s.box(-W - 0.02, TOP, D - 0.04, W + 0.02, TOP + 0.08, D + 0.02, C.whiteShade, []);
    s.box(-W - 0.02, TOP, -D + 0.04, -W + 0.04, TOP + 0.08, D - 0.04, C.whiteShade, []);
    s.box(W - 0.04, TOP, -D + 0.04, W + 0.02, TOP + 0.08, D - 0.04, C.whiteShade, []);

    s.at(0, 0, D, 0, () => {
      storefront(s, 1.3);
      upper(s, 1.3);
      s.box(-0.12, 0.05, 0.03, 0.12, 0.37, 0.05, C.trim, []);
      s.box(-0.1, 0.05, 0.04, 0.1, 0.35, 0.06, C.glass, []);
    });
    s.at(W, 0, 0, Math.PI / 2, () => {
      storefront(s, 1.1);
      upper(s, 1.1);
    });
    s.at(-W, 0, 0, -Math.PI / 2, () => upper(s, 1.1));
    s.at(0, 0, -D, Math.PI, () => {
      upper(s, 1.3);
      s.box(0.3, 0.05, 0, 0.5, 0.33, 0.03, C.door, []);
    });

    s.box(-0.5, TOP + 0.08, D - 0.12, -0.46, TOP + 0.22, D - 0.08, C.trim, []);
    s.box(0.46, TOP + 0.08, D - 0.12, 0.5, TOP + 0.22, D - 0.08, C.trim, []);
    s.box(-0.56, TOP + 0.2, D - 0.11, 0.56, TOP + 0.42, D - 0.06, C.awning, []);
    for (let i = 0; i < 6; i++) {
      const x = -0.42 + i * 0.168;
      s.box(x - 0.05, TOP + 0.25, D - 0.06, x + 0.05, TOP + 0.37, D - 0.045, C.white, []);
    }

    s.box(-0.55, TOP, -0.5, -0.2, TOP + 0.2, -0.2, { all: C.white, top: C.whiteShade }, []);
    s.box(-0.5, TOP + 0.05, -0.2, -0.35, TOP + 0.18, -0.19, C.door, []);
    for (const x of [0.15, 0.45]) {
      s.box(x - 0.1, TOP, -0.45, x + 0.1, TOP + 0.12, -0.25, C.whiteShade, []);
      s.box(x - 0.06, TOP + 0.12, -0.39, x + 0.06, TOP + 0.13, -0.31, C.trim, []);
    }
  },
};
