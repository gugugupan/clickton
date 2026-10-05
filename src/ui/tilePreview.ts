import { LANDMARK_EMOJI } from "../core/landmarks";
import { DX, DY, type Rot, type TileDef } from "../core/tiles";
import { DEFAULT_LOOK, type Look } from "../render/looks";
import { PALETTE } from "../render/palette";
import { citySlots } from "../render/tileMeshes";

const CELL = 0.92 / 3;
const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

const STRIP: Record<string, { color: number; width: number }> = {
  road: { color: PALETTE.road, width: 0.3 },
  rail: { color: PALETTE.ballast, width: 0.24 },
  water: { color: PALETTE.water, width: 0.38 },
};

export function drawTilePreview(canvas: HTMLCanvasElement, tile: TileDef, rot: Rot, look: Look = DEFAULT_LOOK): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 72;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr * size, 0, 0, dpr * size, (dpr * size) / 2, (dpr * size) / 2);
  g.rotate((rot * Math.PI) / 2);
  g.clearRect(-0.5, -0.5, 1, 1);

  g.fillStyle = css(look.grass);
  g.beginPath();
  g.roundRect(-0.46, -0.46, 0.92, 0.92, 0.08);
  g.fill();
  g.clip();

  for (const grp of tile.groups) {
    if (grp.type === "city") {
      g.fillStyle = css(PALETTE.walls[0]);
      for (const [sx, sy] of citySlots(grp.dirs)) g.fillRect(sx * CELL - CELL / 2 - 0.005, sy * CELL - CELL / 2 - 0.005, CELL + 0.01, CELL + 0.01);
      continue;
    }
    const s = STRIP[grp.type];
    g.strokeStyle = css(grp.type === "water" ? look.water : s.color);
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
      g.fillStyle = css(look.water);
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
  if (tile.special === "zoo" || tile.special === "farm") {
    g.strokeStyle = css(PALETTE.trunk);
    g.lineWidth = 0.03;
    g.strokeRect(-0.38, -0.38, 0.76, tile.special === "zoo" ? 0.62 : 0.76);
    g.fillStyle = css(tile.special === "zoo" ? PALETTE.bufferStop : PALETTE.barn);
    g.fillRect(tile.special === "zoo" ? -0.14 : -0.32, tile.special === "zoo" ? 0.2 : -0.32, 0.28, tile.special === "zoo" ? 0.06 : 0.2);
    if (tile.special === "farm") {
      g.fillStyle = css(PALETTE.hay);
      g.fillRect(0.12, -0.32, 0.2, 0.1);
    }
  }
  if (tile.special === "police") {
    g.fillStyle = css(PALETTE.walls[2]);
    g.fillRect(-0.2, -0.36, 0.4, 0.36);
    g.fillStyle = css(PALETTE.paving);
    g.fillRect(0.14, 0.12, 0.18, 0.1);
  }
  if (tile.special === "beach") {
    g.fillStyle = css(PALETTE.sand);
    g.fillRect(-0.46, -0.46, 0.92, 0.92);
    g.fillStyle = css(PALETTE.walls[0]);
    g.beginPath();
    g.arc(-0.15, -0.12, 0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(PALETTE.walls[2]);
    g.beginPath();
    g.arc(0.18, 0.15, 0.12, 0, Math.PI * 2);
    g.fill();
  }
  if (tile.deadEnd) {
    g.fillStyle = css(PALETTE.road);
    g.beginPath();
    g.arc(0, 0, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(look.grass);
    g.beginPath();
    g.arc(0, 0, 0.075, 0, Math.PI * 2);
    g.fill();
  }
  if (tile.pool) {
    g.fillStyle = css(PALETTE.platform);
    g.beginPath();
    g.arc(0, 0, 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(look.water);
    g.beginPath();
    g.arc(0, 0, 0.23, 0, Math.PI * 2);
    g.fill();
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
  if (tile.landmark) {
    g.fillStyle = "rgba(255, 250, 242, 0.85)";
    g.beginPath();
    g.arc(0, 0, 0.26, 0, Math.PI * 2);
    g.fill();
    g.setTransform(dpr, 0, 0, dpr, (dpr * size) / 2, (dpr * size) / 2);
    g.font = `${Math.round(size * 0.32)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(LANDMARK_EMOJI[tile.landmark], 0, size * 0.02);
  }
}
