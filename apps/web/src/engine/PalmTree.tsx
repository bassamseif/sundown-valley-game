import { useMemo } from "react";
import * as THREE from "three";

// A lance-shaped leaf outline (wide at the base, tapered to a point),
// extruded flat. This is what actually reads as "palm frond" instead
// of the pine-tree silhouette a cone gives you.
function useFrondGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.16, 0.05, 0.22, 0.18);
    shape.quadraticCurveTo(0.1, 0.16, 0, 0.14);
    shape.quadraticCurveTo(-0.1, 0.16, -0.22, 0.18);
    shape.quadraticCurveTo(-0.16, 0.05, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 8);
    geo.scale(1, 7.5, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
}

function Frond({ angle, droop, length }: { angle: number; droop: number; length: number }) {
  const geo = useFrondGeometry();
  return (
    <group rotation={[0, angle, 0]}>
      <group rotation={[droop, 0, 0]} scale={[1, 1, length]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color="#3f9d5e" roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// A low-poly but recognizably palm-shaped tree: bent trunk, a crown of
// drooping lance-shaped fronds fanned around the top, and a small
// coconut cluster. Deliberately stylized, not photoreal — matches the
// brief's "custom organic shapes" identity.
export function PalmTree({
  position,
  scale = 1,
  lean = 0.08,
}: {
  position: [number, number, number];
  scale?: number;
  lean?: number;
}) {
  const frondCount = 8;

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, lean]} castShadow>
        <cylinderGeometry args={[0.11, 0.17, 2.2, 7]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} />
      </mesh>
      <mesh position={[lean * 3, 2.3, 0]} rotation={[0, 0.4, lean * 2]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 1.4, 7]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} />
      </mesh>
      <mesh position={[lean * 3.6, 2.95, 0]} rotation={[0, 0.4, lean * 2.6]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.6, 6]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} />
      </mesh>

      <group position={[lean * 4, 3.3, 0]}>
        {Array.from({ length: frondCount }).map((_, i) => (
          <Frond
            key={i}
            angle={(i / frondCount) * Math.PI * 2 + (i % 2) * 0.15}
            droop={0.55 + (i % 3) * 0.12}
            length={1.5 + (i % 2) * 0.3}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.08, -0.1, Math.sin(i * 2.1) * 0.08]} castShadow>
            <sphereGeometry args={[0.13, 6, 5]} />
            <meshStandardMaterial color="#6b4a30" roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
