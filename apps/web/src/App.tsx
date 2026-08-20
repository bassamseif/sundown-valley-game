import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "./engine/ErrorBoundary";
import { SceneEntrance } from "./engine/SceneEntrance";
import { SceneShell } from "./engine/SceneShell";
import { GeometryCombineScene } from "./scenes/GeometryCombineScene";
import { MarketDayScene } from "./scenes/MarketDayScene";
import { PipeAlignScene } from "./scenes/PipeAlignScene";
import { SoundForgeScene } from "./scenes/SoundForgeScene";
import { StructuralBridgeScene } from "./scenes/StructuralBridgeScene";
import { SunProgressBadge } from "./engine/SunProgressBadge";
import { track } from "./engine/analytics";
import { HIDE_DISABLED, LOOP_ENABLED } from "./loopFlags";

type Loop = "geometry" | "pipes" | "bridge" | "forge" | "market";

const LOOPS: { id: Loop; label: string; icon: string; gradient: string; instruction: string }[] = [
  {
    id: "geometry",
    label: "Geometry Combining",
    icon: "◆",
    gradient: "linear-gradient(135deg, #c6a6ff, #7fe3c9)",
    instruction: "Tap two crystals that are the same size as the glowing outline, then tap the second one to combine them.",
  },
  {
    id: "pipes",
    label: "Water Pipe Alignment",
    icon: "〜",
    gradient: "linear-gradient(135deg, #7fc4f0, #7fe3c9)",
    instruction: "Tap a pipe to turn it. Line up every pipe so water can flow from the spring to the pool.",
  },
  {
    id: "bridge",
    label: "Structural Bridge",
    icon: "▭",
    gradient: "linear-gradient(135deg, #ffb570, #c6a6ff)",
    instruction: "Tap a plank to pick it up, then tap the gap it fits. Fill both gaps to send the ball across.",
  },
  {
    id: "forge",
    label: "Sound Forge",
    icon: "✦",
    gradient: "linear-gradient(135deg, #7fe3c9, #ffb570)",
    instruction: "Tap a pebble to place it in the next open slot. Line up the sounds to build the word.",
  },
  {
    id: "market",
    label: "Market Day",
    icon: "⚖",
    gradient: "linear-gradient(135deg, #ffd27f, #ff9d7f)",
    instruction: "Tap coins to put weight on the scale. Level means you paid the exact price.",
  },
];

const VISIBLE_LOOPS = HIDE_DISABLED ? LOOPS.filter((l) => LOOP_ENABLED[l.id]) : LOOPS;

// The menu's own camera framing — a wide, high view of the whole
// island with the puzzle table sitting empty at its center. Picking a
// loop tweens the camera from here to that loop's own framing (see
// SceneShell's CameraRig); backing out tweens back to this same shot.
const MENU_CAMERA_POSITION: [number, number, number] = [0, 11.5, 18];
const MENU_TARGET: [number, number, number] = [0, 0.8, 0];
const MENU_MAX_DISTANCE = 24;

const LOOP_FRAMING: Record<Loop, { cameraPosition: [number, number, number]; target: [number, number, number]; maxDistance: number }> = {
  geometry: { cameraPosition: [0, 5.5, 8], target: [0, 0.6, -0.2], maxDistance: 16 },
  pipes: { cameraPosition: [4.5, 6.5, 7], target: [0, 0.4, 0.3], maxDistance: 15 },
  bridge: { cameraPosition: [0, 6, 11.5], target: [0, 0.6, 0], maxDistance: 20 },
  forge: { cameraPosition: [0, 4.5, 6.5], target: [0, 0.9, 0.5], maxDistance: 14 },
  market: { cameraPosition: [0, 4, 7.5], target: [0, 1.8, 0], maxDistance: 14 },
};

// Idle thresholds for surfacing the instruction modal: a shorter one
// that fires if the player does absolutely nothing (no interaction at
// all) right after arriving, and a longer failsafe that fires
// regardless of whether they've been interacting (camera orbiting,
// exploring) if the puzzle itself still hasn't gotten a real move —
// "no interaction at all for 15s" and "no meaningful progress after
// 20s" are two different signals of the same underlying problem (the
// child doesn't know what to do), so either one showing the same
// modal is the point, not a bug.
const IDLE_INTERACTION_MS = 15000;
const NO_START_FAILSAFE_MS = 20000;

export default function App() {
  const [loop, setLoop] = useState<Loop | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  // Once the player has explicitly dismissed the modal (or it's
  // already showing), neither timer below should be able to reopen it
  // for this loop visit — a hint that reappears the moment you stop
  // moving your mouse again would just be nagging, not teaching. A
  // ref (not state) since the dismiss handler and the effect's timers
  // both need to read/write it without re-running the effect.
  const dismissedRef = useRef(false);
  const active = LOOPS.find((l) => l.id === loop) ?? null;
  const framing = loop ? LOOP_FRAMING[loop] : { cameraPosition: MENU_CAMERA_POSITION, target: MENU_TARGET, maxDistance: MENU_MAX_DISTANCE };

  useEffect(() => {
    setShowInstructions(false);
    dismissedRef.current = false;
    if (!loop) return;

    // The explanation only ever needs to happen once per loop, ever —
    // once the child has seen it (shown, whether dismissed explicitly
    // or just timed past), re-explaining on every later visit would be
    // nagging, not teaching. Persisted so it holds across reloads too.
    const seenKey = `sv_instructions_seen_${loop}`;
    if (localStorage.getItem(seenKey) === "1") return;

    // Both timers are re-checked at fire time, not just cancelled up
    // front — a timer already in flight the instant dismissedRef flips
    // true (e.g. the dismiss click's own pointerdown, which fires
    // before its click handler runs) must still not show anything.
    const idleTimer = setTimeout(() => {
      if (dismissedRef.current) return;
      setShowInstructions(true);
      localStorage.setItem(seenKey, "1");
      track("instructions_shown", { loop, trigger: "idle" });
    }, IDLE_INTERACTION_MS);
    const failsafe = setTimeout(() => {
      if (dismissedRef.current) return;
      setShowInstructions(true);
      localStorage.setItem(seenKey, "1");
      track("instructions_shown", { loop, trigger: "no_progress" });
    }, NO_START_FAILSAFE_MS);

    // The player's first tap/action of any kind — not just dismissing
    // the modal explicitly — invalidates the tutorial for this loop
    // visit: once they've done something, an unprompted "here's how to
    // play" would interrupt them mid-action rather than help. This is
    // a one-shot cancel, not a per-tap reschedule — the old behavior
    // only pushed the short idle timer's clock back on each tap, which
    // left the longer failsafe free to fire later regardless, even
    // after the player had clearly already started (see this file's
    // test coverage in loops.spec.ts).
    const onInteract = () => {
      dismissedRef.current = true;
      clearTimeout(idleTimer);
      clearTimeout(failsafe);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("touchstart", onInteract);

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(failsafe);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("touchstart", onInteract);
    };
  }, [loop]);

  function dismissInstructions() {
    dismissedRef.current = true;
    setShowInstructions(false);
    track("instructions_dismissed", { loop });
  }

  function selectLoop(id: Loop) {
    setLoop(id);
    track("loop_selected", { loop: id });
  }

  function exitLoop() {
    track("loop_exited", { loop });
    setLoop(null);
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", position: "relative", background: "#1a1f2e" }}>
      {/* One Canvas for the whole app — the menu is this same beach
          scene, zoomed out, with the day already under way (see
          sunCycle.ts: the sun tracks session time, not "time since a
          loop was entered"). Picking a loop doesn't swap to a freshly
          mounted scene; the camera flies from here to that loop's own
          framing (SceneShell's CameraRig), and only the loop-specific
          puzzle content below mounts/unmounts (each still gets its own
          ErrorBoundary + key={loop} so a puzzle's internal state resets
          when you leave and come back, without tearing down the world
          around it). */}
      <div style={{ width: "100%", height: "100vh" }}>
        <SceneShell cameraPosition={framing.cameraPosition} target={framing.target} maxDistance={framing.maxDistance}>
          {loop && (
            <ErrorBoundary key={loop}>
              <SceneEntrance>
                {loop === "geometry" && <GeometryCombineScene />}
                {loop === "pipes" && <PipeAlignScene />}
                {loop === "bridge" && <StructuralBridgeScene />}
                {loop === "forge" && <SoundForgeScene />}
                {loop === "market" && <MarketDayScene />}
              </SceneEntrance>
            </ErrorBoundary>
          )}
        </SceneShell>
      </div>

      {/* Always mounted, faded via opacity rather than conditionally
          mounted/unmounted — a hard mount/unmount would hard-cut in
          exact sync with the click, undoing the point of an eased
          camera fly-in and scene grow-in happening at the same moment.
          pointerEvents flips instantly with `loop` (no fade) so a
          fading-out menu can't still eat clicks meant for the puzzle
          arriving underneath it. */}
      <div style={{ ...menuWrapStyle, opacity: loop ? 0 : 1, pointerEvents: loop ? "none" : undefined }}>
        <div style={{ color: "#ffe9c7", fontSize: 13, letterSpacing: 3, marginBottom: 6, opacity: 0.85 }}>
          SUNDOWN VALLEY
        </div>
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 600, marginBottom: 36 }}>
          Choose a test loop
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", maxWidth: 760 }}>
          {VISIBLE_LOOPS.map((l) => {
            const enabled = LOOP_ENABLED[l.id];
            return (
              <button
                key={l.id}
                style={cardStyle(l.gradient, enabled)}
                disabled={!enabled}
                onClick={() => enabled && selectLoop(l.id)}
              >
                <span style={{ fontSize: 34 }}>{l.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{l.label}</span>
                {!enabled && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>Coming soon</span>}
              </button>
            );
          })}
        </div>
      </div>

      <SunProgressBadge />

      {/* Centered, dismissible instruction modal — shown only once
          idle (or the puzzle failsafe) fires, not immediately on
          entering a loop (see the effect above). Overlays everything,
          including the back button, while up. */}
      {active && showInstructions && (
        <div style={instructionOverlay}>
          <div style={instructionCard}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#ffe9c7", marginBottom: 4 }}>{active.label}</div>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: "#fff3e0" }}>{active.instruction}</div>
            <button style={instructionOkButton} onClick={dismissInstructions}>
              Got it!
            </button>
          </div>
        </div>
      )}

      <button
        style={{ ...backButtonStyle, opacity: active ? 1 : 0, pointerEvents: active ? "auto" : "none" }}
        onClick={exitLoop}
      >
        ← Loops
      </button>
    </div>
  );
}

const menuWrapStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "40px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  // Positioned over the persistent Canvas (a sibling div, not a
  // parent) rather than stacked after it in normal flow — otherwise
  // this content lands below the fold, under the full-viewport canvas.
  position: "absolute",
  top: 0,
  left: 0,
  // Transparent — this overlays the live 3D menu shot (SceneShell,
  // zoomed out) rather than replacing it with a flat background, per
  // "the menu could be the zoomed out scene." The card/text styling
  // below carries its own contrast (blur + dark backing) so it stays
  // readable over whatever the beach looks like at that moment in the
  // day.
  pointerEvents: "none",
  fontFamily: "system-ui, -apple-system, sans-serif",
  transition: "opacity 0.6s ease",
};

function cardStyle(gradient: string, enabled: boolean): React.CSSProperties {
  return {
    width: 190,
    height: 150,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.15)",
    background: enabled ? gradient : "rgba(255,255,255,0.06)",
    color: enabled ? "#1a1f2e" : "rgba(255,255,255,0.5)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.55,
    boxShadow: enabled ? "0 12px 30px rgba(0,0,0,0.4)" : "none",
    transition: "transform 0.15s ease",
    pointerEvents: "auto",
    backdropFilter: "blur(6px)",
  };
}

const instructionOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Side padding so the card can never sit flush against the left/
  // right viewport edges on a narrow screen, even though its own
  // maxWidth is already vw-relative — that alone doesn't guarantee a
  // gap, just an upper bound.
  padding: "0 24px",
  boxSizing: "border-box",
  // A dimming scrim behind the card — makes it read as a modal that's
  // asking for a beat of attention, not just another HUD element
  // sharing the screen with the puzzle.
  background: "rgba(20, 16, 10, 0.35)",
  zIndex: 20,
};

const instructionCard: React.CSSProperties = {
  maxWidth: "min(420px, 86vw)",
  textAlign: "center",
  padding: "24px 28px",
  borderRadius: 20,
  background: "rgba(26, 31, 46, 0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.15)",
  boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 14,
};

const instructionOkButton: React.CSSProperties = {
  marginTop: 4,
  padding: "10px 28px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #ffd27f, #ff9d7f)",
  color: "#2b2114",
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(0,0,0,0.3)",
};

const backButtonStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 18,
  left: 18,
  padding: "10px 16px",
  borderRadius: 14,
  transition: "opacity 0.5s ease",
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(26, 31, 46, 0.65)",
  backdropFilter: "blur(10px)",
  color: "#fff3e0",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 14,
  cursor: "pointer",
};
