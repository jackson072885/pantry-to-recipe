import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/match": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/pantry": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/search": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
