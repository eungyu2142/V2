-- VAPID key rotation invalidates browser subscriptions created with the old
-- applicationServerKey. Clients will re-register after detecting the mismatch.
update public.push_subscriptions
set
  is_active = false,
  updated_at = now()
where is_active = true;
