import type { SVGProps } from 'react'

const iconCenters = {
  feed: [48, 1134], mist: [93, 1134], water: [140, 1134],
  temperature: [185, 1134], humidity: [231, 1134], cleaning: [279, 1134],
  uvb: [329, 1134], spot: [374, 1134], waterTemperature: [420, 1134],
  weight: [465, 1134], medicine: [509, 1134], shed: [554, 1134],
  poop: [644, 1134], mating: [689, 1134], egg: [736, 1134], hospital: [780, 1134],
  calendar: [46, 1174], location: [140, 1174], edit: [328, 1174],
  camera: [376, 1174], warning: [425, 1174], check: [471, 1174],
  pet: [519, 1174], record: [566, 1174], settings: [615, 1174],
} as const

export type ReferenceIconName = keyof typeof iconCenters

/** Display the exact icon supplied by the user, using an SVG image viewport. */
export function ReferenceIcon({ name, className = '', ...props }: { name: ReferenceIconName } & SVGProps<SVGSVGElement>) {
  const [x, y] = iconCenters[name]
  return <svg width="32" height="32" viewBox={`${x - 12} ${y - 12} 24 24`} aria-hidden="true" {...props} className={`guide-icon ${className}`}>
    <image href="/ui-flow-reference.png" width="1312" height="1199" />
  </svg>
}
