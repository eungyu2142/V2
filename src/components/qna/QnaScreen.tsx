import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadAppData } from '../../lib/appData'
import StepShell from '../account/StepShell'
import HeartIcon from '../common/HeartIcon'
import { DiaryTimelineSkeleton, DiaryVisualizationAttachment, HospitalAttachCard, RecordAttachCard } from './QnaParts'
import { QnaTrustBadge } from './QnaTrustBadge'
import { getTrustScoreForAuthor } from './qnaTrust'
import type { AppProfile, AttachedDiarySnapshot, AttachedRecordSnapshot, DraftItem, HospitalSnapshot, Pet, QnaCategory, QnaComment, QnaListStatus, QnaPost, QnaSort, QnaStatus } from '../../types/app'

const QNA_IMAGE_BUCKET = 'qna-images'
type QnaImageUploadStatus = 'uploading' | 'uploaded' | 'error'
type QnaImageUploadItem = {
  id: string
  previewUrl: string
  storageUrl?: string
  storagePath?: string
  status: QnaImageUploadStatus
  progress: number
  error?: string
  file?: File
}

function readHospitalSnapshot(payload: unknown): HospitalSnapshot | undefined {
  let value = payload
  if (typeof value === 'string') {
    try { value = JSON.parse(value) as unknown } catch { return undefined }
  }
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const candidate = record.hospitalSnapshot ?? record.hospital_snapshot ?? record.hospital ?? (typeof record.name === 'string' ? record : undefined)
  if (!candidate || typeof candidate !== 'object') return undefined
  const hospital = candidate as Record<string, unknown>
  if (typeof hospital.name !== 'string') return undefined
  const address = typeof hospital.address === 'string'
    ? hospital.address
    : typeof hospital.roadAddress === 'string'
      ? hospital.roadAddress
      : typeof hospital.road_address === 'string'
        ? hospital.road_address
        : typeof hospital.shortAddress === 'string' ? hospital.shortAddress : ''
  const animalTags = hospital.animalTags ?? hospital.animal_tags ?? hospital.categories
  const naverLink = hospital.naverLink ?? hospital.naver_link ?? hospital.link
  return {
    id: typeof hospital.id === 'string' ? hospital.id : undefined,
    name: hospital.name,
    address,
    phone: typeof hospital.phone === 'string' ? hospital.phone : '',
    lat: typeof hospital.lat === 'number' ? hospital.lat : 0,
    lng: typeof hospital.lng === 'number' ? hospital.lng : 0,
    animalTags: Array.isArray(animalTags) ? animalTags.filter((tag): tag is string => typeof tag === 'string') : [],
    naverLink: typeof naverLink === 'string' ? naverLink : '',
    source: hospital.source === 'local_hospital_data' ? 'local_hospital_data' : 'naver_local_search',
  }
}

function HospitalPicker({ hospitals, onSelect, onClose }: { hospitals: HospitalSnapshot[]; onSelect: (hospital: HospitalSnapshot) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const normalizedSearch = search.trim().toLowerCase()
  const filteredHospitals = hospitals.filter((hospital) => !normalizedSearch || `${hospital.name} ${hospital.address}`.toLowerCase().includes(normalizedSearch))
  const visibleHospitals = filteredHospitals.slice(0, visibleCount)
  const hasMore = visibleCount < filteredHospitals.length

  return <div className="hospital-picker-overlay"><section className="hospital-picker" role="dialog" aria-modal="true" aria-label="병원 선택"><div className="qna-hospital-picker-heading"><strong>병원 선택</strong><button className="qna-hospital-picker-close" type="button" aria-label="닫기" onClick={onClose}>×</button></div><label className="qna-hospital-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(10) }} placeholder="병원 이름이나 주소 검색" aria-label="병원 검색" /></label>{filteredHospitals.length > 0 ? <><div className="qna-hospital-picker-list">{visibleHospitals.map((hospital) => <button className="qna-hospital-picker-item" type="button" key={hospital.id ?? `${hospital.name}-${hospital.lat}-${hospital.lng}`} onClick={() => onSelect(hospital)}><strong>{hospital.name}</strong><span>{hospital.address}</span></button>)}</div>{hasMore && <button className="qna-hospital-picker-more" type="button" onClick={() => setVisibleCount((count) => count + 10)}>더보기</button>}</> : <p>검색 결과가 없습니다.</p>}</section></div>
}
import type { PetRecord, PetRecordType } from '../../features/diary/diaryTypes'
import { animalCategoryLabels, CategoryTagIcon } from '../hospital-map/mapDependencies'
function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="step-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }

export function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onEditPost, onCreate, onOpenHospital, onOpenDiary, hospitals = [] }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onEditPost: (post: QnaPost) => void; onCreate: (petId?: string | null) => void; onOpenHospital: (hospital: HospitalSnapshot) => void; onOpenDiary: (petId: string, readOnly: boolean) => void; hospitals?: HospitalSnapshot[] }) {
  const displayAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const qnaUrl = new URLSearchParams(window.location.search)
  const [sort, setSort] = useState<QnaSort>(() => parseQnaSort(qnaUrl.get('sort')))
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [filterSheet, setFilterSheet] = useState<'all' | 'status' | 'category' | null>(null)
  const [statusFilter, setStatusFilter] = useState<QnaListStatus>(() => parseQnaStatusFilter(qnaUrl.get('status')))
  const [categoryFilter, setCategoryFilter] = useState<QnaCategory[]>(() => parseQnaCategoryFilters(qnaUrl.get('category')))
  const [visibleCount, setVisibleCount] = useState(6)
  const [searchInput, setSearchInput] = useState(qnaUrl.get('q') ?? '')
  const [query, setQuery] = useState(qnaUrl.get('q') ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [attachedHospital, setAttachedHospital] = useState<HospitalSnapshot | null>(null)
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, QnaComment[]>>({})
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const previousSelectedIdRef = useRef<string | null>(null)
  const selected = posts.find((post) => post.id === selectedId)
  const selectedComments = selected ? commentsByPost[selected.id] ?? selected.comments : []
  useEffect(() => {
    if (!lightboxImage) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxImage(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightboxImage])
  useEffect(() => {
    let active = true
    supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload').then(({ data, error }) => {
      if (!active || error) return
      const grouped: Record<string, QnaComment[]> = {}
      for (const row of data ?? []) {
        const payload = (row.payload ?? {}) as { author?: string; authorAvatarUrl?: string; isAccepted?: boolean; is_accepted?: boolean; likes?: number; likedBy?: string[]; liked_by?: string[]; hospitalSnapshot?: HospitalSnapshot }
        const mine = row.user_id === userId
        const hospitalSnapshot = readHospitalSnapshot(row.payload)
        const author = payload.author && payload.author !== '작성자' ? payload.author : mine ? displayAuthor : '사용자'
        const likedBy = Array.isArray(payload.likedBy) ? payload.likedBy : Array.isArray(payload.liked_by) ? payload.liked_by : []
        const item: QnaComment = { id: row.id, author, authorAvatarUrl: payload.authorAvatarUrl, body: row.body, createdAt: row.created_at, mine, isAccepted: payload.isAccepted === true || payload.is_accepted === true, liked: likedBy.includes(userId), likes: Number(payload.likes ?? 0), hospitalSnapshot: payload.hospitalSnapshot }
        item.hospitalSnapshot = hospitalSnapshot
        grouped[row.post_id] = [...(grouped[row.post_id] ?? []), item]
      }
      setCommentsByPost((current) => {
        const merged: Record<string, QnaComment[]> = { ...current }
        Object.entries(grouped).forEach(([postId, remoteComments]) => {
          merged[postId] = remoteComments.map((remoteComment) => {
            const localComment = current[postId]?.find((commentItem) => commentItem.id === remoteComment.id)
            return localComment?.hospitalSnapshot && !remoteComment.hospitalSnapshot
              ? { ...remoteComment, hospitalSnapshot: localComment.hospitalSnapshot }
              : remoteComment
          })
        })
        return merged
      })
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
    params.set('category', categoryFilter.length > 0 ? categoryFilter.join(',') : 'all')
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
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(normalizeQnaCategory(post.category))
    const listStatus = qnaListStatus(post, getCommentCount(post))
    const matchesStatus = statusFilter === 'all' || listStatus === statusFilter
    return matchesCategory && matchesStatus
  })
  const feedPosts = sortQnaPosts(scopedPosts, sort, getCommentCount)
  const visiblePosts = feedPosts.slice(0, visibleCount)
  const waitingCount = posts.filter((post) => qnaListStatus(post, getCommentCount(post)) === 'waiting').length
  const statusFilterLabel = statusFilter === 'all' ? '질문 상태' : qnaListStatusLabel(statusFilter)
  const categoryFilterLabel = categoryFilter.length === 0 ? '전체' : categoryFilter.length === 1 ? categoryFilter[0] : `${categoryFilter.length}개 선택`

  const updatePost = (post: QnaPost) => onChange(posts.map((item) => item.id === post.id ? post : item))
  const toggleLike = (post: QnaPost) => updatePost({ ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) })
  const toggleStatus = (post: QnaPost) => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' })
  const selectAnswer = (post: QnaPost, commentId: string) => {
    const nextAcceptedId = post.selectedAnswerCommentId === commentId ? undefined : commentId
    updatePost(nextAcceptedId ? { ...post, status: 'resolved', selectedAnswerCommentId: nextAcceptedId } : { ...post, status: 'unresolved', selectedAnswerCommentId: undefined })
    setCommentsByPost((items) => ({ ...items, [post.id]: (items[post.id] ?? post.comments).map((item) => ({ ...item, isAccepted: item.id === nextAcceptedId })) }))
  }
  const toggleCommentLike = async (postId: string, comment: QnaComment) => {
    const currentComments = commentsByPost[postId] ?? posts.find((post) => post.id === postId)?.comments ?? []
    const nextLiked = !comment.liked
    const nextLikes = Math.max(0, (comment.likes ?? 0) + (nextLiked ? 1 : -1))
    setCommentsByPost((items) => ({ ...items, [postId]: currentComments.map((item) => item.id === comment.id ? { ...item, liked: nextLiked, likes: nextLikes } : item) }))
    const { data } = await supabase.from('post_comments').select('payload').eq('id', comment.id).maybeSingle()
    const payload = (data?.payload ?? {}) as Record<string, unknown>
    const storedLikedBy = Array.isArray(payload.likedBy) ? payload.likedBy.filter((value): value is string => typeof value === 'string') : []
    const nextLikedBy = nextLiked ? Array.from(new Set([...storedLikedBy, userId])) : storedLikedBy.filter((value) => value !== userId)
    await supabase.from('post_comments').update({ payload: { ...payload, likes: nextLikes, likedBy: nextLikedBy, liked_by: nextLikedBy } }).eq('id', comment.id)
  }
  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !comment.trim()) return
    const attachedHospitalSnapshot = attachedHospital ? { ...attachedHospital } : undefined
    const newComment: QnaComment = { id: crypto.randomUUID(), author: displayAuthor, authorAvatarUrl: profile.avatarUrl, body: comment.trim(), createdAt: new Date().toISOString(), mine: true, isAccepted: false, hospitalSnapshot: attachedHospitalSnapshot }
    const hospitalPayload = newComment.hospitalSnapshot ?? null
    setCommentsByPost((items) => {
      const current = items[selected.id] ?? selected.comments
      return { ...items, [selected.id]: [...current.filter((item) => item.id !== newComment.id), newComment] }
    })

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ id: newComment.id, post_id: selected.id, user_id: userId, body: newComment.body, payload: { author: newComment.author, authorAvatarUrl: newComment.authorAvatarUrl, isAccepted: false, is_accepted: false, hospitalSnapshot: hospitalPayload, hospital_snapshot: hospitalPayload } })
      .select('payload')
      .single()

    if (error) {
      console.error('Q&A 댓글 저장 실패:', error)
      setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((item) => item.id !== newComment.id) }))
      return
    }

    const savedComment = { ...newComment, hospitalSnapshot: readHospitalSnapshot(data?.payload) ?? attachedHospitalSnapshot }
    setCommentsByPost((items) => ({
      ...items,
      [selected.id]: (items[selected.id] ?? selected.comments).map((item) => item.id === newComment.id ? savedComment : item),
    }))
    setComment('')
    setAttachedHospital(null)
  }

  if (selected) {
    const selectedImages = selected.images?.length ? selected.images : selected.image ? [selected.image] : []
    const sortedComments = [...selectedComments].sort((a, b) => (a.id === selected.selectedAnswerCommentId ? -1 : 0) - (b.id === selected.selectedAnswerCommentId ? -1 : 0))
    const trustPosts = posts.map((post) => ({ ...post, comments: commentsByPost[post.id] ?? post.comments }))
    return (
      <section className="qna-detail">
        <header className="qna-detail-header">
          <button className="qna-back" type="button" aria-label="뒤로가기" onClick={() => setSelectedId(null)}>←</button>
          <strong>Q&A</strong>
          {selected.mine === true && <QnaOwnerMenu post={selected} onEdit={() => onEditPost(selected)} onToggleResolve={() => toggleStatus(selected)} onDelete={() => { if (window.confirm(`‘${selected.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) { onDeletePost(selected.id); setSelectedId(null) } }} />}
        </header>
        <article className="qna-detail-post">
          <div className="qna-detail-badges"><span className="qna-category" data-category={normalizeQnaCategory(selected.category)}>{normalizeQnaCategory(selected.category)}</span>{selected.mine === true ? <button className={`qna-detail-resolve-button ${qnaStatus(selected) === 'resolved' ? 'resolved' : ''}`} type="button" onClick={() => toggleStatus(selected)}>{qnaStatus(selected) === 'resolved' ? '해결 완료' : '해결'}</button> : <span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span>}</div>
          <h2>{selected.title}</h2>
          <div className="qna-detail-author qna-detail-author-meta"><UserAvatar url={selected.mine === true ? profile.avatarUrl : selected.authorAvatarUrl} name={qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)} /><div className="qna-detail-author-copy"><strong>{qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)}</strong><QnaPostMeta createdAt={selected.createdAt} viewCount={selected.viewCount ?? 0} commentCount={selectedComments.length} likes={selected.likes} className="qna-detail-meta-line" /></div></div>
          <div className="qna-detail-pet-meta">종: {formatQnaAnimal(selected)}</div>
          <div className="qna-author"><UserAvatar url={selected.mine === true ? profile.avatarUrl : selected.authorAvatarUrl} name={qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)} /><div><strong>{qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
          {selectedImages.length > 0 && <div className="qna-detail-image-grid">{selectedImages.map((image) => <button className="qna-detail-image-button" type="button" key={image} onClick={() => setLightboxImage(image)}><img src={image} alt="첨부 이미지" /></button>)}</div>}
          <p>{selected.body}</p>
          {selected.attachedDiarySnapshot && selected.attachedDiarySnapshot.records.length > 1 && <DiaryVisualizationAttachment snapshot={selected.attachedDiarySnapshot} />}
          {!selected.attachedDiarySnapshot && selected.attachedRecordSnapshot && <RecordAttachCard record={selected.attachedRecordSnapshot} mode="posted" onOpen={() => onOpenDiary(selected.attachedRecordSnapshot!.petId, selected.mine !== true)} />}
          <div className="qna-detail-actions">
            <button className={`qna-like ${selected.liked ? 'active' : ''}`} type="button" aria-label={selected.liked ? '좋아요 취소' : '좋아요'} aria-pressed={selected.liked} onClick={() => toggleLike(selected)}><HeartIcon filled={selected.liked} /><span>{selected.likes}</span></button>
          </div>
        </article>
        <section className="qna-comments">
          <h3>댓글 {selectedComments.length}</h3>
          {sortedComments.map((item) => (
            <article className={selected.selectedAnswerCommentId === item.id ? 'accepted' : ''} key={item.id}>
              <div className="qna-comment-head"><span className="qna-comment-author"><UserAvatar url={item.mine ? profile.avatarUrl : item.authorAvatarUrl} name={item.author} /><span><strong>{item.author} <QnaTrustBadge score={getTrustScoreForAuthor(trustPosts, item.author)} /></strong><time>{formatQnaDate(item.createdAt)}</time></span></span>{item.mine && <div className="qna-comment-menu"><button type="button" aria-label="댓글 관리 메뉴" aria-expanded={commentMenuId === item.id} onClick={() => setCommentMenuId(commentMenuId === item.id ? null : item.id)}>⋮</button>{commentMenuId === item.id && <div><button type="button" onClick={async () => { await supabase.from('post_comments').delete().eq('id', item.id).eq('user_id', userId); setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((commentItem) => commentItem.id !== item.id) })); setCommentMenuId(null) }}>댓글 삭제</button></div>}</div>}</div>
              {selected.selectedAnswerCommentId === item.id && <span className="accepted-answer-chip">채택 답변</span>}
              {item.body && <p>{item.body}</p>}
              {item.hospitalSnapshot && <HospitalAttachCard hospital={item.hospitalSnapshot} mode="posted" onOpen={() => onOpenHospital(item.hospitalSnapshot!)} />}
              <button className={`qna-comment-like ${item.liked ? 'active' : ''}`} type="button" aria-label={item.liked ? '댓글 좋아요 취소' : '댓글 좋아요'} aria-pressed={item.liked} onClick={() => void toggleCommentLike(selected.id, item)}><span aria-hidden="true">{item.liked ? '♥' : '♡'}</span>{(item.likes ?? 0) > 0 && <span className="qna-comment-like-count">{item.likes}</span>}</button>
              {selected.mine === true && <button className="qna-accept-button" type="button" onClick={() => selectAnswer(selected, item.id)}>{selected.selectedAnswerCommentId === item.id ? '채택 취소' : '답변 채택'}</button>}
            </article>
          ))}
          <form onSubmit={addComment}>
            {attachedHospital && <HospitalAttachCard hospital={attachedHospital} mode="draft" onRemove={() => setAttachedHospital(null)} />}
            <div className="qna-comment-tools">
              <button type="button" onClick={() => setHospitalPickerOpen((open) => !open)}>병원 첨부</button>
            </div>
            <div className="qna-comment-input-row">
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요" aria-label="댓글" />
              <button type="submit" disabled={!comment.trim()}>등록</button>
            </div>
          </form>
        </section>
        {hospitalPickerOpen && <HospitalPicker hospitals={hospitals} onSelect={(hospital) => { setAttachedHospital(hospital); setHospitalPickerOpen(false) }} onClose={() => setHospitalPickerOpen(false)} />}
        {lightboxImage && <div className="qna-lightbox" role="dialog" aria-modal="true" aria-label="이미지 확대 보기" onClick={() => setLightboxImage(null)} onKeyDown={(event) => { if (event.key === 'Escape') setLightboxImage(null) }} tabIndex={-1}><button type="button" className="qna-lightbox-close" aria-label="이미지 닫기" onClick={() => setLightboxImage(null)}>×</button><img src={lightboxImage} alt="확대된 첨부 이미지" onClick={(event) => event.stopPropagation()} /></div>}
      </section>
    )
  }

  return (
    <section className="qna-feed-page">
      <header className="qna-feed-head">
        <div>
          <h2>Q&A</h2>
          {waitingCount > 0 && <p className="qna-feed-summary">답변이 필요한 질문 {waitingCount}개</p>}
        </div>
        <button className="qna-create-button" type="button" aria-label="글쓰기" onClick={() => onCreate()}><span className="qna-write-icon" aria-hidden="true" /></button>
      </header>
      <label className="qna-feed-search"><span aria-hidden="true">⌕</span><input aria-label="Q&A 검색" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setVisibleCount(6) }} placeholder="질문이나 동물 종으로 검색" />{searchInput && <button type="button" aria-label="검색어 지우기" onClick={() => { setSearchInput(''); setQuery(''); setVisibleCount(6) }}>×</button>}</label>
      <div className="qna-filter-compact" aria-label="Q&A 필터">
        <button className="qna-filter-icon-button" type="button" aria-label="전체 필터 열기" onClick={() => setFilterSheet((current) => current === 'all' ? null : 'all')}><svg className="qna-filter-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="6" r="2.2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.6" /><circle cx="15" cy="12" r="2.2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="18" r="2.2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.6" /></svg></button>
        <button className={`qna-filter-summary ${statusFilter !== 'all' ? 'is-selected' : ''}`} type="button" onClick={() => setFilterSheet((current) => current === 'status' ? null : 'status')}>{statusFilterLabel}<span className="qna-sort-chevron" aria-hidden="true" /></button>
        <button className={`qna-filter-summary ${categoryFilter.length > 0 ? 'is-selected' : ''}`} type="button" onClick={() => setFilterSheet((current) => current === 'category' ? null : 'category')}>{categoryFilterLabel}<span className="qna-sort-chevron" aria-hidden="true" /></button>
        <button className="qna-feed-sort-trigger" type="button" aria-label="정렬 선택" onClick={() => setSortSheetOpen((open) => !open)}>{qnaSortLabel(sort)}<span className="qna-sort-chevron" aria-hidden="true" /></button>
      </div>
      <div className="qna-filter-bar" aria-label="Q&A 필터">
        <div className="qna-filter-row" aria-label="답변 상태">
          {([['all', '전체'], ['waiting', '답변 대기'], ['answered', '답변 있음(미해결)'], ['resolved', '해결']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={statusFilter === value} className={statusFilter === value ? 'active' : ''} onClick={() => { setStatusFilter(value); setVisibleCount(6) }}>{label}</button>)}
        </div>
        <div className="qna-filter-row" aria-label="질문 카테고리">
          <button type="button" aria-pressed={categoryFilter.length === 0} className={categoryFilter.length === 0 ? 'active' : ''} onClick={() => { setCategoryFilter([]); setVisibleCount(6) }}>전체</button>
          {qnaCategoryCards.map((categoryItem) => <button key={categoryItem} type="button" aria-pressed={categoryFilter.includes(categoryItem)} className={categoryFilter.includes(categoryItem) ? 'active' : ''} onClick={() => { setCategoryFilter(categoryFilter.includes(categoryItem) ? categoryFilter.filter((item) => item !== categoryItem) : [...categoryFilter, categoryItem]); setVisibleCount(6) }}>{categoryItem}</button>)}
        </div>
        <button className="qna-feed-sort-trigger" type="button" aria-label="정렬 선택" onClick={() => setSortSheetOpen((open) => !open)}>{qnaSortLabel(sort)}⌄</button>
      </div>
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true">⌕</div>
        <strong>{query ? '검색 결과가 없습니다.' : statusFilter !== 'all' || categoryFilter.length > 0 ? '선택한 조건에 맞는 질문이 없습니다.' : '아직 등록된 질문이 없습니다.'}</strong>
        {(query || statusFilter !== 'all' || categoryFilter.length > 0) && <button type="button" onClick={() => { setSearchInput(''); setQuery(''); setStatusFilter('all'); setCategoryFilter([]); setVisibleCount(6) }}>필터 초기화</button>}
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
                {visiblePosts.map((post) => { const cardAuthor = qnaDisplayAuthor(post.author, post.mine === true, displayAuthor); return <QnaHelpCard post={post} authorName={cardAuthor} trustScore={getTrustScoreForAuthor(posts, cardAuthor)} commentCount={getCommentCount(post)} fallbackAvatarUrl={post.mine === true ? profile.avatarUrl : ''} key={post.id} onOpen={() => { sessionStorage.setItem(`qna_scroll_${userId}`, String(window.scrollY)); setSelectedId(post.id) }} onEdit={post.mine === true ? () => onEditPost(post) : undefined} onToggleResolve={post.mine === true ? () => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' }) : undefined} onDelete={post.mine === true ? () => { if (window.confirm(`‘${post.title || '제목 없는 질문'}’ 질문을 삭제할까요?`)) void onDeletePost(post.id) } : undefined} /> })}
          </div>
          {visiblePosts.length < feedPosts.length && <button className="qna-load-more" type="button" onClick={() => setVisibleCount((count) => count + 6)}>더보기</button>}
        </section>
      )}
      {filterSheet && <QnaFilterChoiceSheet scope={filterSheet} status={statusFilter} category={categoryFilter} sort={sort} onApply={(nextStatus, nextCategory, nextSort) => { setStatusFilter(nextStatus); setCategoryFilter(nextCategory); setSort(nextSort); setVisibleCount(6); setFilterSheet(null) }} onClose={() => setFilterSheet(null)} />}
      {sortSheetOpen && <QnaSortSheet value={sort} onChange={(value) => { setSort(value); setVisibleCount(6); setSortSheetOpen(false) }} onClose={() => setSortSheetOpen(false)} />}
      <button className="qna-mobile-fab" type="button" aria-label="글쓰기" onClick={() => onCreate()}><svg className="qna-write-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 5.5 15.2 16.3 4.4a2.1 2.1 0 0 1 3 0l.3.3a2.1 2.1 0 0 1 0 3L8.8 18.8 4 20Z" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /><path d="m14.8 5.9 3.3 3.3" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /><path d="m4 20 1.5-4.8 3.3 3.3L4 20Z" fill="currentColor" /></svg></button>
    </section>
  )
}

function QnaHelpCard({ post, authorName, trustScore, commentCount, fallbackAvatarUrl, onOpen, onEdit, onToggleResolve, onDelete }: { post: QnaPost; authorName: string; trustScore: number; commentCount: number; fallbackAvatarUrl?: string; onOpen: () => void; onEdit?: () => void; onToggleResolve?: () => void; onDelete?: () => void }) {
  const postImages = post.images?.length ? post.images : post.image ? [post.image] : []
  const record = post.attachedRecordSnapshot
  const diary = post.attachedDiarySnapshot
  const recordTypeCounts = diary ? Object.entries(diary.records.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] ?? 0) + 1
    return counts
  }, {})) : []
  const maxRecordTypeCount = Math.max(1, ...recordTypeCounts.map(([, count]) => count))
  const [menuOpen, setMenuOpen] = useState(false)
  const [recordPreviewOpen, setRecordPreviewOpen] = useState(false)
  const title = post.title.trim() || '제목 없는 질문'
  const body = post.body.trim()
  const listStatus = qnaListStatus(post, commentCount)
  const statusLabel = listStatus === 'answered' ? `답변 ${commentCount}개` : qnaListStatusLabel(listStatus)
  const attachedRecordCount = diary?.records.length ?? (record ? 1 : 0)
  return (
    <article className={`qna-help-card ${listStatus}`} role="button" tabIndex={0} aria-label={`${title} 상세 보기`} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}>
      <div className="qna-help-card-top">
        <span className={`qna-status ${listStatus}`}>{statusLabel}</span>
        <span className="qna-category" data-category={normalizeQnaCategory(post.category)}>{normalizeQnaCategory(post.category)}</span>
        {(onEdit || onToggleResolve || onDelete) && <div className="qna-card-menu">
          <button className="qna-card-menu-trigger" type="button" aria-label="질문 관리 메뉴" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((value) => !value) }}>⋮</button>
          {menuOpen && <div className="qna-card-menu-popover" onClick={(event) => event.stopPropagation()}>
            {onEdit && <button type="button" onClick={() => { setMenuOpen(false); onEdit() }}>수정</button>}
            {onToggleResolve && <button type="button" onClick={() => { setMenuOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결'}</button>}
            {onDelete && <button className="danger" type="button" onClick={() => { setMenuOpen(false); onDelete() }}>삭제</button>}
          </div>}
        </div>}
      </div>
      <div className="qna-card-author-row">
        <span className="post-author"><UserAvatar url={fallbackAvatarUrl || post.authorAvatarUrl} name={authorName} />{authorName}<QnaTrustBadge score={trustScore} /></span>
      </div>
      <footer>
        <QnaPostMeta createdAt={post.createdAt} viewCount={post.viewCount ?? 0} commentCount={commentCount} likes={post.likes} className="qna-card-meta-line" />
      </footer>
      <div className="qna-card-main">
        <div className="qna-card-copy">
          <h3>{title}</h3>
          {(formatQnaAnimal(post) !== '동물 X' || attachedRecordCount > 0) && <div className="qna-card-animal-row">
            {formatQnaAnimal(post) !== '동물 X' && <p className="qna-help-card-animal">종 : {formatQnaAnimal(post)}</p>}
            {attachedRecordCount > 0 && <button className="qna-card-record-link" type="button" onClick={(event) => { event.stopPropagation(); setRecordPreviewOpen(true) }}>기록이 첨부됨</button>}
          </div>}
          {body && <p className="qna-help-card-preview">{body}</p>}
        </div>
        {(postImages.length > 0 || (diary && diary.records.length > 1) || record) && <div className="qna-card-media" aria-label={postImages.length > 0 ? '첨부 사진 미리보기' : '첨부 기록 시각화 미리보기'}>
          {postImages.length > 0 ? <><img src={postImages[0]} alt="첨부 사진 미리보기" />{postImages.length > 1 && <span className="qna-card-media-count">+{postImages.length - 1}</span>}</> : <button className="qna-card-visualization qna-card-visualization-button" type="button" aria-label="첨부 기록 자세히 보기" onClick={(event) => { event.stopPropagation(); setRecordPreviewOpen(true) }}>
            <span>{diary ? '기록' : record?.recordTypeLabel}</span>
            {diary ? recordTypeCounts.slice(0, 4).map(([type, count]) => <i key={type} style={{ height: `${Math.max(18, (count / maxRecordTypeCount) * 52)}%` }} />) : <i style={{ height: '58%' }} />}
          </button>}
        </div>}
      </div>
      {recordPreviewOpen && (diary || record) && <div className="qna-record-preview-overlay" role="dialog" aria-modal="true" aria-label="첨부 기록 자세히 보기" onClick={() => setRecordPreviewOpen(false)}>
        <section className="qna-record-preview-dialog" onClick={(event) => event.stopPropagation()}>
          <header><strong>{diary?.petName ?? record?.petName}의 기록</strong><button type="button" aria-label="기록 닫기" onClick={() => setRecordPreviewOpen(false)}>×</button></header>
          {diary ? <DiaryVisualizationAttachment snapshot={diary} /> : record && <RecordAttachCard record={record} mode="posted" />}
        </section>
      </div>}
    </article>
  )
}


function QnaFilterChoiceSheet({ scope, status, category, sort, onApply, onClose }: { scope: 'all' | 'status' | 'category'; status: QnaListStatus; category: QnaCategory[]; sort: QnaSort; onApply: (status: QnaListStatus, category: QnaCategory[], sort: QnaSort) => void; onClose: () => void }) {
  const [draftStatus, setDraftStatus] = useState(status)
  const [draftCategory, setDraftCategory] = useState(category)
  const [draftSort, setDraftSort] = useState(sort)
  const showStatus = scope === 'all' || scope === 'status'
  const showCategory = scope === 'all' || scope === 'category'
  return (
    <div className="qna-sort-sheet-overlay">
      <button className="qna-sort-sheet-dim" type="button" aria-label="필터 닫기" onClick={onClose} />
      <section className="qna-sort-sheet qna-filter-choice-sheet" role="dialog" aria-modal="true" aria-label="Q&A 필터">
        <span className="hospital-picker-handle" aria-hidden="true" />
        {showStatus && <fieldset><legend>질문 상태</legend>{([['all', '전체'], ['waiting', '답변 대기'], ['answered', '답변 있음(미해결)'], ['resolved', '해결']] as const).map(([value, label]) => { const active = draftStatus === value; return <button className={active ? 'active' : ''} type="button" key={value} aria-pressed={active} onClick={() => setDraftStatus(value)}>{label}</button> })}</fieldset>}
        {showCategory && <fieldset><legend>주제</legend>{([['all', '전체'], ...qnaCategoryCards.map((item) => [item, item] as [QnaCategory, string])]).map(([value, label]) => { const active = value === 'all' ? draftCategory.length === 0 : draftCategory.includes(value as QnaCategory); return <button className={active ? 'active' : ''} type="button" key={value} aria-pressed={active} onClick={() => setDraftCategory(value === 'all' ? [] : draftCategory.includes(value as QnaCategory) ? draftCategory.filter((item) => item !== value) : [...draftCategory, value as QnaCategory])}>{label}</button> })}</fieldset>}
        <fieldset><legend>정렬</legend>{(['latest', 'popular', 'comments'] as QnaSort[]).map((value) => <button className={draftSort === value ? 'active' : ''} type="button" key={value} aria-pressed={draftSort === value} onClick={() => setDraftSort(value)}>{qnaSortLabel(value)}</button>)}</fieldset>
        <button className="qna-filter-sheet-done" type="button" onClick={() => onApply(draftStatus, draftCategory, draftSort)}>적용</button>
      </section>
    </div>
  )
}

function QnaSortSheet({ value, onChange, onClose }: { value: QnaSort; onChange: (value: QnaSort) => void; onClose: () => void }) {
  const options: QnaSort[] = ['latest', 'popular', 'comments']
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

export function QnaCreateFlow({ userId, pets, author, authorAvatarUrl, initialPetId, initialDraft, onClose, onSave }: { userId: string; pets: Pet[]; author: string; authorAvatarUrl: string; initialPetId?: string; initialDraft?: DraftItem | null; onClose: () => void; onSave: (post: QnaPost) => void | Promise<void> }) {
  const initialPost = initialDraft?.draftType === 'question' ? initialDraft.payload as QnaPost : null
  const startedFromDiary = Boolean(initialPetId && pets.some((pet) => pet.id === initialPetId) && !initialDraft && !initialPost)
  const [step, setStep] = useState(initialDraft?.step ?? 0)
  const [petId, setPetId] = useState(initialPost?.petId || (initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : ''))
  const [category, setCategory] = useState<QnaCategory | ''>(initialPost ? normalizeQnaCategory(initialPost.category) : '')
  const [title, setTitle] = useState(initialPost?.title ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const initialImages = initialPost?.images ?? (initialPost?.image ? [initialPost.image] : [])
  const [imageUploads, setImageUploads] = useState<QnaImageUploadItem[]>(() => initialImages.map((url, index) => ({ id: `existing-${index}-${url}`, previewUrl: url, storageUrl: url, status: 'uploaded', progress: 100 })))
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
  const [attachedDiary, setAttachedDiary] = useState<AttachedDiarySnapshot | null>(initialPost?.attachedDiarySnapshot ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [recordCountPetId, setRecordCountPetId] = useState<string | null>(null)
  const [recordAttachOpen, setRecordAttachOpen] = useState(false)
  const [recordCandidates] = useState<PetRecord[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const autoAttachedRef = useRef(false)
  const pet = pets.find((item) => item.id === petId)
  const hasNoAnimal = petId === 'none'
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && imageUploads.some((item) => item.status === 'uploaded' && Boolean(item.storageUrl))
  const canNext = step === 0 ? Boolean(category) : step === 1 ? Boolean(petId) : canSubmit
  const goNextStep = () => setStep((value) => startedFromDiary && value === 0 ? 2 : value + 1)
  const goPreviousStep = () => setStep((value) => startedFromDiary && value === 2 ? 0 : value - 1)
  const changeStep = (nextStep: number) => setStep(startedFromDiary && nextStep === 1 ? 2 : nextStep)
  const displayStep = startedFromDiary ? step === 2 ? 1 : 0 : step
  const displayStepCount = startedFromDiary ? 2 : 3
  const displayStepLabels = startedFromDiary ? ['질문 유형', '질문 내용'] : ['질문 유형', '질문 대상', '질문 내용']
  const selectedGroup = hasNoAnimal ? '동물 X' : pet ? animalCategoryLabels[pet.group] : ''
  const selectedSpecies = hasNoAnimal ? '' : pet?.species || ''
  const uploadedImageUrls = imageUploads.filter((item) => item.status === 'uploaded' && item.storageUrl).map((item) => item.storageUrl as string)
  const buildPost = (): QnaPost => ({
    id: initialPost?.id ?? crypto.randomUUID(),
    category: category || '질병',
    status: 'unresolved',
    title: title.trim(),
    body: body.trim(),
    author,
    authorAvatarUrl,
    mine: true,
    animal: hasNoAnimal ? '동물 X' : selectedSpecies.trim(),
    animalGroup: selectedGroup.trim(),
    animalSpecies: selectedSpecies.trim(),
    petId: hasNoAnimal ? '' : petId,
    image: uploadedImageUrls[0],
    images: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
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

  useEffect(() => {
    if (hasNoAnimal || !petId || !pet || step !== 2) {
      return
    }
    let cancelled = false
    void loadPetRecords().then((records) => {
      if (!cancelled) {
        setRecordCount(records?.length ?? 0)
        setRecordCountPetId(petId)
      }
    })
    return () => { cancelled = true }
  }, [hasNoAnimal, loadPetRecords, pet, petId, step])

  const openRecordAttach = async () => {
    if (attachedDiary) return
    if (hasNoAnimal || !petId || !pet || diaryLoading) return
    setDiaryLoading(true)
    try {
      const petRecords = await loadPetRecords()
      if (!petRecords) return
      if (petRecords.length <= 1) {
        setRecordCount(petRecords.length)
        return
      }
      const attachment = makeDiaryAttachment(petRecords)
      if (attachment) setAttachedDiary(attachment)
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

  const hasImageUploadInProgress = imageUploads.some((item) => item.status === 'uploading')
  const hasImageUploadError = imageUploads.some((item) => item.status === 'error')
  const finish = () => {
    if (hasImageUploadInProgress || hasImageUploadError) return
    onSave(buildPost())
  }

  const updateImageUpload = (id: string, update: Partial<QnaImageUploadItem>) => {
    setImageUploads((items) => items.map((item) => item.id === id ? { ...item, ...update } : item))
  }

  const uploadImage = async (item: QnaImageUploadItem) => {
    if (!item.file) return
    updateImageUpload(item.id, { status: 'uploading', progress: 8, error: undefined })
    const progressTimer = window.setInterval(() => {
      setImageUploads((items) => items.map((current) => current.id === item.id && current.status === 'uploading'
        ? { ...current, progress: Math.min(90, current.progress + 8) }
        : current))
    }, 180)
    try {
      const extension = item.file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from(QNA_IMAGE_BUCKET).upload(path, item.file, { cacheControl: '3600', contentType: item.file.type || 'image/jpeg', upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from(QNA_IMAGE_BUCKET).getPublicUrl(path)
      updateImageUpload(item.id, { status: 'uploaded', progress: 100, storageUrl: data.publicUrl, storagePath: path })
    } catch (error) {
      updateImageUpload(item.id, { status: 'error', progress: 0, error: error instanceof Error ? error.message : '업로드에 실패했습니다.' })
    } finally {
      window.clearInterval(progressTimer)
    }
  }

  const attachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/')).slice(0, 3)
    event.target.value = ''
    if (files.length === 0) return
    const nextItems = files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: 'uploading' as const, progress: 0 }))
    setImageUploads(nextItems)
    nextItems.forEach((item) => { void uploadImage(item) })
  }

  const removeImage = (id: string) => {
    setImageUploads((items) => {
      const target = items.find((item) => item.id === id)
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      if (target?.storagePath) void supabase.storage.from(QNA_IMAGE_BUCKET).remove([target.storagePath])
      return items.filter((item) => item.id !== id)
    })
  }

  return (
    <StepShell title="질문 작성" onBack={step === 0 ? onClose : goPreviousStep} currentStep={displayStep} stepCount={displayStepCount} stepLabels={displayStepLabels} onStepChange={changeStep}>
      {step === 0 && <StepSelect label="질문 유형" value={category} options={qnaCategoryCards} onChange={(value) => { setCategory(value as QnaCategory); if (startedFromDiary) setStep(2) }} />}
      {step === 1 && !startedFromDiary && <QnaPetSelect pets={pets} value={petId} onChange={changePet} />}
      {step === 2 && <div className="qna-compose-fields">
        <StepText label="제목" value={title} onChange={setTitle} placeholder="질문 제목을 입력하세요" />
        <StepTextarea label="내용" value={body} onChange={setBody} placeholder="궁금한 내용을 자세히 적어 주세요" />
        <label className="step-field attach-file-field"><span>사진 첨부 (선택)</span><span className="attach-file-button">사진 선택</span><input type="file" accept="image/*" multiple onChange={attachImage} /><small>{imageUploads.length > 0 ? `사진 ${imageUploads.length}장이 선택되었습니다` : '선택된 사진 없음'}</small></label>
        {imageUploads.length > 0 && <div className="qna-compose-upload-list">{imageUploads.map((item) => <div className={`qna-compose-upload-item ${item.status}`} key={item.id}>
          <img src={item.previewUrl} alt="첨부 사진 미리보기" />
          <div className="qna-compose-upload-status"><span>{item.status === 'uploaded' ? '업로드 완료' : item.status === 'error' ? '업로드 실패' : `업로드 중 ${item.progress}%`}</span>{item.status === 'uploading' && <progress value={item.progress} max="100" />}{item.error && <small>{item.error}</small>}</div>
          {item.status === 'error' && <button type="button" onClick={() => { void uploadImage(item) }}>재시도</button>}
          <button type="button" aria-label="첨부 사진 삭제" onClick={() => removeImage(item.id)}>삭제</button>
        </div>)}</div>}
        {attachedRecord && <RecordAttachCard record={attachedRecord} mode="draft" onRemove={() => setAttachedRecord(null)} />}
        {!startedFromDiary && !hasNoAnimal && petId && <div className="qna-compose-tools">
          <button type="button" disabled={!attachedDiary && (diaryLoading || recordCountPetId !== petId || recordCount === null || recordCount <= 1)} onClick={openRecordAttach}>{attachedDiary ? '기록 첨부됨' : diaryLoading ? '기록 불러오는 중' : '기록 첨부'}</button>
        </div>}
        <div>
          {diaryLoading && <DiaryTimelineSkeleton />}
          {attachedDiary && !diaryLoading && <div className="qna-record-attached-state"><span>기록 첨부됨</span><button type="button" onClick={() => setAttachedDiary(null)}>첨부 해제</button></div>}
        </div>
        {recordAttachOpen && pet && <QnaRecordAttachSheet pet={pet} records={recordCandidates} selectedIds={selectedRecordIds} onToggle={(recordId) => setSelectedRecordIds((ids) => ids.includes(recordId) ? ids.filter((id) => id !== recordId) : [...ids, recordId])} onSelectDate={(_date, ids) => setSelectedRecordIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])} onClose={() => setRecordAttachOpen(false)} onSave={saveRecordAttachment} />}
      </div>}
      {step === 2 && <div className="step-actions"><button className="step-secondary step-back" type="button" onClick={goPreviousStep}>이전</button><button className="step-primary" type="button" disabled={!canNext || hasImageUploadInProgress || hasImageUploadError} onClick={finish}>등록</button></div>}
      {step !== 2 && !startedFromDiary && <div className="step-actions"><button className="step-secondary step-back" type="button" onClick={() => setStep((value) => value - 1)} disabled={step === 0}>이전</button><button className="step-primary" type="button" disabled={!canNext} onClick={goNextStep}>다음</button></div>}
    </StepShell>
  )
}

function QnaOwnerMenu({ post, onEdit, onToggleResolve, onDelete }: { post: QnaPost; onEdit: () => void; onToggleResolve: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return <div className="qna-owner-menu">
    <button type="button" aria-label="질문 관리 메뉴 열기" aria-expanded={open} onClick={() => setOpen((value) => !value)}>⋮</button>
    {open && <div role="menu"><button type="button" onClick={() => { setOpen(false); onEdit() }}>수정</button><button type="button" onClick={() => { setOpen(false); onToggleResolve() }}>{qnaStatus(post) === 'resolved' ? '해결 취소' : '해결'}</button><button className="danger" type="button" onClick={() => { setOpen(false); onDelete() }}>삭제</button></div>}
  </div>
}

function QnaRecordAttachSheet({
  pet,
  records,
  selectedIds,
  onToggle,
  onSelectDate,
  onClose,
  onSave,
}: {
  pet: Pet
  records: PetRecord[]
  selectedIds: string[]
  onToggle: (recordId: string) => void
  onSelectDate: (date: string, ids: string[]) => void
  onClose: () => void
  onSave: (records: PetRecord[]) => void
}) {
  const visibleRecords = records
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

function QnaViewIcon() {
  return <svg className="qna-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
}

function QnaTimeIcon() {
  return <svg className="qna-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5v5l3.2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function QnaCommentIcon() {
  return <svg className="qna-meta-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-7l-4.5 3v-3H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7.5 9h9M7.5 12.5h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
}

function QnaPostMeta({ createdAt, viewCount, commentCount, likes, className = '' }: { createdAt: string; viewCount: number; commentCount: number; likes: number; className?: string }) {
  return <div className={`post-meta ${className}`.trim()}>
    <span><QnaTimeIcon /><span>{formatQnaDate(createdAt)}</span></span>
    <span><QnaViewIcon /><span>조회 {viewCount}</span></span>
    <span><QnaCommentIcon /><span>댓글 {commentCount}</span></span>
    {likes > 0 && <span className="qna-meta-like"><HeartIcon filled /><span>좋아요 {likes}</span></span>}
  </div>
}

function formatQnaAnimal(post: QnaPost) {
  if (post.animal === '동물 X' || post.animalGroup === '동물 X' || post.animal === '동물 없음' || post.animalGroup === '동물 없음') return '동물 X'
  const species = post.animalSpecies || post.animal || '종 미지정'
  return species
}

function normalizeQnaCategory(category: string): QnaCategory {
  if (category === '건강/증상' || category === '동물 병원' || category === '병원/진료') return '질병'
  if (category === '정보' || category === '기타' || category === '사육/관리') return '사육'
  if (qnaCategoryCards.includes(category as QnaCategory)) return category as QnaCategory
  return '질병'
}

function qnaDisplayAuthor(author: string | undefined, mine: boolean, currentNickname: string) {
  if (mine || !author || author === '작성자' || author === '나') return currentNickname
  return author
}

function qnaStatus(post: QnaPost): QnaStatus {
  return post.status === 'resolved' ? 'resolved' : 'unresolved'
}

function qnaStatusLabel(status: QnaStatus) {
  return status === 'resolved' ? '해결' : '답변 대기'
}

function parseQnaStatusFilter(value: string | null): QnaListStatus {
  return value === 'waiting' || value === 'answered' || value === 'resolved' ? value : 'all'
}

function parseQnaCategoryFilters(value: string | null): QnaCategory[] {
  if (!value || value === 'all') return []
  return value.split(',').filter((item): item is QnaCategory => qnaCategoryCards.includes(item as QnaCategory))
}

function parseQnaSort(value: string | null): QnaSort {
  return value === 'popular' || value === 'comments' ? value : 'latest'
}

function qnaListStatus(post: QnaPost, commentCount = post.comments.length): QnaListStatus {
  if (qnaStatus(post) === 'resolved') return 'resolved'
  return commentCount > 0 ? 'answered' : 'waiting'
}

function qnaListStatusLabel(status: QnaListStatus) {
  if (status === 'resolved') return '해결'
  if (status === 'answered') return '답변 있음(미해결)'
  return '답변 대기'
}

const qnaCategoryCards: QnaCategory[] = ['질병', '사육', '먹이', '환경', '행동', '번식']

function qnaSortLabel(sort: QnaSort) {
  if (sort === 'latest') return '최신순'
  if (sort === 'popular') return '인기순'
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
  const [expanded, setExpanded] = useState(false)
  const recentPets = [...pets].sort((a, b) => {
    const aTime = a.registeredAt ? new Date(a.registeredAt).getTime() : 0
    const bTime = b.registeredAt ? new Date(b.registeredAt).getTime() : 0
    return bTime - aTime
  })
  const firstPets = recentPets.slice(0, 5)
  const selectedPetIsHidden = Boolean(value && value !== 'none' && !firstPets.some((pet) => pet.id === value))
  const selectedPet = selectedPetIsHidden ? recentPets.find((pet) => pet.id === value) : undefined
  const visiblePets = expanded ? recentPets : selectedPet ? [selectedPet, ...firstPets.filter((pet) => pet.id !== selectedPet.id)].slice(0, 5) : firstPets
  return <section className="qna-pet-select">
    <h2>관련 펫</h2>
    <div className="qna-pet-grid">
      {visiblePets.map((pet) => <button className={value === pet.id ? 'active' : ''} type="button" key={pet.id} onClick={() => onChange(pet.id)}>
        <span className="qna-pet-avatar">{pet.photo ? <img src={pet.photo} alt="" /> : <CategoryTagIcon category={pet.group} />}</span>
        <span className="qna-pet-copy"><strong>{pet.name}</strong><small>{pet.species || '종 미등록'}</small><small>{qnaGenderLabel(pet.gender)}</small></span>
      </button>)}
      <button className={value === 'none' ? 'active' : ''} type="button" onClick={() => onChange('none')}>
        <span className="qna-pet-avatar qna-pet-none" aria-hidden="true">×</span>
        <span className="qna-pet-copy"><strong>동물 X</strong><small>질문 대상 없음</small><small>펫 없이 질문하기</small></span>
      </button>
      {pets.length > 5 && !expanded && <button className="qna-pet-more" type="button" onClick={() => setExpanded(true)}>더보기</button>}
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
