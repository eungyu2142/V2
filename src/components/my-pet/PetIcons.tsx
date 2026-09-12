import type { ReactNode, SVGProps } from 'react'
import { GuideIcon } from '../common/GuideIcon'
import { ReferenceIcon, type ReferenceIconName } from '../common/ReferenceIcon'

export type PetIconName = 'pet' | 'add' | 'profile' | 'edit' | 'delete' | 'reptile' | 'amphibian' | 'male' | 'female' | 'unknown' | 'camera' | 'calendar' | 'weight' | 'record' | 'feed' | 'mist' | 'temperature' | 'check' | 'back' | 'chevron' | 'routine' | 'stats' | 'settings' | 'water' | 'cleaning' | 'uvb' | 'medicine' | 'spot'

const paths: Partial<Record<PetIconName, ReactNode>> = {
  add: <><path d="M12 5v14M5 12h14"/></>,
  profile: <><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M8 17c.8-2 2.1-3 4-3s3.2 1 4 3"/></>,
  delete: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  reptile: <><path d="M4 14c3-5 6-7 10-6 3 .7 5 3 4 5.5-.8 2.1-4 2.5-6 1.1-1.7-1.1-3.8-.9-5.3.6L4 18"/><path d="m9 10-2-3m7 1 1-3m-6 10-2 3m7-3 2 3"/><circle cx="16" cy="11" r=".7" fill="currentColor"/></>,
  amphibian: <><path d="M7 10c0-3 2.2-5 5-5s5 2 5 5c2 1.2 3 3 2 5-1 2.2-3.3 3.5-7 3.5S6 17.2 5 15c-1-2 .1-3.8 2-5Z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M9 14c1.6 1.2 4.4 1.2 6 0M6 16l-2 3m14-3 2 3"/></>,
  male: <><circle cx="10" cy="14" r="5"/><path d="m14 10 6-6m-5 0h5v5"/></>,
  female: <><circle cx="12" cy="9" r="5"/><path d="M12 14v7m-3-3h6"/></>,
  unknown: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 0 1 4.6 1c0 2-2.4 2.1-2.4 4m0 3h.01"/></>,
  back: <><path d="m15 18-6-6 6-6"/></>,
  chevron: <><path d="m9 18 6-6-6-6"/></>,
  routine: <><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="7" cy="6" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="18" r="1" fill="currentColor"/></>,
  stats: <><path d="M5 20V10m7 10V4m7 16v-7"/><path d="M3 20h18"/></>,
}

export function PetIcon({ name, ...props }: { name: PetIconName } & SVGProps<SVGSVGElement>) {
  if (!paths[name]) return <ReferenceIcon name={name as ReferenceIconName} {...props} />
  return <GuideIcon tone={name === 'delete' ? 'red' : 'mint'} {...props}>{paths[name]}</GuideIcon>
}

export function PetIconMark({ name, className = '' }: { name: PetIconName; className?: string }) {
  return <span className={`pet-icon-mark ${className}`} aria-hidden="true"><PetIcon name={name} /></span>
}
