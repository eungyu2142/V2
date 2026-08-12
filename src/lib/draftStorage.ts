import type { DraftItem } from '../types/app'

const LOCAL_DRAFTS_KEY_PREFIX = 'exocare:drafts'

function localDraftsKey(userId: string) {
  return `${LOCAL_DRAFTS_KEY_PREFIX}:${userId}`
}

export function readLocalDrafts(userId: string): DraftItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(localDraftsKey(userId)) ?? '[]')
    return Array.isArray(value) ? value as DraftItem[] : []
  } catch {
    return []
  }
}

export function writeLocalDrafts(userId: string, items: DraftItem[]) {
  localStorage.setItem(localDraftsKey(userId), JSON.stringify(items))
}
