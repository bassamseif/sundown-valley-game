import { useEffect, useMemo, useRef, useState } from "react";
import { Icosahedron, RoundedBox, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  WORDS,
  filledGraphemes,
  initialState,
  isFull,
  isSolved,
  nextWordId,
  pebblesFor,
  tapPebble,
  tapSlot,
  type ForgeState,
} from "../puzzles/soundForge";
import { glyphTexture } from "../engine/glyphTexture";
import { playPhoneme, playWordChime, preloadClips } from "../engine/audio";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";

const DISH_Y = 0.65;
const DISH_Z = 1.6;
const SLOT_Y = 1.55;
const SLOT_Z = 0.2;
const LANE_SPACING = 0.85;
const PEBBLE_RADIUS = 0.3;
const FLIGHT_DURATION = 0.35;

function laneX(count: number, i: number) {
  return (i - (count - 1) / 2) * LANE_SPACING;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// A single word's letter count deterministically picks a hue so every
// payoff crystal reads as distinct without per-word art.
function hueForWord(wordId: string): number {
  let hash = 0;
  for (let i = 0; i < wordId.length; i++) hash = (hash * 31 + wordId.charCodeAt(i)) >>> 0;
  return (hash % 360) / 360;
}

type PebbleProps = {
  grapheme: string;
  targetPos: readonly [number, number, number];
  wobbling: boolean;
  vanishing: boolean;
  onTap: () => void;
};

function Pebble({ grapheme, targetPos, wobbling, vanishing, onTap }: PebbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef(new THREE.Vector3(...targetPos));
  const endRef = useRef(new THREE.Vector3(...targetPos));
  const progressRef = useRef(1);
  const prevTarget = useRef(targetPos);
  const scaleRef = useRef(1);
  const pulseRef = useRef(0);
  const texture = useMemo(() => glyphTexture(grapheme), [grapheme]);

  useEffect(() => {
    if (
      prevTarget.current[0] !== targetPos[0] ||
      prevTarget.current[1] !== targetPos[1] ||
      prevTarget.current[2] !== targetPos[2]
    ) {
      startRef.current.copy(groupRef.current?.position ?? endRef.current);
      endRef.current.set(...targetPos);
      progressRef.current = 0;
      prevTarget.current = targetPos;
    }
  }, [targetPos]);

  function handleTap() {
    pulseRef.current = 1;
    onTap();
  }

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta / FLIGHT_DURATION);
      const t = easeOutCubic(progressRef.current);
      group.position.lerpVectors(startRef.current, endRef.current, t);
      group.position.y += Math.sin(Math.PI * progressRef.current) * 0.45; // arc peak mid-flight
    } else {
      group.position.copy(endRef.current);
    }

    if (wobbling) {
      group.rotation.z = Math.sin(performance.now() * 0.02) * 0.18;
    } else {
      group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 8, delta);
    }

    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 6, delta);
    const targetScale = vanishing ? 0 : 1 + pulseRef.current * 0.18;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, vanishing ? 5 : 10, delta);
    group.scale.setScalar(scaleRef.current);
  });

  return (
    <group ref={groupRef} position={targetPos} onClick={(e) => { e.stopPropagation(); handleTap(); }}>
      <Icosahedron args={[PEBBLE_RADIUS, 0]} castShadow>
        <meshPhysicalMaterial color="#c6a6ff" roughness={0.15} clearcoat={0.9} clearcoatRoughness={0.1} />
      </Icosahedron>
      <mesh position={[0, 0, PEBBLE_RADIUS * 0.85]}>
        <planeGeometry args={[0.34, 0.34]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function SlotRing({ position, filled }: { position: readonly [number, number, number]; filled: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = filled ? 0 : 0.35 + Math.sin(clock.getElapsedTime() * 2.5) * 0.15;
  });
  return (
    <mesh ref={ref} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[PEBBLE_RADIUS * 1.15, 0.03, 10, 24]} />
      <meshStandardMaterial color="#ffe9c7" emissive="#ffe9c7" emissiveIntensity={0.35} roughness={0.4} transparent opacity={filled ? 0 : 0.85} />
    </mesh>
  );
}

function PayoffObject({ wordId, visible }: { wordId: string; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const color = useMemo(() => new THREE.Color().setHSL(hueForWord(wordId), 0.55, 0.62), [wordId]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, visible ? 1 : 0, visible ? 5 : 9, delta);
    // slight scale overshoot on the way in
    const overshoot = visible ? 1 + Math.max(0, 1 - scaleRef.current) * 0.15 * Math.sin(scaleRef.current * Math.PI) : 1;
    group.scale.setScalar(scaleRef.current * overshoot);
    group.position.y = SLOT_Y - 0.3 + (visible ? Math.sin(clock.getElapsedTime() * 2) * 0.06 : 0);
    group.rotation.y = clock.getElapsedTime() * 0.4;
  });

  return (
    <group ref={groupRef} position={[0, SLOT_Y - 0.3, SLOT_Z - 0.5]} scale={0}>
      <RoundedBox args={[0.55, 0.55, 0.55]} radius={0.12} castShadow>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.2} clearcoat={0.8} />
      </RoundedBox>
    </group>
  );
}

export function SoundForgeScene() {
  const [seed] = useState(() => Date.now());
  const [state, setState] = useState<ForgeState>(() => initialState(WORDS[0].id, seed));
  const solved = useMemo(() => isSolved(state), [state]);
  const full = useMemo(() => isFull(state), [state]);
  const wobble = full && !solved;

  const pebbles = useMemo(() => pebblesFor(state.wordId), [state.wordId]);
  const graphemeById = useMemo(() => new Map(pebbles.map((p) => [p.id, p.grapheme])), [pebbles]);
  const count = pebbles.length;

  useEffect(() => {
    void preloadClips(pebbles.map((p) => p.phoneme));
  }, [pebbles]);

  const prevSolved = useRef(false);
  useEffect(() => {
    if (solved && !prevSolved.current) {
      void playWordChime(pebbles.map((p) => p.phoneme));
    }
    prevSolved.current = solved;
  }, [solved, pebbles]);

  function handlePebbleTap(pebbleId: string) {
    if (solved) return;
    const slotIndex = state.slots.indexOf(pebbleId);
    if (slotIndex !== -1) {
      const pebble = pebbles.find((p) => p.id === pebbleId);
      if (pebble) void playPhoneme(pebble.phoneme);
      setState((s) => tapSlot(s, slotIndex));
      return;
    }
    const pebble = pebbles.find((p) => p.id === pebbleId);
    if (pebble) void playPhoneme(pebble.phoneme);
    setState((s) => tapPebble(s, pebbleId));
  }

  function nextWord() {
    const id = nextWordId(state);
    setState(initialState(id, Date.now()));
  }

  useEffect(() => {
    exposeTestHook("forge", {
      tapPebble: handlePebbleTap,
      tapSlot: (i: number) => setState((s) => tapSlot(s, i)),
      reset: () => setState(initialState(state.wordId, Date.now())),
      nextWord,
      state,
      solved,
      correctOrder: pebbles.map((p) => p.id),
    });
  });

  const trayPositions = useMemo(
    () => Array.from({ length: count }, (_, i) => [laneX(count, i), DISH_Y, DISH_Z] as const),
    [count]
  );
  const slotPositions = useMemo(
    () => Array.from({ length: count }, (_, i) => [laneX(count, i), SLOT_Y, SLOT_Z] as const),
    [count]
  );

  const noneSlotted = state.slots.every((s) => s === null);

  const trayWidth = laneX(count, count - 1) * 2 + 1.1;

  return (
    <group>
      {/* tray */}
      <RoundedBox args={[trayWidth, 0.3, 1.0]} radius={0.1} position={[0, DISH_Y - 0.3, DISH_Z]} receiveShadow>
        <meshStandardMaterial color="#5c6690" roughness={0.6} metalness={0.2} />
      </RoundedBox>

      {state.slots.map((_, i) => (
        <SlotRing key={i} position={slotPositions[i]} filled={state.slots[i] !== null} />
      ))}

      {pebbles.map((p) => {
        const trayIndex = state.tray.indexOf(p.id);
        const slotIndex = state.slots.indexOf(p.id);
        const pos = trayIndex !== -1 ? trayPositions[trayIndex] : slotPositions[slotIndex];
        return (
          <group key={p.id}>
            {noneSlotted && trayIndex === 0 && !solved && <TapHint position={[pos[0], pos[1] + 0.5, pos[2]]} />}
            <Pebble
              grapheme={graphemeById.get(p.id) ?? p.grapheme}
              targetPos={pos}
              wobbling={wobble}
              vanishing={solved}
              onTap={() => handlePebbleTap(p.id)}
            />
          </group>
        );
      })}

      <PayoffObject wordId={state.wordId} visible={solved} />

      {solved && (
        <Sphere
          args={[0.7, 24, 24]}
          position={[0, SLOT_Y - 0.3, SLOT_Z - 0.5]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            nextWord();
          }}
        />
      )}
    </group>
  );
}
