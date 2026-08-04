import type { RecordDraft, Reminder } from '../components/diary/DiaryScreen'
import type { PetRecord, PetRecordType } from '../features/diary/diaryTypes'

export type Tab = 'pets' | 'diary' | 'map' | 'qna' | 'profile'
export type CreateMode = 'pet' | 'post' | null
export type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
export type HospitalSort = 'distance' | 'reviews' | 'rating'
export type MobileMapSheetState = 'collapsed' | 'middle' | 'expanded'
export type HospitalOpeningHours = {
  openNow?: boolean
  weekdayDescriptions?: string[]
  periods?: Array<Record<string, unknown>>
  specialDays?: Array<Record<string, unknown>>
  nextOpenTime?: string
  nextCloseTime?: string
}
export type HospitalGoogleReview = {
  id: string
  authorName: string
  authorUri?: string
  authorPhotoUri?: string
  rating?: number
  text: string
  publishTime?: string
  relativePublishTimeDescription?: string
  googleMapsUri?: string
}
export type Pet = { id: string; name: string; group: AnimalCategory; species: string; gender: 'male' | 'female' | 'unknown'; photo?: string; photoPosition?: { x: number; y: number }; weight?: string; weightUnit?: 'g' | 'kg'; birthday?: string; adoptionDate?: string; registeredAt?: string; description?: string; ageStage?: string; ageText?: string }
export type QnaCategory = '질병' | '사육' | '먹이' | '환경' | '행동' | '번식'
export type QnaStatus = 'unresolved' | 'resolved'
export type QnaSort = 'latest' | 'popular' | 'comments'
export type QnaListStatus = 'all' | 'waiting' | 'answered' | 'resolved'
export type HospitalSnapshot = { id?: string; name: string; address: string; phone: string; lat: number; lng: number; animalTags: string[]; naverLink: string; source: 'naver_local_search' | 'local_hospital_data'; rating?: number; googleReviewCount?: number; googleReviews?: HospitalGoogleReview[]; regularOpeningHours?: HospitalOpeningHours | null; currentOpeningHours?: HospitalOpeningHours | null; openingHours?: string[]; isOpenNow?: boolean | null; openingHoursUpdatedAt?: string | null }
export type QnaComment = { id: string; author: string; authorAvatarUrl?: string; body: string; createdAt: string; mine: boolean; isAccepted?: boolean; liked?: boolean; likes?: number; hospitalSnapshot?: HospitalSnapshot }
export type AttachedRecordSnapshot = { recordId: string; petId: string; petName: string; animalGroup: string; animalSpecies: string; recordDate: string; recordType: PetRecordType; recordTypeLabel: string; summary: string; photoUrl?: string }
export type AttachedDiarySnapshot = { petId: string; petName: string; petPhoto?: string; records: PetRecord[]; startDate: string; endDate: string; totalCount: number }
export type QnaPost = { id: string; category: QnaCategory; status?: QnaStatus; selectedAnswerCommentId?: string; title: string; body: string; author: string; authorAvatarUrl?: string; mine?: boolean; animal: string; petId: string; animalGroup?: string; animalSpecies?: string; image?: string; images?: string[]; linkedRecordId?: string; attachedRecordSnapshot?: AttachedRecordSnapshot; attachedDiarySnapshot?: AttachedDiarySnapshot; createdAt: string; viewCount?: number; liked: boolean; likes: number; comments: QnaComment[] }
export type DiaryRecordDraftPayload = { petId: string; date: string; draft: RecordDraft }
export type HospitalReview = { id: string; hospitalId: string; userId?: string; petId?: string; petName?: string; clinicRecordId?: string; author: string; authorAvatarUrl?: string; animalCategory?: Exclude<AnimalCategory, 'all'>; species?: string; rating: number; visitDate?: string; nextVisitDate?: string; nextVisitTime?: string; cost?: number; diagnosis?: string; treatment?: string; medicine?: string; medicineDose?: string; medicineStartDate?: string; medicineEndDate?: string; medicineDailyCount?: number; medicineInstructions?: string; medicineBagImage?: string; medicineOcrRaw?: unknown; tags?: string[]; body: string; content?: string; images?: string[]; mine?: boolean; liked?: boolean; likes?: number; hospitalName?: string; hospitalSnapshot?: HospitalSnapshot; createdAt: string }
export type HospitalReviewDraftPayload = { hospital: HospitalSnapshot; review: HospitalReview }
export type ReminderDraftPayload = { reminder: Reminder }
export type DraftKind = 'question' | 'pet' | 'care_record' | 'hospital_review' | 'reminder'
export type DraftItem = { id: string; draftType: DraftKind; title: string; body: string; updatedAt: string; step?: number; payload: QnaPost | Pet | DiaryRecordDraftPayload | HospitalReviewDraftPayload | ReminderDraftPayload }
export type AppProfile = { username: string; nickname: string; avatarUrl: string }
export type Coordinates = { lat: number; lng: number }
export type Hospital = { id: string; name: string; address: string; roadAddress?: string; shortAddress?: string; phone: string; internationalPhone?: string; link: string; googleMapsUri?: string; websiteUri?: string; googlePlaceId?: string; googleDetailsLoaded?: boolean; businessStatus?: string; primaryTypeLabel?: string; lat: number; lng: number; distanceKm?: number; categories: Exclude<AnimalCategory, 'all'>[]; matchedQueries?: string[]; rating?: number; googleReviewCount?: number; googleReviews?: HospitalGoogleReview[]; regularOpeningHours?: HospitalOpeningHours | null; currentOpeningHours?: HospitalOpeningHours | null; openingHours?: string[]; isOpenNow?: boolean | null; openingHoursUpdatedAt?: string | null }
