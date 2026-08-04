import type { QnaPost } from '../../types/app'

export type TrustLevel = 0 | 1 | 2 | 3

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 25) return 3
  if (score >= 15) return 2
  if (score >= 5) return 1
  return 0
}

export function getNextTrustTarget(score: number) {
  const level = getTrustLevel(score)
  if (level === 0) return { level: 1 as const, target: 5 }
  if (level === 1) return { level: 2 as const, target: 15 }
  if (level === 2) return { level: 3 as const, target: 25 }
  return null
}

export function getTrustScoreForAuthor(posts: QnaPost[], author: string) {
  return posts.reduce((score, post) => score + post.comments.reduce((commentScore, comment) => {
    if (comment.author !== author) return commentScore
    return commentScore + (comment.isAccepted || post.selectedAnswerCommentId === comment.id ? 3 : 0) + (comment.likes ?? 0)
  }, 0), 0)
}

export function getTrustScoreForMine(posts: QnaPost[]) {
  return posts.reduce((score, post) => score + post.comments.reduce((commentScore, comment) => {
    if (!comment.mine) return commentScore
    return commentScore + (comment.isAccepted || post.selectedAnswerCommentId === comment.id ? 3 : 0) + (comment.likes ?? 0)
  }, 0), 0)
}
