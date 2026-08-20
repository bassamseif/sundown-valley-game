import { Text } from "@react-three/drei";
import { footprintRadius, PLATTER_RADIUS, packOnPlatter } from "./layout";
import { RimGlow } from "./RimGlow";

// The one shape family every weighable thing in the scene is built
// from: a square-pyramid frustum (a real calibration-weight silhouette)
// stamped with its own denomination. A coin picked up from the purse
// and the reference weight it's being measured against are the same
// object, just recolored and resized by value — so "this is a weight"
// reads consistently everywhere it appears, not just on the scale.
export function WeightPiece({
  value,
  color,
  labelColor = "#0f3b30",
  outlineColor = "#eafff5",
  glowing = false,
}: {
  value: 1 | 5;
  color: string;
  labelColor?: string;
  outlineColor?: string;
  // Fallback tap affordance (see CLAUDE.md / Coin.tsx): the piece's own
  // edges light up in a warm rim glow, brightest at the silhouette and
  // fading on faces facing the camera — reads as the object's edges
  // glowing, not a flat mark added on top of it.
  glowing?: boolean;
}) {
  const height = value === 5 ? 0.2 : 0.12;
  const rTop = value === 5 ? 0.085 : 0.05;
  const rBottom = value === 5 ? 0.18 : 0.11;

  return (
    <group position={[0, height / 2, 0]}>
      <mesh castShadow rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[rTop, rBottom, height, 4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.25} />
      </mesh>
      <RimGlow glowing={glowing} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[rTop, rBottom, height, 4]} />
      </RimGlow>
      <Text
        position={[0, 0, rBottom * 0.78]}
        fontSize={height * 0.6}
        color={labelColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.004}
        outlineColor={outlineColor}
      >
        {value}
      </Text>
    </group>
  );
}

// A real-world calibration weight: a square-pyramid frustum (a
// standard weight-set silhouette) stamped with its own denomination,
// the same 1/5 split the coins use — so the price side reads as a
// small spread of labeled weights, not an uncountable pile of
// identical blocks. Two 5s and a 1 look like two big weights and a
// small one, laid out side by side, and say "5, 5, 1" when you tap
// through them.
function PriceWeight({ value, x, z }: { value: 1 | 5; x: number; z: number }) {
  const color = value === 5 ? "#3fae8f" : "#6fd0af";
  return (
    <group position={[x, 0, z]}>
      <WeightPiece value={value} color={color} />
    </group>
  );
}

// The price's own weight, decomposed into 5s and 1s and spread flat
// across the platter — a fixed reference on the left pan the paid-coin
// spread on the right pan is being weighed against.
export function PriceWeightStack({ price }: { price: number }) {
  const denominations: (1 | 5)[] = [];
  let left = price;
  while (left >= 5) {
    denominations.push(5);
    left -= 5;
  }
  while (left >= 1) {
    denominations.push(1);
    left -= 1;
  }

  const maxR = footprintRadius(denominations.includes(5) ? 5 : 1);
  const positions = packOnPlatter(denominations.length, maxR, PLATTER_RADIUS);

  return (
    <group>
      {denominations.map((value, i) => {
        const [x, , z] = positions[i];
        return <PriceWeight key={i} value={value} x={x} z={z} />;
      })}
    </group>
  );
}
