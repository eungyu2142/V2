import { useState } from 'react'
import type { AttachedDiarySnapshot, AttachedRecordSnapshot, HospitalSnapshot, QnaPost, QnaSort } from '../../types/app'
import { DataVisualization } from '../../features/diary/DiaryPage'

const text = {
  loadingRecords: '\uAE30\uB85D \uBD88\uB7EC\uC624\uB294 \uC911',
  record: '\uAE30\uB85D',
  dot: '\u00B7',
  remove: '\uC81C\uAC70',
  review: '\uB2E4\uC2DC \uBCF4\uAE30',
  collapse: '\uC811\uAE30',
  viewRecord: '\uAE30\uB85D \uBCF4\uAE30',
  viewHospital: '\uBCD1\uC6D0 \uBCF4\uAE30',
  hospitalSelect: '\uBCD1\uC6D0 \uC120\uD0DD',
  hospitalHelp: '\uC9C0\uB3C4\uC5D0\uC11C \uBCD1\uC6D0\uC744 \uC120\uD0DD\uD558\uBA74 \uCCA8\uBD80\uD560 \uC218 \uC788\uC5B4\uC694.',
  close: '\uB2EB\uAE30',
  sort: '\uC815\uB82C',
  closeSort: '\uC815\uB82C \uB2EB\uAE30',
  qnaSort: 'Q&A \uC815\uB82C',
  manageQuestion: '\uC9C8\uBB38 \uAD00\uB9AC \uBA54\uB274',
  editQuestion: '\uC9C8\uBB38 \uC218\uC815',
  unresolved: '\uD574\uACB0 \uCDE8\uC18C',
  resolved: '\uD574\uACB0 \uC644\uB8CC',
  deleteQuestion: '\uC9C8\uBB38 \uC0AD\uC81C',
} as const

const diaryRecordLabels = {
  food: '먹이',
  weight: '무게',
  shed: '탈피',
  poop: '배변',
  cleaning: '청소',
  hospital: '진료',
  other: '기록',
} as const

export function DiaryTimelineSkeleton() {
  return <div className="qna-diary-skeleton" aria-label={text.loadingRecords} />
}

export function DiaryTimelineAttachment({ snapshot, mode, onRemove }: { snapshot: AttachedDiarySnapshot; mode: 'draft' | 'posted'; onRemove?: () => void }) {
  const [reviewOpen, setReviewOpen] = useState(false)
  return (
    <section className={`qna-diary-attachment ${mode}`}>
      <strong>{snapshot.petName} {text.record}</strong>
      <div className="qna-diary-attachment-actions">
        <button type="button" aria-expanded={reviewOpen} onClick={() => setReviewOpen((open) => !open)}>
          {reviewOpen ? text.collapse : text.review}
        </button>
        {mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>{text.remove}</button>}
      </div>
      {reviewOpen && (
        <div className="qna-diary-attachment-records">
          {snapshot.records.map((record) => {
            const detail = record.foods?.join(' · ') || record.memo || '완료'
            return (
              <article key={record.id}>
                <div>
                  <strong>{diaryRecordLabels[record.type]}</strong>
                  <time dateTime={record.date}>{record.date}</time>
                </div>
                <p>{detail}</p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function DiaryVisualizationAttachment({ snapshot }: { snapshot: AttachedDiarySnapshot }) {
  return <DataVisualization records={snapshot.records} petName={snapshot.petName} />
}

export function RecordAttachCard({ record, mode, onRemove, onOpen }: { record: AttachedRecordSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  return <article className="qna-record-attachment"><strong>{record.recordTypeLabel}</strong><span>{record.petName} · {record.recordDate}</span><p>{record.summary}</p>{onOpen && <button type="button" onClick={onOpen}>{text.viewRecord}</button>}{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>{text.remove}</button>}</article>
}

export function HospitalAttachCard({ hospital, mode, onRemove, onOpen }: { hospital: HospitalSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  const content = <><strong>{hospital.name}</strong><span>{hospital.address}</span></>
  return <article className={`qna-hospital-attachment ${mode}`}>{onOpen ? <button className="qna-hospital-attachment-main" type="button" onClick={onOpen}>{content}</button> : <div className="qna-hospital-attachment-main">{content}</div>}{mode === 'draft' && onRemove && <button className="qna-hospital-attachment-remove" type="button" onClick={onRemove}>{text.remove}</button>}</article>
}

export function HospitalPicker({ hospitals, onSelect, onClose }: { hospitals: HospitalSnapshot[]; onSelect: (hospital: HospitalSnapshot) => void; onClose: () => void }) {
  return <div className="hospital-picker-overlay"><section className="hospital-picker" role="dialog" aria-modal="true" aria-label={text.hospitalSelect}><div className="qna-hospital-picker-heading"><strong>{text.hospitalSelect}</strong><button className="qna-hospital-picker-close" type="button" aria-label={text.close} onClick={onClose}>×</button></div>{hospitals.length > 0 ? <div className="qna-hospital-picker-list">{hospitals.map((hospital) => <button className="qna-hospital-picker-item" type="button" key={hospital.id ?? `${hospital.name}-${hospital.lat}-${hospital.lng}`} onClick={() => onSelect(hospital)}><strong>{hospital.name}</strong><span>{hospital.animalTags.join(' · ') || '특수동물 진료'}</span></button>)}</div> : <p>{text.hospitalHelp}</p>}</section></div>
}

export function QnaSortSheet({ value, onChange, onClose, label }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void; label: (value: QnaSort) => string }) {
  const options: QnaSort[] = ['latest', 'popular', 'comments']
  return <div className="qna-sort-sheet-overlay"><button className="qna-sort-sheet-dim" type="button" aria-label={text.closeSort} onClick={onClose} /><section className="qna-sort-sheet" role="dialog" aria-modal="true" aria-label={text.qnaSort}><span className="hospital-picker-handle" aria-hidden="true" /><h3>{text.sort}</h3>{options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{label(option)}</button>)}</section></div>
}

export function UserAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

export function QnaOwnerMenu({ post, onEdit, onToggleResolve, onDelete }: { post: QnaPost; onEdit: () => void; onToggleResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="qna-owner-menu"><button type="button" aria-label={text.manageQuestion} aria-expanded={open} onClick={() => setOpen((value) => !value)}>...</button>{open && <div><button type="button" onClick={onEdit}>{text.editQuestion}</button><button type="button" onClick={onToggleResolve}>{post.status === 'resolved' ? text.unresolved : text.resolved}</button><button className="danger" type="button" onClick={onDelete}>{text.deleteQuestion}</button></div>}</div>
}
