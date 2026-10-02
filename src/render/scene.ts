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
  PCFSoftShadowMap,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  MeshLambertMaterial,
} from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { Placed } from "../core/board";
import { hash, mulberry32 } from "../core/rng";
import type { Rot, TileDef } from "../core/tiles";
import { PALETTE } from "./palette";
import { PLATE_SIZE, PLATE_TOP, buildTileGeometry } from "./tileMeshes";

const MIN_VIEW = 5.5;
const MAX_VIEW = 16;
const DROP_MS = 260;

interface Drop {
  mesh: Mesh;
  start: number;
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
  private readonly tiles = new Map<string, Mesh>();
  private readonly drops: Drop[] = [];
  private ghost: Mesh | null = null;
  private ghostKey = "";
  private frontier: LineSegments | null = null;
  private readonly cursor: LineSegments;
  private readonly raycaster = new Raycaster();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), -PLATE_TOP);

  constructor(private readonly canvas: HTMLCanvasElement, public seed: number) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
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

    this.scene.add(new HemisphereLight(0xfffaf2, 0xd9cfc3, 2.1));
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

    const table = new Mesh(new PlaneGeometry(400, 400), new MeshLambertMaterial({ color: PALETTE.table }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.001;
    table.receiveShadow = true;
    this.scene.add(table);

    this.cursor = new LineSegments(
      new EdgesGeometry(new BoxGeometry(PLATE_SIZE, 0.01, PLATE_SIZE)),
      new LineBasicMaterial({ color: PALETTE.frontier, transparent: true, opacity: 0.9 }),
    );
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.resize();
    window.addEventListener("resize", () => this.resize());
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

  private makeMesh(tile: TileDef, rot: Rot, x: number, y: number, material: MeshStandardMaterial): Mesh {
    const geo = buildTileGeometry(tile, rot, mulberry32(hash(this.seed, x, y)));
    const mesh = new Mesh(geo, material);
    mesh.position.set(x, 0, y);
    return mesh;
  }

  addTile(p: Placed, animate: boolean): void {
    const mesh = this.makeMesh(p.tile, p.rot, p.x, p.y, this.tileMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.tiles.set(`${p.x},${p.y}`, mesh);
    if (animate) {
      mesh.position.y = 0.8;
      this.drops.push({ mesh, start: performance.now() });
    }
  }

  clearTiles(): void {
    for (const m of this.tiles.values()) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.tiles.clear();
    this.hideGhost();
  }

  showGhost(tile: TileDef, rot: Rot, x: number, y: number, pending = false): void {
    const key = `${tile.id}:${rot}:${x}:${y}:${pending}`;
    this.cursor.visible = true;
    this.cursor.position.set(x, PLATE_TOP + 0.005, y);
    if (key === this.ghostKey) return;
    this.hideGhost();
    this.cursor.visible = true;
    this.ghost = this.makeMesh(tile, rot, x, y, pending ? this.pendingMaterial : this.ghostMaterial);
    this.ghost.position.y = 0.06;
    this.ghost.castShadow = pending;
    this.ghostPending = pending;
    this.scene.add(this.ghost);
    this.ghostKey = key;
  }

  hideGhost(): void {
    this.cursor.visible = false;
    if (!this.ghost) return;
    this.scene.remove(this.ghost);
    this.ghost.geometry.dispose();
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
      if (t >= 1) this.drops.splice(i, 1);
    }
    if (Math.abs(this.targetViewHeight - this.viewHeight) > 0.005) {
      this.viewHeight += (this.targetViewHeight - this.viewHeight) * 0.06;
      this.updateFrustum();
    }
    if (this.ghost && this.ghostPending) this.ghost.position.y = 0.16 + Math.sin(now / 260) * 0.03;
    this.controls.update();
    const tgt = this.controls.target;
    this.sun.position.set(tgt.x + 8, 16, tgt.z + 5);
    this.sun.target.position.copy(tgt);
    this.renderer.render(this.scene, this.camera);
  }
}

function easeOutBounce(t: number): number {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}
