import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger'

const baseClasses = 'inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] border px-5 py-2.5 font-bold disabled:cursor-not-allowed disabled:opacity-50'
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-primary-600)] border-[var(--color-primary-600)] text-[var(--color-on-primary)] enabled:hover:bg-[var(--color-primary-700)]',
  secondary: 'bg-[var(--color-surface)] border-[var(--color-primary-200)] text-[var(--color-primary-700)] enabled:hover:bg-[var(--color-primary-50)]',
  text: 'border-transparent text-[var(--color-primary-700)]',
  danger: 'bg-[var(--color-error-50)] border-[var(--color-error-100)] text-[var(--color-error-700)]',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  fullWidth?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', fullWidth = false, className = '', children, ...props }: ButtonProps) {
  const classes = [baseClasses, variantClasses[variant], fullWidth ? 'w-full' : '', className].filter(Boolean).join(' ')
  return <button className={classes} {...props}>{children}</button>
}
