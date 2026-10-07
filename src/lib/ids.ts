const LETTERS = "0123456789abcdefghijklmnopqrstuvwxyz"
const LENGTH = 10

// A random id for tournaments, matches and players: 10 digits and lowercase
// letters. A game's id is also the end of its shared link, so it is kept
// short, and it is the only thing that keeps the game from strangers, so it
// must stay impossible to guess: 36^10 is about 3.6 million billion.
//
// crypto.randomUUID() is only offered on https pages or localhost, and the
// app is also opened over plain http on the local network while testing.
// getRandomValues works everywhere.
export function randomId(): string {
  let id = ""
  while (id.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH))) {
      // 252 is the last multiple of 36 a byte can hold: bytes past it would
      // make the first few letters come up more often.
      if (byte < 252 && id.length < LENGTH) id += LETTERS[byte % 36]
    }
  }
  return id
}
