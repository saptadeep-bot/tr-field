-- Notification tests: each change queues the right message for the right people.
\set ON_ERROR_STOP 1
\pset footer off
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000c', 'coord@x.com'),
  ('00000000-0000-0000-0000-00000000000a', 'rep.a@x.com'),
  ('00000000-0000-0000-0000-00000000000b', 'rep.b@x.com');
update profiles set active = true, role = 'coordinator', name = 'Ananya Rao' where email = 'coord@x.com';
update profiles set active = true, role = 'rep', name = 'Rohit Sharma', city = 'Delhi' where email = 'rep.a@x.com';
update profiles set active = true, role = 'rep', name = 'Karan Mehta', city = 'Bangalore' where email = 'rep.b@x.com';
delete from notifications; delete from net.calls;

create temp table results (test text, ok boolean);
grant all on results to authenticated;
create function pg_temp.expect(name text, cond boolean) returns void language sql as $$ insert into results values (name, cond) $$;
create function pg_temp.got(u text, t text) returns boolean language sql as $$
  select exists (select 1 from notifications n join profiles p on p.id = n.user_id where p.email = u and n.title like t) $$;
create function pg_temp.body(u text, t text) returns text language sql as $$
  select n.body from notifications n join profiles p on p.id = n.user_id where p.email = u and n.title like t order by n.id desc limit 1 $$;

-- the coordinator assigns a lead with a visit booked to rep A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into clients (id, name, city, occasion, address, source, stage) values ('n1', 'Kabir Malhotra', 'Delhi', 'Wedding', E'B-12, Vasant Vihar\nNew Delhi', 'whatsapp', 'booked');
insert into appointments (id, client_id, type, date, time, assigned_to) values ('na1', 'n1', 'consult', '2026-12-07', '16:00', null);
update clients set assigned_to = '00000000-0000-0000-0000-00000000000a' where id = 'n1';
reset role;
select pg_temp.expect('rep told about the new lead', pg_temp.got('rep.a@x.com', 'New lead: Kabir Malhotra'));
select pg_temp.expect('lead message has city, occasion, visit and who', pg_temp.body('rep.a@x.com', 'New lead:%') = 'Delhi · Wedding · Consultation Mon 7 Dec, 4:00 pm · from Ananya');
select pg_temp.expect('the coordinator is not told about her own change', not pg_temp.got('coord@x.com', '%'));
select pg_temp.expect('the queue was handed to send-push', (select count(*) from net.calls where url like '%/functions/v1/send-push') >= 1);

-- the visit moves to rep A, then is moved, handed to rep B, and cancelled
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
update appointments set assigned_to = '00000000-0000-0000-0000-00000000000a' where id = 'na1';
update appointments set date = '2026-12-08', time = '11:30' where id = 'na1';
update appointments set assigned_to = '00000000-0000-0000-0000-00000000000b' where id = 'na1';
update appointments set status = 'cancelled' where id = 'na1';
reset role;
select pg_temp.expect('rep told a visit is booked for him', pg_temp.body('rep.a@x.com', 'Visit booked:%') = 'Consultation · Mon 7 Dec, 4:00 pm · B-12, Vasant Vihar · Delhi');
select pg_temp.expect('rep told the visit moved', pg_temp.body('rep.a@x.com', 'Visit moved:%') = 'Consultation now Tue 8 Dec, 11:30 am (was Mon 7 Dec, 4:00 pm)');
select pg_temp.expect('rep told it was handed over', pg_temp.body('rep.a@x.com', 'Visit handed over:%') = 'Consultation Tue 8 Dec, 11:30 am is now with Karan');
select pg_temp.expect('new rep told it is his', pg_temp.got('rep.b@x.com', 'Visit booked: Kabir Malhotra'));
select pg_temp.expect('new rep told it is cancelled', pg_temp.body('rep.b@x.com', 'Visit cancelled:%') = 'Consultation Tue 8 Dec, 11:30 am is off');

-- a rep books his own visit: nobody needs telling
delete from notifications;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into clients (id, name, city, source, assigned_to) values ('n2', 'Own Lead', 'Delhi', 'walkin', '00000000-0000-0000-0000-00000000000a');
insert into appointments (id, client_id, type, date, time, assigned_to) values ('na2', 'n2', 'consult', '2026-12-09', '10:00', '00000000-0000-0000-0000-00000000000a');
-- he confirms an order and takes an advance
insert into orders (id, client_id, items, total, gst_pct) values ('no1', 'n2', '[]', 123500, 5);
insert into payments (id, order_id, amount, method, reference) values ('np1', 'no1', 61750, 'UPI', 'UTR 4411');
reset role;
select pg_temp.expect('nobody told about a rep''s own lead and visit', not exists (select 1 from notifications where title like 'New lead:%' or title like 'Visit%'));
select pg_temp.expect('owner told about the order', pg_temp.body('s@x.com', 'Order confirmed:%') = 'Own Lead · Delhi · ₹1,23,500 · by Rohit');
select pg_temp.expect('coordinator told about the order', pg_temp.got('coord@x.com', 'Order confirmed:%'));
select pg_temp.expect('owner told about the payment', pg_temp.body('s@x.com', 'Payment received: ₹61,750') = (select number from orders where id = 'no1') || ' · Own Lead · UPI · UTR 4411 · by Rohit');
select pg_temp.expect('coordinator not told about payments', not pg_temp.got('coord@x.com', 'Payment%'));
select pg_temp.expect('reps not told about orders or payments', not exists (select 1 from notifications n join profiles p on p.id = n.user_id where p.role = 'rep'));

-- a TeleCRM lead arriving (no one signed in: the handoff)
delete from notifications;
select set_config('request.jwt.claim.sub', '', false);
insert into clients (id, name, city, occasion, source) values ('n3', 'Vikram Sethi', 'Bangalore', 'Office wear', 'telecrm');
select pg_temp.expect('owner told about a TeleCRM lead', pg_temp.body('s@x.com', 'New TeleCRM lead:%') = 'Bangalore · Office wear · needs a rep');
select pg_temp.expect('coordinator told about a TeleCRM lead', pg_temp.got('coord@x.com', 'New TeleCRM lead:%'));

-- switched-off people get nothing; nobody can read anyone else's
update profiles set active = false where email = 'rep.b@x.com';
delete from notifications;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
update clients set assigned_to = '00000000-0000-0000-0000-00000000000b' where id = 'n3';
reset role;
select pg_temp.expect('switched-off rep gets nothing (checked as owner)', not pg_temp.got('rep.b@x.com', '%'));
update profiles set active = true where email = 'rep.b@x.com';
update clients set assigned_to = '00000000-0000-0000-0000-00000000000a' where id = 'n3';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select pg_temp.expect('a rep can''t read another rep''s notifications', (select count(*) from notifications) = 0);
do $$ begin
  perform public.notify('00000000-0000-0000-0000-00000000000a', 'Fake', 'x', '/', '');
  insert into results values ('a rep can''t send notifications himself', false);
exception when others then insert into results values ('a rep can''t send notifications himself', true); end $$;
do $$ begin
  insert into notifications (user_id, title) values ('00000000-0000-0000-0000-00000000000a', 'Fake');
  insert into results values ('a rep can''t write to the queue', false);
exception when others then insert into results values ('a rep can''t write to the queue', true); end $$;
select save_push_subscription('https://fcm.example/abc', 'key', 'auth', 'Pixel 8');
select pg_temp.expect('a phone can sign itself up', (select count(*) from push_subscriptions) = 1);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect('another rep can''t see that phone', (select count(*) from push_subscriptions) = 0);
reset role;
select pg_temp.expect('indian money format', inr(12345678) = '₹1,23,45,678' and inr(999) = '₹999' and inr(1000) = '₹1,000');

select case when ok then 'PASS' else 'FAIL' end as result, test from results;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from results;
