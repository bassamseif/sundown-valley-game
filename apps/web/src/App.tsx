import { useState } from "react";
import { ErrorBoundary } from "./engine/ErrorBoundary";
import { SceneShell } from "./engine/SceneShell";
import { GeometryCombineScene } from "./scenes/GeometryCombineScene";
import { MarketDayScene } from "./scenes/MarketDayScene";
import { PipeAlignScene } from "./scenes/PipeAlignScene";
import { SoundForgeScene } from "./scenes/SoundForgeScene";
import { StructuralBridgeScene } from "./scenes/StructuralBridgeScene";
import { SunProgressBadge } from "./engine/SunProgressBadge";
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
    instruction: "Tap coins to light up the gems and balance the scale. Level and all lit means you paid it exactly.",
  },
];

const VISIBLE_LOOPS = HIDE_DISABLED ? LOOPS.filter((l) => LOOP_ENABLED[l.id]) : LOOPS;

export default function App() {
  const [loop, setLoop] = useState<Loop | null>(null);
  const active = LOOPS.find((l) => l.id === loop) ?? null;

  return (
    <div style={{ width: "100%", minHeight: "100vh", position: "relative", background: "#1a1f2e" }}>
      {loop && (
        <ErrorBoundary key={loop}>
          <div style={{ width: "100%", height: "100vh" }}>
          <SceneShell
            cameraPosition={
              loop === "geometry"
                ? [0, 5.5, 8]
                : loop === "pipes"
                ? [4.5, 6.5, 7]
                : loop === "forge"
                ? [0, 4.5, 6.5]
                : loop === "market"
                ? [0, 5, 7.5]
                : [0, 6, 11.5]
            }
            target={
              loop === "geometry"
                ? [0, 0.6, -0.2]
                : loop === "pipes"
                ? [0, 0.4, 0.3]
                : loop === "forge"
                ? [0, 0.9, 0.5]
                : loop === "market"
                ? [0, 0.9, 0]
                : [0, 0.6, 0]
            }
            maxDistance={loop === "bridge" ? 20 : loop === "pipes" ? 15 : loop === "forge" || loop === "market" ? 14 : 16}
          >
            {loop === "geometry" && <GeometryCombineScene />}
            {loop === "pipes" && <PipeAlignScene />}
            {loop === "bridge" && <StructuralBridgeScene />}
            {loop === "forge" && <SoundForgeScene />}
            {loop === "market" && <MarketDayScene />}
          </SceneShell>
          </div>
        </ErrorBoundary>
      )}

      {!loop && (
        <div style={menuWrapStyle}>
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
                  onClick={() => enabled && setLoop(l.id)}
                >
                  <span style={{ fontSize: 34 }}>{l.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{l.label}</span>
                  {!enabled && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>Coming soon</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The day only starts once a loop is actually running — showing
          it on the menu would mean the cycle is already partway "done"
          before the child has even picked something to play. */}
      {loop && <SunProgressBadge />}

      {active && (
        <>
          <div style={instructionBar}>{active.instruction}</div>
          <button style={backButtonStyle} onClick={() => setLoop(null)}>
            ← Loops
          </button>
        </>
      )}
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
  background:
    "radial-gradient(120% 100% at 50% 0%, #3a3560 0%, #2b3350 45%, #241f38 100%)",
  fontFamily: "system-ui, -apple-system, sans-serif",
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
  };
}

const instructionBar: React.CSSProperties = {
  position: "absolute",
  top: 66,
  left: "50%",
  transform: "translateX(-50%)",
  maxWidth: "min(640px, 88vw)",
  textAlign: "center",
  padding: "12px 22px",
  borderRadius: 16,
  background: "rgba(26, 31, 46, 0.65)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff3e0",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 15,
  lineHeight: 1.4,
  pointerEvents: "none",
};

const backButtonStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 18,
  left: 18,
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(26, 31, 46, 0.65)",
  backdropFilter: "blur(10px)",
  color: "#fff3e0",
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontSize: 14,
  cursor: "pointer",
};
