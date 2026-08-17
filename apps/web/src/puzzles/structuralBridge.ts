export type Plank = { id: string; length: 1 | 2 | 3 };
export type Slot = { id: string; requiredLength: 1 | 2 | 3 };

export const PLANKS: Plank[] = [
  { id: "p1", length: 1 },
  { id: "p2", length: 2 },
  { id: "p3", length: 3 },
];

export const SLOTS: Slot[] = [
  { id: "s1", requiredLength: 2 },
  { id: "s2", requiredLength: 1 },
];

export function fits(plank: Plank, slot: Slot): boolean {
  return plank.length === slot.requiredLength;
}

export function isBridgeComplete(filled: Record<string, string | null>): boolean {
  return SLOTS.every((slot) => filled[slot.id] != null);
}
