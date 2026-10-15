import { NATURE, rng } from "../parts.mjs";

const bark = (top) => (p) => NATURE.bark(0.25 + 0.6 * (1 - p[1] / top));

function tree(s, { seed, height, lean, crowns, petals }) {
  const top = height + 0.2;
  const rand = rng(seed);
  const tip = [lean[0], height, lean[1]];
  s.limb([0, 0, 0], tip, 0.3, 0.17, bark(top));
  s.frustum(6, 0.42, 0.28, 0, 0.18, bark(top), { phase: 0.3, cap: false });
  const lo = height * 0.25, hi = height + 1.6;
  const blossom = (p) => NATURE.blossom(0.15 + 0.75 * (1 - (p[1] - lo) / (hi - lo)));
  for (const [i, c] of crowns.entries()) {
    const [x, y, z, r] = c;
    if (Math.hypot(x - tip[0], z - tip[2]) > 0.5) s.limb([tip[0] * 0.7, height * 0.72, tip[2] * 0.7], [x * 0.8, y - r * 0.4, z * 0.8], 0.11, 0.06, bark(top));
    s.at(x, y, z, rand() * Math.PI, () => s.blob(r, 0.86, seed * 10 + i, blossom, 0.12));
  }
  for (let i = 0; i < petals; i++) {
    const a = rand() * Math.PI * 2, d = 0.9 + rand() * 1.1, r = 0.12 + rand() * 0.12;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const pts = Array.from({ length: 6 }, (_, k) => {
      const b = (k / 6) * Math.PI * 2 + rand() * 0.4;
      return [cx + Math.cos(b) * r, cz + Math.sin(b) * r];
    });
    s.quadUp(pts, 0.02, NATURE.blossom(0.3));
  }
}

export const cherryA = {
  name: "cherry_tree_a",
  atlas: "nature",
  build(s) {
    tree(s, {
      seed: 11,
      height: 1.9,
      lean: [0.15, -0.05],
      crowns: [
        [0.15, 2.85, 0, 1.45],
        [1.05, 2.4, 0.4, 0.95],
        [-0.9, 2.5, -0.35, 0.9],
      ],
      petals: 6,
    });
  },
};

export const cherryB = {
  name: "cherry_tree_b",
  atlas: "nature",
  build(s) {
    tree(s, {
      seed: 23,
      height: 2.4,
      lean: [-0.2, 0.1],
      crowns: [
        [-0.15, 3.3, 0.1, 1.3],
        [0.75, 2.75, -0.45, 0.85],
        [-0.1, 4.1, -0.15, 0.8],
      ],
      petals: 4,
    });
  },
};
