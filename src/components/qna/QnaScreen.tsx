import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import GuideAction from '../common/GuideAction'
import Mascot from '../common/Mascot'
import { ensureSupabaseSession, supabase } from '../../lib/supabase'
import { loadAppData } from '../../lib/appData'
import { saveLike } from '../../lib/likes'
import { sanitizeImageFile, validateImageFile } from '../../lib/imageStorage'
import { maskKoreanProfanity } from '../../lib/qnaModeration'
import StepShell from '../account/StepShell'
import HeartIcon from '../common/HeartIcon'
import { QnaIcon } from './QnaIcon'
import { RequiredMark } from '../common/FieldMarkers'
import { TextField } from '../ui'
import { DiaryTimelineSkeleton, DiaryVisualizationAttachment, HospitalAttachCard, RecordAttachCard } from './QnaParts'
import { QnaTrustBadge } from './QnaTrustBadge'
import { getTrustScoreForAuthor } from './qnaTrust'
import type { AppProfile, AttachedDiarySnapshot, AttachedRecordSnapshot, DraftItem, HospitalSnapshot, Pet, QnaCategory, QnaComment, QnaListStatus, QnaPost, QnaSort, QnaStatus } from '../../types/app'
import './qna-flow.css'

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
  if (Array.isArray(value)) return readHospitalSnapshot(value[0])
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const candidate = record.hospitalSnapshot ?? record.hospital_snapshot ?? record.hospital ?? (typeof record.name === 'string' ? record : undefined) ?? (typeof record.place_name === 'string' ? record : undefined)
  if (!candidate || typeof candidate !== 'object') return undefined
  const hospital = candidate as Record<string, unknown>
  const name = typeof hospital.name === 'string' ? hospital.name : typeof hospital.place_name === 'string' ? hospital.place_name : ''
  if (!name) return undefined
  const address = typeof hospital.address === 'string'
    ? hospital.address
    : typeof hospital.roadAddress === 'string'
      ? hospital.roadAddress
      : typeof hospital.road_address === 'string'
        ? hospital.road_address
        : typeof hospital.shortAddress === 'string' ? hospital.shortAddress : typeof hospital.road_address === 'string' ? hospital.road_address : ''
  const animalTags = hospital.animalTags ?? hospital.animal_tags ?? hospital.categories
  const naverLink = hospital.naverLink ?? hospital.naver_link ?? hospital.link
  return {
    id: typeof hospital.id === 'string' ? hospital.id : undefined,
    name,
    address,
    phone: typeof hospital.phone === 'string' ? hospital.phone : '',
    lat: typeof hospital.lat === 'number' ? hospital.lat : typeof hospital.y === 'number' ? hospital.y : 0,
    lng: typeof hospital.lng === 'number' ? hospital.lng : typeof hospital.x === 'number' ? hospital.x : 0,
    animalTags: Array.isArray(animalTags) ? animalTags.filter((tag): tag is string => typeof tag === 'string') : [],
    naverLink: typeof naverLink === 'string' ? naverLink : '',
    source: hospital.source === 'local_hospital_data' ? 'local_hospital_data' : 'naver_local_search',
  }
}

function readCommentHospitalSnapshot(comment: QnaComment): HospitalSnapshot | undefined {
  return readHospitalSnapshot(comment.hospitalSnapshot)
    ?? readHospitalSnapshot(comment.hospital_snapshot)
    ?? readHospitalSnapshot(comment.payload)
    ?? readHospitalSnapshot(comment)
}

function getLocalCommentHospitalSnapshot(commentId: string): HospitalSnapshot | undefined {
  try {
    return readHospitalSnapshot(window.localStorage.getItem(`qna-comment-hospital:${commentId}`))
  } catch {
    return undefined
  }
}

function setLocalCommentHospitalSnapshot(commentId: string, hospital: HospitalSnapshot) {
  try {
    window.localStorage.setItem(`qna-comment-hospital:${commentId}`, JSON.stringify(hospital))
  } catch {
    // Storage may be unavailable in private browsing; the in-memory state still renders the card.
  }
}

function isMissingHospitalSnapshotColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  const message = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return error.code === '42703' || error.code === 'PGRST204' || (message.includes('hospital_snapshot') && (message.includes('column') || message.includes('schema cache')))
}

function HospitalPicker({ hospitals, onSelect, onClose }: { hospitals: HospitalSnapshot[]; onSelect: (hospital: HospitalSnapshot) => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(10)
  const [fallbackHospitals, setFallbackHospitals] = useState<HospitalSnapshot[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (hospitals.length > 0) return
    let active = true
    void loadCollectedHospitals('', 'all')
      .then((items) => { if (active) setFallbackHospitals(items.map(toHospitalSnapshot)) })
      .catch(() => { if (active) setLoadError('병원 목록을 불러오지 못했어요.') })
    return () => { active = false }
  }, [hospitals])
  const availableHospitals = hospitals.length > 0 ? hospitals : fallbackHospitals
  const normalizedSearch = search.trim().toLowerCase()
  const filteredHospitals = availableHospitals.filter((hospital) => !normalizedSearch || `${hospital.name} ${hospital.address}`.toLowerCase().includes(normalizedSearch))
  const visibleHospitals = filteredHospitals.slice(0, visibleCount)
  const hasMore = visibleCount < filteredHospitals.length

  return <div className="hospital-picker-overlay"><section className="hospital-picker" role="dialog" aria-modal="true" aria-label="병원 선택"><div className="qna-hospital-picker-heading"><strong>병원 선택</strong><button className="qna-hospital-picker-close" type="button" aria-label="닫기" onClick={onClose}><GuideAction symbol="×" /></button></div><label className="qna-hospital-search"><span aria-hidden="true"><GuideAction symbol="⌕" /></span><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(10) }} placeholder="병원 이름이나 주소 검색" aria-label="병원 검색" /></label>{loadError ? <p role="alert">{loadError}</p> : filteredHospitals.length > 0 ? <><div className="qna-hospital-picker-list">{visibleHospitals.map((hospital) => <button className="qna-hospital-picker-item" type="button" key={hospital.id ?? `${hospital.name}-${hospital.lat}-${hospital.lng}`} onClick={() => onSelect(hospital)}><strong>{hospital.name}</strong><span>{hospital.address}</span></button>)}</div>{hasMore && <button className="qna-hospital-picker-more" type="button" onClick={() => setVisibleCount((count) => count + 10)}>더보기</button>}</> : <p>검색 결과가 없습니다.</p>}</section></div>
}
import './qna-flow.css'
import type { PetRecord, PetRecordType } from '../../features/diary/diaryTypes'
import { animalCategoryLabels, loadCollectedHospitals, toHospitalSnapshot } from '../hospital-map/mapDependencies'
import { findHospitalCondition, type HospitalConditionId } from '../../features/hospital-map/hospitalConditionCatalog'
function StepText({ label, value, onChange, placeholder, required = false, maxLength, error }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; maxLength?: number; error?: string }) { return <div className="qna-field-wrap"><TextField className="step-field" label={label} value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />{maxLength && <small className="qna-character-count">{value.length}/{maxLength}자</small>}{error && <small className="qna-field-error" role="alert">{error}</small>}</div> }

export function QnaScreen({ userId, profile, posts, openPostId, onOpenHandled, onChange, onDeletePost, onEditPost, onCreate, onOpenHospital, onFindConditionHospitals, onOpenDiary, hospitals = [] }: { userId: string; profile: AppProfile; posts: QnaPost[]; openPostId?: string | null; onOpenHandled?: () => void; onChange: (posts: QnaPost[]) => void; onDeletePost: (postId: string) => void; onEditPost: (post: QnaPost) => void; onCreate: (petId?: string | null) => void; onOpenHospital: (hospital: HospitalSnapshot) => void; onFindConditionHospitals: (conditionId: HospitalConditionId) => void; onOpenDiary: (petId: string, readOnly: boolean) => void; hospitals?: HospitalSnapshot[] }) {
  const displayAuthor = profile.nickname.trim() || profile.username.trim() || '사용자'
  const qnaUrl = new URLSearchParams(window.location.search)
  const [sort, setSort] = useState<QnaSort>(() => parseQnaSort(qnaUrl.get('sort')))
  const [statusFilter, setStatusFilter] = useState<QnaListStatus>(() => parseQnaStatusFilter(qnaUrl.get('status')))
  const [categoryFilter, setCategoryFilter] = useState<QnaCategory[]>(() => parseQnaCategoryFilters(qnaUrl.get('category')))
  const [visibleCount, setVisibleCount] = useState(6)
  const [searchInput, setSearchInput] = useState(qnaUrl.get('q') ?? '')
  const [query, setQuery] = useState(qnaUrl.get('q') ?? '')
  const [searchOpen, setSearchOpen] = useState(false)
  const [animalFilter, setAnimalFilter] = useState('all')
  const [attachmentOnly, setAttachmentOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [attachedHospital, setAttachedHospital] = useState<HospitalSnapshot | null>(null)
  const attachedHospitalRef = useRef<HospitalSnapshot | null>(null)
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, QnaComment[]>>({})
  const [commentHospitalOverrides, setCommentHospitalOverrides] = useState<Record<string, HospitalSnapshot>>({})
  const [postLikeOverrides, setPostLikeOverrides] = useState<Record<string, { liked: boolean; likes: number }>>({})
  const [commentLikeOverrides, setCommentLikeOverrides] = useState<Record<string, { liked: boolean; likes: number }>>({})
  const [likeError, setLikeError] = useState('')
  const [commentError, setCommentError] = useState('')
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState(() => sessionStorage.getItem('qna_created_message') ?? '')
  const [detailMenuOpen, setDetailMenuOpen] = useState(false)
  const [reportSheetOpen, setReportSheetOpen] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set())
  const [commentSort, setCommentSort] = useState<'latest' | 'likes'>('latest')
  const previousSelectedIdRef = useRef<string | null>(null)
  const selectedBase = posts.find((post) => post.id === selectedId)
  const selected = selectedBase ? { ...selectedBase, ...postLikeOverrides[selectedBase.id] } : undefined
  const withCommentLikes = (items: QnaComment[]) => items.map((item) => {
    const hospitalSnapshot = readCommentHospitalSnapshot(item)
      ?? commentHospitalOverrides[item.id]
      ?? getLocalCommentHospitalSnapshot(item.id)
    return {
      ...item,
      ...(hospitalSnapshot ? { hospitalSnapshot } : {}),
      ...(commentLikeOverrides[item.id] ?? {}),
    }
  })
  const selectedComments = selected ? withCommentLikes(commentsByPost[selected.id] ?? selected.comments) : []
  useEffect(() => {
    let active = true
    void supabase.from('qna_user_blocks').select('blocked_user_id').eq('blocker_id', userId).then(({ data }) => {
      if (active && data) setBlockedUserIds(new Set(data.map((row) => row.blocked_user_id)))
    })
    return () => { active = false }
  }, [userId])
  useEffect(() => {
    if (!toastMessage) return
    sessionStorage.removeItem('qna_created_message')
    const timer = window.setTimeout(() => setToastMessage(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toastMessage])
  useEffect(() => {
    if (!lightboxImage) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxImage(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightboxImage])
  useEffect(() => {
    let active = true
    const loadComments = async () => {
      let result = await supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload, hospital_snapshot')
      if (isMissingHospitalSnapshotColumn(result.error)) {
        result = await supabase.from('post_comments').select('id, post_id, user_id, body, created_at, payload')
      }
      return result
    }
    loadComments().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Q&A 댓글 조회 실패:', error)
        setCommentError('댓글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
        return
      }
      const grouped: Record<string, QnaComment[]> = {}
      for (const row of data ?? []) {
        const payload = (row.payload ?? {}) as { author?: string; authorAvatarUrl?: string; isAccepted?: boolean; is_accepted?: boolean; likes?: number; likedBy?: string[]; liked_by?: string[]; hospitalSnapshot?: HospitalSnapshot; parentCommentId?: string }
        const mine = row.user_id === userId
        const hospitalSnapshot = readHospitalSnapshot((row as typeof row & { hospital_snapshot?: unknown }).hospital_snapshot) ?? readHospitalSnapshot(row.payload)
        const author = payload.author && payload.author !== '작성자' ? payload.author : mine ? displayAuthor : '사용자'
        const likedBy = Array.isArray(payload.likedBy) ? payload.likedBy : Array.isArray(payload.liked_by) ? payload.liked_by : []
        const item: QnaComment = { id: row.id, ownerUserId: row.user_id, parentCommentId: payload.parentCommentId, author, authorAvatarUrl: payload.authorAvatarUrl, body: row.body, createdAt: row.created_at, mine, isAccepted: payload.isAccepted === true || payload.is_accepted === true, liked: likedBy.includes(userId), likes: Number(payload.likes ?? 0), hospitalSnapshot, hospital_snapshot: hospitalSnapshot ?? null, payload: { hospitalSnapshot: hospitalSnapshot ?? null, hospital_snapshot: hospitalSnapshot ?? null, parentCommentId: payload.parentCommentId } }
        item.hospitalSnapshot = hospitalSnapshot
        grouped[row.post_id] = [...(grouped[row.post_id] ?? []), item]
      }
      setCommentsByPost((current) => {
        const merged: Record<string, QnaComment[]> = { ...current }
        Object.entries(grouped).forEach(([postId, remoteComments]) => {
          const localComments = current[postId] ?? []
          const matchedLocalIds = new Set<string>()
          const hydratedComments = remoteComments.map((remoteComment) => {
            const localComment = localComments.find((commentItem) => commentItem.id === remoteComment.id)
            if (localComment) matchedLocalIds.add(localComment.id)
            const hospitalSnapshot = readCommentHospitalSnapshot(remoteComment)
              ?? (localComment ? readCommentHospitalSnapshot(localComment) : undefined)
              ?? getLocalCommentHospitalSnapshot(remoteComment.id)
            return hospitalSnapshot
              ? { ...remoteComment, hospitalSnapshot, hospital_snapshot: hospitalSnapshot, payload: { hospitalSnapshot, hospital_snapshot: hospitalSnapshot } }
              : remoteComment
          })
          const pendingLocalComments = localComments.filter((commentItem) => !matchedLocalIds.has(commentItem.id))
          merged[postId] = [...hydratedComments, ...pendingLocalComments]
        })
        return merged
      })
    })
    return () => { active = false }
  }, [displayAuthor, posts.length, userId])
  useEffect(() => {
    let active = true
    supabase.from('likes').select('target_type, target_id, user_id').in('target_type', ['community_post', 'question']).then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('Q&A like state load failed.', error)
        setLikeError('좋아요 정보를 불러오지 못했어요. Supabase 권한 설정을 확인해 주세요.')
        return
      }
      const postCounts: Record<string, number> = {}
      const commentCounts: Record<string, number> = {}
      const postMine: Record<string, boolean> = {}
      const commentMine: Record<string, boolean> = {}
      for (const row of data ?? []) {
        const targetId = String(row.target_id)
        const isPost = row.target_type === 'community_post'
        const counts = isPost ? postCounts : commentCounts
        const mine = isPost ? postMine : commentMine
        counts[targetId] = (counts[targetId] ?? 0) + 1
        if (row.user_id === userId) mine[targetId] = true
      }
      setPostLikeOverrides(Object.fromEntries(Object.keys(postCounts).map((id) => [id, { liked: postMine[id] === true, likes: postCounts[id] }])))
      setCommentLikeOverrides(Object.fromEntries(Object.keys(commentCounts).map((id) => [id, { liked: commentMine[id] === true, likes: commentCounts[id] }])))
    })
    return () => { active = false }
  }, [userId, posts.length])
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
    if (post.ownerUserId && blockedUserIds.has(post.ownerUserId)) return false
    const text = `${post.title} ${post.body} ${post.author} ${post.animalGroup ?? ''} ${post.animalSpecies ?? post.animal}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })
  const getCommentCount = (post: QnaPost) => Math.max(post.comments.length, commentsByPost[post.id]?.length ?? 0)
  const scopedPosts = searchedPosts.filter((post) => {
    const matchesCategory = categoryFilter.length === 0 || qnaPostCategories(post).some((category) => categoryFilter.includes(category))
    const listStatus = qnaListStatus(post, getCommentCount(post))
    const matchesStatus = statusFilter === 'unresolved'
      ? listStatus !== 'resolved'
      : statusFilter === 'all' || listStatus === statusFilter
    const matchesAnimal = animalFilter === 'all' || post.animalGroup === animalFilter
    const matchesAttachment = !attachmentOnly || Boolean(post.image || post.images?.length || post.attachedDiarySnapshot || post.attachedRecordSnapshot)
    return matchesCategory && matchesStatus && matchesAnimal && matchesAttachment
  })
  const feedPosts = sortQnaPosts(scopedPosts, sort, getCommentCount)
  const visiblePosts = feedPosts.slice(0, visibleCount)

  if (searchOpen) return <QnaSearchScreen value={searchInput} category={categoryFilter} sort={sort} status={statusFilter} animal={animalFilter} attachmentOnly={attachmentOnly} onClose={() => setSearchOpen(false)} onSearch={(next) => { setSearchInput(next.value); setQuery(next.value); setCategoryFilter(next.category); setSort(next.sort); setStatusFilter(next.status); setAnimalFilter(next.animal); setAttachmentOnly(next.attachmentOnly); setVisibleCount(6); setSearchOpen(false) }} />

  const updatePost = (post: QnaPost) => onChange(posts.map((item) => item.id === post.id ? post : item))
  const toggleLike = async (post: QnaPost) => {
    const current = postLikeOverrides[post.id] ?? { liked: post.liked, likes: post.likes }
    const nextLiked = !current.liked
    const nextLikes = Math.max(0, current.likes + (nextLiked ? 1 : -1))
    setPostLikeOverrides((items) => ({ ...items, [post.id]: { liked: nextLiked, likes: nextLikes } }))
    setLikeError('')
    try {
      await saveLike('community_post', post.id, userId, nextLiked)
    } catch (error) {
      console.error('Q&A like save failed.', error)
      setPostLikeOverrides((items) => ({ ...items, [post.id]: current }))
      setLikeError('좋아요를 저장하지 못했어요. Supabase의 likes 권한 설정을 확인해 주세요.')
    }
  }
  const toggleStatus = (post: QnaPost) => updatePost({ ...post, status: qnaStatus(post) === 'resolved' ? 'unresolved' : 'resolved' })
  const copySelectedLink = async () => {
    if (!selected) return
    const url = new URL(window.location.href)
    url.searchParams.set('post', selected.id)
    try {
      await navigator.clipboard.writeText(url.toString())
      setToastMessage('링크를 복사했어요.')
    } catch {
      setToastMessage('링크를 복사하지 못했어요.')
    }
    setDetailMenuOpen(false)
  }
  const reportSelected = async (reason: string) => {
    if (!selected) return
    const { error } = await supabase.rpc('submit_qna_report', { p_target_type: 'post', p_target_id: selected.id, p_reason: reason })
    setReportSheetOpen(false)
    setToastMessage(error ? '신고를 접수하지 못했어요.' : '신고를 접수했어요.')
  }
  const blockSelectedAuthor = async () => {
    if (!selected?.ownerUserId) return
    const { error } = await supabase.rpc('block_qna_user', { p_target_type: 'post', p_target_id: selected.id })
    if (!error) {
      setBlockedUserIds((current) => new Set([...current, selected.ownerUserId!]))
      setSelectedId(null)
    }
    setDetailMenuOpen(false)
    setToastMessage(error ? '사용자를 차단하지 못했어요.' : '사용자를 차단했어요.')
  }
  const selectAnswer = (post: QnaPost, commentId: string) => {
    const comment = (commentsByPost[post.id] ?? post.comments).find((item) => item.id === commentId)
    if (post.mine !== true || comment?.mine === true) return
    const nextAcceptedId = post.selectedAnswerCommentId === commentId ? undefined : commentId
    updatePost(nextAcceptedId ? { ...post, status: 'resolved', selectedAnswerCommentId: nextAcceptedId } : { ...post, status: 'unresolved', selectedAnswerCommentId: undefined })
    setCommentsByPost((items) => ({ ...items, [post.id]: (items[post.id] ?? post.comments).map((item) => ({ ...item, isAccepted: item.id === nextAcceptedId })) }))
  }
  const toggleCommentLike = async (comment: QnaComment) => {
    const current = commentLikeOverrides[comment.id] ?? { liked: comment.liked === true, likes: comment.likes ?? 0 }
    const nextLiked = !current.liked
    const nextLikes = Math.max(0, current.likes + (nextLiked ? 1 : -1))
    setCommentLikeOverrides((items) => ({ ...items, [comment.id]: { liked: nextLiked, likes: nextLikes } }))
    setLikeError('')
    try {
      await saveLike('question', comment.id, userId, nextLiked)
    } catch (error) {
      console.error('Q&A comment like save failed.', error)
      setCommentLikeOverrides((items) => ({ ...items, [comment.id]: current }))
      setLikeError('좋아요를 저장하지 못했어요. Supabase의 likes 권한 설정을 확인해 주세요.')
    }
  }
  const addComment = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !comment.trim()) return
    setCommentError('')
    try {
      await ensureSupabaseSession()
    } catch (error) {
      console.error('Q&A 댓글 인증 확인 실패:', error)
      setCommentError(error instanceof Error ? error.message : '로그인이 만료됐어요. 다시 로그인해 주세요.')
      return
    }
    const attachedHospitalSnapshot = attachedHospitalRef.current ?? attachedHospital
      ? { ...(attachedHospitalRef.current ?? attachedHospital)! }
      : undefined
    const newComment: QnaComment = { id: crypto.randomUUID(), author: displayAuthor, authorAvatarUrl: profile.avatarUrl, body: comment.trim(), createdAt: new Date().toISOString(), mine: true, isAccepted: false, hospitalSnapshot: attachedHospitalSnapshot }
    const hospitalPayload = newComment.hospitalSnapshot ?? null
    if (attachedHospitalSnapshot) {
      setLocalCommentHospitalSnapshot(newComment.id, attachedHospitalSnapshot)
      setCommentHospitalOverrides((items) => ({ ...items, [newComment.id]: attachedHospitalSnapshot }))
    }
    setCommentsByPost((items) => {
      const current = items[selected.id] ?? selected.comments
      return { ...items, [selected.id]: [...current.filter((item) => item.id !== newComment.id), newComment] }
    })

    let insertResult = await supabase
      .from('post_comments')
      .insert({ id: newComment.id, post_id: selected.id, user_id: userId, body: newComment.body, hospital_snapshot: hospitalPayload, payload: { author: newComment.author, authorAvatarUrl: newComment.authorAvatarUrl, isAccepted: false, is_accepted: false, hospitalSnapshot: hospitalPayload, hospital_snapshot: hospitalPayload } })
      .select('payload, hospital_snapshot')
      .single()

    // 컬럼 누락일 때만 하위 호환 재시도한다. 권한/네트워크 오류를 삼키면 첨부가 조용히 사라진다.
    if (isMissingHospitalSnapshotColumn(insertResult.error)) {
      insertResult = await supabase
        .from('post_comments')
        .insert({ id: newComment.id, post_id: selected.id, user_id: userId, body: newComment.body, payload: { author: newComment.author, authorAvatarUrl: newComment.authorAvatarUrl, isAccepted: false, is_accepted: false, hospitalSnapshot: hospitalPayload, hospital_snapshot: hospitalPayload } })
        .select('payload')
        .single()
    }

    const { data, error } = insertResult

    if (error) {
      console.error('Q&A 댓글 저장 실패:', error)
      setCommentError('댓글을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }

    const savedHospitalSnapshot = readHospitalSnapshot((data as (typeof data & { hospital_snapshot?: unknown }) | null)?.hospital_snapshot) ?? readHospitalSnapshot(data?.payload) ?? attachedHospitalSnapshot
    if (savedHospitalSnapshot) {
      setCommentHospitalOverrides((items) => ({ ...items, [newComment.id]: savedHospitalSnapshot }))
    }
    const savedComment = { ...newComment, hospitalSnapshot: savedHospitalSnapshot, hospital_snapshot: savedHospitalSnapshot ?? null, payload: { hospitalSnapshot: savedHospitalSnapshot ?? null, hospital_snapshot: savedHospitalSnapshot ?? null } }
    setCommentsByPost((items) => ({
      ...items,
      [selected.id]: (items[selected.id] ?? selected.comments).map((item) => item.id === newComment.id ? savedComment : item),
    }))
    setComment('')
    attachedHospitalRef.current = null
    setAttachedHospital(null)
  }

  if (selected) {
    const selectedImages = selected.images?.length ? selected.images : selected.image ? [selected.image] : []
    const relatedHospitalCondition = findHospitalCondition([selected.title, selected.body, selected.attachedRecordSnapshot?.summary].filter(Boolean).join(' '))
    const sortedComments = [...selectedComments].sort((a, b) => {
      const accepted = (a.id === selected.selectedAnswerCommentId ? -1 : 0) - (b.id === selected.selectedAnswerCommentId ? -1 : 0)
      if (accepted !== 0) return accepted
      return commentSort === 'likes' ? (b.likes ?? 0) - (a.likes ?? 0) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    const trustPosts = posts.map((post) => ({ ...post, comments: withCommentLikes(commentsByPost[post.id] ?? post.comments) }))
    return (
      <section className="qna-detail">
        {toastMessage && <div className="qna-toast" role="status">{toastMessage}</div>}
        <header className="qna-detail-header">
          <button className="qna-back" type="button" aria-label="뒤로가기" onClick={() => setSelectedId(null)}><GuideAction symbol="←" /></button>
          <strong>Q&A</strong>
          <button className="qna-detail-more" type="button" aria-label="게시글 더보기" onClick={() => setDetailMenuOpen(true)}><QnaIcon name="more" /></button>
        </header>
        {(likeError || commentError) && <button className="data-error" type="button" onClick={() => { setLikeError(''); setCommentError('') }}>{likeError || commentError}</button>}
        <article className="qna-detail-post">
          <div className="qna-detail-badges">{qnaPostCategories(selected).slice(0, 2).map((category) => <span className="qna-category" data-category={category} key={category}>{category}</span>)}{selected.mine === true ? <button className={`qna-detail-resolve-button ${qnaStatus(selected) === 'resolved' ? 'resolved' : ''}`} type="button" onClick={() => toggleStatus(selected)}>{qnaStatus(selected) === 'resolved' ? '해결 완료' : '해결하기'}</button> : <span className={`qna-status ${qnaStatus(selected)}`}>{qnaStatusLabel(qnaStatus(selected))}</span>}</div>
          <h2>{maskKoreanProfanity(selected.title)}</h2>
          <div className="qna-author"><UserAvatar url={selected.mine === true ? profile.avatarUrl : selected.authorAvatarUrl} name={qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)} /><div><strong>{qnaDisplayAuthor(selected.author, selected.mine === true, displayAuthor)}</strong><span>{formatQnaAnimal(selected)} · {formatQnaDate(selected.createdAt)}</span></div></div>
          {selectedImages.length > 0 && <div className="qna-detail-image-grid">{selectedImages.map((image) => <button className="qna-detail-image-button" type="button" key={image} onClick={() => setLightboxImage(image)}><img src={image} alt="첨부 이미지" /></button>)}</div>}
          <p>{maskKoreanProfanity(selected.body)}</p>
          {selected.attachedDiarySnapshot && selected.attachedDiarySnapshot.records.length > 1 && <DiaryVisualizationAttachment snapshot={selected.attachedDiarySnapshot} />}
          {!selected.attachedDiarySnapshot && selected.attachedRecordSnapshot && <RecordAttachCard record={selected.attachedRecordSnapshot} mode="posted" onOpen={() => onOpenDiary(selected.attachedRecordSnapshot!.petId, selected.mine !== true)} />}
          {relatedHospitalCondition && <aside className="qna-condition-hospital"><span><strong>{relatedHospitalCondition.label} 관련 병원</strong><small>관련 진료 리뷰와 공개 근거가 있는 병원 TOP 5를 확인해보세요.</small></span><button type="button" onClick={() => onFindConditionHospitals(relatedHospitalCondition.id)}>병원 TOP 5 보기</button></aside>}
          <div className="qna-detail-actions"><button className={selected.liked ? 'active' : ''} type="button" onClick={() => toggleLike(selected)}><HeartIcon filled={selected.liked} /> 좋아요 {selected.likes}</button></div>
        </article>
        <section className="qna-comments">
          <header className="qna-comments-heading"><h3>답변 {selectedComments.length}</h3><div><button className={commentSort === 'latest' ? 'active' : ''} type="button" onClick={() => setCommentSort('latest')}>최신순</button><span>|</span><button className={commentSort === 'likes' ? 'active' : ''} type="button" onClick={() => setCommentSort('likes')}>좋아요순</button></div></header>
          {sortedComments.filter((item) => !item.ownerUserId || !blockedUserIds.has(item.ownerUserId)).map((item) => (
            <article className={selected.selectedAnswerCommentId === item.id ? 'accepted' : ''} key={item.id}>
              <div className="qna-comment-head"><span className="qna-comment-author"><UserAvatar url={item.mine ? profile.avatarUrl : item.authorAvatarUrl} name={item.author} /><span><strong>{item.author} <QnaTrustBadge score={getTrustScoreForAuthor(trustPosts, item.author)} /></strong><time>{formatQnaDate(item.createdAt)}</time></span></span>{item.mine && <div className="qna-comment-menu"><button type="button" aria-label="댓글 관리 메뉴" aria-expanded={commentMenuId === item.id} onClick={() => setCommentMenuId(commentMenuId === item.id ? null : item.id)}><GuideAction symbol="⋮" /></button>{commentMenuId === item.id && <div><button type="button" onClick={async () => { await supabase.from('post_comments').delete().eq('id', item.id).eq('user_id', userId); setCommentsByPost((items) => ({ ...items, [selected.id]: (items[selected.id] ?? []).filter((commentItem) => commentItem.id !== item.id) })); setCommentMenuId(null) }}>댓글 삭제</button></div>}</div>}</div>
              {selected.selectedAnswerCommentId === item.id && <span className="accepted-answer-chip">채택 답변</span>}
              {item.body && <p>{maskKoreanProfanity(item.body)}</p>}
              {readCommentHospitalSnapshot(item) && <HospitalAttachCard hospital={readCommentHospitalSnapshot(item)!} mode="posted" onOpen={() => onOpenHospital(readCommentHospitalSnapshot(item)!)} />}
              <button className={`qna-comment-like ${item.liked ? 'active' : ''}`} type="button" aria-label={item.liked ? '댓글 좋아요 취소' : '댓글 좋아요'} aria-pressed={item.liked} onClick={() => void toggleCommentLike(item)}><HeartIcon filled={item.liked} /><span className="qna-comment-like-count">좋아요 {item.likes ?? 0}</span></button>
              {selected.mine === true && item.mine !== true && <button className="qna-accept-button" type="button" onClick={() => selectAnswer(selected, item.id)}>{selected.selectedAnswerCommentId === item.id ? '해결 취소' : '해결하기'}</button>}
            </article>
          ))}
          <form onSubmit={addComment}>
            {attachedHospital && <HospitalAttachCard hospital={attachedHospital} mode="draft" onRemove={() => { attachedHospitalRef.current = null; setAttachedHospital(null) }} />}
            <div className="qna-comment-tools">
              <button type="button" onClick={() => setHospitalPickerOpen((open) => !open)}>병원 첨부</button>
            </div>
            <div className="qna-comment-input-row">
              <input value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} placeholder="답변을 입력하세요" aria-label="답변, 최대 1000자" />
              <button type="submit" disabled={!comment.trim()}>등록</button>
            </div>
          </form>
        </section>
        {hospitalPickerOpen && <HospitalPicker hospitals={hospitals} onSelect={(hospital) => { attachedHospitalRef.current = hospital; setAttachedHospital(hospital); setHospitalPickerOpen(false) }} onClose={() => setHospitalPickerOpen(false)} />}
        {detailMenuOpen && <div className="qna-action-overlay" onClick={() => setDetailMenuOpen(false)}><section className="qna-action-sheet" role="dialog" aria-modal="true" aria-label="게시글 메뉴" onClick={(event) => event.stopPropagation()}><span className="hospital-picker-handle" aria-hidden="true" /><button type="button" onClick={() => void copySelectedLink()}>링크 복사</button>{selected.mine ? <><button type="button" onClick={() => { setDetailMenuOpen(false); onEditPost(selected) }}>게시글 수정</button><button type="button" onClick={() => { setDetailMenuOpen(false); toggleStatus(selected) }}>{qnaStatus(selected) === 'resolved' ? '해결 취소' : '해결로 표시'}</button><button className="danger" type="button" onClick={() => { if (window.confirm('이 질문을 삭제할까요?')) { onDeletePost(selected.id); setSelectedId(null) } }}>게시글 삭제</button></> : <><button className="danger" type="button" onClick={() => { setDetailMenuOpen(false); setReportSheetOpen(true) }}>게시글 신고</button><button className="danger" type="button" onClick={() => void blockSelectedAuthor()}>이 사용자 차단</button></>}</section></div>}
        {reportSheetOpen && <QnaReportSheet onClose={() => setReportSheetOpen(false)} onSubmit={(reason) => void reportSelected(reason)} />}
        {lightboxImage && <div className="qna-lightbox" role="dialog" aria-modal="true" aria-label="이미지 확대 보기" onClick={() => setLightboxImage(null)} onKeyDown={(event) => { if (event.key === 'Escape') setLightboxImage(null) }} tabIndex={-1}><button type="button" className="qna-lightbox-close" aria-label="이미지 닫기" onClick={() => setLightboxImage(null)}><GuideAction symbol="×" /></button><strong className="qna-lightbox-count">{selectedImages.indexOf(lightboxImage) + 1} / {selectedImages.length}</strong><img src={lightboxImage} alt="확대된 첨부 이미지" onClick={(event) => event.stopPropagation()} /><div className="qna-lightbox-thumbnails" onClick={(event) => event.stopPropagation()}>{selectedImages.map((image, index) => <button className={image === lightboxImage ? 'active' : ''} type="button" key={image} aria-label={`${index + 1}번째 이미지 보기`} onClick={() => setLightboxImage(image)}><img src={image} alt="" /></button>)}</div></div>}
      </section>
    )
  }

  return (
    <section className="qna-feed-page">
      {(likeError || commentError) && <button className="data-error" type="button" onClick={() => { setLikeError(''); setCommentError('') }}>{likeError || commentError}</button>}
      <header className="qna-feed-head"><h2>Q&A</h2><button type="button" aria-label="질문 검색" onClick={() => setSearchOpen(true)}><QnaIcon name="search" /></button></header>
      <form className="qna-feed-search" role="search" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()); setVisibleCount(6) }}><QnaIcon name="search" /><input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setQuery(event.target.value); setVisibleCount(6) }} placeholder="질문을 검색하세요" aria-label="질문 검색" /></form>
      <div className="qna-home-filters" aria-label="질문 주제">
        <button className={categoryFilter.length === 0 ? 'active' : ''} type="button" aria-pressed={categoryFilter.length === 0} onClick={() => { setCategoryFilter([]); setStatusFilter('all'); setVisibleCount(6) }}>전체</button>
        {(['질병', '사육', '먹이', '환경'] as const).map((category) => <button className={categoryFilter.includes(category) ? 'active' : ''} type="button" key={category} aria-pressed={categoryFilter.includes(category)} onClick={() => { setCategoryFilter([category]); setVisibleCount(6) }}>{category}</button>)}
      </div>
      {feedPosts.length === 0 ? <div className="qna-empty-state">
        <div className="qna-empty-icon" aria-hidden="true"><QnaIcon name="search" /></div>
        <strong>{query ? '검색 결과가 없어요.' : statusFilter !== 'all' || categoryFilter.length > 0 ? '선택한 조건에 맞는 질문이 없어요.' : '아직 등록된 질문이 없어요.'}</strong>
        <p>다른 키워드로 검색하거나 필터를 변경해보세요.</p>
      </div> : (
        <section className="qna-feed-section">
          <div className="qna-feed-list">
            {visiblePosts.map((post) => <QnaHelpCard post={{ ...post, ...postLikeOverrides[post.id] }} commentCount={getCommentCount(post)} key={post.id} onOpen={() => { sessionStorage.setItem(`qna_scroll_${userId}`, String(window.scrollY)); setSelectedId(post.id) }} />)}
          </div>
          {visiblePosts.length < feedPosts.length && <button className="qna-load-more" type="button" onClick={() => setVisibleCount((count) => count + 6)}>더보기</button>}
        </section>
      )}
      <button className="qna-mobile-fab" type="button" aria-label="글쓰기" onClick={() => onCreate()}><QnaIcon name="write" /></button>
    </section>
  )
}

function QnaHelpCard({ post, commentCount, onOpen }: { post: QnaPost; commentCount: number; onOpen: () => void }) {
  return <button className="qna-help-card" type="button" onClick={onOpen}>
    <span className="qna-card-copy"><strong>{maskKoreanProfanity(post.title.trim() || '제목 없는 질문')}</strong><small>{formatQnaAnimal(post)} · {formatQnaDate(post.createdAt)}</small><QnaPostMeta createdAt="" viewCount={post.viewCount ?? 0} commentCount={commentCount} likes={post.likes} className="qna-card-meta-line" /></span><span className="qna-card-chevron" aria-hidden="true">›</span>
  </button>
}
type QnaSearchValues = { value: string; category: QnaCategory[]; sort: QnaSort; status: QnaListStatus; animal: string; attachmentOnly: boolean }

function QnaReportSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const reasons = ['스팸/광고', '욕설/괴롭힘', '개인정보 노출', '위험하거나 부적절한 사육 정보', '기타']
  return <div className="qna-action-overlay" onClick={onClose}><section className="qna-action-sheet qna-report-sheet" role="dialog" aria-modal="true" aria-labelledby="qna-report-title" onClick={(event) => event.stopPropagation()}><span className="hospital-picker-handle" aria-hidden="true" /><h2 id="qna-report-title">신고 사유를 선택해주세요</h2>{reasons.map((item) => <button className={reason === item ? 'active' : ''} type="button" key={item} onClick={() => setReason(item)}>{item}</button>)}<div><button type="button" onClick={onClose}>취소</button><button className="danger" type="button" disabled={!reason} onClick={() => onSubmit(reason)}>신고하기</button></div></section></div>
}

function QnaSearchScreen({ value, category, sort, status, animal, attachmentOnly, onClose, onSearch }: QnaSearchValues & { onClose: () => void; onSearch: (values: QnaSearchValues) => void }) {
  const [draftValue, setDraftValue] = useState(value)
  const [draftCategory, setDraftCategory] = useState(category)
  const [draftSort, setDraftSort] = useState(sort)
  const [draftStatus, setDraftStatus] = useState(status)
  const [draftAnimal, setDraftAnimal] = useState(animal)
  const [draftAttachmentOnly, setDraftAttachmentOnly] = useState(attachmentOnly)
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('qna_recent_searches_v1') ?? '[]') as string[] } catch { return [] }
  })
  const submit = () => {
    const keyword = draftValue.trim()
    if (keyword) {
      const nextRecent = [keyword, ...recent.filter((item) => item !== keyword)].slice(0, 5)
      localStorage.setItem('qna_recent_searches_v1', JSON.stringify(nextRecent))
      setRecent(nextRecent)
    }
    onSearch({ value: keyword, category: draftCategory, sort: draftSort, status: draftStatus, animal: draftAnimal, attachmentOnly: draftAttachmentOnly })
  }
  const removeRecent = (item: string) => {
    const next = recent.filter((valueItem) => valueItem !== item)
    setRecent(next)
    localStorage.setItem('qna_recent_searches_v1', JSON.stringify(next))
  }
  return <section className="qna-search-screen">
    <header><button type="button" aria-label="검색 닫기" onClick={onClose}><GuideAction symbol="←" /></button><label><QnaIcon name="search" /><input autoFocus value={draftValue} onChange={(event) => setDraftValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} placeholder="질문이나 동물 종으로 검색" />{draftValue && <button type="button" aria-label="검색어 지우기" onClick={() => setDraftValue('')}><GuideAction symbol="×" /></button>}</label></header>
    {recent.length > 0 && <section className="qna-search-section"><h2>최근 검색어</h2>{recent.map((item) => <div className="qna-recent-row" key={item}><button type="button" onClick={() => setDraftValue(item)}><QnaIcon name="clock" />{item}</button><button type="button" aria-label={`${item} 삭제`} onClick={() => removeRecent(item)}><GuideAction symbol="×" /></button></div>)}</section>}
    <section className="qna-search-section"><h2>주제</h2><div className="qna-search-chips"><button className={draftCategory.length === 0 ? 'active' : ''} type="button" onClick={() => setDraftCategory([])}>전체</button>{qnaCategoryCards.map((item) => <button className={draftCategory.includes(item) ? 'active' : ''} type="button" key={item} onClick={() => setDraftCategory([item])}>{item}</button>)}</div></section>
    <section className="qna-search-section"><h2>동물 종류</h2><div className="qna-search-chips">{[['all', '전체'], ['reptile', '파충류'], ['amphibian', '양서류'], ['bird', '조류'], ['rodent', '설치류'], ['other', '기타']].map(([key, label]) => <button className={draftAnimal === key ? 'active' : ''} type="button" key={key} onClick={() => setDraftAnimal(key)}>{label}</button>)}</div></section>
    <section className="qna-search-section"><h2>정렬</h2><div className="qna-search-chips">{([['latest', '최신순'], ['popular', '인기순'], ['views', '조회순']] as const).map(([key, label]) => <button className={draftSort === key ? 'active' : ''} type="button" key={key} onClick={() => setDraftSort(key)}>{label}</button>)}</div></section>
    <section className="qna-search-options"><label><span>해결된 글만 보기</span><input type="checkbox" checked={draftStatus === 'resolved'} onChange={(event) => setDraftStatus(event.target.checked ? 'resolved' : 'all')} /></label><label><span>사진/기록 있는 글만 보기</span><input type="checkbox" checked={draftAttachmentOnly} onChange={(event) => setDraftAttachmentOnly(event.target.checked)} /></label></section>
    <button className="qna-search-submit" type="button" onClick={submit}>검색하기</button>
  </section>
}


function UserAvatar({ url, name }: { url?: string; name: string }) {
  if (url) return <img className="user-avatar" src={url} alt={`${name} 프로필`} />
  return <Mascot className="size-10! shrink-0 [&>svg]:size-full!" />
}

export function QnaCreateFlow({ userId, pets, author, authorAvatarUrl, initialPetId, initialCategory, initialTitle, initialDraft, onClose, onSave }: { userId: string; pets: Pet[]; author: string; authorAvatarUrl: string; initialPetId?: string; initialCategory?: QnaCategory; initialTitle?: string; initialDraft?: DraftItem | null; onClose: () => void; onSave: (post: QnaPost) => void | Promise<void> }) {
  const initialPost = initialDraft?.draftType === 'question' ? initialDraft.payload as QnaPost : null
  const [petId, setPetId] = useState(initialPost?.petId || (initialPetId && pets.some((pet) => pet.id === initialPetId) ? initialPetId : 'none'))
  const [categories, setCategories] = useState<QnaCategory[]>(() => initialPost ? qnaPostCategories(initialPost) : initialCategory ? [initialCategory] : ['질병'])
  const [title, setTitle] = useState(initialPost?.title ?? initialTitle ?? '')
  const [body, setBody] = useState(initialPost?.body ?? '')
  const initialImages = initialPost?.images ?? (initialPost?.image ? [initialPost.image] : [])
  const [imageUploads, setImageUploads] = useState<QnaImageUploadItem[]>(() => initialImages.map((url, index) => ({ id: `existing-${index}-${url}`, previewUrl: url, storageUrl: url, status: 'uploaded', progress: 100 })))
  const [attachedRecord, setAttachedRecord] = useState<AttachedRecordSnapshot | null>(initialPost?.attachedRecordSnapshot ?? null)
  const [attachedDiary, setAttachedDiary] = useState<AttachedDiarySnapshot | null>(initialPost?.attachedDiarySnapshot ?? null)
  const [diaryLoading, setDiaryLoading] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [recordCountPetId, setRecordCountPetId] = useState<string | null>(null)
  const [recordAttachOpen, setRecordAttachOpen] = useState(false)
  const [recordCandidates, setRecordCandidates] = useState<PetRecord[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const [validationErrors, setValidationErrors] = useState<{ title?: string; body?: string }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const autoAttachedRef = useRef(false)
  const pet = pets.find((item) => item.id === petId)
  const hasNoAnimal = petId === 'none'
  const canSubmit = title.trim().length > 0 && body.trim().length > 0
  const selectedGroup = hasNoAnimal ? '동물 X' : pet ? animalCategoryLabels[pet.group] : ''
  const selectedSpecies = hasNoAnimal ? '' : pet?.species || ''
  const uploadedImageUrls = imageUploads.filter((item) => item.status === 'uploaded' && item.storageUrl).map((item) => item.storageUrl as string)
  const buildPost = (): QnaPost => ({
    id: initialPost?.id ?? crypto.randomUUID(),
    category: categories[0] ?? '질병',
    categories,
    status: initialPost?.status ?? 'unresolved',
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
    liked: initialPost?.liked ?? false,
    likes: initialPost?.likes ?? 0,
    comments: initialPost?.comments ?? [],
    selectedAnswerCommentId: initialPost?.selectedAnswerCommentId,
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
    if (hasNoAnimal || !petId || !pet) {
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
  }, [hasNoAnimal, loadPetRecords, pet, petId])

  const openRecordAttach = async () => {
    if (hasNoAnimal || !petId || !pet || diaryLoading) return
    setDiaryLoading(true)
    try {
      const petRecords = await loadPetRecords()
      if (!petRecords) return
      setRecordCount(petRecords.length)
      setRecordCountPetId(petId)
      setRecordCandidates(petRecords)
      setSelectedRecordIds(attachedDiary?.records.map((record) => record.id) ?? [])
      setRecordAttachOpen(true)
    } finally {
      setDiaryLoading(false)
    }
  }

  const saveRecordAttachment = (records: PetRecord[]) => {
    const attachment = makeDiaryAttachment(records)
    if (!attachment) return
    setAttachedDiary(attachment)
    setSelectedRecordIds(records.map((record) => record.id))
    setRecordAttachOpen(false)
  }

  useEffect(() => {
    if (!initialPetId || initialDraft || attachedDiary || attachedRecord || autoAttachedRef.current) return
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
  }, [attachedDiary, attachedRecord, hasNoAnimal, initialDraft, initialPetId, loadPetRecords, makeDiaryAttachment, pet, petId])

  const hasImageUploadInProgress = imageUploads.some((item) => item.status === 'uploading')
  const hasImageUploadError = imageUploads.some((item) => item.status === 'error')
  const finish = async () => {
    if (isSaving || hasImageUploadInProgress || hasImageUploadError) return
    const nextErrors = { ...(!title.trim() ? { title: '질문 제목을 입력해 주세요.' } : {}), ...(!body.trim() ? { body: '질문 내용을 입력해 주세요.' } : {}) }
    setValidationErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setIsSaving(true)
    setSaveError('')
    try { await onSave(buildPost()) } catch { setSaveError('질문을 저장하지 못했어요. 다시 시도해 주세요.') } finally { setIsSaving(false) }
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
      const sanitizedFile = await sanitizeImageFile(item.file)
      const extension = sanitizedFile.type === 'image/png' ? 'png' : 'jpg'
      const path = `${userId}/${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from(QNA_IMAGE_BUCKET).upload(path, sanitizedFile, { cacheControl: '3600', contentType: sanitizedFile.type, upsert: false })
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
    const files = Array.from(event.target.files ?? []).slice(0, 3)
    event.target.value = ''
    if (files.length === 0) return
    try {
      files.forEach(validateImageFile)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '사진을 확인해 주세요.')
      return
    }
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
    <StepShell title="질문 작성" onBack={onClose} hideProgress stepLabels={[]}>
      <div className="qna-compose-selects"><label><span>질문 주제</span><select value={categories[0] ?? '질병'} onChange={(event) => setCategories([event.target.value as QnaCategory])}>{qnaCategoryCards.map((category) => <option value={category} key={category}>{category}</option>)}</select></label><label><span>질문할 펫</span><select value={petId} onChange={(event) => changePet(event.target.value)}><option value="none">내 펫 선택</option>{pets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
      <div className="qna-compose-fields">
        <StepText label="제목" value={title} onChange={(value) => { setTitle(value); setValidationErrors((errors) => ({ ...errors, title: undefined })) }} placeholder="예) 탈피가 잘 안돼요" required maxLength={50} error={validationErrors.title} />
        <StepTextarea label="내용" value={body} onChange={(value) => { setBody(value); setValidationErrors((errors) => ({ ...errors, body: undefined })) }} placeholder="내용을 입력하세요." required maxLength={1000} error={validationErrors.body} />
        <label className="step-field attach-file-field"><span>사진 첨부 <small>(선택)</small></span><span className="attach-file-button">+ 사진 선택</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={attachImage} /><small>{imageUploads.length > 0 ? `사진 ${imageUploads.length}/3장이 선택되었습니다` : '최대 3장까지 첨부할 수 있어요.'}</small></label>
        {imageUploads.length > 0 && <div className="qna-compose-upload-list">{imageUploads.map((item) => <div className={`qna-compose-upload-item ${item.status}`} key={item.id}>
          <img src={item.previewUrl} alt="첨부 사진 미리보기" />
          <div className="qna-compose-upload-status"><span>{item.status === 'uploaded' ? '업로드 완료' : item.status === 'error' ? '업로드 실패' : `업로드 중 ${item.progress}%`}</span>{item.status === 'uploading' && <progress value={item.progress} max="100" />}{item.error && <small>{item.error}</small>}</div>
          {item.status === 'error' && <button type="button" onClick={() => { void uploadImage(item) }}>재시도</button>}
          <button type="button" aria-label="첨부 사진 삭제" onClick={() => removeImage(item.id)}>삭제</button>
        </div>)}</div>}
        {attachedRecord && <RecordAttachCard record={attachedRecord} mode="draft" onRemove={() => setAttachedRecord(null)} />}
        {!hasNoAnimal && petId && <div className="qna-compose-tools">
          <button type="button" disabled={diaryLoading || (!attachedDiary && (recordCountPetId !== petId || recordCount === null || recordCount <= 0))} onClick={openRecordAttach}>{attachedDiary ? '기록 확인·변경' : diaryLoading ? '기록 불러오는 중' : '기록 첨부'}</button>
        </div>}
        <div>
          {diaryLoading && <DiaryTimelineSkeleton />}
          {attachedDiary && !diaryLoading && <div className="qna-record-attached-state"><span>기록 첨부됨</span><button type="button" onClick={() => setAttachedDiary(null)}>첨부 해제</button></div>}
        </div>
        {recordAttachOpen && pet && <QnaRecordAttachSheet pet={pet} records={recordCandidates} selectedIds={selectedRecordIds} onToggle={(recordId) => setSelectedRecordIds((ids) => ids.includes(recordId) ? ids.filter((id) => id !== recordId) : [...ids, recordId])} onSelectDate={(_date, ids) => setSelectedRecordIds((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])])} onClose={() => setRecordAttachOpen(false)} onSave={saveRecordAttachment} />}
      </div>
      {saveError && <p className="qna-field-error" role="alert">{saveError}</p>}
      <div className="step-actions"><button className="step-primary" type="button" disabled={!canSubmit || isSaving || hasImageUploadInProgress || hasImageUploadError} onClick={() => void finish()}>{isSaving ? '저장 중' : '질문 등록'}</button></div>
    </StepShell>
  )
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
  const availableTypes = [...new Set(records.map(getQnaRecordAttachmentType))]
  const [selectedTypes, setSelectedTypes] = useState<QnaRecordAttachmentType[]>(availableTypes)
  const visibleRecords = records.filter((record) => selectedTypes.includes(getQnaRecordAttachmentType(record)))
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
          <button type="button" aria-label="닫기" onClick={onClose}><GuideAction symbol="×" /></button>
        </header>
        <div className="qna-record-type-filters" aria-label="첨부할 기록 종류">
          {availableTypes.map((type) => (
            <button
              className={selectedTypes.includes(type) ? 'active' : ''}
              type="button"
              key={type}
              aria-pressed={selectedTypes.includes(type)}
              onClick={() => setSelectedTypes((types) => types.includes(type) ? types.filter((item) => item !== type) : [...types, type])}
            >
              {qnaRecordAttachmentTypeLabels[type]}
            </button>
          ))}
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
                      <span><strong>{qnaRecordAttachmentTypeLabels[getQnaRecordAttachmentType(record)]}</strong><small>{summarizeRecord(record)}</small></span>
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

type QnaRecordAttachmentType = 'food' | 'poop' | 'shed' | 'weight' | 'environment' | 'cleaning' | 'mating' | 'egg' | 'hospital' | 'other'

const qnaRecordAttachmentTypeLabels: Record<QnaRecordAttachmentType, string> = {
  food: '먹이',
  poop: '배변',
  shed: '탈피',
  weight: '체중',
  environment: '온습도',
  cleaning: '청소',
  mating: '메이팅',
  egg: '산란',
  hospital: '진료',
  other: '기타',
}

function getQnaRecordAttachmentType(record: PetRecord): QnaRecordAttachmentType {
  if (record.environmentRecord) return 'environment'
  if (record.incidentRecord?.kind === 'mating') return 'mating'
  if (record.incidentRecord?.kind === 'egg') return 'egg'
  return record.type
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
  return <span className={`post-meta ${className}`.trim()}>
    {createdAt && <span><QnaTimeIcon /><span>{formatQnaDate(createdAt)}</span></span>}
    <span><QnaViewIcon /><span>조회 {viewCount}</span></span>
    <span><QnaCommentIcon /><span>답변 {commentCount}</span></span>
    {likes > 0 && <span className="qna-meta-like"><HeartIcon filled /><span>좋아요 {likes}</span></span>}
  </span>
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

function qnaPostCategories(post: Pick<QnaPost, 'category' | 'categories'>): QnaCategory[] {
  const categories = post.categories?.map(normalizeQnaCategory).filter((category, index, items) => items.indexOf(category) === index) ?? []
  return categories.length > 0 ? categories : [normalizeQnaCategory(post.category)]
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
  return value === 'waiting' || value === 'answered' || value === 'resolved' || value === 'unresolved' ? value : 'unresolved'
}

function parseQnaCategoryFilters(value: string | null): QnaCategory[] {
  if (!value || value === 'all') return []
  return value.split(',').filter((item): item is QnaCategory => qnaCategoryCards.includes(item as QnaCategory))
}

function parseQnaSort(value: string | null): QnaSort {
  return value === 'popular' || value === 'comments' || value === 'views' ? value : 'latest'
}

function qnaListStatus(post: QnaPost, commentCount = post.comments.length): QnaListStatus {
  if (qnaStatus(post) === 'resolved') return 'resolved'
  return commentCount > 0 ? 'answered' : 'waiting'
}

const qnaCategoryCards: QnaCategory[] = ['질병', '사육', '먹이', '환경', '행동', '번식']

function sortQnaPosts(posts: QnaPost[], sort: QnaSort, getCommentCount: (post: QnaPost) => number = (post) => post.comments.length) {
  return [...posts].sort((a, b) => {
    if (sort === 'views') return (b.viewCount ?? 0) - (a.viewCount ?? 0)
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

function StepTextarea({ label, value, onChange, placeholder, required = false, maxLength = 1000, error }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; maxLength?: number; error?: string }) {
  return <label className="step-field qna-content-field"><span>{label}{required && <RequiredMark />}</span><textarea value={value} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /><small className="qna-character-count">{value.length}/{maxLength}자</small>{error && <small className="qna-field-error" role="alert">{error}</small>}</label>
}
