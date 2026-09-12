import type { CarePlan, DailyTask } from './diaryTypes.ts'

export function carePlanOccursOn(plan: CarePlan, date: string) {
  if (!plan.isActive || date < plan.startDate || (plan.endDate && date > plan.endDate)) return false
  if (plan.recurrenceType === 'interval') {
    const elapsed = Math.round((Date.parse(date) - Date.parse(plan.startDate)) / 86400000)
    return elapsed >= 0 && elapsed % Math.max(1, plan.recurrenceIntervalDays ?? 1) === 0
  }
  return plan.repeatDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
}

// Display saved schedules while daily task materialization is pending. These
// entries are not persisted or passed to the task-completion API.
export function petRoutineSummary(petId: string, date: string, tasks: DailyTask[], plans: CarePlan[]) {
  const todayTasks = tasks.filter((task) => task.petId === petId && task.scheduledDate === date)
  const planMap = new Map(plans.map((plan) => [plan.id, plan]))
  const materialized = new Set(todayTasks.map((task) => task.carePlanId))
  return [
    ...todayTasks.map((task) => ({ id: task.id, taskType: task.taskType, status: task.status, title: task.carePlanId ? planMap.get(task.carePlanId)?.title : undefined })),
    ...plans.filter((plan) => plan.petId === petId && !materialized.has(plan.id) && carePlanOccursOn(plan, date))
      .map((plan) => ({ id: `schedule:${plan.id}`, taskType: plan.taskType, status: 'pending' as const, title: plan.title })),
  ]
}
