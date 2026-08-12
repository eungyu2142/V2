import { glob, readFile } from 'node:fs/promises'

const duplicateChecks = [
  ['src/components/account/StepShell.tsx', /function\s+getStepStatus\s*\(/, '공통 Stepper의 단계 상태 함수를 다시 만들었습니다.'],
  ['src/components/my-pet/PetCreateFlow.tsx', /<label className="step-field"><span>/, '공통 입력 컴포넌트 대신 중복 입력 마크업을 다시 만들었습니다.'],
  ['src/components/qna/QnaScreen.tsx', /function\s+StepText[^\n]*<label className="step-field"><span>/, 'Q&A 전용 중복 입력 마크업을 다시 만들었습니다.'],
]

const failures = []

for (const [path, pattern, message] of duplicateChecks) {
  const source = await readFile(path, 'utf8')
  if (pattern.test(source)) failures.push(`${path}: ${message}`)
}

for await (const path of glob('src/**/*.css')) {
  const normalized = path.replaceAll('\\', '/')
  if (normalized === 'src/styles/tokens.css') continue

  const source = await readFile(path, 'utf8')
  if (/#[0-9a-f]{3,8}\b/i.test(source)) {
    failures.push(`${path}: 색상값을 직접 작성했습니다. styles/tokens.css의 의미 기반 토큰을 사용하세요.`)
  }
}

const appCss = await readFile('src/App.css', 'utf8')
const screenSelector = /^\s*\.(?:map-|qna-|my-pet|auth-|profile-(?!button))/m
if (screenSelector.test(appCss)) {
  failures.push('src/App.css: 화면 전용 선택자가 다시 추가되었습니다. 해당 화면 폴더의 CSS로 옮기세요.')
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('UI 구조 검사를 통과했습니다.')
