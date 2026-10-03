import {
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  MeshLambertMaterial,
  MeshBasicMaterial,
  Group,
  Points,
  PointsMaterial,
  AdditiveBlending,
  CanvasTexture,
  Object3D,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Placed } from "../core/board";
import { hash, mulberry32 } from "../core/rng";
import { DIRS, DX, DY, edgeOf, type Edge, type Rot, type TileDef } from "../core/tiles";
import { PALETTE } from "./palette";
import type { SkyState } from "./daynight";
import { DEFAULT_LOOK, type Look } from "./looks";
import type { MaterialMode, ModelLibrary } from "./models";
import { PLATE_SIZE, PLATE_TOP, buildTile } from "./tileMeshes";

const MIN_VIEW = 5.5;
const MAX_VIEW = 16;
const DROP_MS = 260;

interface TileEntry {
  placed: Placed;
  parts: Map<string, BufferGeometry>;
  lights: number[];
  dropping: Mesh | null;
}

interface Chunk {
  meshes: Map<string, Mesh>;
}

interface Drop {
  mesh: Mesh;
  start: number;
  entry: TileEntry;
}

const CHUNK = 8;
const GLOW_SIZE = 0.3;
const BASE_PART = "@base";

function overlay(material: MeshBasicMaterial): MeshBasicMaterial {
  material.transparent = true;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

function edgeGlowTexture(): CanvasTexture {
  const w = 256, h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const across = g.createLinearGradient(0, 0, 0, h);
  across.addColorStop(0, "rgba(255,255,255,0)");
  across.addColorStop(0.38, "rgba(255,255,255,0.35)");
  across.addColorStop(0.5, "rgba(255,255,255,1)");
  across.addColorStop(0.62, "rgba(255,255,255,0.35)");
  across.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = across;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "destination-in";
  const along = g.createLinearGradient(0, 0, w, 0);
  along.addColorStop(0, "rgba(0,0,0,0)");
  along.addColorStop(0.12, "rgba(0,0,0,1)");
  along.addColorStop(0.88, "rgba(0,0,0,1)");
  along.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = along;
  g.fillRect(0, 0, w, h);
  return new CanvasTexture(canvas);
}

export class World {
  readonly renderer: WebGLRenderer;
  readonly camera: OrthographicCamera;
  readonly controls: MapControls;
  private readonly scene = new Scene();
  private readonly sun: DirectionalLight;
  private readonly tileMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  private readonly ghostMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  private readonly pendingMaterial = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    transparent: true,
    opacity: 0.92,
  });
  private ghostPending = false;
  private viewHeight = MIN_VIEW;
  private targetViewHeight = MIN_VIEW;
  private readonly tiles = new Map<string, TileEntry>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly dirty = new Set<string>();
  private shadowsStale = true;
  private readonly lastTarget = new Vector3(Infinity, 0, 0);
  edgesAround: (x: number, y: number) => (Edge | undefined)[] = () => [];
  lakesAround: (x: number, y: number) => boolean[] = () => [];
  private readonly drops: Drop[] = [];
  private ghost: Mesh | null = null;
  private readonly edgeMarks = new Group();
  private readonly tmpA = new Color();
  private readonly tmpB = new Color();
  private readonly glowMaterial = new PointsMaterial({
    size: 1,
    sizeAttenuation: false,
    map: glowTexture(),
    color: 0xffcf86,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly glowPoints = new Points(new BufferGeometry(), this.glowMaterial);
  private readonly hemi: HemisphereLight;
  private readonly tableMaterial = new MeshLambertMaterial({ color: PALETTE.table });
  look: Look = DEFAULT_LOOK;
  private readonly glowMap = edgeGlowTexture();
  private readonly matchMaterial = overlay(new MeshBasicMaterial({ color: PALETTE.edgeMatch, map: this.glowMap, blending: AdditiveBlending }));
  private readonly mismatchMaterial = overlay(new MeshBasicMaterial({ color: PALETTE.edgeMismatch, map: this.glowMap, opacity: 0.4 }));
  private readonly markGeometry = new PlaneGeometry(0.92, 0.2).rotateX(-Math.PI / 2);
  private ghostKey = "";
  private frontier: LineSegments | null = null;
  private readonly cursor: LineSegments;
  private readonly raycaster = new Raycaster();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), -PLATE_TOP);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    public seed: number,
    private readonly library: ModelLibrary,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.scene.background = new Color(PALETTE.background);

    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(12, 14, 12);
    this.camera.zoom = 1;

    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minZoom = 0.35;
    this.controls.maxZoom = 3.5;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.15;
    this.controls.zoomToCursor = true;

    this.hemi = new HemisphereLight(0xfffaf2, 0xd9cfc3, 2.1);
    this.scene.add(this.hemi);
    this.sun = new DirectionalLight(0xfff4e6, 1.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0005;
    const sc = this.sun.shadow.camera;
    sc.left = -18;
    sc.right = 18;
    sc.top = 18;
    sc.bottom = -18;
    sc.near = 1;
    sc.far = 60;
    this.scene.add(this.sun, this.sun.target);

    const table = new Mesh(new PlaneGeometry(400, 400), this.tableMaterial);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.001;
    table.receiveShadow = true;
    this.scene.add(table);

    this.cursor = new LineSegments(
      new EdgesGeometry(new BoxGeometry(PLATE_SIZE, 0.01, PLATE_SIZE)),
      new LineBasicMaterial({ color: PALETTE.frontier, transparent: true, opacity: 0.9 }),
    );
    this.cursor.visible = false;
    this.scene.add(this.cursor, this.edgeMarks, this.glowPoints);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  setLook(look: Look): void {
    this.look = look;
    (this.scene.background as Color).setHex(look.background);
    this.tableMaterial.color.setHex(look.table);
    this.hemi.color.setHex(look.sky);
    this.hemi.groundColor.setHex(look.ground);
  }

  add(object: Object3D): void {
    this.scene.add(object);
  }

  resize(): void {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.updateFrustum();
  }

  private updateFrustum(): void {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const v = this.viewHeight * Math.max(1, 0.8 / aspect);
    this.camera.left = (-v * aspect) / 2;
    this.camera.right = (v * aspect) / 2;
    this.camera.top = v / 2;
    this.camera.bottom = -v / 2;
    this.camera.updateProjectionMatrix();
  }

  fitTown(width: number, depth: number, instant = false): void {
    const extent = Math.max(width, depth);
    this.targetViewHeight = Math.min(MAX_VIEW, Math.max(MIN_VIEW, 3.5 + extent * 0.6));
    if (instant) {
      this.viewHeight = this.targetViewHeight;
      this.updateFrustum();
    }
  }

  private build(tile: TileDef, rot: Rot, x: number, y: number) {
    return buildTile(tile, rot, mulberry32(hash(this.seed, x, y)), this.edgesAround(x, y), this.look, this.lakesAround(x, y));
  }

  private makeMesh(tile: TileDef, rot: Rot, x: number, y: number, mode: MaterialMode): Mesh {
    const { base, props } = this.build(tile, rot, x, y);
    const material = mode === "solid" ? this.tileMaterial : mode === "ghost" ? this.ghostMaterial : this.pendingMaterial;
    const mesh = new Mesh(base, material);
    mesh.position.set(x, 0, y);
    for (const child of this.library.buildProps(props, mode)) mesh.add(child);
    return mesh;
  }

  private disposeMesh(mesh: Mesh): void {
    mesh.geometry.dispose();
    for (const child of mesh.children) (child as Mesh).geometry.dispose();
  }

  private lastLights: number[] = [];

  private tileParts(p: Placed, baseOnly?: Map<string, BufferGeometry>): Map<string, BufferGeometry> {
    const { base, props, lights } = this.build(p.tile, p.rot, p.x, p.y);
    this.lastLights = lights.flatMap((l) => [l.x + p.x, l.y, l.z + p.y]);
    base.translate(p.x, 0, p.y);
    const parts = new Map<string, BufferGeometry>([[BASE_PART, base]]);
    if (baseOnly) {
      for (const [k, g] of baseOnly) if (k !== BASE_PART) parts.set(k, g);
      return parts;
    }
    for (const [pack, g] of this.library.propGeometries(props)) {
      g.translate(p.x, 0, p.y);
      parts.set(pack, g);
    }
    return parts;
  }

  private chunkKey(x: number, y: number): string {
    return `${Math.floor(x / CHUNK)},${Math.floor(y / CHUNK)}`;
  }

  private markDirty(x: number, y: number): void {
    this.dirty.add(this.chunkKey(x, y));
  }

  private flushChunks(): void {
    for (const key of this.dirty) {
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = { meshes: new Map() };
        this.chunks.set(key, chunk);
      }
      const byMaterial = new Map<string, BufferGeometry[]>();
      for (const entry of this.tiles.values()) {
        if (entry.dropping || this.chunkKey(entry.placed.x, entry.placed.y) !== key) continue;
        for (const [k, g] of entry.parts) {
          const list = byMaterial.get(k) ?? [];
          list.push(g);
          byMaterial.set(k, list);
        }
      }
      for (const [k, mesh] of chunk.meshes) {
        if (byMaterial.has(k)) continue;
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        chunk.meshes.delete(k);
      }
      for (const [k, list] of byMaterial) {
        const merged = mergeGeometries(list, false);
        if (!merged) continue;
        let mesh = chunk.meshes.get(k);
        if (mesh) {
          mesh.geometry.dispose();
          mesh.geometry = merged;
        } else {
          mesh = new Mesh(merged, k === BASE_PART ? this.tileMaterial : this.library.material(k, "solid"));
          mesh.castShadow = k !== BASE_PART;
          mesh.receiveShadow = true;
          chunk.meshes.set(k, mesh);
          this.scene.add(mesh);
        }
      }
    }
    this.dirty.clear();
    this.shadowsStale = true;
    const positions: number[] = [];
    for (const entry of this.tiles.values()) positions.push(...entry.lights);
    this.glowPoints.geometry.dispose();
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    this.glowPoints.geometry = geo;
  }

  setSky(sky: SkyState): void {
    const night = 1 - sky.daylight;
    const mix = (a: number, b: number, t: number) => this.tmpA.setHex(a).lerp(this.tmpB.setHex(b), t);
    (this.scene.background as Color).copy(mix(this.look.background, NIGHT.background, night)).lerp(this.tmpB.setHex(NIGHT.duskSky), sky.dusk * 0.3);
    this.tableMaterial.color.copy(mix(this.look.table, NIGHT.table, night));
    this.hemi.color.copy(mix(this.look.sky, NIGHT.sky, night));
    this.hemi.groundColor.copy(mix(this.look.ground, NIGHT.ground, night));
    this.hemi.intensity = 2.1 - night * 0.85;
    this.sun.color.copy(mix(0xfff4e6, NIGHT.moon, night)).lerp(this.tmpB.setHex(NIGHT.duskSun), sky.dusk * 0.6);
    this.sun.intensity = 1.1 - night * 0.7;
    this.glowMaterial.opacity = night;
    this.glowPoints.visible = night > 0.02;
    this.library.setNight(night);
  }

  addTile(p: Placed, animate: boolean, refreshNeighbours = animate): void {
    const parts = this.tileParts(p);
    const entry: TileEntry = { placed: p, parts, lights: this.lastLights, dropping: null };
    this.tiles.set(`${p.x},${p.y}`, entry);
    const ring = [
      [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
    ];
    for (const [dx, dy] of refreshNeighbours ? ring : []) {
      const n = this.tiles.get(`${p.x + dx},${p.y + dy}`);
      if (!n) continue;
      n.parts.get(BASE_PART)?.dispose();
      n.parts = this.tileParts(n.placed, n.parts);
      if (n.dropping) {
        n.dropping.geometry.dispose();
        n.dropping.geometry = n.parts.get(BASE_PART)!.clone().translate(-n.placed.x, 0, -n.placed.y);
      } else this.markDirty(n.placed.x, n.placed.y);
    }
    if (animate) {
      const mesh = this.makeMesh(p.tile, p.rot, p.x, p.y, "solid");
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = 0.8;
      this.scene.add(mesh);
      entry.dropping = mesh;
      this.drops.push({ mesh, start: performance.now(), entry });
    } else {
      this.markDirty(p.x, p.y);
    }
    if (refreshNeighbours || animate) this.flushChunks();
  }

  commitTiles(): void {
    this.flushChunks();
  }

  clearTiles(): void {
    for (const d of this.drops) {
      this.scene.remove(d.mesh);
      this.disposeMesh(d.mesh);
    }
    this.drops.length = 0;
    for (const chunk of this.chunks.values()) {
      for (const mesh of chunk.meshes.values()) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
    }
    this.chunks.clear();
    for (const entry of this.tiles.values()) for (const g of entry.parts.values()) g.dispose();
    this.tiles.clear();
    this.dirty.clear();
    this.hideGhost();
  }

  showGhost(tile: TileDef, rot: Rot, x: number, y: number, pending = false): void {
    const key = `${tile.id}:${rot}:${x}:${y}:${pending}`;
    this.cursor.visible = true;
    this.cursor.position.set(x, PLATE_TOP + 0.005, y);
    if (key === this.ghostKey) return;
    this.hideGhost();
    this.cursor.visible = true;
    this.ghost = this.makeMesh(tile, rot, x, y, pending ? "pending" : "ghost");
    this.ghost.position.y = 0.06;
    this.edgeMarks.position.y = 0.06;
    this.ghost.castShadow = pending;
    this.ghostPending = pending;
    this.scene.add(this.ghost);
    this.ghostKey = key;
    this.shadowsStale = true;
    this.showEdgeMarks(tile, rot, x, y);
  }

  private showEdgeMarks(tile: TileDef, rot: Rot, x: number, y: number): void {
    this.edgeMarks.clear();
    const around = this.edgesAround(x, y);
    for (const d of DIRS) {
      const theirs = around[d];
      if (theirs === undefined) continue;
      const ok = edgeOf(tile, rot, d) === theirs;
      const ex = x + DX[d] * 0.46, ez = y + DY[d] * 0.46;
      const mark = new Mesh(this.markGeometry, ok ? this.matchMaterial : this.mismatchMaterial);
      mark.position.set(ex, PLATE_TOP + 0.01, ez);
      mark.rotation.y = d % 2 === 0 ? 0 : Math.PI / 2;
      mark.renderOrder = 10;
      this.edgeMarks.add(mark);
    }
  }

  hideGhost(): void {
    this.shadowsStale = true;
    this.cursor.visible = false;
    this.edgeMarks.clear();
    if (!this.ghost) return;
    this.scene.remove(this.ghost);
    this.disposeMesh(this.ghost);
    this.ghost = null;
    this.ghostKey = "";
  }

  setFrontier(cells: { x: number; y: number }[]): void {
    if (this.frontier) {
      this.scene.remove(this.frontier);
      this.frontier.geometry.dispose();
    }
    const s = PLATE_SIZE / 2 - 0.06, d = 0.12, y = 0.004;
    const pts: number[] = [];
    for (const c of cells) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = c.x + sx * s, cz = c.y + sz * s;
        pts.push(cx, y, cz, cx - sx * d, y, cz, cx, y, cz, cx, y, cz - sz * d);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    this.frontier = new LineSegments(geo, new LineBasicMaterial({ color: PALETTE.frontier, transparent: true, opacity: 0.55 }));
    this.scene.add(this.frontier);
  }

  pickPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return { x: hit.x, y: hit.z };
  }

  pickCell(clientX: number, clientY: number): { x: number; y: number } | null {
    const p = this.pickPoint(clientX, clientY);
    return p && { x: Math.round(p.x), y: Math.round(p.y) };
  }

  toScreen(x: number, y: number, height = 0.4): { x: number; y: number } {
    const v = new Vector3(x, height, y).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  setPhotoMode(on: boolean): void {
    this.controls.maxPolarAngle = on ? 1.38 : 1.15;
    this.controls.minZoom = on ? 0.25 : 0.35;
    this.controls.maxZoom = on ? 6 : 3.5;
  }

  capture(scale: number): HTMLCanvasElement {
    const ratio = this.renderer.getPixelRatio();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(Math.min(3, ratio * scale));
    this.renderer.setSize(w, h, false);
    this.glowMaterial.size = GLOW_SIZE * this.pixelsPerUnit() * this.renderer.getPixelRatio();
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    const out = document.createElement("canvas");
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    out.getContext("2d")!.drawImage(this.canvas, 0, 0);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    return out;
  }

  pixelsPerUnit(): number {
    return (this.canvas.clientHeight * this.camera.zoom) / (this.camera.top - this.camera.bottom);
  }

  focus(x: number, y: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(x, 0, y);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  render(now: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const t = Math.min(1, (now - d.start) / DROP_MS);
      d.mesh.position.y = 0.8 * (1 - easeOutBounce(t));
      if (t >= 1) {
        this.drops.splice(i, 1);
        this.scene.remove(d.mesh);
        this.disposeMesh(d.mesh);
        d.entry.dropping = null;
        this.markDirty(d.entry.placed.x, d.entry.placed.y);
        this.flushChunks();
      }
    }
    if (Math.abs(this.targetViewHeight - this.viewHeight) > 0.005) {
      this.viewHeight += (this.targetViewHeight - this.viewHeight) * 0.06;
      this.updateFrustum();
    }
    this.glowMaterial.size = GLOW_SIZE * this.pixelsPerUnit() * this.renderer.getPixelRatio();
    this.matchMaterial.opacity = 0.75 + Math.sin(now / 260) * 0.25;
    if (this.ghost && this.ghostPending) this.ghost.position.y = 0.16 + Math.sin(now / 260) * 0.03;
    if (this.ghost) this.edgeMarks.position.y = this.ghost.position.y;
    this.controls.update();
    const tgt = this.controls.target;
    this.sun.position.set(tgt.x + 8, 16, tgt.z + 5);
    this.sun.target.position.copy(tgt);
    if (this.shadowsStale || this.drops.length > 0 || (this.ghost && this.ghostPending) || tgt.distanceToSquared(this.lastTarget) > 1e-6) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastTarget.copy(tgt);
      this.shadowsStale = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

const NIGHT = {
  background: 0x454c72,
  table: 0x40466a,
  sky: 0x9aa3dc,
  ground: 0x4a4e72,
  moon: 0xaab8ea,
  duskSun: 0xffb27f,
  duskSky: 0xf2b99a,
};

export function glowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

function easeOutBounce(t: number): number {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
