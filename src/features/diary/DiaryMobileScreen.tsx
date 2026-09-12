import { useState, type ReactNode } from 'react'
import GuideAction from '../../components/common/GuideAction'
import DiaryGlyph, { type DiaryGlyphName } from './DiaryGlyph'
import { ReferenceIcon } from '../../components/common/ReferenceIcon'
import Mascot from '../../components/common/Mascot'
import { FlowHeader } from '../../components/ui/FlowHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'

export type MobileDiaryDay = { key: string; weekday: string; day: number; selected: boolean; today: boolean; indicators: Array<'record' | 'egg' | 'shed'> }
export type MobileDiaryRoutine = { id: string; label: string; time?: string; icon?: DiaryGlyphName; completed: boolean; disabled: boolean; requiresInput?: boolean; overdue?: boolean }
export type MobileDiaryQuickAction = { id: string; label: string; icon: DiaryGlyphName; disabled?: boolean; onClick: () => void }
export type MobileDiaryRecord = { id: string; date: string; time: string; type: string; summary?: string; photo?: string }
export type MobileDiaryAlert = { severity: 'critical' | 'warning' | 'caution' | 'info' | 'complete'; badge: string; title: string; body: string; actions: Array<{ label: string; onClick: () => void }> }
export type MobileDiaryPrediction = { type: 'egg' | 'shed'; label: string; startDate: string; endDate: string }

type Props = {
  petName: string
  petPhoto?: string
  canChangePet: boolean
  canWrite: boolean
  alert?: MobileDiaryAlert
  routines: MobileDiaryRoutine[]
  quickActions: MobileDiaryQuickAction[]
  selectedDateLabel: string
  calendar: ReactNode
  calendarOpen: boolean
  onCalendarChange: (open: boolean) => void
  onChangePet: () => void
  onToggleRoutine: (id: string) => void
  onOpenCompletedRoutine: (id: string) => void
  onAddRoutine: () => void
  onManageRoutines: () => void
  recordMenuOpen: boolean
  onRecordMenuChange: (open: boolean) => void
}

const recordActionOrder = ['shed', 'poop', 'mating', 'egg', 'hospital']
const recordActionLabel: Record<string, string> = { shed: '탈피', poop: '배변', mating: '메이팅', egg: '산란', hospital: '진료' }

export default function DiaryMobileScreen({ petName, petPhoto, canChangePet, canWrite, alert, routines, quickActions, selectedDateLabel, calendar, calendarOpen, onCalendarChange, onChangePet, onToggleRoutine, onOpenCompletedRoutine, onAddRoutine, onManageRoutines, recordMenuOpen, onRecordMenuChange }: Props) {
  const [selectedRoutine, setSelectedRoutine] = useState<MobileDiaryRoutine | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  const [warningDetails, setWarningDetails] = useState(false)
  const [dismissedWarning, setDismissedWarning] = useState('')
  const completedCount = routines.filter((routine) => routine.completed && !routine.overdue).length
  const todayRoutines = routines.filter((routine) => !routine.overdue)
  const pendingRoutines = routines.filter((routine) => !routine.completed)
  const recordActions = recordActionOrder.map((id) => quickActions.find((action) => action.id === id)).filter((action): action is MobileDiaryQuickAction => Boolean(action))
  const openRoutine = (routine: MobileDiaryRoutine) => {
    if (routine.completed) { onOpenCompletedRoutine(routine.id); return }
    if (routine.disabled) return
    if (routine.requiresInput) onToggleRoutine(routine.id)
    else setSelectedRoutine(routine)
  }

  if (selectedRoutine) return <main className="mobile-diary diary-routine-check">
    <DiarySubHeader title={selectedRoutine.label} onBack={() => setSelectedRoutine(null)} />
    <section className="diary-check-content"><Mascot className="diary-check-mascot" /><h2>{selectedRoutine.label}</h2><p>{selectedRoutine.time || '오늘'} {selectedRoutine.overdue ? '확인이 필요한 루틴이에요.' : '예정된 루틴이에요.'}</p><button className="diary-primary" type="button" onClick={() => { onToggleRoutine(selectedRoutine.id); setSelectedRoutine(null) }}>완료</button></section>
  </main>

  if (recordMenuOpen) return <main className="mobile-diary diary-record-menu"><DiarySubHeader title="기록하기" onBack={() => onRecordMenuChange(false)} /><section className="diary-record-kind-list" aria-label="기록 종류">{recordActions.map((action) => <button type="button" disabled={action.disabled} onClick={() => { onRecordMenuChange(false); action.onClick() }} key={action.id}><DiaryGlyph name={action.icon} /><strong>{recordActionLabel[action.id]}</strong><GuideAction symbol="›" /></button>)}</section></main>

  if (warningOpen && alert) return <main className="mobile-diary diary-warning-page"><DiarySubHeader title="루틴 확인" onBack={() => { setWarningOpen(false); setWarningDetails(false) }} /><section className="diary-warning-content"><div className="diary-warning-icon" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="29" cy="32" r="21" /><path d="M24 5h10M29 5v6M29 19v14l7 7M45 11l5 5M43 52l8-14 8 14Z" /><path d="M51 43v4M51 49v1" /></svg></div><h2>{alert.title}</h2><p>{alert.body}</p>{warningDetails ? <div className="diary-warning-actions">{alert.actions.map((action) => <button type="button" className="diary-primary" key={action.label} onClick={() => { action.onClick(); setWarningOpen(false); setWarningDetails(false) }}>{action.label}</button>)}</div> : <button className="diary-primary" type="button" onClick={() => { if (alert.actions.length === 1) { alert.actions[0].onClick(); setWarningOpen(false) } else if (alert.actions.length > 1) setWarningDetails(true); else setWarningOpen(false) }}>확인하기</button>}<button className="diary-secondary" type="button" onClick={() => { setDismissedWarning(alert.title); setWarningOpen(false); setWarningDetails(false) }}>나중에</button><Mascot mood="thinking" className="diary-warning-mascot" /></section></main>

  if (calendarOpen) return <main className="mobile-diary diary-calendar-page"><DiarySubHeader title="캘린더" onBack={() => onCalendarChange(false)} /><div className="diary-calendar-full">{calendar}</div></main>

  return <main className="mobile-diary diary-home">
    <header className="diary-home-header"><h1>다이어리</h1><div>{canChangePet && <button className="diary-home-pet" type="button" aria-label={`${petName}, 펫 선택`} onClick={onChangePet}>{petPhoto ? <img src={petPhoto} alt="" /> : <Mascot />}</button>}<button className="diary-calendar-trigger" type="button" aria-label="캘린더 열기" onClick={() => onCalendarChange(true)}><DiaryGlyph name="calendar" /></button>{canWrite && <button className="diary-round-add" type="button" aria-label="루틴 추가하기" onClick={onAddRoutine}><GuideAction symbol="+" /></button>}</div></header>
    <button className="diary-date-button" type="button" aria-label={`${selectedDateLabel}, 캘린더 열기`} onClick={() => onCalendarChange(true)}>{selectedDateLabel}</button>
    <section className="diary-today-routines"><div className="flex items-center justify-between"><h2>오늘의 루틴 <span>{completedCount}/{todayRoutines.length}</span></h2>{canWrite && <button type="button" aria-label="루틴 관리" className="flex size-11 items-center justify-center" onClick={onManageRoutines}><ReferenceIcon name="settings" className="size-6" /></button>}</div><ProgressBar done={completedCount} total={todayRoutines.length} label="오늘의 루틴 완료" className="mb-4" />{completedCount > 0 && <h3>오늘 할 일</h3>}<ul className={`diary-routine-list ${completedCount ? 'diary-routine-list--remaining' : ''}`}>{(completedCount ? pendingRoutines : routines).map((routine) => <li key={routine.id}><button type="button" disabled={routine.disabled} onClick={() => openRoutine(routine)}><span className="diary-routine-icon">{routine.icon && <DiaryGlyph name={routine.icon} />}</span><strong>{routine.label}</strong><time>{routine.time || '시간 미지정'}</time><span className={`diary-routine-checkmark ${routine.completed ? 'complete' : ''}`} aria-label={routine.completed ? '완료' : '미완료'}>{routine.completed && <DiaryGlyph name="check" />}</span></button></li>)}</ul>{routines.length === 0 && <div className="diary-empty"><p>오늘 예정된 루틴이 없어요.</p>{canWrite && <button type="button" className="diary-secondary" onClick={onAddRoutine}>루틴 추가</button>}</div>}{routines.length > 0 && pendingRoutines.length === 0 && <p className="diary-empty">오늘의 루틴을 모두 완료했어요.</p>}</section>
    {canWrite && <button className="diary-record-add-button" type="button" onClick={() => onRecordMenuChange(true)}>기록하기</button>}
    {alert && dismissedWarning !== alert.title && <button className={`diary-notice-entry ${alert.severity}`} type="button" onClick={() => setWarningOpen(true)}><span><small>NOTICE</small><strong>{alert.title}</strong></span><GuideAction symbol="›" /></button>}
  </main>
}

export const DiarySubHeader = FlowHeader
