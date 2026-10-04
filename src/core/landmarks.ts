import type { Board, Placed } from "./board";
import { completedRailLines, edgeRegions, isHome, isLinkedBridge, isMeadow, isPark, isUrban, regionAt } from "./networks";
import { specialStatus } from "./specials";
import { DIRS, DX, DY, TILES, edgeOf, opposite, type Landmark } from "./tiles";

export const LANDMARKS: readonly Landmark[] = [
  "market",
  "xmas",
  "garden",
  "church",
  "lighthouse",
  "watermill",
  "stage",
  "windmill",
  "castle",
  "sports",
  "lumber",
  "gingerbread",
  "tavern",
];

export const LANDMARK_EMOJI: Record<Landmark, string> = {
  market: "🏪",
  xmas: "🎄",
  garden: "🌸",
  church: "⛪",
  lighthouse: "🗼",
  watermill: "⚙️",
  stage: "🎭",
  windmill: "🌾",
  castle: "🏰",
  sports: "⚽",
  lumber: "🪓",
  gingerbread: "🍪",
  tavern: "🍺",
};

export function landmarkTile(l: Landmark): number {
  return TILES.findIndex((t) => t.landmark === l);
}

function ring(board: Board, x: number, y: number, radius = 1): Placed[] {
  const out: Placed[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const p = board.get(x + dx, y + dy);
      if (p) out.push(p);
    }
  }
  return out;
}

function clean(board: Board, p: Placed): boolean {
  return DIRS.every((d) => {
    const theirs = board.edgeAt(p.x + DX[d], p.y + DY[d], opposite(d));
    return theirs === undefined || theirs === edgeOf(p.tile, p.rot, d);
  });
}

function regionSize(board: Board, type: "city" | "road" | "water", x: number, y: number): number {
  return regionAt(edgeRegions(board, type), x, y)?.cells.length ?? 0;
}

export function landmarkBonus(after: Board, p: Placed): number {
  const near = ring(after, p.x, p.y);
  switch (p.tile.landmark) {
    case "market":
      return near.filter(isUrban).length;
    case "xmas":
      return completedRailLines(after).length * 3;
    case "garden":
      return near.reduce((sum, n) => sum + (isPark(after, n) ? 2 : isMeadow(n) ? 1 : 0), 0);
    case "church":
    case "castle":
      return regionSize(after, "city", p.x, p.y);
    case "lighthouse":
      return regionSize(after, "water", p.x, p.y);
    case "watermill": {
      const region = regionAt(edgeRegions(after, "water"), p.x, p.y);
      return (region?.cells ?? []).filter((c) => isLinkedBridge(after, after.get(c.x, c.y)!)).length * 3;
    }
    case "stage":
      return ring(after, p.x, p.y, 2).filter((n) => n.tile.special && specialStatus(after, n).active).length * 3;
    case "windmill":
      return near.filter(isMeadow).length;
    case "sports":
      return Math.floor(regionSize(after, "road", p.x, p.y) / 5);
    case "lumber":
      return near.reduce((sum, n) => sum + (isMeadow(n) ? 1 : 0) + (n.tile.key === "grass" ? 1 : 0), 0);
    case "gingerbread":
      return near.filter((n) => clean(after, n)).length * 2;
    case "tavern": {
      const region = regionAt(edgeRegions(after, "road"), p.x, p.y);
      return (region?.cells ?? []).filter((c) => isHome(after.get(c.x, c.y)!)).length;
    }
    default:
      return 0;
  }
}
