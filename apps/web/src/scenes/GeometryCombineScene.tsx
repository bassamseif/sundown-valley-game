import { useEffect, useState } from "react";
import { Float, Icosahedron, RoundedBox, Sparkles } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import { CRYSTALS, TARGET_UNITS, isCorrectPair } from "../puzzles/geometryCombine";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";

const COLORS: Record<string, string> = {
  c1: "#7fe3c9",
  c2: "#ffb570",
  c3: "#c6a6ff",
  c4: "#ff8fb3",
};

function scaleFor(units: number) {
  return 0.32 + units * 0.15;
}

export function GeometryCombineScene() {
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [usedIds, setUsedIds] = useState<string[]>([]);

  function tapCrystal(id: string, units: number) {
    if (solved || usedIds.includes(id)) return;

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
      setUsedIds([selected, id]);
      setSelected(null);
      setSolved(true);
    } else {
      setWrong(id);
      setTimeout(() => setWrong(null), 350);
      setSelected(null);
    }
  }

  function reset() {
    setSelected(null);
    setUsedIds([]);
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
        const isSelected = selected === c.id;
        const isWrong = wrong === c.id;
        const s = scaleFor(c.units);
        return (
          <group key={c.id} position={[x, 0, 1.6]}>
            {!selected && i === 0 && <TapHint position={[0, s, 0]} />}
            <Float speed={2} rotationIntensity={0.4} floatIntensity={isSelected ? 0 : 0.6}>
              <Icosahedron
                args={[s, 0]}
                position={[0, s + (isSelected ? 0.3 : 0), 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  tapCrystal(c.id, c.units);
                }}
                castShadow
              >
                <meshPhysicalMaterial
                  color={isWrong ? "#ff6b6b" : COLORS[c.id]}
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
