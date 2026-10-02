import { packCity, unpackCity, type SavedCity } from "./core/codec";
import type { Game } from "./core/game";

const TOWN_KEY = "clickton.save";
const DAILY_KEY = "clickton.daily";

export function saveLocal(game: Game): void {
  if (game.explicit) return;
  try {
    const bytes = packCity({ version: game.linkVersion, seed: game.seed, moves: game.moves, day: game.day });
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    localStorage.setItem(game.challenge ? DAILY_KEY : TOWN_KEY, btoa(s));
  } catch {}
}

export function loadLocal(kind: "town" | "daily" = "town"): SavedCity | null {
  try {
    const raw = localStorage.getItem(kind === "daily" ? DAILY_KEY : TOWN_KEY);
    if (!raw) return null;
    return unpackCity(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function bestScore(day: number): number {
  try {
    return Number(localStorage.getItem(`clickton.daily.best.${day}`)) || 0;
  } catch {
    return 0;
  }
}

export function recordScore(day: number, score: number): number {
  const best = Math.max(bestScore(day), score);
  try {
    localStorage.setItem(`clickton.daily.best.${day}`, String(best));
  } catch {}
  return best;
}
