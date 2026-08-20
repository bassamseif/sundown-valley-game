import { WeightPiece } from "../scenes/market/WeightPiece";

// Compiles Market Day's material/shader permutations — including the
// custom RimGlow fresnel shader — while the player is still looking at
// the menu, tucked out of sight far below the terrain at a tiny scale.
// A shader only actually compiles on its first real draw call; without
// this, that first compile happens on the exact frame the player clicks
// into the puzzle, which is exactly when a compile stall reads as a
// jarring flash/freeze instead of a continuous transition. Rendering
// one instance here — invisible, but still genuinely drawn — moves
// that one-time cost to a moment nothing else is competing for
// attention.
//
// Always mounted (not gated by which loop is selected, or even by
// LOOP_ENABLED) — it costs one tiny extra draw call and buys back a
// stall exactly when it would otherwise be most visible.
export function ShaderWarmup() {
  return (
    <group position={[0, -50, 0]} scale={0.001}>
      <WeightPiece value={1} color="#888888" glowing />
    </group>
  );
}
