import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import path from "node:path";
import remarkAlert from "remark-github-blockquote-alert";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(() => ({
    plugins: [{ enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm, remarkAlert] }) }, react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ })],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@lexical-playground": path.resolve(__dirname, "src/Lexical/lexical-playground/src"),
            shared: path.resolve(__dirname, "src/Lexical/shared/src")
        }
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true
            }
        },
        host: true
    },
    build: {
        outDir: "dist/client",
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split large markdown rendering dependencies
                    "react-markdown": ["react-markdown", "remark-gfm", "rehype-raw", "rehype-sanitize"]
                }
            }
        }
    }
}));
