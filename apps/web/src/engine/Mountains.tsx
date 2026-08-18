import { useMemo } from "react";
import { DEEP_RADIUS } from "./terrain";

// A deterministic ring of low-poly peaks far beyond the island, purely
// for horizon silhouette — static geometry, no per-frame work. They sit
// past the ocean's own edge and rely on the scene's fog to fade toward
// the sky color, so distant peaks read as hazy and closer ones read a
// bit more solid, like real atmospheric perspective.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Exponential fog grows with distance squared, so anything much past
// the fog-tuned edge radius reads as fully fog-colored (flat white/pale
// in daylight) rather than hazy-but-visible. Keeping the ring close to
// the island's own edge keeps the peaks inside the part of the fog
// curve where they still read as colored, not washed out.
const RING_RADIUS = DEEP_RADIUS + 10;
const PEAK_COUNT = 14;
const MOUNTAIN_COLOR = "#6b74a8"; // cool, saturated blue-violet — needs to survive partial fog and still read as a hue, not just gray

type Cone = { x: number; z: number; y: number; height: number; baseRadius: number; rotation: number };

export function Mountains() {
  const cones = useMemo(() => {
    const rand = mulberry32(4242);
    const out: Cone[] = [];
    for (let i = 0; i < PEAK_COUNT; i++) {
      const angle = (i / PEAK_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.35;
      const radius = RING_RADIUS + (rand() - 0.5) * 10;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;

      // Each "peak" is a small cluster of 2-3 overlapping cones at
      // slightly different heights/widths/offsets — breaks up the
      // single obvious pyramid silhouette into an irregular ridge
      // without needing any per-vertex geometry hacking.
      const clusterSize = 2 + Math.floor(rand() * 2);
      for (let c = 0; c < clusterSize; c++) {
        const height = 8 + rand() * 15;
        const baseRadius = height * (0.6 + rand() * 0.4);
        const offsetAngle = rand() * Math.PI * 2;
        const offsetDist = rand() * baseRadius * 0.5;
        out.push({
          x: cx + Math.cos(offsetAngle) * offsetDist,
          z: cz + Math.sin(offsetAngle) * offsetDist,
          y: height / 2 - 3,
          height,
          baseRadius,
          rotation: rand() * Math.PI,
        });
      }
    }
    return out;
  }, []);

  return (
    <group>
      {cones.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={[0, c.rotation, 0]}>
          <coneGeometry args={[c.baseRadius, c.height, 8]} />
          <meshStandardMaterial color={MOUNTAIN_COLOR} roughness={1} flatShading fog />
        </mesh>
      ))}
    </group>
  );
}
