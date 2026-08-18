import { describe, expect, it } from "vitest";
import {
  WORDS,
  filledGraphemes,
  initialState,
  isFull,
  isSolved,
  nextWordId,
  pebblesFor,
  tapPebble,
  tapSlot,
} from "./soundForge";

describe("initialState", () => {
  it("produces one pebble per grapheme, all slots empty", () => {
    const state = initialState("cat", 1);
    expect(state.tray).toHaveLength(3);
    expect(state.slots).toHaveLength(3);
    expect(state.slots.every((s) => s === null)).toBe(true);
    expect(new Set(state.tray)).toEqual(new Set(pebblesFor("cat").map((p) => p.id)));
  });

  it("same seed produces the identical tray order; different seeds differ", () => {
    const a = initialState("cat", 42);
    const b = initialState("cat", 42);
    expect(a.tray).toEqual(b.tray);

    const seeds = Array.from({ length: 10 }, (_, i) => i + 1);
    const orders = seeds.map((s) => initialState("cat", s).tray.join(","));
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("never returns a tray already in the correct order", () => {
    const correctOrder = pebblesFor("cat").map((p) => p.id);
    for (let seed = 0; seed < 200; seed++) {
      const state = initialState("cat", seed);
      expect(state.tray).not.toEqual(correctOrder);
    }
  });
});

describe("tapPebble", () => {
  it("moves the pebble to the first empty slot and leaves the tray entry null", () => {
    const state = initialState("cat", 1);
    const pebbleId = state.tray[0]!;
    const next = tapPebble(state, pebbleId);
    expect(next.tray[0]).toBeNull();
    expect(next.slots[0]).toBe(pebbleId);
  });

  it("is a no-op on a pebble already placed", () => {
    const state = initialState("cat", 1);
    const pebbleId = state.tray[0]!;
    const placed = tapPebble(state, pebbleId);
    const again = tapPebble(placed, pebbleId);
    expect(again).toEqual(placed);
  });

  it("is a no-op when all slots are full", () => {
    let state = initialState("cat", 1);
    for (const id of state.tray.slice()) state = tapPebble(state, id!);
    expect(isFull(state)).toBe(true);
    const before = state;
    // any pebble id — all are already placed, so this hits the "not in tray" no-op path
    const after = tapPebble(state, before.slots[0]!);
    expect(after).toEqual(before);
  });
});

describe("tapSlot", () => {
  it("returns a filled slot's pebble to the tray", () => {
    const state = initialState("cat", 1);
    const pebbleId = state.tray[0]!;
    const placed = tapPebble(state, pebbleId);
    const back = tapSlot(placed, 0);
    expect(back.slots[0]).toBeNull();
    expect(back.tray).toContain(pebbleId);
  });

  it("is a no-op on an empty slot", () => {
    const state = initialState("cat", 1);
    const after = tapSlot(state, 0);
    expect(after).toEqual(state);
  });
});

describe("solving", () => {
  it("correct sequence solves; wrong order stays unsolved but full", () => {
    const state = initialState("cat", 1);
    const correctOrder = pebblesFor("cat").map((p) => p.id);
    let solved = state;
    for (const id of correctOrder) solved = tapPebble(solved, id);
    expect(isFull(solved)).toBe(true);
    expect(isSolved(solved)).toBe(true);
    expect(filledGraphemes(solved)).toEqual(pebblesFor("cat").map((p) => p.grapheme));

    let wrong = state;
    for (const id of correctOrder.slice().reverse()) wrong = tapPebble(wrong, id);
    expect(isFull(wrong)).toBe(true);
    expect(isSolved(wrong)).toBe(false);
  });

  it("a wrong full arrangement stays fully editable and can reach solved", () => {
    const state = initialState("cat", 1);
    const correctOrder = pebblesFor("cat").map((p) => p.id);
    let wrong = state;
    for (const id of correctOrder.slice().reverse()) wrong = tapPebble(wrong, id);
    expect(isSolved(wrong)).toBe(false);

    // pull every pebble back out, then re-place in the correct order
    let fixed = wrong;
    for (let i = 0; i < fixed.slots.length; i++) fixed = tapSlot(fixed, i);
    expect(fixed.slots.every((s) => s === null)).toBe(true);
    for (const id of correctOrder) fixed = tapPebble(fixed, id);
    expect(isSolved(fixed)).toBe(true);
  });
});

describe("content", () => {
  it("every word is solvable by placing its pebbles in order", () => {
    for (const word of WORDS) {
      let state = initialState(word.id, 7);
      for (const pebble of pebblesFor(word.id)) state = tapPebble(state, pebble.id);
      expect(isSolved(state)).toBe(true);
    }
  });

  it("every word has parallel graphemes/phonemes arrays", () => {
    for (const word of WORDS) {
      expect(word.phonemes).toHaveLength(word.graphemes.length);
    }
  });
});

describe("nextWordId", () => {
  it("cycles to the next word and wraps around", () => {
    const first = WORDS[0].id;
    const second = WORDS[1].id;
    expect(nextWordId(initialState(first, 1))).toBe(second);

    const last = WORDS[WORDS.length - 1].id;
    expect(nextWordId(initialState(last, 1))).toBe(first);
  });
});
