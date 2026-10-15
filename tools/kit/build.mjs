import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { PNG } from "pngjs";
import { KAYKIT_PINK, Shape } from "./parts.mjs";
import bakery from "./models/bakery.mjs";
import { cherryA, cherryB } from "./models/cherry.mjs";
import gazebo from "./models/gazebo.mjs";
import school from "./models/school.mjs";
import store from "./models/store.mjs";

const RECIPES = [bakery, cherryA, cherryB, gazebo, school, store];

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = join(root, "assets-raw");
const out = join(raw, "clickton-original");

const ATLASES = {
  town: { reference: "city-suburban/Models/GLB format/building-type-a.glb" },
  nature: { reference: "forest-nature/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Tree_1_A_Color1.gltf", paint: addBlossom },
};

function addBlossom(bytes) {
  const png = PNG.sync.read(bytes);
  const x0 = png.width / 8, x1 = png.width / 4, h = png.height / 4;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const c = KAYKIT_PINK.top.map((top, k) => Math.round(top + (KAYKIT_PINK.bottom[k] - top) * t));
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      png.data.set([...c, 255], i);
    }
  }
  return PNG.sync.write(png);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function build(recipe) {
  const atlas = ATLASES[recipe.atlas];
  const doc = await io.read(join(raw, atlas.reference));
  const r = doc.getRoot();
  const material = r.listMaterials()[0];
  const texture = material.getBaseColorTexture();
  if (atlas.paint) texture.setImage(atlas.paint(texture.getImage()));
  texture.setURI("");
  for (const node of r.listNodes()) node.dispose();
  for (const mesh of r.listMeshes()) mesh.dispose();
  for (const acc of r.listAccessors()) acc.dispose();

  const shape = new Shape();
  recipe.build(shape);
  const buffer = r.listBuffers()[0] ?? doc.createBuffer();
  const attr = (type, data) => doc.createAccessor().setType(type).setArray(new Float32Array(data)).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute("POSITION", attr("VEC3", shape.position))
    .setAttribute("NORMAL", attr("VEC3", shape.normal))
    .setAttribute("TEXCOORD_0", attr("VEC2", shape.uv));
  const node = doc.createNode(recipe.name).setMesh(doc.createMesh(recipe.name).addPrimitive(prim));
  const scene = r.getDefaultScene() ?? r.listScenes()[0] ?? doc.createScene();
  scene.addChild(node);

  const dir = join(out, recipe.atlas);
  mkdirSync(dir, { recursive: true });
  await io.write(join(dir, `${recipe.name}.glb`), doc);

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < shape.position.length; i++) {
    min[i % 3] = Math.min(min[i % 3], shape.position[i]);
    max[i % 3] = Math.max(max[i % 3], shape.position[i]);
  }
  console.log(`${recipe.atlas}/${recipe.name}.glb  tris=${shape.tris}  size=${max.map((v, k) => (v - min[k]).toFixed(2)).join(" × ")}`);
}

for (const recipe of RECIPES) await build(recipe);
