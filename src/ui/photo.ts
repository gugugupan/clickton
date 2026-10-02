export interface PhotoCaption {
  title: string;
  subtitle: string;
  stats: string;
}

export function framePhoto(shot: HTMLCanvasElement, caption: PhotoCaption): HTMLCanvasElement {
  const pad = Math.round(shot.width * 0.025);
  const band = Math.round(Math.max(64, shot.height * 0.09));
  const out = document.createElement("canvas");
  out.width = shot.width;
  out.height = shot.height + band;
  const g = out.getContext("2d")!;
  g.fillStyle = "#f6f1e9";
  g.fillRect(0, 0, out.width, out.height);
  g.drawImage(shot, 0, 0);
  const y = shot.height + band / 2;
  const big = Math.round(band * 0.36);
  const small = Math.round(band * 0.22);
  g.textBaseline = "middle";
  g.fillStyle = "#5e534b";
  g.font = `600 ${big}px Fredoka, "M PLUS Rounded 1c", "Noto Sans SC", sans-serif`;
  g.fillText("Click", pad, y);
  const clickW = g.measureText("Click").width;
  const dot = big * 0.25;
  g.fillStyle = "#e0a193";
  g.beginPath();
  g.arc(pad + clickW + dot * 1.4, y + big * 0.05, dot, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5e534b";
  g.fillText("ton", pad + clickW + dot * 2.8, y);
  const logoW = clickW + dot * 2.8 + g.measureText("ton").width;
  g.font = `600 ${small * 1.15}px Fredoka, Nunito, sans-serif`;
  const statsW = g.measureText(caption.stats).width;
  g.textAlign = "right";
  g.fillStyle = "#5e534b";
  g.fillText(caption.stats, out.width - pad, y);
  g.textAlign = "left";
  g.fillStyle = "#8f837a";
  const room = out.width - pad * 4 - logoW - statsW;
  fitText(g, `${caption.title} · ${caption.subtitle}`, room, small, pad * 2 + logoW, y);
  return out;
}

function fitText(g: CanvasRenderingContext2D, text: string, room: number, size: number, x: number, y: number): void {
  const font = (px: number) => `500 ${px}px Nunito, "M PLUS Rounded 1c", "Noto Sans SC", sans-serif`;
  g.font = font(size);
  const w = g.measureText(text).width;
  if (w > room) g.font = font(Math.max(size * 0.7, (size * room) / w));
  let s = text;
  while (s.length > 1 && g.measureText(s).width > room) s = s.slice(0, -2) + "…";
  g.fillText(s, x, y);
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
