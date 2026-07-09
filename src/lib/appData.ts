import { supabase } from './supabase'

export type AppDataTable = string

type StoredRow<T> = {
  id: string
  payload: T
}

export async function loadAppData<T>(table: AppDataTable) {
  const { data, error } = await supabase
    .from(table)
    .select('id, payload')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as StoredRow<T>[]).map((row) => ({ ...row.payload, id: row.id }))
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
