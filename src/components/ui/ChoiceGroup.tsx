import { FieldLabel } from './Field'

export type ChoiceOption = { value: string; label: string }

type ChoiceGroupProps = {
  label: string
  options: ChoiceOption[]
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  required?: boolean
  compact?: boolean
  className?: string
}

export function ChoiceGroup({ label, options, value, onChange, multiple = false, required = false, compact = false, className = '' }: ChoiceGroupProps) {
  const values = Array.isArray(value) ? value : value ? [value] : []
  const toggle = (option: string) => {
    if (!multiple) return onChange(option)
    onChange(values.includes(option) ? values.filter((item) => item !== option) : [...values, option])
  }
  return (
    <fieldset className={`[&>legend]:mb-2.5 ${className}`.trim()}>
      <legend><FieldLabel required={required}>{label}</FieldLabel></legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value)
          return <button className={`border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm aria-pressed:border-[var(--color-primary-600)] aria-pressed:bg-[var(--color-primary-600)] aria-pressed:text-[var(--color-on-primary)] ${compact ? 'min-h-9 rounded-full' : 'min-h-10 rounded-[var(--radius-control)]'}`} type="button" aria-pressed={selected} key={option.value} onClick={() => toggle(option.value)}>{option.label}</button>
        })}
      </div>
    </fieldset>
  )
}
