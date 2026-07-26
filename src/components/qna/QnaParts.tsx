import { useState } from 'react'
import type { AttachedDiarySnapshot, AttachedRecordSnapshot, HospitalSnapshot, QnaPost, QnaSort } from '../../types/app'

export function DiaryTimelineSkeleton() { return <div className="qna-diary-skeleton" aria-label="기록 불러오는 중" /> }

export function DiaryTimelineAttachment({ snapshot, mode, onRemove }: { snapshot: AttachedDiarySnapshot; mode: 'draft' | 'posted'; onRemove?: () => void }) {
  return <section className="qna-diary-attachment"><strong>{snapshot.petName} 기록 {snapshot.totalCount}개</strong><span>{snapshot.startDate} - {snapshot.endDate}</span>{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</section>
}

export function RecordAttachCard({ record, mode, onRemove, onOpen }: { record: AttachedRecordSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  return <article className="qna-record-attachment"><strong>{record.recordTypeLabel}</strong><span>{record.petName} · {record.recordDate}</span><p>{record.summary}</p>{onOpen && <button type="button" onClick={onOpen}>기록 보기</button>}{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</article>
}

export function HospitalAttachCard({ hospital, mode, onRemove, onOpen }: { hospital: HospitalSnapshot; mode: 'draft' | 'posted'; onRemove?: () => void; onOpen?: () => void }) {
  return <article className="qna-hospital-attachment"><strong>{hospital.name}</strong><span>{hospital.address}</span>{onOpen && <button type="button" onClick={onOpen}>병원 보기</button>}{mode === 'draft' && onRemove && <button type="button" onClick={onRemove}>제거</button>}</article>
}

export function HospitalPicker({ onClose }: { onClose: () => void }) {
  return <div className="hospital-picker-overlay"><section className="hospital-picker" role="dialog" aria-modal="true"><strong>병원 선택</strong><p>지도에서 병원을 선택한 뒤 첨부할 수 있어요.</p><button type="button" onClick={onClose}>닫기</button></section></div>
}

export function QnaSortSheet({ value, onChange, onClose, label }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void; label: (value: QnaSort) => string }) {
  const options: QnaSort[] = ['latest', 'popular', 'views', 'comments']
  return <div className="qna-sort-sheet-overlay"><button className="qna-sort-sheet-dim" type="button" aria-label="정렬 닫기" onClick={onClose} /><section className="qna-sort-sheet" role="dialog" aria-modal="true" aria-label="Q&A 정렬"><span className="hospital-picker-handle" aria-hidden="true" /><h3>정렬</h3>{options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{label(option)}</button>)}</section></div>
}

export function UserAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

export function QnaOwnerMenu({ post, onEdit, onToggleResolve, onDelete }: { post: QnaPost; onEdit: () => void; onToggleResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="qna-owner-menu"><button type="button" aria-label="질문 관리 메뉴" aria-expanded={open} onClick={() => setOpen((value) => !value)}>⋮</button>{open && <div><button type="button" onClick={onEdit}>질문 수정</button><button type="button" onClick={onToggleResolve}>{post.status === 'resolved' ? '해결 취소' : '해결 완료'}</button><button className="danger" type="button" onClick={onDelete}>질문 삭제</button></div>}</div>
}
