import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  fullWidth?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', fullWidth = false, className = '', children, ...props }: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, fullWidth ? 'ui-button--full' : '', className].filter(Boolean).join(' ')
  return <button className={classes} {...props}>{children}</button>
}
