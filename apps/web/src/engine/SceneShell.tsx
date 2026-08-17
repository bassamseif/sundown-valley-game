import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { PropsWithChildren } from "react";
import * as THREE from "three";
import { Backdrop } from "./Backdrop";

type Props = PropsWithChildren<{
  cameraPosition?: [number, number, number];
  target?: [number, number, number];
  maxDistance?: number;
}>;

// Fixed default camera, manual orbit optional (never required to solve
// a puzzle) — mirrors the smart-follow-camera invariant from the brief
// for these single-screen test loops. Each scene passes the framing
// that fits its own layout.
export function SceneShell({
  children,
  cameraPosition = [0, 6, 9],
  target = [0, 0.5, 0],
  maxDistance = 16,
}: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      camera={{ position: cameraPosition, fov: 42 }}
    >
      <Backdrop />
      {children}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={20} blur={2.2} far={4} />
      <OrbitControls
        target={target}
        enablePan={false}
        minDistance={4}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}
