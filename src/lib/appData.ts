import { supabase } from './supabase'

export type AppDataTable = string

type StoredRow<T> = {
  id: string
  user_id?: string
  payload: T
  view_count?: number
}

export async function loadAppData<T>(table: AppDataTable, options: { userId?: string; scope?: 'mine' | 'all'; includeViewCount?: boolean } = {}) {
  const buildQuery = (includeViewCount: boolean) => supabase
    .from(table)
    .select(includeViewCount ? 'id, user_id, payload, view_count' : 'id, user_id, payload')
    .order('created_at', { ascending: false })

  const applyScope = (query: ReturnType<typeof buildQuery>) => {
    if (options.userId && options.scope === 'mine') return query.eq('user_id', options.userId)
    return query
  }

  let { data, error } = await applyScope(buildQuery(Boolean(options.includeViewCount)))
  // Older Supabase schemas may not have the optional view_count column yet.
  if (error && options.includeViewCount) {
    ({ data, error } = await applyScope(buildQuery(false)))
  }
  if (error) throw error
  return ((data ?? []) as unknown as StoredRow<T>[]).map((row) => ({
    ...row.payload,
    id: row.id,
    ...(options.userId ? { mine: row.user_id === options.userId } : {}),
    ...(options.includeViewCount ? { viewCount: row.view_count ?? 0 } : {}),
  }))
}

export async function saveAppData<T extends { id: string }>(
  table: AppDataTable,
  userId: string,
  item: T,
  required: Record<string, unknown>,
) {
  const { error } = await supabase.from(table).upsert({
    id: item.id,
    user_id: userId,
    payload: item,
    ...required,
  })
  if (error) throw error
}

export async function deleteAppData(table: AppDataTable, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}
