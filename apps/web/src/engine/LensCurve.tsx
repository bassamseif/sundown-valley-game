import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Subtle barrel distortion so the horizon reads with a gentle curve,
// like a wide, slightly rounded lens — a "small friendly planet" feel
// rather than a flat plane, achieved purely as a camera/lens effect.
// No geometry changes: renders the normal scene to an offscreen
// target, then warps it onto a fullscreen quad on the way to screen.
const STRENGTH = 0.055;

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D tScene;
  uniform float strength;
  varying vec2 vUv;
  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float r2 = dot(centered, centered);
    vec2 warped = centered * (1.0 + strength * r2);
    vec2 uv = clamp(warped * 0.5 + 0.5, 0.0, 1.0);
    gl_FragColor = texture2D(tScene, uv);
  }
`;

export function LensCurve() {
  const { gl, scene, camera, size } = useThree();

  const target = useMemo(
    () => new THREE.WebGLRenderTarget(1, 1, { colorSpace: THREE.SRGBColorSpace }),
    []
  );

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    target.setSize(size.width * dpr, size.height * dpr);
  }, [gl, size, target]);

  useEffect(() => () => target.dispose(), [target]);

  const quadScene = useMemo(() => new THREE.Scene(), []);
  const quadCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const uniforms = useMemo(
    () => ({ tScene: { value: target.texture }, strength: { value: STRENGTH } }),
    [target]
  );
  useEffect(() => {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    quadScene.add(mesh);
    return () => {
      quadScene.remove(mesh);
      geometry.dispose();
      material.dispose();
    };
  }, [quadScene, uniforms]);

  // Priority > 0 hands R3F's default render loop over to us for this
  // frame — the documented escape hatch for a custom render pass —
  // so nothing double-renders the scene.
  useFrame(() => {
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(quadScene, quadCamera);
  }, 1);

  return null;
}
