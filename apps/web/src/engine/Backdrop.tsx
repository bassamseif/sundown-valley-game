import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { GrassTuft } from "./GrassTuft";
import { Ocean } from "./Ocean";
import { PalmTree } from "./PalmTree";
import { Island } from "./Island";
import { Mountains } from "./Mountains";
import { Skybox } from "./Skybox";
import { islandHeight } from "./terrain";
import { AZIMUTH_DEG, elapsedSeconds, sunState } from "./sunCycle";

// Palms planted around the dune ring so the beach reads as surrounding
// the puzzle from every orbit angle, each sitting at the terrain's own
// height instead of floating at a fixed y.
const PALM_PLACEMENTS = [
  { angle: 145, radius: 10.5, scale: 1.1 },
  { angle: 195, radius: 11.5, scale: 0.95 },
  { angle: 35, radius: 10, scale: 1 },
  { angle: 355, radius: 11, scale: 0.9 },
  { angle: 90, radius: 12.5, scale: 0.85 },
  { angle: 260, radius: 12, scale: 1.05 },
].map(({ angle, radius, scale }) => {
  const rad = THREE.MathUtils.degToRad(angle);
  const x = Math.cos(rad) * radius;
  const z = Math.sin(rad) * radius;
  return { position: [x, islandHeight(x, z), z] as [number, number, number], scale, lean: (Math.random() - 0.5) * 0.16 };
});

// A ring of overlapping clusters framing the puzzle table itself — a
// lawn border around the play area, visible from every camera angle,
// not just background dressing behind it. The ring sits at a radius
// safely inside FLAT_RADIUS (8.5) even after each cluster's own
// scatter radius is added, so every blade lands on guaranteed-flat
// ground rather than the dune noise starting just past that edge.
// Every loop camera sits on the +Z side looking back toward the
// origin, so a ring truly centered on the puzzle has its near half
// crowded right up against (or behind) the camera — barely visible —
// while only the far half reads. Centering the ring itself further
// toward -Z (away from the camera) instead pulls that near edge back
// to a comfortable mid-distance, so most of the loop sits inside the
// frame at once, while its center-to-origin offset plus its own
// radius still stays inside FLAT_RADIUS (8.5).
const GRASS_RING_COUNT = 14;
const GRASS_RING_RADIUS = 6.2;
const GRASS_RING_CENTER: [number, number] = [0, -1.8];
const GRASS_CLUSTER_RADIUS = 1.5;
const GRASS_PATCH_CLUSTERS = Array.from({ length: GRASS_RING_COUNT }, (_, i) => {
  const angle = (i / GRASS_RING_COUNT) * Math.PI * 2;
  const x = GRASS_RING_CENTER[0] + Math.cos(angle) * GRASS_RING_RADIUS;
  const z = GRASS_RING_CENTER[1] + Math.sin(angle) * GRASS_RING_RADIUS;
  return {
    x,
    z,
    radius: GRASS_CLUSTER_RADIUS,
    count: 55,
    seed: 500 + i * 37,
    position: [x, islandHeight(x, z), z] as [number, number, number],
  };
});

// A beach at golden hour: procedural atmospheric sky (no HDR/network
// fetch — see git history for why), a sun that visibly arcs down toward
// the horizon and warms in color as it sets, animated waves, and palms
// framing the puzzle area. This IS the brief's "game that goes to bed"
// identity, just always-on here so the mood reads instantly in a test
// loop instead of only at the 15-minute mark.
export function Backdrop({ active = false }: { active?: boolean }) {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);
  // How far into a puzzle's own light boost we are, damped rather than
  // snapped — fades in/out alongside the camera's own fly-to-loop
  // transition (SceneShell's CameraRig) instead of popping brighter
  // the instant a loop is picked.
  const boostRef = useRef(0);

  useFrame((_, delta) => {
    // elapsedSeconds() tracks the whole session (see sunCycle.ts), not
    // this <Canvas>'s own clock — R3F's clock.getElapsedTime() resets
    // to 0 on every remount, which is exactly the "resets every round"
    // bug this replaces.
    const { dir, setProgress } = sunState(elapsedSeconds());
    const dt = Math.min(delta, 1 / 30);
    boostRef.current = THREE.MathUtils.damp(boostRef.current, active ? 1 : 0, 2, dt);
    // Brighter once you're actually in a puzzle than on the wide,
    // moodier menu shot — the menu's dimness is the "sundown" identity,
    // but once a child is trying to read a puzzle's own materials,
    // legibility matters more than atmosphere. Multiplicative, not a
    // global exposure bump, so the sunset's own colors/contrast still
    // read the same — only brightness scales.
    const boost = 1 + boostRef.current * 0.5;

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(dir).multiplyScalar(30);
      sunLightRef.current.intensity = THREE.MathUtils.lerp(2.1, 1.0, setProgress) * boost;
      sunLightRef.current.color.setHSL(THREE.MathUtils.lerp(0.14, 0.03, setProgress), 0.85, 0.62);
    }
    if (ambientRef.current) ambientRef.current.intensity = 0.25 * boost;
    if (hemiRef.current) hemiRef.current.intensity = 0.45 * boost;

    // Fog color uses the exact same HSL formula as the skybox's horizon
    // band (see Skybox.tsx's uHorizon) so it never mismatches the sky
    // pixel next to it at the terrain's silhouette edge — fog density
    // hides geometry, but only a color *match* hides the edge itself.
    if (fogRef.current) {
      fogRef.current.color.setHSL(
        THREE.MathUtils.lerp(0.11, 0.05, setProgress),
        THREE.MathUtils.lerp(0.7, 0.95, setProgress),
        THREE.MathUtils.lerp(0.85, 0.6, setProgress)
      );
    }
  });

  return (
    <>
      <Skybox />
      {/* Exponential-squared fog: no hard "far" cutoff radius (unlike
          linear fog), so density ramps smoothly and is already
          near-opaque well inside the island mesh's own edge
          (DEEP_RADIUS = 26) — no fixed boundary for a seam to sit at. */}
      <fogExp2 ref={fogRef} attach="fog" args={["#e8a374", 0.022]} />

      {/* Lower ambient/hemisphere than a typical setup — too much flat
          fill light is what was washing every material's color out to
          pastel; letting the directional light do more of the work
          keeps colors reading as saturated hues instead of tints. */}
      <hemisphereLight ref={hemiRef} args={["#bfe0ff", "#caa06a", 0.45]} />
      <ambientLight ref={ambientRef} intensity={0.25} color="#ffd9a8" />
      <directionalLight ref={sunLightRef} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.5, 60]} />
      </directionalLight>

      <Mountains />
      <Island />
      <Ocean />

      {/* glittering sun-path on the water, aligned to the sun's azimuth
          — the visual signature of a sunset beach that lighting alone
          can't sell */}
      <group rotation={[0, Math.atan2(Math.cos(THREE.MathUtils.degToRad(AZIMUTH_DEG)), Math.sin(THREE.MathUtils.degToRad(AZIMUTH_DEG))), 0]}>
        <Sparkles count={80} scale={[3.2, 0.08, 20]} position={[0, 0.05, 12]} size={2.5} speed={0.25} color="#ffe6a0" />
      </group>

      {PALM_PLACEMENTS.map((p, i) => (
        <PalmTree key={i} position={p.position} scale={p.scale} lean={p.lean} />
      ))}
      {PALM_PLACEMENTS.map((p, i) => (
        <GrassTuft key={i} position={p.position} radius={0.75 * p.scale} count={30} seed={i * 97 + 11} />
      ))}
      {GRASS_PATCH_CLUSTERS.map((c, i) => (
        <GrassTuft key={i} position={c.position} radius={c.radius} count={c.count} seed={c.seed} />
      ))}
    </>
  );
}
