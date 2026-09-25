import type { CarePlan, DailyTask } from './diaryTypes'

export function carePlanOccursOn(plan: CarePlan, date: string) {
  if (!plan.isActive || date < plan.startDate || (plan.endDate && date > plan.endDate)) return false
  if (plan.recurrenceType === 'interval') {
    const elapsed = Math.round((Date.parse(date) - Date.parse(plan.startDate)) / 86400000)
    return elapsed >= 0 && elapsed % Math.max(1, plan.recurrenceIntervalDays ?? 1) === 0
  }
  return plan.repeatDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())
}

const seoulDateKey = (value: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(value))

// Display saved schedules while daily task materialization is pending. These
// entries are not persisted or passed to the task-completion API.
export function petRoutineSummary(petId: string, date: string, tasks: DailyTask[], plans: CarePlan[]) {
  const relevantTasks = tasks.filter((task) => task.petId === petId && (
    task.scheduledDate === date
    || (task.scheduledDate < date && task.status === 'completed' && task.completedAt && seoulDateKey(task.completedAt) === date)
  ))
  const taskByRoutine = new Map<string, DailyTask>()
  relevantTasks.forEach((task) => {
    if (task.status === 'skipped' && task.skipReason !== 'overdue_consolidated') return
    const key = task.carePlanId ?? task.medicationPlanId ?? task.id
    const current = taskByRoutine.get(key)
    if (!current || task.status === 'completed' || (task.skipReason === 'overdue_consolidated' && current.status !== 'completed')) {
      taskByRoutine.set(key, task)
    }
  })
  const summaryTasks = [...taskByRoutine.values()]
  const planMap = new Map(plans.map((plan) => [plan.id, plan]))
  const materialized = new Set(summaryTasks.map((task) => task.carePlanId).filter(Boolean))
  return [
    ...summaryTasks.map((task) => ({
      id: task.id,
      taskType: task.taskType,
      status: task.status === 'skipped' && task.skipReason === 'overdue_consolidated' ? 'completed' as const : task.status,
      title: task.carePlanId ? planMap.get(task.carePlanId)?.title : undefined,
    })),
    ...plans.filter((plan) => plan.petId === petId && !materialized.has(plan.id) && carePlanOccursOn(plan, date))
      .map((plan) => ({ id: `schedule:${plan.id}`, taskType: plan.taskType, status: 'pending' as const, title: plan.title })),
  ]
}
