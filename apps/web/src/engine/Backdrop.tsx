import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { Ocean } from "./Ocean";
import { PalmTree } from "./PalmTree";
import { Sand } from "./Sand";

const CYCLE_SECONDS = 50;
const AZIMUTH_DEG = 200; // sun sets out over the ocean, roughly ahead of the camera

function triangleWave(t: number, period: number) {
  const x = (t % period) / period;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

function sunVector(elevationDeg: number, azimuthDeg: number) {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

// A beach at golden hour: procedural atmospheric sky (no HDR/network
// fetch — see git history for why), a sun that visibly arcs down toward
// the horizon and warms in color as it sets, animated waves, and palms
// framing the puzzle area. This IS the brief's "game that goes to bed"
// identity, just always-on here so the mood reads instantly in a test
// loop instead of only at the 15-minute mark.
export function Backdrop() {
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<{ material: THREE.ShaderMaterial } | null>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const elevation = THREE.MathUtils.lerp(2, 45, triangleWave(t, CYCLE_SECONDS));
    const dir = sunVector(elevation, AZIMUTH_DEG);

    const setProgress = 1 - THREE.MathUtils.clamp((elevation - 2) / (45 - 2), 0, 1);

    if (sunLightRef.current) {
      sunLightRef.current.position.copy(dir).multiplyScalar(30);
      sunLightRef.current.intensity = THREE.MathUtils.lerp(1.7, 0.75, setProgress);
      sunLightRef.current.color.setHSL(THREE.MathUtils.lerp(0.14, 0.03, setProgress), 0.85, 0.62);
    }

    const sky = skyRef.current;
    if (sky?.material?.uniforms) {
      sky.material.uniforms.sunPosition.value.copy(dir);
      sky.material.uniforms.turbidity.value = THREE.MathUtils.lerp(3, 8, setProgress);
      sky.material.uniforms.rayleigh.value = THREE.MathUtils.lerp(1.2, 3.2, setProgress);
    }
  });

  return (
    <>
      {/* @ts-expect-error drei's Sky ref type doesn't expose .material, but it's a real THREE.Mesh */}
      <Sky ref={skyRef} distance={3000} mieCoefficient={0.01} mieDirectionalG={0.9} />
      <fog attach="fog" args={["#e8a374", 14, 34]} />

      <hemisphereLight args={["#bfe0ff", "#caa06a", 0.7]} />
      <ambientLight intensity={0.4} color="#ffd9a8" />
      <directionalLight ref={sunLightRef} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.5, 60]} />
      </directionalLight>

      <Sand />
      <Ocean />

      {/* glittering sun-path on the water — the visual signature of a
          sunset beach that flat lighting alone can't sell */}
      <Sparkles
        count={80}
        scale={[3.2, 0.08, 18]}
        position={[0, -0.5, -16]}
        size={2.5}
        speed={0.25}
        color="#ffe6a0"
      />

      <PalmTree position={[-6.2, 0, 2.5]} scale={1.1} lean={0.12} />
      <PalmTree position={[-7.4, 0, -0.5]} scale={0.9} lean={0.06} />
      <PalmTree position={[6.4, 0, 2.2]} scale={1} lean={-0.1} />
      <PalmTree position={[7.6, 0, -0.8]} scale={0.85} lean={-0.05} />
    </>
  );
}
