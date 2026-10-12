import { defineConfig, devices } from "@playwright/test"

// `npm run shots`: in Chrome's engine and in Safari's, walks the app's
// screens and compares each one with the image stored in shots/images
// (shots/screens.shots.ts), then plays whole games by tapping
// (shots/flows.shots.ts).

const PORT = 5199
const SIDEWAYS = /on its side/
const WALK = "screens.shots.ts"

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const tablet = { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true }
const desktop = { viewport: { width: 1280, height: 720 } }
const sideways = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

// The same sizes in each engine. Chrome's keep their plain names, and with
// them the images already stored. The games are played at phone size only:
// what they check does not change with the width.
const projects = (
  [
    ["", devices["Desktop Chrome"].defaultBrowserType],
    ["-safari", devices["Desktop Safari"].defaultBrowserType],
  ] as const
).flatMap(([suffix, browserName]) => [
  { name: `phone${suffix}`, grepInvert: SIDEWAYS, use: { browserName, ...phone } },
  { name: `tablet${suffix}`, grepInvert: SIDEWAYS, testMatch: WALK, use: { browserName, ...tablet } },
  { name: `desktop${suffix}`, grepInvert: SIDEWAYS, testMatch: WALK, use: { browserName, ...desktop } },
  { name: `phone-sideways${suffix}`, grep: SIDEWAYS, testMatch: WALK, use: { browserName, ...sideways } },
])

export default defineConfig({
  testDir: "shots",
  testMatch: "*.shots.ts",
  snapshotPathTemplate: "shots/images/{projectName}/{arg}{ext}",
  reporter: "list",
  // One at a time: the screens load faster than the dev server can keep up
  // with when three sizes ask at once, and a half-loaded font is a mismatch.
  workers: 1,
  // The dev server, and the local emulators a broadcast is sent to. Either
  // is left alone if it is already running.
  webServer: [
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
    },
    {
      command: "npm run emulators",
      url: "http://localhost:8080",
      reuseExistingServer: true,
      timeout: 120_000,
      // Asked to stop, the emulators close their own Firestore process.
      // Killed outright they leave it holding its port.
      gracefulShutdown: { signal: "SIGINT", timeout: 15_000 },
    },
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-GB",
    timezoneId: "UTC",
    reducedMotion: "reduce",
  },
  projects,
})
