# 파작파작 UI 라이브러리

새 화면과 기존 화면 수정은 이 폴더의 공통 컴포넌트를 먼저 사용한다.

## 컴포넌트

- `Button`: primary, secondary, text, danger 행동
- `TextField`, `TextAreaField`, `FieldLabel`: 라벨·필수·선택·오류가 통일된 입력
- `ChoiceGroup`: 단일·복수 선택 칩
- `FormActions`: 이전·다음·등록 행동 행
- `Stepper`: 작성 단계 표시

## 스타일 규칙

1. 색상은 `src/styles/tokens.css`의 `--ui-*` 의미 토큰만 사용한다.
2. 화면 파일에 버튼·입력·스테퍼 스타일을 다시 만들지 않는다.
3. 화면 CSS는 레이아웃과 해당 화면 고유 표현만 담당한다.
4. 새 CSS는 해당 화면 폴더의 CSS에 작성하며 `App.css`에 추가하지 않는다.
5. 하드코딩한 hex 색상과 임의 radius를 추가하지 않는다.

## 화면별 소유권

- 앱 셸·내비게이션: `src/App.css`
- 인증: `src/components/account/AuthScreen.css`
- 마이 펫: `src/components/my-pet/MyPet.css`
- 병원 지도: `src/components/hospital-map/HospitalMap.css`
- Q&A: `src/components/qna/Qna.css`
- 프로필: `src/components/profile/Profile.css`
- 다이어리: `src/features/diary/DiaryPage.css`
