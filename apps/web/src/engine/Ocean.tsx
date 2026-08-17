import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEEP_RADIUS } from "./terrain";

export const OCEAN_COLOR = "#2fb6c4";
export const OCEAN_Y = -0.08; // just below the island's flat sea-level baseline, no z-fighting

// The sea surface itself never moves — it's a flat, static, 2x2-vertex
// plane (no CPU per-vertex animation, no per-frame computeVertexNormals,
// no z-fighting risk from a wobbling mesh). "Waves" are a GPU-only
// fragment-shader ripple: we perturb the lighting normal with a couple
// of animated sine waves, so sunlight glints and shifts across the
// surface like real chop without moving a single vertex. One extra
// uniform update per frame; everything else is parallel per-pixel math
// the GPU already has to do for lighting — the cheapest way to fake
// motion that still reacts to the actual sun direction.
export function Ocean() {
  const uniformsRef = useRef<{ uTime: { value: number } } | null>(null);
  const size = (DEEP_RADIUS + 8) * 2;

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = { value: 0 };
      uniformsRef.current = shader.uniforms as { uTime: { value: number } };

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;"
        );

      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vWorldPos;")
        .replace(
          "#include <normal_fragment_begin>",
          `#include <normal_fragment_begin>
          {
            float w1 = sin(vWorldPos.x * 0.55 + uTime * 1.15);
            float w2 = sin(vWorldPos.z * 0.4 - uTime * 0.85 + vWorldPos.x * 0.2);
            vec3 ripple = normalize(vec3(w1 * 0.35, w2 * 0.35, 1.0));
            normal = normalize(mix(normal, ripple, 0.5));
          }`
        );
    },
    []
  );

  useFrame(({ clock }) => {
    if (uniformsRef.current) uniformsRef.current.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, 0]} receiveShadow>
      <planeGeometry args={[size, size, 2, 2]} />
      <meshStandardMaterial
        color={OCEAN_COLOR}
        roughness={0.3}
        metalness={0.05}
        transparent
        opacity={0.93}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}
