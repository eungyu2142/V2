import { corsHeaders } from '../_shared/cors.ts'

type RecognitionRequest = { image?: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { image } = await request.json() as RecognitionRequest
    if (!image?.startsWith('data:image/')) return json({ error: 'image_required' }, 400)
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'ocr_not_configured' }, 503)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'text', text: '이 동물병원 약봉투에서 약 이름, 1회 복용량, 복용 시작일, 종료일, 하루 복용 횟수, 복용 안내를 읽어 JSON으로 반환하세요. 읽을 수 없는 값은 빈 문자열로 두고 추측하지 마세요. 키: name, dose, startDate, endDate, dailyCount, instructions.' },
          { type: 'image_url', image_url: { url: image } },
        ] }],
      }),
    })
    if (!response.ok) return json({ error: 'ocr_request_failed' }, 502)
    const raw = await response.json()
    const content = raw?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return json({ error: 'ocr_result_missing' }, 502)
    const parsed = JSON.parse(content)
    return json({
      name: String(parsed.name ?? ''),
      dose: String(parsed.dose ?? ''),
      startDate: normalizeDate(parsed.startDate),
      endDate: normalizeDate(parsed.endDate),
      dailyCount: Math.max(1, Number(parsed.dailyCount) || 1),
      instructions: String(parsed.instructions ?? ''),
      raw: parsed,
    })
  } catch (error) {
    return json({ error: 'recognition_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim().replaceAll('.', '-').replaceAll('/', '-')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
