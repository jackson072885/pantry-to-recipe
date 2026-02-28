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
      "/recipes": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/cook": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/insights": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/plan": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/unlock": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/supply": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
