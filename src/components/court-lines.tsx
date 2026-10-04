export function CourtLines() {
  // A padel court is 10 m by 20 m: walls, net, service lines, centre line.
  return (
    <svg
      viewBox="0 0 100 200"
      className="pointer-events-none absolute -top-10 -right-16 h-[150%] text-white/8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
    >
      <rect x="1" y="1" width="98" height="198" />
      <path d="M1 100h98M1 30.5h98M1 169.5h98M50 30.5v139" />
    </svg>
  )
}
