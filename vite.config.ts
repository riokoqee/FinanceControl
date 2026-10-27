import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/FinanceControl/" : "/",
  plugins: [react()],
  // WSL does not reliably receive file events from a Windows workspace.
  server: {
    watch: { usePolling: Boolean(process.env.WSL_DISTRO_NAME), interval: 300 },
  },
});
