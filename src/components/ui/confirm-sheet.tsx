import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Sheet } from "./sheet"

// A question in a sheet: a title, a line saying what happens, and the
// buttons. With no `cancelLabel` there is only the one button; the sheet
// still closes by dragging down, tapping outside or going back.
export function ConfirmSheet({
  open,
  onClose,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  cancelLabel?: string
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <p className="text-2xl type-display">{title}</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
      <div className={`mt-5 grid gap-2 ${cancelLabel ? "grid-cols-2" : ""}`}>
        {cancelLabel && (
          <Button variant="ghost" size="lg" className="px-3" onClick={onClose}>
            {cancelLabel}
          </Button>
        )}
        <Button variant={destructive ? "destructive" : "default"} size="lg" className="px-3" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
