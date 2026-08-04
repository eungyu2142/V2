-- Run after storing CRON_SECRET in Supabase Vault under `routine_cron_secret`.
-- 15:05 UTC is 00:05 Asia/Seoul for the daily materializer in the migration.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'send-routine-notifications-every-minute';
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
end;
$$;

select cron.schedule(
  'send-routine-notifications-every-minute',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://ckevydslbfxnspyfikeu.supabase.co/functions/v1/send-routine-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'routine_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
