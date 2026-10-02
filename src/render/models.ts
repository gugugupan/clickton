import { Box3, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import catalog from "./assets.json";
import { soften, tintDark, variantAtlas } from "./soften";

export type ModelKey = keyof typeof catalog.models;
export type PackKey = keyof typeof catalog.packs;
export type MaterialMode = "solid" | "ghost" | "pending";

export interface Prop {
  model: ModelKey;
  x: number;
  z: number;
  y?: number;
  rotY: number;
  fit?: number;
  height?: number;
  maxHeight?: number;
  size?: { x: number; y: number; z: number };
  variant?: number;
}

export const BUILDING_TINTS = ["#e0a193", "#edd39b", "#9dbbd1", "#a9c89b", "#c9b8d6", "#b9aea4"] as const;
export const BUILDING_VARIANTS = BUILDING_TINTS.length + 1;

interface Model {
  pack: string;
  geometry: BufferGeometry;
  size: Vector3;
}

const MODES: Record<MaterialMode, { opacity: number; transparent: boolean }> = {
  solid: { opacity: 1, transparent: false },
  ghost: { opacity: 0.6, transparent: true },
  pending: { opacity: 0.92, transparent: true },
};

export class ModelLibrary {
  private readonly models = new Map<ModelKey, Model>();
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly textures = new Map<string, Texture>();
  private readonly atlasRows = new Map<string, number>();

  async load(onProgress: (done: number, total: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    const entries = Object.entries(catalog.models) as [ModelKey, { pack: PackKey; file: string; tint?: string }][];
    let done = 0;
    await Promise.all(
      entries.map(async ([key, def]) => {
        const url = `${import.meta.env.BASE_URL}models/${def.pack}/${def.file.split("/").pop()}`;
        const gltf = await loader.loadAsync(url);
        gltf.scene.updateMatrixWorld(true);
        const group = def.tint ? `${def.pack}${def.tint}` : def.pack;
        const parts: BufferGeometry[] = [];
        gltf.scene.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
          if (mat.map && !this.textures.has(group)) {
            const pack = catalog.packs[def.pack];
            const base = pack.soft ? soften(mat.map) : mat.map;
            if (def.tint) this.textures.set(group, tintDark(base, def.tint));
            else if ("variants" in pack && pack.variants) {
              this.textures.set(group, variantAtlas(base, BUILDING_TINTS));
              this.atlasRows.set(group, BUILDING_VARIANTS);
            } else this.textures.set(group, base);
          }
          const g = new BufferGeometry();
          for (const name of ["position", "normal", "uv"]) {
            const attr = m.geometry.getAttribute(name);
            if (attr) g.setAttribute(name, attr);
          }
          const index = m.geometry.getIndex();
          if (index) g.setIndex(index);
          const flat = index ? g.toNonIndexed() : g;
          flat.applyMatrix4(m.matrixWorld);
          parts.push(flat);
        });
        const geometry = mergeGeometries(parts, false);
        if (!geometry) throw new Error(`failed to merge model ${key}`);
        const box = new Box3().setFromBufferAttribute(geometry.getAttribute("position") as never);
        const center = box.getCenter(new Vector3());
        geometry.translate(-center.x, -box.min.y, -center.z);
        this.models.set(key, { pack: group, geometry, size: box.getSize(new Vector3()) });
        onProgress(++done, entries.length);
      }),
    );
  }

  size(key: ModelKey): Vector3 | undefined {
    return this.models.get(key)?.size;
  }

  material(pack: string, mode: MaterialMode): MeshStandardMaterial {
    const id = `${pack}:${mode}`;
    let mat = this.materials.get(id);
    if (!mat) {
      const { opacity, transparent } = MODES[mode];
      mat = new MeshStandardMaterial({
        map: this.textures.get(pack) ?? null,
        roughness: 0.85,
        metalness: 0,
        transparent,
        opacity,
        depthWrite: mode !== "ghost",
      });
      this.materials.set(id, mat);
    }
    return mat;
  }

  buildProps(props: readonly Prop[], mode: MaterialMode): Mesh[] {
    const byPack = new Map<string, BufferGeometry[]>();
    const m = new Matrix4();
    for (const p of props) {
      const model = this.models.get(p.model);
      if (!model) continue;
      let scale = p.height ? p.height / model.size.y : (p.fit ?? 0.3) / Math.max(model.size.x, model.size.z);
      if (p.maxHeight) scale = Math.min(scale, p.maxHeight / model.size.y);
      const g = model.geometry.clone();
      const rows = this.atlasRows.get(model.pack);
      if (rows) {
        const uv = g.getAttribute("uv");
        const row = Math.min(rows - 1, Math.max(0, p.variant ?? 0));
        for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + row) / rows);
      }
      if (p.size) g.scale(p.size.x / model.size.x, p.size.y / model.size.y, p.size.z / model.size.z);
      g.applyMatrix4(m.makeRotationY(p.rotY));
      if (!p.size) g.scale(scale, scale, scale);
      g.translate(p.x, p.y ?? 0, p.z);
      const list = byPack.get(model.pack) ?? [];
      list.push(g);
      byPack.set(model.pack, list);
    }
    const meshes: Mesh[] = [];
    for (const [pack, list] of byPack) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new Mesh(merged, this.material(pack, mode));
      mesh.castShadow = mode !== "ghost";
      mesh.receiveShadow = mode === "solid";
      meshes.push(mesh);
    }
    return meshes;
  }
}
