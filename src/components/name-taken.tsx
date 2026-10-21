import { cleanPlayerName } from "@/lib/tournament"

// Sits under a name field holding a name another player already has.
// `name` is as typed.
export function NameTaken({ name }: { name: string }) {
  return (
    <p role="alert" className="mt-1.5 px-1 text-sm font-medium text-destructive">
      {cleanPlayerName(name)} is already playing
    </p>
  )
}
