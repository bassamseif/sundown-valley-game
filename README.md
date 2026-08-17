# Sundown Valley

A calm, non-addictive, browser-native 3D STEM puzzle game for ages 5–6. Open source, MIT-licensed, engine and content alike.

- 15-minute sessions that end at a visual sunset, not a timer
- Tap-to-select, tap-to-place — no drag-and-drop
- Puzzle logic is 100% deterministic; physics (Rapier/WASM) is visual garnish only
- No ads, no microtransactions, no tracking

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
