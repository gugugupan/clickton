import { TOWN as C } from "../parts.mjs";

export function window2(s, w, h, { box = false } = {}) {
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

export function ribbon(s, w, h, step) {
  s.box(-w / 2 - 0.02, -0.02, 0, w / 2 + 0.02, h + 0.02, 0.016, C.trim, []);
  s.box(-w / 2, 0, 0.006, w / 2, h, 0.026, C.glass, []);
  const n = Math.round(w / step);
  for (let i = 1; i < n; i++) {
    const x = -w / 2 + (i * w) / n;
    s.box(x - 0.008, 0, 0.006, x + 0.008, h, 0.03, C.trim, []);
  }
}

export function awning(s, x0, x1, y, depth, drop, stripes = 6) {
  const step = (x1 - x0) / stripes;
  for (let i = 0; i < stripes; i++) {
    const a = x0 + i * step, b = a + step;
    const paint = i % 2 ? C.white : C.awning;
    s.slab([a, y, 0], [a, y - drop, depth], [b, y - drop, depth], [b, y, 0], 0.014, paint);
    s.box(a, y - drop - 0.055, depth - 0.012, b, y - drop + 0.004, depth + 0.004, paint, []);
  }
}

export function doubleDoor(s, w, h) {
  s.box(-w / 2 - 0.03, 0, 0, w / 2 + 0.03, h + 0.03, 0.016, C.trim, []);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -w / 2 : 0.006, x1 = side < 0 ? -0.006 : w / 2;
    s.box(x0, 0, 0.006, x1, h, 0.03, C.door, []);
    s.box(x0 + 0.025, h * 0.5, 0.02, x1 - 0.025, h - 0.03, 0.036, C.glass, []);
  }
}
