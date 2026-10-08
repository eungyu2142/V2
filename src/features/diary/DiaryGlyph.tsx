import type { SVGProps } from 'react'
import { ReferenceIcon, type ReferenceIconName } from '../../components/common/ReferenceIcon'
import { GuideIcon } from '../../components/common/GuideIcon'

export type DiaryGlyphName = 'feed' | 'mist' | 'water' | 'temperature' | 'humidity' | 'cleaning' | 'weight' | 'poop' | 'shed' | 'mating' | 'egg' | 'hospital' | 'medicine' | 'uvb' | 'other' | 'calendar' | 'chart' | 'check'

type DiaryMarkViewport = [centerX: number, centerY: number, width: number, height: number]

const diaryMarkViewports: Partial<Record<DiaryGlyphName, DiaryMarkViewport>> = {
  feed: [132, 129, 136, 112],
  mist: [429, 129, 130, 112],
  cleaning: [727, 129, 130, 112],
  medicine: [1024, 129, 126, 112],
  humidity: [1225, 129, 128, 112],
  temperature: [132, 256, 120, 112],
  weight: [454, 256, 124, 112],
  shed: [132, 414, 150, 112],
  poop: [132, 542, 150, 112],
  mating: [132, 670, 150, 112],
  egg: [132, 800, 150, 112],
  hospital: [132, 927, 150, 112],
  calendar: [930, 550, 230, 220],
}

function DiaryReferenceMark({ name, ...props }: { name: DiaryGlyphName } & SVGProps<SVGSVGElement>) {
  const viewport = diaryMarkViewports[name]
  if (!viewport) return null
  const [centerX, centerY, width, height] = viewport
  return <svg width="32" height="32" {...props} viewBox={`${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" className={`diary-reference-mark ${props.className ?? ''}`.trim()}>
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
