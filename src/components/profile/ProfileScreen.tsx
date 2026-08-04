import { type ChangeEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscriptionState,
  type PushSubscriptionState,
} from '../../lib/pushNotifications'
import type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, QnaComment, QnaPost } from '../../types/app'
import { validateImageFile } from '../../lib/imageStorage'
import { QnaTrustBadge } from '../qna/QnaTrustBadge'
import { getNextTrustTarget, getTrustLevel, getTrustScoreForMine } from '../qna/qnaTrust'

type ProfileTab = 'posts' | 'drafts' | 'likes' | 'accepted' | 'settings'
type WrittenFilter = 'qna' | 'reviews'
type ProfileActivityId = 'posts' | 'drafts' | 'likes' | 'accepted'
type LikeFilter = 'posts' | 'hospitals' | 'reviews'
type WrittenPost = QnaPost & { kind: 'question' }
type ProfileReviewItem = HospitalReview & { hospitalId: string }

const PROFILE_DRAFTS_ENABLED = false
const PROFILE_REVIEWS_ENABLED = false

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'posts', label: '작성한 글' },
  { id: 'drafts', label: '임시저장' },
  { id: 'likes', label: '좋아요' },
  { id: 'accepted', label: '채택 답변' },
  { id: 'settings', label: '설정' },
]

const visibleProfileTabs = profileTabs.filter((tab) => PROFILE_DRAFTS_ENABLED || tab.id !== 'drafts')
const profileTabIds = new Set<ProfileTab>(visibleProfileTabs.map((tab) => tab.id))

const initialNotificationState: PushSubscriptionState = {
  permission: 'default',
  isSubscribed: false,
  isDatabaseActive: false,
  status: 'disabled',
}

function isProfileTab(value: string | null): value is ProfileTab {
  return value !== null && profileTabIds.has(value as ProfileTab)
}

function readProfileTabFromUrl(): ProfileTab {
  if (typeof window === 'undefined') return 'posts'
  const tab = new URLSearchParams(window.location.search).get('tab')
  if (tab === 'reviews') return 'posts'
  return isProfileTab(tab) ? tab : 'posts'
}

function readWrittenFilterFromUrl(): WrittenFilter {
  if (!PROFILE_REVIEWS_ENABLED) return 'qna'
  if (typeof window === 'undefined') return 'qna'
  const params = new URLSearchParams(window.location.search)
  return params.get('tab') === 'reviews' || params.get('category') === 'reviews' ? 'reviews' : 'qna'
}

function syncProfileTabUrl(tab: ProfileTab, writtenFilter: WrittenFilter) {
  if (typeof window === 'undefined') return
  const category = tab === 'posts' ? `&category=${writtenFilter}` : ''
  const next = `/profile?tab=${tab}${category}${window.location.hash}`
  window.history.replaceState(window.history.state, '', next)
}

function formatDate(value?: string) {
  if (!value) return '날짜 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '날짜 없음'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function formatReviewDate(value?: string) {
  if (!value) return '방문일 미입력'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '방문일 미입력'
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

function draftTypeLabel(type: DraftItem['draftType']) {
  if (type === 'question') return 'Q&A'
  if (type === 'pet') return '마이 펫'
  if (type === 'care_record') return '기록'
  if (type === 'reminder') return '알림'
  return '병원 리뷰'
}

function clipText(value: string, limit = 120) {
  const text = value.trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}

function readableNotificationError(error: unknown) {
  if (!(error instanceof Error)) return '알림 설정을 완료하지 못했습니다.'
  if (error.message === 'VAPID_PUBLIC_KEY_MISSING') return '알림 설정값이 아직 준비되지 않았습니다.'
  if (error.message === 'VAPID_PUBLIC_KEY_INVALID') return '알림 설정값을 확인해 주세요.'
  if (error.message === 'PUSH_SUBSCRIPTION_KEYS_MISSING') return '브라우저 구독 정보를 확인하지 못했습니다.'
  return '알림 설정을 완료하지 못했습니다.'
}

function ProfileScreen({
  userId,
  profile,
  qnaPosts,
  hospitalReviews,
  likedHospitals,
  drafts,
  onSignOut,
  onDeleteAccount,
  onSaveProfile,
  onDeleteDraft,
  onContinueDraft,
  onOpenWrittenPost,
  onOpenHospital,
  onEditWrittenPost,
  onDeleteWrittenPost,
  onEditReview,
  onDeleteReview,
  onUnlikePost,
  onUnlikeHospital,
  onUnlikeReview,
  onCreateQuestion,
  onCreateReview,
}: {
  userId: string
  profile: AppProfile
  qnaPosts: QnaPost[]
  hospitalReviews: Record<string, HospitalReview[]>
  likedHospitals: HospitalSnapshot[]
  drafts: DraftItem[]
  onSignOut: () => void
  onDeleteAccount: () => void | Promise<void>
  onSaveProfile: (profile: AppProfile, avatarFile?: File) => void | Promise<void>
  onDeleteDraft: (draftId: string) => void
  onContinueDraft: (draft: DraftItem) => void
  onOpenWrittenPost: (kind: 'question', id: string) => void
  onOpenHospital: (hospital: HospitalSnapshot) => void
  onEditWrittenPost: (kind: 'question', id: string) => void
  onDeleteWrittenPost: (kind: 'question', id: string) => void
  onEditReview: (review: ProfileReviewItem) => void
  onDeleteReview: (hospitalId: string, reviewId: string) => void
  onUnlikePost: (postId: string) => void
  onUnlikeHospital: (hospital: HospitalSnapshot) => void
  onUnlikeReview: (hospitalId: string, reviewId: string) => void
  onCreateQuestion: () => void
  onCreateReview: () => void
}) {
  const [view, setView] = useState<ProfileTab>(() => readProfileTabFromUrl())
  const [writtenFilter, setWrittenFilter] = useState<WrittenFilter>(() => readWrittenFilterFromUrl())
  const username = profile.username
  const [nickname, setNickname] = useState(profile.nickname)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [avatarFile, setAvatarFile] = useState<File | undefined>()
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const avatarPreviewObjectUrlRef = useRef('')

  useEffect(() => {
    syncProfileTabUrl(view, writtenFilter)
  }, [view, writtenFilter])

  useEffect(() => () => {
    if (avatarPreviewObjectUrlRef.current) URL.revokeObjectURL(avatarPreviewObjectUrlRef.current)
  }, [])

  const displayName = profile.nickname || profile.username || '사용자'
  const accountId = profile.username || 'account'
  const writtenPosts = useMemo<WrittenPost[]>(
    () => qnaPosts.filter((post) => post.mine === true).map((post) => ({ ...post, kind: 'question' as const })),
    [qnaPosts],
  )
  const myReviews = useMemo<ProfileReviewItem[]>(
    () => Object.entries(hospitalReviews).flatMap(([hospitalId, reviews]) => (
      reviews
        .filter((review) => review.mine === true)
        .map((review) => ({ ...review, hospitalId }))
    )),
    [hospitalReviews],
  )
  const likedQnaItems = useMemo(
    () => qnaPosts.filter((post) => post.liked),
    [qnaPosts],
  )
  const likedReviewItems = useMemo<ProfileReviewItem[]>(
    () => Object.entries(hospitalReviews).flatMap(([hospitalId, reviews]) => (
      reviews
        .filter((review) => review.liked === true)
        .map((review) => ({ ...review, hospitalId }))
    )),
    [hospitalReviews],
  )
  const likedCount = likedQnaItems.length + likedHospitals.length + (PROFILE_REVIEWS_ENABLED ? likedReviewItems.length : 0)
  const acceptedAnswers = useMemo<Array<{ post: QnaPost; comment: QnaComment }>>(
    () => qnaPosts.flatMap((post) => {
      if (!post.selectedAnswerCommentId) return []
      const comment = post.comments.find((item) => item.id === post.selectedAnswerCommentId && item.mine === true)
      return comment ? [{ post, comment }] : []
    }),
    [qnaPosts],
  )
  const trustScore = getTrustScoreForMine(qnaPosts)
  const trustLevel = getTrustLevel(trustScore)
  const nextTrust = getNextTrustTarget(trustScore)
  const trustFloor = trustLevel === 0 ? 0 : trustLevel === 1 ? 5 : trustLevel === 2 ? 15 : 25
  const trustProgress = nextTrust
    ? Math.max(0, Math.min(100, ((trustScore - trustFloor) / (nextTrust.target - trustFloor)) * 100))
    : 100
  const [likeFilter, setLikeFilter] = useState<LikeFilter>(() => (
    likedQnaItems.length > 0
      ? 'posts'
      : likedHospitals.length > 0
        ? 'hospitals'
        : 'posts'
  ))

  const openTab = (tab: ProfileTab, shouldScroll = true) => {
    setView(tab)
    if (shouldScroll) {
      window.setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    }
  }

  const attachAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      validateImageFile(file)
      if (avatarPreviewObjectUrlRef.current) URL.revokeObjectURL(avatarPreviewObjectUrlRef.current)
      const previewUrl = URL.createObjectURL(file)
      avatarPreviewObjectUrlRef.current = previewUrl
      setAvatarUrl(previewUrl)
      setAvatarFile(file)
      setProfileSaved(false)
    } catch (error) {
      setProfileSaved(false)
      window.alert(error instanceof Error ? error.message : '프로필 사진을 불러오지 못했습니다.')
    }
  }

  const saveCurrentProfile = async () => {
    try {
      await onSaveProfile({ username, nickname, avatarUrl }, avatarFile)
      setAvatarFile(undefined)
      setProfileSaved(true)
    } catch {
      setProfileSaved(false)
    }
  }
  const hasProfileChanges = nickname.trim() !== profile.nickname
    || avatarUrl.trim() !== profile.avatarUrl

  return (
    <section className="profile-page" aria-labelledby="profile-page-title">
      <h1 id="profile-page-title" className="profile-page-title">프로필</h1>

      <ProfileHeader
        displayName={displayName}
        accountId={accountId}
        avatarUrl={avatarUrl}
        isLoading={!profile.username && !profile.nickname}
      />

      <section className="profile-trust-summary" aria-label="신뢰 답변자 등급">
        <div className="profile-trust-heading">
          <div className="profile-trust-copy">
            <span className="profile-trust-label">답변 신뢰도</span>
            <div>
              <strong>{trustLevel > 0 ? '신뢰 답변자' : '일반 사용자'}</strong>
              {trustLevel > 0 ? <QnaTrustBadge score={trustScore} /> : <span className="profile-trust-level">Lv.0</span>}
            </div>
          </div>
          <div className="profile-trust-score">
            <strong>{trustScore}</strong>
            <span>포인트</span>
          </div>
        </div>
        <div
          className="profile-trust-progress"
          role="progressbar"
          aria-label={nextTrust ? `신뢰 답변자 레벨 ${nextTrust.level} 진행도` : '신뢰 답변자 최고 등급'}
          aria-valuemin={trustFloor}
          aria-valuemax={nextTrust?.target ?? 25}
          aria-valuenow={nextTrust ? trustScore : Math.min(trustScore, 25)}
        >
          <span style={{ width: `${trustProgress}%` }} />
        </div>
        <div className="profile-trust-footer">
          <span>{nextTrust ? `다음 등급 Lv.${nextTrust.level}` : '최고 등급 달성'}</span>
          <strong>{nextTrust ? `${nextTrust.target - trustScore}점 남음` : '완료'}</strong>
        </div>
      </section>

      <ProfileActivitySummary
        activeId={view}
        items={[
          { id: 'posts', label: '글', count: writtenPosts.length + (PROFILE_REVIEWS_ENABLED ? myReviews.length : 0) },
          ...(PROFILE_DRAFTS_ENABLED ? [{ id: 'drafts' as const, label: '임시저장', count: drafts.length }] : []),
          { id: 'likes', label: '좋아요', count: likedCount },
          { id: 'accepted', label: '채택 답변', count: acceptedAnswers.length },
        ]}
        onSelect={(activity) => openTab(activity)}
      />

      <div ref={tabsRef} className="profile-detail-area">
        <ProfileTabs activeTab={view} onSelect={(tab) => openTab(tab, false)} />

        <div
          id={`profile-panel-${view}`}
          className="profile-tab-panel"
          role="tabpanel"
          aria-labelledby={`profile-tab-${view}`}
          tabIndex={0}
        >
          {view === 'posts' && (
            <ProfileWrittenContent
              filter={writtenFilter}
              onFilterChange={setWrittenFilter}
              posts={writtenPosts}
              reviews={myReviews}
              onCreateQuestion={onCreateQuestion}
              onCreateReview={onCreateReview}
              onOpenPost={onOpenWrittenPost}
              onEditPost={onEditWrittenPost}
              onDeletePost={onDeleteWrittenPost}
              onEditReview={onEditReview}
              onDeleteReview={onDeleteReview}
            />
          )}

          {PROFILE_DRAFTS_ENABLED && view === 'drafts' && (
            <ProfileDraftList
              drafts={drafts}
              onContinue={onContinueDraft}
              onDelete={onDeleteDraft}
            />
          )}

          {view === 'likes' && (
            <ProfileLikeList
              filter={likeFilter}
              onFilterChange={setLikeFilter}
              posts={likedQnaItems}
              hospitals={likedHospitals}
              reviews={likedReviewItems}
              onOpenPost={(id) => onOpenWrittenPost('question', id)}
              onOpenHospital={onOpenHospital}
              onUnlikePost={onUnlikePost}
              onUnlikeHospital={onUnlikeHospital}
              onUnlikeReview={onUnlikeReview}
            />
          )}

          {view === 'accepted' && (
            <ProfileAcceptedAnswerList
              answers={acceptedAnswers}
              onOpenPost={(id) => onOpenWrittenPost('question', id)}
            />
          )}

          {view === 'settings' && (
            <ProfileSettings
              userId={userId}
              username={username}
              nickname={nickname}
              avatarUrl={avatarUrl}
              profileSaved={profileSaved}
              hasProfileChanges={hasProfileChanges}
              deleteConfirm={deleteConfirm}
              deletingAccount={deletingAccount}
              onNicknameChange={(value) => {
                setNickname(value)
                setProfileSaved(false)
              }}
              onAvatarChange={attachAvatar}
              onSave={saveCurrentProfile}
              onSignOut={onSignOut}
              onDeleteConfirmChange={setDeleteConfirm}
              onDeleteAccount={async () => {
                setDeletingAccount(true)
                try {
                  await onDeleteAccount()
                } finally {
                  setDeletingAccount(false)
                }
              }}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function ProfileHeader({
  displayName,
  accountId,
  avatarUrl,
  isLoading,
}: {
  displayName: string
  accountId: string
  avatarUrl: string
  isLoading: boolean
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('')
  const showAvatar = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl

  if (isLoading) {
    return (
      <div className="profile-header-skeleton" aria-label="프로필 정보를 불러오는 중" aria-busy="true">
        <span className="profile-skeleton-avatar" />
        <div>
          <span className="profile-skeleton-line wide" />
          <span className="profile-skeleton-line" />
        </div>
      </div>
    )
  }

  return (
    <header className="profile-summary-header">
      <div className="profile-summary-main">
        <div className="profile-summary-avatar">
          {showAvatar ? (
            <img
              src={avatarUrl}
              alt={`${displayName}님의 프로필 사진`}
              onError={() => setFailedAvatarUrl(avatarUrl)}
            />
          ) : (
            <span role="img" aria-label={`${displayName}님의 기본 프로필 이미지`}>{displayName.slice(0, 1)}</span>
          )}
        </div>
        <div className="profile-summary-copy">
          <h2>{displayName}</h2>
          <p>@{accountId}</p>
        </div>
      </div>
    </header>
  )
}

function ProfileActivitySummary({
  items,
  activeId,
  onSelect,
}: {
  items: Array<{ id: ProfileActivityId; label: string; count: number }>
  activeId: ProfileTab | ProfileActivityId
  onSelect: (activity: ProfileActivityId) => void
}) {
  return (
    <div className="profile-activity-summary" aria-label="활동 요약">
      {items.map((item) => (
        <button
          key={item.id}
          className={activeId === item.id ? 'is-active' : ''}
          type="button"
          aria-label={`${item.label}: ${item.count}`}
          aria-current={activeId === item.id ? 'page' : undefined}
          title={`${item.label}: ${item.count}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="profile-summary-count">{item.count}</span>
          <span className="profile-summary-label">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function ProfileTabs({ activeTab, onSelect }: { activeTab: ProfileTab; onSelect: (tab: ProfileTab) => void }) {
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? visibleProfileTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleProfileTabs.length) % visibleProfileTabs.length
    const nextTab = visibleProfileTabs[nextIndex]
    onSelect(nextTab.id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]
      ?.focus()
  }

  return (
    <nav className="profile-detail-tabs" aria-label="프로필 세부 활동" role="tablist">
      {visibleProfileTabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`profile-tab-${tab.id}`}
          className={activeTab === tab.id ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`profile-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onKeyDown={(event) => moveFocus(event, index)}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

function ProfileWrittenContent({
  filter,
  onFilterChange,
  posts,
  reviews,
  onCreateQuestion,
  onCreateReview,
  onOpenPost,
  onEditPost,
  onDeletePost,
  onEditReview,
  onDeleteReview,
}: {
  filter: WrittenFilter
  onFilterChange: (filter: WrittenFilter) => void
  posts: WrittenPost[]
  reviews: ProfileReviewItem[]
  onCreateQuestion: () => void
  onCreateReview: () => void
  onOpenPost: (kind: 'question', id: string) => void
  onEditPost: (kind: 'question', id: string) => void
  onDeletePost: (kind: 'question', id: string) => void
  onEditReview: (review: ProfileReviewItem) => void
  onDeleteReview: (hospitalId: string, reviewId: string) => void
}) {
  return (
    <div className="profile-written-area">
      <div className="profile-category-filters" role="tablist" aria-label="작성한 글 카테고리">
        <button
          className={filter === 'qna' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={filter === 'qna'}
          onClick={() => onFilterChange('qna')}
        >
          Q&amp;A <span>{posts.length}</span>
        </button>
        {PROFILE_REVIEWS_ENABLED && <button
          className={filter === 'reviews' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={filter === 'reviews'}
          onClick={() => onFilterChange('reviews')}
        >
          리뷰 <span>{reviews.length}</span>
        </button>}
      </div>

      {filter === 'qna' || !PROFILE_REVIEWS_ENABLED ? (
        <ProfilePostList
          posts={posts}
          onCreateQuestion={onCreateQuestion}
          onOpen={onOpenPost}
          onEdit={onEditPost}
          onDelete={onDeletePost}
        />
      ) : (
        <ProfileReviewList
          reviews={reviews}
          onCreateReview={onCreateReview}
          onEdit={onEditReview}
          onDelete={onDeleteReview}
        />
      )}
    </div>
  )
}

function ProfilePostList({
  posts,
  onCreateQuestion,
  onOpen,
  onEdit,
  onDelete,
}: {
  posts: WrittenPost[]
  onCreateQuestion: () => void
  onOpen: (kind: 'question', id: string) => void
  onEdit: (kind: 'question', id: string) => void
  onDelete: (kind: 'question', id: string) => void
}) {
  if (posts.length === 0) {
    return (
      <ProfileEmptyState
        title="아직 작성한 글이 없습니다."
        description="궁금한 내용을 Q&A에 남겨보세요."
        actionLabel="질문 작성하기"
        onAction={onCreateQuestion}
      />
    )
  }

  return (
    <div className="profile-content-list" role="list">
      {posts.map((post) => (
        <article key={post.id} className="profile-list-row" role="listitem">
          <button className="profile-row-main" type="button" onClick={() => onOpen(post.kind, post.id)}>
            <span className="profile-row-kicker">Q&A · {formatDate(post.createdAt)}</span>
            <strong>{post.title}</strong>
            <p>{clipText(post.body)}</p>
            <span className="profile-row-status-meta">
              <ProfilePostStatus status={post.status} />
              <span>조회 {post.viewCount ?? 0} · 댓글 {post.comments?.length ?? 0}</span>
            </span>
          </button>
          <ProfileRowMenu
            items={[
              { label: '수정', onClick: () => onEdit(post.kind, post.id) },
              {
                label: '삭제',
                onClick: () => window.confirm('이 글을 삭제할까요?') && onDelete(post.kind, post.id),
                danger: true,
              },
            ]}
          />
        </article>
      ))}
    </div>
  )
}

function ProfilePostStatus({ status }: { status: QnaPost['status'] }) {
  const isResolved = status === 'resolved'

  return (
    <span className={`profile-post-status ${isResolved ? 'resolved' : 'waiting'}`}>
      {isResolved ? '해결' : '답변 대기'}
    </span>
  )
}

function ProfileDraftList({
  drafts,
  onContinue,
  onDelete,
}: {
  drafts: DraftItem[]
  onContinue: (draft: DraftItem) => void
  onDelete: (draftId: string) => void
}) {
  if (drafts.length === 0) {
    return <ProfileEmptyState title="임시저장된 글이 없습니다." />
  }

  return (
    <div className="profile-content-list" role="list">
      {drafts.map((draft) => (
        <article key={draft.id} className="profile-list-row" role="listitem">
          <div className="profile-row-main static">
            <span className="profile-row-kicker">{draftTypeLabel(draft.draftType)} · 마지막 수정 {formatDate(draft.updatedAt)}</span>
            <strong>{draft.title || '제목 없는 글'}</strong>
            <p>{clipText(draft.body || '작성 중인 내용이 아직 없습니다.')}</p>
          </div>
          <div className="profile-row-end">
            <button className="profile-continue-button" type="button" onClick={() => onContinue(draft)}>이어서 작성</button>
            <ProfileRowMenu
              items={[
                {
                  label: '삭제',
                  onClick: () => window.confirm('이 임시저장 글을 삭제할까요?') && onDelete(draft.id),
                  danger: true,
                },
              ]}
            />
          </div>
        </article>
      ))}
    </div>
  )
}

function ProfileAcceptedAnswerList({ answers, onOpenPost }: { answers: Array<{ post: QnaPost; comment: QnaComment }>; onOpenPost: (id: string) => void }) {
  return (
    <ProfileLikeSection title="채택된 답변" count={answers.length}>
      {answers.map(({ post, comment }) => (
        <article key={`${post.id}-${comment.id}`} className="profile-list-row">
          <button className="profile-row-main" type="button" onClick={() => onOpenPost(post.id)}>
            <span className="profile-row-kicker">Q&A · {formatDate(post.createdAt)}</span>
            <strong>{post.title}</strong>
            <p>{comment.body}</p>
            <span className="profile-row-meta">채택 답변</span>
          </button>
        </article>
      ))}
    </ProfileLikeSection>
  )
}

function ProfileLikeList({
  filter,
  onFilterChange,
  posts,
  hospitals,
  reviews,
  onOpenPost,
  onOpenHospital,
  onUnlikePost,
  onUnlikeHospital,
  onUnlikeReview,
}: {
  filter: LikeFilter
  onFilterChange: (filter: LikeFilter) => void
  posts: QnaPost[]
  hospitals: HospitalSnapshot[]
  reviews: ProfileReviewItem[]
  onOpenPost: (id: string) => void
  onOpenHospital: (hospital: HospitalSnapshot) => void
  onUnlikePost: (postId: string) => void
  onUnlikeHospital: (hospital: HospitalSnapshot) => void
  onUnlikeReview: (hospitalId: string, reviewId: string) => void
}) {
  const total = posts.length + hospitals.length + (PROFILE_REVIEWS_ENABLED ? reviews.length : 0)
  const filters: Array<{ id: LikeFilter; label: string; count: number }> = [
    { id: 'posts', label: '게시글', count: posts.length },
    { id: 'hospitals', label: '병원', count: hospitals.length },
    { id: 'reviews', label: '리뷰', count: reviews.length },
  ].filter((item) => PROFILE_REVIEWS_ENABLED || item.id !== 'reviews') as Array<{ id: LikeFilter; label: string; count: number }>

  if (total === 0) {
    return (
      <ProfileEmptyState
        title="아직 좋아요한 항목이 없습니다."
        description="필요한 글이나 병원을 저장해보세요."
      />
    )
  }

  return (
    <div className="profile-like-area">
      <div className="profile-category-filters" aria-label="좋아요 필터">
        {filters.map((item) => (
          <button
            key={item.id}
            className={filter === item.id ? 'is-active' : ''}
            type="button"
            onClick={() => onFilterChange(item.id)}
          >
            {item.label} <span>{item.count}</span>
          </button>
        ))}
      </div>

      {filter === 'posts' && (
        <ProfileLikeSection title="게시글" count={posts.length}>
          {posts.map((post) => (
            <article key={post.id} className="profile-list-row">
              <button className="profile-row-main" type="button" onClick={() => onOpenPost(post.id)}>
                <span className="profile-row-kicker">Q&A · {formatDate(post.createdAt)}</span>
                <strong>{post.title}</strong>
                <span className="profile-row-status-meta">
                  <ProfilePostStatus status={post.status} />
                  <span>조회 {post.viewCount ?? 0} · 댓글 {post.comments?.length ?? 0}</span>
                </span>
              </button>
              <ProfileRowMenu items={[{ label: '좋아요 해제', onClick: () => onUnlikePost(post.id) }]} />
            </article>
          ))}
        </ProfileLikeSection>
      )}

      {filter === 'hospitals' && (
        <ProfileLikeSection title="병원" count={hospitals.length}>
          {hospitals.map((hospital) => (
            <article key={hospital.id ?? hospital.name} className="profile-list-row">
              <button className="profile-row-main" type="button" onClick={() => onOpenHospital(hospital)}>
                <span className="profile-row-kicker">병원</span>
                <strong>{hospital.name}</strong>
                <p>{hospital.address || '주소 정보 없음'}</p>
                <span className="profile-row-meta">{hospital.rating ? `평점 ${hospital.rating}` : '평점 정보 없음'} · 상세보기</span>
              </button>
              <ProfileRowMenu items={[{ label: '좋아요 해제', onClick: () => onUnlikeHospital(hospital) }]} />
            </article>
          ))}
        </ProfileLikeSection>
      )}

      {PROFILE_REVIEWS_ENABLED && filter === 'reviews' && (
        <ProfileLikeSection title="리뷰" count={reviews.length}>
          {reviews.map((review) => (
            <article key={review.id} className="profile-list-row">
              <button
                className="profile-row-main"
                type="button"
                disabled={!review.hospitalSnapshot}
                onClick={() => review.hospitalSnapshot && onOpenHospital(review.hospitalSnapshot)}
              >
                <span className="profile-row-kicker profile-review-kicker">
                  <span>리뷰</span>
                  <span aria-hidden="true">·</span>
                  <ProfileRatingStars rating={review.rating} />
                </span>
                <strong>{review.hospitalName || review.hospitalSnapshot?.name || '병원 리뷰'}</strong>
                <p>{clipText(review.body || review.content || '')}</p>
              </button>
              <ProfileRowMenu items={[{ label: '좋아요 해제', onClick: () => onUnlikeReview(review.hospitalId, review.id) }]} />
            </article>
          ))}
        </ProfileLikeSection>
      )}
    </div>
  )
}

function ProfileLikeSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="profile-like-section">
      <header>
        <h3>{title}</h3>
        <span>{count}</span>
      </header>
      {count === 0 ? <p className="profile-inline-empty">해당 항목이 없습니다.</p> : <div className="profile-content-list">{children}</div>}
    </section>
  )
}

function ProfileRatingStars({ rating }: { rating: number }) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)))

  return (
    <span className="profile-rating-stars" aria-label={`별점 ${rating}점, 5점 만점`}>
      <span aria-hidden="true">{'★'.repeat(normalizedRating)}</span>
      <span className="is-empty" aria-hidden="true">{'☆'.repeat(5 - normalizedRating)}</span>
    </span>
  )
}

function ProfileReviewList({
  reviews,
  onCreateReview,
  onEdit,
  onDelete,
}: {
  reviews: ProfileReviewItem[]
  onCreateReview: () => void
  onEdit: (review: ProfileReviewItem) => void
  onDelete: (hospitalId: string, reviewId: string) => void
}) {
  if (reviews.length === 0) {
    return (
      <ProfileEmptyState
        title="아직 작성한 병원 리뷰가 없습니다."
        description="방문한 병원의 경험을 남겨보세요."
        actionLabel="리뷰 작성하기"
        onAction={onCreateReview}
      />
    )
  }

  return (
    <div className="profile-content-list" role="list">
      {reviews.map((review) => (
        <article key={review.id} className="profile-list-row" role="listitem">
          <button className="profile-row-main" type="button" onClick={() => onEdit(review)}>
            <span className="profile-row-kicker profile-review-kicker">
              <span>{formatReviewDate(review.visitDate || review.createdAt)}</span>
              <span aria-hidden="true">·</span>
              <ProfileRatingStars rating={review.rating} />
            </span>
            <strong>{review.hospitalName || review.hospitalSnapshot?.name || '병원 리뷰'}</strong>
            <span className="profile-row-meta">{review.petName || review.species || '방문 동물 정보 없음'}</span>
            <p>{clipText(review.body || review.content || '')}</p>
          </button>
          <ProfileRowMenu
            items={[
              { label: '수정', onClick: () => onEdit(review) },
              {
                label: '삭제',
                onClick: () => window.confirm('이 병원 리뷰를 삭제할까요?') && onDelete(review.hospitalId, review.id),
                danger: true,
              },
            ]}
          />
        </article>
      ))}
    </div>
  )
}

function ProfileSettings({
  userId,
  username,
  nickname,
  avatarUrl,
  profileSaved,
  hasProfileChanges,
  deleteConfirm,
  deletingAccount,
  onNicknameChange,
  onAvatarChange,
  onSave,
  onSignOut,
  onDeleteConfirmChange,
  onDeleteAccount,
}: {
  userId: string
  username: string
  nickname: string
  avatarUrl: string
  profileSaved: boolean
  hasProfileChanges: boolean
  deleteConfirm: string
  deletingAccount: boolean
  onNicknameChange: (value: string) => void
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onSignOut: () => void
  onDeleteConfirmChange: (value: string) => void
  onDeleteAccount: () => void
}) {
  return (
    <div className="profile-settings">
      <ProfileSection
        username={username}
        nickname={nickname}
        avatarUrl={avatarUrl}
        profileSaved={profileSaved}
        hasProfileChanges={hasProfileChanges}
        onNicknameChange={onNicknameChange}
        onAvatarChange={onAvatarChange}
        onSave={onSave}
      />
      <NotificationSection userId={userId} />
      <AccountSection onSignOut={onSignOut} />
      <DangerZoneSection
        deleteConfirm={deleteConfirm}
        deletingAccount={deletingAccount}
        onDeleteConfirmChange={onDeleteConfirmChange}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  )
}

function ProfileSection({
  username,
  nickname,
  avatarUrl,
  profileSaved,
  hasProfileChanges,
  onNicknameChange,
  onAvatarChange,
  onSave,
}: {
  username: string
  nickname: string
  avatarUrl: string
  profileSaved: boolean
  hasProfileChanges: boolean
  onNicknameChange: (value: string) => void
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('')
  const showAvatar = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl
  const fallback = (nickname || username || '사용자').slice(0, 1)

  return (
    <section className="settings-card" aria-labelledby="settings-profile-title">
      <header className="settings-card-header">
        <h3 id="settings-profile-title">프로필</h3>
        <p>다른 사용자에게 표시되는 프로필 정보를 관리합니다.</p>
      </header>
      <div className="settings-profile-layout">
        <div className="settings-avatar-field">
          <button
            className="settings-avatar-button"
            type="button"
            aria-label="프로필 사진 변경"
            title="프로필 사진 변경"
            onClick={() => fileInputRef.current?.click()}
          >
            {showAvatar ? (
              <img src={avatarUrl} alt="현재 프로필 사진" onError={() => setFailedAvatarUrl(avatarUrl)} />
            ) : (
              <span aria-hidden="true">{fallback}</span>
            )}
            <span className="settings-avatar-overlay" aria-hidden="true">변경</span>
          </button>
          <input
            ref={fileInputRef}
            className="settings-file-input"
            type="file"
            accept="image/*"
            tabIndex={-1}
            onChange={onAvatarChange}
          />
        </div>
        <div className="settings-profile-fields">
          <label className="settings-field">
            <span>닉네임</span>
            <input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} placeholder="닉네임" />
          </label>
          <label className="settings-field">
            <span>아이디</span>
            <input value={username} readOnly aria-readonly="true" />
          </label>
          <div className="settings-save-row">
            <button
              className="settings-action-button primary"
              type="button"
              disabled={!hasProfileChanges}
              onClick={onSave}
            >
              저장
            </button>
            {profileSaved && !hasProfileChanges && <p role="status">변경사항을 저장했습니다.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

function NotificationSection({ userId }: { userId: string }) {
  const [state, setState] = useState<PushSubscriptionState>(initialNotificationState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    getPushSubscriptionState()
      .then((nextState) => {
        if (active) setState(nextState)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const toggleNotifications = async () => {
    if (state.permission === 'denied' || state.permission === 'unsupported') return
    setIsSaving(true)
    setErrorMessage('')
    try {
      setState(await (state.isSubscribed
        ? disablePushNotifications(userId)
        : enablePushNotifications(userId)))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification opt-in failed.', error)
      setErrorMessage(readableNotificationError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const isEnabled = state.status === 'enabled'
  const switchDisabled = isLoading || isSaving || state.status === 'blocked' || state.status === 'unsupported'
  const statusLabel = isLoading
    ? '확인 중'
    : state.status === 'enabled'
      ? '알림 켜짐'
      : state.status === 'disabled'
        ? '알림 꺼짐'
        : state.status === 'registration-required'
          ? '기기 등록 필요'
          : state.status === 'blocked'
        ? '브라우저에서 차단됨'
            : '지원되지 않는 환경'

  return (
    <section className="settings-card settings-notification-card" aria-labelledby="settings-notification-title">
      <div className="settings-card-header">
        <h3 id="settings-notification-title">돌봄 알림</h3>
        <p>등록한 루틴과 완료하지 않은 돌봄을 알려드립니다.</p>
      </div>
      <button
        className="settings-switch"
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={`돌봄 알림 ${isEnabled ? '끄기' : '켜기'}`}
        disabled={switchDisabled}
        onClick={toggleNotifications}
      >
        <span aria-hidden="true" />
      </button>
      <div className="settings-notification-status" aria-live="polite">
        <span>현재 상태</span>
        <strong>{isSaving ? '변경 중' : statusLabel}</strong>
      </div>
      {errorMessage && <p className="profile-settings-error" role="alert">{errorMessage}</p>}
    </section>
  )
}

function AccountSection({ onSignOut }: { onSignOut: () => void }) {
  return (
    <section className="settings-card" aria-labelledby="settings-account-title">
      <header className="settings-card-header">
        <h3 id="settings-account-title">계정</h3>
        <p>로그인과 보안 관련 기능을 관리합니다.</p>
      </header>
      <div className="settings-account-actions">
        <button className="settings-action-button secondary" type="button" onClick={onSignOut}>로그아웃</button>
      </div>
    </section>
  )
}

function DangerZoneSection({
  deleteConfirm,
  deletingAccount,
  onDeleteConfirmChange,
  onDeleteAccount,
}: {
  deleteConfirm: string
  deletingAccount: boolean
  onDeleteConfirmChange: (value: string) => void
  onDeleteAccount: () => void
}) {
  const canDelete = deleteConfirm === '계정 삭제' && !deletingAccount

  return (
    <section className="settings-card settings-danger-card" aria-labelledby="settings-danger-title">
      <header className="settings-card-header">
        <h3 id="settings-danger-title">Danger Zone</h3>
        <p>계정을 삭제하면 작성한 데이터와 프로필을 복구할 수 없습니다.</p>
      </header>
      <label className="settings-field">
        <span>삭제 확인</span>
        <input
          value={deleteConfirm}
          autoComplete="off"
          placeholder="계정 삭제"
          onChange={(event) => onDeleteConfirmChange(event.target.value)}
        />
      </label>
      <button
        className="settings-action-button danger"
        type="button"
        disabled={!canDelete}
        onClick={onDeleteAccount}
      >
        {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
      </button>
    </section>
  )
}

function ProfileEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="profile-empty-state">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  )
}

function ProfileRowMenu({
  items,
}: {
  items: Array<{ label: string; onClick: () => void; danger?: boolean }>
}) {
  return (
    <details className="profile-row-menu">
      <summary aria-label="항목 관리">
        <span aria-hidden="true">⋯</span>
      </summary>
      <div>
        {items.map((item) => (
          <button
            key={item.label}
            className={item.danger ? 'danger' : ''}
            type="button"
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open')
              item.onClick()
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  )
}

export default ProfileScreen
