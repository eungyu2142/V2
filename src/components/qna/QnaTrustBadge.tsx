export function QnaTrustBadge({ acceptedCount }: { acceptedCount: number }) {
  if (acceptedCount === 0) return null
  return <span className="qna-trust-badge" aria-label={`채택 답변 ${acceptedCount}개`}>신뢰도 +{acceptedCount}</span>
}
