import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "shots",
  testMatch: "tmp-hosted.shots.ts",
  reporter: "list",
  workers: 1,
  timeout: 90_000,
  use: { baseURL: "https://2e185e49.padel-8xu.pages.dev", locale: "en-GB", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" },
  projects: [{ name: "chrome", use: { browserName: "chromium" } }, { name: "safari", use: { browserName: "webkit" } }],
})
