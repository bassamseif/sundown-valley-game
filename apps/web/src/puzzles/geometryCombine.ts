export const TARGET_UNITS = 5;

export const CRYSTALS: { id: string; units: number }[] = [
  { id: "c1", units: 1 },
  { id: "c2", units: 2 },
  { id: "c3", units: 3 },
  { id: "c4", units: 4 },
];

export function isCorrectPair(unitsA: number, unitsB: number): boolean {
  return unitsA + unitsB === TARGET_UNITS;
}
