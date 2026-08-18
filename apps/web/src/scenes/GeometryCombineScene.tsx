import { useEffect, useRef, useState } from "react";
import { Float, Icosahedron, RoundedBox, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { CRYSTALS, TARGET_UNITS, isCorrectPair } from "../puzzles/geometryCombine";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";

const COLORS: Record<string, string> = {
  c1: "#7fe3c9",
  c2: "#ffb570",
  c3: "#c6a6ff",
  c4: "#ff8fb3",
};

const COMBINE_ANIM_MS = 320;

function scaleFor(units: number) {
  return 0.32 + units * 0.15;
}

// A single crystal that smoothly lifts when selected, wiggles when a
// wrong pair is tried, and shrinks away (rather than instantly
// vanishing) once it's been used in a correct combine.
function Crystal({
  id,
  x,
  s,
  isSelected,
  isWrong,
  isCombining,
  showHint,
  onTap,
}: {
  id: string;
  x: number;
  s: number;
  isSelected: boolean;
  isWrong: boolean;
  isCombining: boolean;
  showHint: boolean;
  onTap: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const wiggleT = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current || !meshRef.current) return;

    const targetY = isSelected ? s + 0.3 : s;
    meshRef.current.position.y = THREE.MathUtils.damp(meshRef.current.position.y, targetY, 10, delta);

    if (isWrong) {
      wiggleT.current += delta * 24;
      meshRef.current.rotation.z = Math.sin(wiggleT.current) * 0.18;
    } else {
      wiggleT.current = 0;
      meshRef.current.rotation.z = THREE.MathUtils.damp(meshRef.current.rotation.z, 0, 12, delta);
    }

    const targetScale = isCombining ? 0 : 1;
    const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 14, delta);
    groupRef.current.scale.setScalar(nextScale);
  });

  return (
    <group ref={groupRef} position={[x, 0, 1.6]}>
      {showHint && <TapHint position={[0, s, 0]} />}
      <Float speed={2} rotationIntensity={0.4} floatIntensity={isSelected ? 0 : 0.6}>
        <Icosahedron
          ref={meshRef}
          args={[s, 0]}
          position={[0, s, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onTap();
          }}
          castShadow
        >
          <meshPhysicalMaterial
            color={isWrong ? "#ff6b6b" : COLORS[id]}
            emissive={isSelected ? "#ffffff" : "#000000"}
            emissiveIntensity={isSelected ? 0.35 : 0}
            roughness={0.2}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
          />
        </Icosahedron>
      </Float>
    </group>
  );
}

export function GeometryCombineScene() {
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [usedIds, setUsedIds] = useState<string[]>([]);
  const [combiningIds, setCombiningIds] = useState<string[]>([]);

  function tapCrystal(id: string, units: number) {
    if (solved || usedIds.includes(id) || combiningIds.includes(id)) return;

    if (!selected) {
      setSelected(id);
      return;
    }
    if (selected === id) {
      setSelected(null);
      return;
    }

    const other = CRYSTALS.find((c) => c.id === selected)!;
    if (isCorrectPair(other.units, units)) {
      const pair = [selected, id];
      setSelected(null);
      setCombiningIds(pair);
      setTimeout(() => {
        setUsedIds(pair);
        setCombiningIds([]);
        setSolved(true);
      }, COMBINE_ANIM_MS);
    } else {
      setWrong(id);
      setTimeout(() => setWrong(null), 350);
      setSelected(null);
    }
  }

  function reset() {
    setSelected(null);
    setUsedIds([]);
    setCombiningIds([]);
    setSolved(false);
  }

  useEffect(() => {
    const tapById = (id: string) => {
      const c = CRYSTALS.find((c) => c.id === id);
      if (c) tapCrystal(c.id, c.units);
    };
    exposeTestHook("geometry", { tap: tapById, reset, solved, selected, usedIds });
  });

  return (
    <group>
      {/* target pedestal */}
      <group position={[0, 0.2, -1.6]}>
        <RoundedBox args={[1.7, 0.3, 1.7]} radius={0.08} position={[0, -0.15, 0]} receiveShadow>
          <meshStandardMaterial color="#8291c4" roughness={0.5} metalness={0.15} />
        </RoundedBox>
        {!solved && (
          <Icosahedron args={[scaleFor(TARGET_UNITS), 0]} position={[0, 0.85, 0]}>
            <meshStandardMaterial color="#ffffff" wireframe transparent opacity={0.3} />
          </Icosahedron>
        )}
        {solved && (
          <Physics>
            <RigidBody restitution={0.35} colliders="hull" position={[0, 3, 0]}>
              <Icosahedron args={[scaleFor(TARGET_UNITS), 0]} castShadow>
                <meshPhysicalMaterial
                  color="#ffdd8a"
                  emissive="#7a5000"
                  emissiveIntensity={0.5}
                  roughness={0.15}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                />
              </Icosahedron>
            </RigidBody>
            <Sparkles count={30} scale={2} position={[0, 1, 0]} size={3} speed={0.4} color="#ffe9b0" />
          </Physics>
        )}
      </group>

      {/* crystals to combine */}
      {CRYSTALS.map((c, i) => {
        if (usedIds.includes(c.id)) return null;
        const x = (i - 1.5) * 1.5;
        return (
          <Crystal
            key={c.id}
            id={c.id}
            x={x}
            s={scaleFor(c.units)}
            isSelected={selected === c.id}
            isWrong={wrong === c.id}
            isCombining={combiningIds.includes(c.id)}
            showHint={!selected && i === 0}
            onTap={() => tapCrystal(c.id, c.units)}
          />
        );
      })}

      {solved && (
        <RoundedBox
          args={[1.1, 0.5, 0.12]}
          radius={0.1}
          position={[0, 0.4, 3]}
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
