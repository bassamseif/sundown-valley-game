// Stylized, low-poly palm tree — cone-shaped fronds fanned around a
// bent trunk. Deliberately cartoonish to match the brief's "custom
// organic shapes" identity rather than a photoreal asset.
export function PalmTree({
  position,
  scale = 1,
  lean = 0.08,
}: {
  position: [number, number, number];
  scale?: number;
  lean?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, lean]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 2.2, 7]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} />
      </mesh>
      <mesh position={[lean * 3, 2.4, 0]} rotation={[0, 0, lean * 2.2]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 1.3, 7]} />
        <meshStandardMaterial color="#8a6a4a" roughness={0.85} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2;
        const crownX = lean * 3 + Math.cos(angle) * 0.35 * 0.5;
        const crownZ = Math.sin(angle) * 0.35 * 0.5;
        return (
          <mesh
            key={i}
            position={[crownX, 3.1, crownZ]}
            rotation={[Math.PI / 2.5, 0, angle]}
            castShadow
          >
            <coneGeometry args={[0.22, 1.7, 4]} />
            <meshStandardMaterial color="#3f9d5e" roughness={0.6} flatShading />
          </mesh>
        );
      })}
      <mesh position={[lean * 3, 3.35, 0]} castShadow>
        <sphereGeometry args={[0.22, 6, 5]} />
        <meshStandardMaterial color="#4fae6a" roughness={0.6} flatShading />
      </mesh>
    </group>
  );
}
