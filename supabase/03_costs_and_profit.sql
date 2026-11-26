-- ============================================================================
-- Turn & River Field — costs and profit (owner only)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run twice.
--
-- Adds:
--   • cost rules for each city (stitching by garment and construction, travel
--     per order) and your list of cloth dealers, kept with the owner-only
--     exchange rates and uplift;
--   • per-order cost detail: the dealer, rate and metres for cloth that isn't
--     in the library, and any figure you override by hand.
-- Both live in tables only the owner can read; nothing here changes what the
-- team sees.
-- ============================================================================

alter table public.cost_settings add column if not exists rules jsonb not null default '{}';

-- Order costs: a blank figure now means "work it out from the rules";
-- a number means you set it by hand.
alter table public.order_costs alter column fabric drop not null;
alter table public.order_costs alter column fabric drop default;
alter table public.order_costs alter column stitching drop not null;
alter table public.order_costs alter column stitching drop default;
alter table public.order_costs alter column logistics drop not null;
alter table public.order_costs alter column logistics drop default;
alter table public.order_costs add column if not exists detail jsonb not null default '{}';

-- Costs saved as 0 before this were "not filled in"; let the rules fill them.
update public.order_costs
   set fabric = nullif(fabric, 0), stitching = nullif(stitching, 0), logistics = nullif(logistics, 0)
 where detail = '{}';

-- Check: should say 'ok'.
select case when exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'cost_settings' and column_name = 'rules') then 'ok' else 'not applied' end as costs_and_profit;
