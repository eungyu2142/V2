import type { SVGProps } from 'react'
import { ReferenceIcon, type ReferenceIconName } from '../../components/common/ReferenceIcon'
import { GuideIcon } from '../../components/common/GuideIcon'

export type DiaryGlyphName = 'feed' | 'mist' | 'water' | 'temperature' | 'humidity' | 'cleaning' | 'weight' | 'poop' | 'shed' | 'mating' | 'egg' | 'hospital' | 'medicine' | 'uvb' | 'other' | 'calendar' | 'chart' | 'check'

export default function DiaryGlyph({ name, ...props }: { name: DiaryGlyphName } & SVGProps<SVGSVGElement>) {
  if (name === 'chart') return <GuideIcon {...props}><path d="M4 20V5M4 20h17M7 16l4-4 3 2 5-7" /></GuideIcon>
  if (name === 'other') return <GuideIcon {...props}><path d="M5 12h.01M12 12h.01M19 12h.01" /></GuideIcon>
  return <ReferenceIcon name={name as ReferenceIconName} {...props} />
}
