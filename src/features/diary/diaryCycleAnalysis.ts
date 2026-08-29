export type CycleAnalysis = {
  averageCycleDays: number
  lastDate: string
  expectedDate: string
  daysOverdue: number
}

const dateAtMidnight = (date: string) => new Date(`${date}T00:00:00`)

export function daysBetweenDates(from: string, to: string) {
  return Math.round((dateAtMidnight(to).getTime() - dateAtMidnight(from).getTime()) / 86_400_000)
}

export function analyzeRecordedCycle(dates: string[], today: string): CycleAnalysis | null {
  const uniqueDates = Array.from(new Set(dates)).sort()
  if (uniqueDates.length < 2) return null
  const intervals = uniqueDates.slice(1).map((date, index) => Math.max(1, daysBetweenDates(uniqueDates[index], date)))
  const averageCycleDays = Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length)
  const lastDate = uniqueDates.at(-1) as string
  const expected = dateAtMidnight(lastDate)
  expected.setDate(expected.getDate() + averageCycleDays)
  const expectedDate = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`
  return {
    averageCycleDays,
    lastDate,
    expectedDate,
    daysOverdue: Math.max(0, daysBetweenDates(expectedDate, today)),
  }
}
