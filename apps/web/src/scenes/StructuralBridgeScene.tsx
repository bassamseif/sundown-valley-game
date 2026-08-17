import { useEffect, useRef, useState } from "react";
import { Float, RoundedBox, Sphere } from "@react-three/drei";
import { Physics, RigidBody, RapierRigidBody } from "@react-three/rapier";
import { PLANKS, SLOTS, fits, isBridgeComplete } from "../puzzles/structuralBridge";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";

const PLANK_COLORS: Record<string, string> = {
  p1: "#ffb570",
  p2: "#7fe3c9",
  p3: "#c6a6ff",
};

const PLATFORM_X = 4.1;

function BridgeRunner({ start }: { start: boolean }) {
  const ref = useRef<RapierRigidBody>(null);
  useEffect(() => {
    if (start && ref.current) {
      ref.current.applyImpulse({ x: 2.4, y: 0, z: 0 }, true);
    }
  }, [start]);
  return (
    <RigidBody ref={ref} colliders="ball" position={[-PLATFORM_X, 0.9, 0]} linearDamping={0.12}>
      <Sphere args={[0.28, 24, 24]} castShadow>
        <meshPhysicalMaterial color="#ffdd8a" emissive="#7a5000" emissiveIntensity={0.5} roughness={0.15} clearcoat={1} />
      </Sphere>
    </RigidBody>
  );
}

function slotPositions() {
  let x = -1.5;
  return SLOTS.map((slot) => {
    const pos = x;
    x += slot.requiredLength + 0.5;
    return { slot, x: pos };
  });
}

export function StructuralBridgeScene() {
  const [selectedPlank, setSelectedPlank] = useState<string | null>(null);
  const [filled, setFilled] = useState<Record<string, string | null>>({ s1: null, s2: null });
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);

  const usedPlankIds = Object.values(filled).filter(Boolean) as string[];
  const complete = isBridgeComplete(filled);
  const positions = slotPositions();

  function tapPlank(id: string) {
    if (usedPlankIds.includes(id) || complete) return;
    setSelectedPlank((cur) => (cur === id ? null : id));
  }

  function tapSlot(slotId: string) {
    if (filled[slotId] || !selectedPlank) return;
    const plank = PLANKS.find((p) => p.id === selectedPlank)!;
    const slot = SLOTS.find((s) => s.id === slotId)!;
    if (fits(plank, slot)) {
      setFilled((f) => ({ ...f, [slotId]: plank.id }));
      setSelectedPlank(null);
    } else {
      setWrongSlot(slotId);
      setTimeout(() => setWrongSlot(null), 350);
    }
  }

  function reset() {
    setFilled({ s1: null, s2: null });
    setSelectedPlank(null);
  }

  useEffect(() => {
    exposeTestHook("bridge", { tapPlank, tapSlot, reset, complete, filled, selectedPlank });
  });

  const firstEmptySlot = positions.find((p) => !filled[p.slot.id]);

  return (
    <group>
      {/* platforms */}
      <RoundedBox args={[2.2, 0.5, 1.6]} radius={0.08} position={[-PLATFORM_X, 0.65, 0]} receiveShadow>
        <meshStandardMaterial color="#6b7ab0" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[2.2, 0.5, 1.6]} radius={0.08} position={[PLATFORM_X, 0.65, 0]} receiveShadow>
        <meshStandardMaterial color="#6b7ab0" roughness={0.5} />
      </RoundedBox>

      {/* gap slots */}
      {positions.map(({ slot, x }) => {
        const plankId = filled[slot.id];
        return (
          <group key={slot.id} position={[x, 0.65, 0]}>
            {!plankId && (
              <>
                {firstEmptySlot?.slot.id === slot.id && selectedPlank && (
                  <TapHint position={[0, 0.25, 0]} />
                )}
                <RoundedBox
                  args={[slot.requiredLength * 1.1, 0.5, 1.6]}
                  radius={0.08}
                  onClick={(e) => {
                    e.stopPropagation();
                    tapSlot(slot.id);
                  }}
                >
                  <meshStandardMaterial
                    color={wrongSlot === slot.id ? "#ff6b6b" : "#3a4570"}
                    transparent
                    opacity={0.55}
                  />
                </RoundedBox>
              </>
            )}
            {plankId && !complete && (
              <RoundedBox args={[slot.requiredLength * 1.1, 0.5, 1.6]} radius={0.08} castShadow>
                <meshPhysicalMaterial color={PLANK_COLORS[plankId]} roughness={0.3} clearcoat={0.4} />
              </RoundedBox>
            )}
          </group>
        );
      })}

      {complete && (
        <Physics>
          <RigidBody type="fixed" colliders="cuboid" position={[-PLATFORM_X, 0.65, 0]}>
            <RoundedBox args={[2.2, 0.5, 1.6]} radius={0.08} visible={false} />
          </RigidBody>
          <RigidBody type="fixed" colliders="cuboid" position={[PLATFORM_X, 0.65, 0]}>
            <RoundedBox args={[2.2, 0.5, 1.6]} radius={0.08} visible={false} />
          </RigidBody>
          {positions.map(({ slot, x }) => (
            <RigidBody key={slot.id} type="fixed" colliders="cuboid" position={[x, 0.65, 0]}>
              <RoundedBox args={[slot.requiredLength * 1.1, 0.5, 1.6]} radius={0.08} castShadow>
                <meshPhysicalMaterial color={PLANK_COLORS[filled[slot.id]!]} roughness={0.3} clearcoat={0.4} />
              </RoundedBox>
            </RigidBody>
          ))}
          <BridgeRunner start={complete} />
        </Physics>
      )}

      {/* plank tray, right in front of the gap */}
      {PLANKS.map((p, i) => {
        if (usedPlankIds.includes(p.id)) return null;
        const isSelected = selectedPlank === p.id;
        const x = (i - 1) * 1.7;
        return (
          <group key={p.id} position={[x, 0, 2.6]}>
            {!selectedPlank && <TapHint position={[0, 0.3, 0]} />}
            <Float speed={2} rotationIntensity={0.15} floatIntensity={isSelected ? 0 : 0.4}>
              <RoundedBox
                args={[p.length * 1.1, 0.4, 0.9]}
                radius={0.08}
                position={[0, isSelected ? 0.55 : 0.3, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  tapPlank(p.id);
                }}
                castShadow
              >
                <meshPhysicalMaterial
                  color={PLANK_COLORS[p.id]}
                  emissive={isSelected ? "#ffffff" : "#000000"}
                  emissiveIntensity={isSelected ? 0.3 : 0}
                  roughness={0.3}
                  clearcoat={0.4}
                />
              </RoundedBox>
            </Float>
          </group>
        );
      })}

      {complete && (
        <RoundedBox
          args={[1.1, 0.5, 0.12]}
          radius={0.1}
          position={[0, 0.4, 2.6]}
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
