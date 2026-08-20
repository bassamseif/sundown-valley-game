import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A fresnel rim shader: brightest at grazing angles (an object's own
// silhouette and edges), fading to nothing on faces looked at
// straight-on. Wraps any geometry passed as `children` in a slightly
// larger, additive, depth-testing (but not depth-writing) shell, so
// what's visible is a glowing outline that hugs that geometry's actual
// edges and shifts with viewing angle — reading as the object's own
// edges lighting up, not a flat sticker laid over it. Shared between
// WeightPiece (coins/reference weights) and anything else — like the
// purse tray — that should join the same hint affordance.
const RIM_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const RIM_FRAGMENT = /* glsl */ `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float rim = pow(1.0 - clamp(dot(vNormal, viewDir), 0.0, 1.0), 2.2);
    gl_FragColor = vec4(glowColor, rim * intensity);
  }
`;

export function RimGlow({
  glowing,
  scale = 1.06,
  rotation,
  position,
  color = "#ffd27f",
  children,
}: {
  glowing: boolean;
  scale?: number;
  rotation?: readonly [number, number, number];
  position?: readonly [number, number, number];
  color?: string;
  children: React.ReactNode;
}) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(color) },
      intensity: { value: 0 },
    }),
    [color],
  );
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    uniforms.intensity.value = glowing ? Math.sin(state.clock.elapsedTime * 3) * 0.6 + 1.4 : 0;
  });

  return (
    <mesh scale={scale} rotation={rotation as [number, number, number] | undefined} position={position as [number, number, number] | undefined}>
      {children}
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={RIM_VERTEX}
        fragmentShader={RIM_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
