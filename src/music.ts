import { audio } from "./audio";

const PENTA = [0, 2, 4, 7, 9];
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const BEAT = 0.42;
const VOLUME = 0.3;
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

function tick(): void {
  if (!bus) return;
  while (next < bus.ac.currentTime + 0.3) {
    play(bus, next, step++);
    next += BEAT * (1 + 0.25 * (1 - daylight));
  }
}

function start(): void {
  const b = makeBus();
  if (!b || timer) return;
  next = b.ac.currentTime + 0.1;
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
