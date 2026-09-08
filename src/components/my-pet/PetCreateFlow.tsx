import { type ChangeEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import './MyPet.css'
import type { AnimalCategory, DraftItem, Pet } from '../../types/app'
import { validateImageFile } from '../../lib/imageStorage'
import { RequiredMark } from '../common/FieldMarkers'
import { PetIcon, PetIconMark } from './PetIcons'

type SupportedPetCategory = 'reptile' | 'amphibian'
type PendingPhoto = { url: string; file: File; position: { x: number; y: number } }
type Props = {
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
function isSupported(value?: AnimalCategory | ''): value is SupportedPetCategory {
  return value === 'reptile' || value === 'amphibian'
}

function sanitizeDecimal(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const [integer = '', ...decimal] = cleaned.split('.')
  return decimal.length ? `${integer.slice(0, 5)}.${decimal.join('').slice(0, 2)}` : integer.slice(0, 5)
}

export default function PetCreateFlow({ initialPet, initialDraft, categoryOptions, categoryLabels, speciesOptions, onClose, onSave }: Props) {
  const initialGroup = isSupported(initialPet?.group) ? initialPet.group : ''
  const [step, setStep] = useState(Math.min(initialDraft?.step ?? 0, 1))
  const [completedPet, setCompletedPet] = useState<Pet | null>(null)
  const [name, setName] = useState(initialPet?.name ?? '')
  const [group, setGroup] = useState<SupportedPetCategory | ''>(initialGroup)
  const knownInitialSpecies = initialGroup && speciesOptions[initialGroup].includes(initialPet?.species ?? '')
  const [species, setSpecies] = useState(knownInitialSpecies ? initialPet?.species ?? '' : '')
  const [customSpecies, setCustomSpecies] = useState(knownInitialSpecies ? '' : initialPet?.species ?? '')
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
    id: initialPet?.id ?? crypto.randomUUID(), name: name.trim().slice(0, 24), group: group || 'reptile', species: resolvedSpecies,
    gender: gender || 'unknown', photo, photoPosition, birthday: birthday || undefined, adoptionDate: adoptionDate || undefined,
    description: description.trim().slice(0, 80) || undefined, memo: memo.trim().slice(0, 300) || undefined,
    weight: weight || undefined, weightUnit, registeredAt: initialPet?.registeredAt ?? new Date().toISOString(),
  })

  const save = async () => {
    if (!canContinue) return
    try {
      setSaveError('')
      const pet = buildPet()
      await onSave(pet, photoFile)
      if (initialPet) onClose()
      else setCompletedPet(pet)
    } catch {
      setSaveError('반려동물 정보를 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  if (completedPet) return <main className="pet-reference-complete"><section><PetIconMark name="pet" className="pet-reference-complete-mark"/><PetIconMark name="check" className="pet-reference-complete-check"/><h1>반려동물이<br/>정상적으로 등록되었어요!</h1><button type="button" onClick={onClose}>확인</button></section></main>

  const categories = categoryOptions.filter(isSupported)
  return <main className="pet-reference-create">
    <header><button type="button" onClick={onClose}>취소</button><h1>{initialPet ? '반려동물 수정' : '반려동물 등록'}</h1><span /></header>
    <form onSubmit={(event) => { event.preventDefault(); if (step === 0) setStep(1); else void save() }}>
      <section className="pet-reference-form-body">
        <p className="pet-reference-step-label">{step + 1}/2 {step === 0 ? '기본 정보' : '추가 정보'}</p>
        {step === 0 ? <>
          <label className="pet-reference-photo"><input type="file" accept="image/*" onChange={attachPhoto}/><span>{photo ? <img src={photo} alt="반려동물 사진 미리보기" style={{ objectPosition: `${photoPosition.x}% ${photoPosition.y}%` }}/> : <PetIcon name="camera"/>}</span><small>사진을 추가해주세요<br/>(선택)</small></label>
          <label className="pet-reference-field"><span>이름 <RequiredMark/></span><input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력해주세요"/></label>
          <label className="pet-reference-field"><span>종 <RequiredMark/></span><select value={species ? `${group}|${species}` : customSpecies ? 'custom' : ''} onChange={(event) => { if (event.target.value === 'custom') { setSpecies(''); setCustomSpecies(''); return } const [nextGroup, nextSpecies] = event.target.value.split('|') as [SupportedPetCategory, string]; setGroup(nextGroup); setSpecies(nextSpecies); setCustomSpecies('') }}><option value="">종을 선택해주세요</option>{categories.map((category) => <optgroup label={categoryLabels[category]} key={category}>{speciesOptions[category].map((item) => <option value={`${category}|${item}`} key={item}>{item}</option>)}</optgroup>)}<option value="custom">직접 입력</option></select></label>
          {(!species && (customSpecies || group)) ? <div className="pet-reference-custom"><div>{categories.map((category) => <button className={group === category ? 'active' : ''} type="button" key={category} onClick={() => setGroup(category)}>{categoryLabels[category]}</button>)}</div><input value={customSpecies} maxLength={40} onChange={(event) => setCustomSpecies(event.target.value)} placeholder="종을 직접 입력해주세요" aria-label="종 직접 입력"/></div> : null}
          <fieldset className="pet-reference-gender"><legend>성별 <RequiredMark/></legend><div>{(['male','female','unknown'] as const).map((value) => <button className={gender === value ? 'active' : ''} type="button" key={value} aria-pressed={gender === value} onClick={() => setGender(value)}><PetIcon name={value === 'male' ? 'male' : value === 'female' ? 'female' : 'unknown'}/>{value === 'male' ? '수컷' : value === 'female' ? '암컷' : '미구분'}</button>)}</div></fieldset>
          <label className="pet-reference-field optional"><span>현재 몸무게 (선택)</span><div className="pet-reference-weight"><input inputMode="decimal" value={weight} onChange={(event) => setWeight(sanitizeDecimal(event.target.value))} placeholder="숫자 입력"/><div>{(['g','kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</div></div></label>
        </> : <>
          <label className="pet-reference-field"><span>생년월일</span><span className="pet-reference-date"><input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)}/><PetIcon name="calendar"/></span></label>
          <label className="pet-reference-field"><span>입양일</span><span className="pet-reference-date"><input type="date" value={adoptionDate} onChange={(event) => setAdoptionDate(event.target.value)}/><PetIcon name="calendar"/></span></label>
          <label className="pet-reference-field"><span>특징 (선택)</span><textarea value={description} maxLength={80} onChange={(event) => setDescription(event.target.value)} placeholder="예) 색, 크기, 성격 등"/></label>
          <label className="pet-reference-field"><span>메모 (선택)</span><textarea value={memo} maxLength={300} onChange={(event) => setMemo(event.target.value)} placeholder="추가로 기록할 내용이 있나요?"/></label>
        </>}
        {saveError ? <p className="pet-reference-error" role="alert">{saveError}</p> : null}
      </section>
      <footer>{step === 1 ? <button className="secondary" type="button" onClick={() => setStep(0)}>이전</button> : null}<button className="primary" type="submit" disabled={step === 0 && !canContinue}>{step === 0 ? '다음' : initialPet ? '저장' : '등록 완료'}</button></footer>
    </form>
    {pendingPhoto ? <div className="pet-photo-preview-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) cancelPhoto() }}><section className="pet-photo-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-photo-preview-title"><div className="pet-photo-preview-header"><button type="button" onClick={cancelPhoto}>취소</button><h2 id="pet-photo-preview-title">사진 조정</h2><button type="button" onClick={applyPhoto}>적용</button></div><div className="pet-photo-preview-body"><p>사진을 움직여 위치를 맞춰주세요.</p><div className="pet-photo-preview-frame" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); movePendingPhoto(event) }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) movePendingPhoto(event) }} onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}><img src={pendingPhoto.url} alt="조정 중인 반려동물 사진" style={{ objectPosition: `${pendingPhoto.position.x}% ${pendingPhoto.position.y}%` }} draggable={false}/><span className="pet-photo-preview-guide" aria-hidden="true"/></div><small>상하좌우로 드래그해 조정할 수 있어요.</small></div></section></div> : null}
  </main>
}
