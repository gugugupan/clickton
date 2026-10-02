import { hash } from "./rng";

export const CHALLENGE_TILES = 60;
const JST_OFFSET = 9 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

export function todayNumber(now = Date.now()): number {
  return Math.floor((now + JST_OFFSET) / DAY);
}

export function seedForDay(day: number): number {
  return hash(day, 0xd411) >>> 0;
}

export function dayLabel(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}
