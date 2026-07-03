export type AnimalCategory =
  | 'reptile'
  | 'bird'
  | 'rodent'
  | 'amphibian'
  | 'other'
  | 'unknown'

export type Pet = {
  id: string
  userId: string
  name: string
  category: AnimalCategory
  species: string
  gender?: 'male' | 'female' | 'unknown'
  photoUrl?: string
  weight?: number
  birthDate?: string
  adoptionDate?: string
}

export type PetRecordType =
  | 'food'
  | 'weight'
  | 'shed'
  | 'poop'
  | 'cleaning'
  | 'hospital'
  | 'other'

export type PetRecord = {
  id: string
  userId: string
  petId: string
  type: PetRecordType
  date: string
  memo?: string
  photoUrl?: string
  weight?: number
  foods?: string[]
  hospitalId?: string
  reviewId?: string
  createdAt: string
}
