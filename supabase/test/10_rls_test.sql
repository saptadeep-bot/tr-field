-- Security tests: sign in as each kind of user and check what they can do.
\set ON_ERROR_STOP 1
\pset footer off
-- Re-running the import must change nothing.
\i /tmp/sqlrun/02_import.sql

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000c', 'coord@x.com'),
  ('00000000-0000-0000-0000-00000000000a', 'rep.a@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'rep.b@x.com'),
  ('00000000-0000-0000-0000-00000000000f', 'workroom@x.com'),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@x.com');
select email, role, active from profiles order by created_at;

create temp table results (test text, ok boolean);
grant all on results to authenticated, anon;
create function pg_temp.expect(name text, cond boolean) returns void language sql as $$ insert into results values (name, cond) $$;

-- ---- as the owner: switch people on and give them roles
select set_config('request.jwt.claim.sub', (select id::text from profiles where role = 'owner'), false);
set role authenticated;
update profiles set active = true, role = 'coordinator' where email = 'coord@x.com';
update profiles set active = true, role = 'rep', city = 'Delhi' where email like 'rep.%';
update profiles set active = true, role = 'tailor' where email = 'workroom@x.com';
select pg_temp.expect('owner sees all 41 clients', (select count(*) from clients) = 41);
select pg_temp.expect('owner sees cloth costs', (select count(*) from fabric_costs) = 251);
select pg_temp.expect('owner sees order costs', (select count(*) from order_costs) >= 1);
do $$ begin
  update profiles set role = 'rep' where id = auth.uid();
  insert into results values ('owner cannot demote themselves', false);
exception when others then insert into results values ('owner cannot demote themselves', true); end $$;
-- give rep A two clients, and send rep B to visit a third
update clients set assigned_to = '00000000-0000-0000-0000-00000000000a' where id in (select id from clients order by id limit 2);
insert into appointments (id, client_id, type, date, time, assigned_to)
  values ('ap-test', (select id from clients order by id offset 5 limit 1), 'consult', current_date + 1, '11:00', '00000000-0000-0000-0000-00000000000b');
-- owner changes the uplift: every cloth price follows
update cost_settings set landing_uplift_pct = 80;
select pg_temp.expect('uplift change reprices cloth', (select price_per_m from fabrics where id = 'f0001') = 2043.00);
update cost_settings set landing_uplift_pct = 70;
reset role;

-- ---- coordinator
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select pg_temp.expect('coordinator sees all clients', (select count(*) from clients) = 41);
select pg_temp.expect('coordinator sees no cloth costs', (select count(*) from fabric_costs) = 0);
select pg_temp.expect('coordinator sees no order costs', (select count(*) from order_costs) = 0);
select pg_temp.expect('coordinator sees cloth prices', (select count(*) from fabrics where price_per_m is not null) = 251);
select pg_temp.expect('coordinator sees no uplift/fx', (select count(*) from cost_settings) = 0);
do $$ begin
  update profiles set role = 'owner' where email = 'rep.a@x.com';
  insert into results values ('coordinator cannot change roles', not exists (select 1 from profiles where email = 'rep.a@x.com' and role = 'owner'));
end $$;
do $$ begin
  update settings set pricing = '{}' where id = 1;
  insert into results values ('coordinator cannot change pricing', (select pricing <> '{}' from settings));
end $$;
insert into clients (id, name, city, source, assigned_to) values ('t-coord', 'Test Coord Client', 'Delhi', 'whatsapp', null);
select pg_temp.expect('coordinator can add an unassigned client', exists (select 1 from clients where id = 't-coord'));
reset role;

-- ---- rep A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect('rep A sees only their 2 clients', (select count(*) from clients) = 2);
select pg_temp.expect('rep A sees no cloth costs', (select count(*) from fabric_costs) = 0);
select pg_temp.expect('rep A sees no order costs', (select count(*) from order_costs) = 0);
select pg_temp.expect('rep A sees cloth and price per metre', (select count(*) from fabrics where price_per_m > 0) = 251);
select pg_temp.expect('rep A sees only their orders', (select count(*) from orders) = (select count(*) from orders o where o.client_id in (select id from clients)));
select pg_temp.expect('rep A sees only their payments', not exists (select 1 from payments p where p.order_id not in (select id from orders)));
insert into clients (id, name, city, source, assigned_to) values ('t-repa', 'Rep A New Client', 'Delhi', 'whatsapp', '00000000-0000-0000-0000-00000000000a');
select pg_temp.expect('rep A can add a client for themselves', exists (select 1 from clients where id = 't-repa'));
do $$ begin
  insert into clients (id, name, assigned_to) values ('t-bad', 'Sneaky', '00000000-0000-0000-0000-00000000000b');
  insert into results values ('rep A cannot add a client for someone else', false);
exception when others then insert into results values ('rep A cannot add a client for someone else', true); end $$;
do $$ begin
  update clients set assigned_to = null where id = 't-repa';
  insert into results values ('rep A cannot reassign', false);
exception when others then insert into results values ('rep A cannot reassign', true); end $$;
do $$ declare n int; begin
  update clients set notes = 'hacked' where id = 't-coord'; get diagnostics n = row_count;
  insert into results values ('rep A cannot edit someone else''s client', n = 0);
end $$;
insert into measure_forms (id, client_id, reason, form, v) values ('mf-1', 't-repa', 'consult', '{"jacket":{}}', 99);
insert into measure_forms (id, client_id, reason, form, v) values ('mf-2', 't-repa', 'trial1', '{"jacket":{"m":{"Chest":"40"}}}', 1);
select pg_temp.expect('form versions numbered by the database', (select array_agg(v order by v) from measure_forms where client_id = 't-repa') = array[1,2]);
select pg_temp.expect('form stamped with who saved it', (select bool_and(created_by = '00000000-0000-0000-0000-00000000000a') from measure_forms where client_id = 't-repa'));
do $$ declare n int; begin
  update measure_forms set form = '{}' where id = 'mf-1'; get diagnostics n = row_count;
  insert into results values ('forms cannot be edited', n = 0);
  delete from measure_forms where id = 'mf-1'; get diagnostics n = row_count;
  insert into results values ('forms cannot be deleted', n = 0);
end $$;
insert into activity (id, client_id, text, by) values ('act-1', 't-repa', 'Test note', '00000000-0000-0000-0000-00000000000c');
select pg_temp.expect('activity stamped with the real author', (select by from activity where id = 'act-1') = '00000000-0000-0000-0000-00000000000a');
insert into orders (id, client_id, items, total, gst_pct) values ('o-test', 't-repa', '[]', 50000, 5);
select pg_temp.expect('new order numbered TR-0044', (select number from orders where id = 'o-test') = 'TR-0044');
insert into payments (id, order_id, stage, amount, method) values ('p-test', 'o-test', 'advance', 25000, 'UPI');
do $$ declare n int; begin
  update payments set amount = 1 where id = 'p-test'; get diagnostics n = row_count;
  insert into results values ('rep A cannot alter a payment', n = 0);
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('forms', 't-repa/mf-2/1.jpg');
  insert into results values ('rep A can upload a photo for their client', true);
exception when others then insert into results values ('rep A can upload a photo for their client', false); end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('forms', 't-coord/x/1.jpg');
  insert into results values ('rep A cannot upload for another client', false);
exception when others then insert into results values ('rep A cannot upload for another client', true); end $$;
reset role;

-- ---- rep B: sees only the client they've been sent to visit
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select pg_temp.expect('rep B sees just the client they are visiting', (select count(*) from clients) = 1);
select pg_temp.expect('rep B cannot see rep A''s photos', (select count(*) from storage.objects) = 0);
select pg_temp.expect('rep B cannot see rep A''s forms', (select count(*) from measure_forms) = 0);
reset role;
-- once the visit is done, rep B loses sight of the client
update appointments set status = 'done' where id = 'ap-test';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select pg_temp.expect('rep B loses the client after the visit', (select count(*) from clients) = 0);
reset role;

-- ---- workroom
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
set role authenticated;
select pg_temp.expect('workroom reads no client table', (select count(*) from clients) = 0);
select pg_temp.expect('workroom reads no orders table', (select count(*) from orders) = 0);
select pg_temp.expect('workroom reads no payments', (select count(*) from payments) = 0);
select pg_temp.expect('workroom reads no cloth prices', (select count(*) from fabrics) = 0);
select pg_temp.expect('workroom sees open orders', (select count(*) from workroom_orders) = (select count(*) from workroom_orders where status <> 'delivered') and (select count(*) from workroom_orders) > 20);
select pg_temp.expect('workroom sees names of open-order clients', (select count(*) from workroom_clients) > 10);
select pg_temp.expect('workroom sees cloth without price', (select count(*) from workroom_fabrics) = 251);
select pg_temp.expect('workroom sees forms for open orders', (select count(*) from measure_forms where client_id = 't-repa') = 2);
select workroom_advance('o-test', 'production');
select pg_temp.expect('workroom moves an order to with tailor', (select status from workroom_orders where id = 'o-test') = 'production');
do $$ begin
  perform workroom_advance('o-test', 'delivered');
  insert into results values ('workroom cannot mark delivered', false);
exception when others then insert into results values ('workroom cannot mark delivered', true); end $$;
do $$ begin
  insert into measure_forms (client_id, form) values ('t-repa', '{}');
  insert into results values ('workroom cannot change measurements', false);
exception when others then insert into results values ('workroom cannot change measurements', true); end $$;
reset role;

-- ---- a stranger who signed up but was never switched on, and an anonymous visitor
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
select pg_temp.expect('switched-off user sees no clients', (select count(*) from clients) = 0);
select pg_temp.expect('switched-off user sees no cloth', (select count(*) from fabrics) = 0);
select pg_temp.expect('switched-off user sees only themselves', (select count(*) from profiles) = 1);
select pg_temp.expect('switched-off user sees nothing in workroom views', (select count(*) from workroom_orders) + (select count(*) from workroom_clients) = 0);
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  perform count(*) from public.clients;
  insert into results values ('anonymous visitor blocked', false);
exception when others then insert into results values ('anonymous visitor blocked', true); end $$;
reset role;

select case when ok then 'PASS' else 'FAIL' end as result, test from results;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
