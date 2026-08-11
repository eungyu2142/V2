import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger'

const baseClasses = 'inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-control border border-transparent px-4 text-[var(--font-size-control)] font-bold transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-fast)] disabled:cursor-not-allowed disabled:border-app-border disabled:bg-app-background disabled:text-[var(--color-text-placeholder)] disabled:shadow-none'
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-app-surface not-disabled:hover:bg-brand-700',
  secondary: 'border-brand-100 bg-brand-50 text-brand-700',
  text: 'bg-transparent text-brand-700',
  danger: 'border-[var(--color-error-100)] bg-[var(--color-error-100)] text-app-danger',
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
