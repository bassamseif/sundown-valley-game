import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Lets the dev server answer requests proxied in through the
    // Cloudflare tunnel at dev.bassamseif.com, which Vite's default
    // Host-header allowlist (localhost only) would otherwise reject.
    allowedHosts: ["dev.bassamseif.com"],
  },
});
