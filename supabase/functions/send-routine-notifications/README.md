# send-routine-notifications

완료되지 않은 루틴의 정시, 10분 뒤, 다음 날 반복 Web Push를 전송한다.

## 필요한 Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`
- `ROUTINE_NOTIFICATION_BATCH_SIZE` 선택, 기본값 50, 최대 100

VAPID 비공개 키와 Cron Secret은 저장소나 프론트엔드 환경변수에 넣지 않는다.
프론트엔드의 `VITE_VAPID_PUBLIC_KEY`에는 같은 VAPID 공개 키만 등록한다.

## 적용 및 배포

```powershell
cmd /c npx.cmd supabase db push
cmd /c npx.cmd supabase secrets set `
  VAPID_PUBLIC_KEY="<public-key>" `
  VAPID_PRIVATE_KEY="<private-key>" `
  VAPID_SUBJECT="mailto:admin@example.com" `
  CRON_SECRET="<long-random-secret>"
cmd /c npx.cmd supabase functions deploy send-routine-notifications --use-api
```

`supabase/config.toml`에서 이 함수는 `verify_jwt = false`로 설정되어 있다.
대신 모든 요청에서 `x-cron-secret` 또는 `Authorization: Bearer <CRON_SECRET>`을 검사한다.

## 수동 호출

```powershell
$headers = @{
  "x-cron-secret" = "<CRON_SECRET>"
  "Content-Type" = "application/json"
}
Invoke-RestMethod `
  -Method Post `
  -Uri "https://<project-ref>.supabase.co/functions/v1/send-routine-notifications" `
  -Headers $headers `
  -Body "{}"
```

## 테스트 순서

1. `push_subscriptions`에 테스트 사용자의 활성 구독이 있는지 확인한다.
2. 같은 사용자의 `routine_notification_jobs` 작업을 `pending`으로 두고 `next_notification_at`을 현재보다 이전으로 설정한다.
3. 함수를 한 번 호출하고 `notification_stage = 2`, `next_notification_at = scheduled_at + 10분`인지 확인한다.
4. 다시 due 상태로 만든 뒤 호출해 stage 3과 다음 날 같은 서울 시각을 확인한다.
5. 작업을 `completed`, `skipped`, `cancelled`로 바꾸고 호출해 발송되지 않는지 확인한다.
6. 만료된 구독으로 404 또는 410 응답을 만들고 `is_active = false`로 변경되는지 확인한다.
7. 동일 시점에 함수를 여러 번 호출해 한 실행만 작업을 선점하는지 확인한다.

로컬 Edge Runtime 실행에는 Docker Desktop이 필요하다.

```powershell
cmd /c npx.cmd supabase functions serve send-routine-notifications --no-verify-jwt
```
