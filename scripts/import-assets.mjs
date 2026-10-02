import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, quantize, reorder, simplify, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = join(root, "assets-raw");
const out = join(root, "public", "models");
const catalog = JSON.parse(readFileSync(join(root, "src", "render", "assets.json"), "utf8"));

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const served = (file) => basename(file).replace(/\.(glb|gltf)$/, "");

async function convert(src, dest, { simplifyMesh }) {
  const doc = await io.read(src);
  const name = served(src);
  const steps = [dedup(), weld()];
  if (simplifyMesh) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.004 }));
  steps.push(prune(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await doc.transform(...steps);
  for (const buffer of doc.getRoot().listBuffers()) buffer.setURI(`${name}.bin`);
  for (const tex of doc.getRoot().listTextures()) {
    const uri = tex.getURI();
    if (uri) mkdirSync(dirname(join(dest, uri)), { recursive: true });
  }
  await io.write(join(dest, `${name}.gltf`), doc);
}

rmSync(out, { recursive: true, force: true });
for (const [key, pack] of Object.entries(catalog.packs)) {
  mkdirSync(join(out, key), { recursive: true });
  if (pack.license) copyFileSync(join(raw, pack.license), join(out, key, "LICENSE.txt"));
  else writeFileSync(join(out, key, "LICENSE.txt"), `${pack.licenseNote}\n`);
}

let count = 0;
for (const model of Object.values(catalog.models)) {
  const pack = catalog.packs[model.pack];
  await convert(join(raw, pack.source, model.file), join(out, model.pack), { simplifyMesh: true });
  count++;
}

for (const [key, group] of Object.entries(catalog.agents)) {
  const dest = join(out, key);
  mkdirSync(dest, { recursive: true });
  copyFileSync(join(raw, group.license), join(dest, "LICENSE.txt"));
  for (const file of group.files) {
    await convert(join(raw, group.source, file), dest, { simplifyMesh: false });
    count++;
  }
}

let bytes = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else bytes += statSync(p).size;
  }
};
walk(out);
console.log(`converted ${count} models into public/models (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
