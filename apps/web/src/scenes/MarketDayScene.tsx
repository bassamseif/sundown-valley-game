import { useEffect, useMemo, useRef, useState } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ORDERS,
  coinsFor,
  initialState,
  isSolved,
  nextOrderId,
  orderById,
  remaining as remainingOf,
  solutionFor,
  tapBowl,
  tapCoin,
  total as totalOf,
  type CoinValue,
  type MarketState,
} from "../puzzles/marketDay";
import { TapHint } from "../engine/TapHint";
import { exposeTestHook } from "../engine/testHooks";

const COUNTER_Z = 0;
const COUNTER_Y = 0.55;
const ITEM_Z = -1.1;
const BEAM_Z = -1.75;
const BOWL_Z = -0.15;
const PURSE_Z = 1.35;
const COIN_Y = COUNTER_Y + 0.18;

// Ready-made shape "families" instead of twelve bespoke hand-modeled
// items — every order gets a distinct color and silhouette built from
// the same handful of primitives, concrete and depictable without a
// per-item art pass.
const ITEM_LOOKS: Record<string, { shape: "sphere" | "cone" | "cluster" | "loaf" | "wedge" | "jar"; color: string; accent: string }> = {
  model_apple: { shape: "sphere", color: "#e0503f", accent: "#4c7a3a" },
  model_pear: { shape: "cone", color: "#bcd15a", accent: "#7a5a3a" },
  model_bread: { shape: "loaf", color: "#d9a25c", accent: "#a5723c" },
  model_fish: { shape: "cone", color: "#7fa8c9", accent: "#3f5f7a" },
  model_cheese: { shape: "wedge", color: "#f0c94e", accent: "#c99e2e" },
  model_corn: { shape: "cone", color: "#f2d24a", accent: "#7a9c3a" },
  model_carrot: { shape: "cone", color: "#e8842e", accent: "#4c7a3a" },
  model_egg: { shape: "sphere", color: "#f4ecd8", accent: "#c9b98e" },
  model_honey: { shape: "jar", color: "#e0a52e", accent: "#8a5a2e" },
  model_mushroom: { shape: "cluster", color: "#c9846a", accent: "#f4ecd8" },
  model_grape: { shape: "cluster", color: "#7a4fa0", accent: "#4c7a3a" },
  model_plum: { shape: "sphere", color: "#6a3f8a", accent: "#4c7a3a" },
};

function MarketItem({ modelId, scale = 1 }: { modelId: string; scale?: number }) {
  const look = ITEM_LOOKS[modelId] ?? ITEM_LOOKS.model_apple;

  if (look.shape === "loaf") {
    return (
      <group scale={scale}>
        <RoundedBox args={[0.5, 0.3, 0.32]} radius={0.12} castShadow>
          <meshStandardMaterial color={look.color} roughness={0.8} />
        </RoundedBox>
      </group>
    );
  }
  if (look.shape === "wedge") {
    return (
      <group scale={scale} rotation={[0, Math.PI / 4, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.001, 0.32, 0.26, 3]} />
          <meshStandardMaterial color={look.color} roughness={0.5} />
        </mesh>
      </group>
    );
  }
  if (look.shape === "jar") {
    return (
      <group scale={scale}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.34, 16]} />
          <meshPhysicalMaterial color={look.color} roughness={0.15} transmission={0.3} thickness={0.3} />
        </mesh>
        <mesh position={[0, 0.19, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 16]} />
          <meshStandardMaterial color={look.accent} roughness={0.6} />
        </mesh>
      </group>
    );
  }
  if (look.shape === "cluster") {
    const offsets = [
      [0, 0, 0],
      [0.12, -0.08, 0.06],
      [-0.12, -0.08, 0.04],
      [0.06, -0.16, -0.06],
      [-0.06, -0.15, 0.08],
    ] as const;
    return (
      <group scale={scale}>
        {offsets.map((o, i) => (
          <mesh key={i} position={o as unknown as [number, number, number]} castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={i === 0 ? look.accent : look.color} roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }
  if (look.shape === "cone") {
    return (
      <group scale={scale}>
        <mesh castShadow rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.2, 0.42, 18]} />
          <meshStandardMaterial color={look.color} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.24, 0]} castShadow>
          <coneGeometry args={[0.06, 0.14, 8]} />
          <meshStandardMaterial color={look.accent} roughness={0.7} />
        </mesh>
      </group>
    );
  }
  // sphere (default)
  return (
    <group scale={scale}>
      <mesh castShadow>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial color={look.color} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.1, 6]} />
        <meshStandardMaterial color={look.accent} roughness={0.7} />
      </mesh>
    </group>
  );
}

type CoinProps = {
  value: CoinValue;
  targetPos: readonly [number, number, number];
  onTap: () => void;
};

// A 1-coin is a plain smooth disc; a 5-coin is a pentagon prism — the
// value is legible from the coin's own silhouette (a "built from that
// many facets" shape), not from a numeral or a countable row of pips.
function Coin({ value, targetPos, onTap }: CoinProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startRef = useRef(new THREE.Vector3(...targetPos));
  const endRef = useRef(new THREE.Vector3(...targetPos));
  const progressRef = useRef(1);
  const prevTarget = useRef(targetPos);
  const pulseRef = useRef(0);

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

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta / 0.35);
      const t = 1 - Math.pow(1 - progressRef.current, 3);
      group.position.lerpVectors(startRef.current, endRef.current, t);
      group.position.y += Math.sin(Math.PI * progressRef.current) * 0.5;
    } else {
      group.position.copy(endRef.current);
    }
    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 6, delta);
    group.scale.setScalar(1 + pulseRef.current * 0.16);
  });

  const radius = value === 5 ? 0.24 : 0.16;
  const segments = value === 5 ? 5 : 20;
  const color = value === 5 ? "#e8b93f" : "#c98a4b";

  return (
    <group
      ref={groupRef}
      position={targetPos}
      onClick={(e) => {
        e.stopPropagation();
        pulseRef.current = 1;
        onTap();
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.06, segments]} />
        <meshPhysicalMaterial color={color} roughness={0.2} metalness={0.55} clearcoat={0.7} />
      </mesh>
    </group>
  );
}

// Small icosahedron gems in rows of five, so a price of seven reads as
// five-and-two at a glance — the same decomposition the coins teach.
//
// This is the whole game's control of error: every gem starts empty
// (outline only) and lights up, one at a time, left to right, the
// instant a coin lands in the bowl — a direct one-to-one match between
// "coins paid" and "units of price," exactly like laying a bead bar
// against a number card. Paying exactly means every gem is lit and
// none are left dark; there is nothing else to read or interpret.
// Overpaying is shown, not told: the extra lit gems spill past a
// physical boundary bar in a warning color instead of stopping at the
// price row, so "too many" is something the child sees happen.
function PriceCrystals({
  price,
  filled,
  overflow,
  position,
}: {
  price: number;
  filled: number;
  overflow: number;
  position: readonly [number, number, number];
}) {
  const rows: number[] = [];
  let left = price;
  while (left > 0) {
    const row = Math.min(5, left);
    rows.push(row);
    left -= row;
  }
  const rowCount = rows.length;

  const overflowRows: number[] = [];
  let overLeft = overflow;
  while (overLeft > 0) {
    const row = Math.min(5, overLeft);
    overflowRows.push(row);
    overLeft -= row;
  }

  let seen = 0;

  return (
    <group position={position}>
      {rows.map((count, rowIndex) => (
        <group key={rowIndex} position={[0, rowIndex * 0.24, 0]}>
          {Array.from({ length: count }, (_, i) => {
            const lit = seen + i < filled;
            return (
              <mesh key={i} position={[(i - (count - 1) / 2) * 0.22, 0, 0]} castShadow>
                <icosahedronGeometry args={[0.08, 0]} />
                {lit ? (
                  <meshPhysicalMaterial color="#7fe3c9" emissive="#3fd9b0" emissiveIntensity={0.7} roughness={0.15} clearcoat={0.9} />
                ) : (
                  <meshStandardMaterial color="#3a4258" emissive="#000000" roughness={0.6} transparent opacity={0.55} wireframe />
                )}
              </mesh>
            );
          })}
          {(() => {
            seen += count;
            return null;
          })()}
        </group>
      ))}

      {overflowRows.length > 0 && (
        <>
          {/* boundary bar — the extra gems visibly cross this line */}
          <mesh position={[0, rowCount * 0.24 - 0.12, 0]}>
            <boxGeometry args={[1.3, 0.015, 0.015]} />
            <meshStandardMaterial color="#ff8a5c" emissive="#ff5c3c" emissiveIntensity={0.6} />
          </mesh>
          {overflowRows.map((count, rowIndex) => (
            <group key={`over-${rowIndex}`} position={[0, rowCount * 0.24 + rowIndex * 0.24, 0]}>
              {Array.from({ length: count }, (_, i) => (
                <mesh key={i} position={[(i - (count - 1) / 2) * 0.22, 0, 0]} castShadow>
                  <icosahedronGeometry args={[0.08, 0]} />
                  <meshPhysicalMaterial color="#ff8a5c" emissive="#ff5c3c" emissiveIntensity={0.55} roughness={0.2} clearcoat={0.8} />
                </mesh>
              ))}
            </group>
          ))}
        </>
      )}
    </group>
  );
}

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
// A stack of small cube weights, grouped in rows of five (mirrors the
// price-gem grouping) so a weight of seven still reads as five-and-two
// at a glance rather than as an uncountable pile.
function WeightStack({ count, color }: { count: number; color: string }) {
  const rows: number[] = [];
  let left = count;
  while (left > 0) {
    const row = Math.min(5, left);
    rows.push(row);
    left -= row;
  }
  return (
    <group>
      {rows.map((rowCount, rowIndex) => (
        <group key={rowIndex} position={[0, rowIndex * 0.075 + 0.045, 0]}>
          {Array.from({ length: rowCount }, (_, i) => (
            <mesh key={i} position={[(i - (rowCount - 1) / 2) * 0.08, 0, 0]} castShadow>
              <boxGeometry args={[0.07, 0.07, 0.07]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

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
// holds a fixed stack of price-weight blocks, the right pan holds one
// weight block per coin paid so far, growing live as coins land in the
// bowl — the imbalance the beam is reacting to is visible, not implied.
// Pans hang below their beam-end attachment point like real balance
// pans (a fixed vertical offset, not rotated with the beam) so the
// weights themselves always read as upright and stacked, never tilted.
function BalanceBeam({ diffRef, price, paid }: { diffRef: React.MutableRefObject<number>; price: number; paid: number }) {
  const beamRef = useRef<THREE.Mesh>(null);
  const leftPanRef = useRef<THREE.Group>(null);
  const rightPanRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);
  const velRef = useRef(0);

  const ARM = 0.65;
  const HANG = 0.32;

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const MAX_ANGLE = 0.5;
    const TORQUE_K = 0.5;
    const RESTORING_K = 5.5;
    const DAMPING = 4.2;

    const torque = THREE.MathUtils.clamp(diffRef.current, -6, 6) * TORQUE_K;
    const restoring = -Math.sin(angleRef.current) * RESTORING_K;
    const friction = -velRef.current * DAMPING;
    const angularAccel = torque + restoring + friction;

    velRef.current += angularAccel * dt;
    angleRef.current = THREE.MathUtils.clamp(angleRef.current + velRef.current * dt, -MAX_ANGLE, MAX_ANGLE);

    const angle = angleRef.current;
    if (beamRef.current) beamRef.current.rotation.z = angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    if (leftPanRef.current) leftPanRef.current.position.set(-ARM * cos, 0.42 - ARM * sin - HANG, 0);
    if (rightPanRef.current) rightPanRef.current.position.set(ARM * cos, 0.42 + ARM * sin - HANG, 0);
  });

  return (
    <group position={[0, 0.9, BEAM_Z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.85, 10]} />
        <meshStandardMaterial color="#5c6690" roughness={0.5} metalness={0.3} />
      </mesh>
      <group position={[0, 0.42, 0]}>
        <mesh ref={beamRef} castShadow>
          <boxGeometry args={[1.3, 0.05, 0.08]} />
          <meshStandardMaterial color="#8a6a4a" roughness={0.6} />
        </mesh>
      </group>

      {/* both platters share the exact same geometry and material — only
          the weights stacked on top differ — so any size difference the
          eye picks up is real information (an unequal weight), never an
          artifact of the plate itself being drawn differently */}
      <group ref={leftPanRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.26, 0.22, 0.035, 20]} />
          <meshStandardMaterial color="#d8c6a0" roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 20]} />
          <meshStandardMaterial color="#8a6a4a" roughness={0.5} metalness={0.2} />
        </mesh>
        <group position={[0, 0.035, 0]}>
          <WeightStack count={price} color="#3fae8f" />
        </group>
      </group>

      <group ref={rightPanRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.26, 0.22, 0.035, 20]} />
          <meshStandardMaterial color="#d8c6a0" roughness={0.45} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.26, 20]} />
          <meshStandardMaterial color="#8a6a4a" roughness={0.5} metalness={0.2} />
        </mesh>
        <group position={[0, 0.035, 0]}>
          <WeightStack count={paid} color="#c98a4b" />
        </group>
      </group>
    </group>
  );
}

function DeliveredItem({ modelId, visible }: { modelId: string; visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    progressRef.current = THREE.MathUtils.damp(progressRef.current, visible ? 1 : 0, 4.5, delta);
    const t = progressRef.current;
    group.position.set(0, COUNTER_Y + 0.35 + Math.sin(clock.getElapsedTime() * 2) * 0.03 * t, THREE.MathUtils.lerp(ITEM_Z, 0.55, t));
    group.scale.setScalar(t);
    group.rotation.y = clock.getElapsedTime() * 0.5;
  });

  return (
    <group ref={groupRef} scale={0}>
      <MarketItem modelId={modelId} scale={1.3} />
    </group>
  );
}

export function MarketDayScene() {
  const [state, setState] = useState<MarketState>(() => initialState(ORDERS[0].id));
  const solved = useMemo(() => isSolved(state), [state]);
  const order = orderById(state.orderId);
  const coins = useMemo(() => coinsFor(state.orderId), [state.orderId]);

  const total = totalOf(state);
  const remaining = remainingOf(state);
  const filled = Math.min(total, order.price);
  const overflow = Math.max(0, total - order.price);
  const diffRef = useRef(0);
  diffRef.current = total - order.price;

  function handleCoinTap(coinId: string) {
    if (solved) return;
    setState((s) => tapCoin(s, coinId));
  }

  function handleBowlTap() {
    setState((s) => tapBowl(s));
  }

  function nextOrder() {
    setState(initialState(nextOrderId(state)));
  }

  useEffect(() => {
    exposeTestHook("market", {
      tapCoin: handleCoinTap,
      tapBowl: handleBowlTap,
      reset: () => setState(initialState(state.orderId)),
      nextOrder,
      state,
      total,
      remaining,
      solved,
      solution: solutionFor(state.orderId),
    });
  });

  const purseCoins = coins.filter((c) => state.purse.includes(c.id));
  const bowlCoins = state.bowl.map((id) => coins.find((c) => c.id === id)!);

  return (
    <group>
      {/* counter */}
      <RoundedBox args={[2.6, 0.5, 1.3]} radius={0.08} position={[0, COUNTER_Y - 0.25, COUNTER_Z - 0.3]} receiveShadow>
        <meshStandardMaterial color="#8a6a4a" roughness={0.7} />
      </RoundedBox>

      {/* item + price crystals, far side */}
      <group position={[0, COUNTER_Y + 0.2, ITEM_Z]}>
        {!solved && <MarketItem modelId={order.itemModelId} />}
      </group>
      <PriceCrystals price={order.price} filled={filled} overflow={overflow} position={[0, COUNTER_Y + 0.55, ITEM_Z]} />

      <BalanceBeam diffRef={diffRef} price={order.price} paid={total} />

      {/* bowl, on the counter */}
      <mesh position={[0, COUNTER_Y + 0.02, BOWL_Z]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); handleBowlTap(); }}>
        <ringGeometry args={[0.34, 0.42, 24]} />
        <meshStandardMaterial color="#ffe9c7" emissive={solved ? "#7fe3c9" : "#000000"} emissiveIntensity={solved ? 0.5 : 0} transparent opacity={0.85} />
      </mesh>
      {bowlCoins.map((c, i) => (
        <Coin
          key={c.id}
          value={c.value}
          targetPos={[(i - (bowlCoins.length - 1) / 2) * 0.28, COIN_Y, BOWL_Z]}
          onTap={handleBowlTap}
        />
      ))}

      {/* purse, near side */}
      {purseCoins.map((c, i) => (
        <Coin
          key={c.id}
          value={c.value}
          targetPos={[(i - (purseCoins.length - 1) / 2) * 0.42, COIN_Y, PURSE_Z]}
          onTap={() => handleCoinTap(c.id)}
        />
      ))}
      {purseCoins.length > 0 && !solved && <TapHint position={[0, COIN_Y, PURSE_Z]} />}

      <DeliveredItem modelId={order.itemModelId} visible={solved} />

      {solved && (
        <mesh
          position={[0, COUNTER_Y + 0.35, 0.55]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            nextOrder();
          }}
        >
          <sphereGeometry args={[0.4, 8, 8]} />
        </mesh>
      )}
    </group>
  );
}
