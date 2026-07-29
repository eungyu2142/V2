# 2026-07-29 DB 테이블 정리 SQL 작성

## 요청 요약

사용자는 현재 Supabase DB에 쓸데없는 테이블이 많다고 보고, 필요 없는 테이블을 삭제한 뒤 SQL Editor에서 다시 깔끔하게 설치할 수 있는 SQL을 원했다. 유지하고 싶은 핵심 범위는 계정, 프로필, 좋아요한 병원/Q&A 글, Q&A 글, 다이어리, 내가 등록한 펫, 병원, 병원 리뷰였다.

## 분석·판단 이유

원격 DB 확인 결과 실제 데이터가 있는 핵심 테이블은 `profiles`, `pets`, `care_records`, `care_plans`, `daily_tasks` 정도였다. `app_*` 계열 테이블은 모두 비어 있는 legacy 테이블이었다. `feeding_reminders`는 `care_plans/daily_tasks` 이전의 fallback 구조이고, `media_assets`는 현재 앱 코드에서 직접 사용하지 않았다.

반면 `community_posts`, `post_comments`, `drafts`, `visit_records`, `medication_plans`는 현재 또는 연결 예정 기능에 필요하므로 삭제하지 않는 쪽으로 판단했다. 병원과 병원 리뷰는 사용자가 다시 유지 대상으로 말했기 때문에 `hospitals`, `hospital_reviews`, `likes`를 기준 구조로 보장하는 SQL을 만들었다.

## 수정 파일

- `supabase/cleanup_public_schema_for_sql_editor.sql`
- `docs/project-records/2026-07-29-db-cleanup.md`

## 핵심 변경 내용

- Supabase SQL Editor에 붙여넣을 수 있는 DB 정리 스크립트를 추가했다.
- 삭제 대상:
  - `app_likes`
  - `app_care_records`
  - `app_community_posts`
  - `app_post_comments`
  - `app_share_items`
  - `app_hospital_reviews`
  - `app_pets`
  - `app_users`
  - `share_items`
  - `feeding_reminders`
  - `media_assets`
  - 기존 빈 `hospitals`
- 재생성 또는 보장 대상:
  - `hospitals`
  - `hospital_reviews`
  - `likes`
- 유지 대상:
  - `auth.users`
  - `profiles`
  - `pets`
  - `care_records`
  - `care_plans`
  - `daily_tasks`
  - `visit_records`
  - `medication_plans`
  - `community_posts`
  - `post_comments`
  - `drafts`

## 검증 결과

이번 작업은 SQL Editor용 스크립트 작성만 수행했다. 원격 DB에 직접 DROP 실행은 하지 않았다.

## 남은 작업

- SQL Editor에서 실행 전 Supabase 백업 또는 스냅샷을 확인해야 한다.
- 실행 후 앱 코드의 병원 리뷰와 좋아요 저장소를 `hospital_reviews`, `likes` 테이블로 완전히 연결해야 한다.
- `feeding_reminders` fallback 코드는 `care_plans/daily_tasks` 전환이 완전히 안정된 뒤 제거할 수 있다.
