import { type FormEvent, useState } from 'react'

import { Stepper } from '../../components/ui/Stepper'
import type { ChangeEvent } from 'react'
import { specialistReviewTags } from './reviewTagOptions'
import { reviewDiagnosisOptions } from './hospitalConditionCatalog'

export type ReviewAnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type ReviewPetOption = {
  id: string
  name: string
  group?: ReviewAnimalCategory | string
  species?: string
}

type HospitalReviewFormProps = {
  body: string
  visitDate: string
  cost: string
  diagnosis: string
  treatment: string
  rating: number
  pets: ReviewPetOption[]
  selectedPetId: string
  selectedTags: string[]
  images: Array<{ id: string; previewUrl: string }>
  imageError?: string
  isSubmitting?: boolean
  isEditing?: boolean
  canSubmit: boolean
  submitLabel?: string
  onBodyChange: (value: string) => void
  onVisitDateChange: (value: string) => void
  onCostChange: (value: string) => void
  onDiagnosisChange: (value: string) => void
  onTreatmentChange: (value: string) => void
  onRatingChange: (value: number) => void
  onPetChange: (value: string) => void
  onToggleTag: (value: string) => void
  onImagesSelect: (files: File[]) => void
  onImageRemove: (id: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}
const text = {
  all: '\uC804\uCCB4',
  reptile: '\uD30C\uCDA9\uB958',
  bird: '\uC870\uB958',
  rodent: '\uC124\uCE58\uB958',
  amphibian: '\uC591\uC11C\uB958',
  other: '\uAE30\uD0C0',
  required: '\uD544\uC218',
  optional: '\uC120\uD0DD',
  petTitle: '\uD568\uAED8 \uBC29\uBB38\uD55C \uBC18\uB824\uB3D9\uBB3C',
  petSelectLabel: '\uB9C8\uC774 \uD3AB\uC5D0\uC11C \uC120\uD0DD',
  petSelectPlaceholder: '\uBC18\uB824\uB3D9\uBB3C \uC120\uD0DD',
  treatmentTitle: '\uC9C4\uB8CC \uC815\uBCF4',
  visitDate: '\uBC29\uBB38 \uB0A0\uC9DC',
  cost: '\uC9C4\uB8CC\uBE44',
  costPlaceholder: '\uC608: 35,000',
  diagnosis: '\uBCD1\uBA85/\uC9C4\uB2E8\uBA85',
  diagnosisPlaceholder: '\uC608: \uB300\uC0AC\uC131 \uACE8\uC9C8\uD658',
  prescription: '\uCC98\uBC29',
  treatmentPlaceholder: '\uBCD1\uC6D0\uC5D0\uC11C \uBC1B\uC740 \uCC98\uBC29 \uB0B4\uC6A9\uC744 \uADF8\uB300\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
  tagTitle: '\uC5B4\uB5A4 \uC810\uC774 \uC88B\uC558\uB098\uC694?',
  bodyTitle: '\uB9AC\uBDF0\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694',
  bodyPlaceholder: '\uBC29\uBB38 \uACBD\uD5D8, \uC9C4\uB8CC \uACFC\uC815, \uB2E4\uC2DC \uBC29\uBB38\uD558\uACE0 \uC2F6\uC740 \uC774\uC720\uB97C \uC801\uC5B4\uC8FC\uC138\uC694.',
  submit: '\uB9AC\uBDF0 \uC791\uC131 \uC644\uB8CC',
}

const generalReviewTags = [
  '수의사님이 친절해요', '병원이 청결해요', '설명이 자세해요', '가격 안내가 투명해요',
  '아이를 조심스럽게 다뤄줘요', '동물 특성을 잘 이해해요', '응급 상황에 빠르게 대응해요',
  '집에서 관리하는 법을 알려줘요', '과잉진료가 없어요', '재방문하고 싶어요',
]

const prescriptionOptions = [
  '항균제', '항원충제', '소염진통제', '칼슘 보충제', '비타민 보충제', '구충제',
  '항진균제', '수액 처치', '점안제', '외용제', '분무 치료', '상처 소독 및 처치',
  '영양 보조', '수술적 처치',
]

const reviewSteps = ['방문', '진료', '태그', '리뷰']

function formatCostInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function HospitalReviewForm({
  body,
  visitDate,
  cost,
  diagnosis,
  treatment,
  rating,
  pets,
  selectedPetId,
  selectedTags,
  images,
  imageError,
  isSubmitting = false,
  isEditing = false,
  canSubmit,
  submitLabel,
  onBodyChange,
  onVisitDateChange,
  onCostChange,
  onDiagnosisChange,
  onTreatmentChange,
  onRatingChange,
  onPetChange,
  onToggleTag,
  onImagesSelect,
  onImageRemove,
  onSubmit,
}: HospitalReviewFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const selectedPetMeta = selectedPet?.species || ''
  const canMoveNext = currentStep === 0
    ? Boolean(selectedPetId)
    : currentStep === 1
      ? Boolean(visitDate)
      : true

  const handleImagesSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) onImagesSelect(files)
  }

  const moveToStep = (step: number) => {
    if (step <= currentStep) setCurrentStep(step)
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    onSubmit(event)
  }

  const moveToNextStep = () => {
    if (!canMoveNext) return
    setCurrentStep((step) => Math.min(step + 1, reviewSteps.length - 1))
  }

  return (
    <form className="review-form review-composer review-step-form" onSubmit={handleFormSubmit}>
      <Stepper currentStep={currentStep} stepCount={reviewSteps.length} labels={reviewSteps} onStepChange={moveToStep} className="review-stepper" />

      {currentStep === 0 && <div className="review-step-content" aria-labelledby="review-step-visit">
      <h3 id="review-step-visit" className="review-step-title">방문 정보</h3>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.petTitle}</strong>
          <span className="review-required-star" aria-label={text.required}>*</span>
        </div>
        <label className="review-pet-select">
          <span>{text.petSelectLabel}</span>
          <select value={selectedPetId} onChange={(event) => onPetChange(event.target.value)} required>
            <option value="">{text.petSelectPlaceholder}</option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
          </select>
        </label>
        {selectedPetMeta && <p className="review-pet-meta">{selectedPetMeta}</p>}
      </section>
      </div>}

      {currentStep === 1 && <div className="review-step-content" aria-labelledby="review-step-treatment">
      <h3 id="review-step-treatment" className="review-step-title">진료 정보</h3>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.treatmentTitle}</strong>
        </div>
        <div className="review-form-row">
          <label>
            {text.visitDate} <span className="review-required-star" aria-label={text.required}>*</span>
            <input type="date" value={visitDate} onChange={(event) => onVisitDateChange(event.target.value)} required />
          </label>
          <label>
            {text.cost}
            <input inputMode="numeric" value={cost} onChange={(event) => onCostChange(formatCostInput(event.target.value))} placeholder={text.costPlaceholder} />
          </label>
        </div>
        <div className="review-clinical-field">
          <label htmlFor="review-diagnosis-input">{text.diagnosis}</label>
          <input id="review-diagnosis-input" list="review-diagnosis-options" value={diagnosis} onChange={(event) => onDiagnosisChange(event.target.value)} placeholder="병명을 입력하거나 선택하세요" autoComplete="off" />
          <datalist id="review-diagnosis-options">
            {reviewDiagnosisOptions.map((option) => <option value={option} key={option} />)}
          </datalist>
        </div>
        <div className="review-clinical-field">
          <label htmlFor="review-treatment-input">{text.prescription}</label>
          <input id="review-treatment-input" list="review-treatment-options" value={treatment} onChange={(event) => onTreatmentChange(event.target.value)} placeholder="처방을 입력하거나 선택하세요" autoComplete="off" />
          <datalist id="review-treatment-options">
            {prescriptionOptions.map((option) => <option value={option} key={option} />)}
          </datalist>
        </div>
      </section>
      </div>}

      {currentStep === 2 && <div className="review-step-content" aria-labelledby="review-step-tags">
      <h3 id="review-step-tags" className="review-step-title">경험 태그</h3>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.tagTitle}</strong>
          <span>{selectedTags.length}/5</span>
        </div>
        <div className="review-tag-selectors">
          <label>양서·파충류 전문성
            <select value="" disabled={selectedTags.length >= 5} onChange={(event) => event.target.value && onToggleTag(event.target.value)}>
              <option value="">태그 선택</option>
              {specialistReviewTags.map((tag) => <option value={tag} key={tag} disabled={selectedTags.includes(tag)}>{tag}</option>)}
            </select>
          </label>
          <label>일반 병원 경험
            <select value="" disabled={selectedTags.length >= 5} onChange={(event) => event.target.value && onToggleTag(event.target.value)}>
              <option value="">태그 선택</option>
              {generalReviewTags.map((tag) => <option value={tag} key={tag} disabled={selectedTags.includes(tag)}>{tag}</option>)}
            </select>
          </label>
        </div>
        {selectedTags.length > 0 && <div className="review-selected-tags" aria-label="선택한 리뷰 태그">
          {selectedTags.map((tag) => <button type="button" key={tag} onClick={() => onToggleTag(tag)}>{tag}<span aria-hidden="true">×</span></button>)}
        </div>
        }
      </section>
      </div>}

      {currentStep === 3 && <div className="review-step-content" aria-labelledby="review-step-body">
      <h3 id="review-step-body" className="review-step-title">리뷰 작성</h3>
      <section className="review-input-section review-rating-section" aria-labelledby="review-rating-title">
        <div className="review-input-head">
          <strong id="review-rating-title">병원 별점</strong>
          <span className="review-required-star" aria-label={text.required}>*</span>
          <span className="review-rating-value">{rating}점</span>
        </div>
        <div className="review-rating-picker" role="radiogroup" aria-label="병원 별점 선택">
          {[1, 2, 3, 4, 5].map((score) => (
            <button className={score <= rating ? 'active' : ''} type="button" role="radio" aria-checked={rating === score} aria-label={`${score}점`} key={score} onClick={() => onRatingChange(score)}>★</button>
          ))}
        </div>
        <small>처음에는 0점이며 별을 눌러 평가해 주세요.</small>
      </section>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.bodyTitle}</strong>
          {isEditing
            ? <span className="review-optional-label">{text.optional}</span>
            : <span className="review-required-star" aria-label={text.required}>*</span>}
        </div>
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder={text.bodyPlaceholder} required={!isEditing} />
      </section>
      <section className="review-input-section review-image-section">
        <div className="review-input-head">
          <strong>사진 첨부</strong>
          <span>{images.length}/3</span>
        </div>
        <label className={`review-image-picker ${images.length >= 3 ? 'is-disabled' : ''}`}>
          <span>+ 사진 선택</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple disabled={images.length >= 3 || isSubmitting} onChange={handleImagesSelect} />
        </label>
        <small className="review-image-help">최대 3장까지 첨부할 수 있어요.</small>
        {imageError && <p className="review-image-error" role="alert">{imageError}</p>}
        {images.length > 0 && (
          <div className="review-image-preview-list" aria-label="첨부 사진 미리보기">
            {images.map((image, index) => (
              <figure key={image.id}>
                <img src={image.previewUrl} alt={`첨부 사진 ${index + 1}`} />
                <button type="button" aria-label={`첨부 사진 ${index + 1} 삭제`} disabled={isSubmitting} onClick={() => onImageRemove(image.id)}>삭제</button>
              </figure>
            ))}
          </div>
        )}
      </section>
      </div>}

      <div className="step-actions review-form-actions">
        {currentStep > 0 && <button type="button" className="step-secondary" onClick={() => setCurrentStep((step) => step - 1)}>이전</button>}
        {currentStep < reviewSteps.length - 1 ? (
          <button type="button" className="step-primary" disabled={!canMoveNext} onClick={moveToNextStep}>다음</button>
        ) : (
          <button type="submit" className="step-primary review-submit-action" disabled={!canSubmit || isSubmitting}>{isSubmitting ? '저장 중' : submitLabel ?? text.submit}</button>
        )}
      </div>
    </form>
  )
}




