import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(__dirname, "./src") }
    },
    test: {
        exclude: ["**/node_modules/**", "dist/**", "docs/**", "e2e/**"]
    }
});
