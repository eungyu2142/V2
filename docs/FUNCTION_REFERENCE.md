# 파작파작 함수 문서

이 문서는 파작파작에서 직접 작성하거나 SDK를 통해 호출하는 핵심 함수를 기능별로 정리한다. 단순 아이콘 컴포넌트, 일회성 렌더링 함수, 현재 사용하지 않는 Google·약봉투 관련 코드는 제외한다.

## 1. 함수 읽는 법

| 구분 | 의미 | 예시 |
|---|---|---|
| 동기 함수 | 결과를 즉시 계산해 반환 | `validateImageFile()` |
| 비동기 함수 | 서버·DB·파일·브라우저 응답을 기다림 | `uploadImageFile()` |
| 이벤트 함수 | 클릭·제출·드래그 등 사용자 행동을 처리 | `submitReview()` |
| 변환 함수 | 데이터를 다른 화면 형식으로 변경 | `toHospitalSnapshot()` |
| SDK 함수 | 외부 서비스가 제공하는 함수를 호출 | `supabase.from(...).select()` |

비동기 함수는 주로 `async`, `await`, `Promise`를 사용하고 성공 데이터 또는 오류를 반환한다.

## 2. 앱 시작과 화면 이동

| 함수 | 종류 | 역할 | 위치 |
|---|---|---|---|
| `bootstrap()` | 비동기 | 운영 환경에서 Service Worker를 등록하고 React 앱을 시작 | `src/main.tsx` |
| `App()` | React 컴포넌트 | Supabase 세션을 확인하고 로딩·로그인·인증 화면을 구분 | `src/App.tsx` |
| `AuthenticatedApp()` | React 컴포넌트 | 로그인 사용자의 앱 데이터와 탭 이동을 관리 | `src/App.tsx` |
| `moveTab()` | 이벤트 | 하단 내비게이션 탭을 변경하고 URL 상태를 동기화 | `src/App.tsx` |
| `readInitialUrlState()` | 동기 | 현재 URL에서 첫 탭과 펫 ID를 읽음 | `src/lib/appUrl.ts` |
| `syncAppUrl()` | 동기 | 현재 탭과 펫 ID를 브라우저 URL에 반영 | `src/lib/appUrl.ts` |

### 시작 흐름

```text
bootstrap()
→ Service Worker 준비
→ React 앱 실행
→ App()에서 Supabase 세션 확인
→ 로그인 상태면 AuthenticatedApp() 표시
→ URL과 탭 상태 연결
```

## 3. 인증 함수

| 함수 | 종류 | 입력 | 결과·역할 |
|---|---|---|---|
| `normalizeUsername()` | 동기 | 사용자명 | 공백·대소문자 등을 로그인용 형식으로 정규화 |
| `validateUsername()` | 동기 | 사용자명 | 허용된 사용자명인지 검증 |
| `signUpWithUsername()` | 비동기 | 사용자명, 닉네임, 비밀번호 | Supabase Auth 계정과 프로필 생성 |
| `signInWithUsername()` | 비동기 | 사용자명, 비밀번호 | Supabase 로그인 세션 생성 |
| `findUsernameByNicknameAndPet()` | 비동기 | 닉네임, 펫 이름 | 계정 찾기용 DB 함수 호출 |
| `resetPasswordByUsernameAndPet()` | 비동기 | 사용자 확인값, 새 비밀번호 | 본인 확인 후 비밀번호 재설정 |
| `signOut()` | 비동기 이벤트 | 없음 | 푸시 구독을 비활성화하고 Supabase 로그아웃 |
| `deleteAccount()` | 비동기 이벤트 | 없음 | `delete_own_account` RPC 실행 후 로그아웃 |

### 사용한 Supabase SDK 함수

```ts
supabase.auth.getSession()
supabase.auth.onAuthStateChange(...)
supabase.auth.signOut()
supabase.rpc('delete_own_account')
```

## 4. 공통 데이터 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `loadAppData()` | 비동기 | 지정한 테이블에서 앱 데이터를 조회하고 사용자 범위를 적용 |
| `saveAppData()` | 비동기 | ID를 기준으로 앱 데이터를 생성하거나 갱신 |
| `deleteAppData()` | 비동기 | 사용자 ID와 데이터 ID를 확인해 삭제 |

이 함수들은 펫, 질문, 임시저장 등 여러 기능이 같은 Supabase 접근 방식을 재사용하도록 만든 공통 계층이다.

```text
React 기능
→ load/save/deleteAppData
→ Supabase JavaScript SDK
→ Supabase Data API
→ PostgreSQL
```

## 5. 펫과 프로필 함수

| 함수 | 종류 | 역할 | 위치 |
|---|---|---|---|
| `savePet()` | 비동기 이벤트 | 사진 업로드 후 펫 데이터를 Supabase에 저장 | `src/App.tsx` |
| `deletePet()` | 비동기 이벤트 | 사용자 펫을 DB에서 삭제 | `src/App.tsx` |
| `saveProfile()` | 비동기 이벤트 | 아바타 업로드 후 프로필을 `upsert` | `src/App.tsx` |
| `buildPet()` | 동기 | 펫 작성 단계의 입력값을 `Pet` 객체로 조립 | `src/components/my-pet/PetCreateFlow.tsx` |
| `finish()` | 비동기 이벤트 | 새 펫 입력을 검증하고 저장 완료 | `src/components/my-pet/PetCreateFlow.tsx` |
| `finishEdit()` | 비동기 이벤트 | 수정한 펫 정보와 사진을 저장 | `src/components/my-pet/PetCreateFlow.tsx` |
| `validateImageFile()` | 동기 | 이미지 형식과 크기를 검증 | `src/lib/imageStorage.ts` |
| `uploadImageFile()` | 비동기 | Supabase Storage에 파일을 올리고 URL 반환 | `src/lib/imageStorage.ts` |
| `removeUploadedImage()` | 비동기 | Storage에 저장한 기존 이미지 삭제 | `src/lib/imageStorage.ts` |
| `dataUrlToImageFile()` | 비동기 | 편집한 Data URL을 업로드 가능한 `File`로 변환 | `src/lib/imageStorage.ts` |

### 펫 저장 흐름

```text
입력 검증
→ validateImageFile()
→ uploadImageFile()
→ saveAppData() 또는 Supabase upsert
→ React 펫 목록 갱신
```

## 6. 지도와 병원 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `loadNaverMaps()` | 비동기 | NAVER 지도 JavaScript SDK를 로드하고 준비 상태 반환 |
| `createNaverHtmlMarker()` | 동기 | 내 위치 또는 병원용 HTML 마커 생성 |
| `readBrowserLocation()` | 비동기 | Geolocation API로 현재 위도·경도를 한 번 요청 |
| `searchHospitals()` | 비동기 | Supabase 병원 목록을 우선 조회하고 검색 결과 구성 |
| `loadCollectedHospitals()` | 비동기 | 정적 병원 JSON을 대체 데이터로 불러옴 |
| `transformHospitalItems()` | 동기 | DB·JSON 병원 데이터를 앱의 `Hospital` 형식으로 변환 |
| `buildHospitalSearchQuery()` | 동기 | 입력 검색어와 동물 분류를 병원 검색어로 조립 |
| `hospitalMatchesQuery()` | 동기 | 병원이 검색어 조건과 일치하는지 확인 |
| `sortHospitalsByDistance()` | 동기 | 현재 위치와 병원 좌표의 직선거리를 계산하고 정렬 |
| `toHospitalSnapshot()` | 동기 | 화면·좋아요·게시글에 보관할 병원 요약 생성 |
| `hospitalFromSnapshot()` | 동기 | 저장된 병원 요약을 지도용 병원 데이터로 복원 |
| `hospitalMarkerContent()` | 동기 | 선택·리뷰 수·좋아요 상태를 반영한 마커 HTML 생성 |
| `getReviewSummary()` | 동기 | 병원 리뷰 수와 평균 별점 계산 |
| `getRecentSpecies()` | 동기 | 최근 리뷰에서 진료 동물종 추출 |

### 현재 위치와 병원 표시 흐름

```text
readBrowserLocation()
→ 위도·경도를 currentLocation에 저장
→ searchHospitals()로 병원 목록 조회
→ transformHospitalItems()
→ sortHospitalsByDistance()
→ loadNaverMaps()
→ createNaverHtmlMarker()로 내 위치와 병원 표시
```

`readBrowserLocation()`은 서버가 아니라 브라우저의 Geolocation API에 위치를 요청한다. 병원 목록은 Supabase Data API를 통해 가져오며, 거리 계산은 클라이언트에서 동기적으로 수행한다.

## 7. 병원 리뷰와 좋아요 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `submitReview()` | 비동기 이벤트 | 리뷰 입력 검증, 생성·수정, 진료 기록 연결 처리 |
| `beginReviewEdit()` | 동기 이벤트 | 기존 리뷰를 수정 폼에 채움 |
| `deleteReview()` | 이벤트 | 내가 작성한 병원 리뷰 삭제 |
| `toggleReviewLike()` | 비동기 이벤트 | 리뷰 좋아요 상태를 DB와 화면에 반영 |
| `getHospitalLikeKey()` | 동기 | 병원 이름과 주소로 안정적인 좋아요 식별자 생성 |
| `loadHospitalLikes()` | 비동기 | 로그인 사용자의 좋아요 병원 조회 |
| `saveHospitalLike()` | 비동기 | 병원 요약을 좋아요 테이블에 저장 |
| `deleteHospitalLike()` | 비동기 | 병원 좋아요 삭제 |
| `mergeLocalHospitalLikes()` | 비동기 | 이전 로컬 좋아요를 로그인 사용자 DB와 병합 |
| `loadLikeStates()` | 비동기 | 여러 게시글·리뷰의 사용자 좋아요 상태 조회 |
| `saveLike()` | 비동기 | 좋아요이면 `upsert`, 취소이면 `delete` 실행 |

## 8. Q&A 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `saveQnaPost()` | 비동기 이벤트 | 질문 게시글을 Supabase에 저장 |
| `deleteQnaPost()` | 비동기 이벤트 | 질문 게시글 삭제 |
| `loadComments()` | 비동기 | 선택한 질문의 댓글을 DB에서 조회 |
| `addComment()` | 비동기 이벤트 | 댓글과 병원 첨부정보를 저장 |
| `toggleLike()` | 비동기 이벤트 | 질문 좋아요 변경 |
| `toggleCommentLike()` | 비동기 이벤트 | 댓글 좋아요 변경 |
| `selectAnswer()` | 이벤트 | 댓글을 채택 답변으로 선택 |
| `buildPost()` | 동기 | 작성 단계의 입력을 `QnaPost` 데이터로 조립 |
| `uploadImage()` | 비동기 | 질문 첨부 이미지를 Storage에 업로드 |
| `sortQnaPosts()` | 동기 | 최신순·조회순 등 선택 기준으로 질문 정렬 |
| `getTrustLevel()` | 동기 | 활동 점수를 신뢰 등급으로 변환 |
| `getTrustScoreForAuthor()` | 동기 | 작성자의 질문·답변 활동으로 신뢰 점수 계산 |

## 9. 다이어리와 루틴 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `listCarePlans()` | 비동기 | 사용자의 돌봄 루틴 조회 |
| `listDailyTasks()` | 비동기 | 날짜 범위에 해당하는 일일 작업 조회 |
| `listCareRecords()` | 비동기 | 펫의 돌봄·진료 기록 조회 |
| `saveCarePlan()` | 비동기 | 루틴을 저장하고 알림 작업 범위 갱신 |
| `deleteCarePlan()` | 비동기 | 루틴을 보관 처리하고 관련 알림 취소 |
| `completeDailyTask()` | 비동기 | DB RPC로 일일 작업 완료 처리 |
| `undoDailyTask()` | 비동기 | 완료한 작업을 되돌리고 알림 창 재생성 |
| `skipDailyTask()` | 비동기 | 수행하지 않은 작업을 사유와 함께 건너뛰기 처리 |
| `saveDailyTaskCareRecord()` | 비동기 | 일일 작업 결과를 실제 돌봄 기록으로 저장 |
| `saveClinicToDiary()` | 비동기 | 병원 방문, 진료 기록, 투약 계획과 작업을 연결해 저장 |
| `linkReviewToDiary()` | 비동기 | 병원 리뷰와 다이어리 진료 기록을 연결 |
| `findSpeciesCareProfile()` | 동기 | 펫 종에 맞는 권장 돌봄 프로필 검색 |
| `listSpeciesCareProfiles()` | 비동기 | DB의 종별 돌봄 프로필 조회 |

루틴 완료처럼 여러 데이터가 함께 바뀌는 작업은 단순 `update` 여러 번보다 Supabase RPC를 이용해 일관성을 유지한다.

## 10. 웹 푸시 함수

| 함수 | 종류 | 역할 |
|---|---|---|
| `isPushNotificationSupported()` | 동기 | Notifications·Push·Service Worker API 지원 여부 확인 |
| `getPushPermissionState()` | 동기 | 현재 알림 권한 상태 반환 |
| `getPushSubscriptionState()` | 비동기 | 현재 브라우저의 구독과 권한 상태 조회 |
| `enablePushNotifications()` | 비동기 | 권한 요청, Service Worker 준비, Push 구독 생성, DB 저장 |
| `disablePushNotifications()` | 비동기 | Push 구독 해제와 DB 비활성화 |
| `syncCurrentDevicePushSubscription()` | 비동기 | 현재 브라우저 구독을 Supabase와 동기화 |
| `deactivatePushSubscriptionForLogout()` | 비동기 | 로그아웃 전에 현재 기기 구독 비활성화 |
| `upsertRoutineNotificationJob()` | 비동기 | 루틴 발송 작업을 생성하거나 갱신 |
| `markRoutineNotificationJobCompleted()` | 비동기 | 완료된 루틴의 예정 알림 취소 |
| `markRoutineNotificationJobSkipped()` | 비동기 | 건너뛴 루틴의 예정 알림 취소 |
| `cancelRoutineNotificationJobs()` | 비동기 | 루틴에 연결된 대기·실패 알림 작업 취소 |
| `toSeoulZonedIso()` | 동기 | 서울 시간 기준 날짜·시각을 ISO 문자열로 변환 |

### 알림 활성화 흐름

```text
isPushNotificationSupported()
→ Notification.requestPermission()
→ Service Worker 등록·준비
→ pushManager.subscribe()
→ sync_current_push_subscription RPC
→ 루틴 알림 작업 저장
→ 서버 발송 후 Service Worker가 알림 표시
```

## 11. 로컬 저장과 URL 함수

| 함수 | 저장 위치 | 역할 |
|---|---|---|
| `readLocalDrafts()` | `localStorage` | 사용자별 임시저장 글 읽기 |
| `writeLocalDrafts()` | `localStorage` | 사용자별 임시저장 글 기록 |
| `readSessionMapLocation()` | `sessionStorage` | 현재 탭 세션에서 최근 위치 읽기 |
| `readSavedHospitalSnapshots()` | 로컬 저장소 | 저장된 병원 요약 읽기 |
| `writeSavedHospitalSnapshots()` | 로컬 저장소 | 병원 요약 저장 |
| `readInitialUrlState()` | 브라우저 URL | 새로고침 시 현재 화면 복원 |
| `syncAppUrl()` | History API | 탭과 선택 펫을 URL에 반영 |

## 12. 자주 사용한 외부·브라우저 함수

| 함수 | 제공 주체 | 파작파작에서의 역할 |
|---|---|---|
| `supabase.from().select()` | Supabase SDK | 데이터 조회 |
| `supabase.from().insert()` | Supabase SDK | 데이터 생성 |
| `supabase.from().update()` | Supabase SDK | 데이터 일부 수정 |
| `supabase.from().upsert()` | Supabase SDK | 생성 또는 갱신 |
| `supabase.from().delete()` | Supabase SDK | 데이터 삭제 |
| `supabase.rpc()` | Supabase SDK | PostgreSQL 함수 실행 |
| `supabase.auth.*` | Supabase SDK | 인증과 세션 관리 |
| `supabase.storage.*` | Supabase SDK | 이미지 업로드·URL·삭제 |
| `navigator.geolocation.getCurrentPosition()` | Geolocation API | 현재 위치 한 번 조회 |
| `navigator.serviceWorker.register()` | Service Worker API | 백그라운드 푸시 수신 준비 |
| `Notification.requestPermission()` | Notifications API | 사용자 알림 권한 요청 |
| `pushManager.subscribe()` | Push API | 브라우저 푸시 구독 생성 |
| `fetch()` | Fetch API | 정적 JSON·Data URL 등의 리소스 요청 |

## 13. 동기와 비동기 적용 요약

```text
동기 처리
- 입력값 검증
- 병원 필터링과 거리 계산
- 리뷰 통계 계산
- 데이터 형식 변환
- URL 상태 계산

비동기 처리
- Supabase 인증과 DB 요청
- 이미지 업로드
- Geolocation 위치 요청
- NAVER 지도 SDK 로딩
- 웹 푸시 구독
- 루틴 RPC와 알림 작업
```

파작파작은 즉시 끝나는 계산에는 동기 함수를 사용하고, 네트워크·파일·위치·권한처럼 완료 시간을 알 수 없는 작업에는 비동기 함수를 사용한다.

