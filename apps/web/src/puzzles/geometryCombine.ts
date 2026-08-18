// The puzzle is a congruence match, not arithmetic: the target pedestal
// previews a wireframe at TARGET_UNITS' size, and the player has to
// find the two crystals that are that same size as each other (and as
// the target) — a real geometric judgment (does this shape match that
// shape's size?), not a hidden "these two numbers add up" rule wearing
// a geometry costume.
export const TARGET_UNITS = 2;

export const CRYSTALS: { id: string; units: number }[] = [
  { id: "c1", units: 1 },
  { id: "c2", units: 2 },
  { id: "c3", units: 2 },
  { id: "c4", units: 4 },
];

export function isCorrectPair(unitsA: number, unitsB: number): boolean {
  return unitsA === unitsB;
}
