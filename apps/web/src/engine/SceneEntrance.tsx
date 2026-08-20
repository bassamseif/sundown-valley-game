import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Grows a loop's whole scene up from nothing on mount, converging on
// the world origin — so picking a loop reads as the puzzle board
// growing into place while the camera is still flying toward it (see
// SceneShell's CameraRig), instead of the geometry just popping into
// existence the instant you click. Remounts fresh every time (App.tsx
// keys the ErrorBoundary wrapping this by loop id), so leaving and
// re-entering a loop replays the same grow-in.
export function SceneEntrance({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0.001);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, 1, 3.4, delta);
    group.scale.setScalar(scaleRef.current);
  });

  return <group ref={groupRef}>{children}</group>;
}
