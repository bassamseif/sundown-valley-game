// A tiny local playback helper for Sound Forge's phoneme/word clips.
// Every clip is bundled and imported through Vite — no runtime URL
// construction, no CDN, no fetch to any third-party host. Precedent:
// Environment(preset="sunset") fetched an HDR from GitHub, hung
// forever on a bad connection, and blanked the whole scene via React
// Suspense. Loading these below the same way (a static import that
// Vite resolves to a hashed same-origin asset URL at build time) never
// touches the network at runtime.
//
// Clips are synthesized offline with espeak-ng and committed as small
// mono MP3s (src/assets/audio/**) — no professional voice recording
// exists for this project, so this is the actual, intelligible speech
// audio that ships, not a placeholder. Swapping in real recordings
// later is a matter of replacing these files; nothing else changes.
import ph_a from "../assets/audio/phonemes/a.mp3";
import ph_b from "../assets/audio/phonemes/b.mp3";
import ph_c from "../assets/audio/phonemes/c.mp3";
import ph_d from "../assets/audio/phonemes/d.mp3";
import ph_e from "../assets/audio/phonemes/e.mp3";
import ph_f from "../assets/audio/phonemes/f.mp3";
import ph_g from "../assets/audio/phonemes/g.mp3";
import ph_h from "../assets/audio/phonemes/h.mp3";
import ph_i from "../assets/audio/phonemes/i.mp3";
import ph_m from "../assets/audio/phonemes/m.mp3";
import ph_n from "../assets/audio/phonemes/n.mp3";
import ph_o from "../assets/audio/phonemes/o.mp3";
import ph_p from "../assets/audio/phonemes/p.mp3";
import ph_s from "../assets/audio/phonemes/s.mp3";
import ph_t from "../assets/audio/phonemes/t.mp3";
import ph_u from "../assets/audio/phonemes/u.mp3";

import word_bed from "../assets/audio/words/bed.mp3";
import word_bug from "../assets/audio/words/bug.mp3";
import word_cat from "../assets/audio/words/cat.mp3";
import word_dog from "../assets/audio/words/dog.mp3";
import word_fin from "../assets/audio/words/fin.mp3";
import word_hat from "../assets/audio/words/hat.mp3";
import word_mud from "../assets/audio/words/mud.mp3";
import word_net from "../assets/audio/words/net.mp3";
import word_pig from "../assets/audio/words/pig.mp3";
import word_pot from "../assets/audio/words/pot.mp3";
import word_sun from "../assets/audio/words/sun.mp3";
import word_top from "../assets/audio/words/top.mp3";

// Keyed by the phoneme/word ids used in content/puzzles/soundForge.json
// ("ph_c", "word_cat", ...).
const CLIP_MAP: Record<string, string> = {
  ph_a, ph_b, ph_c, ph_d, ph_e, ph_f, ph_g, ph_h, ph_i, ph_m, ph_n, ph_o, ph_p, ph_s, ph_t, ph_u,
  word_bed, word_bug, word_cat, word_dog, word_fin, word_hat, word_mud, word_net, word_pig, word_pot, word_sun, word_top,
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
  await Promise.all(ids.map(loadClip));
}

function playBufferAt(audioCtx: AudioContext, buffer: AudioBuffer, when: number) {
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start(when);
}

function playBuffer(audioCtx: AudioContext, buffer: AudioBuffer) {
  playBufferAt(audioCtx, buffer, audioCtx.currentTime);
}

// Short synthesized fallback tone — used only if a clip is missing or
// fails to decode, so a tap is never completely silent.
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

/** Plays a phoneme's real clip, e.g. "ph_c" — falls back to a tone if it's missing/fails to decode. */
export async function playPhoneme(id: string): Promise<void> {
  const audioCtx = getContext();
  if (!audioCtx) return;
  await ensureRunning(audioCtx);

  const buffer = await loadClip(id);
  if (buffer) {
    playBuffer(audioCtx, buffer);
    return;
  }
  playTone(audioCtx, freqForId(id), audioCtx.currentTime);
}

// A short rising major arpeggio (C5-E5-G5-C6) — a "ta-da", not a
// single beep — with each note overlapping the next slightly so it
// reads as one bright gesture rather than separate blips.
function playSuccessChime(audioCtx: AudioContext, startAt: number): number {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const step = 0.09;
  notes.forEach((freq, i) => {
    const duration = i === notes.length - 1 ? 0.32 : 0.16;
    const peakGain = i === notes.length - 1 ? 0.24 : 0.18;
    playTone(audioCtx, freq, startAt + i * step, duration, peakGain);
  });
  return startAt + (notes.length - 1) * step + 0.32;
}

/**
 * The tap that completes a word: the last phoneme, then a success
 * chime, then the whole word — scheduled back-to-back on the audio
 * clock (not fired as three independent calls) so nothing overlaps or
 * gets cut off, and the phoneme is never skipped.
 */
export async function playSolveSequence(phonemeId: string, wordId: string): Promise<void> {
  const audioCtx = getContext();
  if (!audioCtx) return;
  await ensureRunning(audioCtx);

  const [phonemeBuf, wordBuf] = await Promise.all([loadClip(phonemeId), loadClip(wordId)]);
  const gap = 0.15;
  let t = audioCtx.currentTime;

  if (phonemeBuf) {
    playBufferAt(audioCtx, phonemeBuf, t);
    t += phonemeBuf.duration + gap;
  } else {
    playTone(audioCtx, freqForId(phonemeId), t);
    t += 0.22 + gap;
  }

  t = playSuccessChime(audioCtx, t) + gap;

  if (wordBuf) {
    playBufferAt(audioCtx, wordBuf, t);
  } else {
    [523.25, 659.25, 783.99].forEach((freq, i) => playTone(audioCtx, freq, t + i * 0.09, 0.4, 0.16));
  }
}
