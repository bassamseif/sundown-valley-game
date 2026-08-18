import { useEffect, useMemo, useRef, useState } from "react";
import { RoundedBox, Sphere } from "@react-three/drei";
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
  wordById,
  type ForgeState,
} from "../puzzles/soundForge";
import { engravedBumpTexture, engravedColorTexture, engravedGlowMask } from "../engine/engravedTexture";
import { playPhoneme, playSolveSequence, preloadClips } from "../engine/audio";
import { exposeTestHook } from "../engine/testHooks";

const DISH_Y = 0.65;
const DISH_Z = 1.6;
const SLOT_Y = 1.55;
const SLOT_Z = 0.2;
const LANE_SPACING = 1.05;
const PEBBLE_RADIUS = 0.3;
const FLIGHT_DURATION = 0.35;
// A pebble's full radius is its vertical extent once rotated to face
// the camera (not just its thin disc height) — seating it at DISH_Y
// sank it into the tray platform by that radius. Seat it above the
// tray's top surface instead, with a small gap.
const TRAY_TOP_Y = DISH_Y - 0.15; // tray box: position DISH_Y-0.3, height 0.3
const PEBBLE_SEAT_Y = TRAY_TOP_Y + PEBBLE_RADIUS + 0.03;

function laneX(count: number, i: number) {
  return (i - (count - 1) / 2) * LANE_SPACING;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// A hash-based hue clusters similar strings (e.g. "cat"/"c") together;
// stepping by the golden ratio from a stable per-word offset instead
// keeps letters within the same word visually well separated.
function hueFor(wordId: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < wordId.length; i++) hash = (hash * 31 + wordId.charCodeAt(i)) >>> 0;
  const base = (hash % 360) / 360;
  return (base + index * 0.61803398875) % 1;
}

type PebbleProps = {
  grapheme: string;
  hue: number;
  targetPos: readonly [number, number, number];
  wobbling: boolean;
  vanishing: boolean;
  floating: boolean;
  onTap: () => void;
};

function Pebble({ grapheme, hue, targetPos, wobbling, vanishing, floating, onTap }: PebbleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef(new THREE.Vector3(...targetPos));
  const endRef = useRef(new THREE.Vector3(...targetPos));
  const progressRef = useRef(1);
  const prevTarget = useRef(targetPos);
  const scaleRef = useRef(1);
  const pulseRef = useRef(0);
  const bobPhase = useRef(Math.random() * Math.PI * 2); // desynced so tray pebbles don't bob in lockstep
  const colorMap = useMemo(() => engravedColorTexture(grapheme, hue), [grapheme, hue]);
  const bumpMap = useMemo(() => engravedBumpTexture(grapheme), [grapheme]);
  const glowMask = useMemo(() => engravedGlowMask(grapheme), [grapheme]);
  const rimColor = useMemo(() => `#${new THREE.Color().setHSL(hue, 0.72, 0.62).getHexString()}`, [hue]);

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

  const materialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const rimMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);

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
      // Every still-tappable pebble invites a tap with its own gentle
      // bob — desynced per pebble — rather than a separate ring
      // floating elsewhere that doesn't say which object it refers to.
      if (floating) group.position.y += Math.sin(performance.now() * 0.0035 + bobPhase.current) * 0.06 + 0.06;
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

    if (materialRef.current) {
      const targetGlow = floating ? 0.22 + Math.sin(performance.now() * 0.0035 + bobPhase.current) * 0.12 : 0;
      materialRef.current.emissiveIntensity = THREE.MathUtils.damp(materialRef.current.emissiveIntensity, targetGlow, 8, delta);
      if (rimMaterialRef.current) rimMaterialRef.current.emissiveIntensity = materialRef.current.emissiveIntensity;
    }
  });

  return (
    <group ref={groupRef} position={targetPos} onClick={(e) => { e.stopPropagation(); handleTap(); }}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[PEBBLE_RADIUS, PEBBLE_RADIUS, PEBBLE_RADIUS * 0.75, 32]} />
        {/* side (rim) — plain crystal color, no letter: a cylinder's
            map/bumpMap otherwise wrap the same texture around the
            radial surface too, smearing the glyph around the edge */}
        <meshPhysicalMaterial
          ref={rimMaterialRef}
          attach="material-0"
          color={rimColor}
          emissive="#fff3d6"
          emissiveIntensity={0}
          roughness={0.15}
          metalness={0.2}
          clearcoat={0.9}
          clearcoatRoughness={0.06}
        />
        {/* top cap — faces the camera after the mesh's rotation; carries the engraved letter */}
        <meshPhysicalMaterial
          ref={materialRef}
          attach="material-1"
          map={colorMap}
          bumpMap={bumpMap}
          bumpScale={0.11}
          emissive="#fff3d6"
          emissiveMap={glowMask}
          emissiveIntensity={0}
          roughness={0.15}
          metalness={0.2}
          clearcoat={0.9}
          clearcoatRoughness={0.06}
        />
        {/* bottom cap — never visible from the fixed camera; plain is fine */}
        <meshPhysicalMaterial attach="material-2" color={rimColor} roughness={0.15} metalness={0.2} clearcoat={0.9} clearcoatRoughness={0.06} />
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
  const color = useMemo(() => new THREE.Color().setHSL(hueFor(wordId, 0), 0.55, 0.62), [wordId]);

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

  const wordAudioId = useMemo(() => wordById(state.wordId).wordAudio, [state.wordId]);

  useEffect(() => {
    void preloadClips([...pebbles.map((p) => p.phoneme), wordAudioId]);
  }, [pebbles, wordAudioId]);

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
    const next = tapPebble(state, pebbleId);
    // This tap is the one that completes the word — play its phoneme,
    // a success chime, then the word, scheduled back-to-back so the
    // letter is never skipped or overlapped by the word coming in.
    if (pebble && isSolved(next)) {
      void playSolveSequence(pebble.phoneme, wordAudioId);
    } else if (pebble) {
      void playPhoneme(pebble.phoneme);
    }
    setState(next);
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
    () => Array.from({ length: count }, (_, i) => [laneX(count, i), PEBBLE_SEAT_Y, DISH_Z] as const),
    [count]
  );
  const slotPositions = useMemo(
    () => Array.from({ length: count }, (_, i) => [laneX(count, i), SLOT_Y, SLOT_Z] as const),
    [count]
  );

  const trayWidth = laneX(count, count - 1) * 2 + 1.1;

  return (
    <group>
      {/* The backdrop's single moody sunset light left the engraved
          pebbles dark with a harsh hotspot. A soft key + fill + rim
          local to this scene reads the carved letters clearly from any
          angle without touching the shared environment lighting. */}
      <pointLight position={[-1.5, 4, 3]} intensity={3} color="#fff3e0" />
      <pointLight position={[2, 3.5, 2.5]} intensity={1.8} color="#cfe8ff" />

      {/* tray */}
      <RoundedBox args={[trayWidth, 0.3, 1.0]} radius={0.1} position={[0, DISH_Y - 0.3, DISH_Z]} receiveShadow>
        <meshStandardMaterial color="#5c6690" roughness={0.6} metalness={0.2} />
      </RoundedBox>

      {state.slots.map((_, i) => (
        <SlotRing key={i} position={slotPositions[i]} filled={state.slots[i] !== null} />
      ))}

      {pebbles.map((p, letterIndex) => {
        const trayIndex = state.tray.indexOf(p.id);
        const slotIndex = state.slots.indexOf(p.id);
        const pos = trayIndex !== -1 ? trayPositions[trayIndex] : slotPositions[slotIndex];
        return (
          <group key={p.id}>
            <Pebble
              grapheme={graphemeById.get(p.id) ?? p.grapheme}
              hue={hueFor(state.wordId, letterIndex)}
              targetPos={pos}
              wobbling={wobble}
              vanishing={solved}
              floating={trayIndex !== -1 && !solved}
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
