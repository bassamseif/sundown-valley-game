// A tiny local playback helper for Sound Forge's phoneme/word clips.
// Every clip must be bundled and imported through Vite — no runtime URL
// construction, no CDN, no fetch to any third-party host. Precedent:
// Environment(preset="sunset") fetched an HDR from GitHub, hung forever
// on a bad connection, and blanked the whole scene via React Suspense.
//
// No audio clips are bundled in the repo yet (launch content has no
// recorded phonemes), so CLIP_MAP is empty and every play() call is a
// silent no-op. Sound Forge is fully playable muted per its spec —
// audio is an enhancement, never a gate — so this ships intentionally
// silent until real clips land, without blocking anything else.
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

export async function playClip(id: string): Promise<void> {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const buffer = await loadClip(id);
  if (!buffer) return;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}
