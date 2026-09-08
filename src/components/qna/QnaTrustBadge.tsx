import { getTrustLevel } from './qnaTrust'

export function QnaTrustBadge({ score }: { score: number }) {
  const level = getTrustLevel(score)
  if (level === 0) return null
  return <span className={`qna-trust-badge lv-${level}`} aria-label={`활동 기반 신뢰 답변자 레벨 ${level}`}>신뢰 답변자 Lv.{level}</span>
}
