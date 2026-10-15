import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { hash, mulberry32 } from "../core/rng";
import { RULES_VERSION, TILES, starterFor, type TileDef } from "../core/tiles";
import { setLang, t, type StringKey } from "../i18n";
import catalog from "../render/assets.json";
import { PartBuilder } from "../render/bricks";
import { ModelLibrary, modelUrl, type ModelKey, type PackKey } from "../render/models";
import { PALETTE } from "../render/palette";
import { buildTile } from "../render/tileMeshes";
import "./gallery.css";

setLang("zh");

const PACK_TITLES: Record<PackKey, string> = {
  suburban: "Kenney City Kit · Suburban（住宅）",
  commercial: "Kenney City Kit · Commercial（商店与高楼）",
  city: "KayKit City Builder Bits（车辆与城市小品）",
  forest: "KayKit Forest Nature（树木与自然）",
  medieval: "KayKit Medieval Hexagon（装饰小品）",
  holiday: "KayKit Holiday Bits（火车与节日）",
  original: "Clickton 原创建筑（tools/kit 生成）",
  original_nature: "Clickton 原创树木与花草（tools/kit 生成）",
};

const AGENT_TITLES: Record<string, string> = {
  people: "Kenney Blocky Characters（小人，有动画）",
  pets: "Kenney Cube Pets（动物，有动画）",
};

interface Card {
  el: HTMLElement;
  img: HTMLImageElement;
  search: string;
  render: () => Object3D | Promise<Object3D>;
}

const SIZE = 220;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.shadowMap.enabled = true;

const scene = new Scene();
scene.background = new Color(PALETTE.background);
scene.add(new HemisphereLight(0xfffaf2, 0xd9cfc3, 2.1));
const sun = new DirectionalLight(0xfff4e6, 1.1);
sun.position.set(3, 6, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -1.5;
sc.right = sc.top = 1.5;
scene.add(sun);

const camera = new OrthographicCamera(-0.95, 0.95, 0.95, -0.95, 0.1, 50);
camera.position.set(4, 4.6, 4);
camera.lookAt(0, 0.35, 0);

const plate = new Mesh(
  new PartBuilder().box(0.98, 0.1, 0.98, 0, 0, 0, PALETTE.grass).studGrid(0, 0, 0.9, 4, 0.1, PALETTE.grassStud).build(),
  new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
);
plate.receiveShadow = true;

const tileMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const waterMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 });

const library = new ModelLibrary();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function shadows(root: Object3D): Object3D {
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return root;
}

function tileObject(tile: TileDef, seed = 7): Object3D {
  const { base, water, props } = buildTile(tile, 0, mulberry32(hash(seed, tile.id, 0)));
  const mesh = new Mesh(base, tileMaterial);
  if (water) mesh.add(new Mesh(water, waterMaterial));
  for (const child of library.buildProps(props, "solid")) mesh.add(child);
  return shadows(mesh);
}

function fitOnPlate(root: Object3D): Object3D {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  root.scale.setScalar(Math.min(0.82 / Math.max(size.x, size.z), 1.1 / size.y));
  const fitted = new Box3().setFromObject(root);
  root.position.set(-(fitted.min.x + fitted.max.x) / 2, 0.1 - fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  const group = new Object3D();
  group.add(plate.clone(), root);
  return group;
}

function modelObject(key: ModelKey): Object3D {
  const group = new Object3D();
  for (const mesh of library.buildProps([{ model: key, x: 0, z: 0, rotY: 0, fit: 1 }], "solid")) group.add(mesh);
  return fitOnPlate(shadows(group));
}

const agentScenes = new Map<string, Promise<{ scene: Object3D; animations: AnimationClip[] }>>();

function loadAgent(folder: string, file: string) {
  const url = modelUrl(folder, file);
  let p = agentScenes.get(url);
  if (!p) {
    p = loader.loadAsync(url).then((g) => ({ scene: shadows(g.scene), animations: g.animations }));
    agentScenes.set(url, p);
  }
  return p;
}

const $ = (id: string) => document.getElementById(id)!;
const cards: Card[] = [];

function tileGroup(tile: TileDef): string {
  if (tile.id === starterFor(RULES_VERSION).tile) return "starter";
  if (tile.landmark) return "landmark";
  if (tile.special) return "special";
  if (tile.weight === 0) return "legacy";
  return "normal";
}

const TILE_GROUPS: { key: string; title: string }[] = [
  { key: "normal", title: "普通地块" },
  { key: "special", title: "稀有特殊地块" },
  { key: "landmark", title: "地标（任务奖励）" },
  { key: "starter", title: "起始地块" },
  { key: "legacy", title: "仅旧版本出现" },
];

function weightTag(tile: TileDef): string {
  if (tile.weight > 0) return `v${RULES_VERSION} 权重 ${tile.weight}`;
  const group = tileGroup(tile);
  if (group === "landmark") return "权重 0 · 任务奖励";
  if (group === "starter") return "权重 0 · 开局放置";
  return "权重 0 · 仅旧版本";
}

function section(title: string, count: number): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = `<h2>${title} <small>${count}</small></h2>`;
  const grid = document.createElement("div");
  grid.className = "grid";
  el.append(grid);
  $("packs").append(el);
  return grid;
}

function addCard(grid: HTMLElement, title: string, sub: string, render: Card["render"], onPlay?: () => void): void {
  const el = document.createElement("div");
  el.className = "card";
  const img = document.createElement("img");
  img.width = img.height = SIZE;
  img.alt = title;
  const label = document.createElement("span");
  label.textContent = title;
  const meta = document.createElement("small");
  meta.textContent = sub;
  el.append(img, label, meta);
  if (onPlay) {
    const play = document.createElement("button");
    play.className = "play";
    play.textContent = "▶ 动画";
    play.onclick = onPlay;
    el.append(play);
  }
  grid.append(el);
  cards.push({ el, img, search: `${title} ${sub}`.toLowerCase(), render });
}

function buildCards(): void {
  const h = document.createElement("h1");
  h.className = "part";
  h.textContent = "地块";
  $("packs").append(h);
  for (const g of TILE_GROUPS) {
    const tiles = TILES.filter((tile) => tileGroup(tile) === g.key);
    if (!tiles.length) continue;
    const grid = section(g.title, tiles.length);
    for (const tile of tiles) addCard(grid, t(`tile_${tile.key}` as StringKey), `${tile.key} · ${weightTag(tile)}`, () => tileObject(tile));
  }

  const LAYOUT_TILES = ["city_full", "forest_full"];
  const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  const layouts = section("整块地块的布局变化（同一地块，不同随机种子）", LAYOUT_TILES.length * SEEDS.length);
  for (const key of LAYOUT_TILES) {
    const tile = TILES.find((x) => x.key === key)!;
    for (const seed of SEEDS) addCard(layouts, t(`tile_${key}` as StringKey), `${key} · 种子 ${seed}`, () => tileObject(tile, seed));
  }

  const models = document.createElement("h1");
  models.className = "part";
  models.textContent = "模型";
  $("packs").append(models);
  const entries = Object.entries(catalog.models) as [ModelKey, { pack: PackKey; file: string }][];
  for (const pack of Object.keys(PACK_TITLES) as PackKey[]) {
    const list = entries.filter(([, def]) => def.pack === pack);
    if (!list.length) continue;
    const grid = section(PACK_TITLES[pack], list.length);
    for (const [key, def] of list) addCard(grid, key, def.file.replace(/\.(gltf|glb)$/, ""), () => modelObject(key));
  }

  for (const [folder, group] of Object.entries(catalog.agents)) {
    const grid = section(AGENT_TITLES[folder] ?? folder, group.files.length);
    for (const file of group.files) {
      const name = file.replace(/\.(gltf|glb)$/, "");
      addCard(grid, name, folder, async () => fitOnPlate((await loadAgent(folder, file)).scene.clone(true)), () => void openViewer(folder, file));
    }
  }
}

async function renderAll(): Promise<void> {
  let done = 0;
  for (const c of cards) {
    try {
      const obj = await c.render();
      scene.add(obj);
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      scene.remove(obj);
      c.img.src = renderer.domElement.toDataURL("image/png");
    } catch (e) {
      c.el.classList.add("broken");
      console.warn("failed", c.search, e);
    }
    done++;
    if (done % 8 === 0 || done === cards.length) $("status").textContent = `已渲染 ${done} / ${cards.length}（地块 ${TILES.length}，规则 v${RULES_VERSION}）`;
  }
}

$("filter").addEventListener("input", (e) => {
  const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
  for (const c of cards) c.el.style.display = !q || c.search.includes(q) ? "" : "none";
});

const viewer = new WebGLRenderer({ antialias: true });
viewer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewer.setSize(280, 280);
viewer.shadowMap.enabled = true;
$("viewer-stage").append(viewer.domElement);
let viewerModel: Object3D | null = null;
let mixer: AnimationMixer | null = null;
let clips: AnimationClip[] = [];
const clock = new Clock();

async function openViewer(folder: string, file: string): Promise<void> {
  const gltf = await loadAgent(folder, file);
  viewerModel = fitOnPlate(gltf.scene.clone(true));
  mixer = new AnimationMixer(viewerModel.children[1]);
  clips = gltf.animations;
  const select = $("clip") as HTMLSelectElement;
  select.replaceChildren(...clips.map((c) => new Option(c.name, c.name)));
  select.value = clips.find((c) => c.name === "walk")?.name ?? clips[0]?.name ?? "";
  playClip(select.value);
  $("viewer-name").textContent = file.replace(/\.(gltf|glb)$/, "");
  $("viewer").classList.add("open");
}

function playClip(name: string): void {
  if (!mixer) return;
  mixer.stopAllAction();
  const clip = clips.find((c) => c.name === name);
  if (clip) mixer.clipAction(clip).play();
}

$("clip").addEventListener("change", (e) => playClip((e.target as HTMLSelectElement).value));
$("viewer-close").addEventListener("click", () => $("viewer").classList.remove("open"));

function animate(): void {
  requestAnimationFrame(animate);
  if (!viewerModel || !$("viewer").classList.contains("open")) return;
  mixer?.update(clock.getDelta());
  viewerModel.rotation.y += 0.004;
  scene.add(viewerModel);
  renderer.shadowMap.needsUpdate = true;
  viewer.render(scene, camera);
  scene.remove(viewerModel);
}
animate();

buildCards();
void library.load((done, total) => ($("status").textContent = `加载模型 ${done} / ${total}…`)).then(renderAll);
