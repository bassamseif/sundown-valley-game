import { useMemo, useState } from "react";
import { RoundedBox, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type MutableRefObject } from "react";
import * as THREE from "three";
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
const WATER_FULL_LEN = PIPE_LENGTH * 0.96;

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

// A real pipe: a glassy hollow cylinder with a ring flange at each end,
// that physically swings between "aligned with the pipeline" (open)
// and "turned crossways" (closed) — a rotation you can watch happen.
// The tube itself is translucent so an inner "water" core is visible
// growing to fill it, rather than a separate effect floating above the
// pipe. This component only reports its own rotation-settled state and
// renders whatever fill fraction the scene's cascade controller has
// computed for it — it doesn't decide its own fill target, since that
// has to account for every upstream segment (see PipeAlignScene).
function PipeSegment({
  x,
  open,
  index,
  settledRef,
  fillFracRef,
  onTap,
  showHint,
}: {
  x: number;
  open: boolean;
  index: number;
  settledRef: MutableRefObject<boolean[]>;
  fillFracRef: MutableRefObject<number[]>;
  onTap: () => void;
  showHint: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  // Rotating around Y would swing the pipe into/out of the screen —
  // from this camera angle a "closed" pipe would foreshorten almost
  // end-on into a thin sliver, unreadable. Rotating around Z instead
  // keeps the whole swing inside the camera's view plane: open lies
  // flat along the pipeline, closed stands straight up, both clearly
  // legible silhouettes.
  const targetRotZ = open ? Math.PI / 2 : 0;

  useFrame((_, delta) => {
    if (groupRef.current) {
      const rot = THREE.MathUtils.damp(groupRef.current.rotation.z, targetRotZ, 10, delta);
      groupRef.current.rotation.z = rot;
      settledRef.current[index] = Math.abs(rot - targetRotZ) < 0.02;
    }
    if (waterRef.current) {
      const fillFrac = fillFracRef.current[index] ?? 0.001;
      // Local +Y maps to the spring side once rotated open, local -Y to
      // the pool side — anchor the filled end at +Y and grow the other
      // edge outward, so it reads as water flowing spring -> pool
      // rather than materializing from the center.
      waterRef.current.scale.y = fillFrac;
      waterRef.current.position.y = (WATER_FULL_LEN / 2) * (1 - fillFrac);
      waterRef.current.visible = fillFrac > 0.02;
    }
  });

  return (
    <group position={[x, 0, 0]}>
      {showHint && <TapHint position={[0, 0.14, 0]} />}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onTap(); }}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, PIPE_LENGTH, 20, 1, true]} />
          <meshPhysicalMaterial
            color="#dce8f5"
            transparent
            opacity={0.35}
            roughness={0.08}
            clearcoat={1}
            clearcoatRoughness={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={waterRef} scale={[1, 0.001, 1]}>
          <cylinderGeometry args={[PIPE_RADIUS * 0.72, PIPE_RADIUS * 0.72, WATER_FULL_LEN, 16]} />
          <meshStandardMaterial color="#5fd8e8" emissive="#0f5b66" emissiveIntensity={0.7} roughness={0.25} />
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

  // Per-segment rotation-settled flags and fill fractions live outside
  // React state (plain refs, mutated every frame) — a single cascade
  // pass below is the only thing allowed to set a segment's fill
  // target, walking spring -> pool in order and only letting a segment
  // start filling once the one before it is substantially full. That's
  // what makes newly-reconnected pipes fill one at a time instead of
  // every downstream segment popping full in parallel the instant a
  // gap closes.
  const settledRef = useRef<boolean[]>(Array(SEGMENT_COUNT).fill(false));
  const fillFracRef = useRef<number[]>(Array(SEGMENT_COUNT).fill(0.001));

  useFrame((_, delta) => {
    let upstreamReady = true; // the spring is always a ready source
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const eligible: boolean = isOpen(orientations[i]) && settledRef.current[i] && upstreamReady;
      const target = eligible ? 1 : 0.001;
      const next = THREE.MathUtils.damp(fillFracRef.current[i], target, 2.4, delta);
      fillFracRef.current[i] = next;
      upstreamReady = eligible && next > 0.85;
    }
  });

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

      {orientations.map((o, i) => (
        <PipeSegment
          key={i}
          x={startX + i * spacing}
          open={isOpen(o)}
          index={i}
          settledRef={settledRef}
          fillFracRef={fillFracRef}
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
