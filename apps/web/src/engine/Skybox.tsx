import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sunState } from "./sunCycle";

// A hand-authored skybox: one large inverted sphere, unlit, colored
// entirely by a per-pixel vertical gradient (zenith -> horizon ->
// ground) plus a sun disc/halo — no HDR or image texture (that hung
// the whole scene the first time round, fetching from a blocked host;
// see git history). Fully offline, and the gradient stops are
// art-directable instead of physically simulated, so the sunset palette
// can just be whatever looks best.
const vertexShader = `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = dir.y;
    vec3 col = h > 0.0
      ? mix(uHorizon, uZenith, smoothstep(0.0, 0.6, h))
      : mix(uHorizon, uGround, smoothstep(0.0, -0.35, h));

    float sunDot = max(dot(dir, uSunDir), 0.0);
    float sunDisc = pow(sunDot, 2000.0) * 4.0;
    float sunHalo = pow(sunDot, 8.0) * 0.35;
    col += uSunColor * (sunDisc + sunHalo);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Skybox() {
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#bfe0ff") },
      uHorizon: { value: new THREE.Color("#fef2df") },
      uGround: { value: new THREE.Color("#cbb08a") },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color("#fff1c2") },
    }),
    []
  );

  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    const { dir, setProgress } = sunState(clock.getElapsedTime());
    uniforms.uSunDir.value.copy(dir);
    uniforms.uZenith.value.setHSL(
      THREE.MathUtils.lerp(0.58, 0.66, setProgress),
      THREE.MathUtils.lerp(0.68, 0.6, setProgress),
      THREE.MathUtils.lerp(0.72, 0.3, setProgress)
    );
    uniforms.uHorizon.value.setHSL(
      THREE.MathUtils.lerp(0.11, 0.05, setProgress),
      THREE.MathUtils.lerp(0.7, 0.95, setProgress),
      THREE.MathUtils.lerp(0.85, 0.6, setProgress)
    );
    uniforms.uGround.value.setHSL(THREE.MathUtils.lerp(0.09, 0.04, setProgress), 0.55, THREE.MathUtils.lerp(0.62, 0.4, setProgress));
    uniforms.uSunColor.value.setHSL(
      THREE.MathUtils.lerp(0.14, 0.06, setProgress),
      0.9,
      THREE.MathUtils.lerp(0.85, 0.65, setProgress)
    );
  });

  return (
    <mesh renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}
