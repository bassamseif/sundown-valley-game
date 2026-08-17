import { useMemo, useState } from "react";
import { RoundedBox, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
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
        color={solved ? "#8ef0c4" : "#6b7ab0"}
        emissive={solved ? "#1c5c3f" : "#000000"}
        emissiveIntensity={solved ? 0.5 : 0}
        roughness={0.2}
        clearcoat={0.8}
      />
    </Sphere>
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

  const spacing = 1.35;
  const startX = -((SEGMENT_COUNT - 1) * spacing) / 2;

  return (
    <group position={[0, 0.4, 0]}>
      {/* spring */}
      <group position={[startX - 1.2, 0, 0]}>
        <Sphere args={[0.38, 32, 32]}>
          <meshPhysicalMaterial color="#7fc4f0" emissive="#123a55" emissiveIntensity={0.35} roughness={0.2} clearcoat={0.8} />
        </Sphere>
      </group>
      {/* pool */}
      <group position={[startX + (SEGMENT_COUNT - 1) * spacing + 1.2, 0, 0]}>
        <Pool solved={solved} />
      </group>

      {orientations.map((o, i) => {
        const open = isOpen(o);
        const x = startX + i * spacing;
        return (
          <group key={i} position={[x, 0, 0]}>
            {i === firstClosed && !solved && <TapHint position={[0, 0.14, 0]} />}
            <RoundedBox
              args={open ? [1.1, 0.3, 0.3] : [0.3, 0.3, 1.1]}
              radius={0.09}
              onClick={(e) => {
                e.stopPropagation();
                tapSegment(i);
              }}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color={open ? "#7fe3c9" : "#6b7ab0"}
                emissive={open ? "#1c5c3f" : "#000000"}
                emissiveIntensity={open ? 0.4 : 0}
                roughness={0.25}
                clearcoat={0.5}
              />
            </RoundedBox>
          </group>
        );
      })}

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
