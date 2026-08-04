import { supabase } from '../../lib/supabase'

export type RoutineNotificationJobStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'completed'
  | 'skipped'
  | 'cancelled'

type RoutineNotificationJobInput = {
  userId: string
  petId: string
  routineId: string
  routineDate: string
  notificationTime: string
}

const seoulOffsetHours = 9

function assertDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date key: ${dateKey}`)
}

function assertTimeKey(timeKey: string) {
  if (!/^\d{2}:\d{2}$/.test(timeKey)) throw new Error(`Invalid time key: ${timeKey}`)
}

function addDays(dateKey: string, days: number) {
  assertDateKey(dateKey)
  const [year, month, date] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

function dayOfWeek(dateKey: string) {
  assertDateKey(dateKey)
  const [year, month, date] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay()
}

export function toSeoulZonedIso(dateKey: string, timeKey: string) {
  assertDateKey(dateKey)
  assertTimeKey(timeKey)
  const [year, month, date] = dateKey.split('-').map(Number)
  const [hour, minute] = timeKey.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, date, hour - seoulOffsetHours, minute, 0, 0)).toISOString()
}

export function getFirstRoutineDate(startDate: string, repeatDays: number[]) {
  assertDateKey(startDate)
  if (!repeatDays.length) return startDate
  const normalizedDays = new Set(repeatDays)
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = addDays(startDate, offset)
    if (normalizedDays.has(dayOfWeek(candidate))) return candidate
  }
  return startDate
}

export async function materializeRoutineNotificationWindow(routineId: string, fromDate?: string) {
  const { error } = await supabase.rpc('materialize_routine_notification_window', {
    p_routine_id: routineId,
    p_from_date: fromDate ?? null,
    p_days: 14,
  })
  if (error) throw error
}

export async function upsertRoutineNotificationJob(input: RoutineNotificationJobInput) {
  const { error: routineError } = await supabase.rpc('materialize_routine_notification_window', {
    p_routine_id: input.routineId,
    p_from_date: input.routineDate,
    p_days: 14,
  })
  if (!routineError) return

  // Medication occurrences are currently sourced by medication_plans rather
  // than care_plans. Link their existing occurrence without changing that
  // feature's data model.
  const { data: occurrences, error: occurrenceError } = await supabase
    .from('daily_tasks')
    .select('id, scheduled_date')
    .eq('user_id', input.userId)
    .eq('medication_plan_id', input.routineId)
    .gte('scheduled_date', input.routineDate)
    .order('scheduled_date', { ascending: true })
  if (occurrenceError || !occurrences?.length) throw routineError

  const rows = occurrences.map((occurrence) => {
    const scheduledAt = toSeoulZonedIso(occurrence.scheduled_date, input.notificationTime)
    return {
      user_id: String(input.userId),
      pet_id: String(input.petId),
      routine_id: String(input.routineId),
      routine_date: occurrence.scheduled_date,
      occurrence_id: occurrence.id,
      scheduled_at: scheduledAt,
      next_notification_at: scheduledAt,
      notification_stage: 1,
      notification_type: 'initial',
      status: 'pending' satisfies RoutineNotificationJobStatus,
      attempt_count: 0,
      dedupe_key: `routine:${input.routineId}:occurrence:${occurrence.id}:initial`,
      updated_at: new Date().toISOString(),
    }
  })
  const { error } = await supabase
    .from('routine_notification_jobs')
    .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (error) throw error
}

async function cancelOccurrenceJobs(occurrenceId: string) {
  const { error } = await supabase.rpc('cancel_occurrence_notification_jobs', {
    p_occurrence_id: occurrenceId,
  })
  if (error) throw error
}

export async function markRoutineNotificationJobCompleted(
  userId: string,
  routineId: string,
  routineDate: string,
  occurrenceId?: string,
) {
  if (occurrenceId) return cancelOccurrenceJobs(occurrenceId)
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', String(userId))
    .eq('routine_id', String(routineId))
    .eq('routine_date', routineDate)
    .in('status', ['pending', 'processing', 'failed'])
  if (error) throw error
}

export async function markRoutineNotificationJobSkipped(
  userId: string,
  routineId: string,
  routineDate: string,
  occurrenceId?: string,
) {
  return markRoutineNotificationJobCompleted(userId, routineId, routineDate, occurrenceId)
}

export async function cancelRoutineNotificationJobs(userId: string, routineId: string) {
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', String(userId))
    .eq('routine_id', String(routineId))
    .in('status', ['pending', 'processing', 'failed'] satisfies RoutineNotificationJobStatus[])
  if (error) throw error
}
