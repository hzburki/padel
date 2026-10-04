export default function App() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-md items-center px-4">
          <h1 className="text-lg font-semibold tracking-tight">Padel</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="text-muted-foreground text-sm">
          No tournaments yet.
        </p>
      </main>
    </div>
  )
}
