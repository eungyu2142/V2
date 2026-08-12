import { supabase } from './supabase'

export type LikeTargetType = 'community_post' | 'question' | 'hospital_review'

export type LikeState = {
  liked: boolean
  likes: number
}

export async function loadLikeStates(targetType: LikeTargetType, targetIds: string[], userId: string) {
  if (targetIds.length === 0) return {} as Record<string, LikeState>

  const { data, error } = await supabase
    .from('likes')
    .select('target_id, user_id')
    .eq('target_type', targetType)
    .in('target_id', targetIds)

  if (error) throw error

  const states: Record<string, LikeState> = {}
  for (const row of data ?? []) {
    const targetId = String(row.target_id)
    const current = states[targetId] ?? { liked: false, likes: 0 }
    states[targetId] = {
      liked: current.liked || row.user_id === userId,
      likes: current.likes + 1,
    }
  }
  return states
}

export async function saveLike(targetType: LikeTargetType, targetId: string, userId: string, liked: boolean) {
  const { data: authData } = await supabase.auth.getUser()
  const ownerId = authData.user?.id ?? userId
  if (!ownerId) throw new Error('로그인이 필요합니다.')

  if (!liked) {
    const { error } = await supabase.from('likes').delete().eq('user_id', ownerId).eq('target_type', targetType).eq('target_id', targetId)
    if (error) throw error
    return
  }

  const row = { user_id: ownerId, target_type: targetType, target_id: targetId }
  const { error: upsertError } = await supabase.from('likes').upsert(row, { onConflict: 'user_id,target_type,target_id' })
  if (!upsertError) return

  // Older deployments may not expose the composite conflict constraint to PostgREST.
  // A plain insert still uses the database uniqueness rule when it exists.
  const { error: insertError } = await supabase.from('likes').insert(row)
  if (insertError) throw insertError
}
