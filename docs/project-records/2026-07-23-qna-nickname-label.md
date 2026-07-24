# Q&A 작성자 표기 닉네임 통일

## 요청 요약

- Q&A 화면에 표시되는 `작성자` 문구를 제거하고 사용자 닉네임을 표시한다.

## 분석 및 판단

게시글 카드와 상세의 본인 작성자 표시뿐 아니라 기존 댓글 payload의 `작성자` fallback도 함께 정리해야 같은 문제가 반복되지 않는다. 현재 로그인 사용자는 profile nickname을 우선 사용하고, 다른 사용자는 저장된 작성자명을 유지하되 오래된 placeholder만 일반 사용자명으로 대체했다.

## 수정 파일

- `src/App.tsx`

## 핵심 변경 내용

- `qnaDisplayAuthor` 헬퍼로 본인 게시글·댓글을 닉네임으로 표시
- 기존 `작성자`·`나` placeholder를 현재 닉네임으로 변환
- 댓글 조회 시 저장된 placeholder도 닉네임으로 보정

## 검증 결과

- `npm run lint` 통과
- TypeScript 검사 통과
- `npm run build` 통과

## 남은 작업

- 없음
