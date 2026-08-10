import type { ReactNode } from 'react'
import { Button } from './Button'

type FormActionsProps = {
  onPrevious?: () => void
  previousLabel?: string
  previousDisabled?: boolean
  primaryLabel: string
  primaryDisabled?: boolean
  onPrimary?: () => void
  primaryType?: 'button' | 'submit'
  extra?: ReactNode
  className?: string
}

export function FormActions({
  onPrevious,
  previousLabel = '이전',
  previousDisabled = false,
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  primaryType = 'button',
  extra,
  className = '',
}: FormActionsProps) {
  return (
    <div className={`ui-form-actions ${className}`.trim()}>
      {extra}
      {onPrevious && <Button variant="secondary" type="button" disabled={previousDisabled} onClick={onPrevious}>{previousLabel}</Button>}
      <Button type={primaryType} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button>
    </div>
  )
}
