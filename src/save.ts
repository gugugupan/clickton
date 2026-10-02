import { packCity, unpackCity, type SavedCity } from "./core/codec";
import type { Game } from "./core/game";

const KEY = "clickton.save";

export function saveLocal(game: Game): void {
  try {
    const bytes = packCity({ version: game.linkVersion, seed: game.seed, moves: game.moves });
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    localStorage.setItem(KEY, btoa(s));
  } catch {}
}

export function loadLocal(): SavedCity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return unpackCity(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
