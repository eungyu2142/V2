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
  dailyTaskId?: string
  scheduledFor?: string
  occurredAt?: string
  status?: 'completed' | 'manual'
}

export type CareTaskType = 'feed' | 'water' | 'cleaning'

export type CarePlan = {
  id: string
  userId: string
  petId: string
  taskType: CareTaskType
  title: string
  repeatDays: number[]
  startDate: string
  endDate?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type DailyTaskStatus = 'pending' | 'completed' | 'skipped'

export type DailyTask = {
  id: string
  userId: string
  carePlanId?: string
  medicationPlanId?: string
  petId: string
  taskType: string
  scheduledDate: string
  occurrenceNo: number
  status: DailyTaskStatus
  completedAt?: string
  skipReason?: string
  createdAt: string
  updatedAt: string
}

export type VisitRecord = {
  id: string
  userId: string
  petId: string
  hospitalName: string
  visitDate: string
  medicationAssetId?: string
  ocrRaw?: unknown
  status: 'draft' | 'confirmed'
  createdAt: string
  updatedAt: string
}

export type MedicationPlan = {
  id: string
  userId: string
  petId: string
  visitRecordId?: string
  name: string
  dose: string
  startDate: string
  endDate?: string
  dailyCount: number
  instructions?: string
  verificationAssetId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
