import * as THREE from "three";

// Shared sun-cycle math so every component that needs it (the light,
// the skybox, the fog, the sun-glint) computes the exact same
// elevation/direction/progress from just the clock — no prop-drilling
// a value that changes every frame (which would force a React
// re-render every frame if it lived in state).
export const CYCLE_SECONDS = 50;
export const AZIMUTH_DEG = 200; // sun sets out over the ocean, roughly ahead of the camera

// The sun tracks total time in the session, not time inside the
// current loop — it should read like "how far the day's come since
// you sat down to play," not reset every time a puzzle's <Canvas>
// remounts (entering a loop, or backing out to the menu and back in).
// A module-level constant, evaluated once when this module first
// loads (i.e. page load), is the single shared reference both the
// in-scene sun (Backdrop, via elapsedSeconds()) and the menu-bar badge
// (SunProgressBadge, which lives outside any Canvas and so can't use
// R3F's per-Canvas clock anyway) read from — one source of truth, so
// the two can never drift apart or reset independently of each other.
const SESSION_START = performance.now();

export function elapsedSeconds(): number {
  return (performance.now() - SESSION_START) / 1000;
}

function triangleWave(t: number, period: number) {
  const x = (t % period) / period;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

function sunVector(elevationDeg: number, azimuthDeg: number) {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

export function sunState(t: number) {
  const elevation = THREE.MathUtils.lerp(2, 45, triangleWave(t, CYCLE_SECONDS));
  const dir = sunVector(elevation, AZIMUTH_DEG);
  const setProgress = 1 - THREE.MathUtils.clamp((elevation - 2) / (45 - 2), 0, 1);
  return { elevation, dir, setProgress };
}
