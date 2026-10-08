export type MascotMood = 'neutral' | 'happy' | 'surprised' | 'thinking' | 'sleepy' | 'heart' | 'welcome'

export default function Mascot({ mood = 'neutral', className = '' }: { mood?: MascotMood; className?: string }) {
  const source = mood === 'welcome' ? '/assets/mascot/welcome.png' : '/assets/mascot/standing.png'
  return <span className={`pajak-mascot ${className}`} role="img" aria-label="파작파작 캐릭터"><img src={source} alt="" width={1280} height={1280} decoding="async" /></span>
}
