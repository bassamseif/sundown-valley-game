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
