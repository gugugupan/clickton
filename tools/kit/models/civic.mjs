import { TOWN as C } from "../parts.mjs";
import { doubleDoor, window2 } from "./common.mjs";

function column(s, x, z, y0, y1, r) {
  s.at(x, 0, z, 0, () => {
    s.box(-r - 0.012, y0, -r - 0.012, r + 0.012, y0 + 0.03, r + 0.012, C.whiteShade, []);
    s.frustum(8, r, r * 0.9, y0 + 0.03, y1 - 0.03, C.white, { cap: false });
    s.box(-r - 0.012, y1 - 0.03, -r - 0.012, r + 0.012, y1, r + 0.012, C.whiteShade, []);
  });
}

function dial(s, r) {
  const ring = (rad, z) => Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * rad, Math.sin((i * Math.PI) / 4) * rad, z]);
  s.face(ring(r + 0.016, 0.008), C.trim, [0, 0, -1]);
  s.face(ring(r, 0.014), C.white, [0, 0, -1]);
  s.box(-0.005, -0.004, 0.014, 0.005, r * 0.75, 0.022, C.trim, []);
  s.box(-0.004, -0.005, 0.014, r * 0.55, 0.005, 0.022, C.trim, []);
}

export const townHall = {
  name: "town_hall",
  atlas: "town",
  build(s) {
    s.box(-1.0, 0, -0.5, 1.0, 0.06, 0.62, C.stoneShade);
    s.box(-0.92, 0.06, -0.42, 0.92, 0.86, 0.36, { all: C.white, top: C.flatRoof });
    s.box(-0.95, 0.44, -0.45, 0.95, 0.48, 0.39, C.stone, []);
    s.box(-0.95, 0.86, -0.45, 0.95, 0.94, 0.39, C.stone, []);
    s.box(-0.36, 0.06, 0.36, 0.36, 0.1, 0.62, C.stone, ["bottom"]);
    s.box(-0.32, 0.1, 0.36, 0.32, 0.13, 0.56, C.stone, []);
    for (const x of [-0.27, -0.09, 0.09, 0.27]) column(s, x, 0.5, 0.13, 0.78, 0.035);
    s.box(-0.33, 0.78, 0.36, 0.33, 0.84, 0.56, C.whiteShade, []);
    s.face([[-0.33, 0.84, 0.56], [0.33, 0.84, 0.56], [0, 1.0, 0.56]], C.white, [0, 0.9, 0.4]);
    s.slab([-0.36, 0.83, 0.36], [-0.36, 0.83, 0.6], [0, 1.02, 0.6], [0, 1.02, 0.36], 0.03, C.roof);
    s.slab([0.36, 0.83, 0.6], [0.36, 0.83, 0.36], [0, 1.02, 0.36], [0, 1.02, 0.6], 0.03, C.roof);
    s.at(0, 0.13, 0.36, 0, () => doubleDoor(s, 0.18, 0.3));

    for (const x of [-0.75, -0.55, 0.55, 0.75]) {
      s.at(x, 0.16, 0.36, 0, () => window2(s, 0.12, 0.2));
      s.at(x, 0.58, 0.36, 0, () => window2(s, 0.12, 0.2));
    }
    for (const x of [-0.6, -0.2, 0.2, 0.6]) s.at(x, 0.58, -0.42, Math.PI, () => window2(s, 0.12, 0.2));
    for (const y of [0.16, 0.58]) {
      s.at(0.92, y, 0, Math.PI / 2, () => window2(s, 0.14, 0.2));
      s.at(-0.92, y, 0, -Math.PI / 2, () => window2(s, 0.14, 0.2));
    }

    s.box(-0.16, 0.94, -0.2, 0.16, 1.32, 0.12, { all: C.white, top: C.whiteShade });
    s.at(0, 1.13, 0.12, 0, () => dial(s, 0.08));
    s.at(0.16, 1.13, -0.04, Math.PI / 2, () => dial(s, 0.08));
    s.box(-0.19, 1.32, -0.23, 0.19, 1.36, 0.15, C.stone, []);
    s.at(0, 0, -0.04, 0, () => {
      s.frustum(4, 0.24, 0, 1.36, 1.62, C.roof, { phase: Math.PI / 4, cap: false });
      s.frustum(6, 0.01, 0.01, 1.6, 1.78, C.trim, { cap: false });
      s.box(0.01, 1.66, -0.004, 0.12, 1.74, 0.004, C.awning, []);
    });
  },
};

export const library = {
  name: "library",
  atlas: "town",
  build(s) {
    s.box(-0.78, 0, -0.5, 0.78, 0.06, 0.58, C.stoneShade);
    s.box(-0.72, 0.06, -0.44, 0.72, 0.72, 0.44, { all: C.wood, top: C.flatRoof });
    s.box(-0.75, 0.72, -0.47, 0.75, 0.8, 0.47, C.white, []);
    s.box(-0.75, 0.06, -0.47, 0.75, 0.12, 0.47, C.white, []);
    for (const x of [-0.56, -0.36, 0.36, 0.56]) {
      s.at(x, 0.18, 0.44, 0, () => {
        window2(s, 0.12, 0.42);
        s.frustum(6, 0.075, 0.075, 0.43, 0.455, C.white, { cap: true });
      });
    }
    for (const x of [-0.5, -0.25, 0, 0.25, 0.5]) s.at(x, 0.2, -0.44, Math.PI, () => window2(s, 0.12, 0.36));
    for (const z of [-0.2, 0.2]) {
      s.at(0.72, 0.2, z, Math.PI / 2, () => window2(s, 0.12, 0.36));
      s.at(-0.72, 0.2, z, -Math.PI / 2, () => window2(s, 0.12, 0.36));
    }
    s.box(-0.24, 0.06, 0.44, 0.24, 0.84, 0.52, { all: C.white, top: C.whiteShade });
    s.at(0, 0.12, 0.52, 0, () => doubleDoor(s, 0.16, 0.3));
    s.box(-0.2, 0.5, 0.52, 0.2, 0.64, 0.54, C.woodDark, []);
    const books = [C.red, C.glass, C.bread, C.leaf, C.awning];
    books.forEach((paint, i) => s.box(-0.15 + i * 0.06, 0.53, 0.54, -0.11 + i * 0.06, 0.61, 0.56, paint, []));
    s.box(-0.28, 0, 0.52, 0.28, 0.035, 0.66, C.stone, ["bottom"]);
    s.box(-0.24, 0.035, 0.52, 0.24, 0.06, 0.6, C.stone, []);
    s.box(-0.3, 0.84, -0.12, 0.3, 0.88, 0.12, C.whiteShade, []);
    s.frustum(8, 0.2, 0.2, 0.8, 0.9, C.white, { cap: false });
    s.frustum(8, 0.21, 0.04, 0.9, 1.08, C.roof);
  },
};

export const boat = {
  name: "boat",
  atlas: "town",
  build(s) {
    const hull = [
      [-0.32, 0, -0.1], [0.24, 0, -0.08], [0.24, 0, 0.08], [-0.32, 0, 0.1],
      [-0.4, 0.14, -0.17], [0.38, 0.16, -0.001], [0.38, 0.16, 0.001], [-0.4, 0.14, 0.17],
    ];
    s.hexa(hull, { all: C.wood, top: C.woodDark });
    s.slab([-0.4, 0.14, -0.17], [-0.4, 0.14, 0.17], [-0.38, 0.17, 0.17], [-0.38, 0.17, -0.17], 0.02, C.white);
    s.box(-0.08, 0.1, -0.13, 0.02, 0.15, 0.13, C.wood, []);
    s.box(-0.3, 0.1, -0.13, -0.22, 0.15, 0.13, C.wood, []);
    s.limb([-0.05, 0.17, -0.12], [0.1, 0.05, -0.36], 0.012, 0.012, C.woodDark);
    s.limb([-0.05, 0.17, 0.12], [0.1, 0.05, 0.36], 0.012, 0.012, C.woodDark);
    s.box(0.36, 0.12, -0.05, 0.4, 0.17, 0.05, C.red, []);
  },
};
