import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = join(root, "assets-raw");
const out = join(root, "public", "models");
const catalog = JSON.parse(readFileSync(join(root, "src", "render", "assets.json"), "utf8"));

rmSync(out, { recursive: true, force: true });
for (const [key, pack] of Object.entries(catalog.packs)) {
  mkdirSync(join(out, key), { recursive: true });
  copyFileSync(join(raw, pack.license), join(out, key, "LICENSE.txt"));
}

let count = 0;
for (const model of Object.values(catalog.models)) {
  const pack = catalog.packs[model.pack];
  const src = join(raw, pack.source, model.file);
  const gltf = JSON.parse(readFileSync(src, "utf8"));
  const dest = join(out, model.pack);
  copyFileSync(src, join(dest, basename(model.file)));
  for (const b of gltf.buffers ?? []) copyFileSync(join(dirname(src), b.uri), join(dest, b.uri));
  for (const img of gltf.images ?? []) copyFileSync(join(dirname(src), img.uri), join(dest, img.uri));
  count++;
}
console.log(`copied ${count} models into public/models`);
