import type { PointerEventHandler, ReactNode } from 'react'
import type { AppProfile, Tab } from '../../types/app'
import Mascot from '../common/Mascot'
import { appTabs } from './navigationConfig'

const navigationPaths: Record<Exclude<Tab, 'profile'>, ReactNode> = {
  pets: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  diary: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16M8 14h3m2 0h3m-8 3h3" /></>,
  map: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  qna: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" /></>,
}

type AppNavigationProps = {
  activeTab: Tab
  profile: AppProfile
  sideNavOpen: boolean
  onOpenMenu: () => void
  onCloseMenu: () => void
  onMoveTab: (tab: Tab) => void
  onToggleProfile: () => void
  onBottomPointerDown: PointerEventHandler<HTMLElement>
  onBottomPointerMove: PointerEventHandler<HTMLElement>
  onBottomPointerUp: PointerEventHandler<HTMLElement>
  onBottomPointerCancel: () => void
  shouldSuppressBottomClick: () => boolean
}

export function AppNavigation(props: AppNavigationProps) {
  const { activeTab, profile, onMoveTab, onToggleProfile } = props
  return <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[var(--app-header-height)] items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 max-[700px]:px-4">
      <div className="flex items-center gap-3 text-[var(--color-primary-900)]"><Mascot className="size-10! max-[700px]:size-8!" /><strong className="text-2xl font-black tracking-tight max-[700px]:text-xl">파작파작</strong><span className="ml-2 text-xs max-[700px]:hidden">작은 관리가, 큰 하루가 돼요.</span></div>
      <button className="grid size-10 shrink-0 aspect-square place-items-center overflow-hidden rounded-full text-[var(--color-primary-900)] hover:bg-[var(--color-primary-50)] aria-pressed:bg-[var(--color-primary-600)] aria-pressed:text-[var(--color-on-primary)]" type="button" aria-label={activeTab === 'profile' ? '프로필 닫기' : '프로필 열기'} aria-pressed={activeTab === 'profile'} onClick={onToggleProfile}>
        {profile.avatarUrl ? <img className="block size-full aspect-square rounded-full object-cover" src={profile.avatarUrl} alt="" /> : <svg className="size-6 fill-none stroke-current" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>}
      </button>
    </header>
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[var(--app-nav-clearance)] justify-center border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))]" aria-label="주요 메뉴" onPointerDown={props.onBottomPointerDown} onPointerMove={props.onBottomPointerMove} onPointerUp={props.onBottomPointerUp} onPointerCancel={props.onBottomPointerCancel}>
      {appTabs.map((tab) => <button className={`flex min-h-12 w-1/4 max-w-[150px] flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] text-xs hover:bg-[var(--color-primary-50)] ${activeTab === tab.id ? 'font-bold text-[var(--color-primary-600)]' : 'text-[var(--color-text-secondary)]'}`} key={tab.id} type="button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={(event) => {
        if (props.shouldSuppressBottomClick()) { event.preventDefault(); return }
        onMoveTab(tab.id)
      }}><span className={`grid size-7 place-items-center rounded-full ${activeTab === tab.id ? 'bg-[var(--color-primary-600)] text-[var(--color-on-primary)]' : ''}`}><svg className="size-5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">{navigationPaths[tab.id]}</svg></span><span>{tab.label}</span></button>)}
    </nav>
  </>
}
