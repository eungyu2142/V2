# search-hospitals

Supabase Edge Function for searching special-animal hospitals through the Naver Local Search API.

## Secrets

Set these in Supabase before deploying:

```powershell
cmd /c npx.cmd supabase secrets set NAVER_SEARCH_CLIENT_ID=your_client_id NAVER_SEARCH_CLIENT_SECRET=your_client_secret
```

## Deploy

```powershell
cmd /c npx.cmd supabase functions deploy search-hospitals
```

## Request

```http
POST /functions/v1/search-hospitals
Content-Type: application/json
Authorization: Bearer <user-or-anon-token>

{
  "query": "특수동물병원",
  "category": "파충류",
  "latitude": 37.5665,
  "longitude": 126.978,
  "display": 10
}
```

## Response

```json
{
  "query": "특수동물병원",
  "count": 1,
  "hospitals": [
    {
      "id": "병원-...",
      "name": "병원명",
      "category": "병원,의원 > 동물병원",
      "address": "도로명 주소",
      "telephone": "전화번호",
      "link": "https://...",
      "latitude": 37.0,
      "longitude": 127.0,
      "distanceMeters": 1200,
      "tags": ["파충류"]
    }
  ]
}
```
