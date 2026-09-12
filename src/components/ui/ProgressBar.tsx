export function ProgressBar({ done, total, label, className = '' }: { done: number; total: number; label: string; className?: string }) {
  const value = Math.max(0, Math.min(done, total))
  return <div className={`h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-primary-100)] ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.max(1, total)} aria-valuenow={value}>
    <span className="block h-full rounded-full bg-[var(--color-primary-600)]" style={{ width: `${total > 0 ? value / total * 100 : 0}%` }} />
  </div>
}
