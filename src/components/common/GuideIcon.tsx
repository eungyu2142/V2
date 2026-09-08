import type { ReactNode, SVGProps } from 'react'
import './GuideIcon.css'

export type GuideTone = 'mint' | 'red' | 'blue' | 'gold' | 'brown' | 'neutral'

export function GuideIcon({ children, tone = 'mint', className = '', ...props }: SVGProps<SVGSVGElement> & { children: ReactNode; tone?: GuideTone }) {
  return <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" {...props} className={`guide-icon guide-icon--${tone} ${className}`}>
    <circle className="guide-icon-disc" cx="16" cy="16" r="15" />
    <g className="guide-icon-art" transform="translate(5 5) scale(.9167)" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</g>
  </svg>
}
