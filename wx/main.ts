import { screenCanvas } from "./adapter";
import { CanvasTexture, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, SRGBColorSpace } from "three";
import { playPlace } from "../src/audio";
import { Game } from "../src/core/game";
import { mulberry32, randomSeed } from "../src/core/rng";
import { DIRS, DX, DY, opposite, type Rot } from "../src/core/tiles";
import { initMusic, setAmbience, setMusicDaylight } from "../src/music";
import { Agents } from "../src/render/agents";
import { DayNight } from "../src/render/daynight";
import { lookFor } from "../src/render/looks";
import { ModelLibrary } from "../src/render/models";
import { World } from "../src/render/scene";
import { SUBPACKAGES } from "./subpackages";

declare const wx: any; // eslint-disable-line @typescript-eslint/no-explicit-any

const DEMO_TILES = 60;
const STRESS_TILES = 30;

function loadSubpackage(name: string): Promise<void> {
  return new Promise((resolve, reject) => wx.loadSubpackage({ name, success: () => resolve(), fail: reject }));
}

function bestRot(game: Game, x: number, y: number): Rot {
  let best: Rot = 0;
  let bestScore = -Infinity;
  for (const r of [0, 1, 2, 3] as Rot[]) {
    const s = game.preview(x, y, r)?.total ?? -Infinity;
    if (s > bestScore) [best, bestScore] = [r, s];
  }
  return best;
}

function grow(game: Game, n: number, rnd: () => number): void {
  for (let i = 0; i < n; i++) {
    const cells = game.board.frontier().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const c = cells[Math.floor(rnd() * Math.min(cells.length, 6))];
    game.place(c.x, c.y, bestRot(game, c.x, c.y));
  }
}

class Hud {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  private readonly canvas = wx.createCanvas();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly scale: number;

  constructor(width: number, height: number, pixelRatio: number) {
    this.scale = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(56 * pixelRatio);
    this.ctx = this.canvas.getContext("2d");
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.camera = new OrthographicCamera(0, width, height, 0, -1, 1);
    const plane = new Mesh(new PlaneGeometry(width, 56), new MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false }));
    plane.position.set(width / 2, height - 28 - 44, 0);
    this.scene.add(plane);
  }

  draw(lines: string[]): void {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.fillStyle = "rgba(94, 83, 75, 0.78)";
    c.fillRect(10, 4, 330, 48);
    c.fillStyle = "#F6F1E9";
    c.font = "13px sans-serif";
    lines.forEach((line, i) => c.fillText(line, 20, 24 + i * 18));
    this.texture.needsUpdate = true;
  }
}

async function boot(): Promise<void> {
  const t0 = Date.now();
  for (const name of SUBPACKAGES) await loadSubpackage(name);
  const tPackages = Date.now();
  const library = new ModelLibrary();
  const agents = new Agents(library, true);
  await library.load(() => {});
  await agents.load(() => {});
  const tModels = Date.now();
  console.log(`[clickton] subpackages ${tPackages - t0} ms, models ${tModels - tPackages} ms`);

  const game = new Game(randomSeed());
  const rnd = mulberry32(game.seed);
  grow(game, DEMO_TILES, rnd);

  const world = new World(screenCanvas, game.seed, library);
  world.add(agents.root);
  world.edgesAround = (x, y) => DIRS.map((d) => game.board.edgeAt(x + DX[d], y + DY[d], opposite(d)));
  const ring = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  world.lakesAround = (x, y) => ring.map(([dx, dy]) => !!game.board.get(x + dx, y + dy)?.tile.pool);
  world.setLook(lookFor(game.mood?.theme.key));

  const rebuild = () => {
    world.clearTiles();
    for (const p of game.board.all()) world.addTile(p, false);
    world.commitTiles();
    world.setFrontier(game.board.frontier());
    agents.clear();
    agents.sync(game.board, game.seed);
    const b = game.board.getBounds()!;
    world.focus((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
    world.fitTown(b.maxX - b.minX + 1, b.maxY - b.minY + 1, true);
  };
  rebuild();
  initMusic();

  const hud = new Hud(screenCanvas.clientWidth, screenCanvas.clientHeight, world.renderer.getPixelRatio());
  world.renderer.autoClear = false;

  let down: { x: number; y: number; t: number } | null = null;
  wx.onTouchStart((e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const t = e.touches.length === 1 ? e.touches[0] : null;
    down = t ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
  });
  wx.onTouchEnd((e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const t = e.changedTouches[0];
    if (!down || Math.hypot(t.clientX - down.x, t.clientY - down.y) > 8 || Date.now() - down.t > 400) return;
    down = null;
    if (t.clientY < 110 && t.clientX < 270) {
      grow(game, STRESS_TILES, rnd);
      rebuild();
      return;
    }
    const c = world.pickCell(t.clientX, t.clientY);
    if (!c || !game.board.frontier().some((f) => f.x === c.x && f.y === c.y)) return;
    const { placed, score } = game.place(c.x, c.y, bestRot(game, c.x, c.y));
    world.addTile(placed, true);
    world.setFrontier(game.board.frontier());
    agents.sync(game.board, game.seed);
    playPlace(score.total > 0);
  });

  const dayNight = new DayNight();
  let last = performance.now();
  let frames = 0;
  let windowStart = last;
  let worst = 0;
  let frameNo = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    worst = Math.max(worst, now - last);
    last = now;
    const sky = dayNight.update(dt);
    setMusicDaylight(sky.daylight);
    if (++frameNo % 60 === 0) setAmbience({ ...agents.census(), water: 0, grass: 0 });
    world.setSky(sky);
    const clock = dayNight.phase;
    agents.update(dt, game.board, { camera: world.camera, pixelsPerUnit: world.pixelsPerUnit() }, 1 - sky.daylight, clock);
    world.renderer.clear();
    world.render(now);
    const calls = world.renderer.info.render.calls;
    world.renderer.clearDepth();
    world.renderer.render(hud.scene, hud.camera);
    frames++;
    if (now - windowStart >= 1000) {
      const fps = (frames * 1000) / (now - windowStart);
      const census = agents.census();
      hud.draw([
        `${fps.toFixed(0)} fps · worst ${worst.toFixed(0)} ms · ${calls} calls`,
        `${[...game.board.all()].length} tiles · ${census.cars} cars · ${census.trains} trains · tap here +${STRESS_TILES}`,
      ]);
      frames = 0;
      worst = 0;
      windowStart = now;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot().catch((e) => console.error("[clickton] boot failed", e));
