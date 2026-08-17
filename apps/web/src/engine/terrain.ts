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
export function islandHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= FLAT_RADIUS) return 0;

  const duneFactor = smoothstep(FLAT_RADIUS, DUNE_RADIUS, r) * (1 - smoothstep(DUNE_RADIUS, DEEP_RADIUS, r));
  const hill = (noise2D(x * 0.09, z * 0.09) * 0.6 + noise2D(x * 0.22, z * 0.22) * 0.3) * 1.4;
  const dune = hill * duneFactor;

  const slope = smoothstep(DUNE_RADIUS - 2, DEEP_RADIUS, r);
  const seaFloor = -4.2 * slope;

  return dune + seaFloor;
}

export function terrainZone(height: number): "dry" | "wet" | "shallow" | "deep" {
  if (height > 0.15) return "dry";
  if (height > -0.15) return "wet";
  if (height > -1.2) return "shallow";
  return "deep";
}
