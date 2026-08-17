import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Hypercasual, toon-flat ocean: a coarse plane whose vertices are
// displaced by two overlapping sine waves each frame. No shaders, no
// textures — cheap enough for a Chromebook and easy to reason about.
export function Ocean() {
  const geomRef = useRef<THREE.PlaneGeometry>(null);

  useFrame(({ clock }) => {
    const geo = geomRef.current;
    if (!geo) return;
    const pos = geo.attributes.position;
    const t = clock.getElapsedTime();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const wave = Math.sin(x * 0.45 + t * 1.1) * 0.18 + Math.sin(y * 0.7 + t * 0.7) * 0.12;
      pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, -16]} receiveShadow>
      <planeGeometry ref={geomRef} args={[44, 20, 56, 26]} />
      <meshStandardMaterial color="#2fb6c4" roughness={0.45} metalness={0.05} />
    </mesh>
  );
}
