import "./style.css";
import { playChime, playPlace, playPop } from "./audio";
import { decodeCity, encodeCity } from "./core/codec";
import { DISCARD_EVERY, Game } from "./core/game";
import { CHALLENGE_TILES, dayLabel, todayNumber } from "./core/daily";
import { completedRailLines, completedRoadNetworks } from "./core/networks";
import { moodFor } from "./core/themes";
import { mulberry32, randomSeed } from "./core/rng";
import { POINTS, type PlacementScore } from "./core/scoring";
import { DIRS, DX, DY, TILES, opposite, tileByKey, type Rot } from "./core/tiles";
import { Board } from "./core/board";
import { LANGS, getLang, hasKey, setLang, t, type Lang } from "./i18n";
import { ModelLibrary } from "./render/models";
import { DayNight } from "./render/daynight";
import { lookFor } from "./render/looks";
import { World } from "./render/scene";
import { Agents } from "./render/agents";
import { loadLocal, recordScore, saveLocal } from "./save";
import { refreshTutorial, startTutorial, tutorialSeen } from "./ui/tutorial";
import { download, framePhoto, toBlob } from "./ui/photo";
import { drawTilePreview } from "./ui/tilePreview";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("stage");
const preview = $<HTMLCanvasElement>("preview");
const nextPreview = $<HTMLCanvasElement>("next-preview");
const bubble = $("bubble");
const coarse = window.matchMedia("(pointer: coarse)").matches;
window.addEventListener("hashchange", () => location.reload());

let viewing = false;
let badLink = false;
let game = await restore();
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
if (import.meta.env.DEV) Object.assign(window, { __clickton: { agents, world, getGame: () => game, Board, tileByKey } });
world.edgesAround = (x, y) => DIRS.map((d) => game.board.edgeAt(x + DX[d], y + DY[d], opposite(d)));
const LAKE_RING = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];
world.lakesAround = (x, y) => LAKE_RING.map(([dx, dy]) => !!game.board.get(x + dx, y + dy)?.tile.pool);
let rot: Rot = 0;
let hover: { x: number; y: number } | null = null;
let pending: { x: number; y: number } | null = null;

async function restore(): Promise<Game> {
  const code = new URLSearchParams(location.hash.slice(1)).get("c");
  if (code) {
    try {
      const city = await decodeCity(code);
      viewing = true;
      return Game.replay(city.seed, city.moves, city.version, city.day);
    } catch (e) {
      console.warn("could not open shared town", e);
      badLink = true;
      history.replaceState(null, "", location.pathname + location.search);
    }
  }
  if (new URLSearchParams(location.search).has("daily")) {
    history.replaceState(null, "", location.pathname);
    return loadDaily();
  }
  const demo = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get("demo")) : 0;
  if (demo > 0) return demoTown(demo, new URLSearchParams(location.search).get("theme"));
  const saved = loadLocal();
  if (saved) {
    try {
      return Game.replay(saved.seed, saved.moves, saved.version, saved.day);
    } catch {}
  }
  return new Game(randomSeed());
}

function loadDaily(): Game {
  const today = todayNumber();
  const saved = loadLocal("daily");
  if (saved && saved.day === today) {
    try {
      return Game.replay(saved.seed, saved.moves, saved.version, saved.day);
    } catch {}
  }
  return Game.daily(today);
}

function demoTown(n: number, theme: string | null): Game {
  let seed = randomSeed();
  while (theme && moodFor(seed).theme.key !== theme) seed = randomSeed();
  const g = new Game(seed);
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
  world.setLook(lookFor(game.mood?.theme.key));
  world.clearTiles();
  for (const p of game.board.all()) world.addTile(p, false);
  world.commitTiles();
  world.setFrontier(viewing ? [] : game.board.frontier());
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
  $("help").textContent = t(viewing ? (coarse ? "helpViewTouch" : "helpView") : coarse ? "helpTouch" : "help");
  document.title = getLang() === "en" ? "Clickton" : `${t("gameName")} · Clickton`;
  $("ng-daily").querySelector(".label")!.textContent = t("dailyOptionHint", CHALLENGE_TILES);
  for (const id of ["langs", "tut-langs"]) {
    $(id).replaceChildren(
      ...LANGS.map((l) => {
        const b = document.createElement("button");
        b.textContent = { en: "EN", zh: "中文", ja: "日本語" }[l];
        b.classList.toggle("active", l === getLang());
        b.addEventListener("click", () => switchLang(l));
        return b;
      }),
    );
  }
  refreshTray();
}

function switchLang(l: Lang): void {
  setLang(l);
  applyI18n();
  refreshTutorial();
  refreshStats();
}

function refreshTray(): void {
  const tile = TILES[game.currentTile];
  drawTilePreview(preview, tile, rot, world.look);
  drawTilePreview(nextPreview, TILES[game.nextTile], 0, world.look);
  $("tile-name").textContent = t(`tile_${tile.key}` as Parameters<typeof t>[0]);
  $("tile-hint").textContent = tile.special ? t(`hint_${tile.special}` as Parameters<typeof t>[0]) : "";
  const canDiscard = game.discardsAvailable > 0;
  $("discard").style.display = canDiscard ? "" : "none";
  const progress = $("discard-progress");
  progress.style.display = canDiscard || game.version < 5 ? "none" : "";
  progress.textContent = t("discardProgress", DISCARD_EVERY - game.discardProgress);
}

function discardTile(): void {
  if (viewing || game.discardsAvailable <= 0) return;
  pending = null;
  game.discard();
  rot = 0;
  playPop();
  saveLocal(game);
  refreshTray();
  updateGhost();
}

function themeLabel(): string {
  const mood = game.mood;
  return mood ? `${mood.theme.emoji} ${t(`theme_${mood.theme.key}` as Parameters<typeof t>[0])}` : "";
}

function announceTheme(): void {
  const mood = game.mood;
  if (!mood) return;
  toast(`${t("themeIntro", themeLabel())} — ${t(`theme_${mood.theme.key}_desc` as Parameters<typeof t>[0])}`, 4500);
}

function refreshStats(): void {
  const daily = game.challenge ? ` · 📅 ${t("tilesLeft", game.remaining)}` : "";
  $("theme").textContent = themeLabel() + daily;
  document.body.classList.toggle("daily", game.challenge && !viewing);
  $("score").textContent = String(game.score);
  $("tiles").textContent = String(game.board.size);
}

function describe(s: PlacementScore): string {
  const notes: string[] = [];
  if (s.perfect) notes.push(`${t("perfect")} +${POINTS.perfect}`);
  if (s.railPoints > 0) notes.push(t(s.loopsClosed ? "loopDone" : "lineDone", s.railPoints));
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
  if (game.finished) {
    showResult();
    return;
  }
  if (!game.board.canPlace(x, y)) return;
  const { placed, score } = game.place(x, y, rot);
  world.addTile(placed, true);
  world.setFrontier(game.board.frontier());
  fitTown();
  playPlace(score.total > 0);
  floatScore(x, y, score.total);
  const opened = agents.sync(game.board, game.seed);
  if (opened.trains.length) setTimeout(playChime, 250);
  else if (opened.roads.length) setTimeout(playPop, 200);
  for (const tr of opened.trains) floatText(tr.x, tr.y, `🚂 ${t("trainArrived")}`, "var(--text)");
  for (const rd of opened.roads) floatText(rd.x, rd.y, `🚗 ${t("roadOpened")}`, "var(--text)");
  for (const sp of opened.specials) floatText(sp.x, sp.y, t(`open_${sp.kind}` as Parameters<typeof t>[0]), "var(--text)");
  if (opened.specials.length && !opened.trains.length) setTimeout(playChime, 250);
  rot = 0;
  saveLocal(game);
  refreshStats();
  refreshTray();
  if (coarse) hover = null;
  updateGhost();
  if (game.finished) setTimeout(showResult, 900);
}

function switchGame(next: Game): void {
  saveLocal(game);
  game = next;
  rot = 0;
  hover = null;
  pending = null;
  rebuildWorld();
  refreshStats();
  refreshTray();
  updateGhost();
  announceTheme();
  if (game.finished) showResult();
}

function showResult(): void {
  const lines = completedRailLines(game.board);
  const loops = lines.filter((l) => l.loop).length;
  $("result-date").textContent = dayLabel(game.day);
  $("result-score").textContent = String(game.score);
  $("result-stats").textContent = t("resultStats", loops, lines.length - loops, completedRoadNetworks(game.board).length);
  $("result-best").textContent = t("bestToday", recordScore(game.day, game.score));
  $("result").classList.add("open");
}

function closeResult(): void {
  $("result").classList.remove("open");
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

function toast(text: string, ms = 2400): void {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(setTimeout(() => el.classList.remove("show"), ms));
}

function townPhoto(scale: number): HTMLCanvasElement {
  world.hideGhost();
  const mood = game.mood;
  return framePhoto(world.capture(scale), {
    title: t("gameName"),
    subtitle: mood ? themeLabel() : t("tagline"),
    stats: t("photoStats", game.score, game.board.size),
  });
}

function setPhoto(on: boolean): void {
  document.body.classList.toggle("photo", on);
  world.setPhotoMode(on);
  pending = null;
  hover = null;
  updateGhost();
}

async function savePhoto(): Promise<void> {
  const blob = await toBlob(townPhoto(2));
  download(blob, `clickton-${new Date().toISOString().slice(0, 10)}.png`);
  playChime();
  toast(t("photoSaved"));
}

async function shareTown(): Promise<void> {
  const code = await encodeCity({ version: game.linkVersion, seed: game.seed, moves: game.moves, day: game.day });
  const url = `${location.origin}${location.pathname}#c=${code}`;
  const text = game.challenge ? t("shareDaily", dayLabel(game.day), game.score) : t("shareText", game.score);
  if (coarse && navigator.share) {
    try {
      const file = new File([await toBlob(townPhoto(1.5))], "clickton.png", { type: "image/png" });
      const data: ShareData = { title: t("gameName"), text, url };
      if (navigator.canShare?.({ ...data, files: [file] })) data.files = [file];
      await navigator.share(data);
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t("linkCopied"));
  } catch {
    window.prompt(t("copyThisLink"), url);
  }
}

let replayToken = 0;
let replayTarget: Game | null = null;

function finishReplay(): void {
  document.body.classList.remove("replaying");
  $("replay-progress").textContent = "";
  replayTarget = null;
}

function replay(): void {
  if (replayTarget) return;
  const token = ++replayToken;
  replayTarget = game;
  const moves = [...game.moves];
  game = replayTarget.restart();
  rebuildWorld();
  refreshStats();
  document.body.classList.add("replaying");
  const interval = Math.max(40, Math.min(220, 18000 / Math.max(1, moves.length)));
  let i = 0;
  const step = () => {
    if (token !== replayToken) return;
    if (i >= moves.length) {
      finishReplay();
      return;
    }
    const m = moves[i++];
    const placed = game.apply(m);
    if (!placed) {
      setTimeout(step, interval);
      return;
    }
    world.addTile(placed, true);
    fitTown();
    if (agents.sync(game.board, game.seed).trains.length) playChime();
    if (i % 3 === 1) playPop();
    refreshStats();
    $("replay-progress").textContent = `${i} / ${moves.length}`;
    setTimeout(step, interval);
  };
  step();
}

function skipReplay(): void {
  if (!replayTarget) return;
  replayToken++;
  game = replayTarget;
  finishReplay();
  rebuildWorld();
  refreshStats();
}

function buildOwn(): void {
  history.replaceState(null, "", location.pathname + location.search);
  location.reload();
}

function newTown(): void {
  const town = game.challenge ? loadLocal("town") : game;
  if (town && town.moves.length > 0 && !window.confirm(t("confirmNewTown"))) return;
  closeNewGame();
  closeResult();
  if (game.challenge) saveLocal(game);
  game = new Game(randomSeed());
  rot = 0;
  hover = null;
  pending = null;
  rebuildWorld();
  saveLocal(game);
  refreshStats();
  refreshTray();
  updateGhost();
  announceTheme();
}

function setMenu(open: boolean): void {
  document.body.classList.toggle("menu-open", open);
}

function openNewGame(): void {
  setMenu(false);
  $("newgame").classList.add("open");
}

function closeNewGame(): void {
  $("newgame").classList.remove("open");
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
    setMenu(false);
    if (viewing || document.body.classList.contains("photo")) return;
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
  if (viewing || document.body.classList.contains("photo") || e.pointerType !== "mouse" || pending) return;
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
  if (e.key === "Escape" && document.body.classList.contains("photo")) {
    setPhoto(false);
    return;
  }
  if (e.key === "Escape" && $("newgame").classList.contains("open")) {
    closeNewGame();
    return;
  }
  if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
    setMenu(false);
    return;
  }
  if (viewing || document.body.classList.contains("photo")) return;
  if (e.key === "r" || e.key === "R" || e.key === "e" || e.key === "E") rotate(1);
  if (e.key === "q" || e.key === "Q") rotate(-1);
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    confirmPending();
  }
  if (e.key === "Escape") cancelPending();
  if (e.key === "x" || e.key === "X") discardTile();
});

$("rot-left").addEventListener("click", () => rotate(-1));
$("discard").addEventListener("click", discardTile);
$("rot-right").addEventListener("click", () => rotate(1));
$("confirm").addEventListener("click", confirmPending);
$("cancel").addEventListener("click", cancelPending);
$("menu-toggle").addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
$("menu").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest(".menu-item")) setMenu(false);
});
$("tray").addEventListener("pointerdown", () => setMenu(false));
$("new-game").addEventListener("click", openNewGame);
$("ng-town").addEventListener("click", newTown);
$("ng-daily").addEventListener("click", () => {
  closeNewGame();
  closeResult();
  switchGame(game.challenge ? Game.daily(todayNumber()) : loadDaily());
});
$("ng-cancel").addEventListener("click", closeNewGame);
$("newgame").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeNewGame();
});
$("share").addEventListener("click", () => void shareTown());
$("replay").addEventListener("click", replay);
$("skip").addEventListener("click", skipReplay);
$("build-own").addEventListener("click", buildOwn);
document.body.classList.toggle("viewing", viewing);

setLang(getLang());
applyI18n();
rebuildWorld();
refreshStats();
if (viewing && game.challenge) {
  document.body.classList.add("daily-link");
  $("viewer-label").textContent = t("viewingDaily", dayLabel(game.day));
}
if (!viewing && !tutorialSeen() && !new URLSearchParams(location.search).has("demo")) startTutorial();
if (badLink) toast(t("badLink"));
else if (viewing || game.moves.length === 0) announceTheme();

let previewTransform = "";

function alignPreview(): void {
  const az = world.controls.getAzimuthalAngle();
  const squash = Math.cos(world.controls.getPolarAngle());
  const tf = `scaleY(${squash.toFixed(2)}) rotate(${az.toFixed(2)}rad)`;
  if (tf === previewTransform) return;
  previewTransform = tf;
  preview.style.transform = tf;
  nextPreview.style.transform = tf;
}

const statsEl = new URLSearchParams(location.search).has("stats") ? document.createElement("pre") : null;
if (statsEl) {
  statsEl.className = "stats-panel";
  document.body.appendChild(statsEl);
}
let statFrames = 0;
let statSince = performance.now();

function updateStats(now: number): void {
  if (!statsEl) return;
  statFrames++;
  if (now - statSince < 500) return;
  const info = world.renderer.info;
  statsEl.textContent = `${Math.round((statFrames * 1000) / (now - statSince))} fps\n${info.render.calls} draws\n${Math.round(info.render.triangles / 1000)}k tris\n${game.board.size} tiles · ${agents.root.children.length} agents`;
  statFrames = 0;
  statSince = now;
}

const dayNight = new DayNight();
if (import.meta.env.DEV) Object.assign((window as unknown as { __clickton: object }).__clickton, { dayNight });
$("photo").addEventListener("click", () => setPhoto(true));
$("back-town").addEventListener("click", () => {
  closeResult();
  const saved = loadLocal("town");
  switchGame(saved ? Game.replay(saved.seed, saved.moves, saved.version, saved.day) : new Game(randomSeed()));
});
$("result-close").addEventListener("click", () => $("back-town").click());
$("result-share").addEventListener("click", () => void shareTown());
$("result-again").addEventListener("click", () => {
  closeResult();
  switchGame(Game.daily(todayNumber()));
});
$("try-daily").addEventListener("click", () => {
  location.href = `${location.pathname}?daily`;
});
$("help-btn").addEventListener("click", startTutorial);
$("photo-exit").addEventListener("click", () => setPhoto(false));
$("photo-save").addEventListener("click", () => void savePhoto());

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const sky = dayNight.update(dt);
  world.setSky(sky);
  agents.update(dt, game.board, { camera: world.camera, pixelsPerUnit: world.pixelsPerUnit() }, 1 - sky.daylight);
  world.render(now);
  updateStats(now);
  positionBubble();
  alignPreview();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
