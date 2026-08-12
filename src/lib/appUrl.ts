import type { Tab } from '../types/app'

const allowedTabs: Tab[] = ['pets', 'diary', 'map', 'qna', 'profile']
const profileTabs = ['posts', 'drafts', 'likes', 'reviews', 'settings']

export function readInitialUrlState(): { tab: Tab; petId: string | null } {
  if (window.location.pathname === '/profile') return { tab: 'profile', petId: null }

  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  const petId = params.get('petId')
  return {
    tab: tab && allowedTabs.includes(tab) ? tab : petId ? 'diary' : 'pets',
    petId,
  }
}

export function syncAppUrl(tab: Tab, petId?: string | null) {
  if (tab === 'profile') {
    const current = new URLSearchParams(window.location.search).get('tab')
    const next = current && profileTabs.includes(current) ? current : 'posts'
    window.history.replaceState(window.history.state, '', `/profile?tab=${next}${window.location.hash}`)
    return
  }

  const params = new URLSearchParams(window.location.search)
  params.set('tab', tab)
  if (petId) params.set('petId', petId)
  else params.delete('petId')
  const pathname = window.location.pathname === '/profile' ? '/' : window.location.pathname
  window.history.replaceState(window.history.state, '', `${pathname}?${params.toString()}${window.location.hash}`)
}
