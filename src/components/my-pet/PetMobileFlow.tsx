import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { Pet } from '../../types/app'

export type PetMobileView = 'main' | 'detail' | 'records' | 'growth' | 'routines'

type Props = {
  pets: Pet[]
  selectedPetId: string
  view: PetMobileView
  tasks: DailyTask[]
  plans: CarePlan[]
  records: PetRecord[]
  onSelectPet: (id: string) => void
  onView: (view: PetMobileView) => void
  onRegisterPet: () => void
  onEditPet: (pet: Pet) => void
  onOpenDiary: (petId: string, action?: 'routine-create') => void
}

const routineLabels: Record<string, string> = { feed: '먹이 주기', mist: '분무', water: '물그릇 교체', weight: '무게 측정', humidity: '습도 확인', temperature: '온도 확인', cleaning: '청소', partial_cleaning: '청소(부분)', medicine: '약', hospital: '병원 방문' }
const recordLabels: Record<string, string> = { food: '먹이', water: '물그릇', cleaning: '청소', temperature: '온도', humidity: '습도', weight: '무게', poop: '배변', shed: '탈피', mating: '메이팅', egg: '산란', medicine: '약', hospital: '병원' }

const recordSummary = (record: PetRecord) => {
  if (record.weight !== undefined) return `${record.weight}g`
  if (record.environmentRecord) return `${record.environmentRecord.value}${record.environmentRecord.unit}`
  if (record.feedingFoods?.length) return record.feedingFoods.map((food) => food.foodName).join(' · ')
  if (record.foods?.length) return record.foods.join(' · ')
  return record.memo || '기록됨'
}

const dateLabel = (value: string) => value.replaceAll('-', '.')

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="flex h-14 items-center border-b border-app-border"><button className="grid size-10 place-items-center text-xl" type="button" aria-label="뒤로가기" onClick={onBack}>‹</button><h1 className="m-0 flex-1 pr-10 text-center text-base font-bold">{title}</h1></header>
}

export default function PetMobileFlow({ pets, selectedPetId, view, tasks, plans, records, onSelectPet, onView, onRegisterPet, onEditPet, onOpenDiary }: Props) {
  const pet = pets.find((item) => item.id === selectedPetId) ?? pets[0]
  if (!pet) return <main className="px-4 pb-24"><header className="flex h-14 items-center justify-between"><h1 className="text-xl font-bold">마이 펫</h1><button type="button" onClick={onRegisterPet}>＋</button></header><button className="mt-12 h-12 w-full rounded-control bg-brand-600 font-bold text-white" type="button" onClick={onRegisterPet}>첫 펫 추가하기</button></main>
  const petTasks = tasks.filter((task) => task.petId === pet.id)
  const petPlans = plans.filter((plan) => plan.petId === pet.id && plan.isActive)
  const petRecords = records.filter((record) => record.petId === pet.id).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  const completed = petTasks.filter((task) => task.status === 'completed').length
  const rate = petTasks.length ? Math.round(completed / petTasks.length * 100) : 0

  if (view === 'records') return <main className="mx-auto w-full max-w-[430px] px-4 pb-24"><BackHeader title="기록 목록" onBack={() => onView('detail')} /><div className="mt-3 flex gap-2">{['전체', '루틴', '상황'].map((label, index) => <span className={`rounded-full px-4 py-2 text-xs font-bold ${index === 0 ? 'bg-brand-600 text-white' : 'bg-app-surface text-app-muted'}`} key={label}>{label}</span>)}</div><div className="mt-4 divide-y divide-app-border">{petRecords.map((record) => <article className="grid grid-cols-[4.8rem_minmax(0,1fr)_3rem] items-center gap-2 py-3" key={record.id}><time className="text-xs text-app-muted">{dateLabel(record.date)}</time><span className="grid"><strong className="text-sm">{recordLabels[record.type] ?? '기록'}</strong><small className="truncate text-xs text-app-muted">{recordSummary(record)}</small></span>{record.photoUrl && <img className="size-11 rounded-md object-cover" src={record.photoUrl} alt="" />}</article>)}</div><button className="mt-5 h-12 w-full rounded-control bg-brand-600 font-bold text-white" type="button" onClick={() => onOpenDiary(pet.id)}>＋ 기록 추가</button></main>

  if (view === 'growth') {
    const weights = petRecords.filter((record) => record.type === 'weight' && record.weight !== undefined).slice().reverse()
    const max = Math.max(...weights.map((record) => record.weight ?? 0), 1)
    const points = weights.slice(-8).map((record, index, items) => `${items.length === 1 ? 50 : index / (items.length - 1) * 100},${92 - (record.weight ?? 0) / max * 72}`).join(' ')
    return <main className="mx-auto w-full max-w-[430px] px-4 pb-24"><BackHeader title="성장 그래프" onBack={() => onView('detail')} /><div className="mt-4 flex justify-between"><select className="h-10 rounded-control border border-app-border bg-app-surface px-3"><option>체중</option></select><div className="flex rounded-full bg-brand-50 p-1 text-xs"><b className="rounded-full bg-brand-600 px-3 py-2 text-white">1개월</b><span className="px-3 py-2">전체</span></div></div><section className="mt-5 border-y border-app-border py-5"><svg className="h-48 w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="체중 변화 그래프"><polyline fill="none" stroke="var(--color-primary-600)" strokeWidth="2" points={points} /></svg></section><h2 className="mt-5 text-base font-bold">최근 측정</h2><div className="divide-y divide-app-border">{weights.slice().reverse().slice(0, 8).map((record) => <div className="flex justify-between py-3 text-sm" key={record.id}><span>{dateLabel(record.date)}</span><strong>{record.weight}g</strong></div>)}</div></main>
  }

  if (view === 'routines') return <main className="mx-auto w-full max-w-[430px] px-4 pb-24"><BackHeader title="루틴 관리" onBack={() => onView('detail')} /><div className="mt-3 divide-y divide-app-border rounded-card border border-app-border bg-app-surface px-3">{petPlans.map((plan) => <article className="flex min-h-12 items-center gap-3" key={plan.id}><span className="flex-1 text-sm font-semibold">{plan.title || routineLabels[plan.taskType] || plan.taskType}</span><small className="text-app-muted">{plan.notificationTime}</small><i className="not-italic text-app-muted">≡</i></article>)}</div><button className="mt-5 h-12 w-full rounded-control border border-brand-600 font-bold text-brand-700" type="button" onClick={() => onOpenDiary(pet.id, 'routine-create')}>＋ 루틴 추가</button></main>

  if (view === 'detail') return <main className="mx-auto w-full max-w-[430px] pb-24"><BackHeader title="펫 상세" onBack={() => onView('main')} /><div className="relative h-48 overflow-hidden bg-brand-50">{pet.photo ? <img className="size-full object-cover" src={pet.photo} alt={`${pet.name} 사진`} style={{ objectPosition: `${pet.photoPosition?.x ?? 50}% ${pet.photoPosition?.y ?? 50}%` }} /> : null}</div><section className="mx-4 -mt-5 relative rounded-card border border-app-border bg-app-surface p-4"><button className="absolute right-3 top-3 text-xs font-bold text-brand-700" type="button" onClick={() => onEditPet(pet)}>편집</button><h1 className="m-0 text-xl font-bold">{pet.name} {pet.gender === 'male' ? '♂' : pet.gender === 'female' ? '♀' : ''}</h1><p className="mt-1 text-sm text-app-muted">{pet.species}</p><div className="mt-4 grid grid-cols-4 gap-2">{[['기록 보기','records'],['성장 그래프','growth'],['루틴 관리','routines'],['더보기','main']].map(([label, destination]) => <button className="grid min-h-16 place-items-center rounded-control border border-app-border text-xs font-semibold" type="button" onClick={() => onView(destination as PetMobileView)} key={label}>{label}</button>)}</div></section><section className="mx-4 mt-4"><div className="flex justify-between"><h2 className="text-base font-bold">최근 기록</h2><button className="text-xs text-brand-700" type="button" onClick={() => onView('records')}>전체 보기</button></div><div className="divide-y divide-app-border">{petRecords.slice(0,4).map((record) => <div className="grid grid-cols-[3.6rem_1fr_auto] gap-2 py-3 text-sm" key={record.id}><time>{record.date.slice(5).replace('-','/')}</time><span><strong>{recordLabels[record.type] ?? '기록'}</strong><small className="ml-2 text-app-muted">{recordSummary(record)}</small></span><small>{new Date(record.occurredAt ?? record.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div></section></main>

  return <main className="mx-auto w-full max-w-[430px] px-4 pb-24"><header className="flex h-14 items-center justify-between"><h1 className="m-0 text-xl font-bold">마이 펫</h1><button className="grid size-10 place-items-center text-xl" type="button" aria-label="펫 추가" onClick={onRegisterPet}>＋</button></header><div className="flex gap-3 overflow-x-auto pb-3">{pets.map((item) => <button className="grid shrink-0 place-items-center gap-1 text-xs" type="button" onClick={() => onSelectPet(item.id)} key={item.id}><span className={`size-14 overflow-hidden rounded-full border-2 ${item.id === pet.id ? 'border-brand-600' : 'border-app-border'}`}>{item.photo && <img className="size-full object-cover" src={item.photo} alt="" />}</span><strong>{item.name}</strong><small className="max-w-16 truncate text-app-muted">{item.species}</small></button>)}<button className="grid shrink-0 place-items-center gap-1 text-xs" type="button" onClick={onRegisterPet}><span className="grid size-14 place-items-center rounded-full border border-dashed border-app-muted text-xl">＋</span><strong>펫 추가</strong></button></div><button className="grid w-full grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-card border border-app-border bg-app-surface text-left" type="button" onClick={() => onView('detail')}><div className="h-36 bg-brand-50">{pet.photo && <img className="size-full object-cover" src={pet.photo} alt="" />}</div><span className="grid content-center gap-1 p-4"><strong className="text-lg">{pet.name} {pet.gender === 'male' ? '♂' : pet.gender === 'female' ? '♀' : ''}</strong><small>{pet.species}</small><small className="text-app-muted">최근 기록 {petRecords[0]?.date ? dateLabel(petRecords[0].date) : '없음'}</small></span></button><section className="mt-4 rounded-card border border-app-border bg-app-surface p-4"><header className="flex justify-between"><h2 className="m-0 text-base font-bold">오늘 할 일</h2><button className="text-xs text-brand-700" type="button" onClick={() => onOpenDiary(pet.id)}>전체 보기</button></header>{petTasks.length ? <ul className="mt-2 divide-y divide-app-border">{petTasks.slice(0,3).map((task) => <li className="flex justify-between py-2 text-sm" key={task.id}><span>{routineLabels[task.taskType.split('|')[0]] ?? task.taskType}</span><b className={task.status === 'completed' ? 'text-brand-600' : 'text-app-muted'}>{task.status === 'completed' ? '✓' : '□'}</b></li>)}</ul> : <p className="mt-3 text-sm text-app-muted">오늘 예정된 관리가 없어요.</p>}</section><section className="mt-4"><div className="flex justify-between text-sm"><h2 className="m-0 text-base font-bold">이번 주 케어 달성률</h2><strong>{rate}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100"><span className="block h-full bg-brand-600" style={{width:`${rate}%`}} /></div></section></main>
}
