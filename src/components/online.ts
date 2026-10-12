import { useSyncExternalStore } from "react"

function onConnectionChange(changed: () => void) {
  window.addEventListener("online", changed)
  window.addEventListener("offline", changed)
  return () => {
    window.removeEventListener("online", changed)
    window.removeEventListener("offline", changed)
  }
}

// Whether the phone has a connection, kept up to date as it comes and goes.
export function useOnline(): boolean {
  return useSyncExternalStore(onConnectionChange, () => navigator.onLine)
}
