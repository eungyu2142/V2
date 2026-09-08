import { useState } from 'react'
import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { Pet } from '../../types/app'
import { PetIcon, PetIconMark, type PetIconName } from './PetIcons'

export type PetMobileView = 'main' | 'detail' | 'records' | 'growth' | 'routines'
type DetailTab = 'profile' | 'records' | 'routine' | 'stats'
type Props = { pets: Pet[]; selectedPetId: string; view: PetMobileView; tasks: DailyTask[]; plans: CarePlan[]; records: PetRecord[]; onSelectPet: (id: string) => void; onView: (view: PetMobileView) => void; onRegisterPet: () => void; onEditPet: (pet: Pet) => void; onDeletePet: (petId: string) => void | Promise<void>; onOpenDiary: (petId: string, action?: 'routine-create') => void }

const routineLabels: Record<string, string> = { feed: '먹이 급여', mist: '분무', water: '물그릇 교체', weight: '체중', humidity: '습도 확인', temperature: '온도 확인', water_temperature: '수온 확인', cleaning: '청소', partial_cleaning: '부분 청소', full_cleaning: '전체 청소', medicine: '약', hospital: '병원 방문' }
const routineIcons: Record<string, PetIconName> = { feed: 'feed', mist: 'mist', water: 'mist', weight: 'weight', humidity: 'temperature', temperature: 'temperature', water_temperature: 'temperature', cleaning: 'routine', partial_cleaning: 'routine', full_cleaning: 'routine' }
const recordLabels: Record<string, string> = { food: '먹이 급여', water: '물그릇', cleaning: '청소', temperature: '온도', humidity: '습도', weight: '체중', poop: '배변', shed: '탈피', mating: '메이팅', egg: '산란', medicine: '약', hospital: '병원' }
const dateLabel = (value?: string) => value ? value.slice(0, 10).replaceAll('-', '. ') : '-'
const genderLabel = (gender: Pet['gender']) => gender === 'male' ? '수컷' : gender === 'female' ? '암컷' : '미구분'

function ageLabel(birthday?: string) {
  if (!birthday) return ''
  const birth = new Date(`${birthday}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return ''
  let age = new Date().getFullYear() - birth.getFullYear()
  const beforeBirthday = new Date().getMonth() < birth.getMonth() || (new Date().getMonth() === birth.getMonth() && new Date().getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return `${Math.max(0, age)}살`
}

function recordSummary(record: PetRecord) {
  if (record.weight !== undefined) return `${record.weight}g`
  if (record.environmentRecord) return `${record.environmentRecord.value}${record.environmentRecord.unit === 'percent' ? '%' : '℃'}`
  if (record.feedingFoods?.length) return record.feedingFoods.map((food) => food.foodName).join(' · ')
  if (record.foods?.length) return record.foods.join(' · ')
  return record.memo || '기록됨'
}

function PetPhoto({ pet, circle = false }: { pet: Pet; circle?: boolean }) {
  return <span className={`pet-reference-photo-content ${circle ? 'is-circle' : ''}`}>{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }}/> : <span>{pet.name.trim().slice(0, 1) || '?'}</span>}</span>
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button className="pet-detail-circle-button" type="button" aria-label="뒤로가기" onClick={onClick}><PetIcon name="back"/></button>
}

export default function PetMobileFlow({ pets, selectedPetId, view, tasks, plans, records, onSelectPet, onView, onRegisterPet, onEditPet, onDeletePet, onOpenDiary }: Props) {
  const [tab, setTab] = useState<DetailTab>('profile')
  const [menuOpen, setMenuOpen] = useState(false)
  const pet = pets.find((item) => item.id === selectedPetId) ?? pets[0]

  if (!pet) return <main className="pet-reference-list empty"><header><h1>마이 펫</h1><button type="button" onClick={onRegisterPet} aria-label="반려동물 등록"><PetIcon name="add"/></button></header><section><PetIconMark name="pet" className="size-20"/><h2>등록된 반려동물이 없어요</h2><button type="button" onClick={onRegisterPet}>반려동물 등록하기</button></section></main>

  const petRecords = records.filter((item) => item.petId === pet.id).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  const petPlans = plans.filter((item) => item.petId === pet.id && item.isActive)
  const petTasks = tasks.filter((item) => item.petId === pet.id)
  const weights = petRecords.filter((item) => item.type === 'weight' && item.weight !== undefined).slice(0, 8).reverse()
  const maxWeight = Math.max(...weights.map((item) => item.weight ?? 0), 1)
  const minWeight = Math.min(...weights.map((item) => item.weight ?? 0), maxWeight)
  const weightRange = Math.max(1, maxWeight - minWeight)
  const graphPoints = weights.map((item, index) => `${weights.length < 2 ? 50 : 8 + index * 84 / (weights.length - 1)},${82 - ((item.weight ?? 0) - minWeight) / weightRange * 60}`).join(' ')

  if (view === 'main') {
    const completed = petTasks.filter((item) => item.status === 'completed').length
    const completion = petTasks.length ? Math.round(completed / petTasks.length * 100) : 0
    const latestWeight = petRecords.find((item) => item.type === 'weight' && item.weight !== undefined)?.weight
    return <main className="pet-mobile-home">
      <header><h1>마이 펫</h1><button type="button" onClick={onRegisterPet} aria-label="반려동물 등록"><PetIcon name="add"/></button></header>
      <section className="pet-mobile-selector" aria-label="관리할 반려동물 선택">
        {pets.map((item) => <button className={item.id === pet.id ? 'active' : ''} type="button" key={item.id} onClick={() => onSelectPet(item.id)}><span><PetPhoto pet={item} circle/></span><strong>{item.name}</strong><small>{item.species}</small></button>)}
        <button type="button" onClick={onRegisterPet}><span className="add"><PetIcon name="add"/></span><strong>펫 추가</strong><small>새 친구</small></button>
      </section>
      <button className="pet-mobile-summary" type="button" onClick={() => onView('detail')}>
        <span className="photo"><PetPhoto pet={pet}/></span><span className="copy"><small>현재 관리 중</small><strong>{pet.name}</strong><span>{pet.species} · {genderLabel(pet.gender)}</span><span>{[ageLabel(pet.birthday), latestWeight !== undefined ? `${latestWeight}g` : ''].filter(Boolean).join(' · ') || '기본 정보를 확인해 주세요'}</span></span><PetIcon name="chevron"/>
      </button>
      <section className="pet-mobile-care"><header><div><h2>오늘 할 일</h2><span>{completed}/{petTasks.length} 완료</span></div><button type="button" onClick={() => onOpenDiary(pet.id)}>전체 보기 <PetIcon name="chevron"/></button></header>
        {petTasks.length ? <div>{petTasks.slice(0, 3).map((task) => <button type="button" key={task.id} onClick={() => onOpenDiary(pet.id)}><PetIconMark name={routineIcons[task.taskType] ?? 'routine'}/><span><strong>{routineLabels[task.taskType] || task.taskType}</strong><small>{task.status === 'completed' ? '완료한 관리' : '오늘 예정'}</small></span><i className={task.status === 'completed' ? 'done' : ''}>{task.status === 'completed' ? '✓' : ''}</i></button>)}</div> : <p>오늘 예정된 관리가 없어요.</p>}
      </section>
      <section className="pet-mobile-progress"><header><h2>이번 주 케어 달성률</h2><strong>{completion}%</strong></header><div><i style={{ width: `${completion}%` }}/></div><button type="button" onClick={() => onOpenDiary(pet.id)}>다이어리에서 관리하기 <PetIcon name="chevron"/></button></section>
    </main>
  }

  return <main className="pet-reference-detail">
    <section className="pet-reference-hero"><div className="pet-reference-hero-photo"><PetPhoto pet={pet}/></div><BackButton onClick={() => { setMenuOpen(false); onView('main') }}/><button className="pet-detail-circle-button menu" type="button" aria-label="펫 메뉴" onClick={() => setMenuOpen((value) => !value)}>•••</button>{menuOpen ? <div className="pet-reference-detail-menu"><button type="button" onClick={() => onEditPet(pet)}><PetIcon name="edit"/>수정</button><button type="button" onClick={() => { if (window.confirm(`'${pet.name}'을 삭제하시겠습니까?`)) void onDeletePet(pet.id) }}><PetIcon name="delete"/>삭제</button></div> : null}<button className="pet-reference-edit-pill" type="button" onClick={() => onEditPet(pet)}><PetIcon name="edit"/>수정</button></section>
    <section className="pet-reference-identity"><h1>{pet.name}</h1><p>{pet.species} | {genderLabel(pet.gender)}</p><p>{dateLabel(pet.birthday)} {ageLabel(pet.birthday) ? `(${ageLabel(pet.birthday)})` : ''}</p></section>
    <nav className="pet-reference-tabs" aria-label="펫 상세 탭">{([['profile','profile','프로필'],['records','record','기록'],['routine','pet','루틴'],['stats','stats','통계']] as Array<[DetailTab, PetIconName, string]>).map(([id, icon, label]) => <button className={tab === id ? 'active' : ''} type="button" key={id} onClick={() => setTab(id)}><PetIconMark name={icon}/><span>{label}</span></button>)}</nav>

    {tab === 'profile' ? <section className="pet-reference-panel"><h2>기본 정보</h2><dl>{[['종', pet.species], ['성별', genderLabel(pet.gender)], ['생년월일', dateLabel(pet.birthday)], ['입양일', dateLabel(pet.adoptionDate)], ['특징', pet.description || '-'], ['메모', pet.memo || '-']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
    {tab === 'records' ? <section className="pet-reference-panel"><header><h2>최근 기록</h2><button type="button" onClick={() => onOpenDiary(pet.id)}>더보기 <PetIcon name="chevron"/></button></header>{petRecords.length ? <div className="pet-reference-record-list">{petRecords.slice(0, 6).map((record) => <button type="button" key={record.id} onClick={() => onOpenDiary(pet.id)}><PetIconMark name={routineIcons[record.type] ?? (record.type === 'weight' ? 'weight' : 'record')}/><span><strong>{recordLabels[record.type] ?? '기록'}</strong><small>{dateLabel(record.date)}{record.occurredAt ? ` ${new Date(record.occurredAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}</small></span><small>{recordSummary(record)}</small><PetIcon name="chevron"/></button>)}</div> : <p className="pet-reference-empty">아직 기록이 없어요.</p>}</section> : null}
    {tab === 'routine' ? <section className="pet-reference-panel"><header><h2>루틴 관리</h2><button className="pet-reference-add-routine" type="button" onClick={() => onOpenDiary(pet.id, 'routine-create')}>추가 <PetIcon name="add"/></button></header>{petPlans.length ? <div className="pet-reference-routine-list">{petPlans.map((plan) => <button type="button" key={plan.id} onClick={() => onOpenDiary(pet.id)}><PetIconMark name={routineIcons[plan.taskType] ?? 'routine'}/><span><strong>{plan.title || routineLabels[plan.taskType] || plan.taskType}</strong><small>{plan.notificationTime || '시간 미지정'}</small></span><i aria-label="사용 중"/></button>)}</div> : <p className="pet-reference-empty">등록된 루틴이 없어요.</p>}</section> : null}
    {tab === 'stats' ? <section className="pet-reference-panel stats"><div className="pet-reference-period"><button type="button">1주</button><button className="active" type="button">1개월</button><button type="button">3개월</button><button type="button">전체</button></div><article><h2><PetIconMark name="weight"/>체중 변화</h2>{weights.length ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="체중 변화 그래프"><polyline points={graphPoints} fill="none" stroke="var(--color-primary-700)" strokeWidth="2"/><circle cx={graphPoints.split(' ').at(-1)?.split(',')[0]} cy={graphPoints.split(' ').at(-1)?.split(',')[1]} r="2.5" fill="var(--color-primary-700)"/></svg> : <p className="pet-reference-empty">체중 기록이 없어요.</p>}</article>{['temperature','poop','food'].map((type) => <button className="pet-reference-stat-link" type="button" key={type} onClick={() => onOpenDiary(pet.id)}><PetIconMark name={type === 'temperature' ? 'temperature' : type === 'food' ? 'feed' : 'record'}/><strong>{type === 'temperature' ? '온습도 추가' : type === 'poop' ? '배변 기록' : '먹이 급여'}</strong><PetIcon name="chevron"/></button>)}</section> : null}
    <span className="sr-only">이번 주 루틴 {petTasks.filter((item) => item.status === 'completed').length}개 완료</span>
  </main>
}
