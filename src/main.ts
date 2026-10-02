import "./style.css";
import { playChime, playPlace, playPop } from "./audio";
import { Game } from "./core/game";
import { mulberry32, randomSeed } from "./core/rng";
import { POINTS, countHoleCells, type PlacementScore } from "./core/scoring";
import { DIRS, DX, DY, TILES, opposite, type Rot } from "./core/tiles";
import { LANGS, getLang, hasKey, setLang, t, type Lang } from "./i18n";
import { ModelLibrary } from "./render/models";
import { World } from "./render/scene";
import { Agents } from "./render/agents";
import { loadLocal, saveLocal } from "./save";
import { drawTilePreview } from "./ui/tilePreview";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("stage");
const preview = $<HTMLCanvasElement>("preview");
const bubble = $("bubble");
const coarse = window.matchMedia("(pointer: coarse)").matches;

let game = restore();
const library = new ModelLibrary();
setLang(getLang());
$("loading-text").textContent = t("loading");
const agents = new Agents(library, coarse);
const progress = (offset: number, share: number) => (done: number, total: number) =>
  ($("loading-bar").style.width = `${Math.round((offset + (done / total) * share) * 100)}%`);
try {
  await library.load(progress(0, 0.5));
  await agents.load(progress(0.5, 0.5));
} catch (e) {
  console.error("model loading failed", e);
}
$("loading").classList.add("done");
const world = new World(canvas, game.seed, library);
world.add(agents.root);
if (import.meta.env.DEV) Object.assign(window, { __clickton: { agents, world, getGame: () => game } });
world.edgesAround = (x, y) => DIRS.map((d) => game.board.edgeAt(x + DX[d], y + DY[d], opposite(d)));
let rot: Rot = 0;
let hover: { x: number; y: number } | null = null;
let pending: { x: number; y: number } | null = null;
let holes = countHoleCells(game.board);

function restore(): Game {
  const demo = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get("demo")) : 0;
  if (demo > 0) return demoTown(demo);
  const saved = loadLocal();
  if (saved) {
    try {
      return Game.replay(saved.seed, saved.moves);
    } catch {}
  }
  return new Game(randomSeed());
}

function demoTown(n: number): Game {
  const g = new Game(randomSeed());
  const rnd = mulberry32(g.seed);
  for (let i = 0; i < n; i++) {
    const cells = g.board.frontier().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const c = cells[Math.floor(rnd() * Math.min(cells.length, 6))];
    let best: Rot = 0;
    let bestScore = -Infinity;
    for (const r of [0, 1, 2, 3] as Rot[]) {
      const s = g.preview(c.x, c.y, r)!.total;
      if (s > bestScore) [best, bestScore] = [r, s];
    }
    g.place(c.x, c.y, best);
  }
  return g;
}

function rebuildWorld(): void {
  world.seed = game.seed;
  world.clearTiles();
  for (const p of game.board.all()) world.addTile(p, false);
  world.setFrontier(game.board.frontier());
  agents.clear();
  agents.sync(game.board, game.seed);
  const b = game.board.getBounds();
  world.focus(b ? (b.minX + b.maxX) / 2 : 0, b ? (b.minY + b.maxY) / 2 : 0);
  fitTown(true);
}

function applyI18n(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n!;
    if (hasKey(key)) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((el) => {
    const key = el.dataset.i18nLabel!;
    if (hasKey(key)) {
      el.setAttribute("aria-label", t(key));
      el.title = t(key);
    }
  });
  $("help").textContent = t(coarse ? "helpTouch" : "help");
  document.title = getLang() === "en" ? "Clickton" : `${t("gameName")} · Clickton`;
  const langs = $("langs");
  langs.replaceChildren(
    ...LANGS.map((l) => {
      const b = document.createElement("button");
      b.textContent = { en: "EN", zh: "中文", ja: "日本語" }[l];
      b.classList.toggle("active", l === getLang());
      b.addEventListener("click", () => switchLang(l));
      return b;
    }),
  );
  refreshTray();
}

function switchLang(l: Lang): void {
  setLang(l);
  applyI18n();
}

function refreshTray(): void {
  const tile = TILES[game.currentTile];
  drawTilePreview(preview, tile, rot);
  $("tile-name").textContent = t(`tile_${tile.key}` as Parameters<typeof t>[0]);
}

function refreshStats(): void {
  $("score").textContent = String(game.score);
  $("tiles").textContent = String(game.board.size);
  $("holes").textContent = String(holes);
}

function describe(s: PlacementScore): string {
  const notes: string[] = [];
  if (s.perfect) notes.push(`${t("perfect")} +${POINTS.perfect}`);
  if (s.holePoints < 0) notes.push(t("holeMade", s.holePoints));
  if (s.holePoints > 0) notes.push(t("holeFilled", s.holePoints));
  return notes.join(" · ");
}

type Cell = { x: number; y: number };

const sameCell = (a: Cell | null, b: Cell | null) => !!a && !!b && a.x === b.x && a.y === b.y;

function shownCell(): Cell | null {
  return pending ?? hover;
}

function updateGhost(): void {
  $("tray").classList.toggle("pending", !!pending);
  const c = shownCell();
  const s = c && game.preview(c.x, c.y, rot);
  if (!c || !s) {
    world.hideGhost();
    bubble.style.display = "none";
    return;
  }
  world.showGhost(TILES[game.currentTile], rot, c.x, c.y, !!pending);
  const note = describe(s);
  bubble.className = `bubble ${s.total > 0 ? "good" : s.total < 0 ? "bad" : "zero"}`;
  bubble.innerHTML = `${s.total > 0 ? "+" : ""}${s.total}${note ? `<small>${note}</small>` : ""}`;
  bubble.style.display = "block";
  positionBubble();
}

function positionBubble(): void {
  const c = shownCell();
  if (!c || bubble.style.display === "none") return;
  const p = world.toScreen(c.x, c.y, pending ? 1.05 : 0.9);
  bubble.style.left = `${p.x}px`;
  bubble.style.top = `${p.y}px`;
}

function fitTown(instant = false): void {
  const b = game.board.getBounds();
  if (b) world.fitTown(b.maxX - b.minX + 1, b.maxY - b.minY + 1, instant);
}

function rotate(delta: 1 | -1): void {
  rot = ((rot + delta + 4) % 4) as Rot;
  playPop();
  refreshTray();
  updateGhost();
}

function setPending(c: Cell | null): void {
  if (sameCell(c, pending)) return;
  pending = c;
  updateGhost();
}

function confirmPending(): void {
  if (!pending) return;
  const { x, y } = pending;
  pending = null;
  place(x, y);
}

function cancelPending(): void {
  if (!pending) return;
  pending = null;
  updateGhost();
}

function place(x: number, y: number): void {
  if (!game.board.canPlace(x, y)) return;
  const { placed, score } = game.place(x, y, rot);
  holes = score.holeCellsAfter;
  world.addTile(placed, true);
  world.setFrontier(game.board.frontier());
  fitTown();
  playPlace(score.total > 0);
  floatScore(x, y, score.total);
  const trains = agents.sync(game.board, game.seed);
  if (trains.length) setTimeout(playChime, 250);
  for (const tr of trains) floatText(tr.x, tr.y, `🚂 ${t("trainArrived")}`, "var(--text)");
  rot = 0;
  saveLocal(game);
  refreshStats();
  refreshTray();
  if (coarse) hover = null;
  updateGhost();
}

function floatScore(x: number, y: number, total: number): void {
  const color = total > 0 ? "var(--sage-ink)" : total < 0 ? "var(--terracotta-ink)" : "var(--text-soft)";
  floatText(x, y, `${total > 0 ? "+" : ""}${total}`, color);
}

function floatText(x: number, y: number, text: string, color: string): void {
  const p = world.toScreen(x, y, 0.6);
  const el = document.createElement("div");
  el.className = "float-score";
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  el.style.color = color;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function newTown(): void {
  if (game.board.size > 1 && !window.confirm(t("confirmNewTown"))) return;
  game = new Game(randomSeed());
  rot = 0;
  holes = 0;
  hover = null;
  pending = null;
  rebuildWorld();
  saveLocal(game);
  refreshStats();
  refreshTray();
  updateGhost();
}

let snapTargets: Cell[] = [];

function snapCell(clientX: number, clientY: number): Cell | null {
  const p = world.pickPoint(clientX, clientY);
  if (!p) return null;
  let best: Cell | null = null;
  let bestDist = 1.6;
  for (const c of snapTargets) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function dragTileTo(clientX: number, clientY: number): void {
  const c = snapCell(clientX, clientY);
  if (c && !sameCell(c, pending)) {
    setPending(c);
    playPop();
  }
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  button: number;
  dragTile: boolean;
  moved: boolean;
}

let gesture: Gesture | null = null;

function startGesture(e: PointerEvent, dragTile: boolean): void {
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, button: e.button, dragTile, moved: false };
  if (dragTile) snapTargets = game.board.frontier();
}

function trackGesture(e: PointerEvent): Gesture | null {
  const g = gesture;
  if (!g || g.id !== e.pointerId) return null;
  if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) g.moved = true;
  return g;
}

canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (gesture) {
      gesture.moved = true;
      return;
    }
    const onPending = e.button === 0 && sameCell(world.pickCell(e.clientX, e.clientY), pending);
    startGesture(e, onPending);
    if (onPending) {
      world.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
    }
  },
  { capture: true },
);

canvas.addEventListener("pointermove", (e) => {
  const g = trackGesture(e);
  if (g) {
    if (g.dragTile && g.moved) dragTileTo(e.clientX, e.clientY);
    return;
  }
  if (e.pointerType !== "mouse" || pending) return;
  const c = world.pickCell(e.clientX, e.clientY);
  if (sameCell(c, hover)) return;
  hover = c;
  updateGhost();
});

function endCanvasGesture(e: PointerEvent): void {
  const g = trackGesture(e);
  if (!g) return;
  gesture = null;
  world.controls.enabled = true;
  if (e.type === "pointercancel") return;
  if (g.dragTile) {
    if (!g.moved) rotate(1);
    return;
  }
  if (g.moved) return;
  if (g.button === 2) {
    rotate(1);
    return;
  }
  if (g.button !== 0) return;
  const c = world.pickCell(e.clientX, e.clientY);
  if (c && game.board.canPlace(c.x, c.y)) setPending(c);
}

canvas.addEventListener("pointerup", endCanvasGesture);
canvas.addEventListener("pointercancel", endCanvasGesture);

canvas.addEventListener("pointerleave", () => {
  if (coarse || pending) return;
  hover = null;
  updateGhost();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const trayTile = $("tray-tile");

trayTile.addEventListener("pointerdown", (e) => {
  if (gesture) return;
  e.preventDefault();
  startGesture(e, true);
  trayTile.setPointerCapture(e.pointerId);
});

trayTile.addEventListener("pointermove", (e) => {
  const g = trackGesture(e);
  if (g?.moved) dragTileTo(e.clientX, e.clientY);
});

function endTrayGesture(e: PointerEvent): void {
  const g = trackGesture(e);
  if (!g) return;
  gesture = null;
  if (e.type !== "pointercancel" && !g.moved) rotate(1);
}

trayTile.addEventListener("pointerup", endTrayGesture);
trayTile.addEventListener("pointercancel", endTrayGesture);

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R" || e.key === "e" || e.key === "E") rotate(1);
  if (e.key === "q" || e.key === "Q") rotate(-1);
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    confirmPending();
  }
  if (e.key === "Escape") cancelPending();
});

$("rot-left").addEventListener("click", () => rotate(-1));
$("rot-right").addEventListener("click", () => rotate(1));
$("confirm").addEventListener("click", confirmPending);
$("cancel").addEventListener("click", cancelPending);
$("new-town").addEventListener("click", newTown);

setLang(getLang());
applyI18n();
rebuildWorld();
refreshStats();

let previewTransform = "";

function alignPreview(): void {
  const az = world.controls.getAzimuthalAngle();
  const squash = Math.cos(world.controls.getPolarAngle());
  const tf = `scaleY(${squash.toFixed(2)}) rotate(${az.toFixed(2)}rad)`;
  if (tf === previewTransform) return;
  previewTransform = tf;
  preview.style.transform = tf;
}

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  agents.update(dt, game.board);
  world.render(now);
  positionBubble();
  alignPreview();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
