import { petRoutineSummary } from '../../features/diary/routineSchedule'
import { useState, type CSSProperties } from 'react'
import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { Pet } from '../../types/app'
import Mascot from '../common/Mascot'
import { PetIcon, type PetIconName } from './PetIcons'
import './PetFlow.css'
import { ProgressBar } from '../ui/ProgressBar'
import { FlowHeader } from '../ui/FlowHeader'

export type PetMobileView = 'main' | 'detail' | 'records' | 'growth' | 'routines'
type RecordTab = 'temperature' | 'humidity' | 'weight' | 'shed' | 'poop' | 'mating' | 'egg'
type Props = { pets: Pet[]; selectedPetId: string; view: PetMobileView; tasks: DailyTask[]; plans: CarePlan[]; records: PetRecord[]; onSelectPet: (id: string) => void; onView: (view: PetMobileView) => void; onRegisterPet: () => void; onEditPet: (pet: Pet) => void; onDeletePet: (petId: string) => void | Promise<void>; onOpenDiary: (petId: string, action?: 'routine-create') => void }

const routineLabels: Record<string, string> = { feed: '먹이', mist: '분무', water: '물그릇', weight: '무게', humidity: '습도', temperature: '온도', water_temperature: '수온', cleaning: '청소', partial_cleaning: '청소', full_cleaning: '청소', medicine: '약', hospital: '진료', uvb_check: 'UVB', water_quality: '수질 확인', filter_check: '여과기 확인', custom: '직접 입력' }
const routineIcons: Record<string, PetIconName> = { feed: 'feed', mist: 'mist', water: 'water', weight: 'weight', humidity: 'mist', temperature: 'temperature', water_temperature: 'temperature', cleaning: 'cleaning', partial_cleaning: 'cleaning', full_cleaning: 'cleaning', uvb_check: 'uvb', medicine: 'medicine' }
const recordTabs: Array<[RecordTab, string]> = [['temperature', '온도'], ['humidity', '습도'], ['weight', '무게'], ['shed', '탈피'], ['poop', '배변'], ['mating', '메이팅'], ['egg', '산란']]
const dateLabel = (value?: string) => value ? value.slice(0, 10).replaceAll('-', '.') : '-'
const genderLabel = (gender: Pet['gender']) => gender === 'male' ? '수컷' : gender === 'female' ? '암컷' : '미구분'
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function tasksForPet(petId: string, tasks: DailyTask[], plans: CarePlan[]) {
  return petRoutineSummary(petId, todayKey(), tasks, plans).map((task) => ({ ...task, label: task.title || routineLabels[task.taskType.split('|')[0]] || task.taskType }))
}

function PetPhoto({ pet }: { pet: Pet }) {
  return <span className="pet-flow-photo">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }}/> : <Mascot/>}</span>
}

function PetProgressPhoto({ pet, completed, total }: { pet: Pet; completed: number; total: number }) {
  if (!total) return <span className="pet-flow-card-photo"><PetPhoto pet={pet}/></span>
  const percent = Math.round(completed / total * 100)
  return <span
    className="pet-flow-card-photo pet-flow-card-photo-progress"
    role="progressbar"
    aria-label={`${pet.name} 오늘 루틴 진행률 ${percent}%`}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={percent}
    style={{ '--pet-progress': `${percent}%` } as CSSProperties}
  ><PetPhoto pet={pet}/></span>
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="pet-flow-icon-button" type="button" aria-label="뒤로가기" onClick={onClick}><PetIcon name="back"/></button>
}


function recordSummary(record: PetRecord) {
  if (record.weight !== undefined) return `${record.weight}g`
  if (record.environmentRecord) return `${record.environmentRecord.value}${record.environmentRecord.unit === 'percent' ? '%' : '℃'}`
  if (record.stoolRecord) return record.stoolRecord.statusLabel
  if (record.incidentRecord?.kind === 'mating') return `${record.incidentRecord.femaleName} · ${record.incidentRecord.maleName}`
  if (record.incidentRecord?.kind === 'egg') return record.incidentRecord.fertility === 'fertilized' ? '유정란' : '무정란'
  return record.memo || '기록됨'
}

function PetRecordChart({ records, tab }: { records: PetRecord[]; tab: RecordTab }) {
  const values = records.flatMap((record) => {
    const value = tab === 'weight' ? record.weight : record.environmentRecord?.value
    return value !== undefined && Number.isFinite(value) ? [{ record, value }] : []
  }).reverse()
  const unit = tab === 'weight' ? 'g' : tab === 'humidity' ? '%' : '℃'
  const title = recordTabs.find(([id]) => id === tab)?.[1] ?? ''
  if (!values.length) return <p className="pet-flow-empty">아직 {title} 기록이 없어요.</p>
  const min = Math.min(...values.map(({ value }) => value))
  const max = Math.max(...values.map(({ value }) => value))
  const padding = Math.max((max - min) * 0.2, 1)
  const floor = Math.max(0, min - padding)
  const ceiling = max + padding
  const point = (value: number, index: number) => ({ x: values.length === 1 ? 310 : 64 + index / (values.length - 1) * 496, y: 224 - (value - floor) / (ceiling - floor) * 190 })
  return <figure className="pet-flow-chart"><figcaption>{title} 변화 ({unit})</figcaption><svg viewBox="0 0 600 275" role="img" aria-label={`${title} 변화 그래프. ${values.length}개 기록, 최근 ${values.at(-1)?.value}${unit}`}>
    {[0, 1, 2, 3, 4].map((tick) => { const y = 224 - tick * 47.5; const value = floor + (ceiling - floor) * tick / 4; return <g key={tick}><line className="pet-chart-grid" x1="64" x2="560" y1={y} y2={y}/><text x="48" y={y + 4} textAnchor="end">{Number(value.toFixed(1))}</text></g> })}
    <polyline className="pet-chart-line" points={values.map(({ value }, index) => { const p = point(value, index); return `${p.x},${p.y}` }).join(' ')}/>
    {values.map(({ record, value }, index) => { const p = point(value, index); const showLabel = values.length <= 6 || index === 0 || index === values.length - 1 || index % Math.ceil(values.length / 5) === 0; return <g key={record.id}><circle className="pet-chart-dot" cx={p.x} cy={p.y} r="4"><title>{dateLabel(record.date)}: {value}{unit}</title></circle>{showLabel ? <text x={p.x} y="252" textAnchor="middle">{record.date.slice(5).replace('-', '/')}</text> : null}</g> })}
  </svg></figure>
}

export default function PetMobileFlow({ pets, selectedPetId, view, tasks, plans, records, onSelectPet, onView, onRegisterPet, onEditPet, onDeletePet, onOpenDiary }: Props) {
  const [recordTab, setRecordTab] = useState<RecordTab>('weight')
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const pet = pets.find((item) => item.id === selectedPetId) ?? pets[0]

  if (view === 'main' || !pet) return <main className="pet-flow pet-flow-list">
    <header className="pet-flow-main-actions"><button className="pet-flow-add" type="button" aria-label="펫 추가" onClick={onRegisterPet}><PetIcon name="add"/></button></header>
    {pets.length ? <div className="pet-flow-cards">{pets.map((item) => {
      const todayTasks = tasksForPet(item.id, tasks, plans)
      const completed = todayTasks.filter((task) => task.status === 'completed').length
      const progressPercent = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0
      return <button className="pet-flow-card" type="button" key={item.id} aria-label={`${item.name} 상세 보기`} onClick={() => { onSelectPet(item.id); onView('detail') }}>
        <span className="pet-flow-card-identity"><PetProgressPhoto pet={item} completed={completed} total={todayTasks.length}/><span><strong>{item.name} <PetIcon name={item.gender === 'male' ? 'male' : item.gender === 'female' ? 'female' : 'unknown'} aria-label={genderLabel(item.gender)}/></strong><small>{item.species}</small></span></span>
        {todayTasks.length ? <span className="pet-flow-card-progress"><strong>{progressPercent}%</strong><small>{completed === todayTasks.length ? '오늘 케어 완료' : '오늘 케어'}</small></span> : <span className="pet-flow-card-status"><small>오늘 예정된 루틴이 없어요.</small></span>}
      </button>
    })}</div> : <section className="pet-flow-empty-home"><Mascot/><p>등록된 펫이 없어요.</p></section>}
  </main>

  const petTasks = tasksForPet(pet.id, tasks, plans)
  const completed = petTasks.filter((task) => task.status === 'completed').length
  const remaining = petTasks.filter((task) => task.status === 'pending')
  const petPlans = plans.filter((plan) => plan.petId === pet.id && plan.isActive)
  const petRecords = records.filter((record) => record.petId === pet.id).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  const filteredRecords = petRecords.filter((record) => recordTab === 'temperature' || recordTab === 'humidity' ? record.environmentRecord?.metricType === recordTab : recordTab === 'mating' || recordTab === 'egg' ? record.incidentRecord?.kind === recordTab : record.type === recordTab)
  const backToDetail = () => { setMenuOpen(false); onView('detail') }
  const deletePet = async () => {
    if (!window.confirm(`'${pet.name}'을 삭제하시겠습니까?`)) return
    try { await onDeletePet(pet.id); setMenuOpen(false); onView('main') } catch { setDeleteError('펫을 삭제하지 못했어요. 다시 시도해주세요.') }
  }

  if (view === 'records' || view === 'growth') return <main className="pet-flow pet-flow-records">
    <FlowHeader title="기록 모아보기" onBack={backToDetail}/>
    <nav className="pet-flow-record-tabs" aria-label="기록 종류">{recordTabs.map(([id, label]) => <button type="button" className={recordTab === id ? 'active' : ''} aria-pressed={recordTab === id} key={id} onClick={() => setRecordTab(id)}>{label}</button>)}</nav>
    {recordTab === 'weight' || recordTab === 'temperature' || recordTab === 'humidity' ? <PetRecordChart records={filteredRecords} tab={recordTab}/> : <h2 className="pet-flow-record-heading">{recordTabs.find(([id]) => id === recordTab)?.[1]} 기록</h2>}
    {filteredRecords.length ? <div className="pet-flow-record-list">{filteredRecords.map((record) => <article key={record.id}><span><strong>{dateLabel(record.date)}</strong><small>{recordSummary(record)}</small></span>{record.photoUrl ? <img src={record.photoUrl} alt="기록 사진"/> : null}</article>)}</div> : recordTab !== 'weight' && recordTab !== 'temperature' && recordTab !== 'humidity' ? <p className="pet-flow-empty">아직 기록이 없어요.</p> : null}
  </main>

  if (view === 'routines') return <main className="pet-flow pet-flow-routines">
    <header className="pet-flow-header centered"><BackButton onClick={backToDetail}/><h1>루틴 관리</h1><button className="pet-flow-add" type="button" aria-label="루틴 추가" onClick={() => onOpenDiary(pet.id, 'routine-create')}><PetIcon name="add"/></button></header>
    <div className="pet-flow-routine-list">{petPlans.length ? petPlans.map((plan) => <button type="button" key={plan.id} onClick={() => onOpenDiary(pet.id, 'routine-create')}><PetIcon name={routineIcons[plan.taskType] ?? 'routine'}/><span><strong>{plan.title || routineLabels[plan.taskType] || plan.taskType}</strong><small>{plan.notificationTime}</small></span><PetIcon name="chevron"/></button>) : <p className="pet-flow-empty">등록된 루틴이 없어요.</p>}</div>
  </main>

  return <main className="pet-flow pet-flow-detail">
    <header className="pet-flow-header centered"><BackButton onClick={() => { setMenuOpen(false); onView('main') }}/><h1>{pet.name}</h1><div className="pet-flow-header-actions"><button className="pet-flow-icon-button" type="button" aria-label="펫 정보 수정" onClick={() => onEditPet(pet)}><PetIcon name="edit"/></button><button className="pet-flow-icon-button" type="button" aria-label="펫 더보기" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>⋮</button></div></header>
    {menuOpen ? <section className="pet-flow-more"><dl>{[['생년월일', dateLabel(pet.birthday)], ['입양일', dateLabel(pet.adoptionDate)], ['무게', pet.weight ? `${pet.weight}${pet.weightUnit || 'g'}` : '-'], ['특징', pet.description || '-'], ['메모', pet.memo || '-']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button type="button" className="pet-flow-delete" onClick={() => void deletePet()}><PetIcon name="delete"/>펫 삭제</button>{deleteError ? <p role="alert">{deleteError}</p> : null}</section> : null}
    <section className="pet-flow-detail-content"><div className="pet-flow-hero"><PetPhoto pet={pet}/></div><div className="pet-flow-detail-body">
      <section className="pet-flow-identity"><div><h2>{pet.name}</h2><p>{pet.species} · {genderLabel(pet.gender)}</p></div></section>
      <section className="pet-flow-today"><h2>오늘의 루틴 <strong>{completed}/{petTasks.length}</strong></h2><ProgressBar done={completed} total={petTasks.length} label={`${pet.name} 오늘 루틴 진행률`}/><h3>남은 루틴</h3>{remaining.length ? <div className="pet-flow-routine-pills">{remaining.map((task) => <button type="button" key={task.id} onClick={() => onView('routines')}><PetIcon name={routineIcons[task.taskType.split('|')[0]] ?? 'routine'}/>{task.label}</button>)}</div> : <p>{petTasks.length && completed === petTasks.length ? '오늘의 루틴을 모두 완료했어요!' : '오늘 예정된 루틴이 없어요.'}</p>}</section>
      <nav className="pet-flow-detail-links" aria-label="펫 관리"><button type="button" onClick={() => onView('routines')}><PetIcon name="routine"/><span>루틴 관리</span><PetIcon name="chevron"/></button><button type="button" onClick={() => onView('records')}><PetIcon name="record"/><span>기록 모아보기</span><PetIcon name="chevron"/></button><button type="button" onClick={() => onEditPet(pet)}><PetIcon name="settings"/><span>펫 정보 수정</span><PetIcon name="chevron"/></button></nav>
    </div></section>
  </main>
}
