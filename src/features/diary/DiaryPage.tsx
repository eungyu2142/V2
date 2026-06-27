import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { mockPets, mockRecords, toDateKey } from './mockDiaryData'
import type { AnimalCategory, Pet, PetRecord, PetRecordType } from './diaryTypes'
import './DiaryPage.css'

type RecordDraft = {
  type: PetRecordType
  memo: string
  photoUrl?: string
  foods: string[]
  customFood: string
  weight: number
  status: string
  cleaningScope: string
  hospitalId: string
  reviewId: string
}

const recordMeta: Record<PetRecordType, { label: string; icon: string; summary: string }> = {
  food: { label: '먹이', icon: '🍽️', summary: '귀뚜라미 3마리' },
  weight: { label: '무게', icon: '⚖️', summary: '42.1g' },
  shed: { label: '탈피', icon: '🦎', summary: '탈피 확인' },
  poop: { label: '배변', icon: '💩', summary: '정상' },
  cleaning: { label: '청소', icon: '🧽', summary: '사육장 청소' },
  hospital: { label: '병원', icon: '🏥', summary: '병원 방문 기록' },
  other: { label: '기타', icon: '✨', summary: '메모' },
}

const categoryLabels: Record<AnimalCategory, string> = {
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
  unknown: '미분류',
}

const genderIcons = {
  male: '♂',
  female: '♀',
  unknown: '•',
}

const recordTypes: PetRecordType[] = ['food', 'weight', 'shed', 'poop', 'cleaning', 'hospital', 'other']
const foodOptions = ['귀뚜라미', '밀웜', '채소', '사료', '기타']
const shedStatuses = ['시작', '완료', '부분 탈피', '이상 있음']
const poopStatuses = ['정상', '묽음', '없음', '이상 있음']
const cleaningScopes = ['전체 청소', '부분 청소', '물그릇', '바닥재']

export default function DiaryPage() {
  const todayKey = toDateKey(new Date())
  const [selectedPetId, setSelectedPetId] = useState(mockPets[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()))
  const [records, setRecords] = useState<PetRecord[]>(mockRecords)
  const [petPanelOpen, setPetPanelOpen] = useState(false)
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [formType, setFormType] = useState<PetRecordType | null>(null)

  const selectedPet = mockPets.find((pet) => pet.id === selectedPetId) ?? mockPets[0]
  const selectedRecords = useMemo(
    () => records.filter((record) => record.petId === selectedPetId && record.date === selectedDate),
    [records, selectedDate, selectedPetId],
  )
  const selectedPetRecords = useMemo(() => records.filter((record) => record.petId === selectedPetId), [records, selectedPetId])
  const isFutureDate = selectedDate > todayKey

  const selectPet = (petId: string) => {
    setSelectedPetId(petId)
    setPetPanelOpen(false)
  }

  const openAddFlow = () => {
    if (!isFutureDate) setTypeSheetOpen(true)
  }

  const selectRecordType = (type: PetRecordType) => {
    setTypeSheetOpen(false)
    setFormType(type)
  }

  const saveRecord = (draft: RecordDraft) => {
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId: selectedPet.userId,
      petId: selectedPet.id,
      type: draft.type,
      date: selectedDate,
      memo: buildRecordMemo(draft),
      photoUrl: draft.photoUrl,
      weight: draft.type === 'weight' ? draft.weight : undefined,
      foods: draft.type === 'food' ? [...draft.foods, draft.customFood].filter(Boolean) : undefined,
      hospitalId: draft.type === 'hospital' ? draft.hospitalId || undefined : undefined,
      reviewId: draft.type === 'hospital' ? draft.reviewId || undefined : undefined,
      createdAt: new Date().toISOString(),
    }
    setRecords((items) => [record, ...items])
    setFormType(null)
  }

  return (
    <section className="diary-page">
      <MobileDiaryLayout
        selectedPet={selectedPet}
        selectedDate={selectedDate}
        visibleMonth={visibleMonth}
        records={selectedRecords}
        petRecords={selectedPetRecords}
        isFutureDate={isFutureDate}
        onOpenPetPanel={() => setPetPanelOpen(true)}
        onMoveMonth={(amount) => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1))}
        onSelectDate={setSelectedDate}
        onAdd={openAddFlow}
      />
      <DesktopDiaryLayout
        pets={mockPets}
        selectedPet={selectedPet}
        selectedPetId={selectedPetId}
        selectedDate={selectedDate}
        visibleMonth={visibleMonth}
        records={selectedRecords}
        petRecords={selectedPetRecords}
        isFutureDate={isFutureDate}
        onSelectPet={setSelectedPetId}
        onMoveMonth={(amount) => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1))}
        onSelectDate={setSelectedDate}
        onAdd={openAddFlow}
      />

      <SidePanel open={petPanelOpen} onClose={() => setPetPanelOpen(false)}>
        <PetSelectorPanel pets={mockPets} selectedPetId={selectedPetId} onSelectPet={selectPet} />
      </SidePanel>
      <RecordTypeBottomSheet open={typeSheetOpen} onClose={() => setTypeSheetOpen(false)} onSelect={selectRecordType} />
      <RecordFormSheet
        key={`${formType ?? 'none'}-${selectedPet.id}-${selectedPet.weight ?? 0}`}
        type={formType}
        date={selectedDate}
        selectedPet={selectedPet}
        onClose={() => setFormType(null)}
        onSave={saveRecord}
      />
    </section>
  )
}

function MobileDiaryLayout({
  selectedPet,
  selectedDate,
  visibleMonth,
  records,
  petRecords,
  isFutureDate,
  onOpenPetPanel,
  onMoveMonth,
  onSelectDate,
  onAdd,
}: {
  selectedPet: Pet
  selectedDate: string
  visibleMonth: Date
  records: PetRecord[]
  petRecords: PetRecord[]
  isFutureDate: boolean
  onOpenPetPanel: () => void
  onMoveMonth: (amount: number) => void
  onSelectDate: (date: string) => void
  onAdd: () => void
}) {
  return (
    <div className="diary-mobile">
      <DiaryHeader selectedPet={selectedPet} onOpenPetPanel={onOpenPetPanel} />
      <main className="diary-mobile-main">
        <CalendarMonth
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          records={petRecords}
          onMoveMonth={onMoveMonth}
          onSelectDate={onSelectDate}
        />
        <RecordList date={selectedDate} records={records} isFutureDate={isFutureDate} />
      </main>
      {!isFutureDate && <FloatingAddButton onClick={onAdd} />}
    </div>
  )
}

function DesktopDiaryLayout({
  pets,
  selectedPet,
  selectedPetId,
  selectedDate,
  visibleMonth,
  records,
  petRecords,
  isFutureDate,
  onSelectPet,
  onMoveMonth,
  onSelectDate,
  onAdd,
}: {
  pets: Pet[]
  selectedPet: Pet
  selectedPetId: string
  selectedDate: string
  visibleMonth: Date
  records: PetRecord[]
  petRecords: PetRecord[]
  isFutureDate: boolean
  onSelectPet: (petId: string) => void
  onMoveMonth: (amount: number) => void
  onSelectDate: (date: string) => void
  onAdd: () => void
}) {
  return (
    <div className="diary-desktop">
      <aside className="diary-desktop-pets">
        <PetSelectorPanel pets={pets} selectedPetId={selectedPetId} onSelectPet={onSelectPet} />
      </aside>
      <main className="diary-desktop-calendar">
        <DiaryHeader selectedPet={selectedPet} />
        <CalendarMonth
          visibleMonth={visibleMonth}
          selectedDate={selectedDate}
          records={petRecords}
          onMoveMonth={onMoveMonth}
          onSelectDate={onSelectDate}
        />
      </main>
      <aside className="diary-desktop-records">
        <RecordList date={selectedDate} records={records} isFutureDate={isFutureDate} />
        {!isFutureDate && <FloatingAddButton inline onClick={onAdd} />}
      </aside>
    </div>
  )
}

function DiaryHeader({ selectedPet, onOpenPetPanel }: { selectedPet: Pet; onOpenPetPanel?: () => void }) {
  return (
    <header className="diary-header">
      <button className="diary-pet-trigger" type="button" onClick={onOpenPetPanel ?? undefined}>
        <span className="diary-pet-avatar">{selectedPet.emoji ?? '🐾'}</span>
        <span>
          <strong>{selectedPet.name}</strong>
          <small>{selectedPet.species}</small>
        </span>
        {onOpenPetPanel && <span aria-hidden="true">⌄</span>}
      </button>
      <button className="diary-profile" type="button" aria-label="프로필">ME</button>
    </header>
  )
}

function PetSelectorPanel({ pets, selectedPetId, onSelectPet }: { pets: Pet[]; selectedPetId: string; onSelectPet: (petId: string) => void }) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const groupedPets = useMemo(() => groupPetsByCategory(pets), [pets])
  const useGroups = pets.length >= 6

  return (
    <section className="pet-panel">
      <div className="pet-panel-current">
        <span>{selectedPet.emoji ?? '🐾'}</span>
        <div>
          <strong>{selectedPet.name}</strong>
          <small>{selectedPet.species}</small>
        </div>
        <button type="button" aria-label="편집" onClick={() => history.pushState(null, '', `/pets/${selectedPet.id}/edit`)}>✎</button>
      </div>

      <div className="pet-panel-list">
        {useGroups ? (
          Object.entries(groupedPets).map(([category, groupPets]) => (
            <details key={category} open={groupPets.some((pet) => pet.id === selectedPetId)}>
              <summary>{categoryLabels[category as AnimalCategory]}</summary>
              {groupPets.map((pet) => <PetListRow key={pet.id} pet={pet} selected={pet.id === selectedPetId} onClick={() => onSelectPet(pet.id)} />)}
            </details>
          ))
        ) : (
          pets.map((pet) => <PetListRow key={pet.id} pet={pet} selected={pet.id === selectedPetId} onClick={() => onSelectPet(pet.id)} />)
        )}
      </div>

      <div className="pet-panel-actions">
        <button type="button" onClick={() => history.pushState(null, '', '/pets')}>반려동물 관리하기</button>
        <button type="button" aria-label="펫 추가" onClick={() => history.pushState(null, '', '/pets/new')}>+</button>
      </div>
    </section>
  )
}

function PetListRow({ pet, selected, onClick }: { pet: Pet; selected: boolean; onClick: () => void }) {
  return (
    <button className={`pet-list-row ${selected ? 'selected' : ''}`} type="button" onClick={onClick}>
      <span className="pet-list-photo">{pet.emoji ?? '🐾'}</span>
      <span>
        <strong>{pet.name} <em>{genderIcons[pet.gender ?? 'unknown']}</em></strong>
        <small>{pet.species}</small>
      </span>
      {selected && <b aria-hidden="true">✓</b>}
    </button>
  )
}

function CalendarMonth({
  visibleMonth,
  selectedDate,
  records,
  onMoveMonth,
  onSelectDate,
}: {
  visibleMonth: Date
  selectedDate: string
  records: PetRecord[]
  onMoveMonth: (amount: number) => void
  onSelectDate: (date: string) => void
}) {
  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth])
  const recordDates = useMemo(() => new Set(records.map((record) => record.date)), [records])

  return (
    <section className="calendar-month" aria-label="월간 기록 달력">
      <div className="calendar-month-bar">
        <IconButton label="이전 달" onClick={() => onMoveMonth(-1)}>‹</IconButton>
        <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
        <IconButton label="다음 달" onClick={() => onMoveMonth(1)}>›</IconButton>
      </div>
      <div className="calendar-weekdays">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-days">
        {days.map((day) => {
          const dateKey = toDateKey(day)
          return (
            <CalendarDayCell
              key={dateKey}
              day={day}
              selected={dateKey === selectedDate}
              today={dateKey === toDateKey(new Date())}
              muted={day.getMonth() !== visibleMonth.getMonth()}
              hasRecord={recordDates.has(dateKey)}
              onClick={() => onSelectDate(dateKey)}
            />
          )
        })}
      </div>
    </section>
  )
}

function CalendarDayCell({ day, selected, today, muted, hasRecord, onClick }: { day: Date; selected: boolean; today: boolean; muted: boolean; hasRecord: boolean; onClick: () => void }) {
  return (
    <button className={`calendar-day-cell ${selected ? 'selected' : ''} ${today ? 'today' : ''} ${muted ? 'muted' : ''}`} type="button" onClick={onClick}>
      <span>{day.getDate()}</span>
      {hasRecord && <i aria-label="기록 있음" />}
    </button>
  )
}

function RecordList({ date, records, isFutureDate }: { date: string; records: PetRecord[]; isFutureDate: boolean }) {
  return (
    <section className="record-list-panel">
      <div className="record-list-title">
        <span>{formatDateLabel(date)}</span>
        <strong>기록 {records.length}</strong>
      </div>
      {isFutureDate ? (
        <EmptyRecordState title="미래 날짜에는 기록을 추가할 수 없어요" body="날짜 확인은 가능하지만 기록 작성은 오늘부터 과거까지만 가능해요." />
      ) : records.length === 0 ? (
        <EmptyRecordState title="아직 기록이 없어요" body="+ 버튼으로 기록을 남겨보세요" />
      ) : (
        <div className="record-list-rows">
          {records.map((record) => <RecordListItem key={record.id} record={record} />)}
        </div>
      )}
    </section>
  )
}

function RecordListItem({ record }: { record: PetRecord }) {
  const meta = recordMeta[record.type]
  return (
    <button className="record-list-item" type="button">
      <span>{meta.icon}</span>
      <span>
        <strong>{meta.label}</strong>
        <small>{record.memo || meta.summary}</small>
      </span>
      <time>{formatTime(record.createdAt)}</time>
      <b aria-hidden="true">›</b>
    </button>
  )
}

function RecordTypeBottomSheet({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (type: PetRecordType) => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="record-type-sheet">
        <span className="sheet-handle" />
        <h2>기록 추가</h2>
        <p>어떤 기록을 남길까요?</p>
        <div className="record-type-grid">
          {recordTypes.map((type) => (
            <button key={type} type="button" onClick={() => onSelect(type)}>
              <span>{recordMeta[type].icon}</span>
              <strong>{recordMeta[type].label}</strong>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

function RecordFormSheet({ type, date, selectedPet, onClose, onSave }: { type: PetRecordType | null; date: string; selectedPet: Pet; onClose: () => void; onSave: (draft: RecordDraft) => void }) {
  const [draft, setDraft] = useState<RecordDraft>(() => createDraft(type ?? 'food', selectedPet.weight ?? 0))
  const meta = type ? recordMeta[type] : null

  if (!type || !meta) return null

  const update = (patch: Partial<RecordDraft>) => setDraft((value) => ({ ...value, ...patch }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(draft)
  }

  return (
    <BottomSheet open onClose={onClose}>
      <form className="record-form-sheet" onSubmit={submit}>
        <span className="sheet-handle" />
        <h2>{meta.icon} {meta.label}</h2>
        <p>{date}</p>
        {type === 'food' && (
          <div className="form-section">
            <label>먹이 종류</label>
            <div className="chip-grid">
              {foodOptions.map((food) => (
                <Chip key={food} selected={draft.foods.includes(food)} onClick={() => toggleFood(draft, food, update)}>{food}</Chip>
              ))}
            </div>
            <input value={draft.customFood} onChange={(event) => update({ customFood: event.target.value })} placeholder="직접 입력" />
          </div>
        )}
        {type === 'weight' && (
          <div className="form-section">
            <label>현재 무게</label>
            <output className="weight-output">{draft.weight.toFixed(1)}g</output>
            <div className="weight-controls">
              {[0.1, 1, 5, -0.1, -1, -5].map((amount) => (
                <button key={amount} type="button" onClick={() => update({ weight: Math.max(0, draft.weight + amount) })}>
                  {amount > 0 ? '+' : ''}{amount}g
                </button>
              ))}
            </div>
          </div>
        )}
        {type === 'shed' && <SegmentedField label="상태" options={shedStatuses} value={draft.status} onChange={(status) => update({ status })} />}
        {type === 'poop' && <SegmentedField label="상태" options={poopStatuses} value={draft.status} onChange={(status) => update({ status })} />}
        {type === 'cleaning' && <SegmentedField label="청소 범위" options={cleaningScopes} value={draft.cleaningScope} onChange={(cleaningScope) => update({ cleaningScope })} />}
        {type === 'hospital' && (
          <div className="form-section">
            <label>병원</label>
            <input value={draft.hospitalId} onChange={(event) => update({ hospitalId: event.target.value })} placeholder="hospitalId 준비" />
            <input value={draft.reviewId} onChange={(event) => update({ reviewId: event.target.value })} placeholder="reviewId 준비" />
          </div>
        )}
        <label className="form-section">메모<textarea value={draft.memo} onChange={(event) => update({ memo: event.target.value })} placeholder="짧게 남기기" /></label>
        <label className="form-section">사진 1장<input type="file" accept="image/*" onChange={(event) => update({ photoUrl: getPhotoName(event) })} /></label>
        <details className="extra-fields">
          <summary>추가 입력</summary>
          <p>사진은 현재 파일명만 mock으로 저장됩니다.</p>
        </details>
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
          <Button type="submit">저장</Button>
        </div>
      </form>
    </BottomSheet>
  )
}

function FloatingAddButton({ inline = false, onClick }: { inline?: boolean; onClick: () => void }) {
  return <button className={`floating-add ${inline ? 'inline' : ''}`} type="button" aria-label="기록 추가" onClick={onClick}>+</button>
}

function EmptyRecordState({ title, body }: { title: string; body: string }) {
  return <EmptyState title={title} body={body} />
}

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="diary-overlay">
      <button className="diary-dim" type="button" aria-label="닫기" onClick={onClose} />
      <section className="bottom-sheet">{children}</section>
    </div>
  )
}

function SidePanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return undefined
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="diary-overlay">
      <button className="diary-dim" type="button" aria-label="닫기" onClick={onClose} />
      <aside className="side-panel">{children}</aside>
    </div>
  )
}

function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return <button className={`ui-button ${variant}`} {...props}>{children}</button>
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button className="ui-icon-button" type="button" aria-label={label} onClick={onClick}>{children}</button>
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className={`chip ${selected ? 'selected' : ''}`} type="button" onClick={onClick}>{children}</button>
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="diary-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function SegmentedField({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="form-section">
      <label>{label}</label>
      <div className="chip-grid">
        {options.map((option) => <Chip key={option} selected={value === option} onClick={() => onChange(option)}>{option}</Chip>)}
      </div>
    </div>
  )
}

function createDraft(type: PetRecordType, weight: number): RecordDraft {
  return {
    type,
    memo: '',
    foods: type === 'food' ? ['귀뚜라미'] : [],
    customFood: '',
    weight,
    status: type === 'shed' ? shedStatuses[0] : type === 'poop' ? poopStatuses[0] : '',
    cleaningScope: type === 'cleaning' ? cleaningScopes[0] : '',
    hospitalId: '',
    reviewId: '',
  }
}

function buildRecordMemo(draft: RecordDraft) {
  if (draft.memo.trim()) return draft.memo.trim()
  if (draft.type === 'food') return [...draft.foods, draft.customFood].filter(Boolean).join(', ') || recordMeta.food.summary
  if (draft.type === 'weight') return `${draft.weight.toFixed(1)}g`
  if (draft.type === 'shed' || draft.type === 'poop') return draft.status
  if (draft.type === 'cleaning') return draft.cleaningScope
  if (draft.type === 'hospital') return '병원 방문 기록'
  return '메모'
}

function toggleFood(draft: RecordDraft, food: string, update: (patch: Partial<RecordDraft>) => void) {
  update({ foods: draft.foods.includes(food) ? draft.foods.filter((item) => item !== food) : [...draft.foods, food] })
}

function getPhotoName(event: ChangeEvent<HTMLInputElement>) {
  return event.target.files?.[0]?.name
}

function groupPetsByCategory(pets: Pet[]) {
  return pets.reduce<Partial<Record<AnimalCategory, Pet[]>>>((groups, pet) => {
    groups[pet.category] = [...(groups[pet.category] ?? []), pet]
    return groups
  }, {})
}

function getCalendarDays(month: Date) {
  const firstDay = startOfMonth(month)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date))
}
