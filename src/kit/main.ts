import {
  Box3,
  BufferAttribute,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { BUILDING_TINTS, BUILDING_VARIANTS } from "../render/models";
import { PartBuilder } from "../render/bricks";
import { PALETTE } from "../render/palette";
import { soften, variantAtlas, windowMask } from "../render/soften";
import "../gallery/gallery.css";
import "./kit.css";

const files = {
  ...import.meta.glob("/assets-raw/**/gltf/**/*.gltf", { query: "?url", import: "default", eager: true }),
  ...import.meta.glob("/assets-raw/**/GLB format/*.glb", { query: "?url", import: "default", eager: true }),
  ...import.meta.glob("/assets-raw/clickton-original/**/*.glb", { query: "?url", import: "default", eager: true }),
} as Record<string, string>;

type Kind = "town" | "nature" | "plain";

interface Entry {
  path: string;
  kind: Kind;
  fresh?: boolean;
}

const KENNEY_S = "/city-suburban/Models/GLB format/";
const KENNEY_C = "/city-commercial/Models/GLB format/";
const FOREST = "/forest-nature/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/";
const CITY = "/city-builder-bits/addons/kaykit_city_builder_bits/Assets/gltf/";
const ORIGINAL = "/clickton-original/";

const ROWS: { title: string; note: string; items: Entry[] }[] = [
  {
    title: "面包房、学校、百货 vs Kenney 房子与商店",
    note: "同一张 colormap，暗色部分会跟着 6 种换色走；夜晚只有玻璃发光",
    items: [
      { path: `${ORIGINAL}town/bakery.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/school.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/dept_store.glb`, kind: "town", fresh: true },
      { path: `${KENNEY_S}building-type-a.glb`, kind: "town" },
      { path: `${KENNEY_S}building-type-f.glb`, kind: "town" },
      { path: `${KENNEY_C}building-a.glb`, kind: "town" },
      { path: `${KENNEY_C}building-c.glb`, kind: "town" },
    ],
  },
  {
    title: "樱花树 vs KayKit 树",
    note: "KayKit 渐变 atlas 的保留区补了一列粉色，按高度取渐变",
    items: [
      { path: `${ORIGINAL}nature/cherry_tree_a.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/cherry_tree_b.glb`, kind: "nature", fresh: true },
      { path: `${FOREST}Tree_1_A_Color1.gltf`, kind: "nature" },
      { path: `${FOREST}Tree_2_A_Color1.gltf`, kind: "nature" },
      { path: `${FOREST}Tree_3_A_Color1.gltf`, kind: "nature" },
      { path: `${FOREST}Tree_4_A_Color1.gltf`, kind: "nature" },
    ],
  },
  {
    title: "第三批：农场、市政、果树、小船",
    note: "农舍 / 谷仓 / 粮仓、市政厅、图书馆、苹果树、橘子树、小船",
    items: [
      { path: `${ORIGINAL}town/farmhouse.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/barn.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/silo.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/town_hall.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}town/library.glb`, kind: "town", fresh: true },
      { path: `${ORIGINAL}nature/apple_tree.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/orange_tree.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}town/boat.glb`, kind: "town", fresh: true },
    ],
  },
  {
    title: "森林细化：新树 vs KayKit 树",
    note: "树冠由多个叶团组成，每个面按朝向和高度取深绿 / 绿 / 嫩黄绿",
    items: [
      { path: `${ORIGINAL}nature/leafy_tree_a.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/leafy_tree_b.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/leafy_tree_c.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/pine_tree_a.glb`, kind: "nature", fresh: true },
      { path: `${FOREST}Tree_1_A_Color1.gltf`, kind: "nature" },
      { path: `${FOREST}Tree_4_A_Color1.gltf`, kind: "nature" },
    ],
  },
  {
    title: "林地花草",
    note: "蕨类、蘑菇、三色花丛",
    items: [
      { path: `${ORIGINAL}nature/fern.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/mushrooms_red.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/mushrooms_brown.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/flowers_pink.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/flowers_yellow.glb`, kind: "nature", fresh: true },
      { path: `${ORIGINAL}nature/flowers_purple.glb`, kind: "nature", fresh: true },
      { path: `${FOREST}Bush_1_A_Color1.gltf`, kind: "nature" },
    ],
  },
  {
    title: "凉亭 vs 小型地标与小品",
    note: "Kenney 色板；白色构件 + Kenney 绿屋顶，与郊区房同一套颜色",
    items: [
      { path: `${ORIGINAL}town/gazebo.glb`, kind: "town", fresh: true },
      { path: `${KENNEY_S}building-type-k.glb`, kind: "town" },
      { path: `${KENNEY_C}detail-parasol-a.glb`, kind: "town" },
      { path: `${CITY}watertower.gltf`, kind: "plain" },
      { path: `${CITY}bench.gltf`, kind: "plain" },
    ],
  },
];

const MIX: { path: string; kind: Kind; x: number; z: number; fit: number }[] = [
  { path: `${KENNEY_S}building-type-a.glb`, kind: "town", x: -1, z: -1, fit: 0.72 },
  { path: `${ORIGINAL}town/bakery.glb`, kind: "town", x: 0, z: -1, fit: 0.72 },
  { path: `${KENNEY_C}building-c.glb`, kind: "town", x: 1, z: -1, fit: 0.72 },
  { path: `${FOREST}Tree_1_A_Color1.gltf`, kind: "nature", x: -1, z: 0, fit: 0.5 },
  { path: `${ORIGINAL}town/gazebo.glb`, kind: "town", x: 0, z: 0, fit: 0.62 },
  { path: `${ORIGINAL}nature/cherry_tree_a.glb`, kind: "nature", x: 1, z: 0, fit: 0.55 },
  { path: `${ORIGINAL}nature/cherry_tree_b.glb`, kind: "nature", x: -1, z: 1, fit: 0.5 },
  { path: `${KENNEY_S}building-type-f.glb`, kind: "town", x: 0, z: 1, fit: 0.72 },
  { path: `${FOREST}Tree_3_A_Color1.gltf`, kind: "nature", x: 1, z: 1, fit: 0.5 },
];

const NIGHT = { background: 0x454c72, sky: 0x9aa3dc, ground: 0x4a4e72, moon: 0xaab8ea };

const urlOf = (path: string): string => {
  const hit = Object.entries(files).find(([k]) => k.endsWith(path));
  if (!hit) throw new Error(`missing ${path}`);
  return hit[1];
};

const $ = (id: string) => document.getElementById(id)!;
const loader = new GLTFLoader();
const cache = new Map<string, Promise<Object3D>>();
const atlases = new Map<Texture, { day: Texture; glow: Texture }>();

function load(path: string): Promise<Object3D> {
  let p = cache.get(path);
  if (!p) {
    p = loader.loadAsync(urlOf(path)).then((g) => g.scene);
    cache.set(path, p);
  }
  return p;
}

function townAtlas(map: Texture): { day: Texture; glow: Texture } {
  let a = atlases.get(map);
  if (!a) {
    a = { day: variantAtlas(soften(map), BUILDING_TINTS), glow: windowMask(map, BUILDING_VARIANTS) };
    atlases.set(map, a);
  }
  return a;
}

interface State {
  night: boolean;
  variant: number;
  wire: boolean;
  silhouette: boolean;
}

function prepare(src: Object3D, kind: Kind, s: State): { root: Object3D; tris: number } {
  const root = src.clone(true);
  let tris = 0;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const orig = m.material as MeshStandardMaterial;
    const g = m.geometry.clone();
    tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    if (s.silhouette) {
      m.geometry = g;
      m.material = new MeshBasicMaterial({ color: 0x5e534b });
      return;
    }
    const mat = new MeshStandardMaterial({ roughness: 0.85, metalness: 0, wireframe: s.wire });
    if (orig.map && kind === "town") {
      const a = townAtlas(orig.map);
      const uv = g.getAttribute("uv");
      const out = new Float32Array(uv.count * 2);
      for (let i = 0; i < uv.count; i++) {
        out[i * 2] = uv.getX(i);
        out[i * 2 + 1] = (uv.getY(i) + s.variant) / BUILDING_VARIANTS;
      }
      g.setAttribute("uv", new BufferAttribute(out, 2));
      mat.map = a.day;
      if (s.night) {
        mat.emissive.setRGB(1, 1, 1);
        mat.emissiveMap = a.glow;
        mat.emissiveIntensity = 1.15;
      }
    } else if (orig.map) mat.map = soften(orig.map);
    m.geometry = g;
    m.material = mat;
  });
  return { root, tris: Math.round(tris) };
}

function fit(root: Object3D, size: number, maxH: number): void {
  const box = new Box3().setFromObject(root);
  const dim = box.getSize(new Vector3());
  root.scale.setScalar(Math.min(size / Math.max(dim.x, dim.z), maxH / dim.y));
  const fitted = new Box3().setFromObject(root);
  root.position.set(root.position.x - (fitted.min.x + fitted.max.x) / 2, 0.1 - fitted.min.y, root.position.z - (fitted.min.z + fitted.max.z) / 2);
}

function stage(size: number, span: number): { renderer: WebGLRenderer; scene: Scene; camera: OrthographicCamera; apply: (night: boolean) => void } {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size);
  renderer.shadowMap.enabled = true;
  const scene = new Scene();
  scene.background = new Color(PALETTE.background);
  const hemi = new HemisphereLight(0xfffaf2, 0xd9cfc3, 2.1);
  const sun = new DirectionalLight(0xfff4e6, 1.1);
  sun.position.set(3, 6, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  scene.add(hemi, sun);
  const camera = new OrthographicCamera(-span, span, span, -span, 0.1, 80);
  camera.position.set(6, 6.9, 6);
  camera.lookAt(0, 0.35, 0);
  const apply = (night: boolean) => {
    (scene.background as Color).set(night ? NIGHT.background : PALETTE.background);
    hemi.color.set(night ? NIGHT.sky : 0xfffaf2);
    hemi.groundColor.set(night ? NIGHT.ground : 0xd9cfc3);
    hemi.intensity = night ? 1.25 : 2.1;
    sun.color.set(night ? NIGHT.moon : 0xfff4e6);
    sun.intensity = night ? 0.4 : 1.1;
  };
  return { renderer, scene, camera, apply };
}

function plate(w: number, d: number): Mesh {
  const mesh = new Mesh(
    new PartBuilder().box(w, 0.1, d, 0, 0, 0, PALETTE.grass).studGrid(0, 0, Math.min(w, d) - 0.08, 4, 0.1, PALETTE.grassStud).build(),
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

const CARD = 230;
const single = stage(CARD, 1.5);
single.camera.left = single.camera.bottom = -0.95;
single.camera.right = single.camera.top = 0.95;
single.camera.position.set(4, 4.6, 4);
single.camera.lookAt(0, 0.35, 0);
single.camera.updateProjectionMatrix();
single.scene.add(plate(0.98, 0.98));

const mix = stage(560, 2.2);
for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) mix.scene.add(plate(0.98, 0.98).translateX(x).translateZ(z));

function state(): State {
  return {
    night: ($("night") as HTMLInputElement).checked,
    variant: Number(($("variant") as HTMLSelectElement).value),
    wire: ($("wire") as HTMLInputElement).checked,
    silhouette: ($("silhouette") as HTMLInputElement).checked,
  };
}

const cards = new Map<string, { img: HTMLImageElement; tris: HTMLElement }>();
let mixImg: HTMLImageElement;

function buildDom(): void {
  const variant = $("variant") as HTMLSelectElement;
  variant.replaceChildren(...Array.from({ length: BUILDING_VARIANTS }, (_, i) => new Option(i ? `${i} ${BUILDING_TINTS[i - 1]}` : "0 原色", String(i))));
  const root = $("rows");
  const mixSection = document.createElement("section");
  mixSection.innerHTML = `<h2>混排 <small>新模型放进原有素材中间，按游戏里的 fit 缩放</small></h2>`;
  mixImg = document.createElement("img");
  mixImg.className = "mix";
  mixImg.width = mixImg.height = 560;
  mixSection.append(mixImg);
  root.append(mixSection);
  for (const row of ROWS) {
    const section = document.createElement("section");
    section.innerHTML = `<h2>${row.title} <small>${row.note}</small></h2>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const item of row.items) {
      const el = document.createElement("button");
      el.className = item.fresh ? "card fresh" : "card";
      el.onclick = () => void openZoom(item);
      const img = document.createElement("img");
      img.width = img.height = CARD;
      const label = document.createElement("span");
      label.textContent = item.path.split("/").pop()!.replace(/\.(gltf|glb)$/, "");
      const tris = document.createElement("small");
      el.append(img, label, tris);
      grid.append(el);
      cards.set(`${row.title}|${item.path}`, { img, tris });
    }
    section.append(grid);
    root.append(section);
  }
}

let token = 0;

async function renderAll(): Promise<void> {
  const mine = ++token;
  const s = state();
  single.apply(s.night);
  mix.apply(s.night);
  const placed: Object3D[] = [];
  for (const m of MIX) {
    const { root } = prepare(await load(m.path), m.kind, s);
    fit(root, m.fit, m.kind === "nature" ? 0.9 : 0.85);
    root.position.x += m.x;
    root.position.z += m.z;
    placed.push(root);
  }
  if (mine !== token) return;
  mix.scene.add(...placed);
  mix.renderer.shadowMap.needsUpdate = true;
  mix.renderer.render(mix.scene, mix.camera);
  mixImg.src = mix.renderer.domElement.toDataURL("image/png");
  mix.scene.remove(...placed);

  for (const row of ROWS) {
    for (const item of row.items) {
      if (mine !== token) return;
      const card = cards.get(`${row.title}|${item.path}`)!;
      try {
        const { root, tris } = prepare(await load(item.path), item.kind, s);
        fit(root, 0.82, 1.1);
        single.scene.add(root);
        single.renderer.render(single.scene, single.camera);
        single.scene.remove(root);
        card.img.src = single.renderer.domElement.toDataURL("image/png");
        card.tris.textContent = `${tris} tris`;
      } catch (e) {
        card.tris.textContent = "加载失败";
        console.warn(item.path, e);
      }
    }
  }
  $("status").textContent = `${s.night ? "夜晚" : "白天"} · 换色 ${s.variant}${s.wire ? " · 线框" : ""}${s.silhouette ? " · 剪影" : ""}`;
}

const ZOOM = 560;
const zoom = stage(ZOOM, 1);
zoom.camera.left = zoom.camera.bottom = -0.72;
zoom.camera.right = zoom.camera.top = 0.72;
zoom.camera.position.set(4, 4.6, 4);
zoom.camera.lookAt(0, 0.45, 0);
zoom.camera.updateProjectionMatrix();
zoom.scene.add(plate(0.98, 0.98));
let zoomed: Object3D | null = null;
let zoomItem: Entry | null = null;

async function openZoom(item: Entry): Promise<void> {
  zoomItem = item;
  const s = state();
  zoom.apply(s.night);
  const { root, tris } = prepare(await load(item.path), item.kind, s);
  fit(root, 0.82, 1.1);
  const spin = new Object3D();
  spin.add(root);
  if (zoomed) zoom.scene.remove(zoomed);
  zoomed = spin;
  zoom.scene.add(spin);
  zoom.renderer.render(zoom.scene, zoom.camera);
  $("zoom-name").textContent = `${item.path.split("/").pop()} · ${tris} tris`;
  $("zoom").classList.add("open");
}

$("zoom-stage").append(zoom.renderer.domElement);
$("zoom-turn").addEventListener("click", () => {
  if (!zoomed) return;
  zoomed.rotation.y += Math.PI / 2;
  zoom.renderer.render(zoom.scene, zoom.camera);
});
$("zoom").addEventListener("click", (e) => {
  if (e.target === $("zoom")) $("zoom").classList.remove("open");
});
function spinLoop(): void {
  requestAnimationFrame(spinLoop);
  if (!zoomed || !$("zoom").classList.contains("open")) return;
  zoomed.rotation.y += 0.006;
  zoom.renderer.render(zoom.scene, zoom.camera);
}
spinLoop();

buildDom();
for (const id of ["night", "variant", "wire", "silhouette"]) {
  $(id).addEventListener("change", () => {
    void renderAll();
    if (zoomItem && $("zoom").classList.contains("open")) void openZoom(zoomItem);
  });
}
void renderAll();
