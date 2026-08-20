import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CoinValue } from "../../puzzles/marketDay";
import { panWorldPosition } from "./layout";
import { WeightPiece } from "./WeightPiece";

// A coin's target is either a fixed purse slot, or a slot on a platter
// whose world position moves every frame as the beam tilts — computed
// live from panWorldPosition rather than snapshotted once, so a coin
// resting on the scale keeps riding it.
export type CoinAnchor =
  | { kind: "purse"; pos: readonly [number, number, number] }
  | { kind: "platter"; side: "left" | "right"; local: readonly [number, number, number]; angleRef: React.MutableRefObject<number> };

function anchorTarget(anchor: CoinAnchor): readonly [number, number, number] {
  return anchor.kind === "purse" ? anchor.pos : panWorldPosition(anchor.side, anchor.angleRef.current, anchor.local);
}

type CoinProps = {
  value: CoinValue;
  anchor: CoinAnchor;
  // Undefined for a coin that isn't itself a tap target — e.g. a coin
  // already resting on the paid platter, where returning it is a tray
  // action (tap the platter, not the individual coin — see BalanceBeam's
  // onRightPlatterTap).
  onTap?: () => void;
  scale?: number;
  // A soft pulsing halo shown under the one coin the player should tap
  // next — a fallback affordance for when a child hasn't found the
  // right move on their own, not a default "everything is clickable"
  // decoration (see CLAUDE.md: touchability should read through the
  // object itself first).
  hinted?: boolean;
};

// A coin is a WeightPiece — the exact same shape family as the price's
// reference weights, just in a gold/copper finish — so what you pick
// up and what it's weighed against are visibly the same kind of thing.
//
// One React element, one Three.js object, for the coin's entire life:
// it never moves from the purse group to the platter group, so there
// is no remount and nothing to snapshot a "start position" from — it's
// simply damped toward whatever anchorTarget currently says, every
// frame, whether that's a fixed purse slot or a platter slot that's
// itself moving because the beam is tilting. Tapping it just swaps
// which anchor it's damping toward, so the whole purse-to-scale trip
// (and the ongoing ride once it's landed) is one continuous motion.
export function Coin({ value, anchor, onTap, scale = 1, hinted = false }: CoinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);
  const currentScaleRef = useRef(scale);
  const initialized = useRef(false);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const target = anchorTarget(anchor);

    if (!initialized.current) {
      group.position.set(target[0], target[1], target[2]);
      currentScaleRef.current = scale;
      initialized.current = true;
    } else {
      group.position.x = THREE.MathUtils.damp(group.position.x, target[0], 6, delta);
      group.position.z = THREE.MathUtils.damp(group.position.z, target[2], 6, delta);
      // A hop that's purely a function of remaining horizontal distance,
      // not a tracked travel progress: it rises while there's ground
      // left to cover and settles to exactly 0 as the coin arrives, so
      // it reads as one continuous up-then-down arc into the plate
      // rather than a flat slide that clips straight into it. Also
      // means it naturally stays flat (hop ≈ 0) while just riding an
      // already-landed platter's tilt, since horizontal distance to a
      // live platter target is small once settled.
      const horizDist = Math.hypot(target[0] - group.position.x, target[2] - group.position.z);
      const hop = Math.min(horizDist * 0.35, 0.45);
      group.position.y = THREE.MathUtils.damp(group.position.y, target[1] + hop, 6, delta);
      currentScaleRef.current = THREE.MathUtils.damp(currentScaleRef.current, scale, 6, delta);
    }

    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 6, delta);
    group.scale.setScalar(currentScaleRef.current * (1 + pulseRef.current * 0.16));
  });

  const color = value === 5 ? "#e8b93f" : "#c98a4b";

  return (
    <group
      ref={groupRef}
      onClick={
        onTap &&
        ((e) => {
          e.stopPropagation();
          pulseRef.current = 1;
          onTap();
        })
      }
    >
      <WeightPiece value={value} color={color} labelColor="#3a2410" outlineColor="#fff3d6" glowing={hinted} />
    </group>
  );
}
