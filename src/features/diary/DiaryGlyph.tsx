import type { SVGProps } from 'react'
import { ReferenceIcon, type ReferenceIconName } from '../../components/common/ReferenceIcon'
import { GuideIcon } from '../../components/common/GuideIcon'

export type DiaryGlyphName = 'feed' | 'mist' | 'water' | 'temperature' | 'humidity' | 'cleaning' | 'weight' | 'poop' | 'shed' | 'mating' | 'egg' | 'hospital' | 'medicine' | 'uvb' | 'other' | 'calendar' | 'chart' | 'check'

const diaryMarkViewports: Partial<Record<DiaryGlyphName, [number, number, number]>> = {
  feed: [132, 129, 92],
  mist: [429, 129, 92],
  cleaning: [727, 129, 92],
  medicine: [1024, 129, 92],
  humidity: [1225, 129, 92],
  temperature: [132, 256, 92],
  weight: [454, 256, 92],
  shed: [130, 414, 98],
  poop: [132, 542, 98],
  mating: [132, 670, 98],
  egg: [132, 800, 98],
  hospital: [132, 927, 98],
  calendar: [930, 545, 210],
}

function DiaryReferenceMark({ name, ...props }: { name: DiaryGlyphName } & SVGProps<SVGSVGElement>) {
  const viewport = diaryMarkViewports[name]
  if (!viewport) return null
  const [centerX, centerY, size] = viewport
  return <svg width="32" height="32" {...props} viewBox={`${centerX - size / 2} ${centerY - size / 2} ${size} ${size}`} aria-hidden="true" className={`diary-reference-mark ${props.className ?? ''}`.trim()}>
    <image href="/diary-mark-reference.png" width="1536" height="1024" />
  </svg>
}

export default function DiaryGlyph({ name, ...props }: { name: DiaryGlyphName } & SVGProps<SVGSVGElement>) {
  if (diaryMarkViewports[name]) return <DiaryReferenceMark name={name} {...props} />
  if (name === 'chart') return <GuideIcon {...props}><path d="M4 20V5M4 20h17M7 16l4-4 3 2 5-7" /></GuideIcon>
  if (name === 'other') return <GuideIcon {...props}><path d="M5 12h.01M12 12h.01M19 12h.01" /></GuideIcon>
  if (name === 'check') return <GuideIcon {...props}><path d="m6.5 12.25 3.35 3.35 7.65-7.65" /></GuideIcon>
  return <ReferenceIcon name={name as ReferenceIconName} {...props} />
}
