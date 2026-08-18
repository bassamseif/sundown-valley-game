import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A handful of small glowing droplets that advance along a straight
// run and loop back to the start — cheap (a fixed small mesh count,
// just position updates, no physics) but reads clearly as "water is
// actually moving through the connected pipes right now."
export function WaterFlow({ startX, length, y }: { startX: number; length: number; y: number }) {
  const count = Math.max(4, Math.min(16, Math.round(length * 5)));
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    if (length <= 0) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const phase = i / count;
      const pos = ((t * 0.7 + phase) % 1) * length;
      mesh.position.x = startX + pos;
    }
  });

  if (length <= 0) return null;

  return (
    <group position={[0, y, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }}>
          <sphereGeometry args={[0.065, 10, 10]} />
          <meshStandardMaterial color="#d6fbff" emissive="#7fe3c9" emissiveIntensity={1.4} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
