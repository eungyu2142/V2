-- Fail deployment early when the scheduler cannot authenticate its request.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'routine_cron_secret'
  ) then
    raise exception 'Vault secret routine_cron_secret is required';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'materialize-routine-notification-window' and active
  ) then
    raise exception 'Routine materialization cron is not active';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'send-routine-notifications-every-minute' and active
  ) then
    raise exception 'Routine notification sender cron is not active';
  end if;
end;
$$;
