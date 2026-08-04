// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.108.2'

type NotificationType = 'initial' | 'retry-10m' | 'retry-next-day'

type NotificationJob = {
  id: string
  user_id: string
  pet_id: string
  routine_id: string
  routine_date: string
  occurrence_id: string
  scheduled_at: string
  next_notification_at: string
  notification_type: NotificationType
  attempt_count: number
  dedupe_key: string
  status: string
}

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

type PushPayload = {
  title: string
  body: string
  petId: string
  routineId: string
  routineDate: string
  scheduledFor: string
  tag: string
  url: string
}

type DeliveryResult = { delivered: number; expired: number; failed: number }
type NextJob = { type: NotificationType; scheduledAt: string; dedupeKey: string }

const SEOUL_TIME_ZONE = 'Asia/Seoul'
const DEFAULT_BATCH_LIMIT = 50
const MAX_BATCH_LIMIT = 100
const MAX_ATTEMPTS = 5

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || !isAuthorizedCronRequest(request, cronSecret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    console.error('Required notification secrets are missing.')
    return json({ error: 'notification_secrets_missing' }, 500)
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const batchLimit = readBatchLimit(Deno.env.get('ROUTINE_NOTIFICATION_BATCH_SIZE'))
  const { data, error: claimError } = await supabase
    .rpc('claim_due_routine_notification_jobs', { p_limit: batchLimit })
  if (claimError) {
    console.error('Failed to claim routine notification jobs.', claimError)
    return json({ error: 'notification_jobs_claim_failed' }, 500)
  }

  const jobs = (data ?? []) as NotificationJob[]
  const summary = {
    claimed: jobs.length,
    sent: 0,
    retried: 0,
    failed: 0,
    deliveredDevices: 0,
    expiredSubscriptions: 0,
  }

  for (const job of jobs) {
    try {
      const { data: occurrence, error: occurrenceError } = await supabase
        .from('daily_tasks')
        .select('status')
        .eq('id', job.occurrence_id)
        .maybeSingle()
      if (occurrenceError) throw occurrenceError
      if (!occurrence || occurrence.status !== 'pending') {
        await cancelClaimedJob(supabase, job.id)
        continue
      }

      const { data: subscriptionData, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', String(job.user_id))
        .eq('is_active', true)
      if (subscriptionsError) throw subscriptionsError

      const payload = buildPayload(job)
      const delivery = await deliverToSubscriptions(
        (subscriptionData ?? []) as PushSubscriptionRow[],
        payload,
        async (subscriptionId) => {
          const { error } = await supabase
            .from('push_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', subscriptionId)
          if (error) console.error('Failed to deactivate expired subscription.', error)
        },
      )
      summary.deliveredDevices += delivery.delivered
      summary.expiredSubscriptions += delivery.expired

      if (delivery.delivered === 0) {
        const failedPermanently = await releaseJobForRetry(supabase, job)
        if (failedPermanently) summary.failed += 1
        else summary.retried += 1
        continue
      }

      const next = getNextJob(job)
      const { data: finished, error: finishError } = await supabase.rpc('finish_routine_notification_job', {
        p_job_id: job.id,
        p_expected_scheduled_at: job.scheduled_at,
        p_next_notification_type: next.type,
        p_next_scheduled_at: next.scheduledAt,
        p_next_dedupe_key: next.dedupeKey,
      })
      if (finishError) throw finishError
      if (finished) summary.sent += 1
    } catch (error: unknown) {
      console.error(`Routine notification job ${job.id} failed.`, error)
      const failedPermanently = await releaseJobForRetry(supabase, job)
      if (failedPermanently) summary.failed += 1
      else summary.retried += 1
    }
  }

  return json(summary)
})

function isAuthorizedCronRequest(request: Request, expectedSecret: string) {
  const directSecret = request.headers.get('x-cron-secret')
  const authorization = request.headers.get('authorization')
  const bearerSecret = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null
  return directSecret === expectedSecret || bearerSecret === expectedSecret
}

function readBatchLimit(value: string | undefined) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_BATCH_LIMIT
  return Math.min(parsed, MAX_BATCH_LIMIT)
}

function buildPayload(job: NotificationJob): PushPayload {
  const query = new URLSearchParams({
    petId: String(job.pet_id),
    routineId: String(job.routine_id),
    date: job.routine_date,
  })
  return {
    title: 'ExoCare',
    body: '펫의 루틴을 확인해 주세요.',
    petId: String(job.pet_id),
    routineId: String(job.routine_id),
    routineDate: job.routine_date,
    scheduledFor: job.scheduled_at,
    tag: job.dedupe_key,
    url: `/diary?${query.toString()}`,
  }
}

function getNextJob(job: NotificationJob): NextJob {
  const base = `routine:${job.routine_id}:occurrence:${job.occurrence_id}`
  if (job.notification_type === 'initial') {
    return {
      type: 'retry-10m',
      scheduledAt: new Date(new Date(job.scheduled_at).getTime() + 10 * 60 * 1000).toISOString(),
      dedupeKey: `${base}:retry-10m`,
    }
  }

  const scheduledAt = addSeoulCalendarDays(job.scheduled_at, 1)
  return {
    type: 'retry-next-day',
    scheduledAt,
    dedupeKey: `${base}:retry-next-day:${formatSeoulDate(scheduledAt)}`,
  }
}

function addSeoulCalendarDays(isoValue: string, days: number) {
  const source = new Date(isoValue)
  if (Number.isNaN(source.getTime())) throw new Error('INVALID_NOTIFICATION_DATE')
  const values = readSeoulParts(source)
  const calendarDate = new Date(Date.UTC(values.year, values.month - 1, values.day + days))
  const year = calendarDate.getUTCFullYear()
  const month = String(calendarDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(calendarDate.getUTCDate()).padStart(2, '0')
  const hour = String(values.hour).padStart(2, '0')
  const minute = String(values.minute).padStart(2, '0')
  const second = String(values.second).padStart(2, '0')
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`).toISOString()
}

function formatSeoulDate(isoValue: string) {
  const values = readSeoulParts(new Date(isoValue))
  return `${values.year}-${String(values.month).padStart(2, '0')}-${String(values.day).padStart(2, '0')}`
}

function readSeoulParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: value('year'), month: value('month'), day: value('day'),
    hour: value('hour'), minute: value('minute'), second: value('second'),
  }
}

async function deliverToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
  deactivateExpired: (subscriptionId: string) => Promise<void>,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { delivered: 0, expired: 0, failed: 0 }
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(payload), { TTL: 60 * 60, urgency: 'high' })
      result.delivered += 1
    } catch (error: unknown) {
      const statusCode = readWebPushStatusCode(error)
      if (statusCode === 404 || statusCode === 410) {
        result.expired += 1
        await deactivateExpired(subscription.id)
      } else {
        result.failed += 1
        console.error(`Push delivery failed for subscription ${subscription.id}.`, error)
      }
    }
  }
  return result
}

function readWebPushStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  const statusCode = Reflect.get(error, 'statusCode')
  return typeof statusCode === 'number' ? statusCode : null
}

async function cancelClaimedJob(supabase: ReturnType<typeof createClient>, jobId: string) {
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'processing')
  if (error) console.error(`Failed to cancel notification job ${jobId}.`, error)
}

async function releaseJobForRetry(
  supabase: ReturnType<typeof createClient>,
  job: NotificationJob,
) {
  const failedPermanently = job.attempt_count >= MAX_ATTEMPTS
  const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({
      status: failedPermanently ? 'failed' : 'pending',
      next_notification_at: failedPermanently ? job.next_notification_at : retryAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'processing')
  if (error) console.error(`Failed to release notification job ${job.id}.`, error)
  return failedPermanently
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
