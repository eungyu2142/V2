import { useEffect, useMemo, useState } from 'react'
import GuideAction from '../common/GuideAction'
import './MyPet.css'
import { listCarePlans, listCareRecords, listDailyTasks } from '../../features/diary/diaryService'
import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { AnimalCategory, Pet } from '../../types/app'
import PetMobileFlow, { type PetMobileView } from './PetMobileFlow'
import { PetIcon } from './PetIcons'

const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
}

const visibleCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'amphibian']

function isVisiblePetCategory(value: AnimalCategory): value is 'reptile' | 'amphibian' {
  return value === 'reptile' || value === 'amphibian'
}

type TodayTask = {
  id: string
  label: string
  status: DailyTask['status']
}

const routineLabels: Record<string, string> = {
  feed: '먹이',
  mist: '분무',
  water: '물그릇 교체',
  weight: '무게 측정',
  humidity: '습도 확인',
  temperature: '온도 확인',
  water_temperature: '수온 확인',
  full_cleaning: '전체 청소',
  partial_cleaning: '부분 청소',
  wall_wipe: '벽 닦기',
  structure_cleaning: '구조물 세척',
  uvb_check: 'UVB 확인',
  water_quality: '수질 확인',
  filter_check: '여과기 확인',
  medicine: '약',
  hospital: '진료',
  custom: '직접 입력',
}

function todayDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weekDateRange() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { start: format(start), end: format(end) }
}

function taskLabel(task: DailyTask, plans: Map<string, CarePlan>) {
  const plan = task.carePlanId ? plans.get(task.carePlanId) : undefined
  if (plan?.title.trim()) return plan.title.trim()
  const [taskType, detail] = task.taskType.split('|')
  if (taskType === 'medicine' && detail) return `약 · ${detail}`
  return routineLabels[taskType] ?? taskType
}

function planLabel(plan: CarePlan) {
  return plan.title.trim() || routineLabels[plan.taskType] || plan.taskType
}

function isPlanScheduledToday(plan: CarePlan, today: string, weekday: number) {
  if (!plan.isActive || plan.startDate > today) return false
  if (plan.endDate && plan.endDate < today) return false
  return plan.repeatDays.includes(weekday)
}

export default function PetsScreen({
  userId,
  pets,
  onDeletePet,
  onEditPet,
  onOpenDiary,
  onRegisterPet,
}: {
  userId: string
  pets: Pet[]
  onDeletePet: (petId: string) => void | Promise<void>
  onEditPet: (pet: Pet) => void
  onOpenDiary: (petId: string, action?: 'routine-create') => void
  onRegisterPet: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<'reptile' | 'amphibian'>>([])
  const [menuPetId, setMenuPetId] = useState<string | null>(null)
  const [todayTasksByPet, setTodayTasksByPet] = useState<Record<string, TodayTask[]>>({})
  const [routinePetIds, setRoutinePetIds] = useState<Set<string>>(() => new Set())
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [records, setRecords] = useState<PetRecord[]>([])
  const [mobileView, setMobileView] = useState<PetMobileView>('main')
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? '')
  const [mobileLayout, setMobileLayout] = useState(() => window.matchMedia('(max-width: 760px) and (orientation: portrait)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px) and (orientation: portrait)')
    const update = () => setMobileLayout(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const resolvedSelectedPetId = pets.some((pet) => pet.id === selectedPetId) ? selectedPetId : pets[0]?.id ?? ''

  useEffect(() => {
    let active = true
    const today = todayDateKey()
    const week = weekDateRange()

    Promise.all([
      listCarePlans(userId).catch(() => [] as CarePlan[]),
      listDailyTasks(userId, week.start, week.end).catch(() => [] as DailyTask[]),
      listCareRecords(userId).catch(() => [] as PetRecord[]),
    ]).then(([plans, tasks, nextRecords]) => {
      if (!active) return
      const plansById = new Map(plans.map((plan) => [plan.id, plan]))
      const todayTasks = tasks.filter((task) => task.scheduledDate === today)
      const taskPlanIds = new Set(todayTasks.map((task) => task.carePlanId).filter((id): id is string => Boolean(id)))
      const grouped = todayTasks.reduce<Record<string, TodayTask[]>>((result, task) => {
        const petTasks = result[task.petId] ?? []
        petTasks.push({
          id: task.id,
          label: taskLabel(task, plansById),
          status: task.status,
        })
        result[task.petId] = petTasks
        return result
      }, {})

      const weekday = new Date().getDay()
      plans
        .filter((plan) => isPlanScheduledToday(plan, today, weekday) && !taskPlanIds.has(plan.id))
        .forEach((plan) => {
          const petTasks = grouped[plan.petId] ?? []
          petTasks.push({
            id: `plan-${plan.id}`,
            label: planLabel(plan),
            status: 'pending',
          })
          grouped[plan.petId] = petTasks
        })

      setRoutinePetIds(new Set(plans.filter((plan) => plan.isActive).map((plan) => plan.petId)))
      setTodayTasksByPet(grouped)
      setPlans(plans)
      setDailyTasks(tasks)
      setRecords(nextRecords)
    })

    return () => {
      active = false
    }
  }, [pets, userId])

  const filteredPets = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return pets
      .filter((pet) => {
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(pet.group as 'reptile' | 'amphibian')
        const text = `${pet.name} ${pet.species} ${animalCategoryLabels[pet.group]}`.toLowerCase()
        return matchesCategory && text.includes(keyword)
      })
      .sort((a, b) => new Date(b.registeredAt ?? 0).getTime() - new Date(a.registeredAt ?? 0).getTime())
  }, [pets, query, selectedCategories])

  const toggleCategory = (item: AnimalCategory) => {
    if (item === 'all') {
      setSelectedCategories([])
      return
    }
    if (!isVisiblePetCategory(item)) return
    setSelectedCategories((current) => {
      if (current.includes(item)) return current.filter((category) => category !== item)
      if (current.length > 0) return []
      return [item]
    })
  }

  const requestDelete = (pet: Pet) => {
    if (window.confirm(`'${pet.name}'을 삭제하시겠습니까?`)) onDeletePet(pet.id)
  }

  if (mobileLayout) return <PetMobileFlow pets={pets} selectedPetId={resolvedSelectedPetId} view={mobileView} tasks={dailyTasks} plans={plans} records={records} onSelectPet={(id) => { setSelectedPetId(id); setMobileView('main') }} onView={setMobileView} onRegisterPet={onRegisterPet} onEditPet={onEditPet} onDeletePet={onDeletePet} onOpenDiary={onOpenDiary} />

  return (
    <section className="mx-auto flex w-full max-w-[76rem] flex-col gap-5 px-4 pb-24 pt-2 max-[760px]:-mx-4 max-[760px]:w-[calc(100%+2rem)] sm:px-6 max-[760px]:px-4 lg:px-8">
      <section className="flex flex-col gap-3">
        <div className="relative h-11 w-full">
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 grid size-5 -translate-y-1/2 place-items-center text-app-muted" aria-hidden="true"><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></span>
          <input
            className={`m-0! h-11! min-h-11! w-full! rounded-control! border! border-app-border! bg-app-surface! py-0! pl-10! text-sm! text-app-ink! shadow-none! outline-none! placeholder:text-app-muted focus:border-brand-600! focus:ring-2! focus:ring-brand-100! sm:text-base! ${query ? 'pr-11!' : 'pr-3!'}`}
            aria-label="펫 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예시) 크레스티드 게코"
          />
          {query ? <button className="absolute right-1.5 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full text-lg text-app-muted hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600" type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><GuideAction symbol="×" /></button> : null}
        </div>

        {pets.length === 0 ? (
          <button className="h-11 w-fit rounded-control bg-brand-600 px-5 text-sm font-bold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" type="button" onClick={onRegisterPet}>나의 첫 반려동물 등록하기</button>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="동물 분류 필터">
            {visibleCategoryOptions.map((item) => {
              const selected = item === 'all' ? selectedCategories.length === 0 : isVisiblePetCategory(item) && selectedCategories.includes(item)
              return (
                <button className={`h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-app-border bg-app-surface text-app-ink hover:bg-brand-50'}`} type="button" key={item} onClick={() => toggleCategory(item)} aria-pressed={selected}>
                  {animalCategoryLabels[item]}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold text-app-ink">등록된 펫</h2>
          <span className="text-sm font-bold text-brand-700" aria-label={`${filteredPets.length}마리`}>{filteredPets.length}</span>
        </div>
        {filteredPets.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 border-y border-app-border py-8 text-center">
            <strong className="text-base text-app-ink">{pets.length === 0 ? '아직 등록된 펫이 없어요' : '검색 결과가 없어요'}</strong>
            <p className="text-sm text-app-muted">{pets.length === 0 ? '관리할 반려동물을 먼저 등록해 주세요.' : '검색어 또는 분류를 다시 확인해 주세요.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {filteredPets.map((pet) => {
              const todayTasks = todayTasksByPet[pet.id] ?? []
              const completedTaskCount = todayTasks.filter((task) => task.status === 'completed').length
              const hasRoutineSummary = routinePetIds.has(pet.id) || todayTasks.length > 0
              return (
                <article className="relative min-w-0 rounded-card border border-app-border bg-app-surface shadow-sm transition-[border-color,box-shadow,transform] hover:border-brand-300 hover:shadow-md focus-within:border-brand-600 motion-reduce:transition-none" key={pet.id}>
                  <button className={`grid min-h-36 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-2.5 rounded-card px-3 py-5 pr-9 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:scale-[0.99] motion-reduce:transform-none sm:min-h-40 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4 sm:p-5 sm:pr-12 ${hasRoutineSummary ? 'md:grid-cols-[4.5rem_minmax(0,1fr)_minmax(10rem,0.8fr)]' : ''}`} type="button" aria-label={`${pet.name} 다이어리 열기`} onClick={() => onOpenDiary(pet.id)}>
                    <div className="size-12 shrink-0 overflow-hidden rounded-full bg-brand-100 sm:size-[4.5rem]">
                      {pet.photo ? <img className="size-full object-cover" src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }} /> : <span className="grid size-full place-items-center text-lg font-bold text-brand-900" aria-label="사진 없음">{pet.name.trim().slice(0, 1) || '?'}</span>}
                    </div>
                    <div className="min-w-0 self-center">
                      <strong className="flex w-full min-w-0 items-center gap-1 whitespace-nowrap text-sm font-bold text-app-ink sm:text-lg">
                        <span className="min-w-0 flex-1 truncate" title={pet.name}>{pet.name}</span>
                        <PetIcon name={pet.gender === 'male' ? 'male' : pet.gender === 'female' ? 'female' : 'unknown'} className="size-4 shrink-0 text-brand-700" aria-label={pet.gender === 'male' ? '수컷' : pet.gender === 'female' ? '암컷' : '미구분'} />
                      </strong>
                      {pet.species ? <small className="mt-1 block w-full truncate whitespace-nowrap text-xs text-app-muted sm:text-sm" title={pet.species}>{pet.species}</small> : null}
                    </div>
                    {hasRoutineSummary ? (
                      <div className="hidden min-w-0 border-l border-app-border pl-4 md:block">
                        <div className="mb-2 flex items-center justify-between gap-2 text-sm"><strong className="text-app-ink">오늘 할 일</strong>{todayTasks.length > 0 ? <span className="font-bold text-brand-700">{completedTaskCount}/{todayTasks.length}</span> : null}</div>
                        {todayTasks.length > 0 ? (
                          <>
                            <div className="h-1.5 overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-label={`${pet.name} 오늘 루틴 진행률`} aria-valuemin={0} aria-valuemax={todayTasks.length} aria-valuenow={completedTaskCount}>
                              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.round((completedTaskCount / todayTasks.length) * 100)}%` }} />
                            </div>
                            <ul className="mt-2 space-y-1 text-xs text-app-muted">
                              {todayTasks.slice(0, 3).map((task) => (
                                <li className="flex min-w-0 items-center gap-2" key={task.id}><i className={`size-1.5 shrink-0 rounded-full ${task.status === 'completed' ? 'bg-brand-600' : 'border border-app-muted bg-transparent'}`} aria-hidden="true" /><span className={task.status === 'completed' ? 'truncate line-through opacity-70' : 'truncate'}>{task.label}</span></li>
                              ))}
                            </ul>
                            {todayTasks.length > 3 ? <small className="mt-1 block text-xs text-app-muted">외 {todayTasks.length - 3}개</small> : null}
                          </>
                        ) : <p className="text-xs text-app-muted">오늘 예정 없음</p>}
                      </div>
                    ) : null}
                  </button>
                  <div className="absolute right-1 top-1 sm:right-2 sm:top-2">
                    <button className="grid size-11 place-items-center rounded-full text-lg font-bold text-app-muted hover:bg-brand-50 hover:text-app-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" type="button" aria-label={`${pet.name} 메뉴 열기`} onClick={(event) => { event.stopPropagation(); setMenuPetId(menuPetId === pet.id ? null : pet.id) }}>⋯</button>
                    {menuPetId === pet.id ? (
                      <div className="absolute right-0 top-10 z-20 min-w-28 overflow-hidden rounded-control border border-app-border bg-app-surface py-1 shadow-lg">
                        <button className="flex h-10 w-full items-center gap-2 px-4 text-left text-sm text-app-ink hover:bg-brand-50 focus-visible:outline-none focus-visible:bg-brand-50" type="button" onClick={() => { setMenuPetId(null); onEditPet(pet) }}><PetIcon name="edit" className="size-4"/>수정</button>
                        <button className="flex h-10 w-full items-center gap-2 px-4 text-left text-sm text-app-danger hover:bg-red-50 focus-visible:outline-none focus-visible:bg-red-50" type="button" onClick={() => { setMenuPetId(null); requestDelete(pet) }}><PetIcon name="delete" className="size-4"/>삭제</button>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        )}
        {pets.length > 0 ? (
          <button className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand-700 px-5 text-base font-bold text-white transition-colors hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" type="button" onClick={onRegisterPet}>
            <PetIcon name="add" className="size-5" />
            <span>펫 추가</span>
          </button>
        ) : null}
      </section>
    </section>
  )
}
