import type { ReactNode } from 'react'
import GuideAction from '../common/GuideAction'

/** The reference's back / centered title / optional action header. */
export function FlowHeader({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return <header className="mb-6 grid min-h-12 grid-cols-[44px_1fr_44px] items-center text-center">
    <button type="button" className="grid size-11 place-items-center [&_.guide-icon-disc]:fill-none" aria-label="뒤로가기" onClick={onBack}><GuideAction symbol="‹" /></button>
    <h1 className="text-xl">{title}</h1>
    {action ?? <span />}
  </header>
}
