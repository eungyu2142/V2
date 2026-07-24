# Q&A 전체 사용자 흐름 개선

## 요청 요약

- Q&A 목록, 질문 작성, 질문 상세, 댓글 흐름을 기록 기반 문제 해결 흐름으로 정리한다.
- 화면 제목을 `Q&A`로 통일하고, 모바일 작성 버튼·스크롤·조회수·작성자 관리 메뉴를 개선한다.

## 분석 및 판단

- 기존 Q&A는 `community_posts`의 payload를 공통 `loadAppData`로 조회하고 댓글은 `post_comments`를 일괄 조회하는 구조였다.
- 기존 구조를 유지하면서 `view_count` 컬럼과 원자적 RPC만 추가했다.
- 다이어리에서 Q&A로 이동할 때의 `petId` 전달과 기존 기록 선택 시트를 유지하고, 목록에서 직접 작성할 때는 펫을 자동 선택하지 않도록 분리했다.
- 상세 진입 시 기록 컴포넌트의 자동 스크롤이 아니라 상세 전환 시 스크롤 초기화 부재가 핵심 원인이었고, 목록 위치를 sessionStorage에 저장해 복귀 시 복원했다.

## 수정 파일

- `src/App.tsx`
- `src/lib/appData.ts`
- `src/App.css`
- `src/features/diary/DiaryPage.tsx`
- `supabase/migrations/202607230001_qna_view_count.sql`
- `docs/project-records/2026-07-23-qna-end-to-end.md`
- `docs/project-records/QNA.md`

## 핵심 변경 내용

- 전역 헤더와 Q&A 내부 헤더 중복을 제거하고 사용자 화면 명칭을 `Q&A`로 통일했다.
- 웹은 헤더 우측 `질문 작성`, 모바일은 하단 고정 `+` FAB 하나만 사용한다.
- 검색어·상태·카테고리·정렬을 URL query string에 저장하고 검색 입력에는 debounce를 적용했다.
- 상태 필터는 전체/답변 대기/해결 완료로 노출하며 답변 있음은 카드 상태로 표시한다.
- 목록은 웹과 모바일 모두 단일 열로 변경하고 제목·본문·펫·작성자·조회수·댓글·첨부 순서로 정리했다.
- 작성자 질문은 목록과 상세 모두 점 3개 메뉴에서 수정/해결/삭제할 수 있게 했다.
- 본인 댓글 삭제를 점 3개 메뉴로 이동하고 빈 댓글 등록을 막았다.
- 상세 진입 시 최상단으로 이동하고 목록 스크롤 위치를 복원한다.
- `view_count`와 `increment_community_post_view` RPC를 추가하고 같은 세션의 같은 질문은 한 번만 증가시킨다.
- `petId` deep-link는 작성 화면에서 자동 선택하고, Q&A 목록 직접 작성은 선택 상태로 시작한다.
- 기록 첨부는 선택된 펫의 기록만 대상으로 하며 기존 기록 선택 시트와 스냅샷 저장 구조를 유지한다.

## 검증 결과

- `npm run build` 통과
- `npm run lint` 통과
- Vite chunk size 경고만 남아 있으며 기능 오류는 아님

## 남은 작업

- 인증된 실제 Supabase 환경에서 migration 적용 후 조회수 RPC와 RLS 동작 확인
- 320/360/390/430px 및 768/1024/1280px 실기기 시각 검수
