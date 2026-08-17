import { useMemo } from "react";
import * as THREE from "three";
import { DEEP_RADIUS, islandHeight } from "./terrain";
import { OCEAN_COLOR } from "./Ocean";

const DRY_SAND = new THREE.Color("#e6cf9d");
const DRY_SAND_LIGHT = new THREE.Color("#f3e3b8");
const DRY_SAND_DARK = new THREE.Color("#cba873");
const WET_SAND = new THREE.Color("#a98a5c");
const OCEAN = new THREE.Color(OCEAN_COLOR);

function colorForHeight(h: number, x: number, z: number): THREE.Color {
  if (h > 0.15) {
    const n = Math.sin(x * 0.35 + z * 0.5) * 0.5 + Math.sin(x * 0.9 - z * 0.4) * 0.3;
    return n > 0
      ? DRY_SAND.clone().lerp(DRY_SAND_LIGHT, Math.min(n, 1))
      : DRY_SAND.clone().lerp(DRY_SAND_DARK, Math.min(-n, 1));
  }
  if (h > -0.15) {
    // waterline — a visibly wet strip of sand
    const t = (0.15 - h) / 0.3;
    return DRY_SAND_DARK.clone().lerp(WET_SAND, t);
  }
  if (h > -1.4) {
    // shallow — sand blending into the water color, per the "sand under
    // water should be blended with the ocean color" requirement
    const t = (-0.15 - h) / 1.25;
    return WET_SAND.clone().lerp(OCEAN, Math.min(t, 1));
  }
  return OCEAN.clone();
}

// A single terrain patch that surrounds the puzzle area on every side
// — not a flat pane you can orbit around the edge of. Flat at the
// center (where the puzzle sits), rises into dry sand dunes, then
// slopes down under the waterline, with vertex colors blending toward
// the ocean's color as it goes under — a real coastline, not a plane
// floating over a separate ocean plane.
export function Island() {
  const geometry = useMemo(() => {
    const size = (DEEP_RADIUS + 8) * 2;
    const segments = 110;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // local Y, maps to world Z after rotation
      const h = islandHeight(x, y);
      pos.setZ(i, h);
      const c = colorForHeight(h, x, y);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} />
    </mesh>
  );
}
