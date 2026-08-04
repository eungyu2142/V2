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

export type FeedingFoodItem = {
  foodKey: string | null
  foodName: string
  isCustom: boolean
}

export type RiskLevel = 0 | 1 | 2 | 3 | 4 | 5

export type EnvironmentRecord = {
  profileKey: string
  metricType: 'temperature' | 'humidity'
  measurementType: 'air' | 'water' | 'humidity'
  value: number
  unit: 'celsius' | 'percent'
  targetValue: number
  minValue: number
  maxValue: number
  riskLevel: RiskLevel
  riskDirection: 'low' | 'high' | 'normal'
  riskMessage: string
}

export type ClinicRecordDetails = {
  hospitalName: string
  visitDate: string
  cost?: number
  diagnosis?: string
  treatment?: string
  reviewBody?: string
  nextVisit?: {
    date: string
    time: string
  }
  medicine?: {
    name: string
    dose?: string
    startDate: string
    endDate?: string
    dailyCount: number
    instructions?: string
  }
}

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
  feedingFoods?: FeedingFoodItem[]
  environmentRecord?: EnvironmentRecord
  clinicDetails?: ClinicRecordDetails
  hospitalId?: string
  reviewId?: string
  createdAt: string
  dailyTaskId?: string
  scheduledFor?: string
  occurredAt?: string
  status?: 'completed' | 'manual'
}

export type CareTaskType =
  | 'feed'
  | 'water'
  | 'mist'
  | 'temperature'
  | 'water_temperature'
  | 'humidity'
  | 'cleaning'
  | 'partial_cleaning'
  | 'full_cleaning'
  | 'substrate_change'
  | 'structure_cleaning'
  | 'wall_wipe'
  | 'uvb_check'
  | 'weight'
  | 'water_quality'
  | 'filter_check'
  | 'medicine'
  | 'hospital'
  | 'custom'

export type CarePlan = {
  id: string
  userId: string
  petId: string
  taskType: CareTaskType
  title: string
  repeatDays: number[]
  recurrenceType?: 'weekdays' | 'interval'
  recurrenceIntervalDays?: number
  startDate: string
  endDate?: string
  notificationTime: string
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
