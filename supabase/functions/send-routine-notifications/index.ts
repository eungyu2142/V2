// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.108.2'

type NotificationStage = 1 | 2 | 3

type NotificationJob = {
  id: string
  user_id: string
  pet_id: string
  routine_id: string
  routine_date: string
  scheduled_at: string
  next_notification_at: string
  notification_stage: NotificationStage
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

type DeliveryResult = {
  delivered: number
  expired: number
  failed: number
}

const SEOUL_TIME_ZONE = 'Asia/Seoul'
const DEFAULT_BATCH_LIMIT = 50
const MAX_BATCH_LIMIT = 100
const TEN_MINUTES_MS = 10 * 60 * 1000
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

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
    deliveredJobs: 0,
    retryJobs: 0,
    deliveredDevices: 0,
    expiredSubscriptions: 0,
    failedDevices: 0,
  }

  for (const job of jobs) {
    const scheduledFor = job.next_notification_at

    try {
      const { data: subscriptionData, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', String(job.user_id))
        .eq('is_active', true)

      if (subscriptionsError) throw subscriptionsError

      const subscriptions = (subscriptionData ?? []) as PushSubscriptionRow[]
      const { data: currentJob, error: currentJobError } = await supabase
        .from('routine_notification_jobs')
        .select('status, next_notification_at')
        .eq('id', job.id)
        .maybeSingle()

      if (currentJobError) throw currentJobError
      if (
        currentJob?.status !== 'processing'
        || currentJob.next_notification_at !== scheduledFor
      ) {
        continue
      }

      const payload = buildPayload(job, scheduledFor)
      const delivery = await deliverToSubscriptions(
        subscriptions,
        payload,
        async (subscriptionId) => {
          const { error } = await supabase
            .from('push_subscriptions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', subscriptionId)
          if (error) console.error('Failed to deactivate an expired push subscription.', error)
        },
      )

      summary.deliveredDevices += delivery.delivered
      summary.expiredSubscriptions += delivery.expired
      summary.failedDevices += delivery.failed

      if (delivery.delivered > 0) {
        const nextState = getNextNotificationState(job)
        const { error: updateError } = await supabase
          .from('routine_notification_jobs')
          .update({
            notification_stage: nextState.stage,
            next_notification_at: nextState.nextNotificationAt,
            status: 'pending',
            last_notification_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .eq('status', 'processing')
          .eq('next_notification_at', scheduledFor)

        if (updateError) throw updateError
        summary.deliveredJobs += 1
      } else {
        await releaseJobForRetry(supabase, job.id, scheduledFor)
        summary.retryJobs += 1
      }
    } catch (error: unknown) {
      console.error(`Routine notification job ${job.id} failed.`, error)
      await releaseJobForRetry(supabase, job.id, scheduledFor)
      summary.retryJobs += 1
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

function buildPayload(job: NotificationJob, scheduledFor: string): PushPayload {
  const tag = `routine-${job.routine_id}-${scheduledFor}`
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
    scheduledFor,
    tag,
    url: `/diary?${query.toString()}`,
  }
}

async function deliverToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
  deactivateExpired: (subscriptionId: string) => Promise<void>,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { delivered: 0, expired: 0, failed: 0 }
  const message = JSON.stringify(payload)

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, message, {
        TTL: 60 * 60,
        urgency: 'high',
      })
      result.delivered += 1
    } catch (error: unknown) {
      const statusCode = readWebPushStatusCode(error)
      if (statusCode === 404 || statusCode === 410) {
        result.expired += 1
        await deactivateExpired(subscription.id)
        continue
      }

      result.failed += 1
      console.error(`Push delivery failed for subscription ${subscription.id}.`, error)
    }
  }

  return result
}

function readWebPushStatusCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null
  const statusCode = Reflect.get(error, 'statusCode')
  return typeof statusCode === 'number' ? statusCode : null
}

function getNextNotificationState(job: NotificationJob) {
  if (job.notification_stage === 1) {
    return {
      stage: 2 as const,
      nextNotificationAt: new Date(new Date(job.scheduled_at).getTime() + TEN_MINUTES_MS).toISOString(),
    }
  }

  if (job.notification_stage === 2) {
    return {
      stage: 3 as const,
      nextNotificationAt: addSeoulCalendarDays(job.scheduled_at, 1),
    }
  }

  return {
    stage: 3 as const,
    nextNotificationAt: addSeoulCalendarDays(job.next_notification_at, 1),
  }
}

function addSeoulCalendarDays(isoValue: string, days: number) {
  const source = new Date(isoValue)
  if (Number.isNaN(source.getTime())) throw new Error('INVALID_NOTIFICATION_DATE')

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(source)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const localDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + days,
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ))

  return new Date(localDate.getTime() - SEOUL_OFFSET_MS).toISOString()
}

async function releaseJobForRetry(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  scheduledFor: string,
) {
  const { error } = await supabase
    .from('routine_notification_jobs')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'processing')
    .eq('next_notification_at', scheduledFor)

  if (error) console.error(`Failed to release notification job ${jobId} for retry.`, error)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
