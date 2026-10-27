import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // WSL does not reliably receive file events from a Windows workspace.
  server: {
    watch: { usePolling: Boolean(process.env.WSL_DISTRO_NAME), interval: 300 },
  },
});
