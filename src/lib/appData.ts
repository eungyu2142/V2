import { supabase } from './supabase'

export type AppDataTable = string

type StoredRow<T> = {
  id: string
  user_id?: string
  payload: T
  view_count?: number
  species_id?: string
  species?: string
  category?: string
}

export async function loadAppData<T>(table: AppDataTable, options: { userId?: string; scope?: 'mine' | 'all'; includeViewCount?: boolean } = {}) {
  const buildQuery = (includeViewCount: boolean, includeNormalizedSpecies = table === 'pets') => supabase
    .from(table)
    .select([
      'id',
      'user_id',
      'payload',
      ...(includeViewCount ? ['view_count'] : []),
      ...(includeNormalizedSpecies ? ['species_id', 'species', 'category'] : []),
    ].join(', '))
    .order('created_at', { ascending: false })

  const applyScope = (query: ReturnType<typeof buildQuery>) => {
    if (options.userId && options.scope === 'mine') return query.eq('user_id', options.userId)
    return query
  }

  let { data, error } = await applyScope(buildQuery(Boolean(options.includeViewCount)))
  // During the additive migration, older environments may not have species_id yet.
  if (error && table === 'pets') {
    ({ data, error } = await applyScope(buildQuery(Boolean(options.includeViewCount), false)))
  }
  // Older Supabase schemas may not have the optional view_count column yet.
  if (error && options.includeViewCount) {
    ({ data, error } = await applyScope(buildQuery(false, table === 'pets')))
    if (error && table === 'pets') ({ data, error } = await applyScope(buildQuery(false, false)))
  }
  if (error) throw error
  return ((data ?? []) as unknown as StoredRow<T>[]).map((row) => ({
    ...row.payload,
    id: row.id,
    ...(table === 'pets' && row.species ? { species: row.species, group: row.category } : {}),
    ...(row.user_id ? { ownerUserId: row.user_id } : {}),
    ...(row.species_id ? { speciesId: row.species_id } : {}),
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

export async function deleteAppData(table: AppDataTable, id: string, userId: string) {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) throw error
  if (!data?.some((row) => row.id === id)) {
    throw new Error(`No ${table} row was deleted.`)
  }
}
