import { useMemo, useState, type ReactNode } from 'react'
import GuideAction from '../../components/common/GuideAction'
import DiaryGlyph, { type DiaryGlyphName } from './DiaryGlyph'

export type MobileDiaryDay = { key: string; weekday: string; day: number; selected: boolean; today: boolean; indicators: Array<'record' | 'egg' | 'shed'> }
export type MobileDiaryRoutine = { id: string; label: string; time?: string; icon?: DiaryGlyphName; completed: boolean; disabled: boolean }
export type MobileDiaryQuickAction = { id: string; label: string; icon: DiaryGlyphName; disabled?: boolean; onClick: () => void }
export type MobileDiaryRecord = { id: string; date: string; time: string; type: string; summary?: string; photo?: string }
export type MobileDiaryAlert = { severity: 'critical' | 'warning' | 'caution' | 'info' | 'complete'; badge: string; title: string; body: string; actions: Array<{ label: string; onClick: () => void }> }
export type MobileDiaryPrediction = { type: 'egg' | 'shed'; label: string; startDate: string; endDate: string }

type Props = { petName: string; canChangePet: boolean; alert?: MobileDiaryAlert; routines: MobileDiaryRoutine[]; quickActions: MobileDiaryQuickAction[]; agenda: MobileDiaryRecord[]; selectedDateLabel: string; predictions: MobileDiaryPrediction[]; calendar: ReactNode; onChangePet: () => void; onToggleRoutine: (id: string) => void; onUndoRoutine: (id: string) => void; onAddRoutine: () => void; onOpenRecords: () => void; recordMenuOpen: boolean; onRecordMenuChange: (open: boolean) => void }

const recordActionOrder = ['shed', 'poop', 'mating', 'egg', 'hospital']
const recordActionCopy: Record<string, string> = { shed: '탈피 과정을 기록해요.', poop: '배변 상태를 기록해요.', mating: '메이팅 기록을 남겨요.', egg: '산란 기록을 남겨요.', hospital: '병원 방문과 진료 내용을 기록해요.' }
const recordActionLabel: Record<string, string> = { shed: '탈피 기록', poop: '배변 기록', mating: '메이팅 기록', egg: '산란 기록', hospital: '진료 기록' }

export default function DiaryMobileScreen({ petName, canChangePet, alert, routines, quickActions, agenda, selectedDateLabel, predictions, calendar, onChangePet, onToggleRoutine, onUndoRoutine, onAddRoutine, onOpenRecords, recordMenuOpen, onRecordMenuChange }: Props) {
  const [selectedRoutine, setSelectedRoutine] = useState<MobileDiaryRoutine | null>(null)
  const [completedRoutine, setCompletedRoutine] = useState<MobileDiaryRoutine | null>(null)
  const [showAllComplete, setShowAllComplete] = useState(false)
  const completedCount = routines.filter((routine) => routine.completed).length
  const recordActions = useMemo(() => recordActionOrder.map((id) => quickActions.find((action) => action.id === id)).filter((action): action is MobileDiaryQuickAction => Boolean(action)), [quickActions])

  const completeRoutine = () => {
    if (!selectedRoutine || selectedRoutine.completed || selectedRoutine.disabled) return
    onToggleRoutine(selectedRoutine.id)
    const isLastRoutine = routines.length > 0 && completedCount + 1 >= routines.length
    setCompletedRoutine(selectedRoutine)
    setSelectedRoutine(null)
    setShowAllComplete(isLastRoutine)
  }

  if (showAllComplete) return <main className="mobile-diary mobile-diary-all-complete"><div className="mobile-diary-confetti" aria-hidden="true">◆ · ◆ ·</div><h1>오늘의 루틴을<br />모두 완료했어요!</h1><div className="mobile-diary-mascot" aria-hidden="true"><DiaryGlyph name="check" /></div><p>꾸준한 관리가<br />건강한 아이를 만들어요.</p><button type="button" onClick={() => setShowAllComplete(false)}>확인</button></main>

  if (completedRoutine) return <main className="mobile-diary mobile-diary-routine-result"><SubHeader title="루틴" onBack={() => setCompletedRoutine(null)} /><RoutineSummary routine={completedRoutine} /><div className="mobile-diary-result-check"><DiaryGlyph name="check" /></div><h2>오늘의 루틴을<br />완료했어요!</h2><p>{completedRoutine.time ? `${completedRoutine.time}에 완료했어요.` : '오늘 완료했어요.'}<br />내일도 잊지 말고 챙겨주세요!</p><div className="mobile-diary-result-actions"><button type="button" onClick={() => { onUndoRoutine(completedRoutine.id); setCompletedRoutine(null) }}>완료 취소하기</button><button type="button" onClick={() => setCompletedRoutine(null)}>닫기</button></div></main>

  if (selectedRoutine) return <main className="mobile-diary mobile-diary-routine-check"><SubHeader title="루틴" onBack={() => setSelectedRoutine(null)} /><RoutineSummary routine={selectedRoutine} /><div className="mobile-diary-result-check"><DiaryGlyph name="check" /></div><h2>{selectedRoutine.completed ? <>오늘의 루틴을<br />완료했어요!</> : '루틴을 완료할까요?'}</h2><p>{selectedRoutine.time ? `${selectedRoutine.time} 예정이에요.` : '오늘 예정된 루틴이에요.'}<br />잊지 말고 챙겨주세요!</p><div className="mobile-diary-result-actions"><button type="button" className="primary" disabled={selectedRoutine.completed || selectedRoutine.disabled} onClick={completeRoutine}>{selectedRoutine.completed ? '완료됨' : '완료하기'}</button><button type="button" onClick={() => setSelectedRoutine(null)}>닫기</button></div></main>

  if (recordMenuOpen) return <main className="mobile-diary mobile-diary-record-menu-page"><SubHeader title="기록 추가하기" onBack={() => onRecordMenuChange(false)} /><section className="mobile-diary-record-list" aria-label="기록 종류">{recordActions.map((action) => <button type="button" disabled={action.disabled} onClick={action.onClick} key={action.id}><span><DiaryGlyph name={action.icon} /></span><span><strong>{recordActionLabel[action.id]}</strong><small>{recordActionCopy[action.id]}</small></span><GuideAction symbol="›" /></button>)}</section></main>

  return <main className="mobile-diary mobile-diary-home">
    <header className="mobile-diary-header"><div><h1>다이어리</h1><p>{petName}의 하루를 기록해요</p></div><button type="button" aria-label="펫 선택" disabled={!canChangePet} onClick={onChangePet}><DiaryGlyph name="poop" /></button></header>
    <section className="mobile-diary-calendar" aria-label="월간 기록 캘린더">{calendar}{predictions.length > 0 && <div className="mobile-diary-predictions">{predictions.map((item) => <article className={item.type} key={`${item.type}-${item.startDate}`}><strong>{item.label}</strong><span>{item.startDate.slice(5).replace('-', '.')} - {item.endDate.slice(5).replace('-', '.')}</span></article>)}</div>}</section>
    {alert && <article className={`mobile-diary-alert ${alert.severity}`}><span>{alert.badge}</span><h2>{alert.title}</h2><p>{alert.body}</p>{alert.actions.length > 0 && <div>{alert.actions.slice(0, 2).map((action) => <button type="button" onClick={action.onClick} key={action.label}>{action.label}</button>)}</div>}</article>}
    <section className="mobile-diary-section mobile-diary-routines"><header><h2>오늘의 루틴 <small>{completedCount}/{routines.length}</small></h2><button type="button" onClick={onAddRoutine}>루틴 관리 <GuideAction symbol="›" /></button></header><div className="mobile-diary-routine-progress"><i style={{ width: `${routines.length ? completedCount / routines.length * 100 : 0}%` }} /></div>{routines.length > 0 ? <ul>{routines.slice(0, 4).map((routine) => <li key={routine.id}><button type="button" disabled={routine.disabled} onClick={() => setSelectedRoutine(routine)}><span className="mobile-diary-routine-icon">{routine.icon ? <DiaryGlyph name={routine.icon} /> : null}</span><span><strong>{routine.label}</strong><small>{routine.time ?? '시간 미지정'}</small></span><em className={routine.completed ? 'complete' : 'pending'}>{routine.completed ? '완료' : '미완료'}</em></button></li>)}</ul> : <div className="mobile-diary-empty"><strong>오늘 예정된 루틴이 없어요.</strong><button type="button" onClick={onAddRoutine}>루틴 추가하기</button></div>}</section>
    <section className="mobile-diary-section mobile-diary-quick"><header><div><h2>상황별 기록</h2><p>필요할 때 바로 기록해보세요.</p></div></header><div>{recordActions.map((action) => <button type="button" disabled={action.disabled} onClick={action.onClick} key={action.id}><span className="mobile-diary-action-icon"><DiaryGlyph name={action.icon}/></span><span><strong>{action.label}</strong><small>{recordActionCopy[action.id]}</small></span></button>)}</div></section>
    <section className="mobile-diary-collection"><div><h2>기록 모아보기</h2><p>{agenda.length ? `${selectedDateLabel} 기록 ${agenda.length}개가 있어요.` : '기록의 변화를 한눈에 확인해요.'}</p></div><button type="button" onClick={onOpenRecords}>그래프 보기</button></section>
  </main>
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) { return <header className="mobile-diary-subheader"><button type="button" aria-label="뒤로가기" onClick={onBack}><GuideAction symbol="‹" /></button><div><h1>{title}</h1></div><span /></header> }
function RoutineSummary({ routine }: { routine: MobileDiaryRoutine }) { return <section className="mobile-diary-routine-summary"><span>{routine.icon ? <DiaryGlyph name={routine.icon} /> : null}</span><div><strong>{routine.label}</strong><small>{routine.time ?? '시간 미지정'}</small></div></section> }
