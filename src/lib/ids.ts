// A random id for tournaments and players. crypto.randomUUID() would be
// simpler, but browsers only offer it on https pages or localhost, and the
// app is also opened over plain http on the local network while testing.
// getRandomValues works everywhere.
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
