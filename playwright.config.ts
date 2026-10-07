import { defineConfig } from "@playwright/test"

// `npm run shots`: walks the app's screens and compares each one with the
// image stored in shots/images. See shots/screens.shots.ts.

const PORT = 5199
const SIDEWAYS = /on its side/

export default defineConfig({
  testDir: "shots",
  testMatch: "*.shots.ts",
  snapshotPathTemplate: "shots/images/{projectName}/{arg}{ext}",
  reporter: "list",
  // One at a time: the screens load faster than the dev server can keep up
  // with when three sizes ask at once, and a half-loaded font is a mismatch.
  workers: 1,
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-GB",
    timezoneId: "UTC",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "phone",
      grepInvert: SIDEWAYS,
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    {
      name: "tablet",
      grepInvert: SIDEWAYS,
      use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop",
      grepInvert: SIDEWAYS,
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: "phone-sideways",
      grep: SIDEWAYS,
      use: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
})
