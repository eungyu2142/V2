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

type RecordCreateStep = 'detail' | 'memo' | 'photo'

const recordMeta: Record<PetRecordType, { label: string; summary: string }> = {
  food: { label: '먹이', summary: '귀뚜라미 3마리' },
  weight: { label: '무게', summary: '42.1g' },
  shed: { label: '탈피', summary: '탈피 확인' },
  poop: { label: '배변', summary: '정상' },
  cleaning: { label: '청소', summary: '사육장 청소' },
  hospital: { label: '병원', summary: '병원 방문 기록' },
  other: { label: '기타', summary: '메모' },
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

  const selectedPet = mockPets.find((pet) => pet.id === selectedPetId)
  const selectedRecords = useMemo(
    () => records.filter((record) => record.petId === selectedPetId && record.date === selectedDate),
    [records, selectedDate, selectedPetId],
  )
  const selectedPetRecords = useMemo(() => records.filter((record) => record.petId === selectedPetId), [records, selectedPetId])
  const isFutureDate = selectedDate > todayKey
  const hasPet = Boolean(selectedPet)

  const selectPet = (petId: string) => {
    setSelectedPetId(petId)
    setPetPanelOpen(false)
  }

  const openAddFlow = () => {
    if (hasPet && !isFutureDate) setTypeSheetOpen(true)
  }

  const selectRecordType = (type: PetRecordType) => {
    setTypeSheetOpen(false)
    setFormType(type)
  }

  const saveRecord = (draft: RecordDraft) => {
    if (!selectedPet) return
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
  const editRecord = (record: PetRecord) => {
    setSelectedDate(record.date)
    setFormType(record.type)
  }
  const deleteRecord = (recordId: string) => {
    setRecords((items) => items.filter((record) => record.id !== recordId))
  }

  if (formType && selectedPet) {
    return (
      <RecordCreateScreen
        key={`${formType}-${selectedPet.id}-${selectedDate}-${selectedPet.weight ?? 0}`}
        type={formType}
        date={selectedDate}
        selectedPet={selectedPet}
        onClose={() => setFormType(null)}
        onSave={saveRecord}
      />
    )
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
        onEditRecord={editRecord}
        onDeleteRecord={deleteRecord}
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
        onEditRecord={editRecord}
        onDeleteRecord={deleteRecord}
      />

      <SidePanel open={petPanelOpen} onClose={() => setPetPanelOpen(false)}>
        <PetSelectorPanel pets={mockPets} selectedPetId={selectedPetId} onSelectPet={selectPet} />
      </SidePanel>
      <RecordTypeBottomSheet open={typeSheetOpen} onClose={() => setTypeSheetOpen(false)} onSelect={selectRecordType} />
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
  onEditRecord,
  onDeleteRecord,
}: {
  selectedPet?: Pet
  selectedDate: string
  visibleMonth: Date
  records: PetRecord[]
  petRecords: PetRecord[]
  isFutureDate: boolean
  onOpenPetPanel: () => void
  onMoveMonth: (amount: number) => void
  onSelectDate: (date: string) => void
  onAdd: () => void
  onEditRecord: (record: PetRecord) => void
  onDeleteRecord: (recordId: string) => void
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
        <RecordList date={selectedDate} records={records} isFutureDate={isFutureDate} hasPet={Boolean(selectedPet)} onEditRecord={onEditRecord} onDeleteRecord={onDeleteRecord} />
      </main>
      {selectedPet && !isFutureDate && <FloatingAddButton onClick={onAdd} />}
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
  onEditRecord,
  onDeleteRecord,
}: {
  pets: Pet[]
  selectedPet?: Pet
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
  onEditRecord: (record: PetRecord) => void
  onDeleteRecord: (recordId: string) => void
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
        <RecordList date={selectedDate} records={records} isFutureDate={isFutureDate} hasPet={Boolean(selectedPet)} onEditRecord={onEditRecord} onDeleteRecord={onDeleteRecord} />
        {selectedPet && !isFutureDate && <FloatingAddButton inline onClick={onAdd} />}
      </aside>
    </div>
  )
}

function DiaryHeader({ selectedPet, onOpenPetPanel }: { selectedPet?: Pet; onOpenPetPanel?: () => void }) {
  return (
    <header className="diary-header">
      <button className="diary-pet-trigger" type="button" onClick={onOpenPetPanel}>
        <span className="diary-pet-avatar">{selectedPet ? <DiaryAnimalIcon category={selectedPet.category} /> : <span aria-hidden="true">+</span>}</span>
        <span>
          <strong>{selectedPet?.name ?? '반려동물 없음'}</strong>
          <small>{selectedPet?.species ?? '먼저 반려동물을 등록해주세요'}</small>
        </span>
        {onOpenPetPanel && <span aria-hidden="true">⌄</span>}
      </button>
    </header>
  )
}

function PetSelectorPanel({ pets, selectedPetId, onSelectPet }: { pets: Pet[]; selectedPetId: string; onSelectPet: (petId: string) => void }) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const groupedPets = useMemo(() => groupPetsByCategory(pets), [pets])
  const useGroups = pets.length >= 6

  return (
    <section className="pet-panel">
      <div className="pet-panel-current">
        <span className="pet-panel-icon">{selectedPet ? <DiaryAnimalIcon category={selectedPet.category} /> : <span aria-hidden="true">+</span>}</span>
        <div>
          <strong>{selectedPet?.name ?? '반려동물 없음'}</strong>
          <small>{selectedPet?.species ?? '등록 후 기록을 남길 수 있어요'}</small>
        </div>
      </div>

      <div className="pet-panel-list">
        {pets.length === 0 ? (
          <EmptyState title="등록된 반려동물이 없어요" body="내 펫 화면에서 반려동물을 먼저 등록해주세요." />
        ) : useGroups ? (
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
    </section>
  )
}

function PetListRow({ pet, selected, onClick }: { pet: Pet; selected: boolean; onClick: () => void }) {
  return (
    <button className={`pet-list-row ${selected ? 'selected' : ''}`} type="button" onClick={onClick}>
      <span className="pet-list-photo"><DiaryAnimalIcon category={pet.category} /></span>
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

function RecordList({
  date,
  records,
  isFutureDate,
  hasPet = true,
  onEditRecord,
  onDeleteRecord,
}: {
  date: string
  records: PetRecord[]
  isFutureDate: boolean
  hasPet?: boolean
  onEditRecord: (record: PetRecord) => void
  onDeleteRecord: (recordId: string) => void
}) {
  return (
    <section className="record-list-panel">
      <div className="record-list-title">
        <span>{formatDateLabel(date)}</span>
        <strong>기록 {records.length}</strong>
      </div>
      {!hasPet ? (
        <EmptyRecordState title="등록된 반려동물이 없어요" body="내 펫 화면에서 반려동물을 먼저 등록해주세요." />
      ) : isFutureDate ? (
        <EmptyRecordState title="미래 날짜에는 기록을 추가할 수 없어요" body="날짜 확인은 가능하지만 기록 작성은 오늘부터 과거까지만 가능해요." />
      ) : records.length === 0 ? (
        <EmptyRecordState title="아직 기록이 없어요" body="+ 버튼으로 기록을 남겨보세요" />
      ) : (
        <div className="record-list-rows">
          {records.map((record) => <RecordListItem key={record.id} record={record} onEdit={() => onEditRecord(record)} onDelete={() => onDeleteRecord(record.id)} />)}
        </div>
      )}
    </section>
  )
}

function RecordListItem({ record, onEdit, onDelete }: { record: PetRecord; onEdit: () => void; onDelete: () => void }) {
  const meta = recordMeta[record.type]
  return (
    <div className="record-list-item">
      <RecordTypeIcon type={record.type} />
      <span>
        <strong>{meta.label}</strong>
        <small>{record.memo || meta.summary}</small>
      </span>
      <time>{formatTime(record.createdAt)}</time>
      <RecordItemActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function RecordItemActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="record-item-actions">
      <button className="record-item-action" type="button" aria-label="수정" onClick={onEdit}>
        <span className="record-action-icon edit" aria-hidden="true" />
      </button>
      <button className="record-item-action danger" type="button" aria-label="삭제" onClick={onDelete}>
        <span className="record-action-icon delete" aria-hidden="true" />
      </button>
    </div>
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
              <RecordTypeIcon type={type} />
              <strong>{recordMeta[type].label}</strong>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

function RecordCreateScreen({ type, date, selectedPet, onClose, onSave }: { type: PetRecordType; date: string; selectedPet: Pet; onClose: () => void; onSave: (draft: RecordDraft) => void }) {
  const [draft, setDraft] = useState<RecordDraft>(() => createDraft(type, selectedPet.weight ?? 0))
  const [stepIndex, setStepIndex] = useState(0)
  const meta = recordMeta[type]
  const steps = getRecordCreateSteps(type)
  const currentStep = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const canGoNext = currentStep !== 'detail' || canSaveDetailStep(draft)

  const update = (patch: Partial<RecordDraft>) => setDraft((value) => ({ ...value, ...patch }))

  const goBack = () => {
    if (stepIndex === 0) {
      onClose()
      return
    }
    setStepIndex((value) => value - 1)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLastStep) {
      setStepIndex((value) => value + 1)
      return
    }
    onSave(draft)
  }

  return (
    <main className="record-create-screen">
      <header className="record-create-header">
        <button type="button" aria-label="뒤로가기" onClick={goBack}>←</button>
        <strong>기록 작성</strong>
      </header>
      <form className="record-form-sheet" onSubmit={submit}>
        <div className="record-step-progress" aria-label={`${stepIndex + 1}/${steps.length}`}>
          <span style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="record-form-title">
          <h1><RecordTypeIcon type={type} /> {meta.label}</h1>
          <p>{selectedPet.name} · {date} · {stepIndex + 1}/{steps.length}</p>
        </div>
        {currentStep === 'detail' && type === 'food' && (
          <div className="form-section">
            <label>먹이 종류를 선택하세요</label>
            <div className="chip-grid">
              {foodOptions.map((food) => (
                <Chip key={food} selected={draft.foods.includes(food)} onClick={() => toggleFood(draft, food, update)}>{food}</Chip>
              ))}
            </div>
            <input value={draft.customFood} onChange={(event) => update({ customFood: event.target.value })} placeholder="직접 입력" />
          </div>
        )}
        {currentStep === 'detail' && type === 'weight' && (
          <div className="form-section">
            <label>현재 무게를 입력하세요</label>
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
        {currentStep === 'detail' && type === 'shed' && <SegmentedField label="탈피 상태를 선택하세요" options={shedStatuses} value={draft.status} onChange={(status) => update({ status })} />}
        {currentStep === 'detail' && type === 'poop' && <SegmentedField label="배변 상태를 선택하세요" options={poopStatuses} value={draft.status} onChange={(status) => update({ status })} />}
        {currentStep === 'detail' && type === 'cleaning' && <SegmentedField label="청소 범위를 선택하세요" options={cleaningScopes} value={draft.cleaningScope} onChange={(cleaningScope) => update({ cleaningScope })} />}
        {currentStep === 'detail' && type === 'hospital' && (
          <div className="form-section">
            <label>병원을 연결하세요</label>
            <input value={draft.hospitalId} onChange={(event) => update({ hospitalId: event.target.value })} placeholder="hospitalId 준비" />
            <input value={draft.reviewId} onChange={(event) => update({ reviewId: event.target.value })} placeholder="reviewId 준비" />
          </div>
        )}
        {currentStep === 'memo' && <label className="form-section">메모를 입력하세요<textarea autoFocus value={draft.memo} onChange={(event) => update({ memo: event.target.value })} placeholder="짧게 남기기" /></label>}
        {currentStep === 'photo' && (
          <label className="form-section">
            사진 1장을 추가하세요
            <input type="file" accept="image/*" onChange={(event) => update({ photoUrl: getPhotoName(event) })} />
            <small>{draft.photoUrl ? draft.photoUrl : '사진은 선택하지 않아도 저장할 수 있어요.'}</small>
          </label>
        )}
        <div className="form-actions">
          <Button type="submit" disabled={!canGoNext}>{isLastStep ? '저장' : '다음'}</Button>
        </div>
      </form>
    </main>
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

function DiaryAnimalIcon({ category }: { category: AnimalCategory }) {
  const iconCategory = category === 'reptile' || category === 'amphibian' || category === 'rodent' || category === 'bird' ? category : 'all'
  return <span className={`animal-icon animal-icon-${iconCategory}`} aria-hidden="true"><span /></span>
}

function RecordTypeIcon({ type }: { type: PetRecordType }) {
  return <span className={`record-line-icon record-line-icon-${type}`} aria-hidden="true"><span /></span>
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

function getRecordCreateSteps(type: PetRecordType): RecordCreateStep[] {
  return type === 'other' ? ['memo', 'photo'] : ['detail', 'memo', 'photo']
}

function canSaveDetailStep(draft: RecordDraft) {
  if (draft.type === 'food') return draft.foods.length > 0 || draft.customFood.trim().length > 0
  return true
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
