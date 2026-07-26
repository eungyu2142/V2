import type { RecordDraft, Reminder } from '../components/diary/DiaryScreen'
import type { PetRecord, PetRecordType } from '../features/diary/diaryTypes'

export type Tab = 'pets' | 'diary' | 'map' | 'qna' | 'profile'
export type CreateMode = 'pet' | 'post' | null
export type AnimalCategory = 'all' | 'reptile' | 'bird' | 'rodent' | 'amphibian' | 'other'
export type HospitalSort = 'distance' | 'reviews' | 'rating'
export type MobileMapSheetState = 'collapsed' | 'middle' | 'expanded'
export type Pet = { id: string; name: string; group: AnimalCategory; species: string; gender: 'male' | 'female' | 'unknown'; photo?: string; weight?: string; weightUnit?: 'g' | 'kg'; birthday?: string; adoptionDate?: string; registeredAt?: string; description?: string; ageStage?: string; ageText?: string }
export type QnaCategory = '건강/증상' | '사육/관리'
export type QnaStatus = 'unresolved' | 'resolved'
export type QnaSort = 'latest' | 'popular' | 'views' | 'comments'
export type QnaListStatus = 'all' | 'waiting' | 'answered' | 'resolved'
export type HospitalSnapshot = { id?: string; name: string; address: string; phone: string; lat: number; lng: number; animalTags: string[]; naverLink: string; source: 'naver_local_search' | 'local_hospital_data' }
export type QnaComment = { id: string; author: string; body: string; createdAt: string; mine: boolean; hospitalSnapshot?: HospitalSnapshot }
export type AttachedRecordSnapshot = { recordId: string; petId: string; petName: string; animalGroup: string; animalSpecies: string; recordDate: string; recordType: PetRecordType; recordTypeLabel: string; summary: string; photoUrl?: string }
export type AttachedDiarySnapshot = { petId: string; petName: string; petPhoto?: string; records: PetRecord[]; startDate: string; endDate: string; totalCount: number }
export type QnaPost = { id: string; category: QnaCategory; status?: QnaStatus; selectedAnswerCommentId?: string; title: string; body: string; author: string; authorAvatarUrl?: string; mine?: boolean; animal: string; petId: string; animalGroup?: string; animalSpecies?: string; image?: string; linkedRecordId?: string; attachedRecordSnapshot?: AttachedRecordSnapshot; attachedDiarySnapshot?: AttachedDiarySnapshot; createdAt: string; viewCount?: number; liked: boolean; likes: number; comments: QnaComment[] }
export type DiaryRecordDraftPayload = { petId: string; date: string; draft: RecordDraft }
export type HospitalReview = { id: string; hospitalId: string; userId?: string; petId?: string; petName?: string; author: string; animalCategory?: Exclude<AnimalCategory, 'all'>; species?: string; rating: number; visitDate?: string; cost?: number; diagnosis?: string; treatment?: string; medicine?: string; medicineDose?: string; medicineStartDate?: string; medicineEndDate?: string; medicineDailyCount?: number; medicineInstructions?: string; medicineBagImage?: string; medicineOcrRaw?: unknown; tags?: string[]; body: string; content?: string; images?: string[]; mine?: boolean; liked?: boolean; likes?: number; hospitalName?: string; hospitalSnapshot?: HospitalSnapshot; createdAt: string }
export type HospitalReviewDraftPayload = { hospital: HospitalSnapshot; review: HospitalReview }
export type ReminderDraftPayload = { reminder: Reminder }
export type DraftKind = 'question' | 'pet' | 'care_record' | 'hospital_review' | 'reminder'
export type DraftItem = { id: string; draftType: DraftKind; title: string; body: string; updatedAt: string; step?: number; payload: QnaPost | Pet | DiaryRecordDraftPayload | HospitalReviewDraftPayload | ReminderDraftPayload }
export type AppProfile = { username: string; nickname: string; avatarUrl: string }
export type Coordinates = { lat: number; lng: number }
export type Hospital = { id: string; name: string; address: string; roadAddress?: string; phone: string; link: string; lat: number; lng: number; distanceKm?: number; categories: Exclude<AnimalCategory, 'all'>[]; matchedQueries?: string[] }
