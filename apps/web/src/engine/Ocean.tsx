import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEEP_RADIUS, DUNE_RADIUS } from "./terrain";

export const OCEAN_COLOR = "#2fb6c4";
const OCEAN_DEEP_COLOR = "#0d5866";
export const OCEAN_Y = -0.08; // just below the island's flat sea-level baseline, no z-fighting

// The sea surface itself never moves — flat, static, 2x2-vertex plane
// (no CPU per-vertex animation, no per-frame computeVertexNormals).
// Everything that reads as "real water" happens per-pixel in the
// fragment shader, all cheap:
//  - a rippled lighting normal from two animated sine waves, so
//    sunlight glints shift across the surface without moving geometry
//  - radial depth: color and opacity shift from a light, mostly
//    transparent shallow tint near the island (so the sand underneath
//    shows through) to a darker, more opaque deep-water color further
//    out — the actual depth cue that was missing
//  - a view-angle fresnel term so the water looks more reflective at
//    grazing angles and more transparent looking straight down, like
//    real water rather than a flat tinted pane
export function Ocean() {
  const uniformsRef = useRef<{ uTime: { value: number } } | null>(null);
  const size = (DEEP_RADIUS + 8) * 2;

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uDeepColor = { value: new THREE.Color(OCEAN_DEEP_COLOR) };
      uniformsRef.current = shader.uniforms as { uTime: { value: number } };

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldPos;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;"
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;\nuniform vec3 uDeepColor;\nvarying vec3 vWorldPos;"
        )
        .replace(
          // color_fragment (which sets diffuseColor) runs BEFORE
          // normal_fragment_begin in this shader, so both the ripple
          // normal and the depth/fresnel tint have to happen here,
          // after diffuseColor already exists and normal is computed.
          "#include <normal_fragment_begin>",
          `#include <normal_fragment_begin>
          {
            float w1 = sin(vWorldPos.x * 0.55 + uTime * 1.15);
            float w2 = sin(vWorldPos.z * 0.4 - uTime * 0.85 + vWorldPos.x * 0.2);
            vec3 ripple = normalize(vec3(w1 * 0.35, w2 * 0.35, 1.0));
            normal = normalize(mix(normal, ripple, 0.5));

            float dist = length(vWorldPos.xz);
            float depthT = smoothstep(${DUNE_RADIUS.toFixed(1)}, ${DEEP_RADIUS.toFixed(1)}, dist);
            diffuseColor.rgb = mix(diffuseColor.rgb, uDeepColor, depthT);

            vec3 viewDir = normalize(vViewPosition);
            float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

            float shallowAlpha = 0.32;
            float deepAlpha = 0.88;
            diffuseColor.a = mix(mix(shallowAlpha, deepAlpha, depthT), 1.0, fresnel * 0.6);
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
        roughness={0.25}
        metalness={0.05}
        transparent
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}
