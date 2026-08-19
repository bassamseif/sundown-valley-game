import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEEP_RADIUS, DUNE_RADIUS } from "./terrain";

export const OCEAN_COLOR = "#2f8fe6";
const OCEAN_DEEP_COLOR = "#0a3d73";
export const OCEAN_Y = -0.08; // just below the island's flat sea-level baseline, no z-fighting

// Cel-shaded / toon water, adapted from cortiz2894/stylized-components'
// WaterFloor: Voronoi F1 − SmoothF1 gives a "cell edge" field that's ~0 at
// cell centers and rises toward cell boundaries; thresholding that hard
// (not smooth) is what gives the flat, cartoon "cracked glass" look real
// toon water shaders have, instead of the smooth painterly ripple our
// previous sine-wave version had. Ripple-ring uniforms are kept (so this
// stays close to the source shader) but never driven — there's no click
// interaction in this game to spawn them, so uRippleCount stays 0 and
// that whole loop is a no-op.
const VERT = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSmoothness;
  uniform float uEdgeThreshold;
  uniform float uEdgeSoftness;
  uniform float uFlowX;
  uniform float uFlowZ;
  uniform float uCellSpeed;
  uniform float uNoiseScale;
  uniform float uNoiseFlowSpeed;
  uniform float uDistortAmount;
  uniform vec3  uDeepColor;
  uniform vec3  uMidColor;
  uniform float uMidPos;
  uniform vec3  uHighlight;
  uniform float uOpacity;
  uniform float uDeepOpacity;
  uniform float uFadeDistance;
  uniform float uFadeStrength;
  uniform vec2  uCamXZ;

  uniform vec2  uRippleCenters[8];
  uniform float uRippleTimes[8];
  uniform int   uRippleCount;
  uniform float uRippleSpeed;
  uniform float uRippleWidth;
  uniform float uRippleStrength;
  uniform float uRippleDecay;
  uniform int   uRippleRings;
  uniform float uRippleSpacing;

  // radial depth cue this scene wants that the source shader doesn't
  // have — this water body is a fixed island with a real "further out
  // = deeper" gradient, not an infinite floor.
  uniform float uDuneRadius;
  uniform float uDeepRadius;

  varying vec2 vWorldPos;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k / 6.0;
  }

  vec2 cellPt(vec2 seed) {
    return 0.5 + 0.5 * sin(uTime * uCellSpeed + 6.2831 * seed);
  }

  float voronoiF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float md = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        md = min(md, length(n + pt - f));
      }
    return md;
  }

  float voronoiSF1(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float res = 8.0;
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec2 n = vec2(float(x), float(y));
        vec2 pt = cellPt(hash2(i + n));
        res = smin(res, length(n + pt - f), uSmoothness);
      }
    return res;
  }

  float nHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(nHash(i), nHash(i + vec2(1.0, 0.0)), f.x),
      mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 2; i++) { v += a * vnoise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 noiseUV = vWorldPos * uNoiseScale + vec2(uTime * uNoiseFlowSpeed, 0.0);
    float noiseFac = fbm(noiseUV);
    vec2 distort = vec2(noiseFac - 0.5) * uDistortAmount;

    vec2 uv = vWorldPos * uScale + vec2(uFlowX, uFlowZ) * uTime + distort;

    float f1 = voronoiF1(uv);
    float sf1 = voronoiSF1(uv);
    float edge = f1 - sf1;

    float t = smoothstep(
      uEdgeThreshold - uEdgeSoftness,
      uEdgeThreshold + uEdgeSoftness,
      edge
    );

    float safeMP = max(uMidPos, 1e-4);
    float seg0 = clamp(t / safeMP, 0.0, 1.0);
    float seg1 = clamp((t - safeMP) / max(1.0 - safeMP, 1e-4), 0.0, 1.0);
    float inSeg1 = step(safeMP, t);
    vec3 color = mix(
      mix(uDeepColor, uMidColor, seg0),
      mix(uMidColor, uHighlight, seg1),
      inSeg1
    );

    float rippleAcc = 0.0;
    for (int i = 0; i < 8; i++) {
      float isOn = step(float(i), float(uRippleCount) - 0.5);
      float elapsed = max(uTime - uRippleTimes[i], 0.0);
      float d = length(vWorldPos - uRippleCenters[i]);
      for (int r = 0; r < 4; r++) {
        float rIsOn = step(float(r), float(uRippleRings) - 0.5);
        float re = max(elapsed - float(r) * uRippleSpacing, 0.0);
        float ringR = re * uRippleSpeed;
        float ringDist = abs(d - ringR);
        float ring = 1.0 - smoothstep(0.0, uRippleWidth, ringDist);
        float fade = exp(-re * uRippleDecay);
        rippleAcc += ring * fade * isOn * rIsOn;
      }
    }
    float ripple = clamp(rippleAcc * uRippleStrength, 0.0, 1.0);
    color = mix(color, uHighlight, ripple);

    // Further from the island = deeper open sea, darkened on top of
    // the cell pattern rather than replacing it.
    float distFromIsland = length(vWorldPos);
    float depthT = smoothstep(uDuneRadius, uDeepRadius, distFromIsland);
    color = mix(color, uDeepColor, depthT * 0.45);

    float dist = length(vWorldPos - uCamXZ);
    float fade = 1.0 - pow(clamp(dist / uFadeDistance, 0.0, 1.0), uFadeStrength);

    float baseAlpha = mix(uDeepOpacity, 1.0, depthT);
    float alpha = mix(baseAlpha, 1.0, max(t, ripple)) * uOpacity * fade;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function Ocean() {
  const size = (DEEP_RADIUS + 8) * 2;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 0.3 },
          uSmoothness: { value: 0.55 },
          uEdgeThreshold: { value: 0.067 },
          uEdgeSoftness: { value: 0.012 },
          uFlowX: { value: 0 },
          uFlowZ: { value: 0.04 },
          uCellSpeed: { value: 0.3 },
          uNoiseScale: { value: 1.52 },
          uNoiseFlowSpeed: { value: 0.2 },
          uDistortAmount: { value: 0.3 },
          uDeepColor: { value: new THREE.Color(OCEAN_DEEP_COLOR) },
          uMidColor: { value: new THREE.Color(OCEAN_COLOR) },
          uMidPos: { value: 0.084 },
          uHighlight: { value: new THREE.Color("#f4fcff") },
          uOpacity: { value: 1.0 },
          uDeepOpacity: { value: 0.4 },
          uFadeDistance: { value: DEEP_RADIUS + 14 },
          uFadeStrength: { value: 1.4 },
          uCamXZ: { value: new THREE.Vector2() },
          uRippleCenters: { value: Array.from({ length: 8 }, () => new THREE.Vector2()) },
          uRippleTimes: { value: new Array(8).fill(0) },
          uRippleCount: { value: 0 },
          uRippleSpeed: { value: 1.5 },
          uRippleWidth: { value: 0.12 },
          uRippleStrength: { value: 5.5 },
          uRippleDecay: { value: 1.6 },
          uRippleRings: { value: 2 },
          uRippleSpacing: { value: 1.0 },
          uDuneRadius: { value: DUNE_RADIUS },
          uDeepRadius: { value: DEEP_RADIUS },
        },
      }),
    []
  );

  const materialRef = useRef(material);
  materialRef.current = material;

  useFrame(({ clock, camera }) => {
    const u = materialRef.current.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uCamXZ.value.set(camera.position.x, camera.position.z);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_Y, 0]}>
      <planeGeometry args={[size, size, 2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
