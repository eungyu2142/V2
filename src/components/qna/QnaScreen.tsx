import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadAppData } from '../../lib/appData'
import StepShell from '../account/StepShell'
import { DiaryTimelineAttachment, DiaryTimelineSkeleton, HospitalAttachCard, HospitalPicker, RecordAttachCard } from './QnaParts'
import type { AppProfile, AttachedDiarySnapshot, AttachedRecordSnapshot, DraftItem, HospitalSnapshot, Pet, QnaCategory, QnaComment, QnaListStatus, QnaPost, QnaSort, QnaStatus } from '../../types/app'
import type { PetRecord, PetRecordType } from '../../features/diary/diaryTypes'
import { animalCategoryLabels, CategoryTagIcon } from '../hospital-map/mapDependencies'
function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="step-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }

export function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onEditPost, onCreate, onOpenHospital, onOpenDiary }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onEditPost: (post: QnaPost) => void; onCreate: (petId?: string | null) => void; onOpenHospital: (hospital: HospitalSnapshot) => void; onOpenDiary: (petId: string, readOnly: boolean) => void }) {
  const displayAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const qnaUrl = new URLSearchParams(window.location.search)
  const [sort, setSort] = useState<QnaSort>(() => parseQnaSort(qnaUrl.get('sort')))
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<QnaListStatus>(() => parseQnaStatus(qnaUrl.get('status')))
  const [categoryFilter, setCategoryFilter] = useState<QnaCategory | 'all'>(() => parseQnaCategory(qnaUrl.get('category')))
  const [visibleCount, setVisibleCount] = useState(6)
  const [searchInput, setSearchInput] = useState(qnaUrl.get('q') ?? '')
  const [query, setQuery] = useState(qnaUrl.get('q') ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [attachedHospital, setAttachedHospital] = useState<HospitalSnapshot | null>(null)
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, QnaComment[]>>({})
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null)
  const previousSelectedIdRef = useRef<string | null>(null)
  const selected = posts.find((post) => post.id === selectedId)
  const selectedComments = selected ? commentsByPost[selected.id] ?? selected.comments : []
  useEffect(() => {
    let active = true
    supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload').then(({ data, error }) => {
      if (!active || error) return
      const grouped: Record<string, QnaComment[]> = {}
      for (const row of data ?? []) {
        const payload = (row.payload ?? {}) as { author?: string; hospitalSnapshot?: HospitalSnapshot }
        const mine = row.user_id === userId
        const author = payload.author && payload.author !== '작성자' ? payload.author : mine ? displayAuthor : '사용자'
        const item: QnaComment = { id: row.id, author, body: row.body, createdAt: row.created_at, mine, hospitalSnapshot: payload.hospitalSnapshot }
        grouped[row.post_id] = [...(grouped[row.post_id] ?? []), item]
      }
      setCommentsByPost(grouped)
    })
    return () => { active = false }
  }, [displayAuthor, posts.length, userId])
  useEffect(() => {
    if (!openPostId) return
    // This effect consumes a profile deep-link into the selected post.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(openPostId)
    onOpenHandled?.()
  }, [openPostId, onOpenHandled])
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'qna')
    params.set('sort', sort)
    params.set('status', statusFilter)
    params.set('category', categoryFilter)
    if (searchInput.trim()) params.set('q', searchInput.trim())
    else params.delete('q')
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
  }, [categoryFilter, searchInput, sort, statusFilter])
  useEffect(() => {
    if (selectedId) {
      if (previousSelectedIdRef.current !== selectedId) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        const appMain = document.querySelector('.app-main')
        if (appMain instanceof HTMLElement) appMain.scrollTop = 0
        const viewedKey = `qna_viewed_${selectedId}`
        if (!sessionStorage.getItem(viewedKey)) {
          sessionStorage.setItem(viewedKey, '1')
          void supabase.rpc(['increment', 'comm' + 'unity', 'post', 'view'].join('_'), { p_post_id: selectedId })
          onChange(posts.map((post) => post.id === selectedId ? { ...post, viewCount: (post.viewCount ?? 0) + 1 } : post))
        }
        previousSelectedIdRef.current = selectedId
      }
      return
    }
    if (previousSelectedIdRef.current) {
      const savedScroll = Number(sessionStorage.getItem(`qna_scroll_${userId}`) ?? 0)
      window.setTimeout(() => window.scrollTo({ top: savedScroll, left: 0, behavior: 'auto' }), 0)
      previousSelectedIdRef.current = null
    }
  }, [onChange, posts, selectedId, userId])
  const searchedPosts = posts.filter((post) => {
    const text = `${post.title} ${post.body} ${post.author} ${post.animalGroup ?? ''} ${post.animalSpecies ?? post.animal}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })
  const getCommentCount = (post: QnaPost) => Math.max(post.comments.length, commentsByPost[post.id]?.length ?? 0)
  const scopedPosts = searchedPosts.filter((post) => {
    const matchesCategory = categoryFilter === 'all' || normalizeQnaCategory(post.category) === categoryFilter
    const listStatus = qnaListStatus(post, getCommentCount(post))
    const matchesStatus = statusFilter === 'all' || listStatus === statusFilter
    return matchesCategory && matchesStatus
  })
  const feedPosts = sortQnaPosts(scopedPosts, sort, getCommentCount)
  const visiblePosts = feedPosts.slice(0, visibleCount)

  const updatePost = (post: QnaPost) => onChange(posts.map((item) => item.id === post.id ? post : item))
  const toggleLike = (post: QnaPost) => updatePost({ ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) })
  const toggleStatus = (post: QnaPost) => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' })
  const selectAnswer = (post: QnaPost, commentId: string) => updatePost(post.selectedAnswerCommentId === commentId ? { ...post, status: 'unresolved', selectedAnswerCommentId: undefined } : { ...post, status: 'resolved', selectedAnswerCommentId: commentId })
  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !comment.trim()) return
    const newComment: QnaComment = { id: crypto.randomUUID(), author: displayAuthor, body: comment.trim(), createdAt: new Date().toISOString(), mine: true, hospitalSnapshot: attachedHospital ?? undefined }
    const { error } = await supabase.from('post_comments').insert({ id: newComment.id, post_id: selected.id, user_id: userId, body: newComment.body, payload: { author: newComment.author, hospitalSnapshot: newComment.hospitalSnapshot ?? null } })
    if (error) return
    setCommentsByPost((items) => ({ ...items, [selected.id]: [...(items[selected.id] ?? selected.comments), newComment] }))
    setComment('')
    setAttachedHospital(null)
  }

  if (selected) {
    const sortedComments = [...selectedComments].sort((a, b) => (a.id === selected.selectedAnswerCommentId ? -1 : 0) - (b.id === selected.selectedAnswerCommentId ? -1 : 0))
    return (
      <section className="qna-detail">
        <header className="qna-detail-header">
          <button className="qna-back" type="button" aria-label="뒤로가기" onClick={() => setSelectedId(null)}>←</button>
          <strong>Q&A</strong>
          {selected.mine === true && <QnaOwnerMenu post={selected} onEdit={() => onEditPost(selected)} onToggleResolve={() => toggleStatus(selected)} onDelete={() => { if (window.confirm(`‘${selected.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) { onDeletePost(selected.id); setSelectedId(null) } }} />}
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category">{normalizeQnaCategory(selected.category)}</span><span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span></div>
          <h2>{selected.title}</h2>
          <div className="qna-author"><UserAvatar url={selected.authorAvatarUrl || (selected.mine === true ? profile.avatarUrl : '')} name={qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)} /><div><strong>{qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
          {selected.image && <img src={selected.image} alt="" />}
          {selected.attachedDiarySnapshot && <DiaryTimelineAttachment snapshot={selected.attachedDiarySnapshot} mode="posted" />}
          {!selected.attachedDiarySnapshot && selected.attachedRecordSnapshot && <RecordAttachCard record={selected.attachedRecordSnapshot} mode="posted" onOpen={() => onOpenDiary(selected.attachedRecordSnapshot!.petId, selected.mine !== true)} />}
          <p>{selected.body}</p>
          <div className="qna-detail-actions">
            <button className={`qna-like ${selected.liked ? 'active' : ''}`} type="button" onClick={() => toggleLike(selected)}>♡ {selected.likes}</button>
            {selected.mine === true && <button className="qna-status-toggle" type="button" onClick={() => toggleStatus(selected)}>{qnaStatus(selected) === 'resolved' ? '다시 답변 필요' : '해결 완료'}</button>}
          </div>
        </article>
        <section className="qna-comments">
          <h3>댓글 {selectedComments.length}</h3>
          {sortedComments.map((item) => (
            <article className={selected.selectedAnswerCommentId === item.id ? 'accepted' : ''} key={item.id}>
              <div className="qna-comment-head"><span><strong>{item.author}</strong><time>{formatQnaDate(item.createdAt)}</time></span>{item.mine && <div className="qna-comment-menu"><button type="button" aria-label="댓글 관리 메뉴" aria-expanded={commentMenuId === item.id} onClick={() => setCommentMenuId(commentMenuId === item.id ? null : item.id)}>⋮</button>{commentMenuId === item.id && <div><button type="button" onClick={async () => { await supabase.from('post_comments').delete().eq('id', item.id).eq('user_id', userId); setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((commentItem) => commentItem.id !== item.id) })); setCommentMenuId(null) }}>댓글 삭제</button></div>}</div>}</div>
              {selected.selectedAnswerCommentId === item.id && <span className="accepted-answer-chip">채택 답변</span>}
              {item.body && <p>{item.body}</p>}
              {item.hospitalSnapshot && <HospitalAttachCard hospital={item.hospitalSnapshot} mode="posted" onOpen={() => onOpenHospital(item.hospitalSnapshot!)} />}
              {selected.mine === true && <button className="qna-accept-button" type="button" onClick={() => selectAnswer(selected, item.id)}>{selected.selectedAnswerCommentId === item.id ? '채택 취소' : '답변 채택'}</button>}
            </article>
          ))}
          <form onSubmit={addComment}>
            {attachedHospital && <HospitalAttachCard hospital={attachedHospital} mode="draft" onRemove={() => setAttachedHospital(null)} />}
            <div className="qna-comment-tools">
              <button type="button" onClick={() => setHospitalPickerOpen(true)}>병원 첨부</button>
            </div>
            <div className="qna-comment-input-row">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요" aria-label="댓글" />
              <button type="submit" disabled={!comment.trim()}>등록</button>
            </div>
          </form>
        </section>
        {hospitalPickerOpen && <HospitalPicker onClose={() => setHospitalPickerOpen(false)} />}
      </section>
    )
  }

  return (
    <section className="qna-feed-page">
      <header className="qna-feed-head">
        <div>
          <h2>Q&A</h2>
          <p>특수동물의 문제를 기록과 함께 질문해 보세요.</p>
        </div>
        <button className="qna-create-button" type="button" onClick={() => onCreate()}>질문 작성</button>
      </header>
      <label className="qna-feed-search"><span aria-hidden="true">⌕</span><input aria-label="Q&A 검색" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setVisibleCount(6) }} placeholder="질문이나 동물 종으로 검색" />{searchInput && <button type="button" aria-label="검색어 지우기" onClick={() => { setSearchInput(''); setQuery(''); setVisibleCount(6) }}>×</button>}</label>
      <div className="qna-filter-bar" aria-label="Q&A 필터">
        <div className="qna-filter-row" aria-label="답변 상태">
          {([['all', '전체'], ['waiting', '답변 대기'], ['resolved', '해결 완료']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} className={statusFilter === value ? 'active' : ''} onClick={() => { setStatusFilter(value); setVisibleCount(6) }}>{label}</button>)}
        </div>
        <div className="qna-filter-row" aria-label="질문 카테고리">
          <button type="button" aria-pressed={categoryFilter === 'all'} className={categoryFilter === 'all' ? 'active' : ''} onClick={() => { setCategoryFilter('all'); setVisibleCount(6) }}>전체 카테고리</button>
          {qnaCategoryCards.map((categoryItem) => <button key={categoryItem} type="button" aria-pressed={categoryFilter === categoryItem} className={categoryFilter === categoryItem ? 'active' : ''} onClick={() => { setCategoryFilter(categoryItem); setVisibleCount(6) }}>{categoryItem}</button>)}
        </div>
        <button className="qna-feed-sort-trigger" type="button" aria-label="정렬 선택" onClick={() => setSortSheetOpen(true)}>{qnaSortLabel(sort)}⌄</button>
      </div>
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true">⌕</div>
        <strong>{query ? '검색 결과가 없습니다.' : statusFilter !== 'all' || categoryFilter !== 'all' ? '선택한 조건에 맞는 질문이 없습니다.' : '아직 등록된 질문이 없습니다.'}</strong>
        {(query || statusFilter !== 'all' || categoryFilter !== 'all') && <button type="button" onClick={() => { setSearchInput(''); setQuery(''); setStatusFilter('all'); setCategoryFilter('all'); setVisibleCount(6) }}>필터 초기화</button>}
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
                {visiblePosts.map((post) => <QnaHelpCard post={post} authorName={qnaDisplayAuthor(post.author, post.mine === true, displayAuthor)} commentCount={getCommentCount(post)} fallbackAvatarUrl={post.mine === true ? profile.avatarUrl : ''} key={post.id} onOpen={() => { sessionStorage.setItem(`qna_scroll_${userId}`, String(window.scrollY)); setSelectedId(post.id) }} onEdit={post.mine === true ? () => onEditPost(post) : undefined} onToggleResolve={post.mine === true ? () => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' }) : undefined} onDelete={post.mine === true ? () => { if (window.confirm(`‘${post.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) void onDeletePost(post.id) } : undefined} />)}
          </div>
          {visiblePosts.length < feedPosts.length && <button className="qna-load-more" type="button" onClick={() => setVisibleCount((count) => count + 6)}>더보기</button>}
        </section>
      )}
      {sortSheetOpen && <QnaSortSheet value={sort} onChange={(value) => { setSort(value); setVisibleCount(6); setSortSheetOpen(false) }} onClose={() => setSortSheetOpen(false)} />}
      <button className="qna-mobile-fab" type="button" aria-label="글쓰기" onClick={() => onCreate()}><span className="qna-write-icon" aria-hidden="true" /></button>
    </section>
  )
}

function QnaHelpCard({ post, authorName, commentCount, fallbackAvatarUrl, onOpen, onEdit, onToggleResolve, onDelete }: { post: QnaPost; authorName: string; commentCount: number; fallbackAvatarUrl?: string; onOpen: () => void; onEdit?: () => void; onToggleResolve?: () => void; onDelete?: () => void }) {
  const record = post.attachedRecordSnapshot
  const diary = post.attachedDiarySnapshot
  const recordTypeCounts = diary ? Object.entries(diary.records.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1
    return counts
  }, {})) : []
  const maxRecordTypeCount = Math.max(1, ...recordTypeCounts.map(([, count]) => count))
  const [menuOpen, setMenuOpen] = useState(false)
  const title = post.title.trim() || '제목 없는 질문'
  const body = post.body.trim()
  return (
    <article className={`qna-help-card ${qnaListStatus(post, commentCount)}`} role="button" tabIndex={0} aria-label={`${title} 상세 보기`} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      <div className="qna-help-card-top">
        <span className={`qna-status ${qnaListStatus(post, commentCount)}`}>{qnaListStatusLabel(qnaListStatus(post, commentCount))}</span>
        <span className="qna-category">{normalizeQnaCategory(post.category)}</span>
        {(onEdit || onToggleResolve || onDelete) && <div className="qna-card-menu">
          <button className="qna-card-menu-trigger" type="button" aria-label="질문 관리 메뉴" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value) }}>⋮</button>
          {menuOpen && <div className="qna-card-menu-popover" onClick={(event) => event.stopPropagation()}>
            {onEdit && <button type="button" onClick={() => { setMenuOpen(false); onEdit() }}>질문 수정</button>}
            {onToggleResolve && <button type="button" onClick={() => { setMenuOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결 완료'}</button>}
            {onDelete && <button className="danger" type="button" onClick={() => { setMenuOpen(false); onDelete() }}>질문 삭제</button>}
          </div>}
        </div>}
      </div>
      <div className="qna-card-main">
        <div className="qna-card-copy">
          <h3>{title}</h3>
          {body && <p className="qna-help-card-preview">{body}</p>}
          {formatQnaAnimal(post) !== '동물 X' && <p className="qna-help-card-animal">{formatQnaAnimal(post)}</p>}
        </div>
        {(post.image || diary || record) && <div className="qna-card-media" aria-label={post.image ? '첨부 사진 미리보기' : '첨부 기록 시각화 미리보기'}>
          {post.image ? <img src={post.image} alt="첨부 사진 미리보기" /> : <div className="qna-card-visualization" aria-hidden="true">
            <span>{diary ? '기록' : record?.recordTypeLabel}</span>
            {diary ? recordTypeCounts.slice(0, 4).map(([type, count]) => <i key={type} style={{ height: `${Math.max(18, (count / maxRecordTypeCount) * 52)}%` }} />) : <i style={{ height: '58%' }} />}
          </div>}
        </div>}
      </div>
      <footer>
        <div className="qna-card-author-meta"><span className="post-author"><UserAvatar url={post.authorAvatarUrl || fallbackAvatarUrl} name={authorName} />{authorName}</span><span>· {formatQnaDate(post.createdAt)}</span></div>
        <div className="qna-card-stats"><span>조회 {post.viewCount ?? 0}</span><span>댓글 {commentCount}</span></div>
      </footer>
      {(post.image || record || diary) && <div className="qna-attachment-summary"><span>{diary ? `기록 ${diary.totalCount}개` : record ? '기록 1개' : ''}{diary && diary.records.length > 0 ? ` · ${[...new Set(diary.records.map((item) => recordTypeLabels[item.type]))].slice(0, 3).join(', ')}` : record ? ` · ${record.recordTypeLabel}` : ''}</span>{post.image && <span>사진 1장</span>}</div>}
    </article>
  )
}


function QnaSortSheet({ value, onChange, onClose }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void }) {
  const options: QnaSort[] = ['latest', 'popular', 'views', 'comments']
  return (
    <div className="qna-sort-sheet-overlay">
      <button className="qna-sort-sheet-dim" type="button" aria-label="정렬 닫기" onClick={onClose} />
      <section className="qna-sort-sheet" role="dialog" aria-modal="true" aria-label="Q&A 정렬">
        <span className="hospital-picker-handle" aria-hidden="true" />
        <h3>정렬</h3>
        {options.map((option) => <button className={value === option ? 'active' : ''} type="button" key={option} onClick={() => onChange(option)}>{qnaSortLabel(option)}</button>)}
      </section>
    </div>
  )
}

function UserAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar" src={url} alt="" />
  return <span className="user-avatar user-avatar-fallback" aria-hidden="true">{name.trim().slice(0, 1) || '?'}</span>
}

export function QnaCreateFlow({ userId, pets, author, initialPetId, initialDraft, onClose, onSave }: { userId: string; pets: Pet[]; author: string; initialPetId?: string; initialDraft?: DraftItem | null; onClose: () => void; onSave: (post: QnaPost) => void | Promise<void> }) {
  const initialPost = initialDraft?.draftType === 'question' ? initialDraft.payload as QnaPost : null
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [petId, setPetId] = useState(initialPost?.petId || (initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : ''))
  const [category, setCategory] = useState<QnaCategory | ''>(initialPost ? normalizeQnaCategory(initialPost.category) : '')
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const [image, setImage] = useState<string | undefined>(initialPost?.image)
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
  const [attachedDiary, setAttachedDiary] = useState<AttachedDiarySnapshot | null>(initialPost?.attachedDiarySnapshot ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [recordAttachOpen, setRecordAttachOpen] = useState(false)
  const [recordAttachRange, setRecordAttachRange] = useState<3 | 7 | 30>(30)
  const [recordCandidates, setRecordCandidates] = useState<PetRecord[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const autoAttachedRef = useRef(false)
  const pet = pets.find((item) => item.id === petId)
  const hasNoAnimal = petId === 'none'
  const canSubmit = title.trim().length > 0 && body.trim().length > 0
  const canNext = step === 0 ? Boolean(category) : step === 1 ? Boolean(petId) : canSubmit
  const selectedGroup = hasNoAnimal ? '동물 X' : pet ? animalCategoryLabels[pet.group] : ''
  const selectedSpecies = hasNoAnimal ? '' : pet?.species || ''
  const buildPost = (): QnaPost => ({
    id: initialPost?.id ?? crypto.randomUUID(),
    category: category || '건강/증상',
    status: 'unresolved',
    title: title.trim(),
    body: body.trim(),
    author,
    mine: true,
    animal: hasNoAnimal ? '동물 X' : selectedSpecies.trim(),
    animalGroup: selectedGroup.trim(),
    animalSpecies: selectedSpecies.trim(),
    petId: hasNoAnimal ? '' : petId,
    image,
    linkedRecordId: attachedRecord?.recordId,
    attachedRecordSnapshot: attachedRecord ?? undefined,
    attachedDiarySnapshot: attachedDiary ?? undefined,
    createdAt: initialPost?.createdAt ?? new Date().toISOString(),
    liked: false,
    likes: 0,
    comments: [],
  })

  const changePet = (nextPetId: string) => {
    if (nextPetId !== petId && (attachedDiary || attachedRecord)) {
      const ok = window.confirm('질문 대상을 변경하면 현재 첨부된 기록이 해제됩니다.')
      if (!ok) return
      setAttachedDiary(null)
      setAttachedRecord(null)
      setSelectedRecordIds([])
    }
    setPetId(nextPetId)
  }

  const makeDiaryAttachment = useCallback((records: PetRecord[]): AttachedDiarySnapshot | null => {
    if (!pet || records.length === 0) return null
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    return {
      petId: pet.id,
      petName: pet.name,
      petPhoto: pet.photo,
      records: sorted,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      totalCount: sorted.length,
    }
  }, [pet])

  const loadPetRecords = useCallback(async () => {
    if (hasNoAnimal || !petId || !pet) return
    const loaded = await loadAppData<PetRecord>('care_records', { userId, scope: 'mine' })
    return loaded.filter((record) => record.petId === petId).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [hasNoAnimal, pet, petId, userId])

  const openRecordAttach = async () => {
    if (attachedDiary) return
    if (hasNoAnimal || !petId || !pet || diaryLoading) return
    setDiaryLoading(true)
    try {
      const petRecords = await loadPetRecords()
      if (!petRecords) return
      setRecordCandidates(petRecords)
      setSelectedRecordIds([])
      setRecordAttachOpen(true)
    } finally {
      setDiaryLoading(false)
    }
  }

  const saveRecordAttachment = (records: PetRecord[]) => {
    const attachment = makeDiaryAttachment(records)
    if (!attachment) return
    setAttachedDiary(attachment)
    setRecordAttachOpen(false)
  }

  useEffect(() => {
    if (!initialPetId || initialDraft || step !== 2 || attachedDiary || attachedRecord || autoAttachedRef.current) return
    if (hasNoAnimal || !petId || !pet) return
    autoAttachedRef.current = true
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        setDiaryLoading(true)
        const petRecords = await loadPetRecords()
        if (cancelled) return
        if (!petRecords) return
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 29)
        const cutoffKey = cutoff.toISOString().slice(0, 10)
        const recentRecords = petRecords.filter((record) => record.date >= cutoffKey)
        const attachment = makeDiaryAttachment(recentRecords)
        if (attachment) setAttachedDiary(attachment)
      })
      .finally(() => {
        if (!cancelled) setDiaryLoading(false)
      })
    return () => { cancelled = true }
  }, [attachedDiary, attachedRecord, hasNoAnimal, initialDraft, initialPetId, loadPetRecords, makeDiaryAttachment, pet, petId, step])

  const finish = () => onSave(buildPost())
  const attachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : undefined)
    reader.readAsDataURL(file)
  }

  return (
    <StepShell title="질문 작성" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)} currentStep={step} stepCount={3} stepLabels={['질문 유형', '관련 펫', '질문 내용']} onStepChange={setStep}>
      {step === 0 && <StepSelect label="질문 유형" value={category} options={['건강/증상', '사육/관리']} onChange={(value) => setCategory(value as QnaCategory)} />}
      {step === 1 && <QnaPetSelect pets={pets} value={petId} onChange={changePet} />}
      {step === 2 && <div className="qna-compose-fields">
        <StepText label="제목" value={title} onChange={setTitle} placeholder="질문 제목을 입력하세요" />
        <StepTextarea label="내용" value={body} onChange={setBody} placeholder="궁금한 내용을 자세히 적어 주세요" />
        <label className="step-field attach-file-field"><span>사진 첨부 (선택)</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" onChange={attachImage} /><small>{image ? '사진이 선택되었습니다' : '선택된 사진 없음'}</small></label>
        {image && <img className="qna-compose-preview" src={image} alt="첨부 사진 미리보기" />}
        {attachedRecord && <RecordAttachCard record={attachedRecord} mode="draft" onRemove={() => setAttachedRecord(null)} />}
        {!hasNoAnimal && petId && <div className="qna-compose-tools">
          <button type="button" onClick={openRecordAttach}>{attachedDiary ? '기록 첨부됨' : diaryLoading ? '기록 불러오는 중' : '기록 첨부'}</button>
        </div>}
        <div>
          {diaryLoading && <DiaryTimelineSkeleton />}
          {attachedDiary && !diaryLoading && <DiaryTimelineAttachment snapshot={attachedDiary} mode="draft" onRemove={() => setAttachedDiary(null)} />}
        </div>
        {recordAttachOpen && pet && <QnaRecordAttachSheet pet={pet} records={recordCandidates} range={recordAttachRange} selectedIds={selectedRecordIds} onRangeChange={setRecordAttachRange} onToggle={(recordId) => setSelectedRecordIds((ids) => ids.includes(recordId) ? ids.filter((id) => id !== recordId) : [...ids, recordId])} onSelectDate={(_date, ids) => setSelectedRecordIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])} onClose={() => setRecordAttachOpen(false)} onSave={saveRecordAttachment} />}
      </div>}
      {step === 2 && <div className="step-actions"><button className="step-secondary step-back" type="button" onClick={() => setStep((value) => value - 1)}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={finish}>등록</button></div>}
      {step !== 2 && <div className="step-actions"><button className="step-secondary step-back" type="button" onClick={() => setStep((value) => value - 1)} disabled={step === 0}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>다음</button></div>}
    </StepShell>
  )
}

function QnaOwnerMenu({ post, onEdit, onToggleResolve, onDelete }: { post: QnaPost; onEdit: () => void; onToggleResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="qna-owner-menu">
    <button type="button" aria-label="질문 관리 메뉴 열기" aria-expanded={open} onClick={() => setOpen((value) => !value)}>⋮</button>
    {open && <div role="menu"><button type="button" onClick={() => { setOpen(false); onEdit() }}>질문 수정</button><button type="button" onClick={() => { setOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결 완료'}</button><button className="danger" type="button" onClick={() => { setOpen(false); onDelete() }}>질문 삭제</button></div>}
  </div>
}

function QnaRecordAttachSheet({
  pet,
  records,
  range,
  selectedIds,
  onRangeChange,
  onToggle,
  onSelectDate,
  onClose,
  onSave,
}: {
  pet: Pet
  records: PetRecord[]
  range: 3 | 7 | 30
  selectedIds: string[]
  onRangeChange: (range: 3 | 7 | 30) => void
  onToggle: (recordId: string) => void
  onSelectDate: (date: string, ids: string[]) => void
  onClose: () => void
  onSave: (records: PetRecord[]) => void
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (range - 1))
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  const visibleRecords = records.filter((record) => record.date >= cutoffKey)
  const grouped = visibleRecords.reduce<Record<string, PetRecord[]>>((groups, record) => {
    groups[record.date] = [...(groups[record.date] ?? []), record]
    return groups
  }, {})
  const selectedRecords = records.filter((record) => selectedIds.includes(record.id))
  const selectedDates = selectedRecords.map((record) => record.date).sort()
  const rangeLabel = selectedDates.length ? `${formatRecordDate(selectedDates[0])}~${formatRecordDate(selectedDates[selectedDates.length - 1])}` : '선택된 기록 없음'

  return (
    <div className="record-picker-overlay">
      <button className="record-picker-dim" type="button" aria-label="기록 첨부 닫기" onClick={onClose} />
      <section className="record-picker-sheet qna-record-attach-sheet" role="dialog" aria-modal="true" aria-label={`${pet.name} 기록 첨부`}>
        <div className="hospital-picker-handle" aria-hidden="true" />
        <header>
          <div><strong>{pet.name} 기록 첨부</strong><p>질문에 필요한 기록만 선택하세요.</p></div>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        <div className="qna-record-range-tabs" aria-label="기록 범위">
          {([3, 7, 30] as const).map((value) => <button className={range === value ? 'active' : ''} type="button" key={value} onClick={() => onRangeChange(value)}>최근 {value}일</button>)}
        </div>
        <div className="qna-record-selected-summary"><strong>기록 {selectedRecords.length}개 선택</strong><span>{rangeLabel}</span></div>
        {visibleRecords.length === 0 ? <p className="record-picker-empty">첨부할 기록이 없습니다. 다이어리에서 루틴을 완료한 뒤 다시 확인해 주세요.</p> : (
          <div className="qna-record-group-list">
            {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
              const ids = items.map((item) => item.id)
              const allSelected = ids.every((id) => selectedIds.includes(id))
              return (
                <section className="qna-record-date-group" key={date}>
                  <header><strong>{formatRecordDate(date)}</strong><button type="button" onClick={() => onSelectDate(date, ids)}>{allSelected ? '날짜 선택 해제' : `${formatRecordDate(date)} 전체 선택`}</button></header>
                  {items.map((record) => (
                    <label className="qna-record-check-row" key={record.id}>
                      <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => onToggle(record.id)} />
                      <span><strong>{recordTypeLabels[record.type]}</strong><small>{summarizeRecord(record)}</small></span>
                    </label>
                  ))}
                </section>
              )
            })}
          </div>
        )}
        <div className="qna-record-attach-actions">
          <button type="button" onClick={onClose}>취소</button>
          <button type="button" disabled={selectedRecords.length === 0} onClick={() => onSave(selectedRecords)}>선택 기록 첨부</button>
        </div>
      </section>
    </div>
  )
}

function formatQnaDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(elapsed / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatQnaAnimal(post: QnaPost) {
  if (post.animal === '동물 X' || post.animalGroup === '동물 X' || post.animal === '동물 없음' || post.animalGroup === '동물 없음') return '동물 X'
  const group = post.animalGroup || '분류 미지정'
  const species = post.animalSpecies || post.animal || '종 미지정'
  return `${group} · ${species}`
}

function normalizeQnaCategory(category: string): QnaCategory {
  if (category === '동물 병원' || category === '병원/진료') return '건강/증상'
  if (category === '정보' || category === '기타' || category === '사육/관리') return '사육/관리'
  return '건강/증상'
}

function qnaDisplayAuthor(author: string | undefined, mine: boolean, currentNickname: string) {
  if (mine || !author || author === '작성자' || author === '나') return currentNickname
  return author
}

function qnaStatus(post: QnaPost): QnaStatus {
  return post.status === 'resolved' ? 'resolved' : 'unresolved'
}

function qnaStatusLabel(status: QnaStatus) {
  return status === 'resolved' ? '해결 완료' : '답변 대기'
}

function parseQnaStatus(value: string | null): QnaListStatus {
  return value === 'waiting' || value === 'resolved' ? value : 'all'
}

function parseQnaCategory(value: string | null): QnaCategory | 'all' {
  return value === '건강/증상' || value === '사육/관리' ? value : 'all'
}

function parseQnaSort(value: string | null): QnaSort {
  return value === 'popular' || value === 'comments' ? value : 'latest'
}

function qnaListStatus(post: QnaPost, commentCount = post.comments.length): QnaListStatus {
  if (qnaStatus(post) === 'resolved') return 'resolved'
  return commentCount > 0 ? 'answered' : 'waiting'
}

function qnaListStatusLabel(status: QnaListStatus) {
  if (status === 'resolved') return '해결 완료'
  if (status === 'answered') return '답변 있음'
  return '답변 대기'
}

const qnaCategoryCards: QnaCategory[] = ['건강/증상', '사육/관리']

function qnaSortLabel(sort: QnaSort) {
  if (sort === 'latest') return '최신순'
  if (sort === 'popular') return '인기순'
  if (sort === 'views') return '조회순'
  return '댓글순'
}

function sortQnaPosts(posts: QnaPost[], sort: QnaSort, getCommentCount: (post: QnaPost) => number = (post) => post.comments.length) {
  return [...posts].sort((a, b) => {
    if (sort === 'popular') {
      const commentDiff = getCommentCount(b) - getCommentCount(a)
      if (commentDiff !== 0) return commentDiff
      const viewDiff = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (viewDiff !== 0) return viewDiff
    }
    if (sort === 'views') {
      const viewDiff = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (viewDiff !== 0) return viewDiff
    }
    if (sort === 'comments') {
      const commentDiff = getCommentCount(b) - getCommentCount(a)
      if (commentDiff !== 0) return commentDiff
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

const recordTypeLabels: Record<PetRecordType, string> = {
  food: '먹이',
  weight: '무게',
  shed: '탈피',
  poop: '배변',
  cleaning: '청소',
  hospital: '병원',
  other: '기록',
}

function toAttachedRecordSnapshot(record: PetRecord, pet: Pet): AttachedRecordSnapshot {
  return {
    recordId: record.id,
    petId: pet.id,
    petName: pet.name,
    animalGroup: animalCategoryLabels[pet.group],
    animalSpecies: pet.species,
    recordDate: record.date,
    recordType: record.type,
    recordTypeLabel: recordTypeLabels[record.type],
    summary: summarizeRecord(record),
    photoUrl: record.photoUrl,
  }
}

void toAttachedRecordSnapshot

function summarizeRecord(record: PetRecord) {
  if (record.memo?.trim()) return record.memo.trim()
  if (record.type === 'food' && record.foods?.length) return record.foods.join(', ')
  if (record.type === 'weight' && record.weight !== undefined) return `${record.weight}g`
  return `${recordTypeLabels[record.type]} 기록`
}

function formatRecordDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function StepTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function QnaPetSelect({ pets, value, onChange }: { pets: Pet[]; value: string; onChange: (value: string) => void }) {
  return <section className="qna-pet-select">
    <h2>관련 펫</h2>
    <div className="qna-pet-grid">
      {pets.map((pet) => <button className={value === pet.id ? 'active' : ''} type="button" key={pet.id} onClick={() => onChange(pet.id)}>
        <span className="qna-pet-avatar">{pet.photo ? <img src={pet.photo} alt="" /> : <CategoryTagIcon category={pet.group} />}</span>
        <span className="qna-pet-copy"><strong>{pet.name}</strong><small>{animalCategoryLabels[pet.group]} · {pet.species || '종 미등록'}</small><small>{qnaGenderLabel(pet.gender)}</small></span>
      </button>)}
      <button className={value === 'none' ? 'active' : ''} type="button" onClick={() => onChange('none')}>
        <span className="qna-pet-avatar qna-pet-none" aria-hidden="true">×</span>
        <span className="qna-pet-copy"><strong>동물 X</strong><small>질문 대상 없음</small><small>펫 없이 질문하기</small></span>
      </button>
    </div>
  </section>
}

function qnaGenderLabel(gender: Pet['gender']) {
  if (gender === 'male') return '수컷'
  if (gender === 'female') return '암컷'
  return '성별 미구분'
}

function StepSelect({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <div className="step-field">
      <span>{label}</span>
      <div className="choice-grid">
        {options.map((option) => <button className={value === option ? 'active' : ''} key={option} type="button" onClick={() => onChange(option)}>{labels?.[option] ?? option}</button>)}
      </div>
    </div>
  )
}


