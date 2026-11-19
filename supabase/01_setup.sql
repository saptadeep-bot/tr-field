-- ============================================================================
-- Turn & River Field — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, on an empty project. It creates the tables, the access rules
-- for each role, and the private store for measurement-form photos.
--
-- Who sees what (enforced here, in the database, not only on screen):
--   owner        everything, including ex-mill cloth rates and order costs
--   coordinator  every client, contact details, prices; no costs
--   rep          only clients assigned to them (or sent to visit); prices; no costs
--   workroom     open orders, the client's name and city, measurements; no prices,
--                no phone numbers, no addresses
-- A new sign-in is switched off until the owner turns it on in the app.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- people ----
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text not null default '',
  role        text not null default 'rep' check (role in ('owner','coordinator','rep','tailor')),
  city        text not null default '',
  phone       text not null default '',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- The signed-in person's role, or null if they are switched off.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- The first person ever to sign in becomes the owner. Everyone after that
-- arrives switched off, as a rep, until the owner turns them on.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, email, name, role, active)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'name', ''), initcap(split_part(new.email, '@', 1))),
          case when is_first then 'owner' else 'rep' end,
          is_first)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who already signed in before this script ran gets a profile too.
insert into public.profiles (id, email, name, role, active)
select u.id, u.email, initcap(split_part(u.email, '@', 1)),
       case when row_number() over (order by u.created_at) = 1 then 'owner' else 'rep' end,
       row_number() over (order by u.created_at) = 1
from auth.users u
on conflict (id) do nothing;

-- Nobody can change their own role or switch themselves on, and the last
-- active owner can't be removed.
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = auth.uid() and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'You can''t change your own role or access.';
  end if;
  if old.role = 'owner' and old.active and (new.role <> 'owner' or not new.active)
     and not exists (select 1 from public.profiles where role = 'owner' and active and id <> old.id) then
    raise exception 'There must always be one active owner.';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- --------------------------------------------------------------- clients ----
create table public.clients (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  phone         text not null default '',
  email         text not null default '',
  city          text not null default '',
  address       text not null default '',
  source        text not null default 'other',
  source_detail text not null default '',
  occasion      text not null default '',
  event_date    date,
  budget        text not null default '',
  assigned_to   uuid references public.profiles(id) on delete set null,
  stage         text not null default 'new',
  stage_since   date not null default current_date,
  lost_reason   text not null default '',
  follow_up_on  date,
  telecrm_id    text not null default '',
  notes         text not null default '',
  created_at    date not null default current_date
);
create index on public.clients (assigned_to);

create table public.appointments (
  id           text primary key default gen_random_uuid()::text,
  client_id    text not null references public.clients(id) on delete cascade,
  type         text not null default 'consult',
  date         date not null,
  time         text not null default '',
  assigned_to  uuid references public.profiles(id) on delete set null,
  status       text not null default 'scheduled',
  notes        text not null default '',
  outcome      text not null default ''
);
create index on public.appointments (client_id);
create index on public.appointments (assigned_to, status);

-- ----------------------------------------------------------------- orders ---
create sequence public.order_no start 1;

create table public.orders (
  id                text primary key default gen_random_uuid()::text,
  number            text not null unique default 'TR-' || lpad(nextval('public.order_no')::text, 4, '0'),
  client_id         text not null references public.clients(id) on delete cascade,
  created_at        date not null default current_date,
  status            text not null default 'confirmed',
  created_by        uuid references public.profiles(id) on delete set null default auth.uid(),
  items             jsonb not null default '[]',   -- garment, tier, cloth, qty, specs. Never prices.
  dates             jsonb not null default '{}',   -- trial1, trial2, delivery
  total             numeric,
  gst_pct           numeric,
  price_incomplete  boolean not null default false,
  imported          boolean not null default false,
  notes             text not null default ''
);
create index on public.orders (client_id);

-- What an order actually cost. Owner only.
create table public.order_costs (
  order_id   text primary key references public.orders(id) on delete cascade,
  fabric     numeric not null default 0,
  stitching  numeric not null default 0,
  logistics  numeric not null default 0,
  delivery   numeric not null default 0
);

create table public.payments (
  id          text primary key default gen_random_uuid()::text,
  order_id    text not null references public.orders(id) on delete cascade,
  stage       text not null default 'advance',
  amount      numeric not null check (amount > 0),
  date        date not null default current_date,
  method      text not null default '',
  reference   text not null default '',
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on public.payments (order_id);

create table public.quotes (
  id          text primary key default gen_random_uuid()::text,
  client_id   text not null references public.clients(id) on delete cascade,
  created_at  date not null default current_date,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  status      text not null default 'open',
  items       jsonb not null default '[]'
);
create index on public.quotes (client_id);

-- ------------------------------------------------------------------ cloth ---
-- What the team may see about a cloth, plus the per-metre price that goes
-- into a client's quote. The ex-mill rate lives in fabric_costs (owner only).
create table public.fabrics (
  id           text primary key default gen_random_uuid()::text,
  house        text not null default '',
  mill         text not null default '',
  design       text not null default '',
  colour       text not null default '',
  composition  text not null default '',
  weight       numeric,
  weave        text not null default '',
  pattern      text not null default '',
  use          text not null default 'suiting',
  fibre        text not null default '',
  width_cm     numeric,
  book         text not null default '',
  notes        text not null default '',
  active       boolean not null default true,
  price_per_m  numeric          -- worked out by the database from the owner's cost
);

create table public.fabric_costs (
  fabric_id  text primary key references public.fabrics(id) on delete cascade,
  vendor     text not null default '',
  ref        text not null default '',
  currency   text not null default 'INR',
  rate       numeric,
  rate_bulk  numeric,
  unit       text not null default 'm' check (unit in ('m','yd')),
  uplift     numeric,          -- per-cloth landing uplift %, blank = the house rule
  min_cut    numeric
);

-- Pricing the team uses: cloth consumption, stitching charges, fees, GST.
create table public.settings (
  id       int primary key default 1 check (id = 1),
  pricing  jsonb not null
);
-- Owner-only parts of pricing: exchange rates and the landing uplift.
create table public.cost_settings (
  id                  int primary key default 1 check (id = 1),
  fx                  jsonb not null default '{"INR":1,"EUR":100,"GBP":116,"USD":87}',
  landing_uplift_pct  numeric not null default 70
);

insert into public.settings (id, pricing) values (1, '{
  "consumption": {"twoPiece":4.0,"threePiece":4.5,"jacket":2.4,"overcoat":3.9,"trouser":1.6,"shirt":2.2,"bandhgala":4.0,"nehru":1.5},
  "making": {
    "rtw":  {"twoPiece":13000,"threePiece":15000,"jacket":8000,"overcoat":9000,"bandhgala":13000},
    "half": {"twoPiece":25000,"threePiece":32000,"jacket":15000,"overcoat":17000,"bandhgala":25000},
    "full": {"twoPiece":40000,"threePiece":45000,"jacket":25000,"overcoat":28000,"bandhgala":40000},
    "std":  {"trouser":2500,"shirt":2000,"nehru":2500},
    "prem": {"trouser":6000,"shirt":6000}
  },
  "convenience": {"twoPiece":1500,"threePiece":1500,"jacket":1500,"overcoat":1500,"trouser":1500,"shirt":500,"bandhgala":1500,"nehru":1500},
  "gstOnPrice": 5
}');
insert into public.cost_settings (id) values (1);

-- The per-metre price in a quote: ex-mill × exchange rate × (1 + uplift).
create or replace function public.landed_price(c public.fabric_costs) returns numeric
language sql stable security definer set search_path = public as $$
  select case when c.rate is null then null else
    round((case when c.unit = 'yd' then c.rate / 0.9144 else c.rate end)
      * coalesce((cs.fx ->> coalesce(nullif(c.currency, ''), 'INR'))::numeric, 1)
      * (1 + coalesce(c.uplift, cs.landing_uplift_pct) / 100), 2) end
  from public.cost_settings cs where cs.id = 1
$$;

create or replace function public.refresh_fabric_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.fabrics set price_per_m = public.landed_price(new) where id = new.fabric_id;
  return new;
end $$;
create trigger fabric_cost_price after insert or update on public.fabric_costs
  for each row execute function public.refresh_fabric_price();

create or replace function public.refresh_all_fabric_prices() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.fabrics f set price_per_m = public.landed_price(c)
  from public.fabric_costs c where c.fabric_id = f.id;
  return new;
end $$;
create trigger cost_settings_price after update on public.cost_settings
  for each row execute function public.refresh_all_fabric_prices();

-- ---------------------------------------------------- measurement forms ----
-- Every save is a new version. Versions are never edited or deleted, and the
-- database stamps who saved it and when, so the history can be trusted.
create table public.measure_forms (
  id          text primary key default gen_random_uuid()::text,
  client_id   text not null references public.clients(id) on delete cascade,
  v           int not null,
  reason      text not null default 'consult',
  form        jsonb not null,
  changes     jsonb not null default '[]',
  photos      text[] not null default '{}',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (client_id, v)
);

create or replace function public.stamp_measure_form() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('mf:' || new.client_id));
  select coalesce(max(v), 0) + 1 into new.v from public.measure_forms where client_id = new.client_id;
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end $$;
create trigger stamp_measure_form before insert on public.measure_forms
  for each row execute function public.stamp_measure_form();

-- ------------------------------------------------- activity and follow-ups -
create table public.activity (
  id         text primary key default gen_random_uuid()::text,
  client_id  text not null references public.clients(id) on delete cascade,
  at         timestamptz not null default now(),
  by         uuid references public.profiles(id) on delete set null,
  text       text not null
);
create index on public.activity (client_id);

create or replace function public.stamp_activity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.by := auth.uid(); new.at := now(); end if;
  return new;
end $$;
create trigger stamp_activity before insert on public.activity
  for each row execute function public.stamp_activity();

create table public.tasks (
  id           text primary key default gen_random_uuid()::text,
  client_id    text not null references public.clients(id) on delete cascade,
  title        text not null,
  due          date not null default current_date,
  assigned_to  uuid references public.profiles(id) on delete set null,
  done         boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid()
);
create index on public.tasks (client_id);

-- Automatic follow-ups someone has ticked off.
create table public.dismissed (
  key  text primary key,
  at   date not null default current_date,
  by   uuid references public.profiles(id) on delete set null default auth.uid()
);

-- ------------------------------------------------------- visibility rules ---
create or replace function public.can_see_client(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.my_role()
    when 'owner' then true
    when 'coordinator' then true
    when 'rep' then
      exists (select 1 from public.clients c where c.id = cid and c.assigned_to = auth.uid())
      or exists (select 1 from public.appointments a where a.client_id = cid and a.assigned_to = auth.uid() and a.status = 'scheduled')
    else false end
$$;

-- The workroom sees a client only while they have an order in the making.
create or replace function public.workroom_client(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'tailor'
     and exists (select 1 from public.orders o where o.client_id = cid and o.status <> 'delivered')
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('owner','coordinator','rep'), false)
$$;

alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.appointments  enable row level security;
alter table public.orders        enable row level security;
alter table public.order_costs   enable row level security;
alter table public.payments      enable row level security;
alter table public.quotes        enable row level security;
alter table public.fabrics       enable row level security;
alter table public.fabric_costs  enable row level security;
alter table public.settings      enable row level security;
alter table public.cost_settings enable row level security;
alter table public.measure_forms enable row level security;
alter table public.activity      enable row level security;
alter table public.tasks         enable row level security;
alter table public.dismissed     enable row level security;

-- profiles: every active person sees the team list; a switched-off person sees
-- only themselves (so the app can say "waiting for access").
create policy profiles_read on public.profiles for select to authenticated
  using (public.my_role() is not null or id = auth.uid());
create policy profiles_owner on public.profiles for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

-- clients
create policy clients_read on public.clients for select to authenticated
  using (public.can_see_client(id) or (public.my_role() = 'rep' and assigned_to = auth.uid()));
create policy clients_add on public.clients for insert to authenticated
  with check (public.my_role() in ('owner','coordinator') or (public.my_role() = 'rep' and assigned_to = auth.uid()));
create policy clients_edit on public.clients for update to authenticated
  using (public.is_staff() and public.can_see_client(id))
  with check (public.is_staff());
create policy clients_delete on public.clients for delete to authenticated
  using (public.my_role() = 'owner');

-- A rep can't hand a client to someone else; only the owner and coordinator assign.
create or replace function public.guard_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() = 'rep' and new.assigned_to is distinct from old.assigned_to then
    raise exception 'Only the owner or the coordinator can reassign a client.';
  end if;
  return new;
end $$;
create trigger guard_client before update on public.clients
  for each row execute function public.guard_client();

-- appointments
create policy appts_read on public.appointments for select to authenticated
  using (public.can_see_client(client_id));
create policy appts_add on public.appointments for insert to authenticated
  with check (public.is_staff() and (public.can_see_client(client_id) ));
create policy appts_edit on public.appointments for update to authenticated
  using (public.is_staff() and public.can_see_client(client_id)) with check (public.is_staff());
create policy appts_delete on public.appointments for delete to authenticated
  using (public.my_role() in ('owner','coordinator'));

-- orders
create policy orders_read on public.orders for select to authenticated
  using (public.can_see_client(client_id));
create policy orders_add on public.orders for insert to authenticated
  with check (public.is_staff() and public.can_see_client(client_id));
create policy orders_edit on public.orders for update to authenticated
  using (public.is_staff() and public.can_see_client(client_id)) with check (public.is_staff());
create policy orders_delete on public.orders for delete to authenticated
  using (public.my_role() = 'owner');

create policy order_costs_owner on public.order_costs for all to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

-- payments: anyone on the sales side can record one; only the owner corrects or removes.
create policy payments_read on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.can_see_client(o.client_id)));
create policy payments_add on public.payments for insert to authenticated
  with check (public.is_staff() and exists (select 1 from public.orders o where o.id = order_id and public.can_see_client(o.client_id)));
create policy payments_owner_edit on public.payments for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
create policy payments_owner_delete on public.payments for delete to authenticated
  using (public.my_role() = 'owner');

-- quotes
create policy quotes_read on public.quotes for select to authenticated
  using (public.can_see_client(client_id));
create policy quotes_add on public.quotes for insert to authenticated
  with check (public.is_staff() and public.can_see_client(client_id));
create policy quotes_edit on public.quotes for update to authenticated
  using (public.is_staff() and public.can_see_client(client_id)) with check (public.is_staff());

-- cloth: the sales side reads the library; only the owner changes it or sees costs.
create policy fabrics_read on public.fabrics for select to authenticated using (public.is_staff());
create policy fabrics_owner on public.fabrics for all to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
create policy fabric_costs_owner on public.fabric_costs for all to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

create policy settings_read on public.settings for select to authenticated using (public.is_staff());
create policy settings_owner on public.settings for update to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');
create policy cost_settings_owner on public.cost_settings for all to authenticated
  using (public.my_role() = 'owner') with check (public.my_role() = 'owner');

-- measurement forms: read by whoever looks after the client, and by the workroom
-- while the order is open. Added by the sales side. Never edited or deleted.
create policy forms_read on public.measure_forms for select to authenticated
  using (public.can_see_client(client_id) or public.workroom_client(client_id));
create policy forms_add on public.measure_forms for insert to authenticated
  with check (public.is_staff() and public.can_see_client(client_id));

-- activity, tasks, ticked-off follow-ups
create policy activity_read on public.activity for select to authenticated
  using (public.can_see_client(client_id));
create policy activity_add on public.activity for insert to authenticated
  with check (public.can_see_client(client_id) or public.workroom_client(client_id));

create policy tasks_read on public.tasks for select to authenticated
  using (public.can_see_client(client_id));
create policy tasks_add on public.tasks for insert to authenticated
  with check (public.is_staff() and public.can_see_client(client_id));
create policy tasks_edit on public.tasks for update to authenticated
  using (public.is_staff() and public.can_see_client(client_id)) with check (public.is_staff());

create policy dismissed_read on public.dismissed for select to authenticated using (public.is_staff());
create policy dismissed_add on public.dismissed for insert to authenticated with check (public.is_staff());

-- ------------------------------------------------------- the workroom view --
-- The workroom reads open orders, names and cloth through these, which leave
-- out prices, phone numbers and addresses.
create view public.workroom_orders as
  select o.id, o.number, o.client_id, o.created_at, o.status, o.items, o.dates, o.notes
  from public.orders o
  where public.my_role() = 'tailor' and o.status <> 'delivered';

create view public.workroom_clients as
  select c.id, c.name, c.city, c.stage
  from public.clients c
  where public.workroom_client(c.id);

create view public.workroom_fabrics as
  select f.id, f.house, f.mill, f.design, f.colour, f.composition, f.weight, f.weave, f.pattern, f.use
  from public.fabrics f
  where public.my_role() = 'tailor';

-- The workroom moves an order from confirmed to "with tailor", and from there
-- to trial 1 — nothing else.
create or replace function public.workroom_advance(order_id text, next_status text) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders; stages text[] := array['new','booked','visited','quoted','confirmed','production','trial1','trial2','delivered','closed'];
begin
  if public.my_role() not in ('tailor','owner') then raise exception 'Not allowed.'; end if;
  select * into o from public.orders where id = order_id for update;
  if o.id is null then raise exception 'No such order.'; end if;
  if not ((o.status = 'confirmed' and next_status = 'production') or (o.status = 'production' and next_status = 'trial1')) then
    raise exception 'The workroom can only move an order to "with tailor" and then to trial 1.';
  end if;
  update public.orders set status = next_status where id = order_id;
  update public.clients set stage = next_status, stage_since = current_date
   where id = o.client_id
     and (stage in ('lost','hold') or array_position(stages, next_status) > coalesce(array_position(stages, stage), 0));
  insert into public.activity (client_id, text) values (o.client_id, o.number || ' moved to ' || next_status || ' by the workroom.');
end $$;

-- ----------------------------------------------------------- permissions ----
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.my_role(), public.can_see_client(text), public.workroom_client(text),
  public.is_staff(), public.workroom_advance(text, text) to authenticated;
grant select on public.workroom_orders, public.workroom_clients, public.workroom_fabrics to authenticated;
revoke insert, update, delete on public.workroom_orders, public.workroom_clients, public.workroom_fabrics from authenticated;

-- ------------------------------------------------- measurement-form photos --
-- A private bucket. Photos sit under the client's id, and the same rule as the
-- form decides who can open them. Links the app makes expire after an hour.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forms', 'forms', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy forms_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'forms' and (public.can_see_client(split_part(name, '/', 1)) or public.workroom_client(split_part(name, '/', 1))));
create policy forms_photos_add on storage.objects for insert to authenticated
  with check (bucket_id = 'forms' and public.is_staff() and public.can_see_client(split_part(name, '/', 1)));

-- Done. Next: run 02_import.sql to bring in the Client Book and the cloth library.
