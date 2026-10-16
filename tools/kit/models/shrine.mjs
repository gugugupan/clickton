import { TOWN as C } from "../parts.mjs";

function curvedBeam(s, half, y, depth, thick, rise, paint) {
  s.slab([-half, y + rise, -depth], [-half * 0.55, y, -depth], [-half * 0.55, y, depth], [-half, y + rise, depth], thick, paint);
  s.box(-half * 0.55, y, -depth, half * 0.55, y + thick, depth, paint, []);
  s.slab([half * 0.55, y, -depth], [half, y + rise, -depth], [half, y + rise, depth], [half * 0.55, y, depth], thick, paint);
}

export const torii = {
  name: "torii_gate",
  atlas: "town",
  build(s) {
    for (const x of [-0.32, 0.32]) {
      s.at(x, 0, 0, 0, () => {
        s.frustum(8, 0.06, 0.06, 0, 0.06, C.trim);
        s.frustum(8, 0.045, 0.04, 0.06, 0.86, C.red, { cap: false });
      });
    }
    s.box(-0.44, 0.62, -0.035, 0.44, 0.69, 0.035, C.red, []);
    s.box(-0.03, 0.69, -0.03, 0.03, 0.8, 0.03, C.red, []);
    s.box(-0.07, 0.71, 0.03, 0.07, 0.78, 0.04, C.white, []);
    s.box(-0.5, 0.8, -0.045, 0.5, 0.86, 0.045, C.red, []);
    curvedBeam(s, 0.6, 0.86, 0.06, 0.05, 0.06, C.trim);
  },
};

export const stoneLantern = {
  name: "shrine_lantern",
  atlas: "town",
  build(s) {
    s.frustum(6, 0.13, 0.11, 0, 0.05, C.stoneShade);
    s.frustum(6, 0.045, 0.04, 0.05, 0.36, C.stone, { cap: false });
    s.frustum(6, 0.1, 0.09, 0.36, 0.4, C.stoneShade);
    s.box(-0.07, 0.4, -0.07, 0.07, 0.54, 0.07, C.stone, []);
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) s.at(0, 0.43, 0, r, () => s.box(-0.035, 0, 0.068, 0.035, 0.08, 0.076, C.glass, []));
    s.frustum(6, 0.15, 0.02, 0.54, 0.66, C.stoneShade, { base: true, phase: Math.PI / 6 });
    s.at(0, 0.68, 0, 0, () => s.blob(0.03, 1.2, 9, C.stone, 0));
  },
};

export const shrineHall = {
  name: "shrine_hall",
  atlas: "town",
  build(s) {
    s.box(-0.5, 0, -0.44, 0.5, 0.06, 0.44, C.stoneShade);
    s.box(-0.44, 0.06, -0.38, 0.44, 0.14, 0.4, C.woodDark, []);
    for (let i = 0; i < 3; i++) s.box(-0.16, 0.06 - i * 0.02, 0.4 + i * 0.05, 0.16, 0.08 - i * 0.02, 0.45 + i * 0.05, C.woodDark, ["bottom"]);
    s.box(-0.34, 0.14, -0.3, 0.34, 0.5, 0.26, { all: C.white, top: C.whiteShade });
    for (const x of [-0.38, -0.13, 0.13, 0.38]) {
      for (const z of [-0.34, 0.32]) s.box(x - 0.025, 0.14, z - 0.025, x + 0.025, 0.54, z + 0.025, C.red, []);
    }
    s.box(-0.4, 0.5, -0.36, 0.4, 0.55, 0.34, C.red, []);
    s.box(-0.3, 0.14, 0.255, -0.04, 0.42, 0.27, C.wood, []);
    s.box(0.04, 0.14, 0.255, 0.3, 0.42, 0.27, C.wood, []);
    for (const x of [-0.25, -0.17, -0.09, 0.09, 0.17, 0.25]) s.box(x - 0.006, 0.16, 0.27, x + 0.006, 0.4, 0.278, C.woodDark, []);
    s.box(-0.04, 0.38, 0.27, 0.04, 0.46, 0.28, C.bread, []);

    const eave = 0.58, ridge = 0.9;
    s.slab([-0.58, eave, 0.52], [0.58, eave, 0.52], [0.5, ridge, -0.02], [-0.5, ridge, -0.02], 0.05, C.flatRoof);
    s.slab([0.58, eave, -0.54], [-0.58, eave, -0.54], [-0.5, ridge, 0.0], [0.5, ridge, 0.0], 0.05, C.flatRoof);
    s.slab([-0.62, eave + 0.04, 0.58], [0.62, eave + 0.04, 0.58], [0.58, eave, 0.5], [-0.58, eave, 0.5], 0.03, C.flatRoof);
    s.slab([0.62, eave + 0.04, -0.6], [-0.62, eave + 0.04, -0.6], [-0.58, eave, -0.52], [0.58, eave, -0.52], 0.03, C.flatRoof);
    s.face([[-0.36, 0.55, 0.3], [-0.36, 0.55, -0.32], [-0.36, ridge - 0.02, -0.01]], C.white, [0, 0.7, 0]);
    s.face([[0.36, 0.55, 0.3], [0.36, 0.55, -0.32], [0.36, ridge - 0.02, -0.01]], C.white, [0, 0.7, 0]);
    s.box(-0.56, ridge - 0.01, -0.05, 0.56, ridge + 0.06, 0.04, C.trim, []);
    for (const x of [-0.56, 0.56]) s.box(x - 0.03, ridge + 0.04, -0.05, x + 0.03, ridge + 0.1, 0.04, C.trim, []);
    for (const x of [-0.3, 0, 0.3]) s.box(x - 0.025, ridge + 0.06, -0.06, x + 0.025, ridge + 0.09, 0.05, C.bread, []);

    s.box(-0.12, 0.14, 0.42, 0.12, 0.24, 0.52, C.wood, []);
    s.box(-0.1, 0.24, 0.44, 0.1, 0.25, 0.5, C.woodDark, []);
    s.box(-0.012, 0.55, 0.33, 0.012, 0.7, 0.345, C.bread, []);
    s.at(0, 0.5, 0.37, 0, () => s.blob(0.045, 1, 3, C.bread, 0));
  },
};
