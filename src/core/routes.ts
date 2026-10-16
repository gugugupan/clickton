import type { Board, Placed } from "./board";
import { hasRoad, roadExits } from "./networks";
import { DIRS, DX, DY } from "./tiles";

export type Errand = "work" | "school" | "shop" | "park" | "shrine" | "pier" | "farm" | "visit" | "stroll";
export type Role = "commuter" | "student" | "farmer" | "shopper" | "stroller";

export interface Cell {
  x: number;
  y: number;
}

export interface Destination extends Cell {
  errand: Errand;
}

const SHOPS = new Set(["city_street", "city_full", "city_three", "city_road"]);
const LEISURE: Errand[] = ["park", "shrine", "pier"];

export const ROLE_ERRANDS: Record<Role, Errand[]> = {
  commuter: ["work"],
  student: ["school"],
  farmer: ["farm"],
  shopper: ["shop"],
  stroller: LEISURE,
};

export function errandOf(p: Placed): Errand | null {
  const t = p.tile;
  if (t.special === "school") return "school";
  if (t.special === "park" || t.landmark === "garden") return "park";
  if (t.special === "shrine" || t.landmark === "church") return "shrine";
  if (t.pier) return "pier";
  if (t.special === "farm" || t.key.startsWith("field")) return "farm";
  if (SHOPS.has(t.key) || t.landmark === "market" || t.landmark === "tavern") return "shop";
  if (t.station || t.special === "police" || t.special === "zoo" || t.landmark === "stage") return "work";
  return null;
}

export function destinationsOf(board: Board): Destination[] {
  const out: Destination[] = [];
  for (const p of board.all()) {
    const errand = errandOf(p);
    if (errand) out.push({ errand, x: p.x, y: p.y });
    if (errand === "shop") out.push({ errand: "work", x: p.x, y: p.y });
  }
  return out;
}

export function accessCell(board: Board, x: number, y: number): Cell | null {
  if (hasRoad(board, x, y)) return { x, y };
  for (const d of DIRS) if (hasRoad(board, x + DX[d], y + DY[d])) return { x: x + DX[d], y: y + DY[d] };
  return null;
}

export function findRoute(board: Board, from: Cell, to: Cell, limit = 400): Cell[] | null {
  const key = (c: Cell) => `${c.x},${c.y}`;
  const goal = key(to);
  const prev = new Map<string, Cell | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length && prev.size <= limit) {
    const c = queue.shift()!;
    if (key(c) === goal) {
      const path: Cell[] = [];
      for (let at: Cell | null = c; at; at = prev.get(key(at)) ?? null) path.unshift(at);
      return path;
    }
    for (const d of roadExits(board, c.x, c.y)) {
      const n = { x: c.x + DX[d], y: c.y + DY[d] };
      if (prev.has(key(n))) continue;
      prev.set(key(n), c);
      queue.push(n);
    }
  }
  return null;
}

export function rolesAvailable(dests: readonly Destination[]): Role[] {
  const has = (e: Errand) => dests.some((d) => d.errand === e);
  return (Object.keys(ROLE_ERRANDS) as Role[]).filter((r) => ROLE_ERRANDS[r].some(has));
}

export function pickRole(roll: number, dests: readonly Destination[]): Role | null {
  const roles = rolesAvailable(dests);
  if (!roles.length) return null;
  const weight: Record<Role, number> = { commuter: 3, student: 2, farmer: 1.5, shopper: 2, stroller: 1.5 };
  const total = roles.reduce((s, r) => s + weight[r], 0);
  let left = roll * total;
  for (const r of roles) if ((left -= weight[r]) < 0) return r;
  return roles[roles.length - 1];
}

export function strollRoute(board: Board, from: Cell, steps: number, rand: () => number): Cell[] {
  const route: Cell[] = [from];
  let back: number | null = null;
  for (let i = 0; i < steps; i++) {
    const c = route[route.length - 1];
    const exits = roadExits(board, c.x, c.y).filter((d) => d !== back);
    if (!exits.length) break;
    const d = exits[Math.floor(rand() * exits.length)];
    back = (d + 2) % 4;
    route.push({ x: c.x + DX[d], y: c.y + DY[d] });
  }
  return route;
}
