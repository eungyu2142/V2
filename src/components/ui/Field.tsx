import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { OptionalBadge, RequiredMark } from '../common/FieldMarkers'

type FieldLabelProps = {
  children: ReactNode
  required?: boolean
  optional?: boolean
}

export function FieldLabel({ children, required = false, optional = false }: FieldLabelProps) {
  return <span className="inline-flex text-sm font-bold">{children}{required && <RequiredMark />}{optional && <OptionalBadge />}</span>
}

const fieldClasses = 'grid min-w-0 gap-2'
const controlClasses = 'aria-invalid:border-[var(--color-error-600)]'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  optional?: boolean
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, optional = false, error, className = '', required, ...props }, ref) {
  return (
    <label className={`${fieldClasses} ${className}`.trim()}>
      <FieldLabel required={required} optional={optional}>{label}</FieldLabel>
      <input className={controlClasses} ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {error && <small className="text-xs text-[var(--color-error-600)]">{error}</small>}
    </label>
  )
})

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  optional?: boolean
  error?: string
  footer?: ReactNode
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField({ label, optional = false, error, footer, className = '', required, ...props }, ref) {
  return (
    <label className={`${fieldClasses} ${className}`.trim()}>
      <FieldLabel required={required} optional={optional}>{label}</FieldLabel>
      <textarea className={controlClasses} ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {footer}
      {error && <small className="text-xs text-[var(--color-error-600)]">{error}</small>}
    </label>
  )
})
