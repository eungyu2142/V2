import { ensureSupabaseSession, supabase } from './supabase'

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
  if (!userId) throw new Error('로그인이 필요합니다.')
  await ensureSupabaseSession()

  let result = await supabase.rpc('set_app_like', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_liked: liked,
  })
  if (result.error?.code === '42501' || result.error?.message?.toLowerCase().includes('jwt')) {
    await supabase.auth.refreshSession()
    result = await supabase.rpc('set_app_like', {
      p_target_type: targetType,
      p_target_id: targetId,
      p_liked: liked,
    })
  }
  if (result.error) throw result.error
}
