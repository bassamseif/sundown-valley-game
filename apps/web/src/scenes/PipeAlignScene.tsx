import { useMemo, useState } from "react";
import { RoundedBox, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import {
  GRID_POSITIONS,
  POOL_GRID_POS,
  SEGMENT_COUNT,
  SPRING_GRID_POS,
  cellKind,
  initialOrientations,
  isCorrect,
  isSolved,
  nextOrientation,
  requiredRotation,
} from "../puzzles/pipeAlign";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";
import { useEffect } from "react";

const PIPE_LENGTH = 1.1;
const PIPE_RADIUS = 0.16;
const WATER_FULL_LEN = PIPE_LENGTH * 0.96;
const STUB_LEN = PIPE_LENGTH / 2;
const WATER_STUB_LEN = STUB_LEN * 0.96;

const GLASS_MATERIAL_PROPS = {
  color: "#dce8f5",
  transparent: true,
  opacity: 0.35,
  roughness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.08,
  side: THREE.DoubleSide,
  // Keep depthWrite off so the opaque water core inside stays visibly
  // "within" the glass rather than getting occluded by the glass's own
  // near/far surfaces. The elbow's overlapping glass parts (joint +
  // two stubs) are instead kept stable via explicit renderOrder below,
  // rather than depthWrite, which broke water-in-tube visibility.
  depthWrite: false,
} as const;

const WATER_MATERIAL_PROPS = {
  color: "#5fd8e8",
  emissive: "#0f5b66",
  emissiveIntensity: 0.7,
  roughness: 0.25,
} as const;

const FLANGE_MATERIAL_PROPS = { color: "#5c6690", roughness: 0.4, metalness: 0.3 } as const;

// Shortest-path angle interpolation — a plain numeric damp would spin
// the long way around whenever the rotation wraps past 270° back to 0°.
function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const twoPi = Math.PI * 2;
  let diff = ((target - current + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

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

type CellProps = {
  x: number;
  z: number;
  index: number;
  targetAngle: number;
  settledRef: MutableRefObject<boolean[]>;
  fillFracRef: MutableRefObject<number[]>;
  onTap: () => void;
  showHint: boolean;
};

// A straight glassy pipe with an inner water core that grows to fill
// it (rather than a separate effect floating above the pipe). Rotates
// around Y between the East-West axis (0°) and North-South axis (90°)
// — the two axes a straight piece can meaningfully occupy on a grid.
function StraightPipe({ x, z, index, targetAngle, settledRef, fillFracRef, onTap, showHint }: CellProps) {
  const groupRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      const rot = dampAngle(groupRef.current.rotation.y, targetAngle, 10, delta);
      groupRef.current.rotation.y = rot;
      const diff = Math.abs(((rot - targetAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      settledRef.current[index] = diff < 0.02;
    }
    if (waterRef.current) {
      const fillFrac = fillFracRef.current[index] ?? 0.001;
      // Same fixed local rotation as the glass tube (lies along local X
      // pre-rotation, becomes East-West or North-South together with
      // the outer group's Y rotation) — scale/position along local Y,
      // which is the tube's own length axis before that rotation.
      waterRef.current.scale.y = fillFrac;
      waterRef.current.position.y = (WATER_FULL_LEN / 2) * (1 - fillFrac);
      waterRef.current.visible = fillFrac > 0.02;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {showHint && <TapHint position={[0, 0.14, 0]} />}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onTap(); }}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, PIPE_LENGTH, 20, 1, false]} />
          <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
        </mesh>
        <mesh ref={waterRef} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.001, 1]}>
          <cylinderGeometry args={[PIPE_RADIUS * 0.72, PIPE_RADIUS * 0.72, WATER_FULL_LEN, 16]} />
          <meshStandardMaterial {...WATER_MATERIAL_PROPS} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[(side * PIPE_LENGTH) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[PIPE_RADIUS, 0.045, 10, 24]} />
            <meshStandardMaterial {...FLANGE_MATERIAL_PROPS} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// A 90-degree elbow: a rounded corner joint with two stubs reaching
// out to meet the neighboring cells, one along +X (East) and one along
// -Z (North) at rotation 0 — rotating the whole group around Y cycles
// through all four compass pairings a corner can connect.
function ElbowPipe({ x, z, index, targetAngle, settledRef, fillFracRef, onTap, showHint }: CellProps) {
  const groupRef = useRef<THREE.Group>(null);
  const waterERef = useRef<THREE.Mesh>(null);
  const waterNRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      const rot = dampAngle(groupRef.current.rotation.y, targetAngle, 10, delta);
      groupRef.current.rotation.y = rot;
      const diff = Math.abs(((rot - targetAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
      settledRef.current[index] = diff < 0.02;
    }
    const fillFrac = fillFracRef.current[index] ?? 0.001;
    const visible = fillFrac > 0.02;
    // Both stubs anchor at the corner (x=0 / z=0) and grow outward —
    // water arriving at the joint and spreading into both connected
    // directions. scale.y is each stub's own length axis pre-rotation
    // (matches its glass counterpart's rotation below).
    if (waterERef.current) {
      waterERef.current.scale.y = fillFrac;
      waterERef.current.position.x = (WATER_STUB_LEN / 2) * fillFrac;
      waterERef.current.visible = visible;
    }
    if (waterNRef.current) {
      waterNRef.current.scale.y = fillFrac;
      waterNRef.current.position.z = -(WATER_STUB_LEN / 2) * fillFrac;
      waterNRef.current.visible = visible;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {showHint && <TapHint position={[0, 0.14, 0]} />}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onTap(); }}>
        {/* corner joint */}
        <mesh castShadow renderOrder={1}>
          <sphereGeometry args={[PIPE_RADIUS * 1.05, 16, 16]} />
          <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
        </mesh>
        {/* East stub */}
        <mesh position={[STUB_LEN / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow renderOrder={2}>
          <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, STUB_LEN, 20, 1, false]} />
          <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
        </mesh>
        <mesh ref={waterERef} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.001, 1]}>
          <cylinderGeometry args={[PIPE_RADIUS * 0.72, PIPE_RADIUS * 0.72, WATER_STUB_LEN, 16]} />
          <meshStandardMaterial {...WATER_MATERIAL_PROPS} />
        </mesh>
        <mesh position={[STUB_LEN, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[PIPE_RADIUS, 0.045, 10, 24]} />
          <meshStandardMaterial {...FLANGE_MATERIAL_PROPS} />
        </mesh>
        {/* North stub */}
        <mesh position={[0, 0, -STUB_LEN / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow renderOrder={3}>
          <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, STUB_LEN, 20, 1, false]} />
          <meshPhysicalMaterial {...GLASS_MATERIAL_PROPS} />
        </mesh>
        <mesh ref={waterNRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.001, 1]}>
          <cylinderGeometry args={[PIPE_RADIUS * 0.72, PIPE_RADIUS * 0.72, WATER_STUB_LEN, 16]} />
          <meshStandardMaterial {...WATER_MATERIAL_PROPS} />
        </mesh>
        <mesh position={[0, 0, -STUB_LEN]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[PIPE_RADIUS, 0.045, 10, 24]} />
          <meshStandardMaterial {...FLANGE_MATERIAL_PROPS} />
        </mesh>
      </group>
    </group>
  );
}

export function PipeAlignScene() {
  const [orientations, setOrientations] = useState<number[]>(() => initialOrientations());
  const solved = useMemo(() => isSolved(orientations), [orientations]);
  const firstWrong = orientations.findIndex((o, i) => !isCorrect(i, o));

  // Per-cell rotation-settled flags and fill fractions live outside
  // React state (plain refs, mutated every frame) — a single cascade
  // pass below is the only thing allowed to set a cell's fill target,
  // walking spring -> pool along the fixed path order and only letting
  // a cell start filling once the one before it is substantially full.
  const settledRef = useRef<boolean[]>(Array(SEGMENT_COUNT).fill(false));
  const fillFracRef = useRef<number[]>(Array(SEGMENT_COUNT).fill(0.001));

  useFrame((_, delta) => {
    let upstreamReady = true; // the spring is always a ready source
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const eligible: boolean = isCorrect(i, orientations[i]) && settledRef.current[i] && upstreamReady;
      const target = eligible ? 1 : 0.001;
      const next = THREE.MathUtils.damp(fillFracRef.current[i], target, 2.4, delta);
      fillFracRef.current[i] = next;
      upstreamReady = eligible && next > 0.85;
    }
  });

  function tapSegment(i: number) {
    if (solved) return;
    setOrientations((prev) => prev.map((o, idx) => (idx === i ? nextOrientation(i, o) : o)));
  }

  function reset() {
    setOrientations(initialOrientations());
  }

  useEffect(() => {
    exposeTestHook("pipes", {
      tap: tapSegment,
      reset,
      solved,
      orientations,
      required: orientations.map((_, i) => requiredRotation(i)),
    });
  });

  const spacing = PIPE_LENGTH;
  const toWorld = (gx: number, gz: number) => [gx * spacing, gz * spacing] as const;

  return (
    <group position={[-spacing * 0.5, 0.4, -spacing * 1.5]}>
      {/* spring */}
      <group position={[toWorld(SPRING_GRID_POS.x, SPRING_GRID_POS.z)[0], 0, toWorld(SPRING_GRID_POS.x, SPRING_GRID_POS.z)[1]]}>
        <Sphere args={[0.38, 32, 32]}>
          <meshPhysicalMaterial color="#7fc4f0" emissive="#123a55" emissiveIntensity={0.35} roughness={0.2} clearcoat={0.8} />
        </Sphere>
      </group>
      {/* pool */}
      <group position={[toWorld(POOL_GRID_POS.x, POOL_GRID_POS.z)[0], 0, toWorld(POOL_GRID_POS.x, POOL_GRID_POS.z)[1]]}>
        <Pool solved={solved} />
      </group>

      {orientations.map((o, i) => {
        const [wx, wz] = toWorld(GRID_POSITIONS[i].x, GRID_POSITIONS[i].z);
        const props: CellProps = {
          x: wx,
          z: wz,
          index: i,
          targetAngle: o * (Math.PI / 2),
          settledRef,
          fillFracRef,
          onTap: () => tapSegment(i),
          showHint: i === firstWrong && !solved,
        };
        return cellKind(i) === "elbow" ? <ElbowPipe key={i} {...props} /> : <StraightPipe key={i} {...props} />;
      })}

      {solved && (
        <RoundedBox
          args={[1.1, 0.5, 0.12]}
          radius={0.1}
          position={[toWorld(POOL_GRID_POS.x, POOL_GRID_POS.z)[0], -1.1, toWorld(POOL_GRID_POS.x, POOL_GRID_POS.z)[1] + 1]}
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
