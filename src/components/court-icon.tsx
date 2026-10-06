import type { SVGProps } from "react"

// The icon for a match: a court seen from above, two players each side of
// the net. Drawn on Lucide's 24px grid so it sits beside the Lucide icons.
export function CourtIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
      <path d="M7.5 8.5h.01M7.5 15.5h.01M16.5 8.5h.01M16.5 15.5h.01" />
    </svg>
  )
}
