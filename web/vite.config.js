import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "https://haloai-web.vercel.app",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
