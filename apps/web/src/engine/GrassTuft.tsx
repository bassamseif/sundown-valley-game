import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { islandHeight } from "./terrain";

// A small, self-contained stylized grass blade, inspired by
// cortiz2894/stylized-components' grassField blade shader — same core
// idea (a blade strip from y=0 at the base to y=1 at the tip, wind
// swing masked by y*y so the base stays pinned, a base→tip color
// gradient) without that system's much larger machinery (GLB rewiring,
// dirt masks, rock trampling, per-blade soft shadows). This is decor
// for a few tufts near the palms, not a dune-covering field.
function bladeGeometry() {
  const geo = new THREE.BufferGeometry();
  // eslint-disable-next-line prettier/prettier
  const positions = new Float32Array([
    -0.05, 0, 0,
     0.05, 0, 0,
    -0.032, 0.55, 0,
     0.032, 0.55, 0,
     0, 1, 0,
  ]);
  const indices = [0, 1, 2, 1, 3, 2, 2, 3, 4];
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const BASE_GREEN = new THREE.Color("#2e6b34");
const TIP_GREEN = new THREE.Color("#9ed46a");

// The disc a tuft scatters blades over isn't flat — it's a patch of
// the same undulating dune noise the terrain mesh uses — so each
// blade needs its own ground height, not the one height sampled at
// the cluster's center. groundY is the world-space height at that
// center (what the group itself is positioned at), used to convert
// each blade's absolute terrain height back into a Y local to the
// group.
function buildInstanceMatrices(count: number, radius: number, seed: number, worldX: number, worldZ: number, groundY: number) {
  // Deterministic per-cluster scatter (mulberry32) so tufts don't
  // reshuffle every reload, matching the rest of the terrain's approach.
  let s = seed;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const matrices: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const rotY = rand() * Math.PI * 2;
    const height = 0.34 + rand() * 0.22;
    const width = 0.85 + rand() * 0.4;
    // The terrain mesh is a coarse, discretized approximation of this
    // same analytic function (linear between its own vertices) — a
    // blade seated at the exact analytic height can end up a hair
    // below that discretized surface in spots. A small constant lift
    // keeps every blade's base flush on top instead of clipped into it.
    const y = islandHeight(worldX + x, worldZ + z) - groundY + 0.04;

    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
      new THREE.Vector3(width, height, width)
    );
    matrices.push(m);
  }
  return matrices;
}

export function GrassTuft({
  position,
  radius = 0.9,
  count = 36,
  seed = 1,
}: {
  position: readonly [number, number, number];
  radius?: number;
  count?: number;
  seed?: number;
}) {
  const geometry = useMemo(() => bladeGeometry(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const uniformsRef = useRef<{ uTime: { value: number } } | null>(null);

  const matrices = useMemo(
    () => buildInstanceMatrices(count, radius, seed, position[0], position[2], position[1]),
    [count, radius, seed, position]
  );

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uBaseColor = { value: BASE_GREEN };
      shader.uniforms.uTipColor = { value: TIP_GREEN };
      uniformsRef.current = shader.uniforms as { uTime: { value: number } };

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying float vBH;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vBH = position.y;
          float hMask = vBH * vBH;
          vec3 wPos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float sway = sin(wPos.x * 0.6 + wPos.z * 0.4 + uTime * 1.6) * 0.14
                     + sin(wPos.x * 1.3 - wPos.z * 0.7 + uTime * 2.6 + 1.7) * 0.06;
          transformed.x += sway * hMask;
          transformed.z += sway * hMask * 0.4;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 uBaseColor;\nuniform vec3 uTipColor;\nvarying float vBH;"
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb = mix(uBaseColor, uTipColor, clamp(vBH, 0.0, 1.0));"
        );
    },
    []
  );

  useFrame(({ clock }) => {
    if (uniformsRef.current) uniformsRef.current.uTime.value = clock.getElapsedTime();
  });

  return (
    <instancedMesh
      ref={(m) => {
        meshRef.current = m;
        if (m) matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
        if (m) m.instanceMatrix.needsUpdate = true;
      }}
      args={[geometry, undefined, count]}
      position={position}
      castShadow
    >
      <meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} onBeforeCompile={onBeforeCompile} />
    </instancedMesh>
  );
}
