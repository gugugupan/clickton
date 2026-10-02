let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function playClick(pitch = 1): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.03);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 2400 * pitch;
  band.Q.value = 1.4;
  const gain = ac.createGain();
  gain.gain.value = 0.5;
  noise.connect(band).connect(gain).connect(ac.destination);
  noise.start(now);

  const tone = ac.createOscillator();
  tone.frequency.value = 1300 * pitch;
  const tg = ac.createGain();
  tg.gain.setValueAtTime(0.12, now);
  tg.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  tone.connect(tg).connect(ac.destination);
  tone.start(now);
  tone.stop(now + 0.07);
}

export function playTick(): void {
  playClick(1.6);
}
