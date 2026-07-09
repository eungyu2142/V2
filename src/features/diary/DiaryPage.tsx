import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import { deleteAppData, loadAppData, saveAppData } from '../../lib/appData'
import type { PetRecord, PetRecordType } from './diaryTypes'
import { toDateKey } from './mockDiaryData'
import './DiaryPage.css'

export type DiaryPet = {
  id: string
  name: string
  group: 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
  species: string
  gender: 'male' | 'female' | 'unknown'
}

type ReminderType = 'feed' | 'medicine' | 'cleaning' | 'other'

type Reminder = {
  id: string
  petId: string
  title: string
  reminderType: ReminderType
  scheduleType: 'repeat' | 'once'
  weekdays: number[]
  reminderDate: string
  reminderTime: string
  memo: string
  isActive: boolean
  createdAt: string
}

type RecordDraft = {
  type: PetRecordType
  foods: string[]
  customFood: string
  weight: string
  status: string
  hospital: string
  memo: string
  photo?: string
}

const recordTypes: PetRecordType[] = ['food', 'weight', 'shed', 'poop', 'cleaning', 'hospital', 'other']

const recordMeta: Record<PetRecordType, { label: string; icon: string }> = {
  food: { label: '먹이', icon: '🍽' },
  weight: { label: '무게', icon: '⚖️' },
  shed: { label: '탈피', icon: '🌀' },
  poop: { label: '배변', icon: '💩' },
  cleaning: { label: '청소', icon: '🧹' },
  hospital: { label: '병원', icon: '🏥' },
  other: { label: '기록', icon: '📝' },
}

const reminderMeta: Record<ReminderType, { label: string; icon: string }> = {
  feed: { label: '먹이', icon: '🍽' },
  medicine: { label: '약', icon: '💊' },
  cleaning: { label: '청소', icon: '🧹' },
  other: { label: '기타', icon: '🔔' },
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export default function DiaryPage({
  userId,
  pets,
  onAddPet,
}: {
  userId: string
  pets: DiaryPet[]
  onAddPet: () => void
}) {
  const today = toDateKey(new Date())
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(today)
  const [visibleMonth, setVisibleMonth] = useState(new Date())
  const [records, setRecords] = useState<PetRecord[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [createType, setCreateType] = useState<PetRecordType | null>(null)
  const [reminderFormOpen, setReminderFormOpen] = useState(false)
  const [petWarningOpen, setPetWarningOpen] = useState(false)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const effectivePetId = selectedPet?.id ?? ''
  const petRecords = records.filter((record) => record.petId === effectivePetId)
  const dayRecords = petRecords.filter((record) => record.date === selectedDate)
  const petReminders = reminders.filter((reminder) => reminder.petId === effectivePetId && reminder.isActive)
  const dayReminders = petReminders.filter((reminder) => reminderOccursOn(reminder, parseDateKey(selectedDate)))

  useEffect(() => {
    let active = true
    Promise.all([
      loadAppData<PetRecord>('care_records').catch(() => []),
      loadAppData<Reminder>('feeding_reminders').catch(() => []),
    ]).then(([nextRecords, nextReminders]) => {
      if (!active) return
      setRecords(nextRecords)
      setReminders(nextReminders)
    })
    return () => {
      active = false
    }
  }, [userId])

  const saveRecordList = (next: PetRecord[]) => {
    const removed = records.find((record) => !next.some((item) => item.id === record.id))
    const added = next.find((record) => !records.some((item) => item.id === record.id))
    setRecords(next)
    if (removed) void deleteAppData('care_records', removed.id)
    if (added) {
      void saveAppData('care_records', userId, added, {
        pet_id: added.petId,
        record_date: added.date,
        record_type: added.type,
        memo: added.memo ?? '',
      })
    }
  }

  const saveReminderList = (next: Reminder[]) => {
    const removed = reminders.find((reminder) => !next.some((item) => item.id === reminder.id))
    const added = next.find((reminder) => !reminders.some((item) => item.id === reminder.id))
    setReminders(next)
    if (removed) void deleteAppData('feeding_reminders', removed.id)
    if (added) void saveAppData('feeding_reminders', userId, added, { pet_id: added.petId })
  }

  const openRecordTypes = () => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    if (selectedDate <= today) setTypeSheetOpen(true)
  }

  if (createType && selectedPet) {
    return (
      <RecordCreateScreen
        pet={selectedPet}
        type={createType}
        date={selectedDate}
        onBack={() => setCreateType(null)}
        onSave={(draft) => {
          const record: PetRecord = {
            id: crypto.randomUUID(),
            userId,
            petId: selectedPet.id,
            type: draft.type,
            date: selectedDate,
            memo: getRecordMemo(draft),
            photoUrl: draft.photo,
            weight: draft.type === 'weight' ? Number(draft.weight) : undefined,
            foods: draft.type === 'food' ? [...draft.foods, draft.customFood].filter(Boolean) : undefined,
            createdAt: new Date().toISOString(),
          }
          saveRecordList([record, ...records])
          setCreateType(null)
        }}
      />
    )
  }

  if (reminderFormOpen && selectedPet) {
    return (
      <ReminderCreateScreen
        pet={selectedPet}
        onBack={() => setReminderFormOpen(false)}
        onSave={(reminder) => {
          saveReminderList([reminder, ...reminders])
          setReminderFormOpen(false)
        }}
      />
    )
  }

  return (
    <section className="diary-page">
      <div className="diary-pet-bar">
        <div className="diary-pet-profile">
          <span className="diary-pet-avatar">{selectedPet ? animalIcon(selectedPet.group) : '+'}</span>
          <span>
            <strong>{selectedPet?.name ?? '등록된 펫이 없어요'}</strong>
            <small>{selectedPet ? `${selectedPet.species} ${genderLabel(selectedPet.gender)}` : '펫을 먼저 등록해 주세요'}</small>
          </span>
        </div>
        {pets.length > 1 && (
          <select aria-label="반려동물 선택" value={effectivePetId} onChange={(event) => setSelectedPetId(event.target.value)}>
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
        )}
      </div>

      <div className="diary-workspace">
        <main className="diary-calendar-area">
          <Calendar
            month={visibleMonth}
            selectedDate={selectedDate}
            records={petRecords}
            reminders={petReminders}
            onMove={(amount) => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1))}
            onSelect={setSelectedDate}
          />
        </main>
        <aside className="diary-detail-panel">
          <section className="record-list-panel">
            <header>
              <h2>{formatDate(selectedDate)}</h2>
              <span>{dayRecords.length}개</span>
            </header>
            {selectedDate > today ? (
              <EmptyState title="미래 날짜에는 기록할 수 없어요" />
            ) : dayRecords.length ? (
              <div className="record-list">
                {dayRecords.map((record) => (
                  <article key={record.id}>
                    <span className="record-emoji">{recordMeta[record.type].icon}</span>
                    <div>
                      <strong>{recordMeta[record.type].label}</strong>
                      <p>{record.memo}</p>
                    </div>
                    <button aria-label="기록 삭제" title="삭제" onClick={() => saveRecordList(records.filter((item) => item.id !== record.id))}>×</button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="기록이 없어요" />
            )}
          </section>

          <section className="reminder-panel">
            <header>
              <h2>예정 알람</h2>
              <button type="button" onClick={() => selectedPet ? setReminderFormOpen(true) : setPetWarningOpen(true)}>+ 알람 추가</button>
            </header>
            {dayReminders.length ? (
              <div className="reminder-list">
                {dayReminders.map((reminder) => (
                  <article key={reminder.id}>
                    <span>{reminderMeta[reminder.reminderType].icon}</span>
                    <div>
                      <strong>{reminder.title}</strong>
                      <small>{formatReminderSchedule(reminder)}</small>
                      {reminder.memo && <p>{reminder.memo}</p>}
                    </div>
                    <button aria-label="알람 삭제" title="삭제" onClick={() => saveReminderList(reminders.filter((item) => item.id !== reminder.id))}>×</button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="이 날짜 알람 없음" />
            )}
          </section>
        </aside>
      </div>

      {!typeSheetOpen && selectedDate <= today && <button className="floating-add" aria-label="기록 추가" onClick={openRecordTypes}>+</button>}
      {typeSheetOpen && (
        <Overlay onClose={() => setTypeSheetOpen(false)}>
          <div className="record-type-sheet">
            <span className="sheet-handle" />
            <h2>기록 추가</h2>
            <p>어떤 기록을 남길까요?</p>
            <div className="record-type-grid">
              {recordTypes.map((type) => (
                <button key={type} onClick={() => { setTypeSheetOpen(false); setCreateType(type) }}>
                  <span>{recordMeta[type].icon}</span>
                  <strong>{recordMeta[type].label}</strong>
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}
      {petWarningOpen && (
        <Overlay onClose={() => setPetWarningOpen(false)}>
          <div className="warning-dialog">
            <h2>펫을 먼저 추가해 주세요</h2>
            <button onClick={onAddPet}>이동하기</button>
          </div>
        </Overlay>
      )}
    </section>
  )
}

function Calendar({
  month,
  selectedDate,
  records,
  reminders,
  onMove,
  onSelect,
}: {
  month: Date
  selectedDate: string
  records: PetRecord[]
  reminders: Reminder[]
  onMove: (amount: number) => void
  onSelect: (date: string) => void
}) {
  const days = useMemo(() => getCalendarDays(month), [month])
  return (
    <section className="calendar-month">
      <header className="calendar-month-bar">
        <button aria-label="이전 달" onClick={() => onMove(-1)}>‹</button>
        <strong>{month.getFullYear()}년 {month.getMonth() + 1}월</strong>
        <button aria-label="다음 달" onClick={() => onMove(1)}>›</button>
      </header>
      <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-days">
        {days.map((day) => {
          const key = toDateKey(day)
          const dayRecords = records.filter((record) => record.date === key)
          const reminderCount = reminders.filter((reminder) => reminderOccursOn(reminder, day)).length
          return (
            <button
              key={key}
              className={`calendar-day ${key === selectedDate ? 'selected' : ''} ${day.getMonth() !== month.getMonth() ? 'muted' : ''}`}
              onClick={() => onSelect(key)}
            >
              <span className="day-head">
                <span className="day-number">{day.getDate()}</span>
                {reminderCount > 0 && <span className="alarm-dot" title={`예정 알람 ${reminderCount}개`}>{reminderCount}</span>}
              </span>
              <span className="calendar-tags">
                {dayRecords.slice(0, 2).map((record) => (
                  <small key={record.id}>
                    <i>{recordMeta[record.type].icon}</i>
                    {recordMeta[record.type].label}
                  </small>
                ))}
                {dayRecords.length > 2 && <em>+{dayRecords.length - 2}</em>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function RecordCreateScreen({
  pet,
  type,
  date,
  onBack,
  onSave,
}: {
  pet: DiaryPet
  type: PetRecordType
  date: string
  onBack: () => void
  onSave: (draft: RecordDraft) => void
}) {
  const steps = type === 'other' ? ['memo', 'photo'] : ['detail', 'memo', 'photo']
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<RecordDraft>({ type, foods: [], customFood: '', weight: '', status: '', hospital: '', memo: '' })
  const current = steps[step]
  const update = (patch: Partial<RecordDraft>) => setDraft((value) => ({ ...value, ...patch }))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (step < steps.length - 1) setStep(step + 1)
    else onSave(draft)
  }
  return (
    <main className="diary-create-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={() => step ? setStep(step - 1) : onBack()}>←</button>
        <strong>기록 작성</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <div className="step-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="create-title">
          <h1>{recordMeta[type].icon} {recordMeta[type].label}</h1>
          <p>{pet.name} · {date} · {step + 1}/{steps.length}</p>
        </div>
        <div className="create-content">
          {current === 'detail' && <RecordDetail draft={draft} update={update} />}
          {current === 'memo' && <label>메모<textarea autoFocus value={draft.memo} onChange={(event) => update({ memo: event.target.value })} placeholder="기록할 내용을 입력하세요" /></label>}
          {current === 'photo' && <PhotoPicker value={draft.photo} onChange={(photo) => update({ photo })} />}
        </div>
        <button className="create-submit" disabled={current === 'detail' && !validateDetail(draft)}>{step === steps.length - 1 ? '작성 완료' : '다음'}</button>
      </form>
    </main>
  )
}

function RecordDetail({ draft, update }: { draft: RecordDraft; update: (patch: Partial<RecordDraft>) => void }) {
  if (draft.type === 'food') return <ChoiceField label="먹이 종류를 선택하거나 직접 입력하세요" options={['귀뚜라미', '밀웜', '채소', '사료', '기타']} values={draft.foods} multiple onChange={(foods) => update({ foods })} custom={draft.customFood} onCustom={(customFood) => update({ customFood })} />
  if (draft.type === 'weight') return <label>무게<input type="number" min="0" step="0.1" value={draft.weight} onChange={(event) => update({ weight: event.target.value })} placeholder="g 단위로 입력" /></label>
  if (draft.type === 'shed') return <ChoiceField label="탈피 상태를 선택하세요" options={['탈피 중', '탈피 완료', '부분 탈피', '이상 있음', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'poop') return <ChoiceField label="배변 상태를 선택하세요" options={['정상', '묽음', '없음', '이상 있음', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'cleaning') return <ChoiceField label="청소 범위를 선택하세요" options={['전체 청소', '부분 청소', '물그릇', '바닥재', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  return <label>병원<input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="병원 이름을 입력하세요" /></label>
}

function ReminderCreateScreen({ pet, onBack, onSave }: { pet: DiaryPet; onBack: () => void; onSave: (reminder: Reminder) => void }) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ReminderType>('feed')
  const [schedule, setSchedule] = useState<'repeat' | 'once'>('repeat')
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [memo, setMemo] = useState('')
  const valid = step === 0 ? title.trim().length > 0 : step === 1 ? Boolean(schedule === 'repeat' ? selectedWeekdays.length && time : date && time) : true
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    if (step < 2) {
      setStep(step + 1)
      return
    }
    onSave({
      id: crypto.randomUUID(),
      petId: pet.id,
      title: title.trim(),
      reminderType: type,
      scheduleType: schedule,
      weekdays: schedule === 'repeat' ? selectedWeekdays : [],
      reminderDate: schedule === 'once' ? date : '',
      reminderTime: time,
      memo: memo.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    })
  }
  return (
    <main className="diary-create-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={() => step ? setStep(step - 1) : onBack()}>←</button>
        <strong>알람 작성</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <div className="step-progress"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
        <div className="create-title">
          <h1>🔔 알람</h1>
          <p>{pet.name} · {step + 1}/3</p>
        </div>
        <div className="create-content">
          {step === 0 && (
            <>
              <label>알림 제목<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 깡깡이 먹이 주기" /></label>
              <ChoiceField label="알림 종류" options={['먹이', '약', '청소', '기타']} values={[reminderMeta[type].label]} onChange={([label]) => setType((Object.keys(reminderMeta) as ReminderType[]).find((key) => reminderMeta[key].label === label) ?? 'other')} />
            </>
          )}
          {step === 1 && (
            <>
              <ChoiceField label="반복 방식" options={['반복', '1회']} values={[schedule === 'repeat' ? '반복' : '1회']} onChange={([value]) => setSchedule(value === '반복' ? 'repeat' : 'once')} />
              {schedule === 'repeat' ? (
                <>
                  <label>요일</label>
                  <div className="weekday-picker">
                    {weekdays.map((day, index) => (
                      <button type="button" className={selectedWeekdays.includes(index) ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.includes(index) ? selectedWeekdays.filter((item) => item !== index) : [...selectedWeekdays, index])} key={day}>{day}</button>
                    ))}
                  </div>
                </>
              ) : (
                <label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              )}
              <label>시간<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            </>
          )}
          {step === 2 && <label>메모<textarea autoFocus value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="메모를 입력하세요" /></label>}
        </div>
        <button className="create-submit" disabled={!valid}>{step === 2 ? '저장' : '다음'}</button>
      </form>
    </main>
  )
}

function ChoiceField({
  label,
  options,
  values,
  onChange,
  multiple = false,
  custom,
  onCustom,
}: {
  label: string
  options: string[]
  values: string[]
  onChange: (values: string[]) => void
  multiple?: boolean
  custom?: string
  onCustom?: (value: string) => void
}) {
  return (
    <div className="choice-field">
      <label>{label}</label>
      <div>
        {options.map((option) => (
          <button type="button" className={values.includes(option) ? 'selected' : ''} onClick={() => onChange(multiple ? values.includes(option) ? values.filter((item) => item !== option) : [...values, option] : [option])} key={option}>{option}</button>
        ))}
      </div>
      {onCustom && <input value={custom} onChange={(event) => onCustom(event.target.value)} placeholder="직접 입력" />}
    </div>
  )
}

function PhotoPicker({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0]?.name)
  return (
    <label className="photo-picker">
      사진 1장을 추가하세요
      <span>
        <b>{value ?? '사진 선택'}</b>
        <input type="file" accept="image/*" onChange={choose} />
      </span>
      <small>사진은 선택하지 않아도 저장할 수 있어요.</small>
    </label>
  )
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <div className="diary-overlay"><button className="diary-dim" aria-label="닫기" onClick={onClose} /><section className="diary-modal">{children}</section></div>
}

function EmptyState({ title }: { title: string }) {
  return <div className="diary-empty"><strong>{title}</strong></div>
}

function validateDetail(draft: RecordDraft) {
  if (draft.type === 'food') return draft.foods.length > 0 || draft.customFood.trim().length > 0
  if (draft.type === 'weight') return Number(draft.weight) > 0
  if (draft.type === 'hospital') return draft.hospital.trim().length > 0
  return draft.status.length > 0
}

function getRecordMemo(draft: RecordDraft) {
  if (draft.memo.trim()) return draft.memo.trim()
  if (draft.type === 'food') return [...draft.foods, draft.customFood].filter(Boolean).join(', ')
  if (draft.type === 'weight') return `${draft.weight}g`
  if (draft.type === 'hospital') return draft.hospital
  return draft.status || '기록'
}

function getCalendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  start.setDate(1 - start.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function reminderOccursOn(reminder: Reminder, date: Date) {
  return reminder.scheduleType === 'once' ? reminder.reminderDate === toDateKey(date) : reminder.weekdays.includes(date.getDay())
}

function formatReminderSchedule(reminder: Reminder) {
  return reminder.scheduleType === 'once'
    ? `${reminder.reminderDate} ${reminder.reminderTime}`
    : `${reminder.weekdays.map((day) => weekdays[day]).join('·')} ${reminder.reminderTime}`
}

function formatDate(date: string) {
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

function genderLabel(gender: DiaryPet['gender']) {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return ''
}

function animalIcon(group: DiaryPet['group']) {
  if (group === 'bird') return '🐦'
  if (group === 'rodent') return '🐹'
  if (group === 'amphibian') return '🐸'
  if (group === 'reptile') return '🦎'
  return '🐾'
}
