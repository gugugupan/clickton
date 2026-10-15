import { TOWN as C } from "../parts.mjs";

const R = 0.38;
const corner = (k, r = R, y = 0) => [Math.cos((k * Math.PI) / 3) * r, y, Math.sin((k * Math.PI) / 3) * r];

export default {
  name: "gazebo",
  atlas: "town",
  build(s) {
    s.frustum(6, 0.47, 0.47, 0, 0.07, C.whiteShade);
    s.frustum(6, 0.43, 0.43, 0.07, 0.09, C.wood, { cap: true });
    s.box(-0.13, 0, 0.4, 0.13, 0.035, 0.52, C.whiteShade);

    for (let k = 0; k < 6; k++) {
      const [x, , z] = corner(k);
      s.at(x, 0.09, z, 0, () => {
        s.box(-0.03, 0, -0.03, 0.03, 0.04, 0.03, C.white, []);
        s.box(-0.022, 0.04, -0.022, 0.022, 0.7, 0.022, C.white, ["bottom"]);
      });
      const a = corner(k), b = corner(k + 1);
      s.beam([a[0], 0.7, a[2]], [b[0], 0.7, b[2]], 0.04, 0.045, C.white);
      if (k === 1) continue;
      s.beam([a[0], 0.3, a[2]], [b[0], 0.3, b[2]], 0.035, 0.025, C.white);
      s.beam([a[0], 0.11, a[2]], [b[0], 0.11, b[2]], 0.03, 0.02, C.white);
      for (const t of [0.25, 0.5, 0.75]) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
        s.box(x - 0.008, 0.13, z - 0.008, x + 0.008, 0.3, z + 0.008, C.white, []);
      }
    }

    s.frustum(6, 0.54, 0.54, 0.745, 0.78, C.roofLight, { base: true });
    s.frustum(6, 0.54, 0, 0.78, 1.08, C.roof);
    s.frustum(6, 0.025, 0.025, 1.06, 1.14, C.trim, { cap: false });
    s.at(0, 1.16, 0, 0, () => s.blob(0.04, 1, 5, C.bread, 0));

    s.frustum(8, 0.03, 0.03, 0.09, 0.22, C.woodDark, { cap: false });
    s.frustum(8, 0.11, 0.11, 0.22, 0.245, C.wood, { base: true });
    for (const k of [0, 2.5, 4]) {
      const [x, , z] = corner(k, 0.25);
      s.at(x, 0.09, z, 0, () => s.frustum(6, 0.045, 0.045, 0, 0.11, C.woodDark));
    }
  },
};
