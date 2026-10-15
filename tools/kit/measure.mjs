import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { PNG } from "pngjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = join(root, "assets-raw");

const SOURCES = {
  kenney: {
    texture: "city-suburban/Models/GLB format/Textures/colormap.png",
    models: [
      ...["a", "b", "c", "f", "k", "r"].map((t) => `city-suburban/Models/GLB format/building-type-${t}.glb`),
      ...["a", "b", "c", "d", "e"].map((t) => `city-commercial/Models/GLB format/building-${t}.glb`),
      "city-commercial/Models/GLB format/detail-awning.glb",
    ],
  },
  kaykit: {
    texture: "forest-nature/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/forest_texture.png",
    models: ["1_A", "2_A", "2_C", "3_A", "4_A"].map((n) => `forest-nature/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_${n}_Color1.gltf`),
  },
};

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

function sampler(file) {
  const png = PNG.sync.read(readFileSync(join(raw, file)));
  return {
    width: png.width,
    height: png.height,
    at(u, v) {
      const x = Math.min(png.width - 1, Math.max(0, Math.floor(u * png.width)));
      const y = Math.min(png.height - 1, Math.max(0, Math.floor(v * png.height)));
      const i = (y * png.width + x) * 4;
      return hex(png.data[i], png.data[i + 1], png.data[i + 2]);
    },
  };
}

async function measure(file, tex) {
  const doc = await io.read(join(raw, file));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const colours = new Map();
  let tris = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION"), uv = prim.getAttribute("TEXCOORD_0");
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const p = [], t = [];
      const world = (i) => {
        const v = pos.getElement(i, []);
        return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
      };
      for (let k = 0; k < n; k += 3) {
        const ids = [0, 1, 2].map((o) => (idx ? idx.getScalar(k + o) : k + o));
        const vs = ids.map(world);
        for (const v of vs) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[a]); max[a] = Math.max(max[a], v[a]); }
        const e1 = vs[1].map((x, a) => x - vs[0][a]), e2 = vs[2].map((x, a) => x - vs[0][a]);
        const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const area = Math.hypot(...c) / 2;
        const uvs = ids.map((i) => uv.getElement(i, []));
        const col = tex.at((uvs[0][0] + uvs[1][0] + uvs[2][0]) / 3, (uvs[0][1] + uvs[1][1] + uvs[2][1]) / 3);
        const prev = colours.get(col) ?? { area: 0, uv: [(uvs[0][0] + uvs[1][0] + uvs[2][0]) / 3, (uvs[0][1] + uvs[1][1] + uvs[2][1]) / 3] };
        prev.area += area;
        colours.set(col, prev);
        tris++;
      }
    }
  }
  const size = max.map((v, a) => +(v - min[a]).toFixed(3));
  const total = [...colours.values()].reduce((s, c) => s + c.area, 0);
  return {
    file: file.split("/").pop(),
    size,
    tris,
    colours: [...colours.entries()]
      .sort((a, b) => b[1].area - a[1].area)
      .map(([c, v]) => ({ colour: c, share: +(v.area / total).toFixed(3), uv: v.uv.map((x) => +x.toFixed(4)) })),
  };
}

const out = {};
for (const [key, src] of Object.entries(SOURCES)) {
  const tex = sampler(src.texture);
  const models = [];
  for (const f of src.models) models.push(await measure(f, tex));
  const palette = new Map();
  for (const m of models) {
    for (const c of m.colours) {
      const p = palette.get(c.colour) ?? { share: 0, uv: c.uv };
      p.share += c.share;
      palette.set(c.colour, p);
    }
  }
  out[key] = {
    texture: src.texture,
    textureSize: [tex.width, tex.height],
    palette: Object.fromEntries([...palette.entries()].sort((a, b) => b[1].share - a[1].share).map(([c, v]) => [c, { uv: v.uv, use: +v.share.toFixed(2) }])),
    models,
  };
}
writeFileSync(join(root, "tools", "kit", "style.json"), `${JSON.stringify(out, null, 1)}\n`);
for (const [key, v] of Object.entries(out)) {
  console.log(`\n== ${key} palette (${Object.keys(v.palette).length})`);
  console.log(Object.entries(v.palette).map(([c, p]) => `${c} ${p.use} uv=${p.uv}`).join("\n"));
  for (const m of v.models) console.log(m.file, m.size, m.tris, m.colours.slice(0, 5).map((c) => `${c.colour}:${c.share}`).join(" "));
}
