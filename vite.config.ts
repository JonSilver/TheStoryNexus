import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import path from "node:path";
import remarkGfm from "remark-gfm";
import remarkAlert from "remark-github-blockquote-alert";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
    plugins: [
        { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm, remarkAlert] }) },
        react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ })
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                // Overridable so the e2e harness can point at its own backend
                target: process.env.VITE_API_TARGET || "http://localhost:3001",
                changeOrigin: true
            }
        },
        host: true
    },
    build: {
        outDir: "dist/client",
        rollupOptions: {}
    }
}));
