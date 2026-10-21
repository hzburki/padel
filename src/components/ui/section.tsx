import type { ReactNode } from "react"

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-3">
      <h2 className="mb-3 flex items-baseline gap-2 px-1 text-[1.375rem] type-display">
        {title}
        {count !== undefined && <span className="text-primary">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 px-1 text-sm text-muted-foreground">{children}</p>
}
