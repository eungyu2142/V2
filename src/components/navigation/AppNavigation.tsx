import type { PointerEventHandler, ReactNode } from 'react'
import './Navigation.css'
import type { AppProfile, Tab } from '../../types/app'
import { appTabs } from './navigationConfig'

function NavigationIcon({ tab, mobile = false }: { tab: Tab; mobile?: boolean }) {
  const className = `${mobile ? 'bottom-nav-icon ' : ''}side-nav-icon nav-icon-vector ${tab}`
  const paths: Record<Tab, ReactNode> = {
    pets: <><ellipse cx="6.4" cy="7.2" rx="2" ry="2.7" /><ellipse cx="10.2" cy="4.6" rx="2" ry="2.7" /><ellipse cx="14.3" cy="4.6" rx="2" ry="2.7" /><ellipse cx="18" cy="7.3" rx="2" ry="2.7" /><path d="M6.7 16.3c.2-3.9 2.3-6.5 5.3-6.5s5.1 2.6 5.3 6.5c.1 2.1-1.7 3.5-3.6 2.7a4.5 4.5 0 0 0-3.4 0c-1.9.8-3.7-.6-3.6-2.7Z" /></>,
    diary: <><path d="M6.5 3.5h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" /><path d="M2.8 7h3.4M2.8 11h3.4M2.8 15h3.4" /><path d="m12.2 15.8.8-3.2 5.6-5.6 2.4 2.4-5.6 5.6-3.2.8Zm5.2-7.6 2.4 2.4" /></>,
    map: <><path d="M19 10.2c0 5.2-7 11-7 11s-7-5.8-7-11a7 7 0 1 1 14 0Z" /><path d="M12 6.8v6.4M8.8 10h6.4" /></>,
    qna: <><path d="M3.2 14.8 2.5 19l4-1.9a8.5 8.5 0 0 0 3.5.7c4.4 0 8-3 8-6.7s-3.6-6.6-8-6.6-8 3-8 6.6c0 1.4.4 2.6 1.2 3.7Z" /><path d="M15.4 8.2c3.5.3 6.1 2.7 6.1 5.7 0 1.2-.4 2.3-1 3.2l.6 3.5-3.4-1.6a7.5 7.5 0 0 1-5.4.2" /><circle cx="7.2" cy="11.1" r=".7" fill="currentColor" stroke="none" /><circle cx="10" cy="11.1" r=".7" fill="currentColor" stroke="none" /><circle cx="12.8" cy="11.1" r=".7" fill="currentColor" stroke="none" /></>,
    profile: <><circle cx="12" cy="7" r="4" /><path d="M4.5 20c.2-5 3-8 7.5-8s7.3 3 7.5 8c-2.2 1-4.7 1.5-7.5 1.5S6.7 21 4.5 20Z" /></>,
  }
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{paths[tab]}</svg>
}

function BotanicalDecoration() {
  return <div className="side-nav-botanical" aria-hidden="true">{['upper-left', 'top', 'middle-left', 'middle-right', 'bottom', 'lower-right'].map((position) => <svg className={`side-nav-leaves side-nav-leaves-${position}`} viewBox="0 0 96 150" key={position}><path className="leaf-stem" d="M88 4C72 30 74 61 55 83 39 101 20 113 8 145" /><path className="leaf-shape" d="M73 39c-15-1-24-9-26-24 15 1 24 9 26 24ZM67 61c10-12 21-15 34-9-9 12-21 15-34 9ZM45 93c-14 2-24-4-30-17 14-2 24 4 30 17ZM34 110c11-9 22-10 33-2-11 9-22 10-33 2Z" /></svg>)}</div>
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
  const { activeTab, profile, sideNavOpen, onOpenMenu, onCloseMenu, onMoveTab, onToggleProfile } = props
  const move = (tab: Tab) => { onMoveTab(tab); onCloseMenu() }
  return <>
    <button className="menu-trigger" type="button" aria-label="메뉴 열기" aria-expanded={sideNavOpen} onClick={onOpenMenu}><span /><span /><span /></button>
    {activeTab !== 'map' && <button className={`mobile-profile-button ${activeTab === 'profile' ? 'active' : ''}`} type="button" aria-label="프로필 열기" onClick={onToggleProfile}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{(profile.nickname || profile.username || 'ME').slice(0, 2).toUpperCase()}</span>}</button>}
    <button className={`side-nav-dim ${sideNavOpen ? 'open' : ''}`} type="button" aria-label="메뉴 닫기" onClick={onCloseMenu} />
    <aside className={`side-nav ${sideNavOpen ? 'open' : ''}`}><BotanicalDecoration /><nav>{appTabs.map((tab) => <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => move(tab.id)}><NavigationIcon tab={tab.id} />{tab.label}</button>)}</nav><button className={`side-nav-profile ${activeTab === 'profile' ? 'active' : ''}`} type="button" onClick={() => { onToggleProfile(); onCloseMenu() }}><NavigationIcon tab="profile" /><span>프로필</span></button></aside>
    <nav className={`bottom-nav ${activeTab === 'map' ? 'map-bottom-nav' : ''}`} onPointerDown={props.onBottomPointerDown} onPointerMove={props.onBottomPointerMove} onPointerUp={props.onBottomPointerUp} onPointerCancel={props.onBottomPointerCancel}>{appTabs.map((tab) => <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={(event) => { if (props.shouldSuppressBottomClick()) { event.preventDefault(); return } onMoveTab(tab.id) }}><NavigationIcon tab={tab.id} mobile /><span className="bottom-nav-label">{tab.label}</span></button>)}</nav>
  </>
}
