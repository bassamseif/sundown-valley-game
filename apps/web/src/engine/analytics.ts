import posthog from "posthog-js";

// No-op until VITE_POSTHOG_KEY is set (e.g. in .env.local, or as a
// build-time env var in whatever deploys this) — so this module is
// safe to import and call everywhere unconditionally, in every
// environment (local dev, CI, a build with no key configured), rather
// than every call site needing to guard against analytics being
// unconfigured.
const API_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const API_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (initialized || !API_KEY) return;
  posthog.init(API_KEY, {
    api_host: API_HOST,
    // Autocapture (every click, every DOM node) is deliberately off —
    // this game is one continuously-tapping canvas, so autocapture
    // would mostly be noise, burn through event quota fast, and sits
    // awkwardly against the README's "no tracking" framing. Only the
    // deliberately named events below (see call sites) are sent.
    autocapture: false,
    capture_pageview: false,
    session_recording: {
      // No text inputs anywhere in this game, but mask by default
      // anyway as a deliberate default rather than an oversight.
      maskAllInputs: true,
      // The whole game is a WebGL <canvas> — normal replay only
      // records the DOM, so without this the recording would show an
      // empty box for the entire play area. Snapshots canvas pixels
      // as periodic frames instead of a live video; capped at a low
      // fps/quality since this is a mostly-static, slow-motion scene
      // (no need for smooth video, just "what did the child see").
      captureCanvas: {
        recordCanvas: true,
        canvasFps: 4,
        canvasQuality: "0.4",
      },
    },
  });
  // Dev vs. prod is one project, filtered by this property in PostHog,
  // rather than two projects/keys — avoids splitting the free-tier
  // event quota and dashboards for no real benefit pre-launch.
  posthog.register({ environment: import.meta.env.PROD ? "production" : "development" });
  initialized = true;
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}
