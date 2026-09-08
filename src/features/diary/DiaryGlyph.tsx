import type { ReactNode, SVGProps } from 'react'
import { GuideIcon, type GuideTone } from '../../components/common/GuideIcon'

export type DiaryGlyphName = 'feed' | 'mist' | 'water' | 'temperature' | 'humidity' | 'cleaning' | 'weight' | 'poop' | 'shed' | 'mating' | 'egg' | 'hospital' | 'medicine' | 'other' | 'calendar' | 'chart' | 'check'

const tones: Partial<Record<DiaryGlyphName, GuideTone>> = { feed: 'red', temperature: 'red', mist: 'blue', humidity: 'blue', poop: 'brown', egg: 'gold', mating: 'red', hospital: 'mint' }

export default function DiaryGlyph({ name, ...props }: { name: DiaryGlyphName } & SVGProps<SVGSVGElement>) {
  const paths: Record<DiaryGlyphName, ReactNode> = {
    feed: <><path d="M6 3v7M3.5 3v4.5A2.5 2.5 0 0 0 6 10a2.5 2.5 0 0 0 2.5-2.5V3M6 10v11M15 3v18M15 3c4 1.7 5.3 5.7 3 9h-3" /></>,
    mist: <><path d="M8 8h8l2 3v9H6v-9l2-3ZM9 8V5h5M14 5l2-2M18 4h3" /><path d="M10 13v3M14 12v5M18 13v3" /></>,
    water: <><ellipse cx="12" cy="7" rx="7.5" ry="3" /><path d="M4.5 7v9c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V7M7 9.3v5.2" /></>,
    temperature: <><path d="M10 14.7V5a3 3 0 0 1 6 0v9.7a5 5 0 1 1-6 0Z" /><path d="M13 7v9" /></>,
    humidity: <><path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5Z" /><path d="M9.5 16.5c.8 1 2 1.5 3.2 1.2" /></>,
    cleaning: <><path d="m8 14 7-7 3 3-7 7M14.5 7.5l2-3 2 2-2.5 2.5M8 14l-4 1 5 5 2-3" /></>,
    weight: <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 5V3h8v2M8.5 11a3.5 3.5 0 0 1 7 0M12 11l2-2" /></>,
    poop: <path d="M7 19h10c2.1 0 3.5-1.2 3.5-3s-1.5-3-3.5-3h-.5c1.2-.7 1.8-1.7 1.5-3-.4-1.7-1.9-2.4-3.8-2.1.8-1.2.5-2.8-.6-3.7-1.2-1-3-.8-4 .4-.9 1-.9 2.5-.2 3.4C7 7.8 5.4 9 5.5 11c0 1 .5 1.7 1.2 2H7c-2 0-3.5 1.2-3.5 3S4.9 19 7 19Z" />,
    shed: <><path d="M6 18c3-1 3-4 1-6-2.5-2.5-.6-7 3-8 4-1 8 2 8 6 0 5-4.5 8.5-9 7" /><circle cx="13.5" cy="8" r=".8" fill="currentColor" stroke="none" /><path d="M5 20c2.5 1 5 .3 6.5-1.5" /></>,
    mating: <path d="M12 20S3.5 15 3.5 8.8C3.5 5.6 7.4 3.7 10 6l2 1.8L14 6c2.6-2.3 6.5-.4 6.5 2.8C20.5 15 12 20 12 20Z" />,
    egg: <><ellipse cx="8" cy="14" rx="4" ry="6" /><ellipse cx="16" cy="14" rx="4" ry="6" /><ellipse cx="12" cy="9" rx="4" ry="6" /></>,
    hospital: <><rect x="4" y="7" width="16" height="14" rx="2" /><path d="M9 7V4h6v3M12 11v6M9 14h6" /></>,
    medicine: <><path d="M7.2 17.8a4.2 4.2 0 0 1 0-5.9l4.7-4.7a4.2 4.2 0 0 1 5.9 5.9l-4.7 4.7a4.2 4.2 0 0 1-5.9 0Z" /><path d="m9.5 9.6 4.9 4.9" /></>,
    other: <><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h.1M12 14h.1M16 14h.1M8 18h.1M12 18h.1" /></>,
    chart: <><path d="M4 20V5M4 20h17M7 16l4-4 3 2 5-7" /><circle cx="7" cy="16" r="1" /><circle cx="11" cy="12" r="1" /><circle cx="14" cy="14" r="1" /><circle cx="19" cy="7" r="1" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
  }
  return <GuideIcon tone={tones[name]} {...props}>{paths[name === 'mist' ? 'humidity' : name]}</GuideIcon>
}
