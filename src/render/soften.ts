import { CanvasTexture, SRGBColorSpace, type Texture } from "three";

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
