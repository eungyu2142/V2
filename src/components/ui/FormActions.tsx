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
    <div className={`mt-5 flex w-full items-stretch gap-2 [&>*]:min-w-0 [&>*]:flex-1 ${className}`.trim()}>
      {extra}
      {onPrevious && <Button variant="secondary" type="button" disabled={previousDisabled} onClick={onPrevious}>{previousLabel}</Button>}
      <Button type={primaryType} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</Button>
    </div>
  )
}
