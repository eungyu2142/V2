import { useMemo, useState } from 'react'

type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'

type Pet = {
  id: string
  name: string
  group: AnimalCategory
  species: string
  gender: 'male' | 'female' | 'unknown'
  photo?: string
  weight?: string
  weightUnit?: 'g' | 'kg'
  registeredAt?: string
}

const animalCategoryLabels: Record<AnimalCategory, string> = {
  all: '전체',
  reptile: '파충류',
  bird: '조류',
  rodent: '설치류',
  amphibian: '양서류',
  other: '기타',
}

const animalCategoryOptions: AnimalCategory[] = ['all', 'reptile', 'amphibian', 'rodent', 'bird', 'other']

function genderLabel(value: Pet['gender']) {
  if (value === 'male') return '수컷'
  if (value === 'female') return '암컷'
  return '미구분'
}

function formatPetDate(value?: string) {
  if (!value) return '정보 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '정보 없음'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function PetsScreen({
  pets,
  onDeletePet,
  onEditPet,
  onOpenDiary,
  onRegisterPet,
}: {
  userId: string
  pets: Pet[]
  onDeletePet: (petId: string) => void
  onEditPet: (pet: Pet) => void
  onOpenDiary: (petId: string) => void
  onRegisterPet: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<Exclude<AnimalCategory, 'all'>[]>([])
  const [menuPetId, setMenuPetId] = useState<string | null>(null)

  const filteredPets = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return pets.filter((pet) => {
      const matchesCategory = selectedCategories.length === 0 || (pet.group !== 'all' && selectedCategories.includes(pet.group))
      const text = `${pet.name} ${pet.species} ${animalCategoryLabels[pet.group]}`.toLowerCase()
      return matchesCategory && text.includes(keyword)
    }).sort((a, b) => new Date(b.registeredAt ?? 0).getTime() - new Date(a.registeredAt ?? 0).getTime())
  }, [pets, query, selectedCategories])

  const toggleCategory = (item: AnimalCategory) => {
    if (item === 'all') {
      setSelectedCategories([])
      return
    }
    setSelectedCategories((current) => current.includes(item) ? current.filter((category) => category !== item) : [...current, item])
  }

  return (
    <section className="page-stack my-pet-dashboard">
      <section className="section-block my-pet-tools my-pet-dashboard-panel">
        <div className="my-pet-dashboard-heading">
          <div>
            <h2>마이 펫</h2>
            <p>등록한 특수동물을 확인하고 기록으로 이동합니다.</p>
          </div>
          <button className="pet-add-inline" type="button" onClick={onRegisterPet}>+ 펫 추가</button>
        </div>
        <label className="my-pet-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 또는 종으로 검색" />
        </label>
        <div className="filter-tags" aria-label="동물 분류 필터">
          {animalCategoryOptions.map((item) => (
            <button
              className={(item === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(item)) ? 'active' : ''}
              type="button"
              key={item}
              onClick={() => toggleCategory(item)}
              aria-pressed={item === 'all' ? selectedCategories.length === 0 : selectedCategories.includes(item)}
            >
              <span>{animalCategoryLabels[item]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block my-pet-section my-pet-dashboard-panel">
        <div className="pet-list-toolbar">
          <div className="section-title"><h2>등록한 펫</h2><span>{filteredPets.length}</span></div>
        </div>
        {filteredPets.length === 0 ? (
          <div className="pet-empty-state">
            <strong>{pets.length === 0 ? '아직 등록한 펫이 없습니다' : '검색 결과가 없습니다'}</strong>
            <p>{pets.length === 0 ? '관리할 반려동물을 먼저 등록해 주세요.' : '검색어 또는 분류를 다시 확인해 주세요.'}</p>
            {pets.length === 0 && <button type="button" onClick={onRegisterPet}>첫 펫 등록하기</button>}
          </div>
        ) : (
          <div className="pet-list card-view">
            {filteredPets.map((pet) => (
              <article className="pet-card pet-management-card" key={pet.id}>
                <button className="pet-card-main" type="button" onClick={() => onOpenDiary(pet.id)}>
                  <div className="pet-card-visual">
                    <div className="pet-card-icon">{pet.photo ? <img src={pet.photo} alt={`${pet.name} 사진`} /> : animalCategoryLabels[pet.group].slice(0, 1)}</div>
                  </div>
                  <div className="pet-card-body">
                    <div className="pet-card-identity"><strong>{pet.name}</strong><small>{pet.species || animalCategoryLabels[pet.group]}</small></div>
                    <div className="pet-card-meta"><span>{animalCategoryLabels[pet.group]}</span><span>{genderLabel(pet.gender)}</span><span>{formatPetDate(pet.registeredAt)}</span></div>
                    {pet.weight && <p className="pet-latest-record"><b>무게</b>{pet.weight}{pet.weightUnit ?? 'g'}</p>}
                  </div>
                </button>
                <div className="pet-card-actions">
                  <button className="pet-more-button" type="button" aria-label={`${pet.name} 메뉴 열기`} onClick={() => setMenuPetId(menuPetId === pet.id ? null : pet.id)}>⋯</button>
                  {menuPetId === pet.id && (
                    <div className="pet-more-menu">
                      <button type="button" onClick={() => { setMenuPetId(null); onEditPet(pet) }}>수정</button>
                      <button className="danger" type="button" onClick={() => { setMenuPetId(null); onDeletePet(pet.id) }}>삭제</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
