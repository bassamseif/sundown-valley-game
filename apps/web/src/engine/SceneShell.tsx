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
  active?: boolean;
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

function CameraRig({
  cameraPosition,
  target,
  maxDistance,
}: {
  cameraPosition: [number, number, number];
  target: [number, number, number];
  maxDistance: number;
}) {
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
        oc.maxDistance = maxDistance;
        oc.update();
      }
      mountedRef.current = true;
      return;
    }
    activeUntilRef.current = performance.now() + TRANSITION_MS;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPosition[0], cameraPosition[1], cameraPosition[2], target[0], target[1], target[2]]);

  useFrame((_, delta) => {
    if (performance.now() > activeUntilRef.current) {
      // Not transitioning: make sure the real limit is in force (see
      // below — it's relaxed during a transition and needs restoring
      // once one ends, since the last transitioning frame's relaxed
      // value can sit a hair above the real limit forever otherwise).
      const oc = controls as OrbitControlsImpl | null;
      if (oc && oc.maxDistance !== maxDistance) oc.maxDistance = maxDistance;
      return;
    }
    // Clamp delta before damping: the frame right after picking a loop
    // (mounting the new scene, unmounting the old one) is often a real
    // hitch with an inflated delta, which made THREE.MathUtils.damp's
    // very first step cover most of the distance in one jump — then
    // the rest of the transition, with normal small deltas, looked
    // smooth by comparison. Capping it keeps every step's proportional
    // move consistent regardless of frame timing.
    const dt = Math.min(delta, 1 / 30);
    const dampFactor = 2.6;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraPosition[0], dampFactor, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraPosition[1], dampFactor, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraPosition[2], dampFactor, dt);

    const oc = controls as OrbitControlsImpl | null;
    if (oc) {
      oc.target.x = THREE.MathUtils.damp(oc.target.x, target[0], dampFactor, dt);
      oc.target.y = THREE.MathUtils.damp(oc.target.y, target[1], dampFactor, dt);
      oc.target.z = THREE.MathUtils.damp(oc.target.z, target[2], dampFactor, dt);
      // OrbitControls.update() clamps the orbit radius to maxDistance
      // instantly, with no damping of its own — switching to a loop
      // with a tighter maxDistance than the menu's used to snap the
      // radius down in one step the moment this ran, before our own
      // damping above had moved anything, which read as a sudden jump
      // right at the start of an otherwise-smooth tween. Relaxing the
      // limit to whatever the current distance actually is (never
      // tighter) while transitioning means update() has nothing to
      // clamp; the real limit is restored the instant the tween ends.
      oc.maxDistance = Math.max(camera.position.distanceTo(oc.target) + 0.1, maxDistance);
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

export function SceneShell({ children, cameraPosition = [0, 6, 9], target = [0, 0.5, 0], maxDistance = 16, active = false }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      camera={STABLE_CAMERA_CONFIG}
    >
      <Backdrop active={active} />
      <ShaderWarmup />
      {children}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={20} blur={2.2} far={4} />
      {/* maxDistance is deliberately not set here — CameraRig owns it
          imperatively (see there for why: OrbitControls.update() clamps
          radius to this value with no damping of its own, which would
          otherwise snap the camera the instant a tighter-limit loop is
          selected, before CameraRig's own tween has moved anything). */}
      <OrbitControls makeDefault enablePan={false} minDistance={4} maxPolarAngle={Math.PI / 2.35} />
      <CameraRig cameraPosition={cameraPosition} target={target} maxDistance={maxDistance} />
    </Canvas>
  );
}
