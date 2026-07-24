import { type ChangeEvent, useState } from 'react'
import type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, QnaPost } from '../../App'

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value))
}

function draftTypeLabel(type: DraftItem['draftType']) {
  if (type === 'question') return 'Q&A'
  if (type === 'pet') return '마이펫'
  if (type === 'care_record') return '기록'
  if (type === 'reminder') return '알림'
  return '병원 리뷰'
}

function ProfileScreen({
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
}: {
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
}) {
  const [view, setView] = useState<'menu' | 'profile' | 'posts' | 'drafts' | 'liked' | 'logout' | 'delete-account'>('menu')
  const [username, setUsername] = useState(profile.username)
  const [nickname, setNickname] = useState(profile.nickname)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl)
  const [profileSaved, setProfileSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const displayName = profile.nickname || profile.username || '사용자'
  const visibleDrafts = drafts
  const posts: Array<{ id: string; kind: 'question'; type: string; title: string; body: string }> = [
    ...qnaPosts.filter((post) => post.mine === true).map((post) => ({ id: post.id, kind: 'question' as const, type: 'Q&A', title: post.title, body: post.body })),
  ]
  const likedQnaItems = qnaPosts.filter((post) => post.liked).map((post) => ({ id: post.id, kind: 'question' as const, type: 'Q&A', title: post.title, body: post.body }))
  const likedReviewItems = Object.entries(hospitalReviews).flatMap(([hospitalId, reviews]) => reviews.filter((review) => review.liked).map((review) => ({
    id: review.id,
    hospitalId,
    type: '리뷰',
    title: review.hospitalName || review.hospitalSnapshot?.name || '병원 리뷰',
    body: review.body || review.content || '',
    hospital: review.hospitalSnapshot,
  })))
  const likedCount = likedQnaItems.length + likedHospitals.length + likedReviewItems.length
  const attachAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  return (
      <section className="profile-screen">
        <div className="profile-panel-header">
          {view !== 'menu' && <button className="profile-back" type="button" onClick={() => setView('menu')}>{'\uB4A4\uB85C'}</button>}
          <div>
            <h2>{displayName}님</h2>
            <span>프로필</span>
          </div>
        </div>
        {view === 'menu' && (
          <>
            <button type="button" onClick={() => setView('profile')}>&#45236; &#51221;&#48372; &#49688;&#51221;</button>
            <button type="button" onClick={() => setView('posts')}>&#45236;&#44032; &#50420; &#44544;</button>
            <button type="button" onClick={() => setView('drafts')}>{'\uC784\uC2DC\uC800\uC7A5'}<span>{visibleDrafts.length}</span></button>
            <button type="button" onClick={() => setView('liked')}>좋아요한<span>{likedCount}</span></button>
            <button type="button" onClick={() => setView('logout')}>&#47196;&#44536;&#50500;&#50883;</button>
            <button className="danger" type="button" onClick={() => setView('delete-account')}>계정 삭제</button>
          </>
        )}
        {view === 'profile' && (
          <div className="profile-panel-content">
            <label>
              <span>{'\uC544\uC774\uB514'}</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" />
            </label>
            <label>
              <span>{'\uB2C9\uB124\uC784'}</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="nickname" />
            </label>
            <label>
              <span>{'\uD504\uB85C\uD544 \uC0AC\uC9C4'}</span>
              <span className="profile-file-button">사진 선택</span>
              <input type="file" accept="image/*" onChange={attachAvatar} />
            </label>
            {avatarUrl && <img className="profile-avatar-preview" src={avatarUrl} alt="profile preview" />}
            <button type="button" onClick={() => { onSaveProfile({ username, nickname, avatarUrl }); setProfileSaved(true) }}>{'\uC800\uC7A5'}</button>
            {profileSaved && <p>{'\uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.'}</p>}
          </div>
        )}
        {view === 'posts' && (
          <div className="profile-panel-content">
            {posts.length === 0 ? <p>아직 작성한 글이 없습니다.</p> : (
              <div className="profile-list">
                {posts.map((post) => (
                  <article key={`${post.type}-${post.id}`}>
                    <span>{post.type}</span>
                    <strong>{post.title}</strong>
                    <p>{post.body}</p>
                    <div className="profile-row-actions three">
                      <button type="button" onClick={() => onOpenWrittenPost(post.kind, post.id)}>열기</button>
                      <button type="button" onClick={() => onEditWrittenPost(post.kind, post.id)}>수정</button>
                      <button type="button" onClick={() => onDeleteWrittenPost(post.kind, post.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'drafts' && (
          <div className="profile-panel-content">
            {visibleDrafts.length === 0 ? <p>임시저장한 글이 없습니다.</p> : (
              <div className="profile-list">
                {visibleDrafts.map((draft) => (
                  <article key={draft.id}>
                    <span>{draftTypeLabel(draft.draftType)} · {formatReviewDate(draft.updatedAt)}</span>
                    <strong>{draft.title || '제목 없음'}</strong>
                    <p>{draft.body || '내용 없음'}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onContinueDraft(draft)}>이어쓰기</button>
                      <button type="button" onClick={() => onDeleteDraft(draft.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'liked' && (
          <div className="profile-panel-content">
            {likedCount === 0 ? <p>좋아요한 항목이 없습니다.</p> : (
              <div className="profile-list">
                {likedQnaItems.map((item) => (
                  <article key={`liked-${item.kind}-${item.id}`}>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onOpenWrittenPost(item.kind, item.id)}>열기</button>
                    </div>
                  </article>
                ))}
                {likedHospitals.map((hospital) => (
                  <article key={`liked-hospital-${hospital.id ?? hospital.name}`}>
                    <span>병원</span>
                    <strong>{hospital.name}</strong>
                    <p>{hospital.address || '주소 정보 없음'}</p>
                    <div className="profile-row-actions">
                      <button type="button" onClick={() => onOpenHospital(hospital)}>열기</button>
                    </div>
                  </article>
                ))}
                {likedReviewItems.map((review) => (
                  <article key={`liked-review-${review.id}`}>
                    <span>{review.type}</span>
                    <strong>{review.title}</strong>
                    <p>{review.body}</p>
                    {review.hospital && (
                      <div className="profile-row-actions">
                        <button type="button" onClick={() => onOpenHospital(review.hospital!)}>병원 열기</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'logout' && (
          <div className="profile-panel-content">
            <p>현재 계정에서 로그아웃합니다.</p>
            <button type="button" onClick={onSignOut}>&#47196;&#44536;&#50500;&#50883;</button>
          </div>
        )}
        {view === 'delete-account' && (
          <div className="profile-panel-content">
            <div className="profile-danger-box">
              <strong>계정 삭제</strong>
              <p>계정을 삭제하면 프로필, 마이 펫, 기록, 글, 임시저장 데이터가 함께 삭제됩니다.</p>
            </div>
            <label>
              <span>확인 문구</span>
              <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="계정 삭제" />
            </label>
            <button
              className="danger"
              type="button"
              disabled={deleteConfirm !== '계정 삭제' || deletingAccount}
              onClick={async () => {
                setDeletingAccount(true)
                try {
                  await onDeleteAccount()
                } finally {
                  setDeletingAccount(false)
                }
              }}
            >
              {deletingAccount ? '삭제 중...' : '계정 삭제'}
            </button>
          </div>
        )}
      </section>
  )
}


export default ProfileScreen


