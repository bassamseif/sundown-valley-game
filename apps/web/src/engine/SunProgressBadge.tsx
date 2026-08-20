import { useEffect, useState } from "react";
import { CYCLE_SECONDS, elapsedSeconds } from "./sunCycle";

// A small DOM/SVG overlay, not a 3D scene object — the in-Canvas sun
// already tells this story at full scale, but it's easy to miss mid-
// puzzle. This is a glanceable "how far through today's cycle are we"
// readout: a cute sun starting bright at the top (midday) and
// descending toward one horizon (sunset) — a one-way quarter arc, not
// a full rise-then-set sweep, since "start high, end low" is what
// actually reads as "how much is done vs. left," not a side-to-side
// motion. Reads elapsedSeconds() — the same session-wide clock the
// in-scene sun (Backdrop.tsx) drives off — rather than the R3F clock,
// since this lives outside any Canvas; also means this badge and the
// 3D sun can never drift out of sync with each other.
export function SunProgressBadge() {
  const [cycleFrac, setCycleFrac] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCycleFrac((elapsedSeconds() % CYCLE_SECONDS) / CYCLE_SECONDS);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Starts partway up the arc (45°, already climbing toward midday)
  // rather than right at the left horizon, sweeping on to the right
  // horizon (sunset) — one-way and resetting instantly at the end of
  // each cycle, never reversing back the way it came.
  const START_ANGLE = Math.PI / 4;
  const theta = START_ANGLE + cycleFrac * (Math.PI - START_ANGLE);
  const cx = 60;
  const cy = 46;
  const r = 26;
  const sunX = cx - r * Math.cos(theta);
  const sunY = cy - r * Math.sin(theta);

  // Near-white and bright at the top of the arc (midday), deepening
  // into the same warm sunset orange the real 3D sun/sky already use
  // (Backdrop.tsx's directional-light hue lerps 0.14→0.03, i.e. ~50°→
  // ~11° — matched here) as it nears either horizon.
  const heightT = Math.sin(theta); // 1 at the top, 0 at either horizon
  const setT = 1 - heightT;
  const sunColor = `hsl(${lerp(50, 12, setT)}, ${lerp(55, 92, setT)}%, ${lerp(88, 56, setT)}%)`;

  return (
    <div style={wrapStyle}>
      <svg width="120" height="54" viewBox="0 0 120 54">
        {/* Same cx/cy/r the sun position below is computed from — a
            separately-eyeballed path here previously traced a visibly
            different curve than the one the sun actually moved along. */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#ffe9c7"
          strokeOpacity={0.3}
          strokeWidth={1.5}
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
        <line x1={4} y1={cy} x2={116} y2={cy} stroke="#ffe9c7" strokeOpacity={0.45} strokeWidth={1.5} strokeLinecap="round" />

        {/* soft glow behind the sun */}
        <circle cx={sunX} cy={sunY} r={11} fill={sunColor} opacity={0.28} />

        <circle cx={sunX} cy={sunY} r={6.5} fill={sunColor} stroke="#fff8ea" strokeWidth={1} />
        {/* a tiny friendly face — this is a kids' game, the sun gets to be cute */}
        <circle cx={sunX - 2} cy={sunY - 0.5} r={0.7} fill="#3a2a1a" />
        <circle cx={sunX + 2} cy={sunY - 0.5} r={0.7} fill="#3a2a1a" />
        <path
          d={`M ${sunX - 2} ${sunY + 2} Q ${sunX} ${sunY + 3.2} ${sunX + 2} ${sunY + 2}`}
          fill="none"
          stroke="#3a2a1a"
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

const wrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: "50%",
  transform: "translateX(-50%)",
  padding: "4px 10px",
  borderRadius: 14,
  background: "rgba(26, 31, 46, 0.5)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.1)",
  pointerEvents: "none",
};
