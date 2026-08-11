import type { CSSProperties } from 'react'

export type StepStatus = 'completed' | 'active' | 'upcoming'

function getStepStatus(index: number, currentStep: number): StepStatus {
  if (index < currentStep) return 'completed'
  if (index === currentStep) return 'active'
  return 'upcoming'
}

type StepperProps = {
  currentStep: number
  stepCount: number
  labels?: string[]
  onStepChange?: (step: number) => void
  className?: string
}

export function Stepper({ currentStep, stepCount, labels, onStepChange, className = '' }: StepperProps) {
  const progress = Math.min(1, (currentStep + 1) / stepCount)
  const style = {
    '--ui-step-count': stepCount,
    '--ui-step-progress': `${progress * 100}%`,
  } as CSSProperties

  return (
    <div className={`ui-stepper ${className}`.trim()} style={style}>
      <div className="ui-stepper__track" role="tablist" aria-label={'\uC791\uC131 \uB2E8\uACC4'}>
        <span className="ui-stepper__fill" />
        {Array.from({ length: stepCount }, (_, index) => {
          const status = getStepStatus(index, currentStep)
          const statusLabel = status === 'completed' ? '\uC644\uB8CC' : status === 'active' ? '\uD604\uC7AC' : '\uC608\uC815'
          return (
            <button
              key={index}
              className={`is-${status}`}
              data-step-status={status}
              type="button"
              role="tab"
              aria-selected={status === 'active'}
              aria-label={`${index + 1}\uB2E8\uACC4 ${statusLabel}`}
              onClick={() => onStepChange?.(index)}
            >
              <span aria-hidden="true">
                {status === 'completed' && <span className="ui-stepper__mobile-check">{'✓'}</span>}
                <span className={status === 'completed' ? 'ui-stepper__desktop-number' : ''}>{index + 1}</span>
              </span>
            </button>
          )
        })}
      </div>
      {labels && (
        <div className="ui-stepper__labels">
          {labels.map((label, index) => {
            const status = getStepStatus(index, currentStep)
            return (
              <span className={`is-${status}`} key={`${label}-${index}`}>
                {status === 'completed' && <span className="ui-stepper__mobile-label-check">{'✓'}</span>}
                <span className={status === 'completed' ? 'ui-stepper__desktop-label-number' : ''}>{index + 1}.</span> {label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
