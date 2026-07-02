import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "src/tests/e2e",
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 4310",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "iphone",
      use: { ...devices["iPhone 15"] }
    }
  ]
});
