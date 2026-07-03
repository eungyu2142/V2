import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import DiaryPage from './features/diary/DiaryPage'

type Tab = 'pets' | 'diary' | 'map' | 'community' | 'share'
type CreateMode = 'pet' | 'post' | 'share' | null
type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian'

type Pet = {
  id: string
  name: string
  group: AnimalCategory
  species: string
  gender: 'male' | 'female' | 'unknown'
}

type CommunityPost = {
  id: string
  category: string
  title: string
  body: string
}

type ShareItem = {
  id: string
  title: string
  area: string
  memo: string
}

type Coordinates = {
  lat: number
  lng: number
}

type Hospital = {
  id: string
  name: string
  address: string
  roadAddress?: string
  phone: string
  link: string
  lat: number
  lng: number
  distanceKm?: number
  categories: Exclude<AnimalCategory, 'all'>[]
  matchedQueries?: string[]
}

type HospitalReview = {
  id: string
  hospitalId: string
  author: string
  rating: number
  body: string
  createdAt: string
}

type NaverMapApi = {
  maps: {
    LatLng: new (latitude: number, longitude: number) => unknown
    Point: new (x: number, y: number) => unknown
    Map: new (element: HTMLElement, options: { center: unknown; zoom: number }) => {
      setCenter: (center: unknown) => void
      setZoom: (zoom: number) => void
    }
    Marker: new (options: { position: unknown; map: unknown; title?: string; icon?: string | { content: string } }) => {
      setMap: (map: unknown | null) => void
    }
    Event: {
      addListener: (target: unknown, eventName: string, listener: () => void) => void
    }
    TransCoord?: {
      fromTM128ToLatLng: (point: unknown) => { lat: () => number; lng: () => number }
    }
  }
}

declare global {
  interface Window {
    naver?: NaverMapApi
  }
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'pets', label: '마이 펫' },
  { id: 'diary', label: '기록' },
  { id: 'map', label: '지도' },
  { id: 'community', label: '커뮤니티' },
  { id: 'share', label: '나눔' },
]

const animalCategoryOptions: AnimalCategory[] = ['reptile', 'bird', 'rodent', 'amphibian', 'all']
const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
}

const animalCategorySearchTerms: Record<AnimalCategory, string> = {
  all: '특수동물병원',
  reptile: '파충류 동물병원',
  bird: '조류 동물병원',
  rodent: '설치류 동물병원',
  amphibian: '양서류 동물병원',
}

const animalCategoryKeywords: Record<Exclude<AnimalCategory, 'all'>, string[]> = {
  reptile: ['파충류', '도마뱀', '게코', '거북', '거북이', '뱀', '이구아나', '카멜레온', '비어디'],
  bird: ['조류', '앵무새', '새', '카나리아', '문조', '잉꼬', '코뉴어'],
  rodent: ['설치류', '햄스터', '기니피그', '친칠라', '고슴도치', '토끼', '페럿', '데구', '저빌'],
  amphibian: ['양서류', '개구리', '팩맨', '도롱뇽', '뉴트', '살라만더', '아홀로틀'],
}

const reviewStorageKey = 'exocare-hospital-reviews'
const petsStorageKey = 'exocare-pets'
const postsStorageKey = 'exocare-community-posts'
const shareStorageKey = 'exocare-share-items'
let naverMapsLoader: Promise<NaverMapApi> | null = null

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [profileOpen, setProfileOpen] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode>(null)
  const [pets, setPets] = useState<Pet[]>(() => readStoredList<Pet>(petsStorageKey))
  const [posts, setPosts] = useState<CommunityPost[]>(() => readStoredList<CommunityPost>(postsStorageKey))
  const [shareItems, setShareItems] = useState<ShareItem[]>(() => readStoredList<ShareItem>(shareStorageKey))

  const moveTab = (tab: Tab) => {
    setActiveTab(tab)
    setCreateMode(null)
  }

  const savePet = (pet: Pet) => {
    setPets((items) => {
      const next = [pet, ...items.filter((item) => item.id !== pet.id)]
      localStorage.setItem(petsStorageKey, JSON.stringify(next))
      return next
    })
    setCreateMode(null)
  }

  const deletePet = (petId: string) => {
    setPets((items) => {
      const next = items.filter((item) => item.id !== petId)
      localStorage.setItem(petsStorageKey, JSON.stringify(next))
      return next
    })
  }

  const savePost = (post: CommunityPost) => {
    setPosts((items) => {
      const next = [post, ...items.filter((item) => item.id !== post.id)]
      localStorage.setItem(postsStorageKey, JSON.stringify(next))
      return next
    })
    setCreateMode(null)
  }

  const deletePost = (postId: string) => {
    setPosts((items) => {
      const next = items.filter((item) => item.id !== postId)
      localStorage.setItem(postsStorageKey, JSON.stringify(next))
      return next
    })
  }

  const saveShareItem = (item: ShareItem) => {
    setShareItems((items) => {
      const next = [item, ...items.filter((shareItem) => shareItem.id !== item.id)]
      localStorage.setItem(shareStorageKey, JSON.stringify(next))
      return next
    })
    setCreateMode(null)
  }

  const deleteShareItem = (itemId: string) => {
    setShareItems((items) => {
      const next = items.filter((item) => item.id !== itemId)
      localStorage.setItem(shareStorageKey, JSON.stringify(next))
      return next
    })
  }

  if (createMode === 'pet') return <PetCreateFlow onClose={() => setCreateMode(null)} onSave={savePet} />
  if (createMode === 'post') return <PostCreateFlow onClose={() => setCreateMode(null)} onSave={savePost} />
  if (createMode === 'share') return <ShareCreateFlow onClose={() => setCreateMode(null)} onSave={saveShareItem} />

  return (
    <div className={`app-shell ${activeTab === 'map' ? 'map-shell' : ''}`}>
      <aside className="side-nav">
        <nav>
          {tabs.map((tab) => (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => moveTab(tab.id)}>
              <span className={`side-nav-icon ${tab.id}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="side-nav-profile" type="button" onClick={() => setProfileOpen(true)}>
          <span className="side-nav-icon profile" aria-hidden="true" />
          <span>&#54532;&#47196;&#54596;</span>
        </button>
      </aside>

      <header className="top-bar">
        <div>
          <span>SPECIAL ANIMAL CARE PWA</span>
          <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'pets' && <Placeholder title="마이 펫" body="펫 등록 플로우를 이 화면에 이어서 붙이면 됩니다." />}
        {activeTab === 'diary' && <Placeholder title="기록" body="캘린더와 동물 기록을 이 화면에 이어서 붙이면 됩니다." />}
        {activeTab === 'community' && <Placeholder title="커뮤니티" body="QNA와 댓글 기능을 이 화면에 이어서 붙이면 됩니다." />}
        {activeTab === 'share' && <Placeholder title="나눔" body="나눔 글 목록과 작성 기능을 이 화면에 이어서 붙이면 됩니다." />}
      </main>

      {activeTab !== 'map' && (
        <main className="app-main">
          {activeTab === 'pets' && <PetsScreen pets={pets} onDeletePet={deletePet} />}
          {activeTab === 'diary' && <DiaryPage />}
          {activeTab === 'community' && <CommunityScreen posts={posts} onDeletePost={deletePost} />}
          {activeTab === 'share' && <ShareScreen items={shareItems} onDeleteItem={deleteShareItem} />}
        </main>
      )}

      {activeTab !== 'map' && activeTab !== 'diary' && (
        <button className="app-fab" type="button" aria-label="작성" onClick={() => setCreateMode(activeTab === 'pets' ? 'pet' : activeTab === 'community' ? 'post' : 'share')}>
          +
        </button>
      )}

      <nav className="bottom-nav">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} type="button" onClick={() => moveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {profileOpen && <ProfilePanel onClose={() => setProfileOpen(false)} />}
    </div>
  )
}

function ProfilePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay">
      <button className="overlay-dim" type="button" onClick={onClose} aria-label="close" />
      <section className="profile-panel">
        <h2>&#54532;&#47196;&#54596;</h2>
        <button type="button">&#45236; &#51221;&#48372; &#49688;&#51221;</button>
        <button type="button">&#45236;&#44032; &#50420; &#44544;</button>
        <button type="button">&#51200;&#51109;&#54620; &#48337;&#50896;</button>
        <button type="button">&#47196;&#44536;&#50500;&#50883;</button>
      </section>
    </div>
  )
}

function MapScreen() {
  const naverMapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<AnimalCategory>('all')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>(naverMapClientId ? 'loading' : 'error')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(naverMapClientId ? '' : '.env.local의 VITE_NAVER_MAP_CLIENT_ID를 확인해주세요.')
  const [reviewPanelHospitalId, setReviewPanelHospitalId] = useState<string | null>(null)
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false)
  const [reviewAuthor, setReviewAuthor] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviews, setReviews] = useState<Record<string, HospitalReview[]>>(() => readStoredReviews())
  const mapElementRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<InstanceType<NaverMapApi['maps']['Map']> | null>(null)
  const markersRef = useRef<Array<InstanceType<NaverMapApi['maps']['Marker']>>>([])
  const currentLocationMarkerRef = useRef<InstanceType<NaverMapApi['maps']['Marker']> | null>(null)

  const sortedHospitals = useMemo(() => sortHospitalsByDistance(hospitals, currentLocation), [hospitals, currentLocation])
  const filteredHospitals = useMemo(() => {
    return sortedHospitals.filter((hospital) => selectedCategory === 'all' || hospital.categories.includes(selectedCategory))
  }, [selectedCategory, sortedHospitals])
  const selectedHospital = filteredHospitals.find((hospital) => hospital.id === selectedHospitalId) ?? null
  const selectedHospitalReviews = selectedHospital ? reviews[selectedHospital.id] ?? [] : []
  const isReviewPanelOpen = Boolean(selectedHospital && reviewPanelHospitalId === selectedHospital.id)

  useEffect(() => {
    if (!naverMapClientId) return

    let mounted = true
    loadNaverMaps(naverMapClientId)
      .then((naver) => {
        if (!mounted || !mapElementRef.current) return
        const center = new naver.maps.LatLng(37.5665, 126.978)
        mapInstanceRef.current = new naver.maps.Map(mapElementRef.current, { center, zoom: 12 })
        setMapStatus('ready')
      })
      .catch((error) => {
        console.error('Naver map load error:', error)
        if (!mounted) return
        setMapStatus('error')
        setMessage('지도를 불러오지 못했습니다. 네이버 콘솔의 Web 서비스 URL에 http://127.0.0.1:5173 을 등록했는지 확인해주세요.')
      })

    return () => {
      mounted = false
      markersRef.current.forEach((marker) => marker.setMap(null))
      currentLocationMarkerRef.current?.setMap(null)
    }
  }, [naverMapClientId])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    if (!naver || !map || !currentLocation) return

    const position = new naver.maps.LatLng(currentLocation.lat, currentLocation.lng)
    currentLocationMarkerRef.current?.setMap(null)
    currentLocationMarkerRef.current = new naver.maps.Marker({
      position,
      map,
      title: '내 위치',
      icon: { content: '<div class="current-location-marker" aria-label="내 위치"><span></span></div>' },
    })
    map.setCenter(position)
    map.setZoom(14)
  }, [currentLocation])

  useEffect(() => {
    const naver = window.naver
    const map = mapInstanceRef.current
    if (!naver || !map) return

    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    filteredHospitals.forEach((hospital) => {
      const position = new naver.maps.LatLng(hospital.lat, hospital.lng)
      const marker = new naver.maps.Marker({
        position,
        map,
        title: hospital.name,
        icon: { content: hospitalMarkerContent(hospital, hospital.id === selectedHospitalId, selectedHospitalReviews.length >= 5) },
      })
      naver.maps.Event.addListener(marker, 'click', () => {
        setSelectedHospitalId(hospital.id)
        setReviewPanelHospitalId(null)
        map.setCenter(position)
        map.setZoom(16)
      })
      markersRef.current.push(marker)
    })
  }, [filteredHospitals, selectedHospitalId, selectedHospitalReviews.length])

  const getCurrentLocation = (moveMap = true) => new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      reject(new Error('Geolocation is unavailable.'))
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setCurrentLocation(location)
        setLocationStatus('ready')
        if (!moveMap) resolve(location)
        else resolve(location)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocationStatus('error')
        reject(error)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    )
  })

  const requestCurrentLocation = async () => {
    await getCurrentLocation(true).catch(() => {
      setMessage('현재 위치를 가져올 수 없어요. 브라우저 위치 권한을 확인해주세요.')
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return

    setIsLoading(true)
    setSelectedHospitalId(null)
    setReviewPanelHospitalId(null)
    setMessage('병원을 검색하는 중이에요.')

    const location = currentLocation ?? await getCurrentLocation(false).catch(() => null)

    try {
      const results = await searchHospitals(buildHospitalSearchQuery(query, selectedCategory), selectedCategory, location)
      setHospitals(results)
      setMessage(results.length > 0 ? `가까운 병원 ${results.length}곳을 찾았어요.` : '검색 결과가 없어요. 검색어를 바꿔보세요.')
    } catch (error) {
      console.error('Hospital search error:', error)
      setMessage(error instanceof Error ? error.message : '병원 검색 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedHospital || reviewBody.trim().length === 0) return

    const review: HospitalReview = {
      id: crypto.randomUUID(),
      hospitalId: selectedHospital.id,
      author: reviewAuthor.trim() || '익명',
      rating: reviewRating,
      body: reviewBody.trim(),
      createdAt: new Date().toISOString(),
    }

    setReviews((previous) => {
      const next = { ...previous, [selectedHospital.id]: [review, ...(previous[selectedHospital.id] ?? [])] }
      localStorage.setItem(reviewStorageKey, JSON.stringify(next))
      return next
    })
    setReviewAuthor('')
    setReviewRating(5)
    setReviewBody('')
    setIsReviewFormOpen(false)
  }

  return (
    <section className="map-page">
      <form className="map-search-panel" onSubmit={submit}>
        <label>
          병원 검색
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명, 병원명, 특수동물 병원" />
        </label>
        <button className="secondary-button" type="button" disabled={locationStatus === 'loading'} onClick={requestCurrentLocation}>
          {locationStatus === 'loading' ? '확인중' : '내 위치'}
        </button>
        <button type="submit" disabled={isLoading}>{isLoading ? '검색 중' : '검색'}</button>
      </form>

      <div className="map-category-tags" aria-label="동물 분류 필터">
        {animalCategoryOptions.map((category) => (
          <button
            className={selectedCategory === category ? 'active' : ''}
            key={category}
            type="button"
            onClick={() => {
              setSelectedCategory(category)
              setSelectedHospitalId(null)
            }}
          >
            <CategoryTagIcon category={category} />
            <span>{animalCategoryLabels[category]}</span>
          </button>
        ))}
      </div>

      <section className="map-area">
        <div className="map-canvas" ref={mapElementRef}>
          {mapStatus !== 'ready' && (
            <span>{mapStatus === 'error' ? '지도를 불러오지 못했습니다' : '네이버 지도를 불러오는 중입니다'}</span>
          )}
        </div>
        {message && <p className={`status-copy ${mapStatus === 'error' ? 'error' : ''}`}>{message}</p>}
        {selectedHospital && (
          <article className="map-hospital-panel">
            <button className="panel-close" type="button" aria-label="닫기" onClick={() => setSelectedHospitalId(null)} />
            <div className="hospital-card-main">
              <CategoryTagIcon category={selectedHospital.categories[0] ?? 'all'} />
              <div>
                <strong>{selectedHospital.name}</strong>
                <p><span className="meta-icon location" aria-hidden="true" />{selectedHospital.address || '주소 정보 없음'}</p>
                <small><span className="meta-icon distance" aria-hidden="true" />{selectedHospital.distanceKm === undefined ? '내 위치 기준 거리 계산 전' : `내 위치에서 ${selectedHospital.distanceKm.toFixed(1)}km`}</small>
                <small><span className="meta-icon phone" aria-hidden="true" />{selectedHospital.phone || '전화번호 없음'}</small>
              </div>
            </div>
            <div className="hospital-tags">
              {selectedHospital.categories.map((category) => <span key={category}>{animalCategoryLabels[category]}</span>)}
            </div>
            <div className="hospital-actions">
              <button type="button" onClick={() => setReviewPanelHospitalId(selectedHospital.id)}>리뷰 보기</button>
              {selectedHospital.phone && <a href={`tel:${selectedHospital.phone}`}>전화하기</a>}
            </div>
            {isReviewPanelOpen && (
              <section className="hospital-review-panel">
                <div className="review-panel-head">
                  <div><strong>리뷰</strong><span>{selectedHospitalReviews.length}개</span></div>
                  <button className="review-add-button" type="button" aria-label="리뷰 작성" onClick={() => setIsReviewFormOpen((value) => !value)} />
                </div>
                {isReviewFormOpen && (
                  <form className="review-form" onSubmit={submitReview}>
                    <div className="review-form-row">
                      <input value={reviewAuthor} onChange={(event) => setReviewAuthor(event.target.value)} placeholder="닉네임" />
                      <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                        {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}점</option>)}
                      </select>
                    </div>
                    <textarea value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} placeholder="방문 경험을 남겨주세요." />
                    <button type="submit" disabled={reviewBody.trim().length === 0}>등록</button>
                  </form>
                )}
                {selectedHospitalReviews.length === 0 ? (
                  <p className="review-empty">아직 리뷰가 없어요. + 버튼으로 첫 리뷰를 남겨주세요.</p>
                ) : (
                  <div className="review-list">
                    {selectedHospitalReviews.map((review) => (
                      <article className="review-item" key={review.id}>
                        <div><strong>{review.author}</strong><span>{review.rating}점</span></div>
                        <p>{review.body}</p>
                        <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </article>
        )}
      </section>
    </section>
  )
}

function Placeholder({ title, body }: { title: string; body: string }) {
  void title
  void body
  return null
}

function PetsScreen({ pets, onDeletePet }: { pets: Pet[]; onDeletePet: (petId: string) => void }) {
  return (
    <section className="page-stack">
      <section className="section-block my-pet-section">
        <div className="section-title"><h2>마이 펫</h2><span>{pets.length}마리</span></div>
        {pets.length === 0 ? null : (
          <div className="pet-list">
            {pets.map((pet) => (
              <article className="pet-card" key={pet.id}>
                <div className="pet-card-icon"><CategoryTagIcon category={pet.group} /></div>
                <div className="pet-card-main">
                  <strong>{pet.name}</strong>
                  <small>{animalCategoryLabels[pet.group]} · {pet.species} · {genderLabel(pet.gender)}</small>
                </div>
                <ItemActions onDelete={() => onDeletePet(pet.id)} />
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function CommunityScreen({ posts, onDeletePost }: { posts: CommunityPost[]; onDeletePost: (postId: string) => void }) {
  return (
    <section className="page-stack">
      <section className="section-block">
        <div className="section-title"><h2>커뮤니티</h2><span>{posts.length}개</span></div>
        {posts.length === 0 ? null : (
          <div className="result-list">
            {posts.map((post) => (
              <article className="post-card" key={post.id}>
                <div className="post-card-head"><span>{post.category}</span><ItemActions onDelete={() => onDeletePost(post.id)} /></div>
                <strong>{post.title}</strong>
                <p>{post.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function ShareScreen({ items, onDeleteItem }: { items: ShareItem[]; onDeleteItem: (itemId: string) => void }) {
  return (
    <section className="page-stack">
      <section className="section-block">
        <div className="section-title"><h2>나눔</h2><span>{items.length}개</span></div>
        {items.length === 0 ? null : (
          <div className="result-list">
            {items.map((item) => (
              <article className="post-card" key={item.id}>
                <div className="post-card-head"><span>{item.area}</span><ItemActions onDelete={() => onDeleteItem(item.id)} /></div>
                <strong>{item.title}</strong>
                <p>{item.memo}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function ItemActions({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="item-actions">
      <button className="item-action-button danger" type="button" aria-label="삭제" onClick={onDelete}>
        <span className="item-action-icon delete" aria-hidden="true" />
      </button>
    </div>
  )
}

function PetCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (pet: Pet) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<AnimalCategory>('reptile')
  const [species, setSpecies] = useState('')
  const [gender, setGender] = useState<Pet['gender']>('unknown')
  const canNext = step === 0 ? name.trim().length > 0 : step === 2 ? species.trim().length > 0 : true
  const finish = () => onSave({ id: crypto.randomUUID(), name: name.trim(), group, species: species.trim(), gender })

  return (
    <StepShell title="펫 등록" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepText label="이름" value={name} onChange={setName} placeholder="예: 레오" />}
      {step === 1 && <StepSelect label="분류" value={group} options={animalCategoryOptions.filter((category) => category !== 'all')} labels={animalCategoryLabels} onChange={(value) => setGroup(value as AnimalCategory)} />}
      {step === 2 && <StepText label="종" value={species} onChange={setSpecies} placeholder="예: 레오파드게코" />}
      {step === 3 && <StepSelect label="성별" value={gender} options={['male', 'female', 'unknown']} labels={{ male: '수컷', female: '암컷', unknown: '미구분' }} onChange={(value) => setGender(value as Pet['gender'])} />}
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 3 ? finish : () => setStep((value) => value + 1)}>{step === 3 ? '저장' : '다음'}</button>
    </StepShell>
  )
}

function PostCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (post: CommunityPost) => void }) {
  const [step, setStep] = useState(0)
  const [category, setCategory] = useState('Q&A')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const canNext = step === 1 ? title.trim().length > 0 : step === 2 ? body.trim().length > 0 : true
  const finish = () => onSave({ id: crypto.randomUUID(), category, title: title.trim(), body: body.trim() })

  return (
    <StepShell title="글 작성" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepSelect label="카테고리" value={category} options={['Q&A', '일상', '정보']} onChange={setCategory} />}
      {step === 1 && <StepText label="제목" value={title} onChange={setTitle} placeholder="제목 입력" />}
      {step === 2 && <StepTextarea label="내용" value={body} onChange={setBody} placeholder="내용 입력" />}
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 2 ? finish : () => setStep((value) => value + 1)}>{step === 2 ? '등록' : '다음'}</button>
    </StepShell>
  )
}

function ShareCreateFlow({ onClose, onSave }: { onClose: () => void; onSave: (item: ShareItem) => void }) {
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [memo, setMemo] = useState('')
  const canNext = step === 0 ? title.trim().length > 0 : step === 1 ? area.trim().length > 0 : memo.trim().length > 0
  const finish = () => onSave({ id: crypto.randomUUID(), title: title.trim(), area: area.trim(), memo: memo.trim() })

  return (
    <StepShell title="나눔 등록" onBack={step === 0 ? onClose : () => setStep((value) => value - 1)}>
      {step === 0 && <StepText label="머리글" value={title} onChange={setTitle} placeholder="나눔할 물품" />}
      {step === 1 && <StepText label="지역" value={area} onChange={setArea} placeholder="예: 서울 강남" />}
      {step === 2 && <StepTextarea label="메모" value={memo} onChange={setMemo} placeholder="상태, 나눔 방식" />}
      <button className="step-primary" type="button" disabled={!canNext} onClick={step === 2 ? finish : () => setStep((value) => value + 1)}>{step === 2 ? '등록' : '다음'}</button>
    </StepShell>
  )
}

function StepShell({ title, children, onBack }: { title: string; children: ReactNode; onBack: () => void }) {
  return (
    <main className="step-screen">
      <header className="step-header">
        <button className="back" type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>{title}</strong>
      </header>
      <section className="step-card">{children}</section>
    </main>
  )
}

function StepText({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function StepTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="step-field"><span>{label}</span><textarea autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
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

function CategoryTagIcon({ category }: { category: AnimalCategory }) {
  if (category === 'all') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="16" r="6" />
        <circle cx="32" cy="16" r="6" />
        <circle cx="16" cy="32" r="6" />
        <circle cx="32" cy="32" r="6" />
      </svg>
    )
  }

  if (category === 'reptile') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M28 8c7 0 11 5 9 12-2 8-9 11-17 10-5-.6-8-3.5-8-7.5 0-3.4 2.3-5.8 5.5-5.8 2.8 0 4.8 1.8 4.8 4.1" />
        <path d="M17 30c-6 2-9 6-9 11 9 1 15-2 18-9" />
        <path d="M16 20l-5-5M16 25l-6 1M23 31l-1 7M28 29l5 5M34 20l5-1" />
        <circle cx="30" cy="14" r="1.2" />
      </svg>
    )
  }

  if (category === 'rodent') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="13" r="7" />
        <circle cx="32" cy="13" r="7" />
        <path d="M9 27c0-10 7-17 15-17s15 7 15 17c0 8-6 13-15 13S9 35 9 27Z" />
        <circle cx="18" cy="27" r="1.5" />
        <circle cx="30" cy="27" r="1.5" />
        <path d="M24 31v3M14 32H6M16 36l-8 4M34 32h8M32 36l8 4" />
      </svg>
    )
  }

  if (category === 'amphibian') {
    return (
      <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="16" cy="12" r="5" />
        <circle cx="32" cy="12" r="5" />
        <path d="M10 27c0-10 6-16 14-16s14 6 14 16c0 8-5 13-14 13S10 35 10 27Z" />
        <circle cx="16" cy="12" r="1.2" />
        <circle cx="32" cy="12" r="1.2" />
        <path d="M18 28c3 3 9 3 12 0M12 34l-5 5M36 34l5 5M14 23l-6 1M34 23l6 1" />
      </svg>
    )
  }

  return (
    <svg className="category-tag-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 31c6-12 14-19 24-21 1 8-2 16-8 21-5 4-11 5-16 0Z" />
      <path d="M28 12l9 5-7 3M21 34v8M28 32l4 9M15 40h10M27 40h9" />
      <circle cx="31" cy="15" r="1.2" />
    </svg>
  )
}

function loadNaverMaps(clientId: string) {
  if (window.naver?.maps) return Promise.resolve(window.naver)
  if (naverMapsLoader) return naverMapsLoader

  naverMapsLoader = new Promise<NaverMapApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-naver-map-sdk="true"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => window.naver ? resolve(window.naver) : reject(new Error('Naver Maps SDK is unavailable.')), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`
    script.async = true
    script.dataset.naverMapSdk = 'true'
    script.addEventListener('load', () => window.naver ? resolve(window.naver) : reject(new Error('Naver Maps SDK is unavailable.')), { once: true })
    script.addEventListener('error', () => reject(new Error('Naver Maps SDK failed to load.')), { once: true })
    document.head.appendChild(script)
  })

  return naverMapsLoader
}

async function searchHospitals(query: string, category: AnimalCategory, location: Coordinates | null) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (supabaseUrl && publishableKey && supabaseUrl.startsWith('http')) {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/search-hospitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      body: JSON.stringify({ query, display: 100, start: 1, sort: 'random' }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 429 || data.error === 'rate_limited' || data.errorCode === '012') {
        throw new Error('검색 요청이 너무 많아요. 잠시 후 다시 시도해주세요.')
      }
      throw new Error(data.message || data.error || '병원 검색 API 호출에 실패했습니다.')
    }
    const hospitals = transformHospitalItems(data.items ?? data.hospitals ?? [], query, category)
    return sortHospitalsByDistance(hospitals, location)
  }

  const fallback = await loadCollectedHospitals(query, category)
  return sortHospitalsByDistance(fallback, location)
}

async function loadCollectedHospitals(query: string, category: AnimalCategory) {
  const response = await fetch('/data/exotic-hospitals.json', { cache: 'no-store' })
  if (!response.ok) return []
  const items = await response.json() as Array<Record<string, unknown>>
  return transformHospitalItems(items, query, category)
}

function transformHospitalItems(items: Array<Record<string, unknown>>, query: string, category: AnimalCategory) {
  return dedupeHospitals(items
    .map((item, index) => transformHospitalItem(item, index, query, category))
    .filter((hospital): hospital is Hospital => Boolean(hospital)))
}

function transformHospitalItem(item: Record<string, unknown>, index: number, query: string, category: AnimalCategory): Hospital | null {
  const name = cleanHtml(String(item.title ?? item.name ?? '이름 없는 병원'))
  const address = String(item.roadAddress ?? item.address ?? '')
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  const mapx = Number(item.mapx ?? item.mapX)
  const mapy = Number(item.mapy ?? item.mapY)
  const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : convertNaverLocalCoords(mapx, mapy)
  if (!coords) return null

  const text = `${query} ${name} ${item.category ?? ''} ${item.description ?? ''} ${address}`
  const supportedAnimals = Array.isArray(item.supportedAnimals) ? item.supportedAnimals : []
  const categories = supportedAnimals
    .filter((value): value is Exclude<AnimalCategory, 'all'> => value === 'reptile' || value === 'bird' || value === 'rodent' || value === 'amphibian')
  const guessed = categories.length > 0 ? categories : guessAnimalCategories(text, category)

  return {
    id: String(item.id ?? `${name}-${coords.lat}-${coords.lng}-${index}`),
    name,
    address,
    roadAddress: String(item.roadAddress ?? ''),
    phone: String(item.telephone ?? item.phone ?? ''),
    link: String(item.link ?? ''),
    lat: coords.lat,
    lng: coords.lng,
    categories: guessed,
    matchedQueries: Array.isArray(item.matchedQueries) ? item.matchedQueries.map(String) : [query],
  }
}

function convertNaverLocalCoords(mapx: number, mapy: number): Coordinates | null {
  if (!Number.isFinite(mapx) || !Number.isFinite(mapy)) return null
  const naver = window.naver
  if (naver?.maps.TransCoord) {
    const latLng = naver.maps.TransCoord.fromTM128ToLatLng(new naver.maps.Point(mapx, mapy))
    return { lat: latLng.lat(), lng: latLng.lng() }
  }
  return { lat: mapy / 10_000_000, lng: mapx / 10_000_000 }
}

function guessAnimalCategories(text: string, selectedCategory: AnimalCategory): Exclude<AnimalCategory, 'all'>[] {
  if (selectedCategory !== 'all') return [selectedCategory]
  const normalized = normalizeText(text)
  const matched = Object.entries(animalCategoryKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
    .map(([category]) => category as Exclude<AnimalCategory, 'all'>)
  return matched.length > 0 ? matched : ['reptile', 'bird', 'rodent']
}

function buildHospitalSearchQuery(query: string, category: AnimalCategory) {
  const trimmed = query.trim()
  const categoryTerm = animalCategorySearchTerms[category]
  if (!trimmed) return categoryTerm
  if (category === 'all') return trimmed
  return normalizeText(trimmed).includes(normalizeText(categoryTerm)) ? trimmed : `${trimmed} ${categoryTerm}`
}

function sortHospitalsByDistance(hospitals: Hospital[], location: Coordinates | null) {
  return hospitals
    .map((hospital) => ({
      ...hospital,
      distanceKm: location ? getDistanceKm(location.lat, location.lng, hospital.lat, hospital.lng) : hospital.distanceKm,
    }))
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function dedupeHospitals(hospitals: Hospital[]) {
  const unique = new Map<string, Hospital>()
  hospitals.forEach((hospital) => {
    const key = `${normalizeText(hospital.name)}:${normalizeText(hospital.address)}`
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, hospital)
      return
    }
    unique.set(key, {
      ...existing,
      categories: Array.from(new Set([...existing.categories, ...hospital.categories])),
      phone: existing.phone || hospital.phone,
      link: existing.link || hospital.link,
    })
  })
  return Array.from(unique.values())
}

function hospitalMarkerContent(hospital: Hospital, active: boolean, trusted: boolean) {
  return `<button class="hospital-map-marker${active ? ' active' : ''}${trusted ? ' trusted' : ''}" type="button" aria-label="${escapeHtml(hospital.name)}"><span>H</span></button>`
}

function readStoredReviews() {
  try {
    const stored = localStorage.getItem(reviewStorageKey)
    if (!stored) return {}
    return JSON.parse(stored) as Record<string, HospitalReview[]>
  } catch {
    return {}
  }
}

function readStoredList<T>(key: string): T[] {
  try {
    const stored = localStorage.getItem(key)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function genderLabel(value: Pet['gender']) {
  if (value === 'male') return '수컷'
  if (value === 'female') return '암컷'
  return '미구분'
}

function formatReviewDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function cleanHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function escapeHtml(value: string) {
  return cleanHtml(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeText(value: string) {
  return cleanHtml(value).replace(/\s+/g, '').toLowerCase()
}

export default App
