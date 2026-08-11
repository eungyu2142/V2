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
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`.trim()}>
      <legend className="mb-3 p-0"><FieldLabel required={required}>{label}</FieldLabel></legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value)
          return <button className={`${compact ? 'min-h-9 rounded-full' : 'min-h-10 rounded-control'} border px-3 text-[var(--font-size-body)] font-bold ${selected ? 'border-brand-600 bg-brand-600 text-app-surface' : 'border-app-border bg-app-surface text-app-ink'}`} type="button" aria-pressed={selected} key={option.value} onClick={() => toggle(option.value)}>{option.label}</button>
        })}
      </div>
    </fieldset>
  )
}
