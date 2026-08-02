import { type ChangeEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  enablePushNotifications,
  getPushSubscriptionState,
  type PushSubscriptionState,
} from '../../lib/pushNotifications'
import type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, QnaPost } from '../../types/app'

type ProfileTab = 'posts' | 'drafts' | 'likes' | 'settings'
type WrittenFilter = 'qna' | 'reviews'
type ProfileActivityId = 'posts' | 'drafts' | 'likes' | 'reviews'
type LikeFilter = 'posts' | 'hospitals' | 'reviews'
type WrittenPost = QnaPost & { kind: 'question' }
type ProfileReviewItem = HospitalReview & { hospitalId: string }

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'posts', label: '작성한 글' },
  { id: 'drafts', label: '임시저장' },
  { id: 'likes', label: '좋아요' },
  { id: 'settings', label: '설정' },
]

const profileTabIds = new Set<ProfileTab>(profileTabs.map((tab) => tab.id))

const initialNotificationState: PushSubscriptionState = {
  permission: 'default',
  isSubscribed: false,
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

function notificationStatusLabel(state: PushSubscriptionState) {
  if (state.permission === 'unsupported') return '지원 안 됨'
  if (state.permission === 'denied') return '차단됨'
  if (state.permission === 'granted' && state.isSubscribed) return '허용됨'
  if (state.permission === 'granted') return '허용됨'
  return '미요청'
}

function notificationButtonLabel(state: PushSubscriptionState) {
  if (state.permission === 'unsupported') return '지원 안 됨'
  if (state.permission === 'denied') return '브라우저 설정에서 변경'
  if (state.permission === 'granted' && state.isSubscribed) return '알림 켜짐'
  return '알림 켜기'
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
  onSaveProfile: (profile: AppProfile) => void
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
  const [username, setUsername] = useState(profile.username)
  const [nickname, setNickname] = useState(profile.nickname)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const tabsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    syncProfileTabUrl(view, writtenFilter)
  }, [view, writtenFilter])

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
  const likedCount = likedQnaItems.length + likedHospitals.length + likedReviewItems.length
  const [likeFilter, setLikeFilter] = useState<LikeFilter>(() => (
    likedQnaItems.length > 0
      ? 'posts'
      : likedHospitals.length > 0
        ? 'hospitals'
        : 'reviews'
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
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  const saveCurrentProfile = () => {
    onSaveProfile({ username, nickname, avatarUrl })
    setProfileSaved(true)
  }

  return (
    <section className="profile-page" aria-labelledby="profile-page-title">
      <h1 id="profile-page-title" className="profile-page-title">프로필</h1>

      <ProfileHeader
        displayName={displayName}
        accountId={accountId}
        avatarUrl={avatarUrl}
        isLoading={!profile.username && !profile.nickname}
      />

      <ProfileActivitySummary
        activeId={view === 'posts' && writtenFilter === 'reviews' ? 'reviews' : view}
        items={[
          { id: 'posts', label: 'Q&A', count: writtenPosts.length },
          { id: 'drafts', label: '임시저장', count: drafts.length },
          { id: 'likes', label: '좋아요', count: likedCount },
          { id: 'reviews', label: '병원 리뷰', count: myReviews.length },
        ]}
        onSelect={(activity) => {
          if (activity === 'posts' || activity === 'reviews') {
            setWrittenFilter(activity === 'reviews' ? 'reviews' : 'qna')
            openTab('posts')
            return
          }
          openTab(activity)
        }}
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

          {view === 'drafts' && (
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

          {view === 'settings' && (
            <ProfileSettings
              userId={userId}
              username={username}
              nickname={nickname}
              avatarUrl={avatarUrl}
              profileSaved={profileSaved}
              deleteConfirm={deleteConfirm}
              deletingAccount={deletingAccount}
              onUsernameChange={setUsername}
              onNicknameChange={setNickname}
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
          <span className="profile-skeleton-line intro" />
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
          <span>한 줄 소개가 없습니다.</span>
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
        ? profileTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + profileTabs.length) % profileTabs.length
    const nextTab = profileTabs[nextIndex]
    onSelect(nextTab.id)
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]
      ?.focus()
  }

  return (
    <nav className="profile-detail-tabs" aria-label="프로필 세부 활동" role="tablist">
      {profileTabs.map((tab, index) => (
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
        <button
          className={filter === 'reviews' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={filter === 'reviews'}
          onClick={() => onFilterChange('reviews')}
        >
          리뷰 <span>{reviews.length}</span>
        </button>
      </div>

      {filter === 'qna' ? (
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
        icon="?"
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
            <span className="profile-row-meta">
              {post.status === 'resolved' ? '해결' : '답변 대기'} · 조회 {post.viewCount ?? 0} · 댓글 {post.comments?.length ?? 0}
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
    return <ProfileEmptyState icon="임" title="임시저장된 글이 없습니다." />
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
  const total = posts.length + hospitals.length + reviews.length
  const filters: Array<{ id: LikeFilter; label: string; count: number }> = [
    { id: 'posts', label: '게시글', count: posts.length },
    { id: 'hospitals', label: '병원', count: hospitals.length },
    { id: 'reviews', label: '리뷰', count: reviews.length },
  ]

  if (total === 0) {
    return (
      <ProfileEmptyState
        icon="♡"
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
                <span className="profile-row-meta">
                  {post.status === 'resolved' ? '해결' : '답변 대기'} · 조회 {post.viewCount ?? 0} · 댓글 {post.comments?.length ?? 0}
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

      {filter === 'reviews' && (
        <ProfileLikeSection title="리뷰" count={reviews.length}>
          {reviews.map((review) => (
            <article key={review.id} className="profile-list-row">
              <button
                className="profile-row-main"
                type="button"
                disabled={!review.hospitalSnapshot}
                onClick={() => review.hospitalSnapshot && onOpenHospital(review.hospitalSnapshot)}
              >
                <span className="profile-row-kicker">리뷰 · 별점 {review.rating}</span>
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
        icon="병"
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
            <span className="profile-row-kicker">
              {formatReviewDate(review.visitDate || review.createdAt)} · 별점 {review.rating}
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
  deleteConfirm,
  deletingAccount,
  onUsernameChange,
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
  deleteConfirm: string
  deletingAccount: boolean
  onUsernameChange: (value: string) => void
  onNicknameChange: (value: string) => void
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onSignOut: () => void
  onDeleteConfirmChange: (value: string) => void
  onDeleteAccount: () => void
}) {
  return (
    <div className="profile-settings">
      <section className="profile-settings-section" aria-labelledby="profile-account-title">
        <h3 id="profile-account-title">계정 정보</h3>
        <div className="profile-settings-grid">
          <label>
            <span>아이디</span>
            <input value={username} onChange={(event) => onUsernameChange(event.target.value)} placeholder="username" />
          </label>
          <label>
            <span>닉네임</span>
            <input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} placeholder="nickname" />
          </label>
          <label className="profile-file-field">
            <span>프로필 사진</span>
            <span className="profile-file-button">사진 선택</span>
            <input type="file" accept="image/*" onChange={onAvatarChange} />
          </label>
          {avatarUrl && <img className="profile-avatar-preview" src={avatarUrl} alt="프로필 사진 미리보기" />}
        </div>
        <div className="profile-settings-actions">
          <button className="profile-primary-button" type="button" onClick={onSave}>저장</button>
          {profileSaved && <p role="status">프로필 정보를 저장했습니다.</p>}
        </div>
      </section>

      <NotificationSettings userId={userId} />

      <section className="profile-settings-section" aria-labelledby="profile-security-title">
        <h3 id="profile-security-title">계정 관리</h3>
        <div className="profile-account-actions">
          <button type="button" onClick={onSignOut}>로그아웃</button>
          <button type="button" disabled>비밀번호 변경</button>
          <label>
            <span>계정 삭제 확인 문구</span>
            <input value={deleteConfirm} onChange={(event) => onDeleteConfirmChange(event.target.value)} placeholder="계정 삭제" />
          </label>
          <button
            className="danger"
            type="button"
            disabled={deleteConfirm !== '계정 삭제' || deletingAccount}
            onClick={onDeleteAccount}
          >
            {deletingAccount ? '삭제 중...' : '회원 탈퇴'}
          </button>
        </div>
      </section>
    </div>
  )
}

function NotificationSettings({ userId }: { userId: string }) {
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

  const enable = async () => {
    if (state.permission === 'denied' || state.permission === 'unsupported' || state.isSubscribed) return
    setIsSaving(true)
    setErrorMessage('')
    try {
      setState(await enablePushNotifications(userId))
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Push notification opt-in failed.', error)
      setErrorMessage(readableNotificationError(error))
    } finally {
      setIsSaving(false)
    }
  }

  const buttonDisabled = isLoading || isSaving || state.permission === 'denied' || state.permission === 'unsupported' || state.isSubscribed

  return (
    <section className="profile-settings-section profile-notification-row" aria-labelledby="profile-notification-title">
      <div>
        <h3 id="profile-notification-title">돌봄 알림</h3>
        <p>등록한 루틴과 완료하지 않은 돌봄을 알려드립니다.</p>
      </div>
      <div className="profile-notification-controls">
        <span>현재 상태: {isLoading ? '확인 중' : notificationStatusLabel(state)}</span>
        <button type="button" disabled={buttonDisabled} onClick={enable}>
          {isSaving ? '설정 중...' : notificationButtonLabel(state)}
        </button>
      </div>
      {errorMessage && <p className="profile-settings-error" role="alert">{errorMessage}</p>}
    </section>
  )
}

function ProfileEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="profile-empty-state">
      <span aria-hidden="true">{icon}</span>
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
