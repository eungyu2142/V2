import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { deleteAppData, loadAppData, saveAppData } from '../../lib/appData'
import { completeDailyTask, deleteCarePlan, listCarePlans, listDailyTasks, markDailyTaskCompleted, saveCarePlan, skipDailyTask, undoDailyTask } from './diaryService'
import type { CarePlan, CareTaskType, DailyTask, PetRecord, PetRecordType } from './diaryTypes'
import { toDateKey } from './mockDiaryData'
import './DiaryPage.css'

export type DiaryPet = {
  id: string
  name: string
  group: 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
  species: string
  gender: 'male' | 'female' | 'unknown'
  weight?: string
  weightUnit?: 'g' | 'kg'
}

type ReminderType = CareTaskType | 'medicine'
type SmartAddKind = 'food' | 'water' | 'cleaning' | 'poop' | 'shed' | 'medicine' | 'hospital'
type RoutineInputType = 'check' | 'measurement' | 'feeding' | 'status' | 'short_text'

export type Reminder = {
  id: string
  userId?: string
  petId: string
  title: string
  reminderType: ReminderType
  scheduleType: 'repeat' | 'once'
  weekdays: number[]
  startDate?: string
  endDate?: string
  reminderDate: string
  reminderTime: string
  memo: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
  completedAt?: string
}

export type RecordDraft = {
  type: PetRecordType
  foods: string[]
  customFood: string
  weight: string
  status: string
  hospital: string
  memo: string
  photo?: string
  step?: number
}

type DiaryRecordDraftPayload = {
  petId: string
  date: string
  draft: RecordDraft
}

type DiaryReminderDraftPayload = {
  reminder: Reminder
}

type DiaryRecordDraftItem = {
  id: string
  draftType: 'care_record'
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: DiaryRecordDraftPayload
}

type DiaryReminderDraftItem = {
  id: string
  draftType: 'reminder'
  title: string
  body: string
  updatedAt: string
  step?: number
  payload: DiaryReminderDraftPayload
}

type DiaryDraftItem = DiaryRecordDraftItem | DiaryReminderDraftItem

const reminderTypes: ReminderType[] = [
  'feed',
  'water',
  'mist',
  'temperature',
  'humidity',
  'light',
  'cleaning',
  'partial_cleaning',
  'full_cleaning',
  'substrate_change',
  'bedding_tidy',
  'bedding_change',
  'chew_check',
  'wheel_check',
  'water_temperature',
  'water_quality',
  'cage_floor_cleaning',
  'cage_full_cleaning',
  'food_bowl_cleaning',
  'water_bowl_cleaning',
  'perch_cleaning',
  'play_interaction',
  'weight',
  'status_check',
  'custom',
]

const recordMeta: Record<PetRecordType, { label: string; icon: string }> = {
  food: { label: '먹이', icon: '🍽' },
  weight: { label: '무게', icon: '⚖️' },
  shed: { label: '탈피', icon: '🌀' },
  poop: { label: '배변', icon: '💩' },
  cleaning: { label: '청소', icon: '🧹' },
  hospital: { label: '병원', icon: '🏥' },
  other: { label: '기록', icon: '📝' },
}

const reminderMeta: Record<ReminderType, { label: string; icon: string; recordType: PetRecordType; inputType: RoutineInputType; unit?: string }> = {
  feed: { label: '먹이 주기', icon: '🍽', recordType: 'food', inputType: 'feeding' },
  medicine: { label: '약', icon: '💊', recordType: 'other', inputType: 'status' },
  water: { label: '물 교체', icon: '💧', recordType: 'other', inputType: 'check' },
  mist: { label: '분무', icon: '🌫', recordType: 'other', inputType: 'check' },
  temperature: { label: '온도 확인', icon: '🌡', recordType: 'other', inputType: 'measurement', unit: '℃' },
  humidity: { label: '습도 확인', icon: '💦', recordType: 'other', inputType: 'measurement', unit: '%' },
  light: { label: '조명 확인', icon: '💡', recordType: 'other', inputType: 'check' },
  cleaning: { label: '청소', icon: '🧹', recordType: 'cleaning', inputType: 'check' },
  partial_cleaning: { label: '부분 청소', icon: '🧹', recordType: 'cleaning', inputType: 'check' },
  full_cleaning: { label: '전체 청소', icon: '🧼', recordType: 'cleaning', inputType: 'check' },
  substrate_change: { label: '바닥재 교체', icon: '🪵', recordType: 'cleaning', inputType: 'check' },
  bedding_tidy: { label: '베딩 부분 정리', icon: '🧺', recordType: 'cleaning', inputType: 'check' },
  bedding_change: { label: '베딩 전체 교체', icon: '🧺', recordType: 'cleaning', inputType: 'check' },
  chew_check: { label: '이갈이용품 확인', icon: '🦷', recordType: 'other', inputType: 'check' },
  wheel_check: { label: '쳇바퀴 확인', icon: '⭕', recordType: 'other', inputType: 'check' },
  water_temperature: { label: '수온 확인', icon: '🌊', recordType: 'other', inputType: 'measurement', unit: '℃' },
  water_quality: { label: '수질 확인', icon: '🧪', recordType: 'other', inputType: 'status' },
  cage_floor_cleaning: { label: '케이지 바닥 청소', icon: '🧹', recordType: 'cleaning', inputType: 'check' },
  cage_full_cleaning: { label: '케이지 전체 청소', icon: '🧼', recordType: 'cleaning', inputType: 'check' },
  food_bowl_cleaning: { label: '먹이통 세척', icon: '🥣', recordType: 'cleaning', inputType: 'check' },
  water_bowl_cleaning: { label: '물통 세척', icon: '🚰', recordType: 'cleaning', inputType: 'check' },
  perch_cleaning: { label: '횃대 청소', icon: '🪵', recordType: 'cleaning', inputType: 'check' },
  play_interaction: { label: '놀이·교감', icon: '🤝', recordType: 'other', inputType: 'check' },
  weight: { label: '체중 측정', icon: '⚖️', recordType: 'weight', inputType: 'measurement', unit: 'g' },
  status_check: { label: '상태 확인', icon: '👀', recordType: 'other', inputType: 'status' },
  custom: { label: '직접 입력', icon: '✏️', recordType: 'other', inputType: 'check' },
}

const routineRecommendations: Record<DiaryPet['group'] | 'all', ReminderType[]> = {
  all: ['feed', 'water', 'cleaning', 'weight', 'custom'],
  reptile: ['feed', 'water', 'mist', 'temperature', 'humidity', 'partial_cleaning', 'full_cleaning', 'substrate_change', 'light', 'weight', 'custom'],
  rodent: ['feed', 'water', 'bedding_tidy', 'bedding_change', 'cleaning', 'chew_check', 'wheel_check', 'play_interaction', 'weight', 'custom'],
  amphibian: ['feed', 'water', 'mist', 'temperature', 'humidity', 'water_temperature', 'water_quality', 'partial_cleaning', 'full_cleaning', 'weight', 'custom'],
  bird: ['feed', 'water', 'cage_floor_cleaning', 'cage_full_cleaning', 'food_bowl_cleaning', 'water_bowl_cleaning', 'perch_cleaning', 'play_interaction', 'weight', 'custom'],
  other: ['feed', 'water', 'cleaning', 'play_interaction', 'status_check', 'weight', 'custom'],
}

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

export default function DiaryPage({
  userId,
  pets,
  initialPetId,
  readOnly = false,
  onAddPet,
  onAskQna,
  initialDraft,
  onSaveDraft,
  onDeleteDraft,
}: {
  userId: string
  pets: DiaryPet[]
  initialPetId?: string
  readOnly?: boolean
  onAddPet: () => void
  onAskQna?: (petId: string) => void
  initialDraft?: DiaryDraftItem | null
  onSaveDraft?: (draft: DiaryDraftItem) => void | Promise<void>
  onDeleteDraft?: (draftId: string) => void | Promise<void>
}) {
  const today = toDateKey(new Date())
  const [selectedPetId, setSelectedPetId] = useState(initialPetId ?? pets[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(today)
  const [mobileView, setMobileView] = useState<'plan' | 'calendar'>('plan')
  const [visibleMonth, setVisibleMonth] = useState(new Date())
  const [records, setRecords] = useState<PetRecord[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [usingCarePlans, setUsingCarePlans] = useState(false)
  const [createType, setCreateType] = useState<PetRecordType | null>(null)
  const [recordInitialDraft, setRecordInitialDraft] = useState<RecordDraft | undefined>()
  const [recordDate, setRecordDate] = useState(selectedDate)
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [completingDailyTask, setCompletingDailyTask] = useState<DailyTask | undefined>()
  const [dateDetailsOpen, setDateDetailsOpen] = useState(false)
  const [visualizationOpen, setVisualizationOpen] = useState(false)
  const [completingReminder, setCompletingReminder] = useState<Reminder | null>(null)
  const [reminderFormOpen, setReminderFormOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [petWarningOpen, setPetWarningOpen] = useState(false)
  const [smartSheet, setSmartSheet] = useState<SmartAddKind | null>(null)
  const [smartFoodKind, setSmartFoodKind] = useState('')
  const [smartFoodQuantity, setSmartFoodQuantity] = useState('1')
  const [smartFoodUnit, setSmartFoodUnit] = useState('마리')
  const [smartPoopStatus, setSmartPoopStatus] = useState('')
  const [smartShedStatus, setSmartShedStatus] = useState('')
  const [smartMedicineName, setSmartMedicineName] = useState('')
  const [smartMedicineDose, setSmartMedicineDose] = useState('')
  const [smartHospitalName, setSmartHospitalName] = useState('')
  const [pendingSmartRecord, setPendingSmartRecord] = useState<{ record: PetRecord; message: string } | null>(null)
  const [smartToast, setSmartToast] = useState('')
  const completingTaskIds = useRef(new Set<string>())
  const lastInitialPetIdRef = useRef(initialPetId)

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? pets[0]
  const effectivePetId = selectedPet?.id ?? ''
  const activeReminders = reminders.filter((reminder) => reminder.isActive)
  const petCarePlans = reminders.filter((reminder) => reminder.petId === effectivePetId && reminder.reminderType !== 'medicine')
  const petRecords = records.filter((record) => record.petId === effectivePetId)
  const visibleRecords = [...petRecords].sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`))
  const recentFoods = Array.from(new Set(petRecords.flatMap((record) => record.type === 'food' ? record.foods ?? [] : []))).slice(0, 3)
  const recentMedicines = Array.from(new Set(petRecords.filter((record) => record.type === 'other' && record.memo?.startsWith('약 · ')).map((record) => record.memo?.replace(/^약 · /, '') ?? ''))).slice(0, 3)
  const previousDate = toDateKey(new Date(parseDateKey(selectedDate).getTime() - 86400000))
  const legacyPlanReminders = activeReminders
    .filter((reminder) => reminder.petId === effectivePetId && reminder.scheduleType === 'repeat' && reminder.reminderType !== 'medicine')
    .flatMap((reminder) => {
      if (reminderOccursOn(reminder, parseDateKey(selectedDate))) return [{ reminder, overdue: false }]
      if (reminderOccursOn(reminder, parseDateKey(previousDate)) && reminder.completedAt?.slice(0, 10) !== previousDate) return [{ reminder, overdue: true }]
      return []
    })
  const planReminders = usingCarePlans && dailyTasks.length
    ? dailyTasks
      .filter((task) => task.petId === effectivePetId && (task.scheduledDate === selectedDate || (task.scheduledDate < today && task.status === 'pending')))
      .map((task) => ({ reminder: reminders.find((item) => item.id === task.carePlanId) ?? medicationTaskReminder(task), overdue: task.scheduledDate < today, dailyTask: task }))
      .filter((item): item is { reminder: Reminder; overdue: boolean; dailyTask: DailyTask } => Boolean(item.reminder))
    : legacyPlanReminders.map((item) => ({ ...item, dailyTask: undefined }))
  const selectedRecord = selectedRecordId ? records.find((record) => record.id === selectedRecordId) : null

  useEffect(() => {
    const nextPetId = initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : pets[0]?.id ?? ''
    const initialPetChanged = lastInitialPetIdRef.current !== initialPetId
    const selectedPetStillExists = pets.some((pet) => pet.id === selectedPetId)
    lastInitialPetIdRef.current = initialPetId
    if (nextPetId && nextPetId !== selectedPetId && (initialPetChanged || !selectedPetStillExists)) {
      setSelectedPetId(nextPetId)
      setSelectedRecordId(null)
      setDateDetailsOpen(false)
    }
  }, [initialPetId, pets, selectedPetId])

  useEffect(() => {
    let active = true
    Promise.all([
      loadAppData<PetRecord>('care_records', { userId, scope: 'mine' }).catch(() => []),
      listCarePlans(userId).then((plans) => ({ plans, migrated: true })).catch(() => loadAppData<Reminder>('feeding_reminders', { userId, scope: 'mine' }).then((legacy) => ({ plans: legacy.map(reminderToCarePlan), migrated: false })).catch(() => ({ plans: [], migrated: false }))),
    ]).then(([nextRecords, planResult]) => {
      if (!active) return
      setRecords(nextRecords)
      setReminders(planResult.plans.map(carePlanToReminder))
      setUsingCarePlans(planResult.migrated)
    })
    return () => {
      active = false
    }
  }, [userId])

  useEffect(() => {
    if (!usingCarePlans || !effectivePetId) return
    const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const monthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0)
    listDailyTasks(
      userId,
      toDateKey(new Date(monthStart.getTime() - 86400000 * 14)),
      toDateKey(new Date(monthEnd.getTime() + 86400000 * 14)),
      effectivePetId,
    ).then(setDailyTasks).catch(() => setDailyTasks([]))
  }, [effectivePetId, userId, usingCarePlans, visibleMonth])

  useEffect(() => {
    if (!initialDraft || initialDraft.draftType !== 'care_record') return
    const payload = initialDraft.payload
    // Restore a draft opened from the profile activity list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPetId(payload.petId)
    setSelectedDate(payload.date)
    setRecordDate(payload.date)
    setRecordInitialDraft({ ...payload.draft, step: initialDraft.step ?? payload.draft.step })
    setCompletingReminder(null)
    setCreateType(payload.draft.type)
  }, [initialDraft])

  useEffect(() => {
    if (!initialDraft || initialDraft.draftType !== 'reminder') return
    // Restore a reminder draft opened from the profile activity list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPetId(initialDraft.payload.reminder.petId)
    setEditingReminder(initialDraft.payload.reminder)
    setReminderFormOpen(true)
  }, [initialDraft])

  const saveRecordList = (next: PetRecord[]) => {
    const removed = records.find((record) => !next.some((item) => item.id === record.id))
    const added = next.find((record) => !records.some((item) => item.id === record.id))
    setRecords(next)
    if (removed) void deleteAppData('care_records', removed.id).catch((error) => console.error('Care record delete failed.', error))
    if (added) {
      void saveAppData('care_records', userId, added, {
        pet_id: added.petId,
        record_date: added.date,
        record_type: added.type,
        memo: added.memo ?? '',
        daily_task_id: added.dailyTaskId,
        occurred_at: added.occurredAt,
        scheduled_for: added.scheduledFor,
        status: added.status ?? 'manual',
      }).catch((error) => console.error('Care record save failed; kept local state.', error))
    }
  }

  const saveReminderList = (next: Reminder[]) => {
    const removed = reminders.find((reminder) => !next.some((item) => item.id === reminder.id))
    const added = next.find((reminder) => !reminders.some((item) => item.id === reminder.id))
    const updated = next.find((reminder) => reminders.some((item) => item.id === reminder.id && item !== reminder))
    setReminders(next)
    if (usingCarePlans) {
      if (removed) void deleteCarePlan(removed.id).catch((error) => console.error('Care plan delete failed.', error))
      if (added) void saveCarePlan(userId, reminderToCarePlan(added)).catch((error) => console.error('Care plan save failed; kept local state.', error))
      if (updated) void saveCarePlan(userId, reminderToCarePlan(updated)).catch((error) => console.error('Care plan update failed; kept local state.', error))
    } else {
      if (removed) void deleteAppData('feeding_reminders', removed.id).catch((error) => console.error('Reminder delete failed.', error))
      if (added) void saveAppData('feeding_reminders', userId, added, { pet_id: added.petId }).catch((error) => console.error('Reminder save failed; kept local state.', error))
      if (updated) void saveAppData('feeding_reminders', userId, updated, { pet_id: updated.petId }).catch((error) => console.error('Reminder update failed; kept local state.', error))
    }
  }

  const openSmartAdd = (kind: SmartAddKind) => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    if (selectedDate > today) return
    setSmartSheet(kind)
    setSmartFoodKind('')
    setSmartFoodQuantity('1')
    setSmartFoodUnit('마리')
    setSmartPoopStatus('')
    setSmartShedStatus('')
    setSmartMedicineName('')
    setSmartMedicineDose('')
    setSmartHospitalName('')
  }

  const openReminderCreate = () => {
    if (!selectedPet) {
      setPetWarningOpen(true)
      return
    }
    setEditingReminder(null)
    setReminderFormOpen(true)
  }

  const showSmartToast = (message: string) => {
    setSmartToast(message)
    window.setTimeout(() => setSmartToast(''), 2000)
  }

  const saveSmartRecord = (record: PetRecord, message: string) => {
    const key = `${record.type}|${record.memo ?? ''}|${record.foods?.join('|') ?? ''}`
    const duplicate = records.find((item) => item.petId === record.petId && item.date === record.date && `${item.type}|${item.memo ?? ''}|${item.foods?.join('|') ?? ''}` === key && Date.now() - new Date(item.createdAt).getTime() < 10000)
    if (duplicate) {
      setPendingSmartRecord({ record, message })
      return
    }
    saveRecordList([record, ...records])
    setSmartSheet(null)
    showSmartToast(message)
  }

  const makeSmartRecord = (type: PetRecordType, message: string, memo?: string, foods?: string[], photo?: string) => {
    if (!selectedPet) return
    saveSmartRecord({
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type,
      date: selectedDate,
      memo,
      foods,
      photoUrl: photo,
      createdAt: new Date().toISOString(),
    }, message)
  }

  const saveSmartFood = (food: string) => makeSmartRecord('food', `${food} 먹이 기록이 저장되었습니다`, undefined, [food])
  const saveSmartPoop = (status = smartPoopStatus) => makeSmartRecord('poop', `배변 · ${status} 기록이 저장되었습니다`, status)
  const saveSmartShed = (status = smartShedStatus) => makeSmartRecord('shed', `탈피 · ${status} 기록이 저장되었습니다`, status)
  const saveSmartWater = (option: string) => makeSmartRecord('other', `물 관리 · ${option} 기록이 저장되었습니다`, `물 관리 · ${option}`)
  const saveSmartCleaning = (option: string) => makeSmartRecord('cleaning', `청소 · ${option} 기록이 저장되었습니다`, option)
  const saveSmartMedicine = () => makeSmartRecord('other', `약 · ${smartMedicineName} 기록이 저장되었습니다`, `약 · ${smartMedicineName} · ${smartMedicineDose}`)
  const saveSmartHospital = () => makeSmartRecord('hospital', `진료 · ${smartHospitalName} 기록이 저장되었습니다`, smartHospitalName)

  const completePlan = (reminder: Reminder, dailyTask?: DailyTask) => {
    if (!selectedPet) return
    const meta = reminderMeta[reminder.reminderType]
    if (meta.inputType !== 'check' && reminder.reminderType !== 'medicine') {
      setCompletingReminder(reminder)
      setCompletingDailyTask(dailyTask)
      setRecordDate(dailyTask?.scheduledDate ?? selectedDate)
      setRecordInitialDraft(createRoutineRecordDraft(meta.recordType, selectedPet, reminder))
      setCreateType(meta.recordType)
      return
    }
    if (dailyTask && usingCarePlans) {
      if (dailyTask.status === 'completed' || records.some((record) => record.dailyTaskId === dailyTask.id) || completingTaskIds.current.has(dailyTask.id)) return
      completingTaskIds.current.add(dailyTask.id)
      const label = planLabel(reminder)
      const recordType = reminderMeta[reminder.reminderType].recordType
      const completedAt = new Date().toISOString()
      setRecords((items) => [{ id: `task-${dailyTask.id}`, userId, petId: selectedPet.id, type: recordType, date: selectedDate, memo: label, foods: recordType === 'food' ? [label] : undefined, dailyTaskId: dailyTask.id, scheduledFor: dailyTask.scheduledDate, occurredAt: completedAt, status: 'completed', createdAt: completedAt }, ...items.filter((item) => item.dailyTaskId !== dailyTask.id)])
      setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'completed', completedAt } : item))
      void completeDailyTask(dailyTask.id).catch((error) => console.error('Daily task completion sync failed; kept local state.', error))
      showSmartToast(`${label} 완료 기록이 저장되었습니다`)
      return
    }
    const label = planLabel(reminder)
    const alreadyRecorded = records.some((record) => record.petId === selectedPet.id && record.date === selectedDate && record.memo === label)
    if (alreadyRecorded || reminder.completedAt?.slice(0, 10) === selectedDate) {
      showSmartToast(`${label}은(는) 이미 기록되어 있어요`)
      return
    }
    const recordType = reminderMeta[reminder.reminderType].recordType
    const record: PetRecord = {
      id: crypto.randomUUID(),
      userId,
      petId: selectedPet.id,
      type: recordType,
      date: selectedDate,
      memo: label,
      foods: recordType === 'food' ? [label] : undefined,
      createdAt: new Date().toISOString(),
    }
    saveRecordList([record, ...records])
    markReminderCompleted(reminder)
    showSmartToast(`${label} 완료 기록이 저장되었습니다`)
  }

  const undoPlan = (reminder: Reminder, dailyTask?: DailyTask) => {
    if (dailyTask && usingCarePlans) {
      completingTaskIds.current.delete(dailyTask.id)
      setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'pending', completedAt: undefined } : item))
      setRecords((items) => items.filter((item) => item.dailyTaskId !== dailyTask.id))
      void undoDailyTask(dailyTask.id).catch((error) => console.error('Daily task undo sync failed; kept local state.', error))
      showSmartToast(`${planLabel(reminder)} 기록을 되돌렸어요`)
      return
    }
    const record = records.find((item) => item.petId === effectivePetId && item.date === selectedDate && item.memo === planLabel(reminder))
    if (record) saveRecordList(records.filter((item) => item.id !== record.id))
    saveReminderList(reminders.map((item) => item.id === reminder.id ? { ...item, completedAt: undefined, updatedAt: new Date().toISOString() } : item))
  }

  const skipPlan = (dailyTask?: DailyTask) => {
    if (!dailyTask || !usingCarePlans) return
    setDailyTasks((items) => items.map((item) => item.id === dailyTask.id ? { ...item, status: 'skipped' } : item))
    void skipDailyTask(dailyTask.id).catch((error) => console.error('Daily task skip sync failed; kept local state.', error))
    showSmartToast('이번 할 일을 건너뛰었어요')
  }

  const togglePlan = (reminder: Reminder) => {
    saveReminderList(reminders.map((item) => item.id === reminder.id ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() } : item))
  }
  void togglePlan

  const removePlan = (reminderId: string) => {
    saveReminderList(reminders.filter((item) => item.id !== reminderId))
  }

  const closeRecordCreate = () => {
    setCreateType(null)
    setRecordInitialDraft(undefined)
    setCompletingReminder(null)
    setCompletingDailyTask(undefined)
    setRecordDate(selectedDate)
  }

  if (createType && selectedPet) {
    return (
      <RecordCreateScreen
        pet={selectedPet}
        type={createType}
        date={recordDate}
        initialDraft={recordInitialDraft}
        onBack={closeRecordCreate}
        onSave={(draft) => {
          const record: PetRecord = {
            id: crypto.randomUUID(),
            userId,
            petId: selectedPet.id,
            type: draft.type,
            date: recordDate,
            memo: getRecordMemo(draft),
            photoUrl: draft.photo,
            weight: draft.type === 'weight' ? Number(draft.weight) : undefined,
            foods: draft.type === 'food' ? [...draft.foods, draft.customFood].filter(Boolean) : undefined,
            createdAt: new Date().toISOString(),
          }
          if (completingDailyTask && usingCarePlans) {
            const completedAt = new Date().toISOString()
            const taskRecord = {
              ...record,
              dailyTaskId: completingDailyTask.id,
              scheduledFor: completingDailyTask.scheduledDate,
              occurredAt: completedAt,
              status: 'completed' as const,
            }
            saveRecordList([taskRecord, ...records])
            setDailyTasks((items) => items.map((item) => item.id === completingDailyTask.id ? { ...item, status: 'completed', completedAt } : item))
            void markDailyTaskCompleted(completingDailyTask.id).catch((error) => console.error('Daily task completion sync failed after typed record; kept local state.', error))
          } else if (completingReminder) {
            saveRecordList([record, ...records])
            markReminderCompleted(completingReminder)
          } else {
            saveRecordList([record, ...records])
          }
          closeRecordCreate()
          setSelectedDate(recordDate)
          if (initialDraft) void onDeleteDraft?.(initialDraft.id)
        }}
        onSaveDraft={(draft, step) => {
          void Promise.resolve(onSaveDraft?.({
            id: initialDraft?.id ?? crypto.randomUUID(),
            draftType: 'care_record',
            title: `${selectedPet.name} 기록`,
            body: getRecordMemo(draft),
            updatedAt: new Date().toISOString(),
            step,
            payload: { petId: selectedPet.id, date: recordDate, draft: { ...draft, step } },
          })).then(() => {
            closeRecordCreate()
          })
        }}
      />
    )
  }

  if (selectedRecord) {
    const recordPet = pets.find((pet) => pet.id === selectedRecord.petId)
    return (
      <RecordDetailScreen
        record={selectedRecord}
        pet={recordPet}
        readOnly={readOnly}
        onBack={() => setSelectedRecordId(null)}
        onDelete={() => {
          saveRecordList(records.filter((item) => item.id !== selectedRecord.id))
          setSelectedRecordId(null)
        }}
      />
    )
  }

  if (reminderFormOpen) {
    return (
      <ReminderCreateScreen
        pets={pets}
        selectedPetId={effectivePetId}
        existingReminders={reminders}
        initialReminder={editingReminder}
        onBack={() => { setReminderFormOpen(false); setEditingReminder(null) }}
              onSave={(nextReminders) => {
          const next = editingReminder
            ? reminders.flatMap((item) => item.id === editingReminder.id ? nextReminders : [item])
            : [...nextReminders, ...reminders]
          saveReminderList(next)
          setReminderFormOpen(false)
          setEditingReminder(null)
          if (initialDraft?.draftType === 'reminder') void onDeleteDraft?.(initialDraft.id)
        }}
        onSaveDraft={(reminder, step) => {
          void Promise.resolve(onSaveDraft?.({
            id: initialDraft?.draftType === 'reminder' ? initialDraft.id : crypto.randomUUID(),
            draftType: 'reminder',
            title: reminder.title || '관리 루틴 초안',
            body: formatReminderSchedule(reminder),
            updatedAt: new Date().toISOString(),
            step,
            payload: { reminder },
          })).then(() => {
            setReminderFormOpen(false)
            setEditingReminder(null)
          })
        }}
      />
    )
  }

  if (dateDetailsOpen) {
    return <DateRecordsScreen
      date={selectedDate}
      records={petRecords.filter((record) => record.date === selectedDate)}
      onBack={() => setDateDetailsOpen(false)}
      onOpenRecord={setSelectedRecordId}
      onDelete={(recordId) => saveRecordList(records.filter((record) => record.id !== recordId))}
      onAddMemo={(memo) => {
        if (!selectedPet) return
        saveRecordList([{
          id: crypto.randomUUID(),
          userId,
          petId: selectedPet.id,
          type: 'other',
          date: selectedDate,
          memo,
          createdAt: new Date().toISOString(),
          status: 'manual',
        }, ...records])
      }}
    />
  }

  if (visualizationOpen) {
    return <DataVisualizationScreen records={petRecords} petName={selectedPet?.name ?? '펫'} onBack={() => setVisualizationOpen(false)} />
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
        {!readOnly && pets.length > 1 && (
          <select aria-label="반려동물 선택" value={effectivePetId} onChange={(event) => setSelectedPetId(event.target.value)}>
            {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
        )}
        {!readOnly && selectedPet && onAskQna && <button className="diary-pet-qna-button" type="button" onClick={() => onAskQna(selectedPet.id)}>Q&A에 질문하기</button>}
      </div>


      <div className="diary-mobile-tabs" role="tablist" aria-label="다이어리 보기">
        <button type="button" className={mobileView === 'plan' ? 'active' : ''} onClick={() => setMobileView('plan')}>플랜</button>
        <button type="button" className={mobileView === 'calendar' ? 'active' : ''} onClick={() => setMobileView('calendar')}>캘린더</button>
      </div>

      <div className={`diary-workspace mobile-${mobileView}`}>
        <main className="diary-calendar-area">
          <Calendar
            month={visibleMonth}
            selectedDate={selectedDate}
            records={petRecords}
            onMove={(amount) => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1))}
            onSelect={(date) => { if (date === selectedDate) setDateDetailsOpen(true); else setSelectedDate(date) }}
          />
          <SelectedDateStatus date={selectedDate} records={petRecords} />
        </main>
        <aside className="diary-detail-panel">
          {!readOnly && <DailyPlan tasks={planReminders} selectedDate={selectedDate} hasCarePlans={petCarePlans.length > 0 || planReminders.some((item) => item.reminder.reminderType === 'medicine')} onAddPlan={openReminderCreate} onEditPlan={(reminder) => { setEditingReminder(reminder); setReminderFormOpen(true) }} onDeletePlan={removePlan} onComplete={(item) => completePlan(item.reminder, item.dailyTask)} onUndo={(item) => undoPlan(item.reminder, item.dailyTask)} onSkip={(item) => skipPlan(item.dailyTask)} />}
          {!readOnly && <IncidentAddBar petGroup={selectedPet?.group} disabled={selectedDate > today} onOpen={openSmartAdd} />}
            <section className="record-list-panel">
              <header>
                <div className="record-list-heading">
                  <h2>{formatDate(selectedDate)} 전체 기록</h2>
                  <span>{visibleRecords.length}개</span>
                </div>
                <button className="data-visualization-button" type="button" onClick={() => setVisualizationOpen(true)}>데이터 시각화</button>
              </header>
              <p className="record-list-hint">달력에서 날짜를 누르면 이 날짜의 기록을 자세히 볼 수 있어요.</p>
            </section>
          </aside>
        </div>

      {smartSheet && selectedPet && (
        <Overlay onClose={() => setSmartSheet(null)}>
          <SmartAddSheet
            kind={smartSheet}
            pet={selectedPet}
            recentFoods={recentFoods}
            recentMedicines={recentMedicines}
            foodKind={smartFoodKind}
            foodQuantity={smartFoodQuantity}
            foodUnit={smartFoodUnit}
            poopStatus={smartPoopStatus}
            shedStatus={smartShedStatus}
            medicineName={smartMedicineName}
            medicineDose={smartMedicineDose}
            hospitalName={smartHospitalName}
            onFoodKind={setSmartFoodKind}
            onFoodQuantity={setSmartFoodQuantity}
            onFoodUnit={setSmartFoodUnit}
            onPoopStatus={setSmartPoopStatus}
            onShedStatus={setSmartShedStatus}
            onMedicineName={setSmartMedicineName}
            onMedicineDose={setSmartMedicineDose}
            onHospitalName={setSmartHospitalName}
            onFoodSave={(food) => saveSmartFood(food)}
            onWaterSave={saveSmartWater}
            onCleaningSave={saveSmartCleaning}
            onPoopSave={saveSmartPoop}
            onShedSave={saveSmartShed}
            onMedicineSave={saveSmartMedicine}
            onHospitalSave={saveSmartHospital}
          />
        </Overlay>
      )}
      {pendingSmartRecord && (
        <Overlay onClose={() => setPendingSmartRecord(null)}>
          <div className="smart-duplicate-dialog">
            <h2>방금 같은 기록을 저장했습니다.</h2>
            <p>한 번 더 기록할까요?</p>
            <div>
              <button type="button" onClick={() => setPendingSmartRecord(null)}>취소</button>
              <button type="button" onClick={() => { const next = pendingSmartRecord.record; setPendingSmartRecord(null); saveRecordList([next, ...records]); setSmartSheet(null); showSmartToast(pendingSmartRecord.message) }}>추가 기록</button>
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
      {smartToast && <div className="smart-toast" role="status">{smartToast}</div>}
    </section>
  )

  function markReminderCompleted(reminder: Reminder) {
    if (reminder.scheduleType === 'repeat') {
      const updated = { ...reminder, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      saveReminderList(reminders.map((item) => item.id === reminder.id ? updated : item))
      return
    }

    const updated = { ...reminder, isActive: false, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    saveReminderList(reminders.map((item) => item.id === reminder.id ? updated : item))
  }
}

function DailyPlan({
  tasks,
  selectedDate,
  hasCarePlans,
  onAddPlan,
  onEditPlan,
  onDeletePlan,
  onComplete,
  onUndo,
  onSkip,
}: {
  tasks: Array<{ reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }>
  selectedDate: string
  hasCarePlans: boolean
  onAddPlan: () => void
  onEditPlan: (reminder: Reminder) => void
  onDeletePlan: (id: string) => void
  onComplete: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
  onUndo: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
  onSkip: (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => void
}) {
  const isFuture = selectedDate > toDateKey(new Date())
  const overdueTasks = tasks.filter((task) => task.overdue)
  const todayTasks = tasks.filter((task) => !task.overdue)
  const renderTask = (task: { reminder: Reminder; overdue: boolean; dailyTask?: DailyTask }) => {
    const { reminder, overdue, dailyTask } = task
    const checked = dailyTask?.status === 'completed' || reminder.completedAt?.slice(0, 10) === selectedDate
    const taskDescription = overdue
      ? `${dailyTask?.scheduledDate ?? '지난 일정'} · 밀린 할 일`
      : reminder.reminderType === 'medicine'
        ? `${dailyTask?.scheduledDate ?? selectedDate} · ${dailyTask?.occurrenceNo ?? 1}회차`
        : `${formatPlanDays(reminder)} · ${routineInputLabel(reminderMeta[reminder.reminderType])}`
    return <div className={`daily-plan-task-row ${overdue ? 'overdue' : ''}`} key={`${reminder.id}-${dailyTask?.id ?? selectedDate}`}>
      <div className="daily-plan-task">
        <span className="daily-plan-task-content">
          <span className="daily-plan-title-line">
            <strong>{planLabel(reminder)}</strong>
            {reminder.reminderType !== 'medicine' && <details className="daily-task-menu">
              <summary aria-label={`${planLabel(reminder)} ??`} title="? ? ??">?</summary>
              <div>
                <button type="button" onClick={() => onEditPlan(reminder)}>??</button>
                <button type="button" onClick={() => onDeletePlan(reminder.id)}>??</button>
              </div>
            </details>}
          </span>
          <small>{taskDescription}</small>
        </span>
        <label className="daily-plan-check-wrap">
          <span className={`daily-plan-check ${checked ? 'checked' : ''}`} aria-hidden="true">{checked ? '?' : ''}</span>
          <input className="daily-plan-check-input" type="checkbox" checked={checked} disabled={isFuture} onChange={() => checked ? onUndo(task) : onComplete(task)} aria-label={`${planLabel(reminder)} ${checked ? '???' : '??'}`} />
        </label>
      </div>
      {overdue && <div className="daily-plan-task-actions"><button type="button" onClick={() => checked ? onUndo(task) : onComplete(task)}>??</button><button type="button" onClick={() => onSkip(task)}>????</button></div>}
    </div>
  }

  if (!hasCarePlans) {
    return (
      <section className="daily-plan-panel">
        <header><div><h2>오늘 할 일</h2><p>{formatDate(selectedDate)}</p></div><button type="button" onClick={onAddPlan}>루틴 추가</button></header>
        <div className="daily-plan-first-empty">
          <strong>아직 반복 일정이 없어요.</strong>
          <span>이 동물에게 필요한 반복 루틴을 먼저 만들어주세요.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="daily-plan-panel">
      <header><div><h2>오늘 할 일</h2><p>{formatDate(selectedDate)}</p></div><button type="button" onClick={onAddPlan}>루틴 추가</button></header>
      {overdueTasks.length > 0 && <section className="daily-task-group overdue-group"><h3>밀린 할 일</h3><div className="daily-plan-list">{overdueTasks.map(renderTask)}</div></section>}
      <section className="daily-task-group"><h3>오늘 할 일</h3>{todayTasks.length ? <div className="daily-plan-list">{todayTasks.map(renderTask)}</div> : <p className="daily-plan-empty">오늘 예정된 일이 없어요.</p>}</section>
    </section>
  )
}

function CarePlanPanel({
  plans,
  selectedPetId,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
}: {
  plans: Reminder[]
  selectedPetId: string
  onAdd: () => void
  onEdit: (plan: Reminder) => void
  onToggle: (plan: Reminder) => void
  onDelete: (id: string) => void
}) {
  const petPlans = plans.filter((plan) => plan.petId === selectedPetId && plan.reminderType !== 'medicine')
  return (
    <section className="care-plan-panel">
      <header><div><h2>반복 일정</h2><p>요일을 정해두면 오늘 할 일로 보여요.</p></div>{petPlans.length > 0 && <button type="button" onClick={onAdd}>루틴 추가</button>}</header>
      {petPlans.length ? <div className="care-plan-list">{petPlans.map((plan) => (
        <article className={!plan.isActive ? 'inactive' : ''} key={plan.id}>
          <div><strong>{planLabel(plan)}</strong><span>{formatPlanDays(plan)}</span></div>
          <details className="care-plan-menu">
            <summary aria-label={`${planLabel(plan)} 일정 메뉴`} title="일정 메뉴">⋮</summary>
            <div>
              <button type="button" onClick={() => onToggle(plan)}>{plan.isActive ? '끄기' : '켜기'}</button>
              <button type="button" onClick={() => onEdit(plan)}>수정</button>
              <button type="button" onClick={() => onDelete(plan.id)}>삭제</button>
            </div>
          </details>
        </article>
      ))}</div> : <div className="care-plan-empty"><strong>아직 등록한 루틴이 없어요.</strong><span>먹이, 물 교체, 청소 요일을 먼저 정해보세요.</span><button type="button" onClick={onAdd}>첫 루틴 만들기</button></div>}
    </section>
  )
}

void CarePlanPanel

function formatPlanDays(plan: Reminder) {
  if (plan.weekdays.length === 7) return '매일'
  return plan.weekdays.slice().sort((a, b) => a - b).map((day) => weekdays[day]).join(' · ') || '요일 미설정'
}

function animalGroupLabel(group: DiaryPet['group']) {
  if (group === 'reptile') return '파충류'
  if (group === 'rodent') return '설치류'
  if (group === 'amphibian') return '양서류'
  if (group === 'bird') return '조류'
  return '기타'
}

function routineInputLabel(meta: { inputType: RoutineInputType; unit?: string }) {
  if (meta.inputType === 'check') return '누르면 바로 완료 기록이 쌓이는 루틴입니다.'
  if (meta.inputType === 'feeding') return '수행할 때 먹이 종류와 급여량을 입력합니다.'
  if (meta.inputType === 'measurement') return `${meta.unit ?? ''} 값을 입력한 뒤 완료됩니다.`
  if (meta.inputType === 'status') return '수행할 때 짧은 상태를 확인하고 기록합니다.'
  return '직접 만든 루틴은 짧은 기록을 남긴 뒤 완료됩니다.'
}

function SelectedDateStatus({ date, records }: { date: string; records: PetRecord[] }) {
  const dayRecords = records.filter((record) => record.date === date)
  if (!dayRecords.length) return null
  return <section className="selected-date-status"><h2>{formatDate(date)}</h2><div>{dayRecords.map((record) => <span className="status-record" key={`record-${record.id}`}>{recordMeta[record.type].label} · {recordSummary(record)}</span>)}</div></section>
}

function planLabel(reminder: Reminder) {
  if (reminder.reminderType === 'medicine') return reminder.title || '약'
  if (reminder.reminderType === 'custom') return reminder.title || '직접 입력'
  return reminderMeta[reminder.reminderType]?.label ?? reminder.title ?? '관리'
}

function IncidentAddBar({ petGroup, disabled, onOpen }: { petGroup?: DiaryPet['group']; disabled: boolean; onOpen: (kind: SmartAddKind) => void }) {
  const items: Array<{ kind: SmartAddKind; label: string; icon: string }> = [
    { kind: 'poop', label: '배변 추가', icon: '💩' },
    ...(petGroup === 'reptile' ? [{ kind: 'shed' as const, label: '탈피 추가', icon: '🌀' }] : []),
    { kind: 'medicine', label: '약 기록', icon: '💊' },
    { kind: 'hospital', label: '진료 기록', icon: '🏥' },
  ]
  return <section className="incident-add-panel"><header><h2>상황 기록 추가</h2><p>필요할 때만 기록하세요.</p></header><div className="incident-add-actions">{items.map((item) => <button type="button" disabled={disabled} key={item.kind} onClick={() => onOpen(item.kind)}><span>{item.icon}</span>{item.label}</button>)}</div></section>
}

function SmartAddSheet({
  kind,
  pet,
  recentFoods,
  recentMedicines,
  foodKind,
  foodQuantity,
  foodUnit,
  poopStatus,
  shedStatus,
  medicineName,
  medicineDose,
  hospitalName,
  onFoodKind,
  onFoodQuantity,
  onFoodUnit,
  onPoopStatus,
  onShedStatus,
  onMedicineName,
  onMedicineDose,
  onFoodSave,
  onWaterSave,
  onCleaningSave,
  onPoopSave,
  onShedSave,
  onMedicineSave,
  onHospitalName,
  onHospitalSave,
}: {
  kind: SmartAddKind
  pet: DiaryPet
  recentFoods: string[]
  recentMedicines: string[]
  foodKind: string
  foodQuantity: string
  foodUnit: string
  poopStatus: string
  shedStatus: string
  medicineName: string
  medicineDose: string
  hospitalName: string
  onFoodKind: (value: string) => void
  onFoodQuantity: (value: string) => void
  onFoodUnit: (value: string) => void
  onPoopStatus: (value: string) => void
  onShedStatus: (value: string) => void
  onMedicineName: (value: string) => void
  onMedicineDose: (value: string) => void
  onHospitalName: (value: string) => void
  onFoodSave: (value: string) => void
  onWaterSave: (value: string) => void
  onCleaningSave: (value: string) => void
  onPoopSave: (status: string) => void
  onShedSave: (status: string) => void
  onMedicineSave: () => void
  onHospitalSave: () => void
}) {
  const foodOptions = ['밀웜', '귀뚜라미', '랩사료']
  const poopOptions = ['정상', '묽음', '단단함', '양이 적음', '이상 있음']
  const shedOptions = ['탈피 중', '탈피 완료', '부분 탈피', '이상 있음']
  const waterOptions = ['전체 교체', '일부 보충', '물그릇 세척']
  const cleaningOptions = ['부분 청소', '전체 청소', '바닥재 교체', '용품 세척']
  const foodValue = foodKind.trim() ? `${foodKind.trim()} ${foodQuantity || '1'}${foodUnit}` : ''
  const medicineReady = medicineName.trim() && medicineDose.trim()
  const hospitalReady = hospitalName.trim()

  return (
    <div className="smart-add-sheet">
      <span className="sheet-handle" />
      <h2>{kind === 'food' ? '먹이 기록' : kind === 'poop' ? '배변 기록' : kind === 'shed' ? '탈피 기록' : kind === 'water' ? '물 교체 기록' : kind === 'cleaning' ? '청소 기록' : kind === 'medicine' ? '약 기록' : '진료 기록'}</h2>
      <p className="smart-add-sheet-pet">{pet.name}</p>
      {kind === 'food' && (
        <>
          {recentFoods.length > 0 && <div className="smart-recent-section"><strong>최근에 준 먹이</strong><div className="smart-choice-list">{recentFoods.map((food) => <button type="button" key={food} onClick={() => onFoodSave(food)}>{food}</button>)}</div></div>}
          <div className="smart-recent-section"><strong>새 먹이 기록</strong><div className="smart-choice-list">{foodOptions.map((food) => <button type="button" className={foodKind === food ? 'selected' : ''} key={food} onClick={() => onFoodKind(food)}>{food}</button>)}<label className="smart-inline-input"><input value={foodKind === '밀웜' || foodKind === '귀뚜라미' || foodKind === '랩사료' ? '' : foodKind} onChange={(event) => onFoodKind(event.target.value)} placeholder="직접 입력" /></label></div></div>
          {foodKind && <div className="smart-quantity-row"><label>수량<input type="number" min="1" value={foodQuantity} onChange={(event) => onFoodQuantity(event.target.value)} /></label><div><strong>단위</strong><div className="smart-unit-list">{['마리', '개', 'g', '회'].map((unit) => <button type="button" className={foodUnit === unit ? 'selected' : ''} key={unit} onClick={() => onFoodUnit(unit)}>{unit}</button>)}</div></div></div>}
          {foodValue && <button className="smart-save-button" type="button" onClick={() => onFoodSave(foodValue)}>이 내용으로 기록</button>}
        </>
      )}
      {kind === 'poop' && <div className="smart-choice-list">{poopOptions.map((status) => <button type="button" className={poopStatus === status ? 'selected' : ''} key={status} onClick={() => { onPoopStatus(status); onPoopSave(status) }}>{status}</button>)}</div>}
      {kind === 'shed' && <div className="smart-choice-list">{shedOptions.map((status) => <button type="button" className={shedStatus === status ? 'selected' : ''} key={status} onClick={() => { onShedStatus(status); onShedSave(status) }}>{status}</button>)}</div>}
      {kind === 'water' && <div className="smart-choice-list">{waterOptions.map((option) => <button type="button" key={option} onClick={() => onWaterSave(option)}>{option}</button>)}</div>}
      {kind === 'cleaning' && <div className="smart-choice-list">{cleaningOptions.map((option) => <button type="button" key={option} onClick={() => onCleaningSave(option)}>{option}</button>)}</div>}
      {kind === 'medicine' && <><div className="smart-recent-section"><strong>최근 복용</strong>{recentMedicines.length > 0 ? <div className="smart-choice-list">{recentMedicines.map((medicine) => <button type="button" key={medicine} onClick={() => { const [name, dose] = medicine.split(' · '); onMedicineName(name); onMedicineDose(dose ?? '') }}>{medicine}</button>)}</div> : <p className="smart-empty">최근 복용 기록이 없어요.</p>}</div><div className="smart-medicine-fields"><input value={medicineName} onChange={(event) => onMedicineName(event.target.value)} placeholder="약 이름" /><input value={medicineDose} onChange={(event) => onMedicineDose(event.target.value)} placeholder="복용량 (예: 0.5ml)" /></div>{medicineReady && <button className="smart-save-button" type="button" onClick={onMedicineSave}>이 내용으로 기록</button>}</>}
      {kind === 'hospital' && <><input className="smart-hospital-input" value={hospitalName} onChange={(event) => onHospitalName(event.target.value)} placeholder="병원명 또는 진료 내용" autoFocus />{hospitalReady && <button className="smart-save-button" type="button" onClick={onHospitalSave}>이 내용으로 기록</button>}</>}
    </div>
  )
}

function Calendar({
  month,
  selectedDate,
  records,
  onMove,
  onSelect,
}: {
  month: Date
  selectedDate: string
  records: PetRecord[]
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
          const calendarItems = dayRecords
            .map((record) => ({ id: record.id, label: recordMeta[record.type].label, className: record.type }))
            .filter((item, index, items) => index === items.findIndex((value) => value.label === item.label))
          return (
            <button
              key={key}
              className={`calendar-day ${key === selectedDate ? 'selected' : ''} ${day.getMonth() !== month.getMonth() ? 'muted' : ''}`}
              onClick={() => onSelect(key)}
            >
              <span className="day-head">
                <span className="day-number">{day.getDate()}</span>
              </span>
              <span className="calendar-tags" aria-label={`${dayRecords.length} records`}>
                {calendarItems.slice(0, 3).map((item) => (
                  <small className={`calendar-tag ${item.className}`} key={item.id}>{item.label}</small>
                ))}
                {calendarItems.length > 3 && <em>+{calendarItems.length - 3}</em>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function RecordDetailScreen({
  record,
  pet,
  readOnly,
  onBack,
  onDelete,
}: {
  record: PetRecord
  pet?: DiaryPet
  readOnly?: boolean
  onBack: () => void
  onDelete: () => void
}) {
  return (
    <main className="diary-create-screen record-detail-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>상세 보기</strong>
        <span />
      </header>
      <section className="record-detail-view">
        <div className="record-detail-title">
          <span>{recordMeta[record.type].icon}</span>
          <div>
            <h1>{recordMeta[record.type].label}</h1>
            <p>{pet?.name ?? '펫 없음'} · {formatDate(record.date)}</p>
          </div>
        </div>

        <dl className="record-detail-list">
          <div><dt>종류</dt><dd>{recordMeta[record.type].label}</dd></div>
          <div><dt>날짜</dt><dd>{formatDate(record.date)}</dd></div>
          {record.type === 'weight' && record.weight !== undefined && <div><dt>무게</dt><dd>{formatWeightValue(record.weight)}g</dd></div>}
          {record.foods?.length ? <div><dt>먹이</dt><dd>{record.foods.join(', ')}</dd></div> : null}
          {record.memo && <div><dt>메모</dt><dd>{record.memo}</dd></div>}
        </dl>

        {record.photoUrl && <div className="record-detail-photo"><img src={record.photoUrl} alt="" /></div>}
        {!readOnly && <button className="record-detail-delete" type="button" onClick={onDelete}>삭제</button>}
      </section>
    </main>
  )
}

function createRecordDraftInitialValue(type: PetRecordType, pet: DiaryPet): RecordDraft {
  return {
    type,
    foods: [],
    customFood: '',
    weight: type === 'weight' ? getPetWeightInGrams(pet) : '',
    status: '',
    hospital: '',
    memo: '',
  }
}

function createRoutineRecordDraft(type: PetRecordType, pet: DiaryPet, reminder: Reminder): RecordDraft {
  const base = createRecordDraftInitialValue(type, pet)
  const label = planLabel(reminder)
  if (type === 'food') return { ...base, customFood: label === '먹이 주기' ? '' : label }
  if (type === 'weight') return base
  if (type === 'cleaning') return { ...base, status: label }
  return { ...base, hospital: label, status: label }
}

function useWritingBrowserBack(step: number, onBack: () => void, onStepChange?: (step: number) => void) {
  const stepRef = useRef(step)
  const backRef = useRef(onBack)
  const changeRef = useRef(onStepChange)
  useEffect(() => {
    stepRef.current = step
    backRef.current = onBack
    changeRef.current = onStepChange
  }, [onBack, onStepChange, step])
  useEffect(() => {
    window.history.pushState({ exoPetDiaryCreate: true }, '', window.location.href)
    const handleBack = () => {
      if (stepRef.current > 0) {
        const previousStep = stepRef.current - 1
        stepRef.current = previousStep
        changeRef.current?.(previousStep)
        window.history.pushState({ exoPetDiaryCreate: true, step: previousStep }, '', window.location.href)
      } else {
        backRef.current()
      }
    }
    window.addEventListener('popstate', handleBack)
    return () => window.removeEventListener('popstate', handleBack)
  }, [])
}

function RecordCreateScreen({
  pet,
  type,
  date,
  initialDraft,
  onBack,
  onSave,
  onSaveDraft,
}: {
  pet: DiaryPet
  type: PetRecordType
  date: string
  initialDraft?: RecordDraft
  onBack: () => void
  onSave: (draft: RecordDraft) => void
  onSaveDraft?: (draft: RecordDraft, step: number) => void
}) {
  const steps = ['detail', 'photo']
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [draft, setDraft] = useState<RecordDraft>(initialDraft ?? createRecordDraftInitialValue(type, pet))
  useWritingBrowserBack(step, onBack, setStep)
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
        <strong>기록</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <StepProgress currentStep={step} stepCount={steps.length} onStepChange={setStep} />
        <p className="create-keyword" aria-label="작성 키워드">기록</p>
        <div className="create-title">
          <h1>{recordMeta[type].icon} {recordMeta[type].label}</h1>
          <p>{pet.name} · {date} · {step + 1}/{steps.length}</p>
        </div>
        <div className="create-content">
          {current === 'detail' && <RecordDetail draft={draft} update={update} />}
          {current === 'photo' && <PhotoPicker value={draft.photo} onChange={(photo) => update({ photo })} />}
        </div>
        <div className="step-actions">
          <button type="button" className="create-submit secondary diary-draft-corner" onClick={() => onSaveDraft?.(draft, step)}>임시저장</button>
          <button type="button" className="create-submit secondary diary-step-back" onClick={() => step ? setStep(step - 1) : onBack()} disabled={step === 0}>이전</button>
          <button className="create-submit" disabled={current === 'detail' && !validateDetail(draft)}>{step === steps.length - 1 ? '작성 완료' : '다음'}</button>
        </div>
      </form>
    </main>
  )
}

function RecordDetail({ draft, update }: { draft: RecordDraft; update: (patch: Partial<RecordDraft>) => void }) {
  if (draft.type === 'food') return <ChoiceField label="먹이 종류" options={['귀뚜라미', '밀웜', '채소', '사료', '기타']} values={draft.foods} multiple onChange={(foods) => update({ foods })} custom={draft.customFood} onCustom={(customFood) => update({ customFood })} />
  if (draft.type === 'weight') return <WeightField value={draft.weight} onChange={(weight) => update({ weight })} />
  if (draft.type === 'shed') return <ChoiceField label="탈피 상태를 선택하세요" options={['탈피 중', '탈피 완료', '부분 탈피', '이상 있음', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'poop') return <ChoiceField label="배변 상태를 선택하세요" options={['정상', '묽음', '없음', '이상 있음', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'cleaning') return <ChoiceField label="청소 범위를 선택하세요" options={['전체 청소', '부분 청소', '물그릇', '바닥재', '기타']} values={[draft.status]} onChange={([status]) => update({ status })} />
  if (draft.type === 'hospital') return <label>병원<input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="병원 이름" /></label>
  return <label>기록 내용<input value={draft.hospital} onChange={(event) => update({ hospital: event.target.value })} placeholder="확인한 값이나 상태를 짧게 입력" /></label>
}

function WeightField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const adjust = (amount: number) => {
    const current = Number(value || 0)
    const next = Math.max(0, Math.round((current + amount) * 10) / 10)
    onChange(formatWeightValue(next))
  }

  return (
    <div className="weight-step-field">
      <label>무게<input type="number" min="0" step="0.1" value={value} onChange={(event) => onChange(event.target.value)} placeholder="g" /></label>
      <div className="weight-step-buttons" aria-label="무게 빠른 조절">
        <button type="button" onClick={() => adjust(-1)}>-1g</button>
        <button type="button" onClick={() => adjust(-0.1)}>-0.1g</button>
        <button type="button" onClick={() => adjust(0.1)}>+0.1g</button>
        <button type="button" onClick={() => adjust(1)}>+1g</button>
      </div>
    </div>
  )
}

function ReminderCreateScreen({
  pets,
  selectedPetId,
  existingReminders,
  initialReminder,
  onBack,
  onSave,
  onSaveDraft,
}: {
  pets: DiaryPet[]
  selectedPetId: string
  existingReminders: Reminder[]
  initialReminder: Reminder | null
  onBack: () => void
  onSave: (reminders: Reminder[]) => void
  onSaveDraft?: (reminder: Reminder, step: number) => void
}) {
  const petId = initialReminder?.petId ?? selectedPetId ?? pets[0]?.id ?? ''
  const selectedPet = pets.find((pet) => pet.id === petId)
  const recommendedTypes = routineRecommendations[selectedPet?.group ?? 'other'] ?? routineRecommendations.other
  const existingTypes = new Set(existingReminders
    .filter((reminder) => reminder.petId === petId && reminder.isActive && reminder.id !== initialReminder?.id && reminder.reminderType !== 'medicine' && reminder.reminderType !== 'custom')
    .map((reminder) => reminder.reminderType))
  const firstAvailableType = recommendedTypes.find((type) => !existingTypes.has(type)) ?? reminderTypes.find((type) => !existingTypes.has(type))
  const [routineTypes, setRoutineTypes] = useState<ReminderType[]>(initialReminder ? [initialReminder.reminderType] : firstAvailableType ? [firstAvailableType] : [])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>(initialReminder?.weekdays ?? [])
  const [startDate, setStartDate] = useState(initialReminder?.startDate ?? initialReminder?.reminderDate ?? toDateKey(new Date()))
  const [endDate, setEndDate] = useState(initialReminder?.endDate ?? '')
  const [showAllRoutines, setShowAllRoutines] = useState(Boolean(initialReminder))
  const [customRoutineName, setCustomRoutineName] = useState(initialReminder?.reminderType === 'custom' ? initialReminder.title.replace(selectedPet?.name ?? '', '').trim() : '')
  useWritingBrowserBack(0, onBack)
  const primaryRoutineType = routineTypes[0] ?? firstAvailableType ?? 'custom'
  const displayedTypes = showAllRoutines
    ? Array.from(new Set([...recommendedTypes, 'custom' as ReminderType]))
    : Array.from(new Set([...recommendedTypes.slice(0, 6), 'custom' as ReminderType, ...routineTypes]))
  const routineInputDescription = routineTypes.length === 0
    ? '이미 등록된 루틴은 다시 추가할 수 없습니다.'
    : initialReminder
    ? routineInputLabel(reminderMeta[primaryRoutineType])
    : routineTypes.length > 1
      ? `${routineTypes.length}개 루틴을 같은 반복 요일로 추가합니다.`
      : routineInputLabel(reminderMeta[primaryRoutineType])
  const hasCustomRoutine = routineTypes.includes('custom')
  const customRoutineExists = hasCustomRoutine && existingReminders.some((reminder) => reminder.petId === petId && reminder.isActive && reminder.id !== initialReminder?.id && reminder.reminderType === 'custom' && planLabel(reminder) === customRoutineName.trim())
  const valid = Boolean(petId && routineTypes.length > 0 && selectedWeekdays.length > 0 && startDate && (!endDate || endDate >= startDate) && (!hasCustomRoutine || (customRoutineName.trim().length > 0 && !customRoutineExists)))
  const toggleRoutineType = (type: ReminderType) => {
    if (initialReminder) {
      if (!existingTypes.has(type)) setRoutineTypes([type])
      return
    }
    if (existingTypes.has(type)) return
    setRoutineTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])
  }
  const buildReminder = (reminderType: ReminderType, index = 0): Reminder => ({
    id: initialReminder && index === 0 ? initialReminder.id : crypto.randomUUID(),
    petId,
    title: reminderType === 'custom' ? customRoutineName.trim() : `${pets.find((pet) => pet.id === petId)?.name ?? ''} ${reminderMeta[reminderType].label}`.trim(),
    reminderType,
    scheduleType: 'repeat',
    weekdays: selectedWeekdays,
    startDate,
    endDate: endDate || undefined,
    reminderDate: '',
    reminderTime: '',
    memo: '',
    isActive: true,
    createdAt: initialReminder && index === 0 ? initialReminder.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: initialReminder && index === 0 ? initialReminder.completedAt : undefined,
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onSave(routineTypes.map((type, index) => buildReminder(type, index)))
  }
  return (
    <main className="diary-create-screen">
      <header>
        <button type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>관리 루틴</strong>
        <span />
      </header>
      <form onSubmit={submit}>
        <p className="create-keyword" aria-label="작성 키워드">루틴</p>
        <div className="create-title">
          <h1>{initialReminder ? '루틴 수정' : '루틴 설정'}</h1>
        </div>
        <div className="create-content">
          <p className="selected-pet-inline">대상 펫: <strong>{selectedPet?.name ?? '현재 펫'}</strong>{selectedPet && <span> · {selectedPet.species}</span>}</p>
          <div className="routine-recommendation-field">
            <label>{selectedPet ? `${animalGroupLabel(selectedPet.group)} 추천 루틴` : '관리 항목'}</label>
            <div>
              {displayedTypes.map((key) => (
                <button type="button" className={routineTypes.includes(key) ? 'selected' : ''} disabled={existingTypes.has(key)} key={key} onClick={() => toggleRoutineType(key)}>
                  <span>{reminderMeta[key].icon}</span>
                  <strong>{reminderMeta[key].label}</strong>
                  {existingTypes.has(key) && <em>이미 있음</em>}
                </button>
              ))}
            </div>
            {!showAllRoutines && <button className="routine-more-button" type="button" onClick={() => setShowAllRoutines(true)}>더 보기</button>}
            <small>{routineInputDescription}</small>
            {hasCustomRoutine && <label className="custom-routine-name-field">루틴 이름<input value={customRoutineName} onChange={(event) => setCustomRoutineName(event.target.value)} placeholder="예: 환기하기" /></label>}
            {customRoutineExists && <p className="routine-field-error">이미 같은 이름의 직접 입력 루틴이 있어요.</p>}
          </div>
          <label>반복 요일</label>
          <div className="weekday-picker">
            {weekdays.map((day, index) => (
              <button type="button" className={selectedWeekdays.includes(index) ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.includes(index) ? selectedWeekdays.filter((item) => item !== index) : [...selectedWeekdays, index])} key={day}>{day}</button>
            ))}
            <button type="button" className={selectedWeekdays.length === 7 ? 'selected' : ''} onClick={() => setSelectedWeekdays(selectedWeekdays.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6])}>매일</button>
          </div>
          <label>시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>종료일 (선택)<input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        <div className="step-actions">
          <button type="button" className="create-submit secondary diary-draft-corner" onClick={() => onSaveDraft?.(buildReminder(primaryRoutineType), 0)}>임시저장</button>
          <button type="button" className="create-submit secondary diary-step-back" onClick={onBack}>이전</button>
          <button className="create-submit" disabled={!valid}>저장</button>
        </div>
      </form>
    </main>
  )
}

function StepProgress({ currentStep, stepCount, onStepChange }: { currentStep: number; stepCount: number; onStepChange: (step: number) => void }) {
  return (
    <div className="step-progress step-progress-selectable" role="tablist" aria-label="작성 단계">
      <span className="step-progress-fill" style={{ width: `${((currentStep + 1) / stepCount) * 100}%` }} />
      {Array.from({ length: stepCount }, (_, index) => (
        <button key={index} className={index === currentStep ? 'active' : ''} type="button" role="tab" aria-selected={index === currentStep} aria-label={`${index + 1}단계`} onClick={() => onStepChange(index)}>
          <span>{index + 1}</span>
        </button>
      ))}
    </div>
  )
}

function ChoiceField({
  label,
  options,
  labels,
  values,
  onChange,
  multiple = false,
  custom,
  onCustom,
}: {
  label: string
  options: string[]
  labels?: Record<string, string>
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
          <button type="button" className={values.includes(option) ? 'selected' : ''} onClick={() => onChange(multiple ? values.includes(option) ? values.filter((item) => item !== option) : [...values, option] : [option])} key={option}>{labels?.[option] ?? option}</button>
        ))}
      </div>
      {onCustom && <input value={custom} onChange={(event) => onCustom(event.target.value)} placeholder="직접 입력" />}
    </div>
  )
}

function PhotoPicker({ value, onChange }: { value?: string; onChange: (value?: string) => void }) {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }
  return (
    <label className="photo-picker">
      사진
      <span>
        <b>{value ? '사진 선택됨' : '사진 선택'}</b>
        <input type="file" accept="image/*" onChange={choose} />
      </span>
    </label>
  )
}

function DateRecordsScreen({ date, records, onBack, onOpenRecord, onDelete, onAddMemo }: { date: string; records: PetRecord[]; onBack: () => void; onOpenRecord: (id: string) => void; onDelete: (id: string) => void; onAddMemo: (memo: string) => void }) {
  const [memo, setMemo] = useState('')
  const saveMemo = () => {
    const nextMemo = memo.trim()
    if (!nextMemo) return
    onAddMemo(nextMemo)
    setMemo('')
  }

  return <main className="diary-create-screen date-records-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>{formatDate(date)} 기록</strong><span /></header><section className="date-records-content">{records.length ? records.map((record) => <article key={record.id}><button type="button" onClick={() => onOpenRecord(record.id)}><span className="selected-date-record-icon">{recordMeta[record.type].icon}</span><span><strong>{recordMeta[record.type].label}</strong><small>{recordSummary(record)}</small></span></button><button type="button" aria-label="기록 삭제" onClick={() => onDelete(record.id)}>×</button></article>) : <p>이 날짜에 작성된 기록이 없어요.</p>}</section><section className="date-memo-composer"><label>메모<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="이 날짜에 남길 메모" /></label><button type="button" disabled={!memo.trim()} onClick={saveMemo}>메모 추가</button></section></main>
}

function DataVisualization({ records, petName }: { records: PetRecord[]; petName: string }) {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'pie'>('line')
  const categoryLabels = ['먹이', '물 교체', '청소', '배변', '약', '진료']
  const categoryIcons = ['🍽', '💧', '🧹', '💩', '💊', '🏥']
  const getCategory = (record: PetRecord) => {
    if (record.type === 'food') return '먹이'
    if (record.type === 'cleaning') return '청소'
    if (record.type === 'poop') return '배변'
    if (record.type === 'hospital') return '진료'
    const memo = record.memo ?? ''
    if (memo.includes('약')) return '약'
    if (memo.includes('물')) return '물 교체'
    return null
  }
  const supportedRecords = records.filter((record) => getCategory(record))
  const dateLabels = [...new Set(supportedRecords.map((record) => record.date))].sort()
  const dateCounts = dateLabels.map((date) => supportedRecords.filter((record) => record.date === date).length)
  const dateActivities = dateLabels.map((date) => [...new Set(supportedRecords.filter((record) => record.date === date).map((record) => getCategory(record)).filter((value) => value !== null))])
  const total = supportedRecords.length
  const max = Math.max(1, ...dateCounts)
  const width = 520
  const height = 220
  const points = dateCounts.map((count, index) => ({ count, x: dateCounts.length === 1 ? width / 2 : 36 + (index / (dateCounts.length - 1)) * (width - 72), y: height - 34 - (count / max) * (height - 66) }))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  if (total === 0) return <div className="data-visualization"><header><div><h2>{petName} 데이터 시각화</h2><p>기록 종류별 빈도</p></div></header><div className="data-visualization-empty">아직 시각화할 기록이 없어요.</div></div>
  return (
    <div className="data-visualization">
      <header><div><h2>{petName} 데이터 시각화</h2><p>기록 종류별 빈도</p></div></header>
      <div className="chart-type-switcher" role="tablist" aria-label="그래프 유형">
        <button className={chartType === 'line' ? 'active' : ''} type="button" onClick={() => setChartType('line')}>꺾은선</button>
        <button className={chartType === 'bar' ? 'active' : ''} type="button" onClick={() => setChartType('bar')}>막대</button>
        <button className={chartType === 'pie' ? 'active' : ''} type="button" onClick={() => setChartType('pie')}>원그래프</button>
      </div>
      <div className="line-chart-wrap">
        <svg className={`line-chart ${chartType}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${petName} 기록 빈도 그래프`}>
          <line x1="28" y1="20" x2="28" y2={height - 28} /><line x1="28" y1={height - 28} x2={width - 28} y2={height - 28} />
          {chartType === 'line' && <path className="line-chart-path" d={path} />}
          {chartType !== 'pie' && points.map(({ count, x, y }, index) => <g key={dateLabels[index]}>{chartType === 'bar' && <rect className="bar-chart-bar" x={x - 18} y={y} width="36" height={height - 34 - y} rx="5" />}{chartType === 'line' && <circle cx={x} cy={y} r="5" /> }<title>{`${dateLabels[index]} · ${dateActivities[index].join(', ')} · ${count}개`}</title></g>)}
        </svg>
        {chartType === 'pie' ? <div className="pie-chart" style={{ background: `conic-gradient(${buildPieGradient(dateCounts)})` }} aria-label="날짜별 기록 빈도 원그래프" /> : <div className="line-chart-scale"><span>{max}개</span><span>0개</span></div>}
      </div>
      <div className="line-chart-labels">{dateLabels.map((label, index) => <span key={label}><strong>{formatDate(label)}</strong><em>{dateActivities[index].map((activity) => `${categoryIcons[categoryLabels.indexOf(activity)]} ${activity}`).join(' · ')}</em><b>{dateCounts[index]}개</b></span>)}</div>
      <div className="data-visualization-summary"><strong>총 {total}개 기록</strong><span>날짜별 활동과 빈도</span></div>
    </div>
  )
}

function buildPieGradient(counts: number[]) {
  const colors = ['#0a9f91', '#5bb8a7', '#8c72c8', '#b47b54', '#e0a04b', '#52708d']
  const total = Math.max(1, counts.reduce((sum, count) => sum + count, 0))
  let cursor = 0
  return counts.map((count, index) => { const next = cursor + (count / total) * 360; const value = `${colors[index]} ${cursor}deg ${next}deg`; cursor = next; return value }).join(', ')
}

function DataVisualizationScreen({ records, petName, onBack }: { records: PetRecord[]; petName: string; onBack: () => void }) {
  return <main className="diary-create-screen data-visualization-screen"><header><button type="button" aria-label="뒤로가기" onClick={onBack}>←</button><strong>데이터 시각화</strong><span /></header><DataVisualization records={records} petName={petName} /></main>
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <div className="diary-overlay"><button className="diary-dim" aria-label="닫기" onClick={onClose} /><section className="diary-modal">{children}</section></div>
}

function validateDetail(draft: RecordDraft) {
  if (draft.type === 'food') return draft.foods.length > 0 || draft.customFood.trim().length > 0
  if (draft.type === 'weight') return Number(draft.weight) > 0
  if (draft.type === 'hospital') return draft.hospital.trim().length > 0
  if (draft.type === 'other') return draft.hospital.trim().length > 0 || draft.status.trim().length > 0
  return draft.status.length > 0
}

function getPetWeightInGrams(pet: DiaryPet) {
  const rawWeight = Number(pet.weight)
  if (!Number.isFinite(rawWeight) || rawWeight <= 0) return ''
  const grams = pet.weightUnit === 'kg' ? rawWeight * 1000 : rawWeight
  return formatWeightValue(grams)
}

function formatWeightValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

function carePlanToReminder(plan: CarePlan): Reminder {
  return {
    id: plan.id,
    petId: plan.petId,
    title: plan.title,
    reminderType: plan.taskType,
    scheduleType: 'repeat',
    weekdays: plan.repeatDays,
    startDate: plan.startDate,
    endDate: plan.endDate,
    reminderDate: '',
    reminderTime: '',
    memo: '',
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }
}

function medicationTaskReminder(task: DailyTask): Reminder | undefined {
  if (!task.medicationPlanId || !task.taskType.startsWith('medicine|')) return undefined
  const [, name = '처방약', dose = ''] = task.taskType.split('|')
  return {
    id: task.medicationPlanId,
    petId: task.petId,
    title: `약 · ${name}${dose ? ` · ${dose}` : ''}`,
    reminderType: 'medicine',
    scheduleType: 'repeat',
    weekdays: [],
    startDate: task.scheduledDate,
    reminderDate: task.scheduledDate,
    reminderTime: '',
    memo: '',
    isActive: true,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function reminderToCarePlan(reminder: Reminder): CarePlan {
  return {
    id: reminder.id,
    userId: reminder.userId ?? '',
    petId: reminder.petId,
    taskType: reminder.reminderType === 'medicine' ? 'custom' : reminder.reminderType,
    title: reminder.title,
    repeatDays: reminder.weekdays,
    startDate: reminder.startDate ?? reminder.reminderDate ?? toDateKey(new Date()),
    endDate: reminder.endDate,
    isActive: reminder.isActive,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt ?? new Date().toISOString(),
  }
}

function getRecordMemo(draft: RecordDraft) {
  if (draft.memo.trim()) return draft.memo.trim()
  if (draft.type === 'food') return [...draft.foods, draft.customFood].filter(Boolean).join(', ')
  if (draft.type === 'weight') return `${draft.weight}g`
  if (draft.type === 'hospital' || draft.type === 'other') return draft.hospital
  return draft.status || '기록'
}

function recordSummary(record: PetRecord) {
  if (record.type === 'food' && record.foods?.length) return record.foods.join(', ')
  if (record.type === 'weight' && record.weight !== undefined) return `${formatWeightValue(record.weight)}g`
  return record.memo?.trim() || recordMeta[record.type].label
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

function reminderOccursOn(reminder: Reminder, date: Date) {
  const dateKey = toDateKey(date)
  const startDate = reminder.startDate ?? reminder.reminderDate
  if (startDate && dateKey < startDate) return false
  if (reminder.endDate && dateKey > reminder.endDate) return false
  return reminder.weekdays.includes(date.getDay())
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatReminderSchedule(reminder: Reminder) {
  const days = reminder.weekdays.map((day) => weekdays[day]).join('·')
  return `${days} · ${reminder.startDate ?? reminder.reminderDate}${reminder.endDate ? ` ~ ${reminder.endDate}` : ''}`
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
