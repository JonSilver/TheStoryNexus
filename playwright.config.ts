import { defineConfig } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * E2E harness (contracts Appendix A: behavioural checks live in the real
 * project). Hermetic per run: the backend gets a fresh SQLite database in a
 * temp directory (seeding the sample story), the frontend proxies to it, and
 * AI generation is mocked at the network layer inside the tests — no model
 * server involved, fully deterministic.
 */

// Overridable for when something else on the machine holds the defaults
const E2E_API_PORT = Number(process.env.E2E_API_PORT) || 3101;
const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5273;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "storynexus-e2e-"));

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 60_000,
    use: {
        baseURL: `http://localhost:${E2E_WEB_PORT}`,
        trace: "retain-on-failure"
    },
    webServer: [
        {
            command: `npx tsx server/index.ts`,
            port: E2E_API_PORT,
            reuseExistingServer: false,
            env: {
                NODE_ENV: "development",
                STORYNEXUS_E2E: "1",
                PORT: String(E2E_API_PORT),
                DATABASE_PATH: path.join(dataDir, "e2e.db")
            }
        },
        {
            command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
            port: E2E_WEB_PORT,
            reuseExistingServer: false,
            env: {
                VITE_API_TARGET: `http://localhost:${E2E_API_PORT}`
            }
        }
    ]
});
