import { Board, type Placed } from "./board";
import { DIRS, DX, DY, groupsOf, opposite, type Dir } from "./tiles";

export interface RailStep {
  x: number;
  y: number;
  from: Dir | null;
  to: Dir | null;
}

export interface RailLine {
  key: string;
  loop: boolean;
  halts: number;
  steps: RailStep[];
}

interface RailNode {
  x: number;
  y: number;
  dirs: Dir[];
  station: boolean;
}

const nodeKey = (x: number, y: number, d: Dir) => `${x},${y},${d}`;

function railNodes(p: Placed): RailNode[] {
  return groupsOf(p.tile, p.rot)
    .filter((g) => g.type === "rail")
    .map((g) => ({ x: p.x, y: p.y, dirs: g.dirs, station: !!p.tile.station }));
}

function nodeAt(board: Board, x: number, y: number, d: Dir): RailNode | undefined {
  const p = board.get(x, y);
  return p && railNodes(p).find((n) => n.dirs.includes(d));
}

function across(board: Board, n: RailNode, d: Dir): RailNode | undefined {
  const nx = n.x + DX[d], ny = n.y + DY[d];
  return nodeAt(board, nx, ny, opposite(d));
}

export function completedRailLines(board: Board): RailLine[] {
  const seen = new Set<string>();
  const lines: RailLine[] = [];
  const placed = [...board.all()].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of placed) {
    for (const start of railNodes(p)) {
      if (seen.has(nodeKey(start.x, start.y, start.dirs[0]))) continue;
      const component: RailNode[] = [];
      const stack = [start];
      let open = false;
      const mark = (n: RailNode) => n.dirs.forEach((d) => seen.add(nodeKey(n.x, n.y, d)));
      mark(start);
      while (stack.length) {
        const n = stack.pop()!;
        component.push(n);
        for (const d of n.dirs) {
          const m = across(board, n, d);
          if (!m) {
            open = true;
            continue;
          }
          if (seen.has(nodeKey(m.x, m.y, m.dirs[0]))) continue;
          mark(m);
          stack.push(m);
        }
      }
      if (open) continue;
      const line = orderLine(board, component);
      if (line) lines.push(line);
    }
  }
  return lines;
}

function orderLine(board: Board, component: RailNode[]): RailLine | null {
  const stations = component.filter((n) => n.station);
  if (stations.length !== 0 && stations.length !== 2) return null;
  const loop = stations.length === 0;
  const first = loop ? component.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a)) : stations[0];
  const steps: RailStep[] = [];
  let node = first;
  let from: Dir | null = loop ? first.dirs[1] : null;
  for (let guard = 0; guard <= component.length; guard++) {
    const to = node.dirs.find((d) => d !== from) ?? null;
    const exit = node.station && from !== null ? null : to;
    steps.push({ x: node.x, y: node.y, from, to: exit });
    if (exit === null) break;
    const next = across(board, node, exit)!;
    if (loop && next.x === first.x && next.y === first.y && next.dirs[0] === first.dirs[0]) break;
    from = opposite(exit);
    node = next;
  }
  const a = steps[0], b = steps[steps.length - 1];
  const halts = steps.filter((st) => board.get(st.x, st.y)?.tile.halt).length;
  return { key: `${loop ? "loop" : "line"}:${a.x},${a.y}:${b.x},${b.y}:${steps.length}`, loop, halts, steps };
}

export function roadExits(board: Board, x: number, y: number): Dir[] {
  const p = board.get(x, y);
  if (!p) return [];
  const roads = groupsOf(p.tile, p.rot).filter((g) => g.type === "road");
  const exits: Dir[] = [];
  for (const g of roads) {
    for (const d of g.dirs) {
      if (board.edgeAt(x + DX[d], y + DY[d], opposite(d)) === "road") exits.push(d);
    }
  }
  return exits;
}

export function hasRoad(board: Board, x: number, y: number): boolean {
  const p = board.get(x, y);
  return !!p && p.tile.groups.some((g) => g.type === "road");
}

export function isHome(p: Placed): boolean {
  return !p.tile.special && !p.tile.landmark && (!!p.tile.house || p.tile.edges.includes("city"));
}

export function isMeadow(p: Placed): boolean {
  return (
    p.tile.edges.filter((e) => e === "grass").length >= 3 &&
    !p.tile.house &&
    !p.tile.station &&
    !p.tile.special &&
    !p.tile.landmark &&
    p.tile.groups.every((g) => g.type === "water")
  );
}

export function isPond(p: Placed): boolean {
  return p.tile.key === "lake" || !!p.tile.pool;
}

export function grassExits(board: Board, x: number, y: number): Dir[] {
  return DIRS.filter((d) => {
    const n = board.get(x + DX[d], y + DY[d]);
    return board.edgeAt(x, y, d) === "grass" && n !== undefined && isMeadow(n) && board.edgeAt(n.x, n.y, opposite(d)) === "grass";
  });
}

export interface RoadNetwork {
  key: string;
  cells: { x: number; y: number }[];
}

export function completedRoadNetworks(board: Board): RoadNetwork[] {
  const seen = new Set<string>();
  const networks: RoadNetwork[] = [];
  const placed = [...board.all()].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of placed) {
    if (!hasRoad(board, p.x, p.y) || seen.has(`${p.x},${p.y}`)) continue;
    const cells: { x: number; y: number }[] = [];
    const stack = [{ x: p.x, y: p.y }];
    seen.add(`${p.x},${p.y}`);
    let open = false;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const q = board.get(c.x, c.y)!;
      for (const g of groupsOf(q.tile, q.rot).filter((g) => g.type === "road")) {
        for (const d of g.dirs) {
          const nx = c.x + DX[d], ny = c.y + DY[d];
          if (board.edgeAt(nx, ny, opposite(d)) !== "road") {
            open = true;
            continue;
          }
          const k = `${nx},${ny}`;
          if (seen.has(k)) continue;
          seen.add(k);
          stack.push({ x: nx, y: ny });
        }
      }
    }
    if (open) continue;
    cells.sort((a, b) => a.y - b.y || a.x - b.x);
    networks.push({ key: `road:${cells[0].x},${cells[0].y}:${cells.length}`, cells });
  }
  return networks;
}

export interface Region {
  key: string;
  closed: boolean;
  cells: { x: number; y: number }[];
}

export function edgeRegions(board: Board, type: "city" | "road" | "water" | "forest" | "field"): Region[] {
  const seen = new Set<string>();
  const regions: Region[] = [];
  const placed = [...board.all()].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of placed) {
    if (!p.tile.groups.some((g) => g.type === type) || seen.has(`${p.x},${p.y}`)) continue;
    const cells: { x: number; y: number }[] = [];
    const stack = [{ x: p.x, y: p.y }];
    seen.add(`${p.x},${p.y}`);
    let closed = true;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      const q = board.get(c.x, c.y)!;
      for (const g of groupsOf(q.tile, q.rot).filter((g) => g.type === type)) {
        for (const d of g.dirs) {
          const nx = c.x + DX[d], ny = c.y + DY[d];
          if (board.edgeAt(nx, ny, opposite(d)) !== type) {
            closed = false;
            continue;
          }
          const k = `${nx},${ny}`;
          if (seen.has(k)) continue;
          seen.add(k);
          stack.push({ x: nx, y: ny });
        }
      }
    }
    cells.sort((a, b) => a.y - b.y || a.x - b.x);
    regions.push({ key: `${type}:${cells[0].x},${cells[0].y}:${cells.length}`, closed, cells });
  }
  return regions;
}

export function regionAt(regions: readonly Region[], x: number, y: number): Region | undefined {
  return regions.find((r) => r.cells.some((c) => c.x === x && c.y === y));
}

export function meadowRegions(board: Board): { x: number; y: number }[][] {
  const seen = new Set<string>();
  const out: { x: number; y: number }[][] = [];
  for (const p of board.all()) {
    if (!isMeadow(p) || seen.has(`${p.x},${p.y}`)) continue;
    const cells: { x: number; y: number }[] = [];
    const stack = [{ x: p.x, y: p.y }];
    seen.add(`${p.x},${p.y}`);
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const d of grassExits(board, c.x, c.y)) {
        const k = `${c.x + DX[d]},${c.y + DY[d]}`;
        if (seen.has(k)) continue;
        seen.add(k);
        stack.push({ x: c.x + DX[d], y: c.y + DY[d] });
      }
    }
    out.push(cells);
  }
  return out;
}

export function isUrban(p: Placed | undefined): boolean {
  return !!p && (p.tile.edges.includes("city") || !!p.tile.house);
}

export function isPark(board: Board, p: Placed): boolean {
  if (!isMeadow(p) || p.tile.edges.some((e) => e !== "grass")) return false;
  const around = DIRS.map((d) => board.get(p.x + DX[d], p.y + DY[d]));
  return around.every((n) => n) && around.filter(isUrban).length >= 3;
}

export function isLinkedBridge(board: Board, p: Placed): boolean {
  if (!p.tile.key.endsWith("_bridge")) return false;
  return groupsOf(p.tile, p.rot)
    .filter((g) => g.type !== "water")
    .every((g) => g.dirs.every((d) => board.edgeAt(p.x + DX[d], p.y + DY[d], opposite(d)) === g.type));
}

export function riverReach(board: Board): number {
  let best = 0;
  for (const r of edgeRegions(board, "water")) {
    const tiles = r.cells.map((c) => board.get(c.x, c.y)!);
    if (!tiles.some((t) => t.tile.key === "lake" || t.tile.landmark === "lighthouse")) continue;
    best = Math.max(best, tiles.filter((t) => t.tile.groups.some((g) => g.type === "water" && g.dirs.length === 2)).length);
  }
  return best;
}
