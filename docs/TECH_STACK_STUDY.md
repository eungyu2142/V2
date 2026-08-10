# 기술 스택 공부 문서

이 문서는 이 프로젝트에서 실제로 쓰는 기술 스택을 공부하기 위한 문서다. 단순 목록이 아니라, 각 기술이 왜 필요한지, 프로젝트 안에서 어디에 쓰이는지, 무엇부터 공부하면 되는지를 정리한다.

## 1. 전체 구조

이 프로젝트는 특수동물 케어 PWA다.

큰 구조는 이렇게 보면 된다.

```text
사용자 화면
→ React
→ TypeScript
→ Vite
→ Supabase
→ PostgreSQL / Auth / Storage / Edge Functions
```

사용자가 보는 화면은 React로 만들고, 데이터 저장과 로그인, 서버 기능은 Supabase가 맡는다. Vite는 개발 서버와 빌드를 담당한다.

## 2. React

React는 화면을 컴포넌트 단위로 만드는 프론트엔드 라이브러리다.

이 프로젝트에서 React가 하는 일:

- 로그인 화면 표시
- 마이 펫 화면 표시
- 기록/캘린더 화면 표시
- 지도 화면 표시
- Q&A 화면 표시
- 나눔 화면 표시
- 프로필 화면 표시
- 버튼 클릭, 입력, 탭 이동 같은 사용자 행동 처리

공부할 핵심:

- 컴포넌트
- props
- state
- event handler
- conditional rendering
- list rendering
- `useState`
- `useEffect`
- `useMemo`
- `useCallback`

## 3. TypeScript

TypeScript는 JavaScript에 타입을 붙인 언어다.

React 앱에서 TypeScript를 쓰는 이유:

- 데이터 구조를 명확하게 만들 수 있다.
- 컴포넌트에 어떤 props가 들어가는지 확인할 수 있다.
- 실수로 잘못된 값을 넘기는 문제를 빌드 전에 잡을 수 있다.
- Supabase에서 가져온 데이터 형태를 코드에서 더 안전하게 다룰 수 있다.

이 프로젝트에서 자주 보이는 타입:

- `Pet`
- `QnaPost`
- `ShareItem`
- `HospitalReview`
- `HospitalSnapshot`
- `DraftItem`
- `PetRecord`

## 4. Vite

Vite는 프론트엔드 개발 서버와 빌드 도구다.

이 프로젝트에서 Vite가 하는 일:

- `npm run dev`로 개발 서버 실행
- 코드 변경 시 빠르게 화면 반영
- `npm run build`로 배포용 파일 생성
- React 플러그인 연결

관련 파일:

- `vite.config.ts`
- `package.json`
- `src/main.tsx`

## 5. CSS와 디자인 토큰

이 프로젝트는 CSS 기반으로 UI를 만든다.

중요한 기준 파일:

- `src/index.css`
- `src/App.css`
- 기능별 CSS 파일

현재 디자인 규칙:

- 새 컴포넌트와 기존 컴포넌트 수정은 `src/index.css`의 `--color-*` 토큰을 사용한다.
- 색상값을 직접 하드코딩하지 않는다.
- 기본 액션은 `--color-primary-600`을 사용한다.
- hover는 `--color-primary-700`을 사용한다.
- 내비게이션 배경은 `--color-primary-900`을 사용한다.
- 삭제, 탈퇴, 오류에는 Error 토큰을 사용한다.
- 좋아요, 별점, 알림 같은 포인트에만 Accent 또는 상태 토큰을 제한적으로 사용한다.

## 6. PWA

PWA는 웹앱을 모바일 앱처럼 사용할 수 있게 하는 방식이다.

이 프로젝트에서 PWA가 중요한 이유:

- 모바일에서 앱처럼 써야 한다.
- 하단 내비바가 모바일 앱처럼 동작해야 한다.
- 화면이 모바일과 웹 브라우저에서 모두 깨지면 안 된다.
- 서비스 워커를 통해 앱 설치와 캐싱 구조를 확장할 수 있다.

관련 파일:

- `src/main.tsx`
- `public`

## 7. Supabase

Supabase는 이 프로젝트의 백엔드 역할을 한다.

Supabase가 맡는 일:

- 로그인
- 회원가입
- 로그아웃
- 사용자 프로필
- 마이 펫 데이터 저장
- 기록/캘린더 데이터 저장
- Q&A 데이터 저장
- 나눔 데이터 저장
- 병원 리뷰 데이터 저장
- 임시저장 데이터 저장
- 좋아요 데이터 저장
- 이미지 저장
- 서버 함수 실행

관련 폴더:

- `src/lib`
- `supabase/migrations`
- `supabase/functions`
- `supabase/cron`
- `supabase/tests`

## 8. PostgreSQL

Supabase의 데이터베이스는 PostgreSQL이다.

이 프로젝트에서 PostgreSQL이 필요한 이유:

- 사용자별 데이터 저장
- 펫 정보 저장
- 기록 저장
- 리뷰 저장
- Q&A 저장
- 나눔 글 저장
- 좋아요 저장
- 임시저장 저장
- 알림 작업 저장

관련 폴더:

- `supabase/migrations`

## 9. Supabase Edge Functions

Edge Functions는 서버에서 실행되는 TypeScript 함수다.

현재 프로젝트에 있는 함수:

- `search-hospitals`: 병원 검색
- `search-reptile-amphibian-places`: 파충류/양서류 장소 검색
- `refresh-hospital-catalog`: 병원 카탈로그 갱신
- `recognize-medication-bag`: 약봉투 인식
- `send-routine-notifications`: 루틴 알림 발송

왜 필요한가:

- 브라우저에서 직접 처리하기 어려운 작업을 서버에서 한다.
- API 키를 클라이언트에 노출하지 않을 수 있다.
- 병원 검색, 알림 발송, OCR 같은 작업을 분리할 수 있다.

## 10. ESLint

ESLint는 코드 스타일과 실수를 검사하는 도구다.

이 프로젝트에서 ESLint가 하는 일:

- 사용하지 않는 변수 찾기
- React Hooks 규칙 검사
- 코드 품질 검사

관련 파일:

- `eslint.config.js`
- `package.json`

## 11. npm scripts

`package.json`에 있는 명령어는 개발할 때 자주 쓴다.

```bash
npm run dev
```

개발 서버를 실행한다.

```bash
npm run build
```

TypeScript 검사 후 배포용 빌드를 만든다.

```bash
npm run lint
```

ESLint로 코드 품질을 검사한다.

```bash
npm run preview
```

빌드된 앱을 미리 본다.

```bash
npm run collect:hospitals
```

특수동물 병원 데이터를 수집하는 스크립트다.

## 12. 공부 순서

이 프로젝트 기준으로는 아래 순서가 좋다.

1. HTML/CSS 기본
2. JavaScript 기본
3. TypeScript 기본
4. React 컴포넌트
5. React state와 event
6. React effect
7. Vite 개발 흐름
8. Supabase Auth
9. Supabase Database
10. Supabase Storage
11. Supabase Edge Functions
12. PWA와 모바일 반응형

## 13. 기능별로 연결해서 보기

| 기능 | 주로 보는 기술 |
| --- | --- |
| 로그인/회원가입 | React, Supabase Auth |
| 마이 펫 | React, TypeScript, Supabase DB |
| 기록/캘린더 | React state, Supabase DB, 날짜 처리 |
| 지도/병원 | React, Edge Functions, 외부 API, 지도 SDK |
| 병원 리뷰 | React form, Supabase DB, 기록 연결 |
| Q&A | React list/detail/form, Supabase DB |
| 나눔 | React list/detail/form, Supabase DB, Storage |
| 프로필 | Supabase Auth, DB, 활동 데이터 연결 |
| 모바일/PWA | CSS, responsive layout, service worker |

## 14. 한 줄 요약

이 프로젝트는 React와 TypeScript로 화면을 만들고, Vite로 개발/빌드하며, Supabase로 로그인·데이터베이스·스토리지·서버 함수를 처리하는 특수동물 케어 PWA다.
