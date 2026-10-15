import { NATURE, rng } from "../parts.mjs";

const faceNoise = (n) => {
  const x = Math.sin(n[0] * 12.9898 + n[1] * 78.233 + n[2] * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

// Tone is chosen per face (from the face normal only) so a triangle never spans two atlas columns.
function foliage(level, top, bottom) {
  return (p, n) => {
    const score = level * 0.7 + n[1] * 0.55 + (faceNoise(n) - 0.5) * 0.5;
    const swatch = score > 0.72 ? NATURE.leafLight : score < -0.12 ? NATURE.leafDeep : NATURE.leaf;
    const t = 0.2 + 0.6 * (1 - (p[1] - bottom) / (top - bottom));
    return swatch(swatch === NATURE.leafLight ? 0.45 + t * 0.4 : t);
  };
}

const bark = (top) => (p) => NATURE.bark(0.25 + 0.6 * (1 - p[1] / top));

function leafy(s, { seed, height, lean, crown, clusters, size }) {
  const rand = rng(seed);
  const [cx, cy, cz, rx, ry] = crown;
  const top = cy + ry + size, bottom = cy - ry - size;
  const tip = [lean[0], height, lean[1]];
  s.limb([0, 0, 0], tip, 0.28, 0.16, bark(top));
  s.frustum(6, 0.4, 0.26, 0, 0.2, bark(top), { phase: 0.4, cap: false });
  s.at(cx, cy, cz, 0, () => s.blob(rx * 0.92, ry / rx, seed, foliage(-0.2, top, bottom), 0.14));
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < clusters; i++) {
    const y = 1 - ((i + 0.5) / clusters) * 1.6;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden + rand() * 0.5;
    const d = [Math.cos(a) * r, y, Math.sin(a) * r];
    const at = [cx + d[0] * rx * 0.66, cy + d[1] * ry * 0.66, cz + d[2] * rx * 0.66];
    const size_i = size * (0.75 + rand() * 0.5);
    if (i % 3 === 0 && d[1] < 0.4) s.limb([tip[0], height * 0.85, tip[2]], [at[0] * 0.75, at[1] - size_i * 0.5, at[2] * 0.75], 0.08, 0.04, bark(top));
    s.at(at[0], at[1], at[2], rand() * Math.PI, () => s.blob(size_i, 0.85, seed * 31 + i, foliage(d[1], top, bottom), 0.26));
  }
}

function pine(s, { seed, height, tiers, radius }) {
  const rand = rng(seed);
  const top = height + 0.6;
  s.limb([0, 0, 0], [0, height * 0.5, 0], 0.22, 0.14, bark(top));
  s.frustum(6, 0.3, 0.2, 0, 0.16, bark(top), { phase: 0.4, cap: false });
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const y0 = height * 0.32 + i * ((height - height * 0.32) / tiers) * 0.95;
    const r = radius * (1 - k * 0.62);
    const level = k * 1.4 - 0.6;
    s.starCone(9, r, r * 0.7, y0, y0 + r * 1.25, foliage(level, top, 0), rand() * Math.PI);
  }
}

export const leafyA = {
  name: "leafy_tree_a",
  atlas: "nature",
  build(s) {
    leafy(s, { seed: 3, height: 1.9, lean: [0.1, 0], crown: [0.05, 2.95, 0, 1.45, 1.2], clusters: 14, size: 0.5 });
  },
};

export const leafyB = {
  name: "leafy_tree_b",
  atlas: "nature",
  build(s) {
    leafy(s, { seed: 8, height: 2.3, lean: [-0.15, 0.1], crown: [-0.1, 3.3, 0.05, 1.15, 1.45], clusters: 13, size: 0.46 });
  },
};

export const leafyC = {
  name: "leafy_tree_c",
  atlas: "nature",
  build(s) {
    leafy(s, { seed: 15, height: 1.5, lean: [0.2, -0.1], crown: [0.15, 2.45, -0.05, 1.7, 1.0], clusters: 15, size: 0.5 });
  },
};

export const pineA = {
  name: "pine_tree_a",
  atlas: "nature",
  build(s) {
    pine(s, { seed: 4, height: 4.6, tiers: 5, radius: 1.35 });
  },
};

function frond(s, a, len, lift, paint) {
  const mid = [Math.cos(a) * len * 0.55, lift, Math.sin(a) * len * 0.55];
  const end = [Math.cos(a) * len, lift * 0.55, Math.sin(a) * len];
  s.limb([0, 0.02, 0], mid, 0.06, 0.045, paint);
  s.limb(mid, end, 0.045, 0.012, paint);
}

export const fern = {
  name: "fern",
  atlas: "nature",
  build(s) {
    const rand = rng(21);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
      frond(s, a, 0.55 + rand() * 0.2, 0.32 + rand() * 0.12, i % 3 ? (p) => NATURE.leaf(0.35 + p[1]) : (p) => NATURE.leafLight(0.45 + p[1]));
    }
  },
};

function mushroom(s, x, z, scale, cap) {
  s.at(x, 0, z, 0, () => {
    s.frustum(6, 0.06 * scale, 0.05 * scale, 0, 0.2 * scale, NATURE.stem(0.4), { cap: false });
    s.frustum(8, 0.17 * scale, 0.08 * scale, 0.19 * scale, 0.29 * scale, cap(0.45), { base: true });
    s.frustum(8, 0.08 * scale, 0, 0.29 * scale, 0.33 * scale, cap(0.2));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.5;
      s.at(Math.cos(a) * 0.1 * scale, 0.255 * scale, Math.sin(a) * 0.1 * scale, a, () => s.frustum(5, 0.024 * scale, 0.02 * scale, 0, 0.03 * scale, NATURE.flowerWhite(0.2)));
    }
  });
}

export const mushroomsRed = {
  name: "mushrooms_red",
  atlas: "nature",
  build(s) {
    mushroom(s, 0, 0, 1.2, NATURE.capRed);
    mushroom(s, 0.2, 0.12, 0.75, NATURE.capRed);
    mushroom(s, -0.12, 0.18, 0.55, NATURE.capRed);
  },
};

export const mushroomsBrown = {
  name: "mushrooms_brown",
  atlas: "nature",
  build(s) {
    mushroom(s, 0, 0, 1, NATURE.capBrown);
    mushroom(s, -0.18, -0.1, 0.8, NATURE.capBrown);
  },
};

function flowers(s, seed, colours) {
  const rand = rng(seed);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
    const len = 0.18 + rand() * 0.1;
    s.limb([0, 0, 0], [Math.cos(a) * len, 0.14 + rand() * 0.06, Math.sin(a) * len], 0.03, 0.008, (p) => NATURE.leaf(0.5 + p[1]));
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2, d = 0.04 + rand() * 0.14, h = 0.22 + rand() * 0.16;
    const head = [Math.cos(a) * d, h, Math.sin(a) * d];
    s.limb([head[0] * 0.4, 0, head[2] * 0.4], head, 0.012, 0.01, NATURE.leafDeep(0.4));
    s.at(head[0], head[1], head[2], rand() * Math.PI, () => {
      s.frustum(5, 0.06, 0.07, 0, 0.025, colours[i % colours.length](0.25), { base: true });
      s.frustum(5, 0.022, 0.018, 0.025, 0.04, NATURE.flowerYellow(0.6));
    });
  }
}

export const flowersPink = {
  name: "flowers_pink",
  atlas: "nature",
  build(s) {
    flowers(s, 5, [NATURE.blossom, NATURE.blossom, NATURE.flowerWhite]);
  },
};

export const flowersYellow = {
  name: "flowers_yellow",
  atlas: "nature",
  build(s) {
    flowers(s, 9, [NATURE.flowerYellow, NATURE.flowerYellow, NATURE.flowerWhite]);
  },
};

export const flowersPurple = {
  name: "flowers_purple",
  atlas: "nature",
  build(s) {
    flowers(s, 13, [NATURE.flowerPurple, NATURE.flowerPurple, NATURE.flowerWhite]);
  },
};
