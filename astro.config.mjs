// @ts-check
import { defineConfig } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy"; // For copying WASM files during build

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        // Alias the Mediapipe WASM folder to a virtual path
        "@mediapipe-wasm": "/wasm",
      },
    },
    server: {
      proxy: {
        "/socket.io": {
          target: "https://localhost:2000", // Ensure this is the correct URL for your signaling server
          ws: true, // Enable WebSocket proxying
          changeOrigin: true, // Adjust origin header to match target
          secure: false, // Allow self-signed certificates for localhost
        },
      },
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/@mediapipe/tasks-vision/wasm/*", // Source files
            dest: "wasm", // Destination in the output directory
          },
        ],
      }),
    ],
  },
});
