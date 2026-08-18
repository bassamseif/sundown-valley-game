// A tiny local playback helper for Sound Forge's phoneme/word sounds.
// Real recorded clips must be bundled and imported through Vite — no
// runtime URL construction, no CDN, no fetch to any third-party host.
// Precedent: Environment(preset="sunset") fetched an HDR from GitHub,
// hung forever on a bad connection, and blanked the whole scene via
// React Suspense.
//
// No recorded phoneme clips exist in the repo yet, so CLIP_MAP is
// empty and playback falls back to a synthesized tone (Web Audio
// oscillator, generated in code — no asset file, no network request).
// This keeps the puzzle audibly responsive today; once real clips
// land, populate CLIP_MAP and this same call plays them instead.
const CLIP_MAP: Record<string, string> = {
  // "ph_c": clipUrl, ...  — populate once real audio assets exist.
};

const bufferCache = new Map<string, AudioBuffer>();
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

// Browsers suspend a freshly created AudioContext until a user gesture
// resumes it — every exported function here is only ever called from a
// tap handler, so this always runs inside that gesture.
async function ensureRunning(audioCtx: AudioContext) {
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      // ignored — playback degrades to silence, never blocks the tap
    }
  }
}

async function loadClip(id: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(id);
  if (cached) return cached;
  const url = CLIP_MAP[id];
  const audioCtx = getContext();
  if (!url || !audioCtx) return null;
  try {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(data);
    bufferCache.set(id, buffer);
    return buffer;
  } catch {
    return null; // playback failure degrades to silence, never blocks a tap
  }
}

export async function preloadClips(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => (CLIP_MAP[id] ? loadClip(id) : Promise.resolve(null))));
}

// A pleasant pentatonic scale (no jarring intervals) — a phoneme id is
// hashed onto a scale degree so every letter gets a distinct, stable
// pitch across replays without sounding random or dissonant together.
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

function freqForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PENTATONIC[hash % PENTATONIC.length];
}

function playTone(audioCtx: AudioContext, freq: number, startAt: number, duration = 0.22, peakGain = 0.22) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Plays a phoneme's clip if one is bundled, otherwise a short synthesized tone. */
export async function playPhoneme(id: string): Promise<void> {
  const audioCtx = getContext();
  if (!audioCtx) return;
  await ensureRunning(audioCtx);

  if (CLIP_MAP[id]) {
    const buffer = await loadClip(id);
    if (buffer) {
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start();
      return;
    }
  }
  playTone(audioCtx, freqForId(id), audioCtx.currentTime);
}

/** Solved-word payoff: a quick rising arpeggio through the phonemes, landing on a bright chord. */
export async function playWordChime(phonemeIds: string[]): Promise<void> {
  const audioCtx = getContext();
  if (!audioCtx) return;
  await ensureRunning(audioCtx);

  const now = audioCtx.currentTime;
  const step = 0.11;
  phonemeIds.forEach((id, i) => {
    playTone(audioCtx, freqForId(id), now + i * step, 0.18, 0.18);
  });
  const chordAt = now + phonemeIds.length * step;
  [523.25, 659.25, 783.99].forEach((freq) => playTone(audioCtx, freq, chordAt, 0.5, 0.16));
}
