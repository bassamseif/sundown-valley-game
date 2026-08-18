import { useState } from "react";
import { ErrorBoundary } from "./engine/ErrorBoundary";
import { SceneShell } from "./engine/SceneShell";
import { GeometryCombineScene } from "./scenes/GeometryCombineScene";
import { PipeAlignScene } from "./scenes/PipeAlignScene";
import { SoundForgeScene } from "./scenes/SoundForgeScene";
import { StructuralBridgeScene } from "./scenes/StructuralBridgeScene";

type Loop = "geometry" | "pipes" | "bridge" | "forge";

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
];

export default function App() {
  const [loop, setLoop] = useState<Loop | null>(null);
  const active = LOOPS.find((l) => l.id === loop) ?? null;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#1a1f2e" }}>
      {loop && (
        <ErrorBoundary key={loop}>
          <SceneShell
            cameraPosition={
              loop === "geometry"
                ? [0, 5.5, 8]
                : loop === "pipes"
                ? [4.5, 6.5, 7]
                : loop === "forge"
                ? [0, 4.5, 6.5]
                : [0, 6, 11.5]
            }
            target={
              loop === "geometry"
                ? [0, 0.6, -0.2]
                : loop === "pipes"
                ? [0, 0.4, 0.3]
                : loop === "forge"
                ? [0, 0.9, 0.5]
                : [0, 0.6, 0]
            }
            maxDistance={loop === "bridge" ? 20 : loop === "pipes" ? 15 : loop === "forge" ? 14 : 16}
          >
            {loop === "geometry" && <GeometryCombineScene />}
            {loop === "pipes" && <PipeAlignScene />}
            {loop === "bridge" && <StructuralBridgeScene />}
            {loop === "forge" && <SoundForgeScene />}
          </SceneShell>
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
            {LOOPS.map((l) => (
              <button key={l.id} style={cardStyle(l.gradient)} onClick={() => setLoop(l.id)}>
                <span style={{ fontSize: 34 }}>{l.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(120% 100% at 50% 0%, #3a3560 0%, #2b3350 45%, #241f38 100%)",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

function cardStyle(gradient: string): React.CSSProperties {
  return {
    width: 190,
    height: 150,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.15)",
    background: gradient,
    color: "#1a1f2e",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
    transition: "transform 0.15s ease",
  };
}

const instructionBar: React.CSSProperties = {
  position: "absolute",
  top: 18,
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
