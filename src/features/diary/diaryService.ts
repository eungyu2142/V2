import { supabase } from '../../lib/supabase'
import type { CarePlan, DailyTask, PetRecord } from './diaryTypes'

type CarePlanRow = {
  id: string
  user_id: string
  pet_id: string
  task_type: CarePlan['taskType']
  title: string
  repeat_days: number[]
  start_date: string
  end_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type DailyTaskRow = {
  id: string
  user_id: string
  care_plan_id: string | null
  medication_plan_id: string | null
  pet_id: string
  task_type: string
  scheduled_date: string
  occurrence_no: number
  status: DailyTask['status']
  completed_at: string | null
  skip_reason: string | null
  created_at: string
  updated_at: string
}

const toCarePlan = (row: CarePlanRow): CarePlan => ({
  id: row.id,
  userId: row.user_id,
  petId: row.pet_id,
  taskType: row.task_type,
  title: row.title,
  repeatDays: row.repeat_days ?? [],
  startDate: row.start_date,
  endDate: row.end_date ?? undefined,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const toDailyTask = (row: DailyTaskRow): DailyTask => ({
  id: row.id,
  userId: row.user_id,
  carePlanId: row.care_plan_id ?? undefined,
  medicationPlanId: row.medication_plan_id ?? undefined,
  petId: row.pet_id,
  taskType: row.task_type,
  scheduledDate: row.scheduled_date,
  occurrenceNo: row.occurrence_no,
  status: row.status,
  completedAt: row.completed_at ?? undefined,
  skipReason: row.skip_reason ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function listCarePlans(userId: string, petId?: string) {
  let query = supabase.from('care_plans').select('*').eq('user_id', userId).order('created_at', { ascending: true })
  if (petId) query = query.eq('pet_id', petId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as CarePlanRow[]).map(toCarePlan)
}

export async function listDailyTasks(userId: string, from: string, to: string, petId?: string) {
  const { error: materializeError } = await supabase.rpc('materialize_daily_tasks', {
    p_pet_id: petId ?? null,
    p_from_date: from,
    p_to_date: to,
  })
  if (materializeError) throw materializeError

  let query = supabase.from('daily_tasks').select('*').eq('user_id', userId).gte('scheduled_date', from).lte('scheduled_date', to).order('scheduled_date', { ascending: true })
  if (petId) query = query.eq('pet_id', petId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as DailyTaskRow[]).map(toDailyTask)
}

export async function saveCarePlan(userId: string, plan: CarePlan) {
  const { error } = await supabase.from('care_plans').upsert({
    id: plan.id,
    user_id: userId,
    pet_id: plan.petId,
    task_type: plan.taskType,
    title: plan.title,
    repeat_days: plan.repeatDays,
    start_date: plan.startDate,
    end_date: plan.endDate ?? null,
    is_active: plan.isActive,
  })
  if (error) throw error
}

export async function deleteCarePlan(id: string) {
  const { error } = await supabase.from('care_plans').delete().eq('id', id)
  if (error) throw error
}

export async function completeDailyTask(taskId: string) {
  const { data, error } = await supabase.rpc('complete_daily_task', { p_task_id: taskId })
  if (error) throw error
  return data as PetRecord
}

export async function undoDailyTask(taskId: string) {
  const { error } = await supabase.rpc('undo_daily_task', { p_task_id: taskId })
  if (error) throw error
}

export async function skipDailyTask(taskId: string, reason?: string) {
  const { error } = await supabase.rpc('skip_daily_task', { p_task_id: taskId, p_reason: reason ?? null })
  if (error) throw error
}

export type ReviewDiaryLinkInput = {
  userId: string
  reviewId: string
  petId: string
  hospitalName: string
  visitDate: string
  diagnosis?: string
  treatment?: string
  medicine?: {
    name: string
    dose: string
    startDate: string
    endDate?: string
    dailyCount: number
    instructions?: string
    ocrRaw?: unknown
  }
}

export async function linkReviewToDiary(input: ReviewDiaryLinkInput) {
  const visitId = input.reviewId
  const createdAt = new Date().toISOString()
  const { error: visitError } = await supabase.from('visit_records').upsert({
    id: visitId,
    user_id: input.userId,
    pet_id: input.petId,
    hospital_name: input.hospitalName,
    visit_date: input.visitDate,
    ocr_raw: input.medicine?.ocrRaw ?? null,
    status: 'confirmed',
  })
  if (visitError) throw visitError

  const visitRecord: PetRecord = {
    id: input.reviewId,
    userId: input.userId,
    petId: input.petId,
    type: 'hospital',
    date: input.visitDate,
    memo: [input.hospitalName, input.diagnosis, input.treatment].filter(Boolean).join(' · '),
    hospitalId: input.hospitalName,
    reviewId: input.reviewId,
    status: 'manual',
    createdAt,
  }
  const { error: recordError } = await supabase.from('care_records').upsert({
    id: visitRecord.id,
    user_id: input.userId,
    pet_id: input.petId,
    record_date: input.visitDate,
    record_type: 'hospital',
    memo: visitRecord.memo ?? '',
    payload: visitRecord,
    status: 'manual',
  })
  if (recordError) throw recordError

  const { data: previousPlans, error: previousPlansError } = await supabase.from('medication_plans').select('id').eq('user_id', input.userId).eq('visit_record_id', visitId)
  if (previousPlansError) throw previousPlansError
  const previousPlanIds = (previousPlans ?? []).map((plan) => String(plan.id))
  if (previousPlanIds.length) {
    const { error: oldTasksError } = await supabase.from('daily_tasks').delete().in('medication_plan_id', previousPlanIds).eq('user_id', input.userId)
    if (oldTasksError) throw oldTasksError
    const { error: oldPlansError } = await supabase.from('medication_plans').delete().in('id', previousPlanIds).eq('user_id', input.userId)
    if (oldPlansError) throw oldPlansError
  }
  if (!input.medicine?.name.trim() || !input.medicine.dose.trim()) return
  const planId = crypto.randomUUID()
  const { error: planError } = await supabase.from('medication_plans').insert({
    id: planId,
    user_id: input.userId,
    pet_id: input.petId,
    visit_record_id: visitId,
    name: input.medicine.name.trim(),
    dose: input.medicine.dose.trim(),
    start_date: input.medicine.startDate,
    end_date: input.medicine.endDate || null,
    daily_count: Math.max(1, input.medicine.dailyCount),
    instructions: input.medicine.instructions?.trim() ?? '',
    is_active: true,
  })
  if (planError) throw planError

  const start = new Date(`${input.medicine.startDate}T00:00:00`)
  const end = new Date(`${input.medicine.endDate || input.medicine.startDate}T00:00:00`)
  const tasks: Array<Record<string, unknown>> = []
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const scheduledDate = date.toISOString().slice(0, 10)
    for (let occurrenceNo = 1; occurrenceNo <= Math.max(1, input.medicine.dailyCount); occurrenceNo += 1) {
      tasks.push({ user_id: input.userId, medication_plan_id: planId, pet_id: input.petId, task_type: `medicine|${input.medicine.name.trim()}|${input.medicine.dose.trim()}`, scheduled_date: scheduledDate, occurrence_no: occurrenceNo, status: 'pending' })
    }
  }
  const { error: tasksError } = await supabase.from('daily_tasks').insert(tasks)
  if (tasksError) throw tasksError
}
