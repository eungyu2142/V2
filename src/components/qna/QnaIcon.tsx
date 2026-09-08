import type { ReactNode } from 'react'
import { GuideIcon } from '../common/GuideIcon'

export type QnaIconName = 'search' | 'filter' | 'write' | 'more' | 'clock' | 'disease' | 'care' | 'food' | 'environment' | 'behavior' | 'breeding' | 'other'

const paths: Record<QnaIconName, ReactNode> = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.3 4.3" /></>,
  filter: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
  write: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  more: <><circle cx="5" cy="12" r="1.35" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.35" fill="currentColor" stroke="none" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3.2 2" /></>,
  disease: <><path d="M8 4v6a4 4 0 0 0 8 0V4" /><path d="M8 4H5.5M16 4h2.5M16 13.5v2a4 4 0 0 0 8 0v-1" /><circle cx="22" cy="12" r="2" /></>,
  care: <><path d="M5 18C7 9 12 5 20 4c-1 8-5 13-13 14" /><path d="M7 18c3-4 6-7 10-10" /></>,
  food: <><path d="M5 11h14l-1.2 7H6.2L5 11Z" /><path d="M8 11c.4-3 2-4 4-4s3.6 1 4 4M9 7V5m3 2V4m3 3V5" /></>,
  environment: <><path d="M10 5a2 2 0 0 1 4 0v9.1a4.5 4.5 0 1 1-4 0V5Z" /><path d="M12 8v8" /></>,
  behavior: <><ellipse cx="6" cy="7" rx="2" ry="2.6" /><ellipse cx="10" cy="4.8" rx="2" ry="2.6" /><ellipse cx="14.2" cy="4.8" rx="2" ry="2.6" /><ellipse cx="18" cy="7" rx="2" ry="2.6" /><path d="M7 16c.2-3.8 2-6 5-6s4.8 2.2 5 6c.1 2-1.6 3.2-3.3 2.5a4.4 4.4 0 0 0-3.4 0C8.6 19.2 6.9 18 7 16Z" /></>,
  breeding: <><path d="M12 3.5c4 0 6.5 3.6 6.5 8.2 0 5-2.8 8.8-6.5 8.8s-6.5-3.8-6.5-8.8C5.5 7.1 8 3.5 12 3.5Z" /></>,
  other: <><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
}

export function QnaIcon({ name, className = '' }: { name: QnaIconName; className?: string }) {
  return <GuideIcon className={`qna-guide-icon ${className}`} tone={name === 'food' ? 'red' : name === 'breeding' ? 'gold' : 'mint'}>{paths[name]}</GuideIcon>
}
