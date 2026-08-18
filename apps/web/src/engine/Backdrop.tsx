import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Ocean } from "./Ocean";
import { PalmTree } from "./PalmTree";
import { Island } from "./Island";
import { Mountains } from "./Mountains";
import { Skybox } from "./Skybox";
import { islandHeight } from "./terrain";
import { AZIMUTH_DEG, sunState } from "./sunCycle";

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

// A beach at golden hour: procedural atmospheric sky (no HDR/network
// fetch — see git history for why), a sun that visibly arcs down toward
// the horizon and warms in color as it sets, animated waves, and palms
// framing the puzzle area. This IS the brief's "game that goes to bed"
// identity, just always-on here so the mood reads instantly in a test
// loop instead of only at the 15-minute mark.
export function Backdrop() {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const fogRef = useRef<THREE.FogExp2>(null);

  useFrame(({ clock }) => {
    const { dir, setProgress } = sunState(clock.getElapsedTime());

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(dir).multiplyScalar(30);
      sunLightRef.current.intensity = THREE.MathUtils.lerp(2.1, 1.0, setProgress);
      sunLightRef.current.color.setHSL(THREE.MathUtils.lerp(0.14, 0.03, setProgress), 0.85, 0.62);
    }

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
      <hemisphereLight args={["#bfe0ff", "#caa06a", 0.45]} />
      <ambientLight intensity={0.25} color="#ffd9a8" />
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
    </>
  );
}
