// A word built by tapping sound-pebbles into order — the deterministic
// core of Sound Forge. Pure TypeScript, mirrors pipeAlign.ts and
// structuralBridge.ts: no React, no Three.js, no audio playback here.
import wordData from "../../../../content/puzzles/soundForge.json";

export type Grapheme = string;
export type PhonemeId = string;

export interface Pebble {
  id: string;
  grapheme: Grapheme;
  phoneme: PhonemeId;
}

export interface WordDef {
  id: string;
  graphemes: Grapheme[];
  phonemes: PhonemeId[];
  wordAudio: PhonemeId;
  modelId: string;
}

export interface ForgeState {
  wordId: string;
  tray: (string | null)[];
  slots: (string | null)[];
}

export const WORDS: WordDef[] = wordData.words;

export function wordById(id: string): WordDef {
  const word = WORDS.find((w) => w.id === id);
  if (!word) throw new Error(`Unknown word id: ${id}`);
  return word;
}

export function pebblesFor(wordId: string): Pebble[] {
  const word = wordById(wordId);
  return word.graphemes.map((grapheme, i) => ({
    id: `w_${wordId}_p${i}`,
    grapheme,
    phoneme: word.phonemes[i],
  }));
}

// Small deterministic PRNG (mulberry32) so `seed` fully determines the
// shuffle — tests pin a seed instead of reading required state back out
// of the hook, unlike pipeAlign's Math.random()-based orientations.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isIdentityOrder(pebbleIds: string[], correctOrder: string[]): boolean {
  return pebbleIds.every((id, i) => id === correctOrder[i]);
}

export function initialState(wordId: string, seed: number): ForgeState {
  const pebbles = pebblesFor(wordId);
  const correctOrder = pebbles.map((p) => p.id);

  const rand = mulberry32(seed);
  let tray = shuffle(correctOrder, rand);
  // Guard against a spawn that's already solved — reshuffle with a
  // derived seed until it isn't (pebble count is always >= 3, so a
  // non-identity permutation always exists).
  let guard = 0;
  while (isIdentityOrder(tray, correctOrder) && guard < 20) {
    tray = shuffle(correctOrder, mulberry32(seed + guard + 1));
    guard++;
  }

  return {
    wordId,
    tray,
    slots: Array(pebbles.length).fill(null),
  };
}

export function tapPebble(state: ForgeState, pebbleId: string): ForgeState {
  const trayIndex = state.tray.indexOf(pebbleId);
  if (trayIndex === -1) return state; // not in the tray (already placed) — no-op
  const firstEmptySlot = state.slots.indexOf(null);
  if (firstEmptySlot === -1) return state; // all slots full — no-op

  const tray = state.tray.slice();
  tray[trayIndex] = null;
  const slots = state.slots.slice();
  slots[firstEmptySlot] = pebbleId;
  return { ...state, tray, slots };
}

export function tapSlot(state: ForgeState, slotIndex: number): ForgeState {
  const pebbleId = state.slots[slotIndex];
  if (pebbleId === null || pebbleId === undefined) return state; // empty slot — no-op

  const slots = state.slots.slice();
  slots[slotIndex] = null;
  const tray = state.tray.slice();
  const trayIndex = tray.indexOf(null);
  tray[trayIndex === -1 ? tray.length : trayIndex] = pebbleId;
  return { ...state, tray, slots };
}

export function filledGraphemes(state: ForgeState): (Grapheme | null)[] {
  const pebbles = pebblesFor(state.wordId);
  const byId = new Map(pebbles.map((p) => [p.id, p.grapheme]));
  return state.slots.map((id) => (id === null ? null : byId.get(id) ?? null));
}

export function isFull(state: ForgeState): boolean {
  return state.slots.every((s) => s !== null);
}

export function isSolved(state: ForgeState): boolean {
  const correctOrder = pebblesFor(state.wordId).map((p) => p.id);
  return state.slots.every((id, i) => id === correctOrder[i]);
}

export function nextWordId(state: ForgeState): string {
  const index = WORDS.findIndex((w) => w.id === state.wordId);
  return WORDS[(index + 1) % WORDS.length].id;
}
