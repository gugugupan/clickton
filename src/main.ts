import "./style.css";
import { playClick, playTick } from "./audio";
import { Game } from "./core/game";
import { randomSeed } from "./core/rng";
import { POINTS, countHoleCells, type PlacementScore } from "./core/scoring";
import { TILES, type Rot } from "./core/tiles";
import { LANGS, getLang, hasKey, setLang, t, type Lang } from "./i18n";
import { World } from "./render/scene";
import { loadLocal, saveLocal } from "./save";
import { drawTilePreview } from "./ui/tilePreview";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("stage");
const preview = $<HTMLCanvasElement>("preview");
const bubble = $("bubble");
const coarse = window.matchMedia("(pointer: coarse)").matches;

let game = restore();
const world = new World(canvas, game.seed);
let rot: Rot = 0;
let hover: { x: number; y: number } | null = null;
let holes = countHoleCells(game.board);

function restore(): Game {
  const saved = loadLocal();
  if (saved) {
    try {
      return Game.replay(saved.seed, saved.moves);
    } catch {}
  }
  return new Game(randomSeed());
}

function rebuildWorld(): void {
  world.seed = game.seed;
  world.clearTiles();
  for (const p of game.board.all()) world.addTile(p, false);
  world.setFrontier(game.board.frontier());
  const last = game.moves[game.moves.length - 1];
  world.focus(last?.x ?? 0, last?.y ?? 0);
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

function updateHover(): void {
  if (!hover) {
    world.hideGhost();
    bubble.style.display = "none";
    return;
  }
  const s = game.preview(hover.x, hover.y, rot);
  if (!s) {
    world.hideGhost();
    bubble.style.display = "none";
    return;
  }
  world.showGhost(TILES[game.currentTile], rot, hover.x, hover.y);
  const note = describe(s);
  bubble.className = `bubble ${s.total > 0 ? "good" : s.total < 0 ? "bad" : "zero"}`;
  bubble.innerHTML = `${s.total > 0 ? "+" : ""}${s.total}${note ? `<small>${note}</small>` : ""}`;
  bubble.style.display = "block";
  positionBubble();
}

function positionBubble(): void {
  if (!hover || bubble.style.display === "none") return;
  const p = world.toScreen(hover.x, hover.y, 0.9);
  bubble.style.left = `${p.x}px`;
  bubble.style.top = `${p.y}px`;
}

function rotate(delta: 1 | -1): void {
  rot = ((rot + delta + 4) % 4) as Rot;
  playTick();
  refreshTray();
  updateHover();
}

function place(x: number, y: number): void {
  if (!game.board.canPlace(x, y)) return;
  const { placed, score } = game.place(x, y, rot);
  holes = score.holeCellsAfter;
  world.addTile(placed, true);
  world.setFrontier(game.board.frontier());
  playClick(score.total > 0 ? 1 : 0.8);
  floatScore(x, y, score.total);
  rot = 0;
  saveLocal(game);
  refreshStats();
  refreshTray();
  hover = coarse ? null : hover;
  updateHover();
}

function floatScore(x: number, y: number, total: number): void {
  const p = world.toScreen(x, y, 0.6);
  const el = document.createElement("div");
  el.className = "float-score";
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  el.style.color = total > 0 ? "var(--sage-ink)" : total < 0 ? "var(--terracotta-ink)" : "var(--text-soft)";
  el.textContent = `${total > 0 ? "+" : ""}${total}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

function newTown(): void {
  if (game.board.size > 1 && !window.confirm(t("confirmNewTown"))) return;
  game = new Game(randomSeed());
  rot = 0;
  holes = 0;
  hover = null;
  rebuildWorld();
  saveLocal(game);
  refreshStats();
  refreshTray();
  updateHover();
}

let down: { x: number; y: number; button: number } | null = null;

canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY, button: e.button };
});

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse" || down) return;
  const c = world.pickCell(e.clientX, e.clientY);
  if (c?.x === hover?.x && c?.y === hover?.y) return;
  hover = c;
  updateHover();
});

canvas.addEventListener("pointerup", (e) => {
  const d = down;
  down = null;
  if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
  if (d.button === 2) {
    rotate(1);
    return;
  }
  if (d.button !== 0) return;
  const c = world.pickCell(e.clientX, e.clientY);
  if (!c) return;
  if (e.pointerType === "mouse" || (hover && hover.x === c.x && hover.y === c.y)) {
    place(c.x, c.y);
  } else {
    hover = c;
    updateHover();
  }
});

canvas.addEventListener("pointerleave", () => {
  if (coarse) return;
  hover = null;
  updateHover();
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R" || e.key === "e" || e.key === "E") rotate(1);
  if (e.key === "q" || e.key === "Q") rotate(-1);
});

$("rot-left").addEventListener("click", () => rotate(-1));
$("rot-right").addEventListener("click", () => rotate(1));
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

function frame(now: number): void {
  world.render(now);
  positionBubble();
  alignPreview();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
