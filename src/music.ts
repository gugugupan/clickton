import { audio } from "./audio";

const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const BEAT = 0.42;
const VOLUME = 0.15;
const KEY = "clickton.music";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

interface Bus {
  ac: AudioContext;
  master: GainNode;
  duck: GainNode;
  dry: AudioNode;
  reverb: ConvolverNode;
}

let bus: Bus | null = null;
let timer = 0;
let step = 0;
let next = 0;
let daylight = 1;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function makeBus(): Bus | null {
  if (bus) return bus;
  const ac = audio();
  if (!ac) return null;
  const master = ac.createGain();
  master.gain.value = 0;
  const duck = ac.createGain();
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;
  duck.connect(master).connect(lp).connect(ac.destination);
  const reverb = ac.createConvolver();
  const len = ac.sampleRate * 3.2;
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  reverb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.42;
  reverb.connect(wet).connect(duck);
  bus = { ac, master, duck, dry: duck, reverb };
  return bus;
}

function voice(b: Bus): GainNode {
  const g = b.ac.createGain();
  g.connect(b.dry);
  g.connect(b.reverb);
  return g;
}

function mallet(b: Bus, at: number, midi: number): void {
  const out = voice(b);
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.13, at + 0.005);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
  const filt = b.ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 3200;
  filt.connect(out);
  for (const [mult, amp] of [
    [1, 1],
    [4, 0.18],
    [9.8, 0.04],
  ]) {
    const o = b.ac.createOscillator();
    o.frequency.value = hz(midi) * mult;
    const g = b.ac.createGain();
    g.gain.value = amp;
    o.connect(g).connect(filt);
    o.start(at);
    o.stop(at + 0.75);
  }
}

function pad(b: Bus, at: number, chord: number[], len: number, night: boolean): void {
  const out = voice(b);
  out.gain.setValueAtTime(0.0001, at);
  out.gain.linearRampToValueAtTime(night ? 0.03 : 0.045, at + len * 0.35);
  out.gain.linearRampToValueAtTime(0.0001, at + len);
  const filt = b.ac.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = night ? 600 : 1000;
  filt.Q.value = 0.3;
  filt.connect(out);
  for (const m of chord) {
    for (const detune of [-7, 7]) {
      const o = b.ac.createOscillator();
      o.type = "triangle";
      o.frequency.value = hz(m - 12);
      o.detune.value = detune;
      o.connect(filt);
      o.start(at);
      o.stop(at + len + 0.1);
    }
  }
}

function play(b: Bus, at: number, n: number): void {
  const night = daylight < 0.5;
  const chord = CHORDS[Math.floor(n / 16) % CHORDS.length];
  if (n % 16 === 0) pad(b, at, chord, BEAT * 16 * (night ? 1.25 : 1), night);
  if (n % 2 === 0 && Math.random() < 0.35 + 0.3 * daylight) {
    const midi = Math.random() < 0.55 ? pick(chord) + 12 : 72 + pick(PENTA);
    mallet(b, at, midi - (night ? 12 : 0));
  }
}

export interface Ambience {
  cars: number;
  trains: number;
  animals: number;
  water: number;
  grass: number;
}

type AmbientKind = keyof Ambience;

let ambience: Ambience = { cars: 0, trains: 0, animals: 0, water: 0, grass: 0 };
const nextAmbient: Record<AmbientKind, number> = { cars: 0, trains: 0, animals: 0, water: 0, grass: 0 };
const AMBIENT_GAP: Record<AmbientKind, number> = { cars: 16, trains: 26, animals: 20, water: 22, grass: 12 };

export function setAmbience(value: Ambience): void {
  ambience = value;
}

function noise(b: Bus, at: number, len: number, vol: number, freq: number, q: number, out: AudioNode = b.dry): void {
  const buf = b.ac.createBuffer(1, Math.ceil(b.ac.sampleRate * len), b.ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = b.ac.createBufferSource();
  src.buffer = buf;
  const bp = b.ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = b.ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + len * 0.4);
  g.gain.linearRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(out);
  src.start(at);
}

function chirp(b: Bus, at: number, from: number, to: number, len: number, vol: number, type: OscillatorType = "sine"): void {
  const o = b.ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + len);
  const lp = b.ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const g = voice(b);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.03, len / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(lp).connect(g);
  o.start(at);
  o.stop(at + len + 0.05);
}

function pan(b: Bus, from: number, to: number, at: number, len: number): StereoPannerNode {
  const p = b.ac.createStereoPanner();
  p.pan.setValueAtTime(from, at);
  p.pan.linearRampToValueAtTime(to, at + len);
  p.connect(b.dry);
  return p;
}

const AMBIENT: Record<AmbientKind, (b: Bus, at: number) => void> = {
  cars(b, at) {
    if (Math.random() < 0.5) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      noise(b, at, 2.4, 0.05, 420, 0.7, pan(b, -0.8 * dir, 0.8 * dir, at, 2.4));
    } else {
      for (const dt of [0, 0.22]) chirp(b, at + dt, 470, 460, 0.14, 0.03, "triangle");
    }
  },
  trains(b, at) {
    for (const [dt, len] of [
      [0, 0.5],
      [0.62, 0.9],
    ]) {
      chirp(b, at + dt, 660, 640, len, 0.035);
      chirp(b, at + dt, 830, 805, len, 0.022);
    }
    for (let i = 0; i < 8; i++) noise(b, at + 1.8 + i * 0.22 + (i % 2) * 0.06, 0.08, 0.025, 1800, 1.2);
  },
  animals(b, at) {
    if (daylight < 0.5) return;
    const base = 2400 + Math.random() * 1200;
    for (let i = 0; i < 3; i++) chirp(b, at + i * 0.12, base, base * 1.3, 0.08, 0.03);
  },
  water(b, at) {
    noise(b, at, 2.8, 0.04, 380, 0.5);
    noise(b, at + 1.2, 2.2, 0.025, 620, 0.6);
  },
  grass(b, at) {
    if (daylight > 0.5) return;
    for (let i = 0; i < 4; i++) noise(b, at + i * 0.07, 0.04, 0.03, 4800, 14);
  },
};

function ambient(b: Bus): void {
  const now = b.ac.currentTime;
  for (const kind of Object.keys(AMBIENT) as AmbientKind[]) {
    if (now < nextAmbient[kind]) continue;
    const count = ambience[kind];
    const gap = AMBIENT_GAP[kind] / Math.min(2, 1 + Math.log10(1 + count));
    nextAmbient[kind] = now + gap * (0.6 + Math.random() * 0.8);
    if (count > 0) AMBIENT[kind](b, now + 0.05);
  }
}

function tick(): void {
  if (!bus) return;
  while (next < bus.ac.currentTime + 0.3) {
    play(bus, next, step++);
    next += BEAT * (1 + 0.25 * (1 - daylight));
  }
  ambient(bus);
}

function start(): void {
  const b = makeBus();
  if (!b || timer) return;
  next = b.ac.currentTime + 0.1;
  for (const kind of Object.keys(nextAmbient) as AmbientKind[]) nextAmbient[kind] = b.ac.currentTime + 4 + Math.random() * AMBIENT_GAP[kind];
  b.master.gain.cancelScheduledValues(b.ac.currentTime);
  b.master.gain.setTargetAtTime(VOLUME, b.ac.currentTime, 1.5);
  tick();
  timer = window.setInterval(tick, 80);
}

function stop(): void {
  if (!bus || !timer) return;
  clearInterval(timer);
  timer = 0;
  bus.master.gain.cancelScheduledValues(bus.ac.currentTime);
  bus.master.gain.setTargetAtTime(0, bus.ac.currentTime, 0.3);
}

export function musicEnabled(): boolean {
  return enabled;
}

export function setMusicEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  if (on) start();
  else stop();
}

export function setMusicDaylight(value: number): void {
  daylight = value;
}

export function duckMusic(): void {
  if (!bus) return;
  const g = bus.duck.gain;
  const now = bus.ac.currentTime;
  g.cancelScheduledValues(now);
  g.setTargetAtTime(0.45, now, 0.03);
  g.setTargetAtTime(1, now + 0.25, 0.4);
}

export function initMusic(): void {
  const kick = () => {
    if (enabled) start();
  };
  window.addEventListener("pointerdown", kick, { once: true });
  window.addEventListener("keydown", kick, { once: true });
  document.addEventListener("visibilitychange", () => {
    const ac = bus?.ac;
    if (!ac) return;
    if (document.hidden) void ac.suspend();
    else void ac.resume();
  });
}
