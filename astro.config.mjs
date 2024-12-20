// @ts-check
import { defineConfig } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy"; // For copying WASM files during build
import { getLocalIPAddress } from "./src/utils/getLocalIP";
import fs from "fs";

const localIP = getLocalIPAddress();
const serverUrl = `https://${localIP}:2000`;

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  vite: {
    define: {
      LOCAL_IP: JSON.stringify(localIP),
    },
    resolve: {
      alias: {
        // Alias the Mediapipe WASM folder to a virtual path
        "@mediapipe-wasm": "/wasm",
        "@": "/src",
      },
    },
    server: {
      host: true,
      https: {
        key: fs.readFileSync("./certs/key3.pem"), // Path to your key file
        cert: fs.readFileSync("./certs/cert3.pem"), // Path to your cert file
      },
      proxy: {
        "/socket.io": {
          target: serverUrl, // Ensure this is the correct URL for your signaling server
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
