import { GuideIcon } from './GuideIcon'

export default function GuideAction({ symbol }: { symbol: string }) {
  const shape = symbol === '×' ? <path d="m6 6 12 12M18 6 6 18" />
    : ['←', '‹'].includes(symbol) ? <path d="m15 5-7 7 7 7" />
    : ['→', '›', '〉'].includes(symbol) ? <path d="m9 5 7 7-7 7" />
    : ['＋', '+'].includes(symbol) ? <path d="M12 5v14M5 12h14" />
    : symbol === '⌕' ? <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>
    : symbol === '✓' ? <path d="m5 12 4 4L19 6"/>
    : <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>
  return <GuideIcon className="guide-action">{shape}</GuideIcon>
}
