import { type FormEvent } from 'react'

export type ReviewAnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type HospitalReviewFormProps = {
  author: string
  rating: number
  body: string
  animalCategory: ReviewAnimalCategory
  species: string
  visitDate: string
  cost: string
  diagnosis: string
  treatment: string
  medicine: string
  pets: Array<{ id: string; name: string }>
  selectedPetId: string
  medicineDose: string
  medicineStartDate: string
  medicineEndDate: string
  medicineDailyCount: string
  medicineInstructions: string
  medicineBagImage: string
  medicineRecognitionStatus: string
  selectedTags: string[]
  canSubmit: boolean
  onAuthorChange: (value: string) => void
  onRatingChange: (value: number) => void
  onBodyChange: (value: string) => void
  onAnimalCategoryChange: (value: ReviewAnimalCategory) => void
  onSpeciesChange: (value: string) => void
  onVisitDateChange: (value: string) => void
  onCostChange: (value: string) => void
  onDiagnosisChange: (value: string) => void
  onTreatmentChange: (value: string) => void
  onMedicineChange: (value: string) => void
  onPetChange: (value: string) => void
  onMedicineDoseChange: (value: string) => void
  onMedicineStartDateChange: (value: string) => void
  onMedicineEndDateChange: (value: string) => void
  onMedicineDailyCountChange: (value: string) => void
  onMedicineInstructionsChange: (value: string) => void
  onMedicineBagChange: (file: File) => void
  onToggleTag: (value: string) => void
  onSaveDraft: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const animalOptions: Array<{ id: ReviewAnimalCategory; label: string }> = [
  { id: 'reptile', label: '파충류' },
  { id: 'amphibian', label: '양서류' },
  { id: 'rodent', label: '설치류' },
  { id: 'bird', label: '조류' },
  { id: 'other', label: '기타' },
]

const reviewTags = [
  '수의사 님이 친절해요',
  '병원의 위생이 좋아요',
  '설명이 자세해요',
  '가격이 합리적이에요',
  '아이를 조심스럽게 잘 다뤄주세요',
  '진료 장비가 잘 갖춰져 있어요',
  '예약 시간이 잘 지켜져요',
  '대기 시간이 짧아요',
  '응급 상황에 빠르게 대응해요',
  '검사 결과를 쉽게 알려줘요',
  '집에서 관리하는 법을 알려줘요',
  '동물 특성을 잘 이해해요',
  '과잉진료가 없어요',
  '비용 안내가 투명해요',
  '병원 분위기가 차분해요',
  '재방문하고 싶어요',
]

function formatCostInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function HospitalReviewForm({
  author,
  rating,
  body,
  animalCategory,
  species,
  visitDate,
  cost,
  diagnosis,
  treatment,
  medicine,
  pets,
  selectedPetId,
  medicineDose,
  medicineStartDate,
  medicineEndDate,
  medicineDailyCount,
  medicineInstructions,
  medicineBagImage,
  medicineRecognitionStatus,
  selectedTags,
  canSubmit,
  onAuthorChange,
  onRatingChange,
  onBodyChange,
  onAnimalCategoryChange,
  onSpeciesChange,
  onVisitDateChange,
  onCostChange,
  onDiagnosisChange,
  onTreatmentChange,
  onMedicineChange,
  onPetChange,
  onMedicineDoseChange,
  onMedicineStartDateChange,
  onMedicineEndDateChange,
  onMedicineDailyCountChange,
  onMedicineInstructionsChange,
  onMedicineBagChange,
  onToggleTag,
  onSaveDraft,
  onSubmit,
}: HospitalReviewFormProps) {
  return (
    <form className="review-form review-composer" onSubmit={onSubmit}>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>방문에 만족하셨나요?</strong>
          <span>필수</span>
        </div>
        <div className="review-rating-picker" aria-label="별점 선택">
          {[1, 2, 3, 4, 5].map((score) => (
            <button className={rating >= score ? 'active' : ''} type="button" key={score} onClick={() => onRatingChange(score)} aria-label={`${score}점`}>
              <span />
            </button>
          ))}
        </div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>어떤 동물로 방문했나요?</strong>
          <span>필수</span>
        </div>
        <div className="review-chip-grid compact">
          {animalOptions.map((option) => (
            <button className={animalCategory === option.id ? 'active' : ''} type="button" key={option.id} onClick={() => onAnimalCategoryChange(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        <input value={species} onChange={(event) => onSpeciesChange(event.target.value)} placeholder="종을 입력해 주세요. 예: 크레스티드게코" />
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>진료 정보를 알려주세요</strong>
        </div>
        <label className="review-pet-select">방문한 반려동물<select value={selectedPetId} onChange={(event) => onPetChange(event.target.value)}><option value="">선택</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
        <div className="review-form-row">
          <input value={author} onChange={(event) => onAuthorChange(event.target.value)} placeholder="닉네임" />
          <input type="date" value={visitDate} onChange={(event) => onVisitDateChange(event.target.value)} />
        </div>
        <div className="review-form-row">
          <input inputMode="numeric" value={cost} onChange={(event) => onCostChange(formatCostInput(event.target.value))} placeholder="진료비" />
          <input value={diagnosis} onChange={(event) => onDiagnosisChange(event.target.value)} placeholder="진단 또는 방문 사유" />
        </div>
        <input value={treatment} onChange={(event) => onTreatmentChange(event.target.value)} placeholder="진료 내용" />
      </section>

      <section className="review-input-section medicine-bag-section">
        <div className="review-input-head"><strong>약봉투 인식</strong><span>선택</span></div>
        <label className="medicine-bag-picker"><span>{medicineBagImage ? '약봉투 다시 선택' : '약봉투 사진 선택'}</span><input type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) onMedicineBagChange(file) }} /></label>
        {medicineBagImage && <img src={medicineBagImage} alt="선택한 약봉투" />}
        {medicineRecognitionStatus && <p>{medicineRecognitionStatus}</p>}
        <div className="review-form-row"><input value={medicine} onChange={(event) => onMedicineChange(event.target.value)} placeholder="약 이름" /><input value={medicineDose} onChange={(event) => onMedicineDoseChange(event.target.value)} placeholder="복용량 (예: 0.5ml)" /></div>
        <div className="review-form-row"><label>복용 시작일<input type="date" value={medicineStartDate} onChange={(event) => onMedicineStartDateChange(event.target.value)} /></label><label>복용 종료일<input type="date" min={medicineStartDate} value={medicineEndDate} onChange={(event) => onMedicineEndDateChange(event.target.value)} /></label></div>
        <div className="review-form-row"><label>하루 복용 횟수<input type="number" min="1" max="12" value={medicineDailyCount} onChange={(event) => onMedicineDailyCountChange(event.target.value)} /></label><input value={medicineInstructions} onChange={(event) => onMedicineInstructionsChange(event.target.value)} placeholder="복용 안내" /></div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>어떤 점이 좋았나요?</strong>
          <span>{selectedTags.length}/5</span>
        </div>
        <p>이 병원에 어울리는 키워드를 골라주세요.</p>
        <div className="review-chip-grid">
          {reviewTags.map((tag) => (
            <button className={selectedTags.includes(tag) ? 'active' : ''} type="button" key={tag} onClick={() => onToggleTag(tag)} disabled={!selectedTags.includes(tag) && selectedTags.length >= 5}>
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>리뷰를 남겨주세요</strong>
          <span>필수</span>
        </div>
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder="방문 경험, 동물 진료 과정, 다시 방문하고 싶은 이유를 적어주세요." />
      </section>

      <div className="step-actions review-form-actions">
        <button type="button" className="step-secondary" onClick={onSaveDraft}>임시저장</button>
        <button type="submit" className="step-primary" disabled={!canSubmit}>등록</button>
      </div>
    </form>
  )
}
