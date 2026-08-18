import { useMemo, useState } from "react";
import { RoundedBox, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { WaterFlow } from "../engine/WaterFlow";
import {
  SEGMENT_COUNT,
  initialOrientations,
  isOpen,
  isSolved,
  nextOrientation,
} from "../puzzles/pipeAlign";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";
import { useEffect } from "react";

const PIPE_LENGTH = 1.1;
const PIPE_RADIUS = 0.16;

function Pool({ solved }: { solved: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !solved) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
  });
  return (
    <Sphere ref={ref} args={[0.38, 32, 32]}>
      <meshPhysicalMaterial
        color={solved ? "#8ef0c4" : "#8291c4"}
        emissive={solved ? "#1c5c3f" : "#000000"}
        emissiveIntensity={solved ? 0.5 : 0}
        roughness={0.2}
        clearcoat={0.8}
      />
    </Sphere>
  );
}

// A real pipe: a hollow cylinder (you can see through the open ends,
// like an actual tube) with a ring flange at each end, that physically
// swings between "aligned with the pipeline" (open, water can pass)
// and "turned crossways" (closed, blocking it) — a rotation you can
// watch happen, not a shape that instantly swaps.
function PipeSegment({
  x,
  open,
  onTap,
  showHint,
}: {
  x: number;
  open: boolean;
  onTap: () => void;
  showHint: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Rotating around Y would swing the pipe into/out of the screen —
  // from this camera angle a "closed" pipe would foreshorten almost
  // end-on into a thin sliver, unreadable. Rotating around Z instead
  // keeps the whole swing inside the camera's view plane: open lies
  // flat along the pipeline, closed stands straight up, both clearly
  // legible silhouettes.
  const targetRotZ = open ? Math.PI / 2 : 0;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, targetRotZ, 10, delta);
  });

  const color = open ? "#7fe3c9" : "#8291c4";
  const emissive = open ? "#1c5c3f" : "#000000";
  const emissiveIntensity = open ? 0.4 : 0;

  return (
    <group position={[x, 0, 0]}>
      {showHint && <TapHint position={[0, 0.14, 0]} />}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onTap(); }}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, PIPE_LENGTH, 20, 1, true]} />
          <meshPhysicalMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.25} clearcoat={0.5} side={THREE.DoubleSide} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, (side * PIPE_LENGTH) / 2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[PIPE_RADIUS, 0.045, 10, 24]} />
            <meshStandardMaterial color="#5c6690" roughness={0.4} metalness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function PipeAlignScene() {
  const [orientations, setOrientations] = useState<number[]>(() => initialOrientations());
  const solved = useMemo(() => isSolved(orientations), [orientations]);
  const firstClosed = orientations.findIndex((o) => !isOpen(o));

  function tapSegment(i: number) {
    if (solved) return;
    setOrientations((prev) => prev.map((o, idx) => (idx === i ? nextOrientation(o) : o)));
  }

  function reset() {
    setOrientations(initialOrientations());
  }

  useEffect(() => {
    exposeTestHook("pipes", { tap: tapSegment, reset, solved, orientations });
  });

  // Spacing equals the pipe's own length so adjacent open segments'
  // flanges sit flush against each other — no visible gap once
  // they're lined up, like real connected pipe.
  const spacing = PIPE_LENGTH;
  const startX = -((SEGMENT_COUNT - 1) * spacing) / 2;
  const endOffset = PIPE_LENGTH / 2 + 0.32; // spring/pool spheres sit just past the last flange, no gap

  const flowCount = firstClosed === -1 ? SEGMENT_COUNT : firstClosed;
  const springEdgeX = startX - endOffset + 0.38;
  const flowEndX = flowCount === 0 ? springEdgeX : startX + (flowCount - 1) * spacing + PIPE_LENGTH / 2;
  const poolEdgeX = startX + (SEGMENT_COUNT - 1) * spacing + endOffset - 0.38;
  const flowLength = Math.max(0, (solved ? poolEdgeX : flowEndX) - springEdgeX);

  return (
    <group position={[0, 0.4, 0]}>
      {/* spring */}
      <group position={[startX - endOffset, 0, 0]}>
        <Sphere args={[0.38, 32, 32]}>
          <meshPhysicalMaterial color="#7fc4f0" emissive="#123a55" emissiveIntensity={0.35} roughness={0.2} clearcoat={0.8} />
        </Sphere>
      </group>
      {/* pool */}
      <group position={[startX + (SEGMENT_COUNT - 1) * spacing + endOffset, 0, 0]}>
        <Pool solved={solved} />
      </group>

      {/* riding just above the pipe's outer surface, not on its
          centerline — droplets on the centerline are hidden behind the
          opaque pipe wall for most of the run */}
      <WaterFlow startX={springEdgeX} length={flowLength} y={PIPE_RADIUS + 0.07} />

      {orientations.map((o, i) => (
        <PipeSegment
          key={i}
          x={startX + i * spacing}
          open={isOpen(o)}
          onTap={() => tapSegment(i)}
          showHint={i === firstClosed && !solved}
        />
      ))}

      {solved && (
        <RoundedBox
          args={[1.1, 0.5, 0.12]}
          radius={0.1}
          position={[0, -1.5, 2.2]}
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          castShadow
        >
          <meshStandardMaterial color="#7fe3c9" emissive="#0f3b30" emissiveIntensity={0.3} />
        </RoundedBox>
      )}
    </group>
  );
}
