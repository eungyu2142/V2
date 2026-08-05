import type { HospitalSnapshot } from '../types/app'
import { supabase } from './supabase'

type HospitalLikeRow = {
  hospital_key: string
  payload: HospitalSnapshot
}

function normalizeIdentity(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, '')
}

export function getHospitalLikeKey(hospital: Pick<HospitalSnapshot, 'name' | 'address'>) {
  return `${normalizeIdentity(hospital.name)}|${normalizeIdentity(hospital.address)}`
}

function dedupeHospitalSnapshots(items: HospitalSnapshot[]) {
  const unique = new Map<string, HospitalSnapshot>()
  items.forEach((item) => unique.set(getHospitalLikeKey(item), item))
  return [...unique.values()]
}

export async function loadHospitalLikes(userId: string) {
  const { data, error } = await supabase
    .from('hospital_likes')
    .select('hospital_key, payload')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return dedupeHospitalSnapshots(((data ?? []) as HospitalLikeRow[]).map((row) => row.payload))
}

export async function saveHospitalLike(userId: string, hospital: HospitalSnapshot) {
  const { error } = await supabase.from('hospital_likes').upsert({
    user_id: userId,
    hospital_key: getHospitalLikeKey(hospital),
    hospital_id: hospital.id ?? null,
    payload: hospital,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,hospital_key' })

  if (error) throw error
}

export async function deleteHospitalLike(userId: string, hospital: HospitalSnapshot) {
  const { error } = await supabase
    .from('hospital_likes')
    .delete()
    .eq('user_id', userId)
    .eq('hospital_key', getHospitalLikeKey(hospital))

  if (error) throw error
}

export async function mergeLocalHospitalLikes(userId: string, localItems: HospitalSnapshot[]) {
  const remoteItems = await loadHospitalLikes(userId)
  const merged = dedupeHospitalSnapshots([...remoteItems, ...localItems])
  const remoteKeys = new Set(remoteItems.map(getHospitalLikeKey))
  const pendingItems = localItems.filter((item) => !remoteKeys.has(getHospitalLikeKey(item)))
  await Promise.all(pendingItems.map((item) => saveHospitalLike(userId, item)))
  return merged
}
