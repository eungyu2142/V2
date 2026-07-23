# ExoPet

특수동물 보호자를 위한 병원 탐색과 반려동물 관리 PWA입니다.

## 기술 스택

- React 19, TypeScript, Vite
- Supabase Auth, Database, Storage, Edge Functions
- NAVER Maps JavaScript API
- PWA manifest와 service worker

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/`을 엽니다. 같은 Wi-Fi의 모바일에서 확인하려면:

```bash
npm run dev -- --host 0.0.0.0
```

`.env.local`에는 Supabase URL/Publishable Key와 NAVER Maps Client ID를 설정합니다. NAVER Cloud Maps 콘솔에는 현재 접속 origin을 Web 서비스 URL로 등록해야 합니다.

## 주요 흐름

- 내 펫: 등록, 수정, 삭제, 분류 필터
- 다이어리: 계획, 날짜별 기록, 체크 완료, 원그래프 시각화
- 지도: 위치 기반 병원 검색, 분류 필터, 병원 상세, 리뷰
- Q&A와 나눔: 작성, 임시 저장, 수정, 삭제, 기록 첨부
- 프로필: 계정 정보와 작성 활동

화면 상태는 현재 앱 셸에서 연결되며, 주요 데이터 저장은 `src/lib`와 기능별 service 파일을 통해 Supabase와 동기화합니다. 네트워크 오류 시 일부 입력 흐름은 로컬 상태를 먼저 갱신합니다.

## Supabase

마이그레이션은 `supabase/migrations`에 있으며, 새 프로젝트에는 순서대로 적용합니다. 병원 검색과 약봉투 인식은 `supabase/functions`의 Edge Function을 사용합니다.

## 검증

```bash
npm run lint
npm run build
```

현재 외부 NAVER API 응답과 약봉투 OCR은 환경변수 및 배포된 Edge Function 상태에 따라 달라질 수 있습니다. 지도 콘솔의 origin 등록 전에는 지도 로드 실패 상태가 표시됩니다.
