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
    <fieldset className={`ui-choice-group ${compact ? 'ui-choice-group--compact' : ''} ${className}`.trim()}>
      <legend><FieldLabel required={required}>{label}</FieldLabel></legend>
      <div className="ui-choice-group__list">
        {options.map((option) => <button className={values.includes(option.value) ? 'is-selected' : ''} type="button" aria-pressed={values.includes(option.value)} key={option.value} onClick={() => toggle(option.value)}>{option.label}</button>)}
      </div>
    </fieldset>
  )
}
