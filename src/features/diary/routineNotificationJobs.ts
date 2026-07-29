import { supabase } from '../../lib/supabase'

export type RoutineNotificationJobStatus =
  | 'pending'
  | 'processing'
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`)
  }
}

function assertTimeKey(timeKey: string) {
  if (!/^\d{2}:\d{2}$/.test(timeKey)) {
    throw new Error(`Invalid time key: ${timeKey}`)
  }
}

function addDays(dateKey: string, days: number) {
  assertDateKey(dateKey)
  const [year, month, date] = dateKey.split('-').map(Number)
  const utc = Date.UTC(year, month - 1, date + days)
  return new Date(utc).toISOString().slice(0, 10)
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

export async function upsertRoutineNotificationJob(input: RoutineNotificationJobInput) {
  const scheduledAt = toSeoulZonedIso(input.routineDate, input.notificationTime)
  const now = new Date().toISOString()
  const { error } = await supabase.from('routine_notification_jobs').upsert({
    user_id: String(input.userId),
    pet_id: String(input.petId),
    routine_id: String(input.routineId),
    routine_date: input.routineDate,
    scheduled_at: scheduledAt,
    next_notification_at: scheduledAt,
    notification_stage: 1,
    status: 'pending' satisfies RoutineNotificationJobStatus,
    updated_at: now,
  }, { onConflict: 'routine_id,routine_date' })
  if (error) throw error
}

export async function markRoutineNotificationJobCompleted(userId: string, routineId: string, routineDate: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({
      status: 'completed' satisfies RoutineNotificationJobStatus,
      completed_at: now,
      updated_at: now,
    })
    .eq('user_id', String(userId))
    .eq('routine_id', String(routineId))
    .eq('routine_date', routineDate)
  if (error) throw error
}

export async function markRoutineNotificationJobSkipped(userId: string, routineId: string, routineDate: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({
      status: 'skipped' satisfies RoutineNotificationJobStatus,
      updated_at: now,
    })
    .eq('user_id', String(userId))
    .eq('routine_id', String(routineId))
    .eq('routine_date', routineDate)
  if (error) throw error
}

export async function cancelRoutineNotificationJobs(userId: string, routineId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({
      status: 'cancelled' satisfies RoutineNotificationJobStatus,
      updated_at: now,
    })
    .eq('user_id', String(userId))
    .eq('routine_id', String(routineId))
    .in('status', ['pending', 'processing'] satisfies RoutineNotificationJobStatus[])
  if (error) throw error
}
