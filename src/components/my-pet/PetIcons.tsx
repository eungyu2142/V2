import type { ReactNode, SVGProps } from 'react'
import { GuideIcon } from '../common/GuideIcon'

export type PetIconName = 'pet' | 'add' | 'profile' | 'edit' | 'delete' | 'reptile' | 'amphibian' | 'male' | 'female' | 'unknown' | 'camera' | 'calendar' | 'weight' | 'record' | 'feed' | 'mist' | 'temperature' | 'check' | 'back' | 'chevron' | 'routine' | 'stats'

const paths: Record<PetIconName, ReactNode> = {
  pet: <><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="19.5" cy="12" r="1.5"/><path d="M12 10c-3.8 0-7 3.2-7 6.5C5 19 7 21 9.3 19.7a5.8 5.8 0 0 1 5.4 0C17 21 19 19 19 16.5 19 13.2 15.8 10 12 10Z"/></>,
  add: <><path d="M12 5v14M5 12h14"/></>,
  profile: <><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M8 17c.8-2 2.1-3 4-3s3.2 1 4 3"/></>,
  edit: <><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.2 3 3"/></>,
  delete: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  reptile: <><path d="M4 14c3-5 6-7 10-6 3 .7 5 3 4 5.5-.8 2.1-4 2.5-6 1.1-1.7-1.1-3.8-.9-5.3.6L4 18"/><path d="m9 10-2-3m7 1 1-3m-6 10-2 3m7-3 2 3"/><circle cx="16" cy="11" r=".7" fill="currentColor"/></>,
  amphibian: <><path d="M7 10c0-3 2.2-5 5-5s5 2 5 5c2 1.2 3 3 2 5-1 2.2-3.3 3.5-7 3.5S6 17.2 5 15c-1-2 .1-3.8 2-5Z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 14c1.6 1.2 4.4 1.2 6 0M6 16l-2 3m14-3 2 3"/></>,
  male: <><circle cx="10" cy="14" r="5"/><path d="m14 10 6-6m-5 0h5v5"/></>,
  female: <><circle cx="12" cy="9" r="5"/><path d="M12 14v7m-3-3h6"/></>,
  unknown: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 2-2.4 2.1-2.4 4m0 3h.01"/></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16M8 14h.01m4 0h.01m4 0h.01"/></>,
  weight: <><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0m-3 3v3l2 1"/></>,
  record: <><path d="M7 3h10v4H7z"/><path d="M6 5H4v16h16V5h-2M8 12h8M8 16h6"/></>,
  feed: <><circle cx="12" cy="13" r="7"/><path d="M5 12h14M9 7c0-2 1-3 3-4m3 5c1-1 2-1 3-1"/></>,
  mist: <><path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z"/><path d="M9 16c.5 1.5 1.5 2 3 2"/></>,
  temperature: <><path d="M10 14.8V5a2 2 0 0 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 9v8"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
  back: <><path d="m15 18-6-6 6-6"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  routine: <><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="18" r="1" fill="currentColor"/></>,
  stats: <><path d="M5 20V10m7 10V4m7 16v-7"/><path d="M3 20h18"/></>,
}

export function PetIcon({ name, ...props }: { name: PetIconName } & SVGProps<SVGSVGElement>) {
  return <GuideIcon tone={name === 'delete' || name === 'temperature' || name === 'feed' ? 'red' : name === 'mist' ? 'blue' : 'mint'} {...props}>{paths[name]}</GuideIcon>
}

export function PetIconMark({ name, className = '' }: { name: PetIconName; className?: string }) {
  return <span className={`pet-icon-mark ${className}`} aria-hidden="true"><PetIcon name={name} /></span>
}
