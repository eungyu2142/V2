import { type FormEvent } from 'react'

import { specialistReviewTags } from './reviewTagOptions'

export type ReviewAnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type ReviewPetOption = {
  id: string
  name: string
  group?: ReviewAnimalCategory | string
  species?: string
}

type HospitalReviewFormProps = {
  rating: number
  body: string
  visitDate: string
  hasNextVisit: boolean
  nextVisitDate: string
  nextVisitTime: string
  cost: string
  diagnosis: string
  treatment: string
  pets: ReviewPetOption[]
  selectedPetId: string
  selectedTags: string[]
  canSubmit: boolean
  submitLabel?: string
  onRatingChange: (value: number) => void
  onBodyChange: (value: string) => void
  onVisitDateChange: (value: string) => void
  onHasNextVisitChange: (value: boolean) => void
  onNextVisitDateChange: (value: string) => void
  onNextVisitTimeChange: (value: string) => void
  onCostChange: (value: string) => void
  onDiagnosisChange: (value: string) => void
  onTreatmentChange: (value: string) => void
  onPetChange: (value: string) => void
  onToggleTag: (value: string) => void
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
  ratingTitle: '\uBC29\uBB38\uC5D0 \uB9CC\uC871\uD558\uC168\uB098\uC694?',
  ratingLabel: '\uBCC4\uC810 \uC120\uD0DD',
  petTitle: '\uD568\uAED8 \uBC29\uBB38\uD55C \uBC18\uB824\uB3D9\uBB3C',
  petSelectLabel: '\uB9C8\uC774 \uD3AB\uC5D0\uC11C \uC120\uD0DD',
  petSelectPlaceholder: '\uBC18\uB824\uB3D9\uBB3C \uC120\uD0DD',
  treatmentTitle: '\uC9C4\uB8CC \uC815\uBCF4',
  visitDate: '\uBC29\uBB38 \uB0A0\uC9DC',
  nextVisitQuestion: '\uB2E4\uC74C \uC608\uC815\uC77C (\uB8E8\uD2F4)\uC774 \uC788\uB098\uC694?',
  nextVisitDate: '\uB0A0\uC9DC',
  reminderTime: '\uC54C\uB9BC \uC2DC\uAC04',
  cost: '\uC9C4\uB8CC\uBE44',
  costPlaceholder: '\uC608: 35,000',
  diagnosis: '\uBCD1\uBA85/\uC9C4\uB2E8\uBA85',
  diagnosisPlaceholder: '\uC608: MBD(\uB300\uC0AC\uC131 \uACE8\uC9C8\uD658)',
  prescription: '\uCC98\uBC29',
  treatmentPlaceholder: '\uBCD1\uC6D0\uC5D0\uC11C \uBC1B\uC740 \uCC98\uBC29 \uB0B4\uC6A9\uC744 \uADF8\uB300\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
  tagTitle: '\uC5B4\uB5A4 \uC810\uC774 \uC88B\uC558\uB098\uC694?',
  bodyTitle: '\uB9AC\uBDF0\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694',
  bodyPlaceholder: '\uBC29\uBB38 \uACBD\uD5D8, \uC9C4\uB8CC \uACFC\uC815, \uB2E4\uC2DC \uBC29\uBB38\uD558\uACE0 \uC2F6\uC740 \uC774\uC720\uB97C \uC801\uC5B4\uC8FC\uC138\uC694.',
  submit: '\uB4F1\uB85D',
  point: '\uC810',
}

const generalReviewTags = [
  '\uC218\uC758\uC0AC\uB2D8\uC774 \uCE5C\uC808\uD574\uC694',
  '\uBCD1\uC6D0\uC774 \uCCAD\uACB0\uD574\uC694',
  '\uC124\uBA85\uC774 \uC790\uC138\uD574\uC694',
  '\uAC00\uACA9 \uC548\uB0B4\uAC00 \uD22C\uBA85\uD574\uC694',
  '\uC544\uC774\uB97C \uC870\uC2EC\uC2A4\uB7FD\uAC8C \uB2E4\uB904\uC918\uC694',
  '\uB3D9\uBB3C \uD2B9\uC131\uC744 \uC798 \uC774\uD574\uD574\uC694',
  '\uC751\uAE09 \uC0C1\uD669\uC5D0 \uBE60\uB974\uAC8C \uB300\uC751\uD574\uC694',
  '\uC9D1\uC5D0\uC11C \uAD00\uB9AC\uD558\uB294 \uBC95\uC744 \uC54C\uB824\uC918\uC694',
  '\uACFC\uC789\uC9C4\uB8CC\uAC00 \uC5C6\uC5B4\uC694',
  '\uC7AC\uBC29\uBB38\uD558\uACE0 \uC2F6\uC5B4\uC694',
]

const diagnosisOptions = [
  'MBD(대사성 골질환)', '난산/에그바인딩', '탈피부전', '구내염', '호흡기 감염', '폐렴',
  '장폐색/임팩션', '탈항', '내부기생충', '외부기생충', '피부염', '진균성 질환', '농양',
  '골절', '탈수', '저칼슘혈증', '난포 정체', '생식기 탈출', '기타',
]

const prescriptionOptions = [
  'Enrofloxacin', 'Ceftazidime', 'Metronidazole', 'Meloxicam', '칼슘제', '비타민제',
  '구충제', '항진균제', '점안제', '외용제',
]

function formatCostInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatScheduledDate(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export default function HospitalReviewForm({
  rating,
  body,
  visitDate,
  hasNextVisit,
  nextVisitDate,
  nextVisitTime,
  cost,
  diagnosis,
  treatment,
  pets,
  selectedPetId,
  selectedTags,
  canSubmit,
  submitLabel,
  onRatingChange,
  onBodyChange,
  onVisitDateChange,
  onHasNextVisitChange,
  onNextVisitDateChange,
  onNextVisitTimeChange,
  onCostChange,
  onDiagnosisChange,
  onTreatmentChange,
  onPetChange,
  onToggleTag,
  onSubmit,
}: HospitalReviewFormProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const selectedPetMeta = selectedPet?.species || ''

  return (
    <form className="review-form review-composer" onSubmit={onSubmit}>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.ratingTitle}</strong>
          <span className="review-required-star" aria-label={text.required}>*</span>
        </div>
        <div className="review-rating-picker" aria-label={text.ratingLabel}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button className={rating >= score ? 'active' : ''} type="button" key={score} onClick={() => onRatingChange(score)} aria-label={`${score}${text.point}`}>
              ★
            </button>
          ))}
        </div>
      </section>

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
        <label className="review-clinical-field">
          <span>{text.diagnosis}</span>
          <input list="review-diagnosis-options" value={diagnosis} onChange={(event) => onDiagnosisChange(event.target.value)} placeholder={text.diagnosisPlaceholder} />
          <datalist id="review-diagnosis-options">
            {diagnosisOptions.map((option) => <option value={option} key={option} />)}
          </datalist>
        </label>
        <label className="review-clinical-field">
          <span>{text.prescription}</span>
          <input list="review-prescription-options" value={treatment} onChange={(event) => onTreatmentChange(event.target.value)} placeholder="처방을 검색하거나 직접 입력하세요" />
          <datalist id="review-prescription-options">
            {prescriptionOptions.map((option) => <option value={option} key={option} />)}
          </datalist>
        </label>
        <div className="review-next-visit">
          <strong>{text.nextVisitQuestion}</strong>
          <div className="review-next-visit-choice" role="group" aria-label={text.nextVisitQuestion}>
            <button type="button" className={hasNextVisit ? 'active' : ''} aria-pressed={hasNextVisit} onClick={() => onHasNextVisitChange(true)}>예</button>
            <button type="button" className={!hasNextVisit ? 'active' : ''} aria-pressed={!hasNextVisit} onClick={() => onHasNextVisitChange(false)}>아니요</button>
          </div>
          {hasNextVisit && (
            <div className="review-next-visit-fields">
              <div className="review-form-row">
                <label>
                  {text.nextVisitDate}
                  <input type="date" min={new Date().toISOString().slice(0, 10)} value={nextVisitDate} onChange={(event) => onNextVisitDateChange(event.target.value)} required />
                </label>
                <label>
                  {text.reminderTime}
                  <input type="time" value={nextVisitTime} onChange={(event) => onNextVisitTimeChange(event.target.value)} />
                </label>
              </div>
              {nextVisitDate && <p className="review-next-visit-summary"><strong>{formatScheduledDate(nextVisitDate)}</strong>에 병원 일정으로 캘린더에 추가돼요.</p>}
            </div>
          )}
        </div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.tagTitle}</strong>
          <span>{selectedTags.length}/5</span>
        </div>
        <div className="review-tag-group is-specialist">
          <strong>양서·파충류 전문성</strong>
          <div className="review-chip-grid">
            {specialistReviewTags.map((tag) => (
              <button className={selectedTags.includes(tag) ? 'active' : ''} type="button" key={tag} onClick={() => onToggleTag(tag)} disabled={!selectedTags.includes(tag) && selectedTags.length >= 5}>{tag}</button>
            ))}
          </div>
        </div>
        <div className="review-tag-group">
          <strong>일반 병원 경험</strong>
          <div className="review-chip-grid">
            {generalReviewTags.map((tag) => (
              <button className={selectedTags.includes(tag) ? 'active' : ''} type="button" key={tag} onClick={() => onToggleTag(tag)} disabled={!selectedTags.includes(tag) && selectedTags.length >= 5}>{tag}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.bodyTitle}</strong>
          <span className="review-required-star" aria-label={text.required}>*</span>
        </div>
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder={text.bodyPlaceholder} required />
      </section>

      <div className="step-actions review-form-actions">
        <button type="submit" className="step-primary" disabled={!canSubmit}>{submitLabel ?? text.submit}</button>
      </div>
    </form>
  )
}




