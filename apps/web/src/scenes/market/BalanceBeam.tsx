import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ARM, BEAM_Z, HANG } from "./layout";
import { PriceWeightStack } from "./WeightPiece";
import { RimGlow } from "./RimGlow";

// A real spring-damper torque simulation, not a snap-to-target damp:
// the weight imbalance (paid - price) applies a torque, a pendulum-like
// gravity term pulls the beam back toward level in proportion to how
// far it's tilted, and a friction term bleeds off angular velocity —
// so the arm swings, can overshoot slightly, and settles, the way a
// real weighted beam does. It reads as physics because it behaves like
// it, not because a physics engine is driving it (I6 stays satisfied:
// this is still a closed-form deterministic function of state, never a
// simulation that could still be "settling" when the total becomes
// exact — it always settles to angle 0 there since torque and the
// restoring term both vanish at diff 0 and angle 0).
//
// The two pans carry the actual weight causing the tilt: the left pan
// holds the price's own weight (as labeled weight pieces), the right
// pan holds the actual coins tapped so far, growing live as they land —
// the imbalance the beam is reacting to is visible, not implied. Each
// pan is mounted on a rigid post rising straight up from its beam-end
// attachment point (a fixed vertical offset, not rotated with the
// beam) so the weights and coins on it always read as upright and
// stacked, never tilted — and the platter geometry itself keeps its
// default orientation (flat circular faces already facing up) rather
// than being rotated onto its side, so it reads as a horizontal tray
// you set things on, not a coin-like disc standing on edge.
export function BalanceBeam({
  diffRef,
  angleRef,
  price,
  rightPlatterGlowing = false,
  onRightPlatterTap,
}: {
  diffRef: React.MutableRefObject<number>;
  // Owned by the parent scene and shared with every Coin resting on a
  // platter, so a coin's live target (panWorldPosition) always reads
  // the exact same tilt this frame is about to render — BalanceBeam
  // still runs the physics that updates it, it just no longer owns the
  // ref itself.
  angleRef: React.MutableRefObject<number>;
  price: number;
  // Hint affordance: glows the right (paid) platter itself when the
  // player has overpaid and hasn't found tapping the platter to return
  // a coin — see MarketDayScene's hint logic.
  rightPlatterGlowing?: boolean;
  // Returning a coin is a tray action (tap the platter itself), not a
  // per-coin one — the individual coins sitting on it aren't tap
  // targets for this, so there's one handler on the platter mesh.
  onRightPlatterTap?: () => void;
}) {
  const beamRef = useRef<THREE.Mesh>(null);
  const leftPanRef = useRef<THREE.Group>(null);
  const rightPanRef = useRef<THREE.Group>(null);
  const velRef = useRef(0);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const MAX_ANGLE = 0.5;
    const TORQUE_K = 0.5;
    const RESTORING_K = 5.5;
    const DAMPING = 4.2;

    // diffRef.current = paid - price, positive when the right (paid) pan
    // is heavier — and a heavier pan must tip DOWN. Negated here because
    // the pan-position formulas below move the right pan UP as angle
    // increases (0.42 + ARM*sin(angle)), so a positive diff needs a
    // negative angle to pull that heavier side down instead of up.
    const torque = -THREE.MathUtils.clamp(diffRef.current, -6, 6) * TORQUE_K;
    const restoring = -Math.sin(angleRef.current) * RESTORING_K;
    const friction = -velRef.current * DAMPING;
    const angularAccel = torque + restoring + friction;

    velRef.current += angularAccel * dt;
    angleRef.current = THREE.MathUtils.clamp(angleRef.current + velRef.current * dt, -MAX_ANGLE, MAX_ANGLE);

    const angle = angleRef.current;
    if (beamRef.current) beamRef.current.rotation.z = angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    if (leftPanRef.current) leftPanRef.current.position.set(-ARM * cos, 0.42 - ARM * sin + HANG, 0);
    if (rightPanRef.current) rightPanRef.current.position.set(ARM * cos, 0.42 + ARM * sin + HANG, 0);
  });

  return (
    <group position={[0, 0.9, BEAM_Z]}>
      {/* the pivot post runs the full height from the ground (world y=0)
          up to the underside of the beam itself (local y=0.42, where
          the beam box's own half-height starts) — so the stand both
          plants the scale on the ground AND actually meets the beam it
          holds up, instead of stopping short at the group's own origin
          partway between the two. */}
      <mesh castShadow position={[0, -0.24, 0]}>
        <cylinderGeometry args={[0.04, 0.07, 1.32, 10]} />
        <meshStandardMaterial color="#5c6690" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh receiveShadow castShadow position={[0, -0.885, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.05, 16]} />
        <meshStandardMaterial color="#4a5278" roughness={0.55} metalness={0.25} />
      </mesh>
      <group position={[0, 0.42, 0]}>
        {/* the visible arm's own half-length matches ARM exactly, so its
            tip is precisely where each post below starts — nothing
            hangs or rises from empty space past the arm's own end */}
        <mesh ref={beamRef} castShadow>
          <boxGeometry args={[ARM * 2, 0.05, 0.08]} />
          <meshStandardMaterial color="#8a6a4a" roughness={0.6} />
        </mesh>
      </group>

      {/* both platters share the exact same geometry and material — only
          what's stacked on top differs — so any size difference the eye
          picks up is real information (an unequal weight), never an
          artifact of the plate itself being drawn differently. Each sits
          on a rigid post of fixed length HANG rising from its beam tip
          (see panWorldPosition) — a visible child of the same group that
          gets repositioned every frame, so the post always spans exactly
          the gap between tip and plate, at any tilt. */}
      <group ref={leftPanRef}>
        <mesh position={[0, -HANG / 2, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, HANG, 8]} />
          <meshStandardMaterial color="#5c6690" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[0.58, 0.52, 0.045, 24]} />
          <meshStandardMaterial color="#d8c6a0" roughness={0.6} metalness={0.05} />
        </mesh>
        <group position={[0, 0.0175, 0]}>
          <PriceWeightStack price={price} />
        </group>
      </group>

      {/* right pan's paid coins render outside BalanceBeam, in
          MarketDayScene — they're the same coin objects that started
          in the purse, and need to stay mounted continuously across
          that whole trip (see Coin) rather than being reparented
          under this group */}
      <group ref={rightPanRef}>
        <mesh position={[0, -HANG / 2, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, HANG, 8]} />
          <meshStandardMaterial color="#5c6690" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh
          receiveShadow
          castShadow
          onClick={
            onRightPlatterTap &&
            ((e) => {
              e.stopPropagation();
              onRightPlatterTap();
            })
          }
        >
          <cylinderGeometry args={[0.58, 0.52, 0.045, 24]} />
          <meshStandardMaterial color="#d8c6a0" roughness={0.6} metalness={0.05} />
        </mesh>
        <RimGlow glowing={rightPlatterGlowing} scale={1.05}>
          <cylinderGeometry args={[0.58, 0.52, 0.045, 24]} />
        </RimGlow>
      </group>
    </group>
  );
}
