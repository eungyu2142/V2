import { useEffect, useRef, type ReactNode } from 'react'
import { Stepper } from '../ui'
import { FlowHeader } from '../ui/FlowHeader'

type StepShellProps = {
  title: string
  children: ReactNode
  onBack: () => void
  currentStep?: number
  stepCount?: number
  stepLabels?: string[]
  onStepChange?: (step: number) => void
  hideProgress?: boolean
}

export default function StepShell({
  title,
  children,
  onBack,
  currentStep,
  stepCount,
  stepLabels,
  onStepChange,
  hideProgress = false,
}: StepShellProps) {
  const currentStepRef = useRef(currentStep ?? 0)
  const onBackRef = useRef(onBack)
  const onStepChangeRef = useRef(onStepChange)

  useEffect(() => {
    onBackRef.current = onBack
    onStepChangeRef.current = onStepChange
  }, [onBack, onStepChange])

  useEffect(() => {
    currentStepRef.current = currentStep ?? 0
  }, [currentStep])

  useEffect(() => {
    window.history.pushState({ exoPetCreateFlow: true }, '', window.location.href)
    const handleBrowserBack = () => {
      if (currentStepRef.current > 0) {
        const previousStep = currentStepRef.current - 1
        currentStepRef.current = previousStep
        onStepChangeRef.current?.(previousStep)
        window.history.pushState({ exoPetCreateFlow: true, step: previousStep }, '', window.location.href)
        return
      }
      onBackRef.current()
    }
    window.addEventListener('popstate', handleBrowserBack)
    return () => window.removeEventListener('popstate', handleBrowserBack)
  }, [])

  const keyword = stepLabels?.[currentStep ?? 0] ?? (title.includes('질문') ? '질문' : title.includes('펫') ? '펫' : '작성')

  return (
    <main className={`step-screen ${title.includes('질문') ? 'qna-create-screen' : ''}`}>
      <FlowHeader title={title} onBack={onBack} />
      {!stepLabels && !hideProgress && <p className="step-keyword" aria-label="작성 키워드">{keyword}</p>}
      {!hideProgress && currentStep !== undefined && stepCount && (
        <Stepper currentStep={currentStep} stepCount={stepCount} labels={stepLabels} onStepChange={onStepChange} />
      )}
      <section className="step-card">{children}</section>
    </main>
  )
}
