# Sundown Valley

A calm, non-addictive, browser-native 3D STEM puzzle game for ages 5–6. Open source, MIT-licensed, engine and content alike.

- 15-minute sessions that end at a visual sunset, not a timer
- Tap-to-select, tap-to-place — no drag-and-drop
- Puzzle logic is 100% deterministic; physics (Rapier/WASM) is visual garnish only
- No ads, no microtransactions, no tracking

## Design Principles

Puzzle mechanics follow Montessori educational-design principles:

- **Concrete before abstract** (Classical Principle) — ground mechanics in physical, familiar
  objects (a real balance beam) rather than abstracting into symbolic
  fills/meters. Prefer the version a child can point to and say "that's
  a scale" over one that requires reading an indicator.
- **Control of error** (Classical Principle) — correctness should be visible or felt from the
  material itself (the beam tilts) rather than needing an external
  right/wrong indicator like a checkmark or color change.
- **Visible causality** (Adapted from Natural Consequences & Reality-Based Materials) — state on both sides of an interaction (e.g.
  both scale pans) should be shown, not implied. If a value changed,
  the change itself should be visible in the scene.
- **Material uniformity** (Adapted from Isolation of Quality) — objects standing for the same concept
  (coins vs. reference weights) should share one shape/visual language,
  so the child generalizes the underlying concept rather than learning
  two unrelated vocabularies for the same idea.
- **No spurious motion** (Adapted from Order & Purposeful Activity) — only the object the child acted on should
  move or react; nothing else should shift, jump, or reflow as a side
  effect of an unrelated tap.
- **Hints are a fallback, not a default** (Adapted from Self-Directed Learning & Non-Interruption) — objects should read as
  touchable through their own presentation, not a synthetic affordance
  layer. A hint should trigger off the child being stuck — not
  understanding what to do, unable to make progress — not off a fixed
  idle timer. And it fires once per distinct stuck situation, ever
  (persisted across sessions): the material teaches the concept, then
  gets out of the way instead of nagging on every later attempt.

## Repo Layout
- `apps/web` — the game (Vite + React Three Fiber)
- `packages/puzzle-kit` — shared puzzle primitives
- `packages/save-local` — local-storage progress/cooldown (no network calls)
- `content/puzzles` — puzzle definitions as data
- `e2e` — solvability checks (every puzzle has a verified tap-to-place solution)

## Status
Pre-alpha. Structure only — no gameplay yet.

## License
MIT (see `LICENSE`). The name "Sundown Valley" is excluded from the grant — see [trademark note](./docs/TRADEMARK.md).
