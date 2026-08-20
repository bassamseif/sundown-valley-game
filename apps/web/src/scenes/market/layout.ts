// Shared geometry constants and pure layout math for Market Day. No
// React, no Three.js objects — just numbers, so BalanceBeam, Coin, and
// MarketDayScene can all agree on the same positions without importing
// from each other.

export const COUNTER_Y = 0.55;
export const BEAM_Y = 0.9;
export const BEAM_Z = -1.75;
export const PURSE_Z = 3;
export const COIN_Y = 1.4;

// The balance beam's own geometry, hoisted so both BalanceBeam's pan
// placement and panWorldPosition (used to give a paid coin its live
// target) agree on the exact same arm length and hang offset.
export const ARM = 0.8;
export const HANG = 0.32;

// Where a slot on a platter sits in the scene's root coordinate space
// right now, given the beam's current tilt angle — the single source
// of truth both BalanceBeam (for its own pan groups) and a coin resting
// on that pan (for its own live target, see Coin) read from.
//
// The plate sits ABOVE its beam-tip anchor (+HANG, not -HANG) — the
// beam is a low rotating arm, and a rigid post of fixed length HANG
// rises from each tip to the plate mounted on it. Since the plate's
// position is always exactly "beam tip plus a constant HANG straight
// up," the post filling that gap can never be intersected by either
// end — it *is* the exact clearance between them, by construction, at
// any tilt angle.
export function panWorldPosition(side: "left" | "right", angle: number, local: readonly [number, number, number]): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const sign = side === "left" ? -1 : 1;
  return [
    sign * ARM * cos + local[0],
    BEAM_Y + 0.42 + sign * ARM * sin + HANG + 0.0175 + local[1],
    BEAM_Z + local[2],
  ];
}

// A piece's own footprint radius on a platter — must track WeightPiece's
// rBottom exactly, since that's the geometry actually being packed.
export function footprintRadius(value: 1 | 5): number {
  return value === 5 ? 0.18 : 0.11;
}

// The platter mesh's own top face has radius 0.58 (see BalanceBeam) —
// this stays a bit inside that so a piece's edge never touches the rim.
export const PLATTER_RADIUS = 0.5;

// Packs up to `count` equal-footprint items (radius `itemRadius`) onto a
// circular platter, ring by ring: one at the center, then as many as fit
// evenly around each successive ring without their footprints
// overlapping, with every ring radius clamped so an item's own edge —
// not just its center point — never crosses the platter's edge. That
// clamp is what actually protects against "half sitting off the plate":
// previously items were spaced by a constant that ignored both the
// item's real size and the platter's, so a big piece could still hang
// over the rim while two small ones sat needlessly far apart.
//
// Purely a function of (index, count, itemRadius) — the Nth slot's
// position never depends on how many of the `count` items are actually
// placed right now, only on how many could ever be. Both callers pass a
// `count` fixed for the whole order (denominations.length for the price
// side; coins.length — the order's full coin list, not just the coins
// currently tapped — for the paid side), so appending or removing from
// the end (the only way either pile changes) never reflows an
// already-placed piece.
export function packOnPlatter(count: number, itemRadius: number, platterRadius: number, margin = 0.05): [number, number, number][] {
  const positions: [number, number, number][] = [];
  if (count <= 0) return positions;

  const cell = itemRadius * 2 + margin;
  const maxCenterDist = Math.max(platterRadius - itemRadius - margin, 0);

  positions.push([0, 0, 0]);
  let ring = 1;
  while (positions.length < count) {
    const r = Math.min(ring * cell, maxCenterDist);
    const circumference = 2 * Math.PI * Math.max(r, cell / 4);
    const remaining = count - positions.length;
    const countThisRing = Math.max(1, Math.min(remaining, Math.floor(circumference / cell)));
    for (let i = 0; i < countThisRing && positions.length < count; i++) {
      const theta = (i / countThisRing) * Math.PI * 2;
      positions.push([Math.cos(theta) * r, 0, Math.sin(theta) * r]);
    }
    ring++;
    // Safety valve: on a platter far too small for its item count, r
    // pins at maxCenterDist and every further ring would just restate
    // the previous one. Stop rather than spin forever — items will
    // touch/overlap in that pathological case, but never spill past
    // the platter's edge, which is the one thing this exists to prevent.
    if (r >= maxCenterDist && ring > count + 2) break;
  }
  return positions;
}
