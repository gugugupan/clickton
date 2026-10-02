import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PartBuilder } from "../render/bricks";
import { PALETTE } from "../render/palette";
import { soften } from "../render/soften";
import "./gallery.css";

const files = {
  ...import.meta.glob("/assets-raw/**/gltf/**/*.gltf", { query: "?url", import: "default", eager: true }),
  ...import.meta.glob("/assets-raw/**/GLB format/*.glb", { query: "?url", import: "default", eager: true }),
} as Record<string, string>;

const PACKS: { key: string; title: string; match: string }[] = [
  { key: "city", title: "City Builder Bits", match: "/city-builder-bits/" },
  { key: "medieval", title: "Medieval Hexagon（建筑与装饰）", match: "/medieval-hexagon/" },
  { key: "forest", title: "Forest Nature Pack", match: "/forest-nature/" },
  { key: "holiday", title: "Holiday Bits", match: "/holiday-bits/" },
  { key: "people", title: "Blocky Characters（小人，有动画）", match: "/blocky-characters/" },
  { key: "pets", title: "Cube Pets（动物，有动画）", match: "/cube-pets/" },
];

const ANIMATED = new Set(["people", "pets"]);

const COLOR_SUFFIX = /_(blue|red|green|yellow|white|brown|Color\d)$/;

interface Item {
  pack: string;
  name: string;
  url: string;
}

function collect(): Item[] {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const [path, url] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const pack = PACKS.find((p) => path.includes(p.match));
    if (!pack) continue;
    if (/\/tiles\//.test(path)) continue;
    if (/\/buildings\/(green|red|yellow)\//.test(path)) continue;
    const name = path.split("/").pop()!.replace(/\.(gltf|glb)$/, "");
    if (/withoutBase|Singlesided|SingleSided|_Mesh$/.test(name)) continue;
    const key = `${pack.key}:${name.replace(COLOR_SUFFIX, "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ pack: pack.key, name, url });
  }
  return items;
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
scene.add(plate);

const loader = new GLTFLoader();
function applyPalette(root: Object3D, soft: boolean): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as (Material & {
      map?: Texture | null;
      userData: { original?: Texture };
    })[];
    for (const mat of mats) {
      if (!mat.map && !mat.userData.original) continue;
      mat.userData.original ??= mat.map!;
      mat.map = soft ? soften(mat.userData.original) : mat.userData.original;
      mat.needsUpdate = true;
    }
  });
}

const models = new Map<string, Object3D>();

async function thumbnail(item: Item, soft: boolean): Promise<string> {
  let model = models.get(item.url);
  if (!model) {
    model = (await loader.loadAsync(item.url)).scene;
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const scale = Math.min(0.82 / Math.max(size.x, size.z), 1.1 / size.y);
    model.scale.setScalar(scale);
    const fitted = new Box3().setFromObject(model);
    model.position.set(-(fitted.min.x + fitted.max.x) / 2, 0.1 - fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
    models.set(item.url, model);
  }
  applyPalette(model, soft && !ANIMATED.has(item.pack));
  scene.add(model);
  renderer.render(scene, camera);
  scene.remove(model);
  return renderer.domElement.toDataURL("image/png");
}

const STORE = "clickton.gallery.picked";
const picked = new Set<string>(loadPicked());

function loadPicked(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

function savePicked(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify([...picked]));
  } catch {}
}

const $ = (id: string) => document.getElementById(id)!;
const items = collect();
const cards = new Map<string, { el: HTMLElement; img: HTMLImageElement; item: Item }>();
const idOf = (i: Item) => `${i.pack}/${i.name}`;

function renderPicked(): void {
  $("count").textContent = String(picked.size);
  $("picked-list").replaceChildren(
    ...[...picked].sort().map((id) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = `${id} ✕`;
      chip.onclick = () => toggle(id);
      return chip;
    }),
  );
  for (const [id, c] of cards) c.el.classList.toggle("on", picked.has(id));
}

function toggle(id: string): void {
  if (picked.has(id)) picked.delete(id);
  else picked.add(id);
  savePicked();
  renderPicked();
}

function buildCards(): void {
  const root = $("packs");
  for (const pack of PACKS) {
    const list = items.filter((i) => i.pack === pack.key);
    if (!list.length) continue;
    const section = document.createElement("section");
    section.innerHTML = `<h2>${pack.title} <small>${list.length}</small></h2>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const item of list) {
      const el = document.createElement("button");
      el.className = "card";
      const img = document.createElement("img");
      img.width = img.height = SIZE;
      img.alt = item.name;
      const label = document.createElement("span");
      label.textContent = item.name;
      el.append(img, label);
      if (ANIMATED.has(item.pack)) {
        const play = document.createElement("span");
        play.className = "play";
        play.textContent = "▶ 动画";
        play.onclick = (e) => {
          e.stopPropagation();
          void openViewer(item);
        };
        el.append(play);
      }
      el.onclick = () => toggle(idOf(item));
      grid.append(el);
      cards.set(idOf(item), { el, img, item });
    }
    section.append(grid);
    root.append(section);
  }
}

let renderToken = 0;

async function renderAll(): Promise<void> {
  const token = ++renderToken;
  const soft = ($("soft") as HTMLInputElement).checked;
  let done = 0;
  for (const c of cards.values()) {
    if (token !== renderToken) return;
    try {
      c.img.src = await thumbnail(c.item, soft);
    } catch (e) {
      c.el.classList.add("broken");
      console.warn("failed", c.item.url, e);
    }
    done++;
    if (done % 8 === 0 || done === cards.size) $("status").textContent = `已渲染 ${done} / ${cards.size} 个模型`;
  }
}

$("soft").addEventListener("change", () => void renderAll());
$("filter").addEventListener("input", (e) => {
  const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
  for (const [id, c] of cards) c.el.style.display = !q || id.toLowerCase().includes(q) ? "" : "none";
});
$("copy").addEventListener("click", async () => {
  const text = [...picked].sort().join("\n");
  try {
    await navigator.clipboard.writeText(text);
    $("copy").textContent = "已复制";
  } catch {
    window.prompt("复制下面的清单", text);
  }
  setTimeout(() => ($("copy").textContent = "复制清单"), 1500);
});
$("clear").addEventListener("click", () => {
  picked.clear();
  savePicked();
  renderPicked();
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

async function openViewer(item: Item): Promise<void> {
  const gltf = await loader.loadAsync(item.url);
  if (viewerModel) scene.remove(viewerModel);
  viewerModel = gltf.scene;
  const box = new Box3().setFromObject(viewerModel);
  const size = box.getSize(new Vector3());
  viewerModel.scale.setScalar(Math.min(0.82 / Math.max(size.x, size.z), 1.1 / size.y));
  const fitted = new Box3().setFromObject(viewerModel);
  viewerModel.position.set(-(fitted.min.x + fitted.max.x) / 2, 0.1 - fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  applyPalette(viewerModel, ($("soft") as HTMLInputElement).checked && !ANIMATED.has(item.pack));
  mixer = new AnimationMixer(viewerModel);
  clips = gltf.animations;
  const select = $("clip") as HTMLSelectElement;
  select.replaceChildren(...clips.map((c) => new Option(c.name, c.name)));
  select.value = clips.find((c) => c.name === "walk")?.name ?? clips[0]?.name ?? "";
  playClip(select.value);
  $("viewer-name").textContent = item.name;
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
  viewer.render(scene, camera);
  scene.remove(viewerModel);
}
animate();

buildCards();
renderPicked();
void renderAll();
