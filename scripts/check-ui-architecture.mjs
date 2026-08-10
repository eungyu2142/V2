import { readFile } from 'node:fs/promises'

const checks = [
  ['src/components/account/StepShell.tsx', /function\s+getStepStatus\s*\(/, '공통 Stepper 대신 로컬 단계 상태 함수가 다시 추가되었습니다.'],
  ['src/components/my-pet/PetCreateFlow.tsx', /<label className="step-field"><span>/, 'TextField 대신 로컬 입력 마크업이 다시 추가되었습니다.'],
  ['src/components/qna/QnaScreen.tsx', /function\s+StepText[^\n]*<label className="step-field"><span>/, 'TextField 대신 로컬 질문 입력 마크업이 다시 추가되었습니다.'],
]

const failures = []
for (const [path, pattern, message] of checks) {
  const source = await readFile(path, 'utf8')
  if (pattern.test(source)) failures.push(`${path}: ${message}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('UI architecture guard passed.')
