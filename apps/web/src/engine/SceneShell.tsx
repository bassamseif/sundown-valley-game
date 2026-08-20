import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { Backdrop } from "./Backdrop";
import { ShaderWarmup } from "./ShaderWarmup";

type Props = React.PropsWithChildren<{
  cameraPosition?: [number, number, number];
  target?: [number, number, number];
  maxDistance?: number;
}>;

// Smoothly tweens the live camera position and orbit target toward
// whatever cameraPosition/target this frame's props say — so switching
// which loop is framed (including the menu's own zoomed-out framing)
// reads as the camera flying there, not a hard cut. Runs unconditionally
// on mount (so the very first frame is also a "fly in" rather than
// spawning already in place) and again for TRANSITION_MS after either
// prop actually changes value; outside that window it does nothing, so
// a player free-orbiting mid-puzzle is never fought by this every frame.
const TRANSITION_MS = 1700;

function CameraRig({ cameraPosition, target }: { cameraPosition: [number, number, number]; target: [number, number, number] }) {
  const { camera, controls } = useThree();
  const activeUntilRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      // First-ever framing (whatever's current when the persistent
      // Canvas first mounts, i.e. the menu) — snap straight there
      // instead of flying in from three's arbitrary default camera
      // position, since that start point isn't a real shot of
      // anything.
      camera.position.set(...cameraPosition);
      const oc = controls as OrbitControlsImpl | null;
      if (oc) {
        oc.target.set(...target);
        oc.update();
      }
      mountedRef.current = true;
      return;
    }
    activeUntilRef.current = performance.now() + TRANSITION_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPosition[0], cameraPosition[1], cameraPosition[2], target[0], target[1], target[2]]);

  useFrame((_, delta) => {
    if (performance.now() > activeUntilRef.current) return;
    const dampFactor = 2.6;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraPosition[0], dampFactor, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraPosition[1], dampFactor, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraPosition[2], dampFactor, delta);

    const oc = controls as OrbitControlsImpl | null;
    if (oc) {
      oc.target.x = THREE.MathUtils.damp(oc.target.x, target[0], dampFactor, delta);
      oc.target.y = THREE.MathUtils.damp(oc.target.y, target[1], dampFactor, delta);
      oc.target.z = THREE.MathUtils.damp(oc.target.z, target[2], dampFactor, delta);
      oc.update();
    }
  });

  return null;
}

// One Canvas for the whole app, mounted once and never torn down — the
// menu is this same beach/sun scene zoomed out, and picking a loop just
// tweens the camera in to that loop's own framing (see CameraRig) rather
// than swapping to a freshly-mounted scene. Manual orbit optional, never
// required to solve a puzzle — mirrors the smart-follow-camera invariant
// from the brief for these single-screen test loops. Each scene (or the
// menu) passes the framing that fits it.
// A stable object reference, defined once at module scope rather than
// as a fresh literal inside SceneShell's render — R3F re-applies the
// Canvas `camera` prop's own fields (via applyProps) any time the
// object it's given changes identity, which would otherwise snap the
// live camera straight to a new position on every framing change,
// undoing CameraRig's tween before it can run a single frame.
const STABLE_CAMERA_CONFIG = { fov: 42 };

export function SceneShell({ children, cameraPosition = [0, 6, 9], target = [0, 0.5, 0], maxDistance = 16 }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      camera={STABLE_CAMERA_CONFIG}
    >
      <Backdrop />
      <ShaderWarmup />
      {children}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={20} blur={2.2} far={4} />
      <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={maxDistance} maxPolarAngle={Math.PI / 2.35} />
      <CameraRig cameraPosition={cameraPosition} target={target} />
    </Canvas>
  );
}
