import type { Tab } from '../../types/app'

export const appTabs: Array<{ id: Exclude<Tab, 'profile'>; label: string }> = [
  { id: 'pets', label: '마이 펫' },
  { id: 'diary', label: '다이어리' },
  { id: 'map', label: '병원 찾기' },
  { id: 'qna', label: 'Q&A' },
]
