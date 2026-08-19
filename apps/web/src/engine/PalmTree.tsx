import { useMemo } from "react";
import * as THREE from "three";

// A single smoothly-tapered, smoothly-bent trunk instead of three
// straight cylinder segments glued at angled joints — the segmented
// version left visible kinks/gaps at each joint and each segment's
// own end caps showed through. Building one tube along a curve with
// a radius that tapers along its length reads as one consistent
// trunk instead of three mismatched pieces.
function buildTaperedTrunk(curve: THREE.Curve<THREE.Vector3>, radiusStart: number, radiusEnd: number) {
  const tubularSegments = 16;
  const radialSegments = 8;
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const point = curve.getPointAt(t);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const radius = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);

    for (let j = 0; j <= radialSegments; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = point.x + radius * (cos * normal.x + sin * binormal.x);
      const y = point.y + radius * (cos * normal.y + sin * binormal.y);
      const z = point.z + radius * (cos * normal.z + sin * binormal.z);
      positions.push(x, y, z);
    }
  }

  const ringSize = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringSize + j;
      const b = (i + 1) * ringSize + j;
      const c = (i + 1) * ringSize + j + 1;
      const d = i * ringSize + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A lance-shaped leaf outline (wide at the base, tapered to a point),
// extruded flat. This is what actually reads as "palm frond" instead
// of the pine-tree silhouette a cone gives you.
function useFrondGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.16, 0.05, 0.22, 0.18);
    shape.quadraticCurveTo(0.1, 0.16, 0, 0.14);
    shape.quadraticCurveTo(-0.1, 0.16, -0.22, 0.18);
    shape.quadraticCurveTo(-0.16, 0.05, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 8);
    geo.scale(1, 7.5, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
}

function Frond({ angle, droop, length }: { angle: number; droop: number; length: number }) {
  const geo = useFrondGeometry();
  return (
    <group rotation={[0, angle, 0]}>
      <group rotation={[droop, 0, 0]} scale={[1, 1, length]}>
        <mesh geometry={geo} castShadow>
          <meshStandardMaterial color="#3f9d5e" roughness={0.55} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// A low-poly but recognizably palm-shaped tree: bent trunk, a crown of
// drooping lance-shaped fronds fanned around the top, and a small
// coconut cluster. Deliberately stylized, not photoreal — matches the
// brief's "custom organic shapes" identity.
export function PalmTree({
  position,
  scale = 1,
  lean = 0.08,
}: {
  position: [number, number, number];
  scale?: number;
  lean?: number;
}) {
  const frondCount = 8;

  const trunkCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(lean * 1.4, 1.3, 0),
        new THREE.Vector3(lean * 3.2, 2.6, 0),
        new THREE.Vector3(lean * 4, 3.4, 0),
      ]),
    [lean]
  );
  const trunkGeo = useMemo(() => buildTaperedTrunk(trunkCurve, 0.17, 0.06), [trunkCurve]);
  const crownPos = useMemo(() => trunkCurve.getPointAt(1), [trunkCurve]);

  return (
    <group position={position} scale={scale}>
      <mesh geometry={trunkGeo} castShadow>
        <meshStandardMaterial color="#8a6a4a" roughness={0.8} />
      </mesh>

      <group position={[crownPos.x, crownPos.y, crownPos.z]}>
        {Array.from({ length: frondCount }).map((_, i) => (
          <Frond
            key={i}
            angle={(i / frondCount) * Math.PI * 2 + (i % 2) * 0.15}
            droop={0.55 + (i % 3) * 0.12}
            length={1.5 + (i % 2) * 0.3}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos(i * 2.1) * 0.08, -0.1, Math.sin(i * 2.1) * 0.08]} castShadow>
            <sphereGeometry args={[0.13, 6, 5]} />
            <meshStandardMaterial color="#6b4a30" roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
