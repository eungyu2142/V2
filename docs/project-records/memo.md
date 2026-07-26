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
