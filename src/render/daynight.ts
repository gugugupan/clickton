export const CYCLE_SECONDS = 240;

export interface SkyState {
  daylight: number;
  dusk: number;
}

const DAY_END = 0.6;
const DUSK_END = 0.7;
const NIGHT_END = 0.95;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function skyAt(phase: number): SkyState {
  const t = ((phase % 1) + 1) % 1;
  if (t < DAY_END) return { daylight: 1, dusk: t < 0.05 ? 1 - t / 0.05 : 0 };
  if (t < DUSK_END) {
    const k = (t - DAY_END) / (DUSK_END - DAY_END);
    return { daylight: 1 - smooth(k), dusk: Math.sin(Math.PI * k) };
  }
  if (t < NIGHT_END) return { daylight: 0, dusk: 0 };
  const k = (t - NIGHT_END) / (1 - NIGHT_END);
  return { daylight: smooth(k), dusk: Math.sin(Math.PI * k) * 0.8 };
}

export class DayNight {
  phase = 0.12;

  update(dt: number): SkyState {
    this.phase = (this.phase + dt / CYCLE_SECONDS) % 1;
    return skyAt(this.phase);
  }
}
