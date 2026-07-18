import { supabase } from './supabase'

export type AppDataTable = string

type StoredRow<T> = {
  id: string
  user_id?: string
  payload: T
}

export async function loadAppData<T>(table: AppDataTable, options: { userId?: string; scope?: 'mine' | 'all' } = {}) {
  let query = supabase
    .from(table)
    .select('id, user_id, payload')
    .order('created_at', { ascending: false })

  if (options.userId && options.scope === 'mine') {
    query = query.eq('user_id', options.userId)
  }

  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as StoredRow<T>[]).map((row) => ({
    ...row.payload,
    id: row.id,
    ...(options.userId ? { mine: row.user_id === options.userId } : {}),
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
