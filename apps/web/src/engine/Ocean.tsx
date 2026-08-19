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
          `#include <common>
          uniform float uTime;
          uniform vec3 uDeepColor;
          varying vec3 vWorldPos;
          float gFoamMask = 0.0;

          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float valueNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash21(i);
            float b = hash21(i + vec2(1.0, 0.0));
            float c = hash21(i + vec2(0.0, 1.0));
            float d = hash21(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }`
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

            // Toon-water-style foam: a crisp, organically-scalloped band
            // where the water meets the shore, instead of a smooth alpha
            // gradient — the "hard edge that hugs the geometry it
            // touches" look from ToonWaterShader-style techniques, done
            // here with an analytic shoreline radius rather than a full
            // scene-depth prepass, since the only thing our water ever
            // meets is this one shoreline.
            vec2 p = vWorldPos.xz;
            float angle = atan(p.y, p.x);
            vec2 edgeCoord = vec2(cos(angle), sin(angle)) * 3.2 + uTime * 0.035;
            float edgeNoise = (valueNoise(edgeCoord) - 0.5) * 2.6;
            float shoreR = ${DUNE_RADIUS.toFixed(1)} + edgeNoise;
            float lap = sin(uTime * 1.4 + edgeNoise * 4.0) * 0.3;
            float band = (dist - shoreR) - lap;

            float bandWidth = 1.5;
            float t = band / bandWidth;
            float aa = 0.08;
            float foamBand = smoothstep(-aa, aa, t) * (1.0 - smoothstep(1.0 - aa, 1.0 + aa, t));

            float speckleField = valueNoise(p * 1.6 + uTime * 0.08);
            float speckleMask = step(0.78, speckleField);
            float speckleFade = smoothstep(bandWidth + 2.6, bandWidth * 0.3, band);
            speckleMask *= speckleFade * step(-0.2, band);

            float foamMask = clamp(foamBand + speckleMask * 0.7, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.98), foamMask);
            diffuseColor.a = mix(diffuseColor.a, 1.0, foamMask);
            gFoamMask = foamMask;
          }`
        )
        .replace(
          // A thresholded pattern (smoothstep cutting a sine field)
          // reads as discrete blobs/spots at most viewing distances —
          // tried it, looked like a leopard print. Dropped the
          // threshold entirely: this is a continuous, low-amplitude
          // brightness wash — three overlapping sine fields at
          // different scales/directions, summed and normalized to
          // 0..1, no hard edge anywhere. Reads as gentle dappled
          // shimmer instead of spots, and still visibly animates.
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            vec2 p = vWorldPos.xz;
            float s1 = sin(p.x * 0.9 + p.y * 0.3 + uTime * 0.8);
            float s2 = sin(p.x * 0.35 - p.y * 1.1 - uTime * 0.55);
            float s3 = sin(p.x * 1.6 + p.y * 1.4 + uTime * 1.1) * 0.5;
            float shimmer = (s1 + s2 + s3) / 2.5 * 0.5 + 0.5;

            totalEmissiveRadiance += vec3(1.0, 0.98, 0.88) * shimmer * 0.1;
            totalEmissiveRadiance += vec3(1.0, 1.0, 0.95) * gFoamMask * 0.5;
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
