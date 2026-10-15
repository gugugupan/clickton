import { TOWN as C } from "../parts.mjs";

const STRIPES = 6;

function window2(s, w, h, { box = false } = {}) {
  s.box(-w / 2 - 0.02, -0.02, 0, w / 2 + 0.02, h + 0.02, 0.016, C.trim, []);
  s.box(-w / 2, 0, 0.006, w / 2, h, 0.026, C.glass, []);
  s.box(-0.009, 0, 0.006, 0.009, h, 0.03, C.trim, []);
  s.box(-w / 2, h / 2 - 0.009, 0.006, w / 2, h / 2 + 0.009, 0.03, C.trim, []);
  if (!box) return;
  s.box(-w / 2 - 0.03, -0.055, 0, w / 2 + 0.03, -0.02, 0.06, C.woodDark, []);
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + (i + 0.5) * (w / 4);
    s.box(x - 0.022, -0.02, 0.012, x + 0.022, 0.012, 0.052, i % 2 ? C.leaf : C.flower, []);
  }
}

function awning(s, x0, x1, y, depth, drop) {
  const step = (x1 - x0) / STRIPES;
  for (let i = 0; i < STRIPES; i++) {
    const a = x0 + i * step, b = a + step;
    const paint = i % 2 ? C.white : C.awning;
    s.slab([a, y, 0], [a, y - drop, depth], [b, y - drop, depth], [b, y, 0], 0.014, paint);
    s.box(a, y - drop - 0.055, depth - 0.012, b, y - drop + 0.004, depth + 0.004, paint, []);
  }
}

export default {
  name: "bakery",
  atlas: "town",
  build(s) {
    s.box(-0.46, 0, -0.42, 0.46, 0.05, 0.42, C.trim);
    s.box(-0.42, 0.05, -0.38, 0.42, 0.52, 0.38, { all: C.wall, top: C.wallShade });
    s.box(-0.44, 0.52, -0.4, 0.44, 0.56, 0.4, C.white, []);
    s.box(-0.4, 0.56, -0.36, 0.4, 0.88, 0.36, { all: C.white, top: C.whiteShade }, ["bottom"]);

    s.gable(-0.4, 0.4, -0.36, 0.36, 0.88, 0.245, C.white);
    s.slab([-0.47, 0.86, 0.45], [0.47, 0.86, 0.45], [0.47, 1.165, 0], [-0.47, 1.165, 0], 0.045, C.roof);
    s.slab([0.47, 0.86, -0.45], [-0.47, 0.86, -0.45], [-0.47, 1.165, 0], [0.47, 1.165, 0], 0.045, C.roof);
    s.box(-0.49, 1.16, -0.035, 0.49, 1.215, 0.035, C.roofLight, []);
    s.box(0.17, 0.9, -0.29, 0.3, 1.3, -0.16, C.brick, []);
    s.box(0.15, 1.3, -0.31, 0.32, 1.34, -0.14, C.trim, []);

    s.at(0, 0, 0.38, 0, () => {
      s.at(-0.16, 0.13, 0, 0, () => window2(s, 0.38, 0.24));
      s.box(-0.39, 0.09, 0, 0.07, 0.115, 0.05, C.white, []);
      s.box(0.11, 0.05, 0, 0.35, 0.41, 0.016, C.trim, []);
      s.box(0.14, 0.05, 0.006, 0.32, 0.385, 0.03, C.door, []);
      s.box(0.17, 0.23, 0.02, 0.29, 0.35, 0.036, C.glass, []);
      s.box(0.27, 0.17, 0.02, 0.295, 0.19, 0.05, C.bread, []);
      s.box(0.09, 0, 0, 0.37, 0.03, 0.11, C.whiteShade, ["bottom"]);
      awning(s, -0.4, 0.06, 0.46, 0.2, 0.07);
      s.at(0.23, 0, 0, 0, () => s.slab([-0.13, 0.45, 0], [-0.13, 0.42, 0.11], [0.13, 0.42, 0.11], [0.13, 0.45, 0], 0.014, C.awning));
      s.box(-0.36, 0.475, 0, 0.04, 0.515, 0.02, C.woodDark, []);
      s.at(-0.16, 0.495, 0.03, 0, () => s.blob(0.032, 0.55, 7, C.bread, 0.08));
    });

    s.at(0, 0.64, 0.36, 0, () => {
      s.at(-0.19, 0, 0, 0, () => window2(s, 0.15, 0.17, { box: true }));
      s.at(0.17, 0, 0, 0, () => window2(s, 0.15, 0.17, { box: true }));
    });
    s.at(0.4, 0.64, 0, Math.PI / 2, () => window2(s, 0.15, 0.17));
    s.at(-0.4, 0.64, 0, -Math.PI / 2, () => window2(s, 0.15, 0.17));
    s.at(-0.42, 0.18, -0.1, -Math.PI / 2, () => window2(s, 0.17, 0.2));
    s.at(0, 0.64, -0.36, Math.PI, () => window2(s, 0.15, 0.17));
    s.at(0.18, 0, -0.38, Math.PI, () => {
      s.box(-0.09, 0.05, 0, 0.09, 0.36, 0.016, C.trim, []);
      s.box(-0.07, 0.05, 0.006, 0.07, 0.34, 0.03, C.door, []);
      s.box(-0.1, 0, 0, 0.1, 0.03, 0.08, C.whiteShade, ["bottom"]);
    });
    s.box(-0.3, 0.05, -0.5, -0.16, 0.17, -0.38, C.wood, []);
    s.box(-0.28, 0.17, -0.48, -0.18, 0.2, -0.4, C.bread, []);

    s.box(0.4, 0.7, 0.33, 0.42, 0.72, 0.5, C.trim, []);
    s.box(0.403, 0.56, 0.4, 0.417, 0.7, 0.5, C.bread, []);
    s.at(0.41, 0.63, 0.45, 0, () => s.blob(0.035, 0.6, 3, C.crust, 0.1));
  },
};
