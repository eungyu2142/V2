import { useEffect, useMemo, useState } from 'react'
import { listCarePlans, listDailyTasks } from '../../features/diary/diaryService'
import type { CarePlan, DailyTask } from '../../features/diary/diaryTypes'

type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type Pet = {
  id: string
  name: string
  group: AnimalCategory
  species: string
  gender: 'male' | 'female' | 'unknown'
  photo?: string
  photoPosition?: { x: number; y: number }
  registeredAt?: string
}

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

function genderSymbol(value: Pet['gender']) {
  if (value === 'male') return '♂'
  if (value === 'female') return '♀'
  return ''
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
  onOpenDiary: (petId: string) => void
  onRegisterPet: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Array<'reptile' | 'amphibian'>>([])
  const [menuPetId, setMenuPetId] = useState<string | null>(null)
  const [todayTasksByPet, setTodayTasksByPet] = useState<Record<string, TodayTask[]>>({})
  const [routinePetIds, setRoutinePetIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let active = true
    const today = todayDateKey()

    Promise.all([
      listCarePlans(userId).catch(() => [] as CarePlan[]),
      listDailyTasks(userId, today, today).catch(() => [] as DailyTask[]),
    ]).then(([plans, tasks]) => {
      if (!active) return
      const plansById = new Map(plans.map((plan) => [plan.id, plan]))
      const taskPlanIds = new Set(tasks.map((task) => task.carePlanId).filter((id): id is string => Boolean(id)))
      const grouped = tasks.reduce<Record<string, TodayTask[]>>((result, task) => {
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

  return (
    <section className="page-stack my-pet-dashboard">
      <section className="section-block my-pet-tools my-pet-dashboard-panel">
        <label className="my-pet-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="펫 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예시) 크레스티드 게코" />
          {query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}>×</button>}
        </label>
        <div className="my-pet-filter-row">
          <div className="filter-tags" aria-label="동물 분류 필터">
            {visibleCategoryOptions.map((item) => (
              <button
                className={(item === 'all' ? selectedCategories.length === 0 : isVisiblePetCategory(item) && selectedCategories.includes(item)) ? 'active' : ''}
                type="button"
                key={item}
                onClick={() => toggleCategory(item)}
                aria-pressed={item === 'all' ? selectedCategories.length === 0 : isVisiblePetCategory(item) && selectedCategories.includes(item)}
              >
                <span>{animalCategoryLabels[item]}</span>
              </button>
            ))}
          </div>
          <button className="pet-add-icon" type="button" onClick={onRegisterPet} aria-label="펫 등록">+</button>
        </div>
      </section>

      <section className="section-block my-pet-section my-pet-dashboard-panel">
        <div className="pet-list-toolbar">
          <div className="section-title"><h2>등록된 펫</h2><span>{filteredPets.length}</span></div>
        </div>
        {filteredPets.length === 0 ? (
          <div className="pet-empty-state">
            <strong>{pets.length === 0 ? '아직 등록된 펫이 없어요' : '검색 결과가 없어요'}</strong>
            <p>{pets.length === 0 ? '관리할 반려동물을 먼저 등록해 주세요.' : '검색어 또는 분류를 다시 확인해 주세요.'}</p>
            {pets.length === 0 && <button type="button" onClick={onRegisterPet}>첫 펫 등록하기</button>}
          </div>
        ) : (
          <div className="pet-list card-view">
            {filteredPets.map((pet) => {
              const symbol = genderSymbol(pet.gender)
              const todayTasks = todayTasksByPet[pet.id] ?? []
              const completedTaskCount = todayTasks.filter((task) => task.status === 'completed').length
              const hasRoutineSummary = routinePetIds.has(pet.id) || todayTasks.length > 0
              return (
                <article className="pet-card pet-management-card pet-pick-card" key={pet.id}>
                  <button className={`pet-card-main pet-pick-card-main ${hasRoutineSummary ? 'has-today-tasks' : ''}`} type="button" aria-label={`${pet.name} 다이어리 열기`} onClick={() => onOpenDiary(pet.id)}>
                    <div className="pet-card-visual">
                      <div className="pet-card-icon">
                        {pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }} /> : <span className="pet-photo-initial" aria-label="사진 없음">{pet.name.trim().slice(0, 1) || '?'}</span>}
                      </div>
                    </div>
                    <div className="pet-card-body">
                      <div className="pet-card-identity">
                        <strong>{pet.name}{symbol && <span className={`pet-gender-symbol ${pet.gender}`} aria-label={pet.gender === 'male' ? '수컷' : '암컷'}>{symbol}</span>}</strong>
                        {pet.species && <small>{pet.species}</small>}
                      </div>
                    </div>
                    {hasRoutineSummary && (
                      <div className="pet-today-tasks">
                        <div className="pet-today-tasks-heading">
                          <strong>오늘 할 일</strong>
                          {todayTasks.length > 0 && <span>{completedTaskCount}/{todayTasks.length}</span>}
                        </div>
                        {todayTasks.length > 0 ? (
                          <>
                            <div
                              className="pet-today-progress"
                              role="progressbar"
                              aria-label={`${pet.name} 오늘 루틴 진행률`}
                              aria-valuemin={0}
                              aria-valuemax={todayTasks.length}
                              aria-valuenow={completedTaskCount}
                            >
                              <span style={{ width: `${Math.round((completedTaskCount / todayTasks.length) * 100)}%` }} />
                            </div>
                            <ul>
                              {todayTasks.slice(0, 3).map((task) => (
                                <li className={task.status} key={task.id}>
                                  <i aria-hidden="true" />
                                  <span>{task.label}</span>
                                </li>
                              ))}
                            </ul>
                            {todayTasks.length > 3 && <small>외 {todayTasks.length - 3}개</small>}
                          </>
                        ) : <p className="pet-today-empty">오늘 예정 없음</p>}
                      </div>
                    )}
                  </button>
                  <div className="pet-card-topline">
                    <button
                      className="pet-more-button"
                      type="button"
                      aria-label={`${pet.name} 메뉴 열기`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setMenuPetId(menuPetId === pet.id ? null : pet.id)
                      }}
                    >
                      ⋯
                    </button>
                    {menuPetId === pet.id && (
                      <div className="pet-more-menu">
                        <button type="button" onClick={() => { setMenuPetId(null); onEditPet(pet) }}>수정</button>
                        <button className="danger" type="button" onClick={() => { setMenuPetId(null); requestDelete(pet) }}>삭제</button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
