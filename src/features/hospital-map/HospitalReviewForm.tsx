import { type FormEvent } from 'react'

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
  cost: string
  diagnosis: string
  treatment: string
  medicine: string
  pets: ReviewPetOption[]
  selectedPetId: string
  medicineStartDate: string
  medicineEndDate: string
  medicineDailyCount: string
  medicineBagImage: string
  medicineRecognitionStatus: string
  selectedTags: string[]
  canSubmit: boolean
  onRatingChange: (value: number) => void
  onBodyChange: (value: string) => void
  onVisitDateChange: (value: string) => void
  onCostChange: (value: string) => void
  onDiagnosisChange: (value: string) => void
  onTreatmentChange: (value: string) => void
  onMedicineChange: (value: string) => void
  onPetChange: (value: string) => void
  onMedicineStartDateChange: (value: string) => void
  onMedicineEndDateChange: (value: string) => void
  onMedicineDailyCountChange: (value: string) => void
  onMedicineBagChange: (file: File) => void
  onToggleTag: (value: string) => void
  onSaveDraft: () => void
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
  cost: '\uC9C4\uB8CC\uBE44',
  costPlaceholder: '\uC608: 35,000',
  diagnosisPlaceholder: '\uC9C4\uB2E8 \uB610\uB294 \uBC29\uBB38 \uC0AC\uC720',
  treatmentPlaceholder: '\uC9C4\uB8CC \uB0B4\uC6A9',
  medicinePhotoTitle: '\uC57D\uBD09\uD22C \uC0AC\uC9C4',
  medicineHelp: '\uC0AC\uC9C4\uC5D0\uC11C \uBCF4\uC774\uB294 \uC57D \uC885\uB958\uB97C \uC778\uC2DD\uD574 \uAE30\uB85D\uD569\uB2C8\uB2E4. \uC800\uC7A5 \uC804 \uACB0\uACFC\uB97C \uC9C1\uC811 \uD655\uC778\uD574 \uC8FC\uC138\uC694.',
  medicinePick: '\uC57D\uBD09\uD22C \uC0AC\uC9C4 \uC120\uD0DD',
  medicineRepick: '\uC57D\uBD09\uD22C \uC0AC\uC9C4 \uB2E4\uC2DC \uC120\uD0DD',
  medicineAlt: '\uC120\uD0DD\uD55C \uC57D\uBD09\uD22C',
  medicinePlaceholder: '\uC57D \uC885\uB958',
  startDate: '\uBCF5\uC6A9 \uC2DC\uC791\uC77C',
  endDate: '\uBCF5\uC6A9 \uC885\uB8CC\uC77C',
  dailyCount: '\uD558\uB8E8 \uBCF5\uC6A9 \uD69F\uC218',
  tagTitle: '\uC5B4\uB5A4 \uC810\uC774 \uC88B\uC558\uB098\uC694?',
  bodyTitle: '\uB9AC\uBDF0\uB97C \uB0A8\uACA8\uC8FC\uC138\uC694',
  bodyPlaceholder: '\uBC29\uBB38 \uACBD\uD5D8, \uC9C4\uB8CC \uACFC\uC815, \uB2E4\uC2DC \uBC29\uBB38\uD558\uACE0 \uC2F6\uC740 \uC774\uC720\uB97C \uC801\uC5B4\uC8FC\uC138\uC694.',
  saveDraft: '\uC784\uC2DC\uC800\uC7A5',
  submit: '\uB4F1\uB85D',
  point: '\uC810',
}

const categoryLabels: Record<string, string> = {
  all: text.all,
  reptile: text.reptile,
  bird: text.bird,
  rodent: text.rodent,
  amphibian: text.amphibian,
  other: text.other,
}

const reviewTags = [
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

function formatCostInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export default function HospitalReviewForm({
  rating,
  body,
  visitDate,
  cost,
  diagnosis,
  treatment,
  medicine,
  pets,
  selectedPetId,
  medicineStartDate,
  medicineEndDate,
  medicineDailyCount,
  medicineBagImage,
  medicineRecognitionStatus,
  selectedTags,
  canSubmit,
  onRatingChange,
  onBodyChange,
  onVisitDateChange,
  onCostChange,
  onDiagnosisChange,
  onTreatmentChange,
  onMedicineChange,
  onPetChange,
  onMedicineStartDateChange,
  onMedicineEndDateChange,
  onMedicineDailyCountChange,
  onMedicineBagChange,
  onToggleTag,
  onSaveDraft,
  onSubmit,
}: HospitalReviewFormProps) {
  const selectedPet = pets.find((pet) => pet.id === selectedPetId)
  const selectedPetMeta = [selectedPet?.species, selectedPet?.group ? categoryLabels[selectedPet.group] ?? selectedPet.group : ''].filter(Boolean).join(' / ')

  return (
    <form className="review-form review-composer" onSubmit={onSubmit}>
      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.ratingTitle}</strong>
          <span>{text.required}</span>
        </div>
        <div className="review-rating-picker" aria-label={text.ratingLabel}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button className={rating >= score ? 'active' : ''} type="button" key={score} onClick={() => onRatingChange(score)} aria-label={`${score}${text.point}`}>
              <span />
            </button>
          ))}
        </div>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.petTitle}</strong>
          <span>{text.required}</span>
        </div>
        <label className="review-pet-select">
          <span>{text.petSelectLabel}</span>
          <select value={selectedPetId} onChange={(event) => onPetChange(event.target.value)}>
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
            {text.visitDate}
            <input type="date" value={visitDate} onChange={(event) => onVisitDateChange(event.target.value)} />
          </label>
          <label>
            {text.cost}
            <input inputMode="numeric" value={cost} onChange={(event) => onCostChange(formatCostInput(event.target.value))} placeholder={text.costPlaceholder} />
          </label>
        </div>
        <input value={diagnosis} onChange={(event) => onDiagnosisChange(event.target.value)} placeholder={text.diagnosisPlaceholder} />
        <input value={treatment} onChange={(event) => onTreatmentChange(event.target.value)} placeholder={text.treatmentPlaceholder} />
      </section>

      <section className="review-input-section medicine-bag-section">
        <div className="review-input-head">
          <strong>{text.medicinePhotoTitle}</strong>
          <span>{text.optional}</span>
        </div>
        <p className="medicine-bag-help">{text.medicineHelp}</p>
        <label className="medicine-bag-picker">
          <span>{medicineBagImage ? text.medicineRepick : text.medicinePick}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onMedicineBagChange(file)
            }}
          />
        </label>
        {medicineBagImage && (
          <figure className="medicine-bag-preview">
            <img src={medicineBagImage} alt={text.medicineAlt} />
          </figure>
        )}
        {medicineRecognitionStatus && <p className="medicine-bag-status">{medicineRecognitionStatus}</p>}
        <input value={medicine} onChange={(event) => onMedicineChange(event.target.value)} placeholder={text.medicinePlaceholder} />
        <div className="review-form-row">
          <label>
            {text.startDate}
            <input type="date" value={medicineStartDate} onChange={(event) => onMedicineStartDateChange(event.target.value)} />
          </label>
          <label>
            {text.endDate}
            <input type="date" min={medicineStartDate} value={medicineEndDate} onChange={(event) => onMedicineEndDateChange(event.target.value)} />
          </label>
        </div>
        <label>
          {text.dailyCount}
          <input type="number" min="1" max="12" value={medicineDailyCount} onChange={(event) => onMedicineDailyCountChange(event.target.value)} />
        </label>
      </section>

      <section className="review-input-section">
        <div className="review-input-head">
          <strong>{text.tagTitle}</strong>
          <span>{selectedTags.length}/5</span>
        </div>
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
          <strong>{text.bodyTitle}</strong>
          <span>{text.required}</span>
        </div>
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder={text.bodyPlaceholder} />
      </section>

      <div className="step-actions review-form-actions">
        <button type="button" className="step-secondary" onClick={onSaveDraft}>{text.saveDraft}</button>
        <button type="submit" className="step-primary" disabled={!canSubmit}>{text.submit}</button>
      </div>
    </form>
  )
}



