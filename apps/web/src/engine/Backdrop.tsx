import { RoundedBox } from "@react-three/drei";

// Warm, calm lighting leaning toward dusk — matches the project's sunset
// session identity even in these isolated test loops. Deliberately no
// Environment/HDR map: those fetch from a remote CDN, which both breaks
// offline play and violates the brief's no-third-party-network-dependency
// and <20MB-cold-load rules. All light here is local and procedural —
// a hemisphere light stands in for the sky/ground bounce an HDR would give.
export function Backdrop() {
  return (
    <>
      <color attach="background" args={["#2b3350"]} />
      <fog attach="fog" args={["#2b3350", 12, 26]} />
      <hemisphereLight args={["#8fb0ff", "#4a3a2a", 0.9]} />
      <ambientLight intensity={0.4} color="#ffd9a8" />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#ffb877" castShadow />
      <pointLight position={[-4, 3, 4]} intensity={0.6} color="#a6c9ff" />
      <pointLight position={[0, 3, -3]} intensity={0.45} color="#ffdca0" />
      <RoundedBox args={[16, 0.4, 16]} position={[0, -0.2, 0]} radius={0.08} receiveShadow>
        <meshStandardMaterial color="#3d4666" />
      </RoundedBox>
    </>
  );
}
