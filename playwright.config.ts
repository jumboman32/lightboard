import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:8788",
    headless: true,
    launchOptions: { channel: "chrome" },
  },
  webServer: {
    command:
      "npx wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e-state && npx wrangler dev --ip 127.0.0.1 --port 8788 --persist-to .wrangler/e2e-state",
    url: "http://127.0.0.1:8788",
    reuseExistingServer: false,
  },
  reporter: "list",
});
