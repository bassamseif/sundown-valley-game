// Dev-only bridge so Playwright can drive puzzle state deterministically
// instead of guessing pixel coordinates on a WebGL canvas. Never included
// in production builds.
export function exposeTestHook(key: string, api: unknown) {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __sv?: Record<string, unknown> };
  w.__sv = w.__sv ?? {};
  w.__sv[key] = api;
}
