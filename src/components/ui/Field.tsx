import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { OptionalBadge, RequiredMark } from '../common/FieldMarkers'

type FieldLabelProps = {
  children: ReactNode
  required?: boolean
  optional?: boolean
}

export function FieldLabel({ children, required = false, optional = false }: FieldLabelProps) {
  return <span className="inline-flex items-start justify-self-start text-[var(--font-size-body)] font-bold leading-[1.35] text-app-ink">{children}{required && <RequiredMark />}{optional && <OptionalBadge />}</span>
}

const fieldClasses = 'grid min-w-0 gap-2'
const controlClasses = 'w-full min-w-0 rounded-control border border-app-border bg-app-surface text-[var(--font-size-control)] text-app-ink focus:border-brand-600 focus:outline-[3px] focus:outline-[color-mix(in_srgb,var(--color-primary-600)_18%,transparent)]'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  optional?: boolean
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, optional = false, error, className = '', required, ...props }, ref) {
  return (
    <label className={`${fieldClasses} ${className}`.trim()}>
      <FieldLabel required={required} optional={optional}>{label}</FieldLabel>
      <input className={`${controlClasses} min-h-[var(--control-height)] px-3 ${error ? 'border-[var(--color-error-500)]' : ''}`} ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {error && <small className="text-[var(--font-size-caption)] text-app-danger">{error}</small>}
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
      <textarea className={`${controlClasses} min-h-28 resize-y p-3 ${error ? 'border-[var(--color-error-500)]' : ''}`} ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {footer}
      {error && <small className="text-[var(--font-size-caption)] text-app-danger">{error}</small>}
    </label>
  )
})
