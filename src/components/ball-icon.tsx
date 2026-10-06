import { useId, type SVGProps } from "react"

// The app's ball: ball yellow, a soft shade lower right, two white seams.
// The same drawing as public/favicon.svg, so keep the two in step.
export function BallIcon(props: SVGProps<SVGSVGElement>) {
  const clip = useId()
  return (
    <svg viewBox="0 0 512 512" aria-hidden {...props}>
      <clipPath id={clip}>
        <circle cx="256" cy="256" r="240" />
      </clipPath>
      <circle cx="256" cy="256" r="240" fill="#c2cf33" />
      <g clipPath={`url(#${clip})`}>
        <circle cx="220" cy="220" r="240" className="fill-accent" />
        <g transform="rotate(-30 256 256)" fill="none" stroke="#fff" strokeWidth="30">
          <circle cx="-64" cy="256" r="250" />
          <circle cx="576" cy="256" r="250" />
        </g>
      </g>
    </svg>
  )
}
