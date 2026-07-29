# ExoPet 전체 작업 기록

이 문서는 ExoPet 특수동물 케어 PWA의 전체 작업 기록이다. 새 날짜별 기록 파일은 만들지 않고 이 파일에 날짜별 섹션을 추가한다.

## 기록 규칙

- 기능 변경 기록은 이 파일에 작성한다.
- UI 변경은 `UI.md`, UX 변경은 `UX.md`에 함께 기록한다.
- 문서 인코딩은 UTF-8로 유지한다.
- 화면, API, 데이터베이스, Supabase 관련 용어는 원래 코드 명칭을 그대로 백틱으로 표시한다.

## 2026-07-24 문서 인코딩 정리

### 요청 요약

기존 문서에 CP949와 UTF-8 변환 오류로 깨진 한국어와 개발 용어가 다수 나타났다. 앞으로 `2026-*.md` 파일을 만들지 않고 해당 문서에 기록하도록 규칙을 정리했다.

### 판단

손상된 문자열은 단순 재인코딩만으로 완전히 복구되지 않는 상태였다. 의미가 불명확한 과거 문장은 그대로 두면 학습용 기록으로 사용할 수 없으므로, 깨진 기록 파일은 핵심 작업 내용을 한국어로 다시 정리했다.

### 변경 파일

- `docs/project-records/all.md`
- `docs/project-records/QNA.md`
- `docs/project-records/memo.md`
- 손상된 날짜별 `2026-*.md` 파일 삭제
- 삭제된 나눔 기능의 `share.md` 기록 파일 삭제

### 유지한 문서

`account-login.md`, `maps.md`, `mypet.md`, `NAVIGATION_FLOW.md`, `profile.md`, `README.md`, `RECENT_NOTES.md`, `UI.md`, `UX.md`, `WORK_LOG_TEMPLATE.md`는 UTF-8 문서로 유지한다.

### 검증

문서 폴더에 날짜별 `2026-*.md` 파일이 더 이상 없고, 새 작업 기록은 `all.md`·`UI.md`·`UX.md`에 누적하도록 정리했다.

## 2026-07-23 나눔 기능 제거

`나눔`과 `무료분양` 기능의 탭, 상태, 작성 흐름, `share_items` 데이터 로직, 프로필 활동 분기를 제거했다. Q&A, 지도, 리뷰, 다이어리, 마이 펫 기능은 유지했다.

## 2026-07-23 컴포넌트 구조 정리

`ProfileScreen`, `PetsScreen`, 작성 단계 셸을 `src/components` 아래 기능별 폴더로 분리했다. 다이어리와 지도/리뷰는 기존 feature 모듈을 component 진입점으로 연결했다. 기존 Supabase 데이터 흐름과 라우팅은 유지했다.

## 2026-07-22 모바일·작성 흐름 정리

모바일 브라우저 뒤로가기, 작성 단계의 이전·다음 이동, 작은 임시저장 버튼, 단계 진행 표시, 선택 태그 기본값 해제를 반영했다. 동물 세부 종 선택에는 `직접 입력` 흐름을 유지했다.

## 2026-07-20 네이비 디자인 시스템

앱 공통 컴포넌트의 버튼, 태그, 카드, 입력창, 내비게이션, 진행 게이지를 공통 색상 토큰과 상태 스타일로 맞췄다. 선택과 활성 상태는 네이비 계열을 사용하고, 위험 동작만 오류 색상을 사용한다.

## 2026-07-03 ~ 2026-07-19 초기 구축 요약

- Supabase Auth 기반 로그인과 회원가입 흐름을 구성했다.
- 내 펫 등록, 다이어리 기록, Q&A, 병원 지도와 리뷰 흐름을 연결했다.
- 모바일 하단 내비게이션과 데스크톱 사이드바를 구현했다.
- PWA 실행 환경과 `npm run build` 검증 흐름을 구성했다.

## 2026-07-24 문서 규칙 및 인코딩 정리 완료

깨진 한국어와 CP949/UTF-8 변환 흔적을 제거했다. 날짜별 `2026-*.md` 파일을 삭제하고, 앞으로 작업 기록은 `all.md`, UI 기록은 `UI.md`, UX 기록은 `UX.md`에 누적한다. 문서 변경 후 `npm run build`를 다시 실행했으며 TypeScript 검사와 Vite 빌드가 통과했다. 빌드 과정에서 발견한 다이어리 메타데이터의 중복 `shed_check` 키도 제거했다.

## 2026-07-24 지도 병원 목록 표시 및 색상 정리

### 요청 요약

모바일 지도에서 동물 병원 카드가 아이콘만 보이고 병원명·주소가 보이지 않는 문제를 수정하고, 지도 화면의 색상을 공통 디자인 토큰으로 통일했다.

### 분석 및 판단

로컬 병원 데이터에는 `name`, 주소, 좌표가 정상적으로 존재했다. 따라서 데이터가 없는 상태와 카드 내부 텍스트가 스타일 우선순위에 묻히는 상태를 함께 방어했다. 지도 전용 하드코딩 색상은 기존 공통 `--color-*` 토큰을 참조하도록 변경했다.

### 수정 파일

- `src/App.tsx`
- `src/App.css`
- `docs/project-records/all.md`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`

### 핵심 변경 내용

- 병원 검색 결과 판별 시 `supportedAnimals` 정보를 함께 검사한다.
- 병원명과 주소를 공백 제거 후 표시하고 지도 병원 행의 텍스트 영역에 명시적인 표시 상태를 부여했다.
- 지도 버튼, 선택 태그, 병원 카드, 마커 색상을 `--color-primary-*`, `--color-text-*`, `--color-border` 토큰으로 연결했다.
- 선택된 지도 필터는 공통 Primary 색상을 사용하도록 정리했다.

### 검증 결과

- `cmd /c npm.cmd run build` 통과

### 남은 작업

- 실제 모바일 브라우저에서 네이버 지도 SDK와 병원 데이터 요청을 함께 확인해야 한다.

## 2026-07-25 App.tsx 1차 리팩터링

2,000줄을 넘는 `App.tsx`를 기능별 컴포넌트 구조로 정리하기 시작했다. 펫 등록·수정·완료 흐름을 `src/components/my-pet/PetCreateFlow.tsx`로 이동하고, `Pet`, `DraftItem`, `HospitalReview`, `QnaPost` 등 공유 타입을 `src/types/app.ts`로 분리했다. 기존 저장 콜백, 임시저장, 사진 입력, 다이어리 이동 흐름은 유지했다.

수정 파일은 `src/App.tsx`, `src/components/my-pet/PetCreateFlow.tsx`, `src/components/qna/QnaParts.tsx`, `src/components/hospital-map/MapScreen.tsx`, `src/components/hospital-map/mapDependencies.ts`, `src/types/app.ts`와 작업 기록 문서다. Q&A 공통 UI와 지도·리뷰 화면 본문을 기능 폴더로 이동했다. App.tsx는 약 1,683줄로 줄었고 `cmd /c npm.cmd run build`가 통과했으며 Vite의 번들 크기 경고만 남았다. 다음 단계는 Q&A 작성 흐름과 App에 남은 데이터 유틸 분리다.

## 2026-07-25 구조 점검 후 타입 import 정리

프로필 컴포넌트가 화면 타입을 `App.tsx`에서 직접 가져오던 순환 의존성을 확인하고 `src/types/app.ts`를 직접 참조하도록 수정했다. `npx tsc -b`는 통과했다. ESLint에는 App에서 지도 유틸을 export하는 Fast Refresh 규칙 오류가 남아 있어 지도 유틸을 완전히 독립 모듈로 옮겨야 한다.
## 2026-07-25 지도 모듈 의존성 정리

### 요청 요약

`mapDependencies` 파일의 오류를 점검하고 지도 기능을 `App.tsx`와 분리한다.

### 분석 및 판단

기존 파일은 `App.tsx`에서 지도 상수와 함수를 다시 가져오는 재-export 연결 구조였다. 이 구조는 순환 의존성을 만들고, App의 비컴포넌트 export 때문에 Fast Refresh 검사에도 걸릴 수 있었다. SVG JSX를 포함하므로 파일 확장자도 `.tsx`가 맞다.

### 수정 파일

- `src/components/hospital-map/mapDependencies.tsx`
- `src/components/hospital-map/MapScreen.tsx`
- `src/types/map.ts`
- `src/App.tsx`
- `docs/project-records/all.md`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`

### 핵심 변경 내용

- 지도 검색, 네이버 지도 로더, 병원 변환, 리뷰 요약, 저장 병원, 분류 아이콘을 독립 지도 모듈로 이동했다.
- `NaverMapApi` 타입과 `window.naver` 선언을 `src/types/map.ts`로 분리했다.
- `App.tsx`에 남아 있던 저장 병원 함수와 사용하지 않는 타입·상수를 제거했다.
- 지도 모듈이 `App.tsx`를 참조하지 않도록 순환 의존성을 끊었다.

### 검증 결과

- `npx tsc -b` 통과
- `npm run lint` 통과
- `npm run build` 통과

### 남은 작업

- 실제 브라우저에서 네이버 지도 키가 설정된 환경의 지도 로드와 병원 검색 결과를 확인한다.
## 2026-07-25 App.tsx Q&A 기능 분리

### 요청 요약

컴포넌트에 이미 존재하거나 화면 기능에 속한 코드를 `App.tsx`에 계속 두지 않고 기능별 파일로 분리한다.

### 분석 및 판단

기존 `App.tsx`에는 Q&A 목록, 상세, 질문 작성, 기록 첨부, 정렬·상태 변환 함수가 함께 들어 있어 전역 상태 연결과 화면 렌더링의 경계가 불분명했다. Q&A는 독립 화면 흐름이므로 컴포넌트 파일로 이동하고 `App.tsx`에는 데이터 상태와 콜백 연결만 남기는 것이 적절하다.

### 수정 파일

- `src/App.tsx`
- `src/components/qna/QnaScreen.tsx`
- `docs/project-records/all.md`
- `docs/project-records/UI.md`
- `docs/project-records/UX.md`

### 핵심 변경 내용

- Q&A 목록과 상세 화면을 `QnaScreen.tsx`로 이동했다.
- Q&A 작성 흐름과 기록 첨부 시트를 같은 기능 모듈에서 관리하도록 이동했다.
- Q&A 날짜·상태·정렬·기록 요약 헬퍼를 화면 모듈 내부로 옮겼다.
- `App.tsx`에서 Q&A 전용 UI 함수와 사용하지 않는 React import 및 타입을 제거했다.
- `App.tsx` 파일 줄 수를 약 1,193줄에서 544줄로 줄였다.

### 검증 결과

- `npx tsc -b` 통과
- `npm run lint` 통과
- `npm run build` 통과

### 남은 작업

- 다이어리 화면과 인증·전역 상태 연결을 별도 모듈로 추가 분리한다.

## 2026-07-26 인코딩 문자열 정리

- 요청 요약: 화면에 깨진 한국어 오류 문구가 표시되어 즉시 수정.
- 분석·판단: `src/App.tsx`의 데이터 로딩 오류 문구와 메뉴 접근성 라벨이 잘못 인코딩된 문자열로 저장되어 화면에 모자이크 문자가 노출됨.
- 수정 파일: `src/App.tsx`, `src/components/hospital-map/MapScreen.tsx`.
- 핵심 변경: 로그인·데이터·프로필·펫·질문·계정 오류 문구와 메뉴 라벨을 정상 한국어로 교체하고, 지도 오류 안내에 현재 접속 주소를 표시하도록 수정.
- 검증 결과: 소스에서 해당 화면 문자열을 확인했으며 TypeScript 빌드는 다음 작업에서 다시 실행 예정.
- 남은 작업: 프로젝트 전체의 기존 문서와 소스에 남아 있는 인코딩 깨짐 문자열을 순차적으로 정리.

## 2026-07-26 임시저장 버튼 제거

- 요청 요약: 모든 작성 화면에서 임시저장 버튼 삭제.
- 분석·판단: 작성 흐름은 유지하되 사용자에게 노출되는 임시저장 액션과 연결 콜백을 제거하는 범위로 처리.
- 수정 파일: `src/App.tsx`, `src/components/my-pet/PetCreateFlow.tsx`, `src/components/qna/QnaScreen.tsx`, `src/components/hospital-map/MapScreen.tsx`, `src/features/hospital-map/HospitalReviewForm.tsx`, `src/features/diary/DiaryPage.tsx`, `src/components/profile/ProfileScreen.tsx`.
- 핵심 변경: 펫·Q&A·다이어리·리뷰 작성 화면의 임시저장 버튼과 미사용 저장 콜백을 제거하고 이전·다음·등록 동작은 유지.
- 검증 결과: `npx tsc -b`, `npm run lint` 통과.
- 남은 작업: 기존에 이미 저장된 초안 데이터의 프로필 표시 정책은 별도 결정 필요.

## 2026-07-26 미사용 작성 디자인 정리

- 요청 요약: 사용하지 않는 디자인 스타일을 삭제.
- 분석·판단: 임시저장 버튼을 제거한 뒤에도 해당 버튼 전용 CSS가 남아 있어 실제 화면과 무관한 스타일만 안전하게 제거.
- 수정 파일: `src/App.css`, `src/features/diary/DiaryPage.css`, `src/features/hospital-map/HospitalReviewForm.tsx`.
- 핵심 변경: 펫·Q&A·다이어리·리뷰 작성에 사용되지 않는 임시저장 버튼 스타일과 관련 타입 잔여 코드를 정리했다.
- 검증 결과: 사용처 검색과 타입·린트 검증을 진행할 예정.
- 남은 작업: 화면별 실제 사용 여부를 확인한 뒤 나머지 대형 CSS의 중복 스타일을 단계적으로 통합.

## 2026-07-28 모바일 지도 API 인증 오류 처리

- 요청 요약: 같은 Wi-Fi의 모바일에서 네이버 지도 API 인증 실패가 발생함.
- 분석·판단: 모바일 접속 origin이 네이버 콘솔 Web 서비스 URL에 등록되지 않았을 가능성이 높고, SDK 인증 실패 시 `naver.maps`가 없는 상태를 코드가 먼저 검증하지 않아 초기화 오류가 추가로 발생함.
- 수정 파일: `src/components/hospital-map/mapDependencies.tsx`, `src/components/hospital-map/MapScreen.tsx`.
- 핵심 변경: SDK 로드 완료 후 `window.naver.maps` 존재 여부를 확인하고, 인증 실패를 지도 초기화 전에 명확한 오류로 처리.
- 검증 결과: 다음 단계에서 `tsc`, `lint`, `build` 실행.
- 남은 작업: 네이버 콘솔에 `http://172.30.1.89:5173`을 Web 서비스 URL로 등록해야 모바일 지도 인증이 완료됨.

## 2026-07-28 미사용 다이어리 디자인 참조 정리

- 요청 요약: 사용하지 않는 디자인과 함께 남아 있던 다이어리 인사이트 배너 참조를 정리.
- 분석·판단: `DiaryInsight` 타입은 실제 사용되지 않았고 `DiaryInsightBanner`는 구현 없이 호출되어 TypeScript 오류를 만들고 있었음.
- 수정 파일: `src/features/diary/DiaryPage.tsx`.
- 핵심 변경: 미사용 인사이트 타입과 존재하지 않는 배너 렌더링을 제거.
- 검증 결과: `npx tsc -b`, `npm run lint` 통과.
- 남은 작업: 네이버 콘솔 Web 서비스 URL 등록.
## 2026-07-28 인증 준비 화면 인코딩 오류 수정

- 요청 요약: 앱을 불러오기 전 화면에 깨진 문자가 표시되는 문제를 수정.
- 분석·판단: 인증 준비 상태 문구가 `src/App.tsx`에 깨진 문자열로 직접 저장되어 있었다.
- 수정 파일: `src/App.tsx`, `docs/project-records/all.md`, `docs/project-records/UI.md`, `docs/project-records/UX.md`.
- 핵심 변경: 인증 확인 중 안내 문구를 정상적인 한국어 문장으로 교체.
- 검증 결과: TypeScript 검사와 린트, 프로덕션 빌드를 실행한다.
- 남은 작업: 다른 화면에서 동일한 인코딩 문제가 발견되면 원문 기준으로 계속 정리.
## 2026-07-29 팝업 배경 덮임 제거

- 요청 요약: 팝업과 바텀시트가 열릴 때 배경 화면을 덮는 오버레이를 제거.
- 분석·판단: Q&A, 기록 첨부, 병원 선택, 다이어리, 프로필 모달이 공통 dim 레이어를 사용하고 있어 실제 팝업 외 영역까지 가려지고 있었다.
- 수정 파일: `src/App.css`, `docs/project-records/all.md`, `docs/project-records/UI.md`, `docs/project-records/UX.md`.
- 핵심 변경: dim 레이어를 숨기고 오버레이 컨테이너가 배경 클릭을 가로막지 않도록 수정했으며, 팝업 본체만 클릭 가능하게 유지.
- 검증 결과: TypeScript 검사, 린트, 프로덕션 빌드 실행 예정.
- 남은 작업: 모바일과 데스크톱에서 각 팝업의 닫기 버튼과 본체 입력을 확인.
## 2026-07-29 팝업 포커스와 닫기 동작 보완

- 요청 요약: 팝업을 열었을 때 배경은 흐리게 유지하고, 같은 버튼 재클릭·빈 배경 클릭·닫기 버튼으로 팝업을 닫도록 수정.
- 분석·판단: 이전 오버레이 제거 과정에서 배경 딤과 바깥 클릭 닫기까지 함께 사라졌고 일부 열기 버튼은 항상 열기만 수행하고 있었다.
- 수정 파일: `src/App.css`, `src/features/diary/DiaryPage.tsx`, `src/components/qna/QnaScreen.tsx`, `docs/project-records/all.md`, `docs/project-records/UI.md`, `docs/project-records/UX.md`.
- 핵심 변경: 팝업 뒤 배경을 약하게 어둡게 복원하고 오버레이 클릭을 닫기 동작으로 연결했으며, 다이어리 기록 팝업과 Q&A 필터·정렬·병원 첨부 버튼을 토글 방식으로 변경.
- 검증 결과: TypeScript 검사와 린트, 프로덕션 빌드를 실행한다.
- 남은 작업: 실제 모바일 터치 환경에서 팝업 내부 클릭과 바깥 클릭을 최종 확인.
## 2026-07-29 ExoPet 로고 교체

- 요청 요약: 제공된 양서류 로고 이미지로 앱 로고를 교체.
- 분석·판단: 기존 로고는 PWA 매니페스트의 SVG 아이콘과 브라우저 파비콘에 분리되어 있어 새 이미지 자산으로 공통 연결.
- 수정 파일: `public/exopet-logo.png`, `public/manifest.webmanifest`, `index.html`, `docs/project-records/all.md`, `docs/project-records/UI.md`, `docs/project-records/UX.md`.
- 핵심 변경: 제공된 PNG를 PWA 설치 아이콘, 브라우저 탭 아이콘, Apple 홈 화면 아이콘으로 적용.
- 검증 결과: TypeScript 검사, 린트, 프로덕션 빌드 실행 예정.
- 남은 작업: 이미 설치된 PWA는 기존 아이콘 캐시를 사용할 수 있으므로 삭제 후 다시 설치해야 새 아이콘이 반영될 수 있음.
## 2026-07-29 팝업 배경 hover 색상 고정

- 요청 요약: 팝업 바깥 영역에 마우스나 터치를 올렸을 때 흰색으로 변하지 않고, 팝업에 집중되는 회색 딤 상태를 유지하도록 수정.
- 분석·판단: 전체 화면 닫기 영역이 `button` 요소라 공통 버튼 hover 스타일이 오버레이 배경보다 높은 우선순위로 적용되고 있었다.
- 수정 파일: `src/App.css`, `docs/project-records/all.md`, `docs/project-records/UI.md`, `docs/project-records/UX.md`.
- 핵심 변경: 모든 팝업·바텀시트 닫기 레이어의 기본, hover, active, focus 상태에 동일한 딤 배경을 강제로 적용.
- 검증 결과: TypeScript 검사, 린트, 프로덕션 빌드 실행 예정.
- 남은 작업: 데스크톱 hover와 모바일 touch 상태에서 배경색 유지 여부 확인.
