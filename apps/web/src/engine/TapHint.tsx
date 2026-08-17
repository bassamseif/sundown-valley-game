import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A soft bobbing, pulsing ring shown above whatever the player should
// tap next. Purely a visual affordance — never gates correctness.
export function TapHint({ position, visible = true }: { position: [number, number, number]; visible?: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = clock.getElapsedTime();
    ring.current.position.y = position[1] + 0.55 + Math.sin(t * 2.2) * 0.08;
    const s = 1 + Math.sin(t * 2.2) * 0.12;
    ring.current.scale.setScalar(s);
  });

  if (!visible) return null;

  return (
    <mesh ref={ring} position={[position[0], position[1] + 0.55, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.22, 0.3, 32]} />
      <meshBasicMaterial color="#fff3d6" transparent opacity={0.9} toneMapped={false} />
    </mesh>
  );
}
