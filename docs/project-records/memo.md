# 개발 메모

## 데이터와 인증

- 인증은 Supabase Auth를 사용한다.
- 사용자 공개 정보는 `profiles` 테이블에서 관리한다.
- 사용자에게 이메일 입력을 요구하지 않는 아이디·비밀번호 화면을 유지한다.
- Supabase 오류가 발생해도 로컬 상태와 임시저장 데이터가 즉시 사라지지 않도록 처리한다.

## 화면 구조

- 데스크톱은 사이드바, 모바일은 하단 내비게이션을 사용한다.
- 주요 탭은 내 펫, 다이어리, 지도, Q&A다.
- 지도와 병원 리뷰는 같은 진료 흐름 안에서 연결한다.
- 작성 화면은 공통 `StepShell`을 사용한다.

## 코드 구조

- `src/components/profile/ProfileScreen.tsx`
- `src/components/my-pet/PetsScreen.tsx`
- `src/components/account/StepShell.tsx`
- `src/components/diary/DiaryScreen.tsx`
- `src/components/hospital-map/MapAndReview.ts`
- `src/features/diary`
- `src/features/hospital-map`

## 2026-07-24 문서 인코딩 정리

깨진 문장과 개발 용어를 제거하고 UTF-8 한국어로 다시 작성했다. 새 날짜별 메모 파일은 만들지 않고 `all.md`, `UI.md`, `UX.md`에 날짜 섹션을 누적한다.

## 검증

변경 후 `npm run build`를 실행해 TypeScript 검사와 Vite 번들 생성을 확인한다. 번들 크기 경고는 기능 오류가 아니므로 별도 최적화 작업으로 관리한다.


## 2026-07-26 다이어리 캘린더 화면 확장 및 기록 배지 개선

### 요청 요약

첨부 사진처럼 다이어리의 캘린더를 화면 중심으로 크게 보여주고, 상단에는 현재 동물 정보와 플랜/캘린더 전환을 유지하며, 캘린더 셀에는 기록이 저장될 때 아이콘과 기록 이름을 함께 표시하도록 요청했다. 같은 날짜에 이미 저장된 동일 기록은 다시 저장되지 않도록 막는 요구도 함께 반영했다.

### 분석·판단 이유

기존 모바일 캘린더 탭은 달력 아래에 선택 날짜 상태와 우측 패널 성격의 영역이 남아 있어 캘린더가 꽉 차 보이지 않았다. 또한 작은 화면에서 아이콘을 숨기는 CSS 규칙 때문에 기록 종류가 직관적으로 보이지 않았다. 캘린더 셀은 기록 개수가 많아질수록 배지가 작아져야 하므로 compact/tiny 상태를 추가하는 방식으로 처리했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `supabase/migrations/202607230001_expand_care_plan_task_types.sql`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 캘린더 셀의 기록 표시를 점 중심에서 아이콘과 기록 이름 배지 중심으로 변경했다.
- 한 날짜에 표시할 기록 종류가 많으면 배지 크기와 글자 크기를 단계적으로 줄이도록 CSS를 추가했다.
- 모바일 캘린더 탭에서는 계획 패널, 상황 기록, 선택 날짜 상태 영역을 숨기고 캘린더가 화면 높이를 크게 차지하도록 조정했다.
- 모바일에서도 캘린더 배지 아이콘이 다시 보이도록 기존 숨김 규칙을 캘린더 모드에서 덮어썼다.
- Smart Add와 상세 기록 작성에서 동일 날짜·동일 종류·동일 내용 기록이 이미 있으면 저장하지 않고 안내 토스트를 띄우도록 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 모바일 기기에서 캘린더 셀에 기록이 6개 이상 들어간 상태의 가독성을 확인하면 더 정확히 미세 조정할 수 있다.

## 2026-07-26 다이어리 상단 펫 정보 표시 개선

### 요청 요약

다이어리 상단에서 펫 이름만 어색하게 보이는 문제가 있었고, 사용자가 등록한 펫 사진과 종, 성별, 무게 같은 기본 정보를 함께 보여달라고 요청했다. 사진이 없을 때는 기존 기본 표시를 유지하는 조건도 반영했다.

### 분석·판단 이유

마이 펫 등록 흐름에는 `photo`, `weight`, `weightUnit`, `species`, `gender` 값이 이미 존재하지만 다이어리의 `DiaryPet` 타입과 상단 렌더링은 사진을 사용하지 않고 이모지 아이콘만 표시하고 있었다. 다이어리 화면은 현재 관리 중인 펫을 확인하는 시작점이므로, 실제 사진과 기본 정보가 상단에서 바로 보여야 한다고 판단했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DiaryPet` 타입에 `photo` 필드를 추가했다.
- 다이어리 상단과 펫 전환 메뉴에서 공통으로 쓰는 `PetAvatar` 컴포넌트를 추가했다.
- 펫 사진이 있으면 실제 등록 사진을 원형 이미지로 표시하고, 없으면 기존 동물 기본 표시를 사용한다.
- 상단 펫 정보에 분류, 종, 성별, 무게를 두 줄로 표시하도록 정리했다.
- 펫 전환 메뉴에서도 현재 펫과 다른 펫 목록에 사진과 기본 정보가 함께 보이도록 맞췄다.
- 원형 사진이 찌그러지지 않게 `object-fit: cover`와 overflow 처리를 추가했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 등록 사진이 없는 펫과 있는 펫을 각각 모바일에서 확인해 상단 높이가 충분히 안정적인지 시각 검수하면 좋다.

## 2026-07-26 다이어리 상단 펫 정보 노출 위치 수정

### 요청 요약

다이어리 화면 상단에 펫 사진과 이름, 종, 성별, 무게가 보여야 하는데 실제 화면에서는 아이콘만 단독으로 보이는 문제가 있었다. 사용자는 이 정보가 현재 보이는 상단 영역에 바로 떠야 한다고 다시 요청했다.

### 분석·판단 이유

펫이 1마리일 때는 펫 전환 메뉴 버튼이 렌더링되지 않지만, 모바일 CSS는 여전히 `42px + 나머지` 2열 구조로 고정되어 있었다. 그 결과 `diary-pet-profile`이 첫 번째 42px 칸에 갇혀 사진 또는 기본 아이콘만 보이고, 이름과 상세 정보는 화면에 드러나지 않았다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `diary-pet-bar`에 `has-menu`와 `single-pet` 상태 클래스를 추가했다.
- 펫이 1마리라 메뉴 버튼이 없을 때는 펫 프로필 영역이 전체 폭을 차지하도록 수정했다.
- 펫이 여러 마리라 메뉴 버튼이 있을 때는 버튼 옆 두 번째 칸에 펫 정보가 안정적으로 배치되도록 분리했다.
- 결과적으로 상단에 등록 사진 또는 기본 표시, 펫 이름, 분류·종, 성별·무게가 함께 보이도록 레이아웃을 고쳤다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 모바일 화면에서 펫이 1마리인 경우와 여러 마리인 경우 모두 상단 정보가 원하는 높이에 맞는지 시각 확인이 필요하다.

## 2026-07-26 루틴 추가 초기 선택 제거

### 요청 요약

루틴 추가 화면에 들어갔을 때 추천 루틴이 처음부터 선택되어 있는 동작을 제거해 달라는 요청이 있었다.

### 분석·판단 이유

루틴 추가는 사용자가 직접 필요한 항목을 고르는 흐름이다. 기존 구현은 등록 가능한 첫 번째 추천 루틴을 자동으로 `routineTypes` 초기값에 넣고 있어, 사용자가 선택하지 않았는데도 선택된 것처럼 보였다. 이는 루틴 중복 선택과 직접 선택 흐름을 헷갈리게 만들 수 있어 빈 선택 상태로 시작하도록 변경했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 새 루틴 작성 시 `routineTypes` 초기값을 빈 배열로 변경했다.
- 선택 전 안내 문구를 `추가할 루틴을 선택하세요.`로 변경했다.
- 루틴을 하나도 선택하지 않은 상태에서는 임시저장 버튼도 비활성화되도록 했다.
- 수정 화면에서는 기존 루틴이 그대로 선택되어 있도록 유지했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 화면에서 루틴 추가 진입 시 어떤 항목도 활성 색으로 보이지 않는지 모바일로 확인하면 된다.

## 2026-07-26 다이어리 펫 정보 표기 형식 수정

### 요청 요약

다이어리 상단 펫 정보에서 성별은 이름 옆에 색상으로 표시하고, 종 정보는 `파충류-카멜레온` 형식으로, 무게와 나이는 `무게 67g · 3살`처럼 보이게 해달라는 요청이 있었다.

### 분석·판단 이유

기존 상단 정보는 성별과 무게가 같은 작은 텍스트 줄에 섞여 있어 한눈에 들어오지 않았다. 성별은 이름 옆의 짧은 시각 신호가 더 직관적이고, 분류와 종은 한 줄로 묶어 보여주는 편이 현재 펫을 빠르게 확인하기 좋다고 판단했다. 나이 정보는 마이펫 등록 데이터의 `ageText`를 다이어리 타입에 추가해 연결했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DiaryPet` 타입에 `ageText`를 추가했다.
- 펫 이름 옆에 `GenderMark`를 추가해 수컷은 파란색, 암컷은 빨간색 성별 기호로 표시한다.
- 종 정보 줄을 `분류-종` 형식으로 변경했다.
- 무게와 나이를 `무게 {값}{단위} · {나이}살` 형식으로 표시하는 `formatPetMetrics`를 추가했다.
- 기존 텍스트 성별 함수는 더 이상 쓰지 않아 제거했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 마이펫에서 나이를 입력하지 않은 경우 `무게 · 나이 미입력` 문구가 화면 톤에 맞는지 실제 화면에서 확인하면 좋다.

## 2026-07-26 루틴 추가 화면 첨부 이미지 아이콘 적용

### 요청 요약

사용자가 만든 초록색 루틴 일러스트 이미지를 그대로 잘라서 루틴 추가 화면에 적용해 달라고 요청했다. 이모지나 비슷한 대체 아이콘이 아니라 첨부 이미지 자체를 항목별로 잘라 사용해야 했다.

### 분석·판단 이유

기존 루틴 추가 화면은 이모지 아이콘과 텍스트 라벨을 조합해 표시하고 있었지만, 사용자는 직접 만든 이미지의 일러스트와 라벨을 그대로 쓰길 원했다. 첨부 이미지는 투명 PNG였기 때문에 항목별로 crop한 뒤 public asset으로 저장하고, 루틴 카드에서 이미지 파일을 직접 렌더링하는 방식이 적합하다고 판단했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `public/assets/routine-icons/feed.png`
- `public/assets/routine-icons/mist.png`
- `public/assets/routine-icons/water.png`
- `public/assets/routine-icons/substrate_change.png`
- `public/assets/routine-icons/weight.png`
- `public/assets/routine-icons/humidity.png`
- `public/assets/routine-icons/temperature.png`
- `public/assets/routine-icons/full_cleaning.png`
- `public/assets/routine-icons/structure_cleaning.png`
- `public/assets/routine-icons/partial_cleaning.png`
- `public/assets/routine-icons/wall_wipe.png`
- `public/assets/routine-icons/uvb_check.png`
- `public/assets/routine-icons/custom.png`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 첨부 이미지를 13개 루틴 PNG asset으로 잘라 저장했다.
- 루틴 키별 이미지 경로를 `routineIconImages`로 매핑했다.
- 루틴 추가 카드에서 `RoutineCardIcon` 컴포넌트가 실제 PNG 이미지를 렌더링하도록 변경했다.
- 이미지 자체에 라벨이 포함되어 있어 기존 텍스트 라벨은 시각적으로 숨기고 접근성용 텍스트로만 유지했다.
- 선택 상태에서도 원본 이미지 색을 유지하고, 테두리와 연한 배경으로만 선택됨을 표시하도록 조정했다.
- 루틴 추가 화면은 더 보기 없이 전체 루틴 이미지를 한 번에 보여주도록 유지했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 모바일 화면에서 각 crop 영역이 사용자가 의도한 그림과 정확히 맞는지 눈으로 확인하고, 필요하면 crop 좌표를 미세 조정하면 된다.

## 2026-07-26 펫 전환 메뉴 정보 표시 수정

### 요청 요약

펫 전환 메뉴 상단 문구를 `현재 선택된 펫: ~~` 형식으로 바꾸고, 목록 선택 항목에서는 말줄임이 아니라 이름, 성별 색상 표시, 종 이름이 제대로 보이도록 수정해 달라는 요청이 있었다.

### 분석·판단 이유

펫 전환 메뉴 CSS에서 `.diary-pet-menu nav span` 선택자가 너무 넓게 적용되어 아바타뿐 아니라 이름 줄의 `span`에도 원형 아바타 스타일이 먹고 있었다. 그 결과 이름이 작은 원형 영역에 갇혀 `도...`처럼 보였다. 아바타 전용 선택자로 범위를 좁히고, 이름 줄과 종 이름을 각각 그리드 2열의 1행·2행으로 배치하도록 수정했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 메뉴 상단 문구를 `현재 선택된 펫: {펫 이름}`으로 변경했다.
- 펫 목록 항목에서 이름 옆에 성별 기호가 색상으로 표시되도록 기존 `GenderMark` 구조를 유지했다.
- 펫 목록 하단 정보는 종 이름만 보여주도록 정리했다.
- `.diary-pet-menu nav span`을 `.diary-pet-menu nav .diary-pet-avatar`로 좁혀 이름 줄이 아바타 스타일을 받지 않게 했다.
- 펫 목록 버튼 내부를 사진, 이름+성별, 종 이름의 2행 레이아웃으로 고정했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 모바일에서 이름이 긴 펫을 선택했을 때 어느 지점부터 말줄임이 자연스럽게 걸리는지 확인하면 된다.
## 2026-07-26 다이어리 루틴 버튼 이미지 크기 수정

### 요청 요약

사용자가 루틴 버튼 크기가 너무 크다고 지적했고, 세 번째로 보낸 컬러 이미지 스타일을 그대로 쓰되 크기를 줄여 달라고 요청했다.

### 분석·판단 이유

현재 루틴 추가 화면은 그림형 선택 버튼을 사용하기 때문에 카드가 커지면 화면을 너무 많이 차지한다. 사용자가 원하는 것은 이미지 자체를 바꾸는 것이 아니라 세 번째 이미지의 느낌을 유지하면서 선택 버튼 밀도를 높이는 것이므로 CSS 크기 조정으로 해결하는 것이 맞다.

### 수정 파일

- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 루틴 카드 버튼의 최소 높이를 줄였다.
- 잘라 둔 세 번째 컬러 PNG 아이콘의 표시 최대 크기를 줄였다.
- 루틴 버튼에서 빠져 있던 `RoutineCardIcon` 렌더링을 다시 넣어 실제 컬러 이미지가 보이게 했다.
- 모바일에서는 2열 카드가 너무 크게 보이지 않도록 별도 이미지 크기를 낮췄다.
- 아이콘 이미지는 기존처럼 세 번째 이미지에서 잘라낸 자산을 그대로 사용한다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 화면에서 여전히 크다고 느껴지면 이미지 높이를 더 줄이고 카드 여백을 한 단계 더 낮춘다.
## 2026-07-26 사이드바 px 기준 제거 및 비율 보정

### 요청 요약

사이드바가 다이어리 본문을 덮는 문제를 보고, px가 아니라 `%`로 비율을 맞춰야 한다고 요청했다.

### 분석·판단 이유

CSS 하단에 레이아웃 오버라이드가 여러 번 누적되어 있었고, 일부는 px/clamp 기반, 일부는 % 기반이었다. 이 상태에서는 브라우저 폭이 바뀔 때 사이드바 끝 위치와 본문 시작 위치가 다르게 계산된다. 최종 오버라이드를 파일 아래에 추가해 같은 비율 변수로 사이드바와 본문을 같이 움직이게 했다.

### 수정 파일

- `src/App.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 데스크톱용 최종 ratio layout guard를 추가했다.
- 사이드바 왼쪽 위치와 폭을 `%` 변수로 계산한다.
- 본문 padding-left는 사이드바 left + width + gap의 합산 비율로 계산한다.
- 1100px 이상에서는 넓은 화면용 비율을 따로 둬 본문이 지나치게 오른쪽으로 밀리지 않게 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 화면에서 아직 겹치면 `--content-gap-ratio`만 소폭 올리면 된다.
## 2026-07-26 다이어리에서 마이 펫 AI 사진 재사용

### 요청 요약

마이 펫에 있는 AI 기본 사진을 다이어리에서도 그대로 활용해 달라고 요청했다.

### 분석·판단 이유

마이 펫은 사진이 없는 파충류와 양서류 펫에 기본 AI 이미지를 사용하지만, 다이어리는 이모지로 표시하고 있었다. 같은 동물이 화면마다 다르게 보이면 사용자가 현재 선택된 펫을 헷갈릴 수 있으므로, 다이어리도 마이 펫과 같은 이미지 기준을 쓰도록 정리했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `PetAvatar`에서 사용자 사진이 있으면 그대로 표시한다.
- 사용자 사진이 없으면 `defaultPetImage`로 마이 펫과 같은 기본 이미지를 사용한다.
- 양서류는 `/assets/pet-default-amphibian.png`, 그 외는 `/assets/pet-default-reptile.png`를 사용한다.
- 기본 이미지도 아바타 안에서 꽉 차게 보이게 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 UI에서 기본 이미지가 너무 확대되어 보이면 crop이나 object-position을 미세 조정한다.
## 2026-07-26 양서류 탈피 상황 기록 추가

### 요청 요약

양서류도 탈피하므로 다이어리 상황 기록에 탈피 추가 버튼을 넣어 달라고 요청했다.

### 분석·판단 이유

코드를 확인해보니 탈피 버튼이 파충류일 때만 보이도록 조건이 제한되어 있었다. 양서류도 같은 탈피 기록 흐름을 사용할 수 있으므로 조건을 파충류 또는 양서류로 확장했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `IncidentAddBar`에서 `petGroup === 'reptile'` 조건을 `reptile` 또는 `amphibian`으로 변경했다.
- 양서류에서도 `탈피 추가` 버튼이 표시된다.
- 저장 로직은 기존 탈피 Smart Add를 그대로 사용한다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 화면에서 양서류 펫을 선택하고 탈피 기록이 정상 저장되는지 확인한다.
## 2026-07-26 먹이 주기 루틴 먹이 종류 선택 저장

### 요청 요약

다이어리의 `먹이 주기` 루틴을 완료할 때 바로 체크 완료하지 말고, 도마뱀 하위 분류에 맞는 먹이 종류를 선택한 뒤 기록 완료되도록 요청했다. 수량, g, ml, 마리 수 같은 입력은 넣지 말라고 했다.

### 분석·판단 이유

현재 루틴 완료 구조는 체크형 루틴을 바로 완료 처리하고 기록을 생성한다. 하지만 먹이 루틴은 실제로 무엇을 먹였는지가 기록 가치가 있으므로, `feed` 타입만 별도 선택 UI를 열고 먹이 배열을 저장하도록 예외 처리했다. 기존 기록의 `foods?: string[]`는 유지하고, 새 구조를 위해 `feedingFoods?: FeedingFoodItem[]`를 선택 필드로 확장했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `src/features/diary/diaryTypes.ts`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `FeedingFoodItem` 타입을 추가했다.
- `PetRecord`에 `feedingFoods?: FeedingFoodItem[]` 선택 필드를 추가했다.
- `FOOD_OPTIONS_BY_LIZARD_TYPE`와 `GECKO_FOOD_OPTIONS_BY_SPECIES` 설정 객체를 추가했다.
- 크레스티드, 가고일, 차화, 데이 게코에는 `게코 전용 푸드`가 포함된다.
- 레오파드, 팻테일, 바이퍼, 토케이 게코에는 `게코 전용 푸드`가 표시되지 않는다.
- 모니터, 카멜레온, 이구아나, 스킨크, 유로매스틱스 후보를 분리했다.
- `기타 직접 입력`은 모든 목록 마지막에 포함된다.
- 두비아와 레드러너는 기본 후보에 넣지 않았다.
- 먹이 루틴 저장은 `saveAppData('care_records')`를 먼저 완료한 뒤 UI에 반영한다.
- DailyTask 기반 루틴은 기록 저장 후 `markDailyTaskCompleted`로 완료 상태를 갱신한다.
- 기존 `foods` 배열만 있는 과거 기록은 그대로 표시되고, 새 `feedingFoods`가 있으면 그 값을 우선 표시한다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- 다이어리 코드에서 `두비아`, `레드러너`, `dubia`, `redrunner`, `red_runner` 검색 결과 없음

### 남은 작업

- 현재 펫 등록 구조는 도마뱀 하위 분류 value를 별도 저장하지 않으므로 species 문자열로 판별한다. 추후 `lizardType`, `geckoSpeciesKey` 같은 필드가 생기면 이 분기를 DB value 기반으로 바꾸는 것이 더 정확하다.
## 2026-07-26 플랜 화면 불필요 문장 삭제

### 요청 요약

사용자가 이미지에서 표시한 두 보조 문구를 삭제해 달라고 요청했다.

### 분석·판단 이유

오늘 할 일 카드와 상황 기록 추가 카드는 사용 빈도가 높은 영역이다. 이미 제목과 버튼이 있어서 설명 문구가 없어도 의미가 전달되므로, 반복 화면의 밀도를 낮추기 위해 제거했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `이 동물에게 필요한 반복 루틴을 먼저 만들어주세요.` 삭제
- `필요할 때만 기록하세요.` 삭제
- 핵심 제목과 버튼은 유지

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 없음
## 2026-07-26 다이어리 환경 기록 자동 판정 구현 메모

### 요청 요약

- 마이 펫 등록 정보와 다이어리 루틴을 연결해 파충류·양서류 종별 온도, 수온, 습도 기준을 자동 적용하라는 요청이었다.
- 정상 범위 판정, 5단계 위험 게이지, 반복 이상 단계 상승, 날짜별 기록 저장, 그래프 연동까지 포함된 작업이었다.

### 분석·판단 이유

- 기존 루틴 완료 구조는 체크형과 기록형이 섞여 있어, 온도·습도 루틴을 바로 완료하면 핵심 값이 빠진 기록이 생긴다.
- 따라서 `temperature`, `humidity` 루틴만 예외 처리해 입력 모달을 열고, 저장 성공 후에만 완료 상태와 기록을 반영하도록 했다.
- Supabase 저장 구조는 기존 `care_records` 저장 흐름을 유지하고, 프론트 타입에 `environmentRecord` 선택 필드를 추가하는 방식으로 호환성을 지켰다.

### 수정 파일

- `src/features/diary/diaryTypes.ts`
- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `EnvironmentProfile`, `EnvironmentRecord`, `EnvironmentRiskResult`, `RiskLevel` 개념을 추가했다.
- 환경 프로필 상수 `ENVIRONMENT_PROFILES`에 요청된 파충류·양서류 기준값을 등록했다.
- species 문자열에서 게코 세부 종, 도마뱀 하위 분류, 양서류 분류를 찾아 환경 프로필을 연결한다.
- 온도·수온·습도 입력 모달에서 기본값은 프로필 대표값으로 시작한다.
- 위험 단계는 정상 범위 이탈 정도와 같은 방향의 최근 이상 기록을 기준으로 계산한다.
- 기록 상세와 캘린더 요약에서 환경 기록값과 위험 단계가 보이게 했다.
- 데이터 시각화 화면에 온도·수온, 습도 꺾은선 그래프를 추가하고, 기록 당시 정상 범위 선을 함께 표시했다.
- 수생 양서류용 `수질 확인`, `여과기 상태 확인` 루틴이 DB 제약에서 막히지 않도록 care plan task type 마이그레이션을 확장했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- 빌드 중 Vite chunk size 경고만 있으며 이번 기능 오류는 아니다.

### 남은 작업

- 현재 DB에는 종 하위 분류 key가 별도 필드로 확정되어 있지 않아 species 텍스트를 기반으로 매칭한다.
- 추후 `lizardType`, `geckoSpeciesKey`, `amphibianType` 같은 저장 필드가 생기면 프로필 연결을 텍스트 추론이 아닌 DB value 기반으로 바꾸는 것이 좋다.
## 2026-07-26 루틴 생성 UI 정리 메모

### 요청 요약

- 루틴 생성 화면에서 공통 라벨, 중복 직접 입력 문구, 시작일 입력, 검은색 버튼을 제거하고 필수 항목은 빨간 별로 표시하라는 요청이었다.
- 습도 입력 화면에서는 위험 경고가 저장 전에 보이지 않게 하고, 경고는 캘린더 기록 상세에서 보이게 하라는 요청이었다.

### 분석·판단 이유

- 사용자가 루틴을 만들 때는 추천 루틴 버튼과 반복 요일만 빠르게 선택하면 충분하다.
- 시작일은 오늘부터 시작하는 정책이므로 UI에서 제거해도 저장 데이터에는 오늘 날짜를 넣을 수 있다.
- 환경 위험 메시지는 값 입력 중에 바로 노출되면 화면을 가리고 부담스럽기 때문에 저장된 기록을 확인할 때 보여주는 쪽이 맞다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `공통`, 별도 `직접 입력` 섹션 제목을 제거했다.
- 시작일 입력 UI를 제거하고 내부 상태는 오늘 날짜 기본값을 유지했다.
- 필수 항목인 루틴 종류와 반복 요일에 빨간 별을 붙였다.
- 루틴 작성 하단 버튼 색상을 검은색이 아닌 민트 계열로 정리했다.
- 오늘 할 일 목록의 긴 입력 방식 설명을 제거했다.
- 추천 루틴 기본 목록에서 무게 측정과 UVB 확인을 제거했다.
- 환경 입력 모달의 위험 게이지와 긴 안내 문구를 제거했다.
- 저장된 환경 기록 상세에서는 위험 단계와 안내 문구를 계속 확인할 수 있게 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- Vite chunk size 경고만 있으며 이번 UI 변경과 직접 관련된 오류는 없다.

### 남은 작업

- 기존에 이미 저장된 무게 측정, UVB 확인 루틴은 데이터로 남아 있으므로 필요하면 별도 비활성화 처리가 필요하다.
## 2026-07-26 캘린더 기록 태그 수정 메모

### 요청 요약

- 저장된 기록이 캘린더에서 `기...`처럼 보이는 문제와 날짜 클릭 시 배경이 칠해지는 문제를 수정하라는 요청이었다.

### 분석·판단 이유

- 습도 같은 환경 기록은 `other` 타입으로 저장되기 때문에 기존 캘린더 표시 로직에서는 `기록`으로만 보였다.
- 캘린더 셀은 좁기 때문에 구체적인 짧은 이름과 테두리형 태그가 더 적합하다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `calendarRecordTag` 헬퍼를 추가해 캘린더 표시 라벨을 기록 내용 기준으로 분기했다.
- 환경 기록은 `습도`, `온도`, `수온`으로 표시한다.
- 물 관련 기타 기록은 `물`로 표시한다.
- 선택된 날짜는 배경 없이 테두리만 강조한다.
- 캘린더 기록 태그는 투명 배경과 얇은 테두리로 변경했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 기록이 한 날짜에 많이 쌓일 때 어떤 순서로 우선 표시할지 정책을 더 정할 수 있다.
## 2026-07-26 마지막 펫 유지와 메이팅·산란 기록 메모

### 요청 요약

- 다이어리에서 다른 화면으로 이동했다가 돌아왔을 때 첫 번째 펫으로 바뀌지 않고 마지막으로 접근한 펫을 유지해야 한다.
- 상황 기록에 메이팅과 산란을 추가해야 한다.
- 메이팅은 같은 종 암컷과 수컷을 선택하고, 산란은 메이팅 기록이 있는 종에서 선택하도록 한다.

### 분석·판단 이유

- 기존 다이어리는 `initialPetId`가 없으면 첫 번째 펫을 기본값으로 사용해서 화면 복귀 시 선택 펫이 바뀌었다.
- 사용자가 마지막으로 만진 펫은 사용자별 로컬 상태로 기억하는 것이 적합하다.
- 메이팅과 산란은 DB 타입을 새로 만들기보다 기존 `care_records`의 `other` 기록으로 저장하면 기존 달력과 상세 기록 흐름을 그대로 재사용할 수 있다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `src/components/my-pet/PetCreateFlow.tsx`
- `src/components/qna/QnaScreen.tsx`
- `src/features/hospital-map/HospitalReviewForm.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `exocare:last-diary-pet:{userId}` 키로 마지막 다이어리 펫 ID를 저장한다.
- 다이어리 초기 선택은 `initialPetId`가 있으면 우선 사용하고, 없으면 저장된 마지막 펫 ID를 사용한다.
- 마지막 펫이 현재 펫 목록에 없으면 첫 번째 등록 펫으로 대체한다.
- 상황 기록 종류에 `mating`, `egg`를 추가했다.
- 같은 species를 가진 펫 중 암컷과 수컷만 메이팅 후보로 보여준다.
- 산란은 `메이팅 · ...` memo를 가진 기존 기록 중 같은 종 기록만 선택 가능하게 했다.
- 캘린더 태그 라벨에 메이팅과 산란을 추가했다.
- 전체 빌드를 막던 기존 draft prop 타입 누락도 optional prop으로 보강했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- Vite chunk size 경고만 있으며 이번 기능 오류는 아니다.

### 남은 작업

- 현재 메이팅 기록은 선택 중인 펫의 기록으로 저장된다. 선택한 암컷/수컷 양쪽 기록에 동시에 남길지 여부는 추후 정책 결정이 필요하다.
## 2026-07-26 상황별 기록 문구 변경 메모

### 요청 요약

- `상황 기록 추가` 대신 `상황별 기록`으로 바꾸고, 상황 기록 버튼에서 `추가` 문구를 제거하라는 요청이었다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 상황 기록 영역 제목을 `상황별 기록`으로 변경했다.
- `배변`, `탈피`, `메이팅`, `산란` 버튼명을 짧게 정리했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
## 2026-07-28 다이어리 상황별 기록 이미지 아이콘 적용 메모

### 요청 요약

- 첨부된 이미지 속 아이콘을 다이어리 이모지 대신 교체.
- 아이콘 순서는 배변, 탈피, 메이팅, 산란, 약, 진료 기록.

### 분석·판단 이유

- `DiaryPage.tsx`의 `IncidentAddBar`가 상황별 기록 버튼마다 이모지를 직접 넣고 있었다.
- 달력 태그의 `calendarRecordTag`도 일부 상황 기록을 이모지로 표시하고 있어, 버튼만 바꾸면 저장 후 표시가 다시 이모지로 돌아가는 문제가 생길 수 있었다.
- 따라서 버튼과 캘린더 태그 양쪽에서 같은 이미지 에셋을 참조하도록 바꾸는 것이 맞다고 판단했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `public/assets/incident-icons/poop.png`
- `public/assets/incident-icons/shed.png`
- `public/assets/incident-icons/mating.png`
- `public/assets/incident-icons/egg.png`
- `public/assets/incident-icons/medicine.png`
- `public/assets/incident-icons/hospital.png`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 첨부 이미지 `codex-clipboard-91d92e32-6a85-4aee-986a-7834e96ee2bb.png`에서 6개 아이콘을 잘라 `public/assets/incident-icons`에 저장했다.
- `incidentIconSrc` 맵을 추가해 상황별 기록 종류와 이미지 경로를 연결했다.
- `IncidentAddBar`의 이모지 `span`을 `img` 렌더링으로 교체했다.
- `calendarRecordTag`에서 배변, 탈피, 메이팅, 산란, 약, 진료 기록은 이미지 아이콘을 같이 반환하게 했다.
- CSS에서 버튼 아이콘과 달력 태그 아이콘 크기를 각각 분리했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과
- Vite chunk size 경고만 있으며 이번 아이콘 교체와 직접 관련된 오류는 없다.

### 남은 작업

- 실제 화면에서 아이콘 원본의 여백이 많거나 작게 보이면 crop 영역 또는 CSS 크기를 추가 조정한다.
## 2026-07-28 데이터 시각화와 상단 경고 박스 구현 메모

### 요청 요약

- 데이터 시각화 기준을 탈피 주기, 온습도 변화, 체중 변화, 배변 상태로 바꾸기.
- 체중 급변, 온습도 이상, 탈피 예상, 배변 상태 반복은 알람이 아니라 다이어리 상단 박스에 표시하기.

### 분석·판단 이유

- 기존 `DataVisualization`은 날짜별 기록 빈도 그래프라 사용자가 말한 관리 지표와 맞지 않았다.
- 온습도 기록에는 이미 `environmentRecord.riskLevel`이 저장되므로 이 값을 재사용하는 것이 안정적이다.
- 체중, 탈피, 배변은 기존 기록 타입과 memo 값을 이용해 계산할 수 있어 DB 변경 없이 구현 가능했다.
- Q&A 연결 버튼은 이전에 제거 요청이 있었기 때문에 버튼을 다시 만들지 않고, 안내 문구로만 질문 또는 병원 상담 확인을 유도했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DiaryInsight`, `DiaryInsightLevel` 타입을 추가했다.
- `DiaryInsightBanner`를 추가해 다이어리 상단에 상태 변화 경고를 표시한다.
- `buildWeightInsight`, `buildEnvironmentInsight`, `buildShedInsight`, `buildPoopInsight` 계산 함수를 추가했다.
- 체중은 최근 두 기록의 변화율을 계산한다.
- 온습도는 최근 이상 기록의 위험 단계를 표시한다.
- 탈피는 탈피 완료 기록 간 평균 간격으로 다음 시기를 추측한다.
- 배변은 최근 5개 기록에서 묽음 또는 딱딱함 반복을 확인한다.
- 데이터 시각화 화면은 탈피 주기, 온습도 변화, 체중 변화, 배변 상태 그래프 중심으로 재구성했다.
- 배변 선택지를 평범, 묽음, 딱딱으로 정리하고 기존 정상/단단함 기록은 분석에서 호환 처리했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 사용 데이터에서 체중 급변 기준 5%, 10%가 너무 민감하거나 둔감하면 조정해야 한다.
- 탈피 예측은 기록이 2개 이상 있어야 동작하므로 첫 기록만 있는 경우에는 예측하지 않는다.
## 2026-07-28 기록 모아보기와 Q&A 연결 작업 메모

### 요청 요약

- 루틴 추가 버튼은 검은색 계열 배경에 흰색 폰트로 변경.
- 오늘 할 일 칸을 큰 화면에서 더 크게 표시.
- 데이터 시각화가 아니라 기록 모아보기로 변경.
- 탈피, 온습도, 체중, 배변 버튼을 선택하면 해당 그래프가 나오게 변경.
- 기록 모아보기에서 Q&A 작성하기로 이동 가능하게 구현.

### 분석·판단 이유

- `DiaryPage` 내부의 기존 `visualizationOpen` 화면을 재사용하면 별도 라우트 없이 빠르게 기록 모아보기 흐름을 만들 수 있다.
- `App.tsx`에는 이미 `openQnaCreate(petId)`가 있어, 다이어리에서 `onCreateQna` prop으로 전달하면 현재 펫 기준 Q&A 작성 화면을 열 수 있다.
- Q&A 작성 플로우에는 기존에 `initialPetId`가 있을 때 최근 30일 기록을 자동 첨부하는 로직이 있으므로 이 흐름과 연결했다.

### 수정 파일

- `src/App.tsx`
- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DiaryPage`에 `onCreateQna` prop을 추가했다.
- `App.tsx`에서 다이어리에 `openQnaCreate`를 전달했다.
- 기록 모아보기 화면 헤더에 `Q&A 작성하기` 버튼을 추가했다.
- `데이터 시각화` 문구를 `기록 모아보기`로 변경했다.
- 탈피, 온습도, 체중, 배변 탭을 추가했다.
- 선택 탭에 따라 해당 그래프만 표시한다.
- 첫 진입 시 선택된 탭에 기록이 없으면 기록이 있는 첫 탭을 자동으로 보여준다.
- 루틴 추가 버튼의 대비와 크기를 높이고 오늘 할 일 패널의 최소 높이를 키웠다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- Q&A 작성 화면에서 마지막 단계로 바로 진입하는 UX는 기존 요구와 연결되어 있으나, 이번 변경에서는 기존 자동 첨부 흐름을 재사용했다.
## 2026-07-28 기록 모아보기 버튼만 남긴 작업 메모

### 요청 요약

- 우측 기록 패널에서 `기록 모아보기` 버튼 하나만 남기기.

### 분석·판단 이유

- 선택 날짜 상세는 달력 날짜 재클릭으로 진입하는 흐름이 이미 있으므로, 우측 패널에 날짜별 기록 제목과 설명을 계속 보여줄 필요가 없다.
- 버튼 하나만 남기면 화면이 덜 복잡하고 다음 행동이 명확해진다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `record-list-panel` 내부의 제목, 기록 개수, 설명 문장을 제거했다.
- `record-collection-entry` 클래스를 추가해 버튼 하나가 패널 폭을 채우게 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 없음.
## 2026-07-28 기록 모아보기 박스 제거와 루틴 버튼 색상 복구 메모

### 요청 요약

- `루틴 추가`는 배경색 원상 복귀, 검은 글씨만 흰색으로 변경.
- 사진 속 `기록 모아보기` 버튼 주변 박스를 없애고 버튼 하나만 상단에 두기.

### 분석·판단 이유

- 이전 CSS override가 버튼 배경까지 `--color-primary-900`으로 바꿔 사용자 의도보다 강하게 적용됐다.
- `record-list-panel`은 공통 카드 스타일 묶음에 포함되어 있어 버튼 하나만 남겨도 카드 박스가 계속 보였다.
- 따라서 해당 패널을 공통 카드 스타일에서 제외하고 별도 투명 패널로 처리했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `루틴 추가` 버튼의 배경과 border는 `--diary-accent`로 복귀했다.
- `루틴 추가` 글씨는 흰색으로 변경했다.
- `record-list-panel`의 border, background, padding, shadow를 제거했다.
- `기록 모아보기` 버튼을 `DailyPlan` 위로 이동했다.
- 모바일 플랜 화면에서 `record-list-panel`을 숨기던 규칙을 제거했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과

### 남은 작업

- 없음.
## 2026-07-28 경고 박스 조건부 노출 메모

### 요청 요약

- 경고 메시지 영역은 평소에 숨기고, 경고가 있을 때만 표시.
- 그라데이션과 설명 문구 제거.

### 분석·판단 이유

- `DiaryInsightBanner`가 인사이트가 없어도 빈 상태 안내를 렌더링하고 있어 상단 공간을 계속 차지했다.
- 사용자는 빈 상태 안내가 아니라 실제 변화 경고만 원하므로, 인사이트가 없을 때는 아무것도 렌더링하지 않도록 바꿨다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DiaryInsightBanner`에서 `insights.length === 0`이면 `null` 반환.
- `.diary-insight-banner.empty` 관련 스타일을 제거했다.
- `.diary-insight-banner` 배경을 그라데이션이 아닌 `var(--color-surface)`로 변경했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과
- `cmd /c npm.cmd run lint` 통과
- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 없음.
## 2026-07-28 게코·거북 루틴 제외와 비어디드래곤 추가 메모

### 요청 요약

- 게코에게 물그릇 교체 루틴 제거.
- 수생거북, 반수생거북에게 분무와 물그릇 교체 루틴 제거.
- 비어디드래곤 환경 기준과 먹이 후보 추가.
- 모든 파충류와 양서류에게 귀뚜라미, 밀웜, 누에를 기본 먹이 후보로 고정.

### 분석·판단 이유

- 추천 루틴은 실제 저장된 기존 루틴을 삭제하지 않고, 새 루틴 추가 화면에서 보여줄 후보만 제어하는 것이 안전하다.
- 먹이 후보는 목록별로 중복 추가하면 빠뜨리기 쉬워서 `withFixedHerpFoodOptions`로 최종 반환 단계에서 보정했다.
- 비어디드래곤은 기존 `lizardGroups`에는 있었지만 다이어리 환경 프로필과 먹이 후보에는 별도 키가 없어 추가가 필요했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `ENVIRONMENT_PROFILES.bearded_dragon` 추가.
- `getEnvironmentProfileKey`와 `getLizardType`에서 비어디드래곤을 인식하게 변경.
- `FOOD_OPTIONS_BY_LIZARD_TYPE.bearded_dragon` 추가.
- `isGeckoPet`, `isAquaticTurtlePet` 추가.
- `routineRecommendationsForPet`에서 게코와 수생·반수생거북 예외 처리.

## 2026-07-28 수생·반수생 거북과 데이게코 환경 데이터 메모

- 요청 요약
  - 수생거북은 습도 확인과 온도 확인을 빼고 수온 확인을 넣어야 한다.
  - 반수생거북은 기존 루틴 흐름을 유지하면서 수온 확인도 추가해야 한다.
  - 데이게코는 평균 적정온도 27도, 정상 온도 약 24~30도, 적정 습도 40~75%로 등록해야 한다.
- 분석·판단
  - 기존 구조는 `temperature` 하나를 프로필에 따라 온도 또는 수온으로 바꾸는 방식이라, 반수생거북처럼 온도와 수온이 동시에 필요한 상황을 표현하기 어렵다.
  - 따라서 `water_temperature` 루틴 타입을 추가하고, 환경 기록 저장 시에는 기존 `temperature` metric으로 저장하되 measurementType을 `water`로 저장하는 방식이 기존 그래프·기록 구조와 가장 호환성이 좋다.
- 수정 파일
  - `src/features/diary/DiaryPage.tsx`
  - `src/features/diary/diaryTypes.ts`
  - `docs/project-records/UI.md`
  - `docs/project-records/UX.md`
  - `docs/project-records/memo.md`
- 핵심 변경 내용
  - 데이게코 환경 프로필을 `ENVIRONMENT_PROFILES.day_gecko`로 추가했다.
  - `water_temperature` 루틴 타입과 `수온 확인` 메타를 추가했다.
  - 수생거북은 추천 루틴에서 온도, 습도, 분무, 물그릇 교체를 제외하고 수온 확인을 넣었다.
  - 반수생거북은 기존 추천 루틴에 수온 확인을 추가했다.
  - 수생거북에 이미 만들어진 온도·습도 루틴은 다이어리 표시 단계에서 숨기도록 했다.
- 검증 결과
  - `npx tsc -b` 통과.
- 남은 작업
  - 실제 Supabase 데이터에서 기존 care_plans의 task_type 문자열로 `water_temperature`가 저장되고 daily_tasks materialize RPC가 그대로 처리하는지 실계정에서 확인하면 좋다.

## 2026-07-28 종별 케어 기준 데이터 백엔드화 메모

- 요청 요약
  - 마이 펫 등록 프론트엔드에 있는 종 중 적정 온습도와 먹이 데이터가 없는 것이 있는지 확인.
  - 루틴 작성 버튼이 종마다 비슷하거나 완전히 다른 경우를 이전에 준 데이터 기준으로 반영했는지 확인.
  - 해당 기준 데이터를 백엔드에 넣어 온도 루틴과 경고 메시지에서 그때그때 써먹게 해 달라는 요청.
- 분석·판단
  - 등록 화면 기준 종은 게코류, 비어디드래곤, 모니터, 카멜레온, 이구아나, 스킨크, 유로매스틱스, 뱀 3종, 거북 3종, 개구리·도롱뇽 계열이다.
  - 기존 다이어리는 도마뱀과 양서류 중심 상수로 동작했고, 뱀과 거북은 온습도 정상 범위가 없었다.
  - 정확한 수치가 없는 종에 임의 정상 범위를 넣으면 경고 메시지가 잘못된 관리 판단으로 이어질 수 있으므로, 백엔드 행은 만들되 환경 프로필은 `null`로 둔다.
- 수정 파일
  - `src/features/diary/speciesCareProfiles.ts`
  - `src/features/diary/DiaryPage.tsx`
  - `supabase/migrations/202607280001_species_care_profiles.sql`
  - `docs/project-records/UI.md`
  - `docs/project-records/UX.md`
  - `docs/project-records/memo.md`
- 핵심 변경 내용
  - `species_care_profiles` 테이블 마이그레이션을 추가했다.
  - 종별 aliases, 환경 프로필, 먹이 후보, 추천 루틴 타입을 seed 데이터로 넣었다.
  - 프론트에는 동일 구조의 fallback 기준 데이터를 추가했다.
  - 다이어리는 Supabase에서 기준 데이터를 불러와 루틴 추천, 먹이 선택, 온습도 입력에 사용하고, 실패하면 fallback을 사용한다.
  - `care_plans.task_type` 체크 제약에 `water_temperature`를 추가했다.
- 현재 빠진 데이터
  - 뱀 3종: 스네이크, 파이톤, 보아의 자동 온습도 정상 범위 없음.
  - 거북 3종: 육지거북, 수생거북, 반수생 거북의 자동 온습도/수온 정상 범위 없음.
  - 양서류 먹이는 현재 종별 세분화가 아니라 공통 기본 먹이 후보 중심이다.
- 검증 결과
  - `npx tsc -b` 통과.
- 남은 작업
  - Supabase에 마이그레이션 적용 필요.
  - 뱀/거북의 정확한 정상 범위를 받으면 DB seed와 fallback 데이터에 추가해야 한다.

## 2026-07-28 탈피 진행 확인과 거북 기준 추가 메모

- 요청 요약
  - 기록 모아보기의 `Q&A 작성하기` 버튼을 구석에 두지 말고 루틴 추가와 같은 색으로 제목 옆에 배치.
  - 탈피 기록에서 `부분 탈피` 삭제.
  - `탈피 중` 기록 후 완료 전까지 상단 경고 영역에 `탈피가 완료됐나요?`와 `예/아니요` 버튼 표시.
  - 완료 안 됨 상태가 5일, 8일, 11일, 14일, 20일을 넘으면 각각 1~5단계 경고.
  - 수생거북, 반수생거북, 육지거북의 온도·습도·먹이 기준 추가.
- 분석·판단
  - 탈피 중 상태는 사용자가 다음 행동을 확인해야 하는 진행 상태이므로 일반 인사이트보다 먼저 보여야 한다.
  - 앱 밖 푸시 알림은 별도 권한과 서비스 워커 구조가 필요하므로, 이번에는 사용자가 요청한 경고 창 영역에 확인 카드와 응답 버튼을 구현했다.
  - 거북 데이터는 이전에 비워둔 상태였지만 이번에 사용자가 수치를 제공했으므로 프론트 fallback과 Supabase seed를 모두 갱신했다.
- 수정 파일
  - `src/features/diary/DiaryPage.tsx`
  - `src/features/diary/DiaryPage.css`
  - `src/features/diary/speciesCareProfiles.ts`
  - `supabase/migrations/202607280001_species_care_profiles.sql`
  - `docs/project-records/UI.md`
  - `docs/project-records/UX.md`
  - `docs/project-records/memo.md`
- 핵심 변경 내용
  - `DiaryInsightBanner`에 탈피 확인 action 버튼을 추가했다.
  - `getOngoingShedRecord`, `shedDelayLevel`을 추가해 진행 중 탈피와 지연 단계를 계산한다.
  - `saveShedCheckRecord`를 추가해 예/아니요 응답을 오늘 날짜 기록으로 저장한다.
  - Smart Add와 상세 기록 작성의 탈피 선택지에서 `부분 탈피`를 제거했다.
  - 기록 모아보기의 Q&A 버튼을 본문 헤더로 이동했다.
  - 수생거북은 수온 25도, 22~27도, 습도 없음, 먹이 거북이 전용사료·귀뚜라미·수초로 갱신했다.
  - 반수생거북은 온도 25도, 22~25도, 습도 없음, 먹이 거북이사료·귀뚜라미·밀웜·채소로 갱신했다.
  - 육지거북은 온도 23도, 20~25도, 습도 40~60%, 먹이 채소로 갱신했다.
- 검증 결과
  - `npx tsc -b` 통과.
- 남은 작업
  - Supabase 마이그레이션 적용 후 DB seed가 실제 프로젝트에 반영되는지 확인해야 한다.
  - 앱 밖 푸시 알림이 필요하면 별도 Notification/Service Worker 설계가 필요하다.

## 2026-07-28 DB 반영 상태와 탈피 버튼 스타일 메모

- 요청 요약
  - 종별 온습도·먹이·루틴 정보를 실제 DB에 넣는 구조인지 확인.
  - 탈피 경고 카드의 `예`, `아니요` 버튼이 기본 버튼처럼 보이는 문제 수정.
- 분석·판단
  - 현재 정보는 `supabase/migrations/202607280001_species_care_profiles.sql`에 테이블 생성과 seed 데이터로 작성되어 있다.
  - 실제 원격 Supabase DB에 들어가려면 마이그레이션 적용 명령을 실행해야 한다.
  - 버튼은 카드 내부 응답 버튼이므로 브라우저 기본 버튼 모양이 보이지 않게 더 구체적인 CSS가 필요했다.
- 수정 파일
  - `src/features/diary/DiaryPage.css`
  - `docs/project-records/UI.md`
  - `docs/project-records/UX.md`
  - `docs/project-records/memo.md`
- 핵심 변경 내용
  - 탈피 확인 버튼을 pill 형태로 강제 적용했다.
  - `예` 버튼은 Primary, `아니요` 버튼은 보조 스타일로 정리했다.
- 검증 결과
  - CSS 변경 후 검증 예정.
- 남은 작업
  - 사용자가 원하면 `supabase db push`로 실제 DB에 마이그레이션을 적용해야 한다.
- `fixedHerpFoods`와 `withFixedHerpFoodOptions`를 추가해 파충류·양서류 공통 먹이 3종을 항상 포함.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과

### 남은 작업

- 없음.

## 2026-07-28 탈피 기간 분석 변경 메모

### 요청 요약

- `탈피 중`을 없애고 `탈피 시작`과 `탈피 완료` 기록으로 탈피 기간을 분석한다.
- 기록 모아보기에서는 해당 동물이 며칠 정도 탈피하는지 보여준다.

### 분석·판단 이유

- 탈피는 단순 완료 기록 사이의 주기보다, 시작부터 완료까지 걸린 기간이 사용자에게 더 직접적인 정보다.
- 기존 과거 기록에는 `탈피 중` 값이 남아 있을 수 있으므로 새 화면 문구에서는 제거하되 내부 호환 판정은 유지한다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `탈피 시작` 기록 뒤에 `탈피 완료`가 없으면 진행 중 탈피로 판단한다.
- 탈피 경고 문구를 `탈피 시작 기록 후 n일` 기준으로 변경했다.
- 시작-완료 기록을 짝지어 각 탈피 기간을 계산한다.
- 기록 모아보기 탈피 그래프는 `탈피 기간`과 `평균 n일 정도 탈피해요`를 보여준다.

### 검증 결과

- `cmd /c npx.cmd tsc -b`, `cmd /c npm.cmd run lint`, `cmd /c npm.cmd run build` 모두 통과했다.

### 남은 작업

- 실제 브라우저에서 기록 모아보기 그래프와 경고 카드 문구가 의도대로 보이는지 확인하면 좋다.

## 2026-07-28 스네이크류·양서류 care profile 변경 메모

### 요청 요약

- 스네이크, 파이톤, 보아의 평균 온도·습도와 먹이 후보를 추가했다.
- 양서류 먹이 후보에서 기존 공통 귀뚜라미·밀웜 강제 후보를 제거하고 종별 먹이표로 교체했다.
- 양서류 평균 적정온도와 평균 적정습도를 새 표 기준으로 맞췄다.

### 분석·판단 이유

- 루틴 추가, 먹이 기록, 환경 기록은 모두 종별 care profile을 기준으로 동작하므로 데이터 소스를 바꾸는 것이 가장 자연스럽다.
- 기존 `withFixedHerpFoodOptions`는 파충류와 양서류 모두에 귀뚜라미·밀웜·누에를 강제로 붙였지만, 최신 요구는 양서류별 먹이 후보가 서로 다르므로 양서류는 이 보정에서 제외했다.
- 스네이크류는 평균값만 제공되었기 때문에 경고 판정용 정상 범위는 평균 주변의 넓은 범위로 우선 설정했다.

### 수정 파일

- `src/features/diary/speciesCareProfiles.ts`
- `src/features/diary/DiaryPage.tsx`
- `supabase/migrations/202607280002_update_snake_amphibian_profiles.sql`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 스네이크: 26℃, 습도 50%, 냉동 해동 마우스·래트.
- 파이톤: 28℃, 습도 60%, 냉동 해동 마우스·래트.
- 보아: 28℃, 습도 65%, 냉동 해동 마우스·래트.
- 양서류 먹이 후보를 뉴트, 살라만다, 아홀로틀, 팩맨, 트리프록, 다트프록, 토드별로 분리했다.
- DB seed 업데이트용 `202607280002_update_snake_amphibian_profiles.sql`을 추가했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b`, `cmd /c npm.cmd run lint`, `cmd /c npm.cmd run build` 모두 통과했다.

### 남은 작업

- 원격 Supabase DB에는 새 마이그레이션을 적용해야 실제 테이블 값이 바뀐다.

## 2026-07-28 탈피 시작 메시지 노출 시점 메모

### 요청 요약

- 탈피 시작을 누른 당일에는 확인 메시지를 띄우지 않고 최소 1일 뒤부터 표시한다.

### 분석·판단 이유

- 사용자가 방금 `탈피 시작`을 기록했는데 즉시 `탈피가 완료됐나요?`가 뜨면 흐름이 어색하다.
- 시작 후 하루가 지난 뒤부터 확인을 요청하는 편이 관리 알림으로 자연스럽다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `buildShedInsight`에서 시작일 기준 경과일이 1일 미만이면 `null`을 반환하게 했다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 실행 시 기존 중간 작업 상태의 `collapseShedRecordsForDisplay` 미정의 오류가 먼저 발생해 전체 타입 검증은 완료하지 못했다.

### 남은 작업

- 없음.

## 2026-07-28 탈피 기록 단일 표시 메모

### 요청 요약

- `탈피 시작`과 `탈피 완료`를 기록 화면에서는 하나의 탈피 기록으로 보이게 한다.

### 분석·판단 이유

- 탈피 기간 계산을 위해 원본 기록은 시작과 완료가 필요하다.
- 하지만 사용자가 보는 달력과 날짜 상세에서는 두 줄로 보이면 중복 기록처럼 보인다.
- 저장 구조는 유지하고 표시용 목록에서만 합치는 방식이 가장 안전하다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `collapseShedRecordsForDisplay`를 추가했다.
- 완료된 탈피는 완료 날짜에 하나의 탈피 기록으로 표시한다.
- 합쳐진 기록은 `시작일 시작 · 완료일 완료` 요약을 가진다.
- 합쳐진 기록 삭제 시 시작/완료 원본 기록을 함께 삭제한다.

### 검증 결과

- `cmd /c npx.cmd tsc -b`, `cmd /c npm.cmd run lint`, `cmd /c npm.cmd run build` 모두 통과했다.

### 남은 작업

- 실제 브라우저에서 달력 태그 수와 날짜 상세 목록이 하나로 보이는지 확인하면 좋다.

## 2026-07-28 탈피 탭 카운트 보정 메모

### 요청 요약

- 탈피 시작 후 최소 1일 뒤에 탈피 완료 확인 메시지가 떠야 한다.
- 탈피 시작과 탈피 완료는 기록 모아보기에서도 하나의 기록으로 계산되어야 한다.

### 분석·판단 이유

- 탈피 시작 당일에 완료 확인이 뜨면 자연스럽지 않다.
- 시작/완료를 화면에서는 하나의 탈피 기록으로 보기로 했으므로 탭 배지도 원본 개수가 아니라 표시용 기록 개수를 세야 한다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `DataVisualization`에서 탈피 탭 카운트를 `collapseShedRecordsForDisplay` 결과 기준으로 계산한다.
- 완료 확인 메시지는 탈피 시작 후 1일 미만이면 표시하지 않는 조건을 유지한다.

### 검증 결과

- `cmd /c npx.cmd tsc -b`, `cmd /c npm.cmd run lint`, `cmd /c npm.cmd run build` 모두 통과했다.

### 남은 작업

- 실제 화면에서 탈피 탭 배지가 1로 표시되는지 확인하면 좋다.

## 2026-07-28 루틴 수정 화면 제한 메모

### 요청 요약

- 만든 루틴을 수정할 때 다른 루틴으로 변경하는 선택지를 없앤다.
- 수정 시에는 반복 요일과 종료일만 선택하게 한다.

### 분석·판단 이유

- 루틴 종류를 수정하면 기존 기록과 앞으로의 일정 의미가 섞일 수 있다.
- 이미 만든 루틴은 항목 자체가 아니라 일정 조건을 바꾸는 흐름으로 제한하는 것이 안전하다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 수정 모드에서는 추천 루틴 버튼 목록을 숨긴다.
- 현재 루틴명을 읽기 전용 요약으로 보여준다.
- 반복 요일과 종료일 입력만 남긴다.

### 검증 결과

- `cmd /c npx.cmd tsc -b`, `cmd /c npm.cmd run lint`, `cmd /c npm.cmd run build` 모두 통과했다.

### 남은 작업

- 실제 수정 화면에서 현재 루틴 요약이 너무 작거나 묻히지 않는지 확인하면 좋다.
## 2026-07-29 루틴 알림 작업 DB 연결 메모

### 요청 요약

- 루틴 만들기에서 부재 시 알람 시간을 정하게 한다.
- 이미 존재하는 `public.routine_notification_jobs`, `public.push_subscriptions` 중 이번 단계에서는 `routine_notification_jobs`만 루틴 생성·완료·건너뛰기·삭제 흐름에 연결한다.
- Push, Service Worker, VAPID, Edge Function, Cron은 아직 구현하지 않는다.

### 분석·판단 이유

- 현재 로그인 사용자 ID는 `DiaryPage`가 props로 받는 `userId`를 사용한다. Supabase `auth.users.id` 기반 UUID 문자열로 다뤄진다.
- 루틴 테이블은 `care_plans`, 루틴 ID는 `id` UUID다.
- 펫 테이블은 `pets`, 펫 ID는 `id` UUID다.
- 당일 루틴은 `daily_tasks`로 materialize되고, 완료·건너뛰기는 `completeDailyTask`, `markDailyTaskCompleted`, `skipDailyTask` 흐름을 탄다.
- 기존 `Reminder.reminderTime`은 있었지만 `care_plans`에는 저장되지 않아 `notification_time` 칼럼을 추가했다.
- 날짜와 시간은 새 유틸에서 Asia/Seoul 기준으로 ISO timestamptz 문자열로 변환한다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `src/features/diary/diaryTypes.ts`
- `src/features/diary/diaryService.ts`
- `src/features/diary/routineNotificationJobs.ts`
- `supabase/migrations/202607290001_routine_notification_jobs_link.sql`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 루틴 생성·수정 화면에 `부재 시 알람 시간` 입력을 추가했다.
- `CarePlan.notificationTime` 타입과 `care_plans.notification_time` 저장 매핑을 추가했다.
- `routine_notification_jobs` upsert, completed, skipped, cancelled 업데이트 유틸을 분리했다.
- 루틴 생성·수정 후 `routine_id + routine_date` 기준으로 알림 작업을 upsert한다.
- 루틴 완료 시 해당 날짜의 알림 작업을 completed로, 건너뛰기 시 skipped로, 삭제·비활성화 시 cancelled로 바꾼다.

### 검증 결과

- `cmd /c npx.cmd tsc -b` 통과.

### 남은 작업

- lint와 build를 추가 확인한다.
- Supabase 마이그레이션 적용 후 실제 루틴 생성 화면에서 `routine_notification_jobs` row가 생기는지 확인한다.
- 이번 단계에서는 푸시 전송 자체는 구현하지 않았다.
## 2026-07-29 다이어리 상단 헤더 제거와 NOTICE 추가 메모

### 요청 요약

- 다이어리 화면 상단의 큰 `다이어리` 제목을 없앤다.
- 펫 정보와 기록 모아보기 버튼을 상단으로 올린다.
- `NOTICE` 안내 문구를 펫 정보 아래에 작게 표시한다.

### 분석·판단 이유

- 다이어리 탭임은 하단 내비게이션에서 이미 알 수 있어 큰 제목이 중복된다.
- 기록 모아보기는 우측 패널이나 별도 카드보다 펫 정보 옆 보조 버튼으로 배치하는 것이 참고 앱 구조와 더 가깝다.
- 경고 배너는 위험 변화가 있을 때만 뜨도록 유지하고, 일반 안내는 NOTICE 한 줄로 분리했다.

### 수정 파일

- `src/App.tsx`
- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `activeTab === 'diary'`일 때 앱 상위 `top-bar`를 렌더링하지 않는다.
- `기록 모아보기` 버튼을 다이어리 상단 펫 정보 줄 오른쪽으로 이동했다.
- `DiaryNotice` 컴포넌트를 추가해 최근 먹이, 배변, 탈피 기록 기준으로 작은 안내 문구를 보여준다.
- 모바일에서 상단 한 줄 배치를 위해 다이어리 펫 바 그리드를 조정했다.

### 검증 결과

- 아직 진행 전이다. `tsc`, `lint`, `build`로 확인할 예정이다.

### 남은 작업

- 실제 모바일 화면에서 상단 높이와 NOTICE 줄이 참고 화면처럼 보이는지 확인한다.
## 2026-07-29 모바일 기록 모아보기 위치와 캘린더 표시 수정 메모

### 요청 요약

- 모바일에서 `기록 모아보기`와 우측 프로필 버튼이 겹치므로 왼쪽으로 이동한다.
- NOTICE 일반 문구는 검정색 계열로, 1~5단계는 단계별 색으로 표시한다.
- 캘린더 안 배변, 탈피 태그가 원형처럼 잘리지 않게 하고 캘린더 크기를 키운다.
- `오늘 할 일` 아래에 다시 나오는 `오늘 할 일` 컴포넌트/소제목을 제거한다.

### 분석·판단 이유

- 기록 모아보기 버튼이 모바일 상단 오른쪽에 있으면 앱 전역 프로필 버튼과 겹칠 수 있다.
- 캘린더 태그는 좁은 셀에서 pill 형태보다 가로 막대형이 날짜별 기록 확인에 더 적합하다.
- 오늘 할 일 패널 안에서 같은 제목이 반복되면 정보 계층이 어색하다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 모바일 그리드를 `메뉴 버튼 / 기록 모아보기 / 펫 정보` 순서로 바꿨다.
- NOTICE에 단계 배지 스타일을 추가했다.
- 모바일 캘린더 높이를 키우고 기록 태그를 셀 너비 100% 막대형으로 바꿨다.
- 오늘 할 일 리스트 그룹의 중복 제목을 제거했다.

### 검증 결과

- 아직 진행 전이다. `tsc`, `lint`, `build`로 확인할 예정이다.

### 남은 작업

- 실제 모바일 브라우저에서 상단 버튼 겹침과 캘린더 태그 표시를 확인한다.
## 2026-07-29 밀린 할 일 완료·건너뛰기 항목 숨김 메모

### 요청 요약

- 이미 완료했거나 건너뛰기 한 루틴은 밀린 할 일에 보여주지 않는다.

### 분석·판단 이유

- 밀린 할 일은 미처리 루틴만 보여야 한다.
- 과거 날짜를 선택하면 완료·건너뛰기 된 `daily_tasks`도 같은 날짜 조건으로 들어올 수 있어 화면 필터를 보강했다.

### 수정 파일

- `src/features/diary/DiaryPage.tsx`
- `docs/project-records/UX.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- `overdueTasks`에서 pending 상태만 표시한다.
- `todayTasks`에서 skipped 상태를 숨긴다.

### 검증 결과

- 아직 진행 전이다. 타입 검사와 빌드로 확인한다.

### 남은 작업

- 실제 Supabase 데이터에서 완료/건너뛰기 상태가 반영된 뒤 목록에서 사라지는지 확인한다.
## 2026-07-29 모바일 상단 펫 정보와 기록 모아보기 순서 교체 메모

### 요청 요약

- 모바일 상단에서 `기록 모아보기`와 펫 정보 위치를 바꾼다.

### 분석·판단 이유

- 이전 CSS는 `기록 모아보기`를 메뉴 버튼 옆으로 먼저 배치했다.
- 사용 흐름상 펫 정보가 먼저 보이고, 기록 모아보기는 그 오른쪽 보조 버튼으로 가는 것이 자연스럽다.

### 수정 파일

- `src/features/diary/DiaryPage.css`
- `docs/project-records/UI.md`
- `docs/project-records/memo.md`

### 핵심 변경 내용

- 모바일 그리드를 `메뉴 버튼 / 펫 정보 / 기록 모아보기` 순서로 바꿨다.
- 기록 모아보기 버튼의 최대 폭과 글자 크기를 줄였다.

### 검증 결과

- 아직 진행 전이다. 타입 검사와 빌드로 확인한다.

### 남은 작업

- 실제 모바일에서 프로필 버튼과 겹치지 않는지 확인한다.

## 2026-07-29 ���̾ ��ƾ ��� �ݿ�, Ķ���� �±�, Q&A ���� �帧 ����
- ��û ���: ��ƾ�� ���� �������� �߰��ϸ� ���� �� �Ͽ� ��� ���� �ϰ�, Ķ���� �±״� ��¥ ĭ �ʺ� �� ä��� �̹��� �����ܰ� �̸��� ���� ������ ��. ��¥ ���� ��Ȳ�� ��� �������� �� �̹����� ��ü�ϰ�, ��� ��ƺ��� ���� ������ �����ϸ�, ���̾���� Q&A �ۼ����� �� ���� �̹� ���õ� ��� ��� ÷�� �帧�� �ٽ� �䱸���� �ʵ��� ��û��.
- �м�/�Ǵ�: ��ƾ ���� �� daily task ��ȸ�� �ٽ� �������� �ʾ� ���� ���� ��ƾ�� ȭ�鿡 �ʰ� �ݿ��Ǵ� ��������. Q&A �ۼ��� initialPetId�� �־ ���� 3�ܰ� �帧�� �״�� ����� �� ����/��� ÷�� ��ư�� ���� �־���.
- ���� ����: src/features/diary/DiaryPage.tsx, src/features/diary/DiaryPage.css, src/components/qna/QnaScreen.tsx
- �ٽ� ����: ��ƾ �߰�/����/���� �� dailyTasks�� ����ȸ�ϵ��� refreshDailyTasks�� �߰���. ��¥ �� ����� calendarRecordTag�� ������ ��Ȳ�� �̹��� �������� ǥ����. ��� ��ƺ��� ���� �Ʒ� ���� ������ ������. ��ƾ ��õ ������ ���� ���� �� �̸� �������� ǥ����. ���̾���� Q&A�� �����ϸ� �� ���� �ܰ踦 �ǳʶٰ� ��� ÷�� ��ư�� ����� �ֱ� 30�� �ڵ� ÷�� �帧�� ������. ����� ��� ��ƺ��� ��ư�� �����ʰ� ��ġ�� �ʰ� ���� ���� �ٷ� ��ġ�ϰ� ���� �ڽ� ��Ÿ���� ������. Ķ���� �±״� ��¥ ĭ ��ü �ʺ� ������ ������.
- ���� ���: TypeScript ���(tsc -b) ���. lint/build�� �̾ Ȯ�� ����.
- ���� �۾�: ���� ���������� ����� ��� ������/��� ��ƺ��� ��ħ�� ���� ��ƾ ��� �ݿ� ü�� Ȯ�� �ʿ�.

## 2026-07-29 Q&A 작성 흐름과 상황별 기록 패널 정리
- 요청 요약: 상황별 기록을 전체 바텀시트가 아니라 작은 선택 패널처럼 열고, 다이어리에서 Q&A로 넘어간 경우 불필요한 다음/펫 선택/기간 선택 단계를 줄이도록 요청했다.
- 분석·판단: 상황별 기록은 이미 SmartAddSheet로 열리지만 공통 diary-modal CSS 때문에 하단 전체 바텀시트처럼 보였다. Q&A 기록 첨부는 range 상태와 최근 n일 탭이 남아 있어 직접 선택 방식과 충돌했다.
- 수정 파일: src/features/diary/DiaryPage.tsx, src/features/diary/DiaryPage.css, src/components/qna/QnaScreen.tsx, src/App.css
- 핵심 변경: 상황별 기록 패널을 중앙의 작은 모달형 선택창으로 바꾸고, 다이어리에서 Q&A 진입 시 질문 유형 선택 후 바로 작성 단계로 이동하도록 했다. Q&A 기록 첨부의 최근 3/7/30일 탭을 제거하고 전체 후보 기록에서 직접 선택하게 했다. Q&A 진행 표시 글자 칸 수를 실제 스텝 수와 맞췄다.
- 검증 결과: TypeScript, lint, build 재검증 예정.
- 남은 작업: 진료 기록 후 다음 방문 루틴 생성, 약 기록을 루틴형 일정으로 확장하는 세부 DB 흐름은 추가 검토가 필요하다.