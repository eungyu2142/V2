import { GuideIcon } from './GuideIcon'

type HeartIconProps = {
  filled: boolean
  className?: string
}

export default function HeartIcon({ filled, className = '' }: HeartIconProps) {
  return (
    <GuideIcon
      className={`heart-icon ${filled ? 'is-filled text-[var(--color-like-500)]' : 'text-[var(--color-text-secondary)]'} [&_.guide-icon-disc]:fill-none ${className}`.trim()}
      tone="red"
    >
      <path fill={filled ? 'var(--color-like-500)' : 'none'} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
    </GuideIcon>
  )
}
