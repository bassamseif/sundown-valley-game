import { createNoise2D } from "simplex-noise";

// Shared height field so the island mesh, palm tree placement, and the
// water line all agree on the same shape. Deterministic seed so the
// terrain doesn't reshuffle on every reload.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise2D = createNoise2D(mulberry32(1337));

export const SEA_LEVEL = 0;
export const FLAT_RADIUS = 8.5; // puzzle area stays exactly flat inside this radius
export const DUNE_RADIUS = 15; // dunes/shore between FLAT_RADIUS and here
export const DEEP_RADIUS = 26; // fully underwater sea floor beyond here

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

// Returns terrain height at world (x, z). 0 = sea level. Positive =
// dry land, negative = underwater.
//
// Two non-overlapping, C1-continuous zones — both meet at exactly
// height 0 with zero slope at DUNE_RADIUS, so there's no seam. (An
// earlier version had a dune "bump" that stayed large all the way out
// past DEEP_RADIUS while a separate sea-floor slope was already
// dropping from much closer in — the two competed over a huge
// overlapping span and produced an ungainly ridge around the island.)
export function islandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= FLAT_RADIUS) return 0;

  if (r <= DUNE_RADIUS) {
    // dune zone: rises from the flat play area, settles back to
    // exactly 0 at the shoreline — a smooth bump, not a ramp that
    // has to be cancelled out by something else further along.
    const t = smoothstep(FLAT_RADIUS, DUNE_RADIUS, r);
    const bump = Math.sin(t * Math.PI);
    const hill = (noise2D(x * 0.09, z * 0.09) * 0.6 + noise2D(x * 0.22, z * 0.22) * 0.3) * 1.2;
    return hill * bump;
  }

  // beyond the shoreline: a single monotonic descent into the sea
  // floor, with only gentle texture (no competing bump amplitude).
  const slopeT = smoothstep(DUNE_RADIUS, DEEP_RADIUS, r);
  const floorTexture = noise2D(x * 0.06, z * 0.06) * 0.3 * slopeT;
  return -4.2 * slopeT + floorTexture;
}

export function terrainZone(height: number): "dry" | "wet" | "shallow" | "deep" {
  if (height > 0.15) return "dry";
  if (height > -0.15) return "wet";
  if (height > -1.2) return "shallow";
  return "deep";
}
