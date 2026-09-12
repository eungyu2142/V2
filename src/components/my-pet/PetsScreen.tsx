import { useEffect, useState } from 'react'
import { listCarePlans, listCareRecords, listDailyTasks } from '../../features/diary/diaryService'
import type { CarePlan, DailyTask, PetRecord } from '../../features/diary/diaryTypes'
import type { Pet } from '../../types/app'
import PetMobileFlow, { type PetMobileView } from './PetMobileFlow'
import './PetFlow.css'

export default function PetsScreen({ userId, pets, onDeletePet, onEditPet, onOpenDiary, onRegisterPet }: {
  userId: string
  pets: Pet[]
  onDeletePet: (petId: string) => void | Promise<void>
  onEditPet: (pet: Pet) => void
  onOpenDiary: (petId: string, action?: 'routine-create') => void
  onRegisterPet: () => void
}) {
  const [plans, setPlans] = useState<CarePlan[]>([])
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [records, setRecords] = useState<PetRecord[]>([])
  const [view, setView] = useState<PetMobileView>('main')
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.id ?? '')
  const [loadError, setLoadError] = useState('')
  const resolvedSelectedPetId = pets.some((pet) => pet.id === selectedPetId) ? selectedPetId : pets[0]?.id ?? ''

  useEffect(() => {
    let active = true
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    Promise.allSettled([listCarePlans(userId), listDailyTasks(userId, today, today), listCareRecords(userId)]).then(([planResult, taskResult, recordResult]) => {
      if (!active) return
      if (planResult.status === 'fulfilled') setPlans(planResult.value)
      if (taskResult.status === 'fulfilled') setDailyTasks(taskResult.value)
      if (recordResult.status === 'fulfilled') setRecords(recordResult.value)
      setLoadError([planResult, taskResult, recordResult].some((result) => result.status === 'rejected') ? '일부 루틴 또는 기록을 불러오지 못했어요. 잠시 후 다시 확인해주세요.' : '')
    })
    return () => { active = false }
  }, [pets, userId])

  return <>
    {loadError ? <p className="pet-flow-load-error" role="status">{loadError}</p> : null}
    <PetMobileFlow pets={pets} selectedPetId={resolvedSelectedPetId} view={view} tasks={dailyTasks} plans={plans} records={records} onSelectPet={setSelectedPetId} onView={setView} onRegisterPet={onRegisterPet} onEditPet={onEditPet} onDeletePet={onDeletePet} onOpenDiary={onOpenDiary}/>
  </>
}
