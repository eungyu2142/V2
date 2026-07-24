import { useEffect, useRef, type ReactNode } from 'react'

export default function StepShell({ title, children, onBack, currentStep, stepCount, stepLabels, onStepChange, hideProgress = false }: { title: string; children: ReactNode; onBack: () => void; currentStep?: number; stepCount?: number; stepLabels?: string[]; onStepChange?: (step: number) => void; hideProgress?: boolean }) {
  const currentStepRef = useRef(currentStep ?? 0)
  const onBackRef = useRef(onBack)
  const onStepChangeRef = useRef(onStepChange)
  useEffect(() => {
    onBackRef.current = onBack
    onStepChangeRef.current = onStepChange
  }, [onBack, onStepChange])
  useEffect(() => { currentStepRef.current = currentStep ?? 0 }, [currentStep])
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
  const progress = currentStep !== undefined && stepCount ? (currentStep + 1) / stepCount : undefined
  const keyword = title.includes('QNA') ? '질문' : title.includes('펫') ? '펫' : '작성'
  return (
    <main className="step-screen">
      <header className="step-header">
        <button className="back" type="button" aria-label="뒤로가기" onClick={onBack}>←</button>
        <strong>{title}</strong>
      </header>
      <p className="step-keyword" aria-label="작성 키워드">{keyword}</p>
      {!hideProgress && progress !== undefined && stepCount && <div className="step-progress step-progress-selectable" role="tablist" aria-label="작성 단계">
        <span className="step-progress-fill" style={{ width: `${progress * 100}%` }} />
        {Array.from({ length: stepCount }, (_, index) => <button key={index} className={index === currentStep ? 'active' : ''} type="button" role="tab" aria-selected={index === currentStep} aria-label={`${index + 1}단계`} onClick={() => onStepChange?.(index)}><span>{index + 1}</span></button>)}
      </div>}
      {!hideProgress && stepLabels && <div className={`step-progress-labels step-progress-labels-${stepLabels.length}`} style={{ gridTemplateColumns: `repeat(${stepLabels.length}, minmax(0, 1fr))`, whiteSpace: 'nowrap' }}>{stepLabels.map((label, index) => <span className={index === currentStep ? 'active' : ''} key={label}>{index + 1}. {label}</span>)}</div>}
      <section className="step-card">{children}</section>
    </main>
  )
}


