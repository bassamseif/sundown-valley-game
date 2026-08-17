import { useMemo } from "react";
import * as THREE from "three";

// A flat plane with per-vertex color noise instead of a single flat
// color — reads as sand instead of a painted plastic slab.
export function Sand() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(22, 18, 30, 24);
    const pos = geo.attributes.position;
    const base = new THREE.Color("#e8cf9a");
    const dark = new THREE.Color("#cba873");
    const light = new THREE.Color("#f3e0b8");
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const n =
        Math.sin(x * 0.35 + y * 0.5) * 0.5 +
        Math.sin(x * 0.9 - y * 0.4) * 0.3 +
        Math.sin(x * 1.7 + y * 1.3) * 0.15;
      const c = n > 0 ? base.clone().lerp(light, Math.min(n, 1)) : base.clone().lerp(dark, Math.min(-n, 1));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}
