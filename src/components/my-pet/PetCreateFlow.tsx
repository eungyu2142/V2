import { type ChangeEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { AnimalCategory, DraftItem, Pet } from '../../types/app'
import { validateImageFile } from '../../lib/imageStorage'
import { RequiredMark } from '../common/FieldMarkers'
import { saveCarePlan } from '../../features/diary/diaryService'
import type { CareTaskType } from '../../features/diary/diaryTypes'
import Mascot from '../common/Mascot'
import { PetIcon, type PetIconName } from './PetIcons'
import './PetFlow.css'

type SupportedPetCategory = 'reptile' | 'amphibian'
type PendingPhoto = { url: string; file: File; position: { x: number; y: number } }
type Props = {
  userId: string
  initialPet: Pet | null
  initialDraft?: DraftItem | null
  categoryOptions: Exclude<AnimalCategory, 'all'>[]
  categoryLabels: Record<AnimalCategory, string>
  speciesOptions: Record<Exclude<AnimalCategory, 'all'>, string[]>
  renderCategoryIcon: (category: AnimalCategory) => ReactNode
  onClose: () => void
  onSave: (pet: Pet, photoFile?: File) => void | Promise<void>
  onOpenPlan: (petId: string) => void
}

const defaultPosition = { x: 50, y: 50 }
const routineOptions: Array<{ key: string; type: CareTaskType; label: string; icon: PetIconName }> = [
  { key: 'feed', type: 'feed', label: '먹이', icon: 'feed' },
  { key: 'mist', type: 'mist', label: '분무', icon: 'mist' },
  { key: 'water', type: 'water', label: '물그릇', icon: 'water' },
  { key: 'temperature', type: 'temperature', label: '온도', icon: 'temperature' },
  { key: 'humidity', type: 'humidity', label: '습도', icon: 'mist' },
  { key: 'cleaning', type: 'cleaning', label: '청소', icon: 'cleaning' },
  { key: 'uvb_check', type: 'uvb_check', label: 'UVB', icon: 'uvb' },
  { key: 'spot', type: 'custom', label: '스팟', icon: 'spot' },
  { key: 'water_temperature', type: 'water_temperature', label: '수온', icon: 'temperature' },
  { key: 'weight', type: 'weight', label: '무게', icon: 'weight' },
  { key: 'medicine', type: 'medicine', label: '약', icon: 'medicine' },
]
function isSupported(value?: AnimalCategory | ''): value is SupportedPetCategory {
  return value === 'reptile' || value === 'amphibian'
}

function sanitizeDecimal(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const [integer = '', ...decimal] = cleaned.split('.')
  return decimal.length ? `${integer.slice(0, 5)}.${decimal.join('').slice(0, 2)}` : integer.slice(0, 5)
}

export default function PetCreateFlow({ userId, initialPet, initialDraft, categoryOptions, categoryLabels, speciesOptions, onClose, onSave }: Props) {
  const initialGroup = isSupported(initialPet?.group) ? initialPet.group : ''
  const [step, setStep] = useState(initialPet || initialDraft ? 1 : 0)
  const [petId] = useState(initialPet?.id ?? crypto.randomUUID())
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>([])
  const [routineIds] = useState(() => Object.fromEntries(routineOptions.map((option) => [option.key, crypto.randomUUID()])))
  const [saving, setSaving] = useState(false)
  const [completedPet, setCompletedPet] = useState<Pet | null>(null)
  const [name, setName] = useState(initialPet?.name ?? '')
  const [group, setGroup] = useState<SupportedPetCategory | ''>(initialGroup)
  const knownInitialSpecies = initialGroup && speciesOptions[initialGroup].includes(initialPet?.species ?? '')
  const [species, setSpecies] = useState(knownInitialSpecies ? initialPet?.species ?? '' : '')
  const [customSpecies, setCustomSpecies] = useState(knownInitialSpecies ? '' : initialPet?.species ?? '')
  const [customSpeciesMode, setCustomSpeciesMode] = useState(Boolean(initialPet?.species && !knownInitialSpecies))
  const [gender, setGender] = useState<Pet['gender'] | ''>(initialPet?.gender ?? '')
  const [photo, setPhoto] = useState(initialPet?.photo)
  const [photoFile, setPhotoFile] = useState<File>()
  const [photoPosition, setPhotoPosition] = useState(initialPet?.photoPosition ?? defaultPosition)
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null)
  const [birthday, setBirthday] = useState(initialPet?.birthday ?? '')
  const [adoptionDate, setAdoptionDate] = useState(initialPet?.adoptionDate ?? '')
  const [description, setDescription] = useState(initialPet?.description ?? '')
  const [memo, setMemo] = useState(initialPet?.memo ?? '')
  const [weight, setWeight] = useState(initialPet?.weight ?? '')
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>(initialPet?.weightUnit ?? 'g')
  const [saveError, setSaveError] = useState('')
  const appliedUrlRef = useRef('')
  const pendingUrlRef = useRef('')
  const resolvedSpecies = (species || customSpecies).trim().slice(0, 40)
  const canContinue = name.trim().length > 0 && Boolean(group) && resolvedSpecies.length > 0 && Boolean(gender)

  useEffect(() => () => {
    if (appliedUrlRef.current) URL.revokeObjectURL(appliedUrlRef.current)
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
  }, [])

  useEffect(() => {
    if (!pendingPhoto) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
      pendingUrlRef.current = ''
      setPendingPhoto(null)
    }
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [pendingPhoto])

  const attachPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      validateImageFile(file)
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
      const url = URL.createObjectURL(file)
      pendingUrlRef.current = url
      setPendingPhoto({ url, file, position: defaultPosition })
      setSaveError('')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '사진을 업로드하지 못했어요. 다시 시도해주세요.')
    }
  }

  const movePendingPhoto = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const position = { x: Math.round(Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100))), y: Math.round(Math.min(100, Math.max(0, (event.clientY - rect.top) / rect.height * 100))) }
    setPendingPhoto((current) => current ? { ...current, position } : current)
  }

  const cancelPhoto = () => {
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current)
    pendingUrlRef.current = ''
    setPendingPhoto(null)
  }

  const applyPhoto = () => {
    if (!pendingPhoto) return
    if (appliedUrlRef.current) URL.revokeObjectURL(appliedUrlRef.current)
    appliedUrlRef.current = pendingPhoto.url
    pendingUrlRef.current = ''
    setPhoto(pendingPhoto.url)
    setPhotoFile(pendingPhoto.file)
    setPhotoPosition(pendingPhoto.position)
    setPendingPhoto(null)
  }

  const buildPet = (): Pet => ({
    ...initialPet, id: petId, name: name.trim().slice(0, 24), group: group || 'reptile', species: resolvedSpecies,
    gender: gender || 'unknown', photo, photoPosition, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined,
    description: description.trim().slice(0, 80) || undefined, memo: memo.trim().slice(0, 300) || undefined,
    weight: weight || undefined, weightUnit, registeredAt: initialPet?.registeredAt ?? new Date().toISOString(),
  })

  const save = async () => {
    if (!canContinue || saving) return
    try {
      setSaving(true)
      setSaveError('')
      const pet = buildPet()
      await onSave(pet, photoFile)
      if (!initialPet) {
        const now = new Date().toISOString()
        const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        for (const option of routineOptions.filter((item) => selectedRoutines.includes(item.key))) {
          await saveCarePlan(userId, { id: routineIds[option.key], userId, petId: pet.id, taskType: option.type, title: option.label, repeatDays: [0, 1, 2, 3, 4, 5, 6], recurrenceType: 'weekdays', startDate, notificationTime: '09:00', isActive: true, createdAt: now, updatedAt: now })
        }
      }
      if (initialPet) onClose()
      else setCompletedPet(pet)
    } catch {
      setSaveError('펫 정보 또는 선택한 루틴을 저장하지 못했어요. 입력 내용은 유지돼요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (completedPet) return <main className="pet-flow pet-flow-create pet-flow-complete"><section><Mascot mood="happy"/><h1>{completedPet.name}가 등록되었어요!</h1></section><footer className="pet-flow-footer"><button className="pet-flow-primary" type="button" onClick={onClose}>내 펫 보기</button></footer></main>

  if (step === 0) return <main className="pet-flow pet-flow-create pet-flow-intro"><header className="pet-flow-header centered"><button className="pet-flow-icon-button" type="button" aria-label="뒤로가기" onClick={onClose}><PetIcon name="back"/></button><h1>펫 추가</h1><span/></header><section><Mascot mood="welcome"/><h2>새로운 가족을 맞이해요!</h2></section><footer className="pet-flow-footer"><button className="pet-flow-primary" type="button" onClick={() => setStep(1)}>시작하기</button></footer></main>

  const categories = categoryOptions.filter(isSupported)
  return <main className="pet-flow pet-flow-create">
    <header className="pet-flow-header centered"><button className="pet-flow-icon-button" type="button" aria-label="뒤로가기" disabled={saving} onClick={() => { if (initialPet) onClose(); else setStep((current) => current - 1) }}><PetIcon name="back"/></button><h1>{step === 2 ? '루틴 설정 (선택)' : initialPet ? '펫 정보 수정' : '펫 정보 입력'}</h1><span/></header>
    <form onSubmit={(event) => { event.preventDefault(); if (!canContinue) return; if (step === 1 && !initialPet) setStep(2); else void save() }}>
      <section className="pet-flow-form-body">
        {step === 1 ? <>
          <label className="pet-flow-photo-input"><input type="file" accept="image/*" aria-label="펫 사진 선택" onChange={attachPhoto}/><span>{photo ? <img src={photo} alt="반려동물 사진 미리보기" style={{ objectPosition: `${photoPosition.x}% ${photoPosition.y}%` }}/> : <PetIcon name="camera"/>}</span></label>
          <div className="pet-flow-fields">
            <label className="pet-flow-field"><span>이름 <RequiredMark/></span><input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="예) 청단이" required/></label>
            <label className="pet-flow-field"><span>세부 종명 <RequiredMark/></span><select value={customSpeciesMode ? 'custom' : species ? `${group}|${species}` : ''} onChange={(event) => { if (event.target.value === 'custom') { setCustomSpeciesMode(true); setSpecies(''); setGroup((current) => current || 'reptile'); return } const [nextGroup, nextSpecies] = event.target.value.split('|') as [SupportedPetCategory, string]; setGroup(nextGroup || ''); setSpecies(nextSpecies || ''); setCustomSpecies(''); setCustomSpeciesMode(false) }} required><option value="">예) 크레스티드 게코</option>{categories.map((category) => <optgroup label={categoryLabels[category]} key={category}>{speciesOptions[category].filter((item) => item !== '직접 입력').map((item) => <option value={`${category}|${item}`} key={item}>{item}</option>)}</optgroup>)}<option value="custom">직접 입력</option></select></label>
            {customSpeciesMode ? <div className="pet-flow-custom"><label className="pet-flow-field"><span>동물 분류</span><select value={group} onChange={(event) => setGroup(event.target.value as SupportedPetCategory)}>{categories.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select></label><label className="pet-flow-field"><span>종 직접 입력</span><input value={customSpecies} maxLength={40} onChange={(event) => setCustomSpecies(event.target.value)} placeholder="세부 종명을 입력해주세요" required/></label></div> : null}
            <fieldset className="pet-flow-gender"><legend>성별 <RequiredMark/></legend><div>{(['male', 'female', 'unknown'] as const).map((value) => <button className={gender === value ? 'active' : ''} type="button" key={value} aria-pressed={gender === value} onClick={() => setGender(value)}><PetIcon name={value === 'male' ? 'male' : value === 'female' ? 'female' : 'unknown'}/>{value === 'male' ? '수컷' : value === 'female' ? '암컷' : '미구분'}</button>)}</div></fieldset>
            <label className="pet-flow-field"><span>생년월일</span><input type="date" value={birthday} max={new Intl.DateTimeFormat('en-CA').format(new Date())} onChange={(event) => setBirthday(event.target.value)}/></label>
            <details className="pet-flow-extra"><summary>추가 정보 (선택)</summary><div>
              <label className="pet-flow-field"><span>현재 몸무게</span><span className="pet-flow-weight"><input inputMode="decimal" value={weight} aria-label="현재 몸무게" onChange={(event) => setWeight(sanitizeDecimal(event.target.value))} placeholder="숫자 입력"/><span>{(['g', 'kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} aria-pressed={weightUnit === unit} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</span></span></label>
              <label className="pet-flow-field"><span>입양일</span><input type="date" value={adoptionDate} onChange={(event) => setAdoptionDate(event.target.value)}/></label>
              <label className="pet-flow-field"><span>특징</span><textarea value={description} maxLength={80} onChange={(event) => setDescription(event.target.value)} placeholder="예) 색, 크기, 성격 등"/></label>
              <label className="pet-flow-field"><span>메모</span><textarea value={memo} maxLength={300} onChange={(event) => setMemo(event.target.value)} placeholder="추가로 기록할 내용을 입력해주세요"/></label>
            </div></details>
          </div>
        </> : <>
          <p className="pet-flow-routine-help">필요한 루틴만 선택해주세요.</p>
          <div className="pet-flow-routine-options">{routineOptions.map((option) => <label key={option.key}><PetIcon name={option.icon}/><span>{option.label}</span><input type="checkbox" checked={selectedRoutines.includes(option.key)} onChange={(event) => setSelectedRoutines((current) => event.target.checked ? [...current, option.key] : current.filter((key) => key !== option.key))}/></label>)}</div>
          <p className="pet-flow-form-note">선택한 루틴은 매일 오전 9시로 등록돼요. 루틴 관리에서 요일과 시간을 변경할 수 있어요.</p>
        </>}
        {saveError ? <p className="pet-flow-error" role="alert">{saveError}</p> : null}
      </section>
      <footer className="pet-flow-footer"><button className="pet-flow-primary" type="submit" disabled={!canContinue || saving}>{saving ? '저장 중…' : initialPet ? '저장하기' : '다음'}</button></footer>
    </form>
    {pendingPhoto ? <div className="pet-photo-preview-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) cancelPhoto() }}><section className="pet-photo-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-photo-preview-title"><div className="pet-photo-preview-header"><button type="button" onClick={cancelPhoto}>취소</button><h2 id="pet-photo-preview-title">사진 조정</h2><button type="button" onClick={applyPhoto}>적용</button></div><div className="pet-photo-preview-body"><p>사진을 움직여 위치를 맞춰주세요.</p><div className="pet-photo-preview-frame" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); movePendingPhoto(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePendingPhoto(event) }} onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}><img src={pendingPhoto.url} alt="조정 중인 반려동물 사진" style={{ objectPosition: `${pendingPhoto.position.x}% ${pendingPhoto.position.y}%` }} draggable={false}/><span className="pet-photo-preview-guide" aria-hidden="true"/></div><small>상하좌우로 드래그해 조정할 수 있어요.</small></div></section></div> : null}
  </main>
}
