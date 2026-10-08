import { petRoutineSummary } from '../../features/diary/routineSchedule'
import { useState, type CSSProperties } from 'react'
import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { Pet } from '../../types/app'
import Mascot from '../common/Mascot'
import { PetIcon, PetIconMark, type PetIconName } from './PetIcons'
import './PetFlow.css'
import { ProgressBar } from '../ui/ProgressBar'
import { FlowHeader } from '../ui/FlowHeader'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export type PetMobileView = 'main' | 'detail' | 'records' | 'growth' | 'routines'
type RecordTab = 'temperature' | 'humidity' | 'weight' | 'shed' | 'poop' | 'mating' | 'egg'
type PetFilter = 'all' | 'amphibian' | 'reptile'
type Props = { pets: Pet[]; selectedPetId: string; view: PetMobileView; tasks: DailyTask[]; plans: CarePlan[]; records: PetRecord[]; onSelectPet: (id: string) => void; onView: (view: PetMobileView) => void; onRegisterPet: () => void; onEditPet: (pet: Pet) => void; onOpenDiary: (petId: string, action?: 'routine-create') => void }

const routineLabels: Record<string, string> = { feed: '먹이', mist: '분무', water: '물그릇', weight: '무게', humidity: '습도', temperature: '온도', water_temperature: '수온', cleaning: '청소', partial_cleaning: '청소', full_cleaning: '청소', medicine: '약', hospital: '진료', uvb_check: 'UVB', water_quality: '수질 확인', filter_check: '여과기 확인', custom: '직접 입력' }
const routineIcons: Record<string, PetIconName> = { feed: 'feed', mist: 'mist', water: 'water', weight: 'weight', humidity: 'mist', temperature: 'temperature', water_temperature: 'temperature', cleaning: 'cleaning', partial_cleaning: 'cleaning', full_cleaning: 'cleaning', uvb_check: 'uvb', medicine: 'medicine' }
const recordTabs: Array<[RecordTab, string]> = [['temperature', '온도'], ['humidity', '습도'], ['weight', '무게'], ['shed', '탈피'], ['poop', '배변'], ['mating', '메이팅'], ['egg', '산란']]
const petFilters: Array<[PetFilter, string]> = [['all', '전체'], ['reptile', '파충류'], ['amphibian', '양서류']]
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


type PetAreaDatum = { label: string; [key: string]: string | number }
type PetAreaSeries = { key: string; label: string; color: string; stackId?: string }

const isMatingRecord = (record: PetRecord) => record.incidentRecord?.kind === 'mating' || record.memo?.startsWith('메이팅 · ')
const isEggRecord = (record: PetRecord) => record.incidentRecord?.kind === 'egg' || record.memo?.startsWith('산란 · ')
const isShedStart = (record: PetRecord) => Boolean(record.memo?.includes('탈피 시작') || record.memo?.includes('탈피 중'))
const isShedEnd = (record: PetRecord) => Boolean(record.memo?.includes('탈피 완료') && !record.memo?.includes('완료 안됨'))

function stoolAreaKey(record: PetRecord) {
  const status = record.stoolRecord?.status
  if (status === 'blood' || record.memo?.includes('혈변')) return 'blood'
  if (status === 'foreign_body' || record.memo?.includes('이물질')) return 'foreign_body'
  if (status === 'diarrhea' || record.memo?.includes('묽')) return 'diarrhea'
  if (status === 'dry' || status === 'constipation' || record.memo?.includes('건조') || record.memo?.includes('딱딱') || record.memo?.includes('단단')) return 'dry'
  return 'normal'
}

function eventAreaData(records: PetRecord[], keys: string[], classify: (record: PetRecord) => string): PetAreaDatum[] {
  const byDate = new Map<string, PetAreaDatum>()
  records.forEach((record) => {
    const row = byDate.get(record.date) ?? Object.fromEntries([['label', record.date.slice(5).replace('-', '/')], ...keys.map((key) => [key, 0])]) as PetAreaDatum
    const key = classify(record)
    row[key] = Number(row[key] ?? 0) + 1
    byDate.set(record.date, row)
  })
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
}

function getPetAreaChartConfig(records: PetRecord[], tab: RecordTab, title: string): { unit: string; data: PetAreaDatum[]; series: PetAreaSeries[] } {
  if (tab === 'weight' || tab === 'temperature' || tab === 'humidity') {
    const values = records.filter((record) => tab === 'weight' ? record.type === 'weight' && record.weight !== undefined : record.environmentRecord?.metricType === tab).slice().reverse()
    return { unit: tab === 'weight' ? 'g' : tab === 'humidity' ? '%' : '℃', data: values.map((record) => ({ label: record.date.slice(5).replace('-', '/'), value: tab === 'weight' ? record.weight ?? 0 : record.environmentRecord?.value ?? 0 })), series: [{ key: 'value', label: title, color: 'var(--color-primary-600)' }] }
  }
  if (tab === 'poop') {
    const poop = records.filter((record) => record.type === 'poop')
    const keys = ['normal', 'diarrhea', 'dry', 'foreign_body', 'blood']
    return { unit: '회', data: eventAreaData(poop, keys, stoolAreaKey), series: [{ key: 'normal', label: '정상', color: 'var(--color-primary-600)', stackId: 'poop' }, { key: 'diarrhea', label: '묽음', color: 'var(--color-chart-yellow)', stackId: 'poop' }, { key: 'dry', label: '건조', color: 'var(--color-chart-orange)', stackId: 'poop' }, { key: 'foreign_body', label: '이물질', color: 'var(--color-chart-black)', stackId: 'poop' }, { key: 'blood', label: '혈변', color: 'var(--color-error-600)', stackId: 'poop' }] }
  }
  if (tab === 'shed') {
    const shed = records.filter((record) => record.type === 'shed' && (isShedStart(record) || isShedEnd(record)))
    return { unit: '회', data: eventAreaData(shed, ['started', 'completed'], (record) => isShedStart(record) ? 'started' : 'completed'), series: [{ key: 'started', label: '탈피 시작', color: 'var(--color-primary-400)' }, { key: 'completed', label: '탈피 종료', color: 'var(--color-primary-700)' }] }
  }
  if (tab === 'mating') return { unit: '회', data: eventAreaData(records.filter(isMatingRecord), ['mating'], () => 'mating'), series: [{ key: 'mating', label: '메이팅', color: 'var(--color-like-500)' }] }
  const context = records.filter((record) => record.type === 'food' || isMatingRecord(record) || isEggRecord(record))
  const classify = (record: PetRecord) => record.type === 'food' ? 'food' : isMatingRecord(record) ? 'mating' : ((record.incidentRecord?.kind === 'egg' && record.incidentRecord.fertility === 'unfertilized') || record.memo?.includes('무정란')) ? 'unfertilized' : 'fertilized'
  return { unit: '회', data: eventAreaData(context, ['food', 'mating', 'fertilized', 'unfertilized'], classify), series: [{ key: 'food', label: '먹이', color: 'var(--color-accent-600)' }, { key: 'mating', label: '메이팅', color: 'var(--color-like-500)' }, { key: 'fertilized', label: '유정란', color: 'var(--color-primary-600)' }, { key: 'unfertilized', label: '무정란', color: 'var(--color-chart-yellow)' }] }
}

function PetRecordAreaChart({ records, tab }: { records: PetRecord[]; tab: RecordTab }) {
  const title = recordTabs.find(([id]) => id === tab)?.[1] ?? ''
  const { unit, data, series } = getPetAreaChartConfig(records, tab, title)
  if (!data.length) return <p className="pet-flow-empty">아직 {title} 기록이 없어요.</p>
  return <figure className="pet-flow-chart"><figcaption><strong>{title}</strong>{series.length > 1 && <span>{series.map((item) => <i key={item.key}><b style={{ background: item.color }}/>{item.label}</i>)}</span>}</figcaption><div className="pet-flow-chart-canvas" role="img" aria-label={`${title} AREA 차트`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false} unit={unit} width={48} allowDecimals={false}/><Tooltip formatter={(value, name) => [`${value}${unit}`, name]}/>{series.map((item) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.label} stackId={item.stackId} stroke={item.color} fill={item.color} fillOpacity={0.24} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }}/>)}</AreaChart></ResponsiveContainer></div></figure>
}

export default function PetMobileFlow({ pets, selectedPetId, view, tasks, plans, records, onSelectPet, onView, onRegisterPet, onEditPet, onOpenDiary }: Props) {
  const [recordTab, setRecordTab] = useState<RecordTab>('weight')
  const [petFilter, setPetFilter] = useState<PetFilter>('all')
  const pet = pets.find((item) => item.id === selectedPetId) ?? pets[0]
  const visiblePets = petFilter === 'all' ? pets : pets.filter((item) => item.group === petFilter)

  if (view === 'main' || !pet) return <main className="pet-flow pet-flow-list">
    <header className="pet-flow-list-tools"><nav className="pet-flow-filters" aria-label="펫 분류 필터">{petFilters.map(([filter, label]) => <button type="button" className={petFilter === filter ? 'active' : ''} aria-pressed={petFilter === filter} key={filter} onClick={() => setPetFilter(filter)}>{label}</button>)}</nav><button className="pet-flow-add" type="button" aria-label="펫 추가" onClick={onRegisterPet}><PetIcon name="add"/></button></header>
    {visiblePets.length ? <div className="pet-flow-cards">{visiblePets.map((item) => {
      const todayTasks = tasksForPet(item.id, tasks, plans)
      const completed = todayTasks.filter((task) => task.status === 'completed').length
      const progressPercent = todayTasks.length ? Math.round(completed / todayTasks.length * 100) : 0
      return <button className="pet-flow-card" type="button" key={item.id} aria-label={`${item.name} 상세 보기`} onClick={() => { onSelectPet(item.id); onView('detail') }}>
        <span className="pet-flow-card-identity"><PetProgressPhoto pet={item} completed={completed} total={todayTasks.length}/><span><strong>{item.name} <PetIcon name={item.gender === 'male' ? 'male' : item.gender === 'female' ? 'female' : 'unknown'} aria-label={genderLabel(item.gender)}/></strong><small>{item.species}</small></span></span>
        {todayTasks.length ? <span className="pet-flow-card-progress"><strong>{progressPercent}%</strong><small>{completed === todayTasks.length ? '오늘 케어 완료' : '오늘 케어'}</small></span> : <span className="pet-flow-card-status"><small>오늘 예정된 루틴이 없어요.</small></span>}
      </button>
    })}</div> : pets.length ? <section className="pet-flow-filter-empty"><p>{petFilter === 'amphibian' ? '등록된 양서류가 없어요.' : '등록된 파충류가 없어요.'}</p><button type="button" onClick={() => setPetFilter('all')}>전체 펫 보기</button></section> : <section className="pet-flow-empty-home"><Mascot mood="welcome"/><p>등록된 펫이 없어요.</p></section>}
  </main>

  const petTasks = tasksForPet(pet.id, tasks, plans)
  const completed = petTasks.filter((task) => task.status === 'completed').length
  const remaining = petTasks.filter((task) => task.status === 'pending')
  const petPlans = plans.filter((plan) => plan.petId === pet.id && plan.isActive)
  const petRecords = records.filter((record) => record.petId === pet.id).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  const backToDetail = () => onView('detail')

  if (view === 'records' || view === 'growth') return <main className="pet-flow pet-flow-records">
    <FlowHeader title="기록 모아보기" onBack={backToDetail}/>
    <nav className="pet-flow-record-tabs" aria-label="기록 종류">{recordTabs.map(([id, label]) => <button type="button" className={recordTab === id ? 'active' : ''} aria-pressed={recordTab === id} key={id} onClick={() => setRecordTab(id)}>{label}</button>)}</nav>
    <PetRecordAreaChart records={petRecords} tab={recordTab}/>
  </main>

  if (view === 'routines') return <main className="pet-flow pet-flow-routines">
    <header className="pet-flow-header centered"><BackButton onClick={backToDetail}/><h1>루틴 관리</h1><button className="pet-flow-add" type="button" aria-label="루틴 추가" onClick={() => onOpenDiary(pet.id, 'routine-create')}><PetIcon name="add"/></button></header>
    <div className="pet-flow-routine-list">{petPlans.length ? petPlans.map((plan) => <button type="button" key={plan.id} onClick={() => onOpenDiary(pet.id, 'routine-create')}><PetIcon name={routineIcons[plan.taskType] ?? 'routine'}/><span><strong>{plan.title || routineLabels[plan.taskType] || plan.taskType}</strong><small>{plan.notificationTime}</small></span><PetIcon name="chevron"/></button>) : <p className="pet-flow-empty">등록된 루틴이 없어요.</p>}</div>
  </main>

  return <main className="pet-flow pet-flow-detail">
    <header className="pet-flow-header centered"><BackButton onClick={() => onView('main')}/><h1>{pet.name}</h1><div className="pet-flow-header-actions"><button className="pet-flow-icon-button pet-flow-edit-button" type="button" aria-label="펫 정보 수정" onClick={() => onEditPet(pet)}><PetIcon name="edit"/></button></div></header>
    <section className="pet-flow-detail-content"><div className="pet-flow-hero"><PetPhoto pet={pet}/></div><div className="pet-flow-detail-body">
      <section className="pet-flow-identity"><div><h2>{pet.name}</h2><p>{pet.species} · {genderLabel(pet.gender)}</p></div></section>
      <section className="pet-flow-today"><h2>오늘의 루틴 <strong>{completed}/{petTasks.length}</strong></h2><ProgressBar done={completed} total={petTasks.length} label={`${pet.name} 오늘 루틴 진행률`}/><h3>남은 루틴</h3>{remaining.length ? <div className="pet-flow-routine-pills">{remaining.map((task) => <button type="button" key={task.id} onClick={() => onView('routines')}><PetIcon name={routineIcons[task.taskType.split('|')[0]] ?? 'routine'}/>{task.label}</button>)}</div> : <p>{petTasks.length && completed === petTasks.length ? '오늘의 루틴을 모두 완료했어요!' : '오늘 예정된 루틴이 없어요.'}</p>}</section>
      <nav className="pet-flow-detail-links" aria-label="펫 관리"><button type="button" onClick={() => onView('routines')}><PetIconMark name="routine"/><span>루틴 관리</span></button><button type="button" onClick={() => onView('records')}><PetIconMark name="record"/><span>기록 모아보기</span></button><button type="button" onClick={() => onEditPet(pet)}><PetIconMark name="settings"/><span>펫 정보 수정</span></button></nav>
    </div></section>
  </main>
}
