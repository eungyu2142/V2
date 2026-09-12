export type MascotMood = 'neutral' | 'happy' | 'surprised' | 'thinking' | 'sleepy' | 'heart' | 'welcome'

// Viewports into the user's original reference, without replacement artwork.
const portraits: Record<MascotMood, string> = {
  neutral: '831 1128 58 53', happy: '898 1128 58 53',
  surprised: '966 1128 58 53', thinking: '1032 1128 58 53',
  sleepy: '1096 1128 58 53', heart: '1225 1128 64 53',
  welcome: '472 199 79 87',
}

export default function Mascot({ mood = 'neutral', className = '' }: { mood?: MascotMood; className?: string }) {
  return <span className={`pajak-mascot ${className}`} role="img" aria-label="파작파작 캐릭터"><svg viewBox={portraits[mood]} className="size-full" aria-hidden="true"><image href="/ui-flow-reference.png" width="1312" height="1199" /></svg></span>
}
