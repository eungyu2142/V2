import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { OptionalBadge, RequiredMark } from '../common/FieldMarkers'

type FieldLabelProps = {
  children: ReactNode
  required?: boolean
  optional?: boolean
}

export function FieldLabel({ children, required = false, optional = false }: FieldLabelProps) {
  return <span className="ui-field__label">{children}{required && <RequiredMark />}{optional && <OptionalBadge />}</span>
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  optional?: boolean
  error?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, optional = false, error, className = '', required, ...props }, ref) {
  return (
    <label className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`.trim()}>
      <FieldLabel required={required} optional={optional}>{label}</FieldLabel>
      <input ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {error && <small className="ui-field__error">{error}</small>}
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
    <label className={`ui-field ${error ? 'ui-field--error' : ''} ${className}`.trim()}>
      <FieldLabel required={required} optional={optional}>{label}</FieldLabel>
      <textarea ref={ref} required={required} aria-invalid={Boolean(error)} {...props} />
      {footer}
      {error && <small className="ui-field__error">{error}</small>}
    </label>
  )
})
