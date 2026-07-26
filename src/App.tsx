import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import AuthScreen from './components/AuthScreen'
import ProfileScreen from './components/profile/ProfileScreen'
import PetsScreen from './components/my-pet/PetsScreen'
import PetCreateFlow from './components/my-pet/PetCreateFlow'
import DiaryPage from './components/diary/DiaryScreen'
import MapScreen from './components/hospital-map/MapScreen'
import { QnaCreateFlow, QnaScreen } from './components/qna/QnaScreen'
import { deleteAppData, loadAppData, saveAppData } from './lib/appData'
import { supabase } from './lib/supabase'
import { animalCategoryLabels, animalCategoryOptions, CategoryTagIcon, normalizePet, petSpeciesOptions, readSavedHospitalSnapshots, readStoredReviews } from './components/hospital-map/mapDependencies'
import type { AnimalCategory, AppProfile, CreateMode, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost, Tab } from './types/app'
export type { AppProfile, DraftItem, HospitalReview, HospitalSnapshot, Pet, QnaPost } from './types/app'

const LOCAL_DRAFTS_KEY_PREFIX = 'exocare:drafts'

function localDraftsKey(userId: string) {
  return `${LOCAL_DRAFTS_KEY_PREFIX}:${userId}`
}

function readLocalDrafts(userId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(localDraftsKey(userId)) ?? '[]')
    return Array.isArray(value) ? value as DraftItem[] : []
  } catch {
    return []
  }
}

function writeLocalDrafts(userId: string, items: DraftItem[]) {
  localStorage.setItem(localDraftsKey(userId), JSON.stringify(items))
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pets', label: '\uB9C8\uC774 \uD3AB' },
  { id: 'diary', label: '\uB2E4\uC774\uC5B4\uB9AC' },
  { id: 'map', label: '\uBCD1\uC6D0 \uCC3E\uAE30' },
  { id: 'qna', label: 'Q&A' },
]

const qnaTable = ['comm', 'unity_posts'].join('')
const qnaDatabaseCategory = ['Q', '&A'].join('')

function readInitialUrlState() {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') as Tab | null
  const petId = params.get('petId')
  const allowedTabs: Tab[] = ['pets', 'diary', 'map', 'qna', 'profile']
  return {
    tab: tab && allowedTabs.includes(tab) ? tab : petId ? 'diary' as Tab : 'map' as Tab,
    petId,
  }
}

function syncAppUrl(tab: Tab, petId?: string | null) {
  const params = new URLSearchParams(window.location.search)
  params.set('tab', tab)
  if (petId) params.set('petId', petId)
  else params.delete('petId')
  const next = `${window.location.pathname}?${params.toString()}${window.location.hash}`
  window.history.replaceState(window.history.state, '', next)
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!authReady) return <main className="auth-screen"><p className="auth-loading">濡쒓렇???곹깭瑜??뺤씤?섍퀬 ?덉뒿?덈떎.</p></main>
  if (!session) return <AuthScreen />
  return <AuthenticatedApp session={session} />
}

function AuthenticatedApp({ session }: { session: Session }) {
  const initialUrlState = useMemo(() => readInitialUrlState(), [])
  const [activeTab, setActiveTab] = useState<Tab>(initialUrlState.tab)
  const [sideNavOpen, setSideNavOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [qnaOpenId, setQnaOpenId] = useState<string | null>(null)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [diaryPetId, setDiaryPetId] = useState<string | null>(initialUrlState.petId)
  const [diaryReadOnly, setDiaryReadOnly] = useState(false)
  const [qnaInitialPetId, setQnaInitialPetId] = useState<string | null>(initialUrlState.tab === 'qna' ? initialUrlState.petId : null)
  const [editingDraft, setEditingDraft] = useState<DraftItem | null>(null)
  const [mapFocusHospital, setMapFocusHospital] = useState<HospitalSnapshot | null>(null)
  const [currentPetId, setCurrentPetId] = useState<string | null>(initialUrlState.petId)
  const [pets, setPets] = useState<Pet[]>([])
  const [qnaPosts, setQnaPosts] = useState<QnaPost[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [hospitalReviews, setHospitalReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const [likedHospitals, setLikedHospitals] = useState<HospitalSnapshot[]>(() => readSavedHospitalSnapshots())
  const [profile, setProfile] = useState<AppProfile>({ username: '', nickname: '', avatarUrl: '' })
  const [dataError, setDataError] = useState('')
  const bottomNavDragStartRef = useRef<number | null>(null)
  const suppressNextBottomNavClickRef = useRef(false)
  const previousContentTabRef = useRef<Tab>(initialUrlState.tab === 'profile' ? 'map' : initialUrlState.tab)
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setPets([])
      setQnaPosts([])
      setDrafts([])
      setHospitalReviews(readStoredReviews())
      setLikedHospitals(readSavedHospitalSnapshots())
      setProfile({ username: '', nickname: '', avatarUrl: '' })
      setCreateMode(null)
      setEditingPet(null)
      setEditingDraft(null)
      setQnaOpenId(null)
      setDiaryPetId(initialUrlState.petId)
      setCurrentPetId(initialUrlState.petId)
      setQnaInitialPetId(initialUrlState.tab === 'qna' ? initialUrlState.petId : null)
      setDiaryReadOnly(false)
      setDataError('')
    })
    const loadMine = async <T,>(table: string) => loadAppData<T>(table, { userId: session.user.id, scope: 'mine' })
    const loadAll = async <T,>(table: string, options: { includeViewCount?: boolean } = {}) => loadAppData<T>(table, { userId: session.user.id, scope: 'all', ...options })
    const loadOptionalAll = async <T,>(table: string, options: { includeViewCount?: boolean } = {}) => loadAll<T>(table, options).catch((error) => {
      console.warn(`Optional public data load failed: ${table}`, error)
      return [] as T[]
    })
    const loadOptionalMine = async <T,>(table: string) => loadMine<T>(table).catch((error) => {
      console.warn(`Optional data load failed: ${table}`, error)
      return [] as T[]
    })

    Promise.all([
      loadMine<Pet>('pets'),
      loadOptionalAll<QnaPost>(qnaTable, { includeViewCount: true }),
      loadOptionalMine<DraftItem>('drafts').then((items) => {
        const localItems = readLocalDrafts(session.user.id)
        const merged = [...items, ...localItems.filter((local) => !items.some((item) => item.id === local.id))]
        writeLocalDrafts(session.user.id, merged)
        return merged
      }).catch(() => readLocalDrafts(session.user.id)),
    ]).then(([nextPets, nextPosts, nextDrafts]) => {
      if (!active) return
      setPets(nextPets.map(normalizePet))
      setQnaPosts(nextPosts)
      setDrafts(nextDrafts)
    }).catch((error) => {
      if (!active) return
      console.error('Initial data load failed:', error)
      setDataError('?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?덈줈怨좎묠?댁＜?몄슂.')
    })
    return () => { active = false }
  }, [initialUrlState.petId, initialUrlState.tab, session.user.id])

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('username, nickname, avatar_url')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setDataError('?꾨줈???뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??')
          return
        }
        setProfile({
          username: String(data?.username ?? session.user.user_metadata?.username ?? ''),
          nickname: String(data?.nickname ?? session.user.user_metadata?.nickname ?? ''),
          avatarUrl: String(data?.avatar_url ?? ''),
        })
      })
    return () => { active = false }
  }, [session.user.id, session.user.user_metadata])

  const moveTab = (tab: Tab) => {
    if (tab !== 'profile') previousContentTabRef.current = tab
    setActiveTab(tab)
    syncAppUrl(tab, tab === 'diary' ? diaryPetId ?? currentPetId : null)
    if (tab !== 'diary') {
      setDiaryPetId(null)
      setDiaryReadOnly(false)
    }
    if (tab !== 'qna') setQnaInitialPetId(null)
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const toggleProfileTab = () => {
    if (activeTab === 'profile') {
      moveTab(previousContentTabRef.current)
      return
    }
    previousContentTabRef.current = activeTab
    moveTab('profile')
  }

  const beginBottomNavDrag = (event: { clientY: number; currentTarget: { setPointerCapture?: (pointerId: number) => void }; pointerId: number }) => {
    if (activeTab !== 'map') return
    bottomNavDragStartRef.current = event.clientY
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveBottomNavDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (activeTab !== 'map' || bottomNavDragStartRef.current === null) return
    const dragY = event.clientY - bottomNavDragStartRef.current
    if (dragY < -12) event.preventDefault()
  }

  const finishBottomNavDrag = (event: { clientY: number; preventDefault: () => void }) => {
    if (activeTab !== 'map' || bottomNavDragStartRef.current === null) return
    const dragY = event.clientY - bottomNavDragStartRef.current
    bottomNavDragStartRef.current = null
    if (dragY > -42) return
    suppressNextBottomNavClickRef.current = true
    event.preventDefault()
    window.dispatchEvent(new CustomEvent('map-bottom-nav-swipe-up'))
    window.setTimeout(() => {
      suppressNextBottomNavClickRef.current = false
    }, 0)
  }

  const openHospitalOnMap = (hospital: HospitalSnapshot) => {
    setMapFocusHospital(hospital)
    moveTab('map')
  }

  const savePet = async (pet: Pet) => {
    setPets((items) => [pet, ...items.filter((item) => item.id !== pet.id)])
    setCurrentPetId(pet.id)
    try {
      await saveAppData('pets', session.user.id, pet, {
        name: pet.name, species: pet.species, category: pet.group,
        gender: pet.gender, photo_url: pet.photo ?? null,
      })
    } catch (error) {
      console.error('Supabase pet save failed; kept local state.', error)
    }
  }

  const deletePet = async (petId: string) => {
    try {
      await deleteAppData('pets', petId)
      setPets((items) => {
        const next = items.filter((item) => item.id !== petId)
        if (currentPetId === petId) setCurrentPetId(next[0]?.id ?? null)
        return next
      })
    } catch {
      setDataError('???뺣낫瑜???젣?섏? 紐삵뻽?듬땲??')
    }
  }

  const openPetDiary = (petId: string) => {
    setCurrentPetId(petId)
    setDiaryPetId(petId)
    setDiaryReadOnly(false)
    syncAppUrl('diary', petId)
    setActiveTab('diary')
    setCreateMode(null)
    setEditingPet(null)
    setEditingDraft(null)
  }

  const openQnaCreate = (petId?: string | null) => {
    const validPetId = petId && pets.some((pet) => pet.id === petId) ? petId : null
    setQnaInitialPetId(validPetId)
    setEditingPet(null)
    setEditingDraft(null)
    setCreateMode('post')
    syncAppUrl('qna', validPetId)
  }

  const saveQnaPost = async (post: QnaPost) => {
    setQnaPosts((items) => [post, ...items.filter((item) => item.id !== post.id)])
    setCreateMode(null)
    try {
      await saveAppData(qnaTable, session.user.id, post, {
        category: qnaDatabaseCategory, title: post.title, body: post.body, view_count: post.viewCount ?? 0,
      })
    } catch (error) {
      console.error('Supabase QNA save failed; kept local state.', error)
    }
  }

  const updateQnaPosts = (next: QnaPost[]) => {
    setQnaPosts(next)
    const changed = next.find((post) => {
      const previous = qnaPosts.find((item) => item.id === post.id)
      return previous && JSON.stringify(previous) !== JSON.stringify(post)
    })
    if (changed) {
      void saveAppData(qnaTable, session.user.id, changed, {
        category: qnaDatabaseCategory, title: changed.title, body: changed.body, view_count: changed.viewCount ?? 0,
      }).catch(() => setDataError('吏덈Ц 蹂寃??댁슜????ν븯吏 紐삵뻽?듬땲??'))
    }
  }

  const deleteQnaPost = async (postId: string) => {
    try {
      await deleteAppData(qnaTable, postId)
      setQnaPosts((items) => items.filter((item) => item.id !== postId))
    } catch {
      setDataError('吏덈Ц????젣?섏? 紐삵뻽?듬땲??')
    }
  }

  const deleteDraft = async (draftId: string) => {
    try {
      await deleteAppData('drafts', draftId)
    } catch (error) {
      console.error('Supabase draft delete failed; deleting local draft.', error)
    }
    const nextDrafts = readLocalDrafts(session.user.id).filter((item) => item.id !== draftId)
    writeLocalDrafts(session.user.id, nextDrafts)
    setDrafts((items) => items.filter((item) => item.id !== draftId))
  }

  const continueDraft = (draft: DraftItem) => {
    setEditingDraft(draft)
    if (draft.draftType === 'question') {
      setCreateMode('post')
      return
    }
    if (draft.draftType === 'pet') {
      setEditingPet(draft.payload as Pet)
      setCreateMode('pet')
      return
    }
    if (draft.draftType === 'care_record' || draft.draftType === 'reminder') {
      setActiveTab('diary')
      setCreateMode(null)
      return
    }
    if (draft.draftType === 'hospital_review') {
      setActiveTab('map')
      setCreateMode(null)
    }
  }

  const openWrittenPost = (kind: 'question', id: string) => {
    setCreateMode(null)
    if (kind === 'question') {
      setActiveTab('qna')
      setQnaOpenId(id)
      return
    }
  }

  const editWrittenPost = (kind: 'question', id: string) => {
    const payload = qnaPosts.find((post) => post.id === id)
    if (!payload) return
    setEditingDraft({
      id,
      draftType: kind,
      title: 'title' in payload ? payload.title : '',
      body: payload.body,
      updatedAt: new Date().toISOString(),
      payload,
    } as DraftItem)
    setCreateMode('post')
  }

  const deleteWrittenPost = (kind: 'question', id: string) => {
    if (kind === 'question') void deleteQnaPost(id)
  }

  const saveProfile = async (nextProfile: AppProfile) => {
    try {
      const normalized = {
        username: nextProfile.username.trim(),
        nickname: nextProfile.nickname.trim(),
        avatarUrl: nextProfile.avatarUrl.trim(),
      }
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username: normalized.username || null,
        nickname: normalized.nickname || null,
        avatar_url: normalized.avatarUrl || null,
      })
      if (error) throw error
      setProfile(normalized)
    } catch {
      setDataError('?꾨줈???뺣낫瑜???ν븯吏 紐삵뻽?듬땲??')
    }
  }

  const deleteAccount = async () => {
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      await supabase.auth.signOut()
    } catch {
      setDataError('怨꾩젙????젣?섏? 紐삵뻽?듬땲?? ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂.')
    }
  }

  if (createMode === 'pet') return (
    <PetCreateFlow
      initialPet={editingDraft?.draftType === 'pet' ? editingDraft.payload as Pet : editingPet}
      initialDraft={editingDraft?.draftType === 'pet' ? editingDraft : null}
      categoryOptions={animalCategoryOptions.filter((item): item is Exclude<AnimalCategory, 'all'> => item !== 'all')}
      categoryLabels={animalCategoryLabels}
      speciesOptions={petSpeciesOptions}
      renderCategoryIcon={(category) => <CategoryTagIcon category={category} />}
      onClose={() => { setCreateMode(null); setEditingPet(null); setEditingDraft(null) }}
      onSave={async (pet) => {
        await savePet(pet)
        if (editingDraft?.draftType === 'pet') await deleteDraft(editingDraft.id)
        setEditingDraft(null)
      }}
      onOpenPlan={(petId) => openPetDiary(petId)}
    />
  )
  if (createMode === 'post') return (
    <QnaCreateFlow
      userId={session.user.id}
      pets={pets}
      author={profile.nickname.trim() || profile.username.trim() || '\uC0AC\uC6A9\uC790'}
      initialPetId={qnaInitialPetId ?? undefined}
      initialDraft={editingDraft?.draftType === 'question' ? editingDraft : null}
      onClose={() => { setCreateMode(null); setEditingDraft(null); setQnaInitialPetId(null) }}
      onSave={async (post) => {
        await saveQnaPost(post)
        if (editingDraft && drafts.some((draft) => draft.id === editingDraft.id)) await deleteDraft(editingDraft.id)
        setEditingDraft(null)
        setQnaInitialPetId(null)
      }}
    />
  )
  return (
    <div className={`app-shell ${activeTab === 'map' ? 'map-shell' : ''}`}>
      <button
        className="menu-trigger"
        type="button"
        aria-label="硫붾돱 ?닿린"
        aria-expanded={sideNavOpen}
        onClick={() => setSideNavOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {activeTab !== 'map' && (
        <button
          className={`mobile-profile-button ${activeTab === 'profile' ? 'active' : ''}`}
          type="button"
          aria-label="?꾨줈???닿린"
          onClick={toggleProfileTab}
        >
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{(profile.nickname || profile.username || 'ME').slice(0, 2).toUpperCase()}</span>}
        </button>
      )}
      <button
        className={`side-nav-dim ${sideNavOpen ? 'open' : ''}`}
        type="button"
        aria-label="硫붾돱 ?リ린"
        onClick={() => setSideNavOpen(false)}
      />
      <aside className={`side-nav ${sideNavOpen ? 'open' : ''}`}>
        <nav>
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => { moveTab(tab.id); setSideNavOpen(false) }}>
              <span className={`side-nav-icon ${tab.id}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
        <button className={`side-nav-profile ${activeTab === 'profile' ? 'active' : ''}`} type="button" onClick={() => { toggleProfileTab(); setSideNavOpen(false) }}>
          <span className="side-nav-icon profile" aria-hidden="true" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      {activeTab !== 'qna' && <header className="top-bar">
        <div>
           <h1>{activeTab === 'profile' ? '\uD504\uB85C\uD544' : tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>}

      {activeTab === 'map' && <main className="app-main"><MapScreen userId={session.user.id} profile={profile} pets={pets} initialPetId={currentPetId ?? undefined} focusHospital={mapFocusHospital} reviewDraft={editingDraft?.draftType === 'hospital_review' ? editingDraft : null} reviews={hospitalReviews} likedHospitals={likedHospitals} onReviewsChange={setHospitalReviews} onLikedHospitalsChange={setLikedHospitals} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} /></main>}

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen userId={session.user.id} pets={pets} onDeletePet={deletePet} onEditPet={(pet) => { setEditingPet(pet); setCreateMode('pet') }} onOpenDiary={openPetDiary} onRegisterPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} />}
          {activeTab === 'diary' && <DiaryPage userId={session.user.id} pets={pets} initialPetId={diaryPetId ?? currentPetId ?? undefined} readOnly={diaryReadOnly} onAddPet={() => { setEditingPet(null); setEditingDraft(null); setCreateMode('pet') }} initialDraft={editingDraft?.draftType === 'care_record' || editingDraft?.draftType === 'reminder' ? editingDraft as never : null} onDeleteDraft={async (draftId) => { await deleteDraft(draftId); setEditingDraft(null) }} />}
          {activeTab === 'qna' && <QnaScreen userId={session.user.id} profile={profile} posts={qnaPosts} openPostId={qnaOpenId} onOpenHandled={() => setQnaOpenId(null)} onChange={updateQnaPosts} onDeletePost={deleteQnaPost} onEditPost={(post) => editWrittenPost('question', post.id)} onCreate={(petId) => openQnaCreate(petId)} onOpenHospital={openHospitalOnMap} onOpenDiary={(petId, readOnly) => { setDiaryPetId(petId); setCurrentPetId(petId); setDiaryReadOnly(readOnly); syncAppUrl('diary', petId); setActiveTab('diary') }} />}
          {activeTab === 'profile' && <ProfileScreen key={`${profile.username}-${profile.nickname}-${profile.avatarUrl}`} profile={profile} qnaPosts={qnaPosts} hospitalReviews={hospitalReviews} likedHospitals={likedHospitals} drafts={drafts} onSignOut={() => supabase.auth.signOut()} onDeleteAccount={deleteAccount} onSaveProfile={saveProfile} onDeleteDraft={deleteDraft} onContinueDraft={continueDraft} onOpenWrittenPost={openWrittenPost} onOpenHospital={openHospitalOnMap} onEditWrittenPost={editWrittenPost} onDeleteWrittenPost={deleteWrittenPost} />}
        </main>
      )}

      <nav
        className={`bottom-nav ${activeTab === 'map' ? 'map-bottom-nav' : ''}`}
        onPointerDown={beginBottomNavDrag}
        onPointerMove={moveBottomNavDrag}
        onPointerUp={finishBottomNavDrag}
        onPointerCancel={() => { bottomNavDragStartRef.current = null }}
      >
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={(event) => { if (suppressNextBottomNavClickRef.current) { event.preventDefault(); return } moveTab(tab.id) }}>
            <span className={`bottom-nav-icon side-nav-icon ${tab.id}`} aria-hidden="true" />
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {dataError && <button className="data-error" type="button" onClick={() => setDataError('')}>{dataError}</button>}
    </div>
  )
}

export default App








