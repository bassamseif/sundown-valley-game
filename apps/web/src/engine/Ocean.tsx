import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEEP_RADIUS } from "./terrain";

export const OCEAN_COLOR = "#2fb6c4";
export const OCEAN_Y = -0.08; // just below the island's flat sea-level baseline, no z-fighting

// Hypercasual, toon-flat ocean: a coarse plane whose vertices are
// displaced by two overlapping sine waves each frame. Sized to
// surround the island on every side (not just one edge of the
// camera), and sits just under sea level so the Island mesh's dry
// land pokes through naturally at the shore.
export function Ocean() {
  const geomRef = useRef<THREE.PlaneGeometry>(null);
  const size = (DEEP_RADIUS + 8) * 2;

  useFrame(({ clock }) => {
    const geo = geomRef.current;
    if (!geo) return;
    const pos = geo.attributes.position;
    const t = clock.getElapsedTime();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave = Math.sin(x * 0.45 + t * 1.1) * 0.16 + Math.sin(y * 0.7 + t * 0.7) * 0.1;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, 0]} receiveShadow>
      <planeGeometry ref={geomRef} args={[size, size, 60, 60]} />
      <meshStandardMaterial color={OCEAN_COLOR} roughness={0.4} metalness={0.05} transparent opacity={0.93} />
    </mesh>
  );
}
