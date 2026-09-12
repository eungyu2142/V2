# 파작파작 UI 라이브러리

새 화면과 기존 화면 수정은 이 폴더의 공통 컴포넌트를 먼저 사용한다.

## 컴포넌트

- `Button`: primary, secondary, text, danger 행동
- `TextField`, `TextAreaField`, `FieldLabel`: 라벨·필수·선택·오류가 통일된 입력
- `ChoiceGroup`: 단일·복수 선택 칩
- `FormActions`: 이전·다음·등록 행동 행
- `Stepper`: 작성 단계 표시
- `FlowHeader`: 시안의 뒤로가기·중앙 제목·보조 액션
- `ProgressBar`: 내 펫과 다이어리의 실제 루틴 완료 진행률

## 스타일 규칙

1. 색상은 `src/index.css`의 `--color-*` 토큰만 사용한다.
2. 화면 파일에 버튼·입력·스테퍼 스타일을 다시 만들지 않는다.
3. 화면 CSS는 레이아웃과 해당 화면 고유 표현만 담당한다.
4. 새 UI는 Tailwind 유틸리티와 공통 컴포넌트를 먼저 사용한다. 기본 CSS는 base, 화면 고유 CSS는 components layer에 두어 utilities가 우선한다.
5. 하드코딩한 hex 색상과 임의 radius를 추가하지 않는다.

## 화면별 소유권

- 전역 토큰·기본 요소: `src/index.css`
- 인증·내비게이션: 해당 React 컴포넌트의 Tailwind 클래스
- 화면 고유 표현: 각 화면 폴더의 `*flow.css` (마이 펫은 `PetFlow.css`)
- 케어 아이콘·캐릭터: `common/ReferenceIcon.tsx`, `common/Mascot.tsx`에서 첨부 원본만 사용

시안에 없는 새 화면이나 장식을 추가하지 않는다. 기존 기능을 유지하기 위한 추가 입력은 기존 흐름을 재사용한다.
