import * as THREE from "three";

// Shared sun-cycle math so every component that needs it (the light,
// the skybox, the fog, the sun-glint) computes the exact same
// elevation/direction/progress from just the clock — no prop-drilling
// a value that changes every frame (which would force a React
// re-render every frame if it lived in state).
export const CYCLE_SECONDS = 50;
export const AZIMUTH_DEG = 200; // sun sets out over the ocean, roughly ahead of the camera

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
