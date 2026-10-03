let ctx: AudioContext | null = null;
let sfx: GainNode | null = null;

const SFX_VOLUME = 0.6;

export function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    sfx = ctx.createGain();
    sfx.gain.value = SFX_VOLUME;
    sfx.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function bubble(ac: AudioContext, at: number, from: number, to: number, volume: number, length: number): void {
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.6);
  const soft = ac.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 1800;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(soft).connect(gain).connect(sfx!);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function playPlace(scored: boolean): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const base = scored ? 1 : 0.75;
  bubble(ac, now, 260 * base, 620 * base, 0.32, 0.13);
  bubble(ac, now + 0.07, 380 * base, 880 * base, 0.18, 0.1);
}

export function playPop(): void {
  const ac = audio();
  if (!ac) return;
  bubble(ac, ac.currentTime, 520, 1100, 0.12, 0.07);
}

export function playChime(): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  [523, 659, 784].forEach((f, i) => bubble(ac, now + i * 0.11, f * 0.8, f, 0.16, 0.18));
}
