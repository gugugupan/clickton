import { DX, DY, type Rot, type TileDef } from "../core/tiles";
import { PALETTE } from "../render/palette";

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

const STRIP: Record<string, { color: number; width: number }> = {
  road: { color: PALETTE.road, width: 0.3 },
  rail: { color: PALETTE.ballast, width: 0.24 },
  water: { color: PALETTE.water, width: 0.38 },
};

export function drawTilePreview(canvas: HTMLCanvasElement, tile: TileDef, rot: Rot): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 72;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr * size, 0, 0, dpr * size, (dpr * size) / 2, (dpr * size) / 2);
  g.rotate((rot * Math.PI) / 2);
  g.clearRect(-0.5, -0.5, 1, 1);

  g.fillStyle = css(PALETTE.grass);
  g.beginPath();
  g.roundRect(-0.46, -0.46, 0.92, 0.92, 0.08);
  g.fill();
  g.clip();

  for (const grp of tile.groups) {
    if (grp.type === "city") {
      g.fillStyle = css(PALETTE.walls[0]);
      for (const d of grp.dirs) {
        if (DX[d] === 0) g.fillRect(-0.46, DY[d] < 0 ? -0.46 : 0.16, 0.92, 0.3);
        else g.fillRect(DX[d] < 0 ? -0.46 : 0.16, -0.46, 0.3, 0.92);
      }
      if (grp.dirs.length >= 2) g.fillRect(-0.18, -0.18, 0.36, 0.36);
      continue;
    }
    const s = STRIP[grp.type];
    g.strokeStyle = css(s.color);
    g.lineWidth = s.width;
    g.lineCap = "butt";
    const [a, b] = grp.dirs;
    g.beginPath();
    if (grp.dirs.length === 2 && (a + 2) % 4 !== b) {
      const cx = (DX[a] + DX[b]) * 0.5, cy = (DY[a] + DY[b]) * 0.5;
      const a0 = Math.atan2(DY[a] * 0.5 - cy, DX[a] * 0.5 - cx);
      const a1 = Math.atan2(DY[b] * 0.5 - cy, DX[b] * 0.5 - cx);
      const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
      g.arc(cx, cy, 0.5, a0, a1, delta < 0);
    } else {
      for (const d of grp.dirs) {
        g.moveTo(DX[d] * 0.46, DY[d] * 0.46);
        g.lineTo(0, 0);
      }
    }
    g.stroke();
    if (grp.type === "water" && grp.dirs.length === 1) {
      g.fillStyle = css(PALETTE.water);
      g.beginPath();
      g.arc(0, 0, 0.22, 0, Math.PI * 2);
      g.fill();
    }
    if (grp.type === "rail") {
      g.strokeStyle = css(PALETTE.rail);
      g.lineWidth = 0.03;
      g.setLineDash([0.03, 0.05]);
      g.stroke();
      g.setLineDash([]);
    }
  }

  if (tile.station) {
    g.fillStyle = css(PALETTE.platform);
    g.fillRect(-0.32, -0.46, 0.14, 0.56);
    g.fillStyle = css(PALETTE.bufferStop);
    g.fillRect(-0.08, 0.06, 0.16, 0.06);
  }
  if (tile.halt) {
    g.fillStyle = css(PALETTE.platform);
    g.fillRect(-0.32, -0.46, 0.14, 0.92);
    g.fillStyle = css(PALETTE.walls[3]);
    g.fillRect(0.17, -0.15, 0.2, 0.3);
    g.fillStyle = css(PALETTE.roofs[1]);
    g.fillRect(0.17, -0.15, 0.2, 0.08);
  }
  if (tile.house) {
    g.fillStyle = css(PALETTE.walls[1]);
    g.fillRect(-0.14, -0.46, 0.28, 0.3);
    g.fillStyle = css(PALETTE.roofs[0]);
    g.fillRect(-0.14, -0.46, 0.28, 0.1);
  }
}
