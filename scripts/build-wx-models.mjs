import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "public", "models");
const out = join(root, "minigame", "models");

await MeshoptDecoder.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const size = (dir) =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size), 0);

rmSync(out, { recursive: true, force: true });
const packages = [];
for (const pack of readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
  const from = join(src, pack);
  const dest = join(out, pack);
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(from)) {
    if (file.endsWith(".bin")) continue;
    if (!file.endsWith(".gltf")) {
      cpSync(join(from, file), join(dest, file), { recursive: true });
      continue;
    }
    const doc = await io.read(join(from, file));
    for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === "EXT_meshopt_compression") ext.dispose();
    await io.write(join(dest, file), doc);
  }
  writeFileSync(join(dest, "game.js"), "");
  packages.push({ name: pack, bytes: size(dest) });
}

for (const p of packages) console.log(`${p.name.padEnd(12)} ${(p.bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`total        ${(packages.reduce((s, p) => s + p.bytes, 0) / 1024 / 1024).toFixed(2)} MB`);
