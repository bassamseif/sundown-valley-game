import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEEP_RADIUS, islandHeight, islandPondDepth } from "./terrain";
import { OCEAN_COLOR, OCEAN_Y } from "./Ocean";

const DRY_SAND = new THREE.Color("#e6cf9d");
const DRY_SAND_LIGHT = new THREE.Color("#f3e3b8");
const DRY_SAND_DARK = new THREE.Color("#cba873");
const WET_SAND = new THREE.Color("#a98a5c");
// A brighter, more saturated blue than the outer ocean's own teal —
// small ponds read as muddy/murky if they blend to OCEAN_COLOR over a
// long depth range, since most of a pond's shallow interior then
// never reaches a fully saturated color. Reaching this quickly (see
// the shortened blend below) is what makes a pond read as clear pool
// water instead of a stain in the sand.
const POND_COLOR = new THREE.Color(OCEAN_COLOR).offsetHSL(0, 0.15, 0.12);

function colorForHeight(h: number, x: number, z: number): THREE.Color {
  if (h > 0.15) {
    const n = Math.sin(x * 0.35 + z * 0.5) * 0.5 + Math.sin(x * 0.9 - z * 0.4) * 0.3;
    return n > 0
      ? DRY_SAND.clone().lerp(DRY_SAND_LIGHT, Math.min(n, 1))
      : DRY_SAND.clone().lerp(DRY_SAND_DARK, Math.min(-n, 1));
  }
  if (h > -0.15) {
    // waterline — a visibly wet strip of sand
    const t = (0.15 - h) / 0.3;
    return DRY_SAND_DARK.clone().lerp(WET_SAND, t);
  }
  if (h > -0.5) {
    // shallow — reaches full pond color quickly, since most puddles
    // never dip more than half a unit deep
    const t = (-0.15 - h) / 0.35;
    return WET_SAND.clone().lerp(POND_COLOR, Math.min(t, 1));
  }
  return POND_COLOR.clone();
}

// A single terrain patch that surrounds the puzzle area on every side
// — not a flat pane you can orbit around the edge of. Flat at the
// center (where the puzzle sits), rises into dry sand dunes, then
// slopes down under the waterline, with vertex colors blending toward
// the ocean's color as it goes under — a real coastline, not a plane
// floating over a separate ocean plane.
// Same hash/value-noise technique as Ocean.tsx's shoreline shimmer —
// duplicated rather than shared, since neither file imports from the
// other's shader internals today.
const FOAM_SHADER_HELPERS = `
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
  }
`;

export function Island() {
  const uniformsRef = useRef<{ uTime: { value: number } } | null>(null);

  const geometry = useMemo(() => {
    const size = (DEEP_RADIUS + 8) * 2;
    // Higher than the old 110: the foam band is much thinner than a
    // pre-existing 0.6-unit triangle, so its edge could only bend as
    // smoothly as the mesh itself — this is what made it look like
    // flat faceted polygons instead of an organic curve.
    const segments = 190;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const heights = new Float32Array(pos.count);
    const pondDepths = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // local Y, maps to world Z after rotation
      const h = islandHeight(x, y);
      pos.setZ(i, h);
      heights[i] = h;
      pondDepths[i] = islandPondDepth(x, y);
      const c = colorForHeight(h, x, y);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aHeight", new THREE.BufferAttribute(heights, 1));
    geo.setAttribute("aPondDepth", new THREE.BufferAttribute(pondDepths, 1));
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Foam driven by the real per-pixel local height field (not an
  // approximated radius) so it correctly hugs every land/water edge —
  // the outer coast AND every small noise-dipped puddle inside the
  // dune ring, since both are the same signal that already shapes
  // this mesh and its wet-sand vertex-color blend.
  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = { value: 0 };
      uniformsRef.current = shader.uniforms as { uTime: { value: number } };

      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float aHeight;\nattribute float aPondDepth;\nvarying float vHeight;\nvarying float vPondDepth;\nvarying vec3 vWorldPos;"
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvHeight = aHeight;\nvPondDepth = aPondDepth;\nvWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;"
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform float uTime;
          varying float vHeight;
          varying float vPondDepth;
          varying vec3 vWorldPos;
          float gFoamMask = 0.0;
          ${FOAM_SHADER_HELPERS}`
        )
        .replace(
          // color_fragment already multiplied diffuseColor by the
          // static wet-sand vertex color at this point — foam mixes in
          // on top of that base.
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            // The Ocean plane sits at world Y = OCEAN_Y, not at height
            // 0 — this is the exact height where the two meshes
            // physically cross, so foaming exactly there (rather than
            // an eyeballed offset toward "where it visually looks wet
            // enough") is the actual rim, not an approximation of it.
            float edgeNoise = (valueNoise(vWorldPos.xz * 0.7 + uTime * 0.04) - 0.5) * 0.07;
            float lap = sin(uTime * 1.3 + vWorldPos.x * 0.5 + vWorldPos.z * 0.3) * 0.02;
            // Only ever let the wobble pull the foam edge further INTO
            // the water (varying how far it reaches from the rim) —
            // never push it out past the true rim onto dry sand.
            float wobble = min(edgeNoise + lap, 0.0);
            float band = (vHeight - ${OCEAN_Y}) - wobble;

            // The dune's own noise texture crosses height 0 constantly
            // (that's the intended dry-sand ripple texture) — foaming
            // every one of those crossings turned the whole dune ring
            // into a white lattice. vPondDepth is the same height field
            // with that fine ripple octave dropped, so it only reads
            // negative over the broad, real dips — gating on it (while
            // still centering the foam band on the true waterline, so
            // the ring sits right at the visible edge, not down in the
            // pond's middle) skips the ripples and only rings the
            // ponds people can actually see. A hard step() here cut on
            // and off right at the pond's own noisy edge, producing
            // gaps in the ring wherever vPondDepth grazed the
            // threshold — a soft, wider range keeps the ring continuous.
            float gate = 1.0 - smoothstep(-0.22, -0.06, vPondDepth);

            float bandWidth = 0.18;
            float t = band / bandWidth;
            // One-sided: the whole soft transition sits at t < 0 (the
            // water side) and hard-cuts to exactly 0 at t = 0, so foam
            // can never bleed onto dry sand past the true rim.
            float aa = 0.4;
            float foamBand = (1.0 - smoothstep(-aa * 2.0, 0.0, t)) * smoothstep(-1.0 - aa, -1.0 + aa, t);

            float speckleField = valueNoise(vWorldPos.xz * 2.2 + uTime * 0.06);
            float speckleMask = step(0.82, speckleField);
            float speckleFade = smoothstep(-bandWidth * 3.0, 0.0, band) * step(band, 0.0);
            speckleMask *= speckleFade;

            float foamMask = clamp((foamBand + speckleMask * 0.6) * gate, 0.0, 1.0);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 1.0, 0.98), foamMask);
            gFoamMask = foamMask;
          }`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 1.0, 0.95) * gFoamMask * 0.4;`
        );
    },
    []
  );

  useFrame(({ clock }) => {
    if (uniformsRef.current) uniformsRef.current.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} onBeforeCompile={onBeforeCompile} />
    </mesh>
  );
}
