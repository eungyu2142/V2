import type { ReactNode } from 'react'

export type MobileDiaryDay = {
  key: string
  weekday: string
  day: number
  selected: boolean
  today: boolean
  indicators: Array<'record' | 'egg' | 'shed'>
}

export type MobileDiaryRoutine = {
  id: string
  label: string
  icon?: string
  completed: boolean
  disabled: boolean
}

export type MobileDiaryQuickAction = {
  id: string
  label: string
  icon: string
  disabled?: boolean
  onClick: () => void
}

export type MobileDiaryRecord = {
  id: string
  date: string
  time: string
  type: string
  summary?: string
  photo?: string
}

export type MobileDiaryAlert = {
  severity: 'critical' | 'warning' | 'caution' | 'info' | 'complete'
  badge: string
  title: string
  body: string
  actions: Array<{ label: string; onClick: () => void }>
}

export type MobileDiaryPrediction = {
  type: 'egg' | 'shed'
  label: string
  startDate: string
  endDate: string
}

type Props = {
  petName: string
  petPhoto?: string
  canChangePet: boolean
  calendarOpen: boolean
  days: MobileDiaryDay[]
  alert?: MobileDiaryAlert
  routines: MobileDiaryRoutine[]
  quickActions: MobileDiaryQuickAction[]
  agenda: MobileDiaryRecord[]
  selectedDateLabel: string
  predictions: MobileDiaryPrediction[]
  calendar: ReactNode
  onChangePet: () => void
  onToggleCalendar: () => void
  onSelectDate: (date: string) => void
  onToggleRoutine: (id: string) => void
}

const shortDate = (value: string) => {
  const [, month, day] = value.split('-')
  return `${Number(month)}.${day}`
}

export default function DiaryMobileScreen({
  petName,
  petPhoto,
  canChangePet,
  calendarOpen,
  days,
  alert,
  routines,
  quickActions,
  agenda,
  selectedDateLabel,
  predictions,
  calendar,
  onChangePet,
  onToggleCalendar,
  onSelectDate,
  onToggleRoutine,
}: Props) {
  const completedCount = routines.filter((routine) => routine.completed).length

  return (
    <main className="mobile-diary">
      <header className="mobile-diary-header">
        <h1>다이어리</h1>
        <button className="mobile-diary-pet" type="button" disabled={!canChangePet} onClick={onChangePet}>
          {petPhoto ? <img src={petPhoto} alt="" /> : <span aria-hidden="true">●</span>}
          <strong>{petName}</strong>
          {canChangePet && <i aria-hidden="true">⌄</i>}
        </button>
        <button className={`mobile-diary-calendar-button ${calendarOpen ? 'active' : ''}`} type="button" aria-expanded={calendarOpen} aria-label={calendarOpen ? '월간 캘린더 닫기' : '월간 캘린더 열기'} onClick={onToggleCalendar}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" /></svg>
        </button>
      </header>

      <nav className="mobile-diary-week" aria-label="주간 날짜">
        {days.map((day) => <button type="button" className={`${day.today ? 'today' : ''} ${day.selected ? 'selected' : ''}`} aria-pressed={day.selected} onClick={() => onSelectDate(day.key)} key={day.key}>
          <span>{day.weekday}</span><strong>{day.day}</strong>
          <small aria-hidden="true">{day.indicators.map((indicator) => <i className={indicator} key={indicator} />)}</small>
        </button>)}
      </nav>

      {calendarOpen && <section className="mobile-diary-calendar">{calendar}{predictions.length > 0 && <div className="mobile-diary-predictions">{predictions.map((prediction) => <article className={prediction.type} key={prediction.type}><span>{prediction.label}</span><strong>{shortDate(prediction.startDate)} ~ {shortDate(prediction.endDate)}</strong></article>)}</div>}<div className="mobile-diary-agenda"><h2>{selectedDateLabel} 일정</h2>{agenda.length > 0 ? <ul>{agenda.map((record) => <li key={record.id}><time>{record.time}</time><span><strong>{record.type}</strong>{record.summary && <small>{record.summary}</small>}</span></li>)}</ul> : <p>등록된 일정이나 기록이 없어요.</p>}</div></section>}

      {alert && <article className={`mobile-diary-alert ${alert.severity}`}>
        <span>{alert.badge}</span><h2>{alert.title}</h2><p>{alert.body}</p>
        {alert.actions.length > 0 && <div>{alert.actions.slice(0, 2).map((action) => <button type="button" onClick={action.onClick} key={action.label}>{action.label}</button>)}</div>}
      </article>}

      <section className="mobile-diary-section mobile-diary-routines">
        <header><h2>오늘 할 관리</h2><span>{completedCount}/{routines.length} 완료</span></header>
        {routines.length > 0 ? <ul>{routines.map((routine) => <li key={routine.id}><img src={routine.icon} alt="" /><strong>{routine.label}</strong><button type="button" className={routine.completed ? 'checked' : ''} disabled={routine.disabled || routine.completed} aria-label={`${routine.label} ${routine.completed ? '완료됨' : '완료하기'}`} onClick={() => onToggleRoutine(routine.id)}>{routine.completed ? '✓' : ''}</button></li>)}</ul> : <p className="mobile-diary-empty">오늘 예정된 관리가 없어요.</p>}
      </section>

      <section className="mobile-diary-section mobile-diary-quick">
        <header><h2>상황별 기록 추가</h2></header>
        <div>{quickActions.map((action) => <button type="button" disabled={action.disabled} onClick={action.onClick} key={action.id}><img src={action.icon} alt="" /><span>{action.label}</span></button>)}</div>
      </section>

    </main>
  )
}
