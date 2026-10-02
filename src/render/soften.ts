import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from "three";

const cache = new Map<Texture, Texture>();

export function soften(tex: Texture): Texture {
  const cached = cache.get(tex);
  if (cached) return cached;
  const img = tex.image as HTMLImageElement | ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
    px[i] = Math.min(255, (r * 0.62 + lum * 0.38) * 0.78 + 246 * 0.22);
    px[i + 1] = Math.min(255, (gg * 0.62 + lum * 0.38) * 0.78 + 241 * 0.22);
    px[i + 2] = Math.min(255, (b * 0.62 + lum * 0.38) * 0.78 + 233 * 0.22);
  }
  g.putImageData(data, 0, 0);
  const soft = new CanvasTexture(canvas);
  soft.flipY = tex.flipY;
  soft.colorSpace = SRGBColorSpace;
  soft.magFilter = tex.magFilter;
  soft.minFilter = tex.minFilter;
  cache.set(tex, soft);
  return soft;
}

function tintCanvas(img: CanvasImageSource & { width: number; height: number }, hex: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const tr = parseInt(hex.slice(1, 3), 16), tg = parseInt(hex.slice(3, 5), 16), tb = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < px.length; i += 4) {
    const lum = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
    const w = Math.max(0, Math.min(1, (0.62 - lum) / 0.35));
    const shade = 0.98 + lum * 0.15;
    px[i] = px[i] * (1 - w) + tr * shade * w;
    px[i + 1] = px[i + 1] * (1 - w) + tg * shade * w;
    px[i + 2] = px[i + 2] * (1 - w) + tb * shade * w;
  }
  g.putImageData(data, 0, 0);
  return canvas;
}

function asTexture(canvas: HTMLCanvasElement, like: Texture, mipmaps = true): Texture {
  const out = new CanvasTexture(canvas);
  out.flipY = like.flipY;
  out.colorSpace = SRGBColorSpace;
  out.magFilter = like.magFilter;
  out.minFilter = mipmaps ? like.minFilter : LinearFilter;
  out.generateMipmaps = mipmaps;
  return out;
}

export function tintDark(tex: Texture, hex: string): Texture {
  return asTexture(tintCanvas(tex.image as HTMLCanvasElement, hex), tex);
}

export function variantAtlas(tex: Texture, tints: readonly string[]): Texture {
  const img = tex.image as HTMLCanvasElement;
  const rows = [img as CanvasImageSource, ...tints.map((t) => tintCanvas(img, t))];
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height * rows.length;
  const g = canvas.getContext("2d")!;
  rows.forEach((row, i) => g.drawImage(row, 0, img.height * i));
  return asTexture(canvas, tex, false);
}
