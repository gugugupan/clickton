import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = join(root, "assets-raw");
const out = join(root, "public", "models");
const catalog = JSON.parse(readFileSync(join(root, "src", "render", "assets.json"), "utf8"));

rmSync(out, { recursive: true, force: true });
for (const [key, pack] of Object.entries(catalog.packs)) {
  mkdirSync(join(out, key), { recursive: true });
  if (pack.license) copyFileSync(join(raw, pack.license), join(out, key, "LICENSE.txt"));
  else writeFileSync(join(out, key, "LICENSE.txt"), `${pack.licenseNote}\n`);
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

function glbImages(file) {
  const buf = readFileSync(file);
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString("utf8"));
  return (json.images ?? []).map((i) => i.uri).filter(Boolean);
}

for (const [key, group] of Object.entries(catalog.agents)) {
  const dest = join(out, key);
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(raw, group.license), join(dest, "LICENSE.txt"));
  for (const file of group.files) {
    const src = join(raw, group.source, file);
    copyFileSync(src, join(dest, file));
    for (const uri of glbImages(src)) {
      mkdirSync(dirname(join(dest, uri)), { recursive: true });
      copyFileSync(join(dirname(src), uri), join(dest, uri));
    }
    count++;
  }
}
console.log(`copied ${count} models into public/models`);
