-- ============================================================================
-- Turn & River Field — phone notifications
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run twice.
-- Do this after deploying the send-push function (see the steps you were sent).
--
-- Who is told what (never the person who made the change):
--   rep (or whoever it's assigned to)  a lead assigned to them; a visit booked
--                                      for them; a visit moved, cancelled, or
--                                      handed to someone else
--   owner + client coordinator         a new TeleCRM lead; an order confirmed
--   owner only                         a payment recorded
-- ============================================================================

create extension if not exists pg_net with schema extensions;

-- Each phone that has said yes to notifications.
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  device      text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

-- A phone signs itself up (or moves to whoever signed in on it last).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_device text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is null then raise exception 'Not allowed.'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, device)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_device, ''), 120))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, created_at = now();
end $$;
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- What's waiting to go out, and what went.
create table if not exists public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  url         text not null default '/',
  tag         text not null default '',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists notifications_unsent on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------- helpers ----
create or replace function public.inr(n numeric) returns text language plpgsql immutable as $$
declare s text := round(abs(coalesce(n, 0)))::bigint::text; head text; tail text;
begin
  if length(s) <= 3 then return '₹' || s; end if;
  tail := right(s, 3); head := left(s, length(s) - 3);
  head := regexp_replace(reverse(regexp_replace(reverse(head), '(\d{2})(?=\d)', '\1,', 'g')), '^,', '');
  return '₹' || head || ',' || tail;
end $$;

create or replace function public.visit_label(t text) returns text language sql immutable as $$
  select case t when 'consult' then 'Consultation' when 'measure' then 'Measurements' when 'trial1' then 'Trial 1'
    when 'trial2' then 'Trial 2' when 'delivery' then 'Delivery' when 'alteration' then 'Alteration' else initcap(coalesce(t, 'Visit')) end
$$;

create or replace function public.visit_when(d date, t text) returns text language sql immutable as $$
  select to_char(d, 'Dy FMDD Mon') ||
    case when coalesce(t, '') ~ '^\d{1,2}:\d{2}' then ', ' || lower(to_char(('2000-01-01 ' || t)::timestamp, 'FMHH12:MI am')) else '' end
$$;

create or replace function public.person_name(u uuid) returns text language sql stable security definer set search_path = public as $$
  select split_part(coalesce((select name from public.profiles where id = u), ''), ' ', 1)
$$;

-- Queue one notification, unless it's for the person who caused it.
create or replace function public.notify(p_user uuid, p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from auth.uid() then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and active) then return; end if;
  insert into public.notifications (user_id, title, body, url, tag) values (p_user, p_title, coalesce(p_body, ''), coalesce(p_url, '/'), coalesce(p_tag, ''));
end $$;

create or replace function public.notify_roles(p_roles text[], p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select id from public.profiles where active and role = any (p_roles) loop
    perform public.notify(u, p_title, p_body, p_url, p_tag);
  end loop;
end $$;

-- ------------------------------------------------------------ triggers ----
create or replace function public.on_client_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare nxt text; by_whom text := public.person_name(auth.uid());
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    select public.visit_label(a.type) || ' ' || public.visit_when(a.date, a.time) into nxt
      from public.appointments a where a.client_id = new.id and a.status = 'scheduled' and a.date >= current_date
      order by a.date, a.time limit 1;
    perform public.notify(new.assigned_to, 'New lead: ' || new.name,
      concat_ws(' · ', nullif(new.city, ''), nullif(new.occasion, ''), coalesce(nxt, 'No visit booked yet'), case when by_whom <> '' then 'from ' || by_whom end),
      '/?go=client:' || new.id, 'client:' || new.id);
  end if;
  if tg_op = 'INSERT' and new.source = 'telecrm' then
    perform public.notify_roles(array['owner','coordinator'], 'New TeleCRM lead: ' || new.name,
      concat_ws(' · ', nullif(new.city, ''), nullif(new.occasion, ''), case when new.assigned_to is null then 'needs a rep' end),
      '/?go=client:' || new.id, 'client:' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists notify_client on public.clients;
create trigger notify_client after insert or update of assigned_to on public.clients
  for each row execute function public.on_client_change();

create or replace function public.on_appointment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.clients; what text; place text; url text;
begin
  select * into c from public.clients where id = new.client_id;
  what := public.visit_label(new.type);
  place := nullif(split_part(coalesce(c.address, ''), E'\n', 1), '');
  url := '/?go=client:' || new.client_id;
  if tg_op = 'INSERT' then
    if new.status = 'scheduled' then
      perform public.notify(new.assigned_to, 'Visit booked: ' || c.name, concat_ws(' · ', what, public.visit_when(new.date, new.time), place, nullif(c.city, '')), url, 'client:' || c.id);
    end if;
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to and new.status = 'scheduled' then
    perform public.notify(new.assigned_to, 'Visit booked: ' || c.name, concat_ws(' · ', what, public.visit_when(new.date, new.time), place, nullif(c.city, '')), url, 'client:' || c.id);
    perform public.notify(old.assigned_to, 'Visit handed over: ' || c.name, what || ' ' || public.visit_when(old.date, old.time) || ' is now with ' || public.person_name(new.assigned_to), url, 'client:' || c.id);
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.notify(new.assigned_to, 'Visit cancelled: ' || c.name, what || ' ' || public.visit_when(old.date, old.time) || ' is off', url, 'client:' || c.id);
  elsif new.status = 'scheduled' and (new.date is distinct from old.date or new.time is distinct from old.time) then
    perform public.notify(new.assigned_to, 'Visit moved: ' || c.name, what || ' now ' || public.visit_when(new.date, new.time) || ' (was ' || public.visit_when(old.date, old.time) || ')', url, 'client:' || c.id);
  end if;
  return new;
end $$;
drop trigger if exists notify_appointment on public.appointments;
create trigger notify_appointment after insert or update on public.appointments
  for each row execute function public.on_appointment_change();

create or replace function public.on_order_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.clients; by_whom text := public.person_name(auth.uid());
begin
  if auth.uid() is null then return new; end if;   -- data brought in through the SQL editor
  select * into c from public.clients where id = new.client_id;
  perform public.notify_roles(array['owner','coordinator'], 'Order confirmed: ' || new.number,
    concat_ws(' · ', c.name, nullif(c.city, ''), case when new.total is not null then public.inr(new.total) end, case when by_whom <> '' then 'by ' || by_whom end),
    '/?go=order:' || new.id, 'order:' || new.id);
  return new;
end $$;
drop trigger if exists notify_order on public.orders;
create trigger notify_order after insert on public.orders
  for each row execute function public.on_order_insert();

create or replace function public.on_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.orders; c public.clients; by_whom text := public.person_name(auth.uid());
begin
  if auth.uid() is null then return new; end if;
  select * into o from public.orders where id = new.order_id;
  select * into c from public.clients where id = o.client_id;
  perform public.notify_roles(array['owner'], 'Payment received: ' || public.inr(new.amount),
    concat_ws(' · ', o.number, c.name, nullif(new.method, ''), nullif(new.reference, ''), case when by_whom <> '' then 'by ' || by_whom end),
    '/?go=order:' || o.id, 'pay:' || new.id);
  return new;
end $$;
drop trigger if exists notify_payment on public.payments;
create trigger notify_payment after insert on public.payments
  for each row execute function public.on_payment_insert();

-- Hand the queue to the send-push function as soon as something is added.
-- A failure here never blocks the change that caused it.
create or replace function public.kick_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(url := 'https://tkgollbusscruzmedmdb.supabase.co/functions/v1/send-push',
                          body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists kick_push on public.notifications;
create trigger kick_push after insert on public.notifications
  for each statement execute function public.kick_push();

-- Send yourself a test from More → Account.
create or replace function public.notify_test() returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is null then raise exception 'Not allowed.'; end if;
  insert into public.notifications (user_id, title, body, url, tag)
  values (auth.uid(), 'Turn & River', 'Notifications are working on this phone.', '/', 'test');
end $$;

revoke execute on function public.notify(uuid, text, text, text, text), public.notify_roles(text[], text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text), public.notify_test() to authenticated;
revoke all on public.push_subscriptions, public.notifications from anon;
revoke insert, update, delete on public.push_subscriptions, public.notifications from authenticated;
grant select on public.push_subscriptions, public.notifications to authenticated;

select 'ok' as notifications;
