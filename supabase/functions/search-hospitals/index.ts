import { corsHeaders } from '../_shared/cors.ts'

type SearchRequest = {
  query?: string
  display?: number
  start?: number
  sort?: 'random' | 'comment'
}

type NaverLocalItem = {
  title: string
  link: string
  category: string
  description: string
  telephone: string
  address: string
  roadAddress: string
  mapx: string
  mapy: string
}

const DEFAULT_QUERY = '특수동물병원'
const NAVER_LOCAL_LIMIT = 20

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await readRequest(request)
    const clientId = Deno.env.get('NAVER_SEARCH_CLIENT_ID')
    const clientSecret = Deno.env.get('NAVER_SEARCH_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      return json({ error: 'missing_naver_credentials', message: 'Naver Search API keys are not configured.' }, 500)
    }

    const query = body.query?.trim() || DEFAULT_QUERY
    const requestedDisplay = clamp(body.display, 1, 100, 20)
    const start = clamp(body.start, 1, 1000, 1)
    const sort = body.sort === 'comment' ? 'comment' : 'random'
    const items = await searchNaverLocalPages({ query, display: requestedDisplay, start, sort, clientId, clientSecret })

    return json({ count: items.length, query, items })
  } catch (error) {
    if (error instanceof Error && error.name === 'rate_limited') {
      return json({ error: 'rate_limited', message: 'Rate limit exceeded.', status: 429 }, 429)
    }
    if (error instanceof Error && error.name === 'naver_search_failed') {
      return json({ error: 'naver_search_failed', message: error.message }, 502)
    }
    return json({ error: 'search_hospitals_failed', message: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

async function searchNaverLocalPages({
  query,
  display,
  start,
  sort,
  clientId,
  clientSecret,
}: {
  query: string
  display: number
  start: number
  sort: 'random' | 'comment'
  clientId: string
  clientSecret: string
}) {
  const collected: Array<NaverLocalItem & { query: string }> = []
  let currentStart = start

  while (collected.length < display && currentStart <= 1000) {
    const pageSize = Math.min(NAVER_LOCAL_LIMIT, display - collected.length)
    const url = new URL('https://openapi.naver.com/v1/search/local.json')
    url.searchParams.set('query', query)
    url.searchParams.set('display', String(pageSize))
    url.searchParams.set('start', String(currentStart))
    url.searchParams.set('sort', sort)

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })

    const text = await response.text()
    if (!response.ok) {
      const error = new Error(response.status === 429 ? 'Rate limit exceeded.' : text)
      error.name = response.status === 429 ? 'rate_limited' : 'naver_search_failed'
      throw error
    }

    const data = JSON.parse(text) as { items?: NaverLocalItem[] }
    const pageItems = data.items ?? []
    collected.push(...pageItems.map((item) => ({ ...item, query })))
    if (pageItems.length < pageSize) break
    currentStart += pageSize
  }

  return collected.map((item, index) => ({
      id: `${cleanHtml(item.title)}-${item.mapx}-${item.mapy}-${index}`,
      title: cleanHtml(item.title),
      link: item.link,
      category: cleanHtml(item.category),
      description: cleanHtml(item.description),
      telephone: item.telephone,
      address: item.address,
      roadAddress: item.roadAddress,
      mapx: item.mapx,
      mapy: item.mapy,
      query,
    }))
}

async function readRequest(request: Request): Promise<SearchRequest> {
  if (request.method === 'GET') {
    const url = new URL(request.url)
    return {
      query: url.searchParams.get('query') ?? undefined,
      display: parseNumber(url.searchParams.get('display')),
      start: parseNumber(url.searchParams.get('start')),
      sort: url.searchParams.get('sort') === 'comment' ? 'comment' : 'random',
    }
  }

  if (request.method !== 'POST') {
    throw new Error('Only GET and POST are supported.')
  }

  return await request.json().catch(() => ({}))
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (!value || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.floor(value), min), max)
}

function parseNumber(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function cleanHtml(value: string) {
  return value.replaceAll(/<[^>]*>/g, '').replaceAll('&amp;', '&').trim()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
