// Single on/off switch per loop. Flip a value here to bring a loop
// back into the menu — nothing else in App.tsx needs to change.
export const LOOP_ENABLED = {
  geometry: false,
  pipes: false,
  bridge: false,
  forge: false,
  market: true,
} as const;

// When true, disabled loops are left out of the menu entirely instead
// of showing as a dimmed "Coming soon" card.
export const HIDE_DISABLED = true;
