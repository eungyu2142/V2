import { type ChangeEvent, type PointerEvent, type ReactNode, useState } from 'react'
import StepShell from '../account/StepShell'
import type { AnimalCategory, DraftItem, Pet } from '../../types/app'

type SupportedPetCategory = 'reptile' | 'amphibian'
type ReptileBranch = '도마뱀' | '뱀' | '거북이'
type AmphibianBranch = '개구리' | '도롱뇽'

type PetCreateFlowProps = {
  initialPet: Pet | null
  initialDraft?: DraftItem | null
  categoryOptions: Exclude<AnimalCategory, 'all'>[]
  categoryLabels: Record<AnimalCategory, string>
  speciesOptions: Record<Exclude<AnimalCategory, 'all'>, string[]>
  renderCategoryIcon: (category: AnimalCategory) => ReactNode
  onClose: () => void
  onSave: (pet: Pet) => void | Promise<void>
  onOpenPlan: (petId: string) => void
}

const customSpeciesOption = '직접 입력'
const defaultPhotoPosition = { x: 50, y: 50 }
const reptileBranches: ReptileBranch[] = ['도마뱀', '뱀', '거북이']
const lizardGroups = ['게코', '비어디드래곤', '모니터(왕도마뱀)', '카멜레온', '이구아나', '스킨크', '유로매스틱스']
const geckoSpecies = ['크레스티드 게코', '레오파드 게코', '펫테일 게코', '바이퍼 게코', '차화 게코', '가고일 게코', '토케이 게코', '데이 게코']
const snakeSpecies = ['스네이크', '파이톤', '보아']
const turtleSpecies = ['육지거북', '수생거북', '반수생 거북']
const amphibianBranches: AmphibianBranch[] = ['개구리', '도롱뇽']
const frogSpecies = ['팩맨', '트리프록', '두꺼비(토드)', '다트프록(독화살 개구리)']
const salamanderSpecies = ['뉴트', '살라만다', '아홀로틀']

function isSupportedCategory(value?: AnimalCategory | ''): value is SupportedPetCategory {
  return value === 'reptile' || value === 'amphibian'
}

function RequiredMark() {
  return <span className="required-mark" aria-label="필수">*</span>
}

function StepText({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label className="step-field"><span>{label}{required && <RequiredMark />}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepSelect({ label, value, options, labels, onChange, required = false }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void; required?: boolean }) {
  return <fieldset className="step-choice-group"><legend>{label}{required && <RequiredMark />}</legend><div className="step-choice-grid">{options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{labels?.[option] ?? option}</button>)}</div></fieldset>
}

function ChipGroup({ label, value, options, onChange, required = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; required?: boolean }) {
  return <fieldset className="step-choice-group compact"><legend>{label}{required && <RequiredMark />}</legend><div className="step-chip-grid">{options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{option}</button>)}</div></fieldset>
}

export default function PetCreateFlow({ initialPet, initialDraft, categoryOptions, categoryLabels, speciesOptions, onClose, onSave }: PetCreateFlowProps) {
  const initialGroup = isSupportedCategory(initialPet?.group) ? initialPet.group : ''
  const allowedCategoryOptions = categoryOptions.filter(isSupportedCategory)
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [completedPet, setCompletedPet] = useState<Pet | null>(null)
  const [name, setName] = useState(initialPet?.name ?? '')
  const [group, setGroup] = useState<SupportedPetCategory | ''>(initialGroup)
  const [reptileBranch, setReptileBranch] = useState<ReptileBranch | ''>('')
  const [amphibianBranch, setAmphibianBranch] = useState<AmphibianBranch | ''>('')
  const [lizardGroup, setLizardGroup] = useState('')
  const [speciesOption, setSpeciesOption] = useState(() => {
    if (!initialPet?.species || !initialGroup) return ''
    return speciesOptions[initialGroup].includes(initialPet.species) ? initialPet.species : customSpeciesOption
  })
  const [customSpecies, setCustomSpecies] = useState(() => {
    if (!initialPet?.species || !initialGroup) return ''
    return speciesOptions[initialGroup].includes(initialPet.species) ? '' : initialPet.species
  })
  const [gender, setGender] = useState<Pet['gender'] | ''>(initialPet?.gender ?? '')
  const [photo, setPhoto] = useState<string | undefined>(initialPet?.photo)
  const [photoPosition, setPhotoPosition] = useState(initialPet?.photoPosition ?? defaultPhotoPosition)
  const [weight, setWeight] = useState(initialPet?.weight ?? '')
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg'>(initialPet?.weightUnit ?? 'g')
  const [ageText, setAgeText] = useState(initialPet?.ageText ?? '')
  const isEditing = Boolean(initialPet)
  const normalizedName = name.trim().slice(0, 24)
  const resolvedSpecies = speciesOption === customSpeciesOption ? customSpecies.trim().slice(0, 32) : speciesOption
  const customSpeciesValid = resolvedSpecies.length > 0 && /[0-9A-Za-z가-힣]/.test(resolvedSpecies)
  const canNext = step === 0 ? normalizedName.length > 0 : step === 1 ? Boolean(group) : step === 2 ? Boolean(resolvedSpecies && (speciesOption !== customSpeciesOption || customSpeciesValid)) : step === 3 ? Boolean(photo) : true

  const selectReptileBranch = (value: string) => {
    setReptileBranch(value as ReptileBranch)
    setLizardGroup('')
    setSpeciesOption('')
    setCustomSpecies('')
  }

  const selectLizardGroup = (value: string) => {
    setLizardGroup(value)
    setCustomSpecies('')
    if (value === '게코') {
      setSpeciesOption('')
      return
    }
    setSpeciesOption(value === '기타' ? customSpeciesOption : value)
  }

  const selectAmphibianBranch = (value: string) => {
    setAmphibianBranch(value as AmphibianBranch)
    setSpeciesOption('')
    setCustomSpecies('')
  }

  const buildPet = (): Pet => ({
    id: initialPet?.id ?? crypto.randomUUID(),
    name: normalizedName,
    group: group || 'reptile',
    species: resolvedSpecies,
    gender: gender || 'unknown',
    photo,
    photoPosition,
    weight: weight.trim() || undefined,
    weightUnit,
    ageText: ageText.trim() || undefined,
    registeredAt: initialPet?.registeredAt ?? new Date().toISOString(),
  })

  const finish = async () => {
    if (!group || !resolvedSpecies || !normalizedName || !photo) return
    const pet = buildPet()
    await onSave(pet)
    setCompletedPet(pet)
  }

  const attachPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPhoto(typeof reader.result === 'string' ? reader.result : undefined)
      setPhotoPosition(defaultPhotoPosition)
    }
    reader.readAsDataURL(file)
  }

  const movePhotoPosition = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100))
    setPhotoPosition({ x: Math.round(x), y: Math.round(y) })
  }

  const startPhotoDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!photo) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    movePhotoPosition(event)
  }

  if (completedPet) {
    return <main className="pet-complete-screen"><section className="pet-complete-card"><div className="pet-complete-mark">✓</div><h1>{completedPet.name}가 등록되었어요.</h1><div className="pet-complete-summary"><div className="pet-card-icon"><img src={completedPet.photo} alt={`${completedPet.name} 사진`} style={{ objectPosition: `${completedPet.photoPosition?.x ?? 50}% ${completedPet.photoPosition?.y ?? 50}%` }} /></div><strong>{completedPet.name}</strong><span>{completedPet.species} · {categoryLabels[completedPet.group]}</span></div><div className="pet-complete-actions single"><button className="step-primary" type="button" onClick={onClose}>완료</button></div></section></main>
  }

  const finishEdit = async () => { if (!group || !resolvedSpecies || !normalizedName || !photo) return; await onSave(buildPet()); onClose() }

  return <StepShell title={isEditing ? '펫 수정' : '펫 등록'} onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={4} stepLabels={['기본', '분류', '종', '확인']} onStepChange={setStep}>
    {step === 0 && <div className="pet-basic-step"><h2>새로운 가족을 알려주세요</h2><StepText label="이름" value={name} onChange={(value) => setName(value.slice(0, 24))} placeholder="이름을 입력해주세요" required /></div>}
    {step === 1 && <StepSelect label="동물 분류" value={group} options={allowedCategoryOptions} labels={categoryLabels} onChange={(value) => { const nextGroup = value as SupportedPetCategory; setGroup(nextGroup); setReptileBranch(''); setAmphibianBranch(''); setLizardGroup(''); setSpeciesOption(''); setCustomSpecies('') }} required />}
    {step === 2 && <div className="pet-species-step">
      {group === 'reptile' && <>
        <ChipGroup label="파충류 태그" value={reptileBranch} options={reptileBranches} onChange={selectReptileBranch} required />
        {reptileBranch === '도마뱀' && <ChipGroup label="도마뱀" value={lizardGroup} options={lizardGroups} onChange={selectLizardGroup} required />}
        {lizardGroup === '게코' && <ChipGroup label="게코" value={speciesOption} options={geckoSpecies} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} required />}
        {reptileBranch === '뱀' && <ChipGroup label="뱀" value={speciesOption} options={snakeSpecies} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} required />}
        {reptileBranch === '거북이' && <ChipGroup label="거북이" value={speciesOption} options={turtleSpecies} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} required />}
      </>}
      {group === 'amphibian' && <>
        <ChipGroup label="양서류 태그" value={amphibianBranch} options={amphibianBranches} onChange={selectAmphibianBranch} required />
        {amphibianBranch === '개구리' && <ChipGroup label="개구리" value={speciesOption} options={frogSpecies} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} required />}
        {amphibianBranch === '도롱뇽' && <ChipGroup label="도롱뇽" value={speciesOption} options={salamanderSpecies} onChange={(value) => { setSpeciesOption(value); setCustomSpecies('') }} required />}
      </>}
      <button className={speciesOption === customSpeciesOption ? 'species-custom-toggle active' : 'species-custom-toggle'} type="button" onClick={() => { setSpeciesOption(customSpeciesOption); setLizardGroup(group === 'reptile' && reptileBranch === '도마뱀' ? '기타' : lizardGroup) }}>목록에 없나요? 직접 입력</button>
      {speciesOption === customSpeciesOption && <StepText label="종 직접 입력" value={customSpecies} onChange={(value) => setCustomSpecies(value.slice(0, 32))} placeholder={group === 'amphibian' ? '예: 팩맨' : '예: 팬서카멜레온'} required />}
    </div>}
    {step === 3 && <div className="pet-confirm-step"><label className="pet-confirm-card pet-confirm-photo-card"><input type="file" accept="image/*" onChange={attachPhoto} /><div className="pet-card-icon pet-photo-adjuster" onPointerDown={startPhotoDrag} onPointerMove={(event) => { if (photo && event.currentTarget.hasPointerCapture(event.pointerId)) movePhotoPosition(event) }} onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }} onClick={(event) => { if (photo) event.preventDefault() }}>{photo ? <img src={photo} alt="선택한 펫 미리보기" style={{ objectPosition: `${photoPosition.x}% ${photoPosition.y}%` }} draggable={false} /> : <span className="pet-photo-plus" aria-hidden="true">+</span>}</div><strong>{photo ? '사진 변경' : <>사진 추가<RequiredMark /></>}</strong><span>{normalizedName}</span>{photo && <small>사진을 움직여 위치를 맞출 수 있어요.</small>}</label><div className="pet-confirm-detail-panel"><StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} /><div className="step-field"><span>나이</span><input inputMode="numeric" pattern="[0-9]*" value={ageText} onChange={(event) => setAgeText(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))} placeholder="숫자 입력" /></div><div className="step-field"><span>몸무게</span><div className="weight-input"><input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="선택 입력" /><div className="weight-unit">{(['g', 'kg'] as const).map((unit) => <button className={weightUnit === unit ? 'active' : ''} type="button" key={unit} onClick={() => setWeightUnit(unit)}>{unit}</button>)}</div></div></div></div></div>}
    <div className="step-actions"><button className="step-secondary step-back" type="button" disabled={step === 0} onClick={() => step > 0 ? setStep((value) => value - 1) : onClose()}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={step === 3 ? (isEditing ? finishEdit : finish) : () => setStep((value) => value + 1)}>{step === 3 ? (isEditing ? '수정 완료' : '등록 완료') : '다음'}</button></div>
  </StepShell>
}
