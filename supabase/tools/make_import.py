"""Build 02_import.sql from the Client Book and Cloth Reckoner exports.

Usage: python3 -I make_import.py <export dir> <output .sql>
The export dir holds cb/{leads,clients,commissions,payments}/*.json,
rk/fabrics/*.json and rk/config/settings.json.

The output holds client data, so it is never committed to the repo.
Re-running the output is safe: clients, orders and payments already
there are left alone; cloth is updated to match the reckoner.
"""
import glob, json, os, sys

src, out = sys.argv[1], sys.argv[2]
def load(c): return [json.load(open(f)) for f in sorted(glob.glob(os.path.join(src, c, '*.json')))]
leads, clients, comms, pays = load('cb/leads'), load('cb/clients'), load('cb/commissions'), load('cb/payments')
fabrics = load('rk/fabrics')

def q(v):
    if v is None or v == '': return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    return "'" + str(v).replace("'", "''") + "'"
def t(v): return "'" + str(v or '').replace("'", "''") + "'"          # text, never null
def d(v): return q(v) + '::date' if v else 'null::date'
def n(v):
    try: return repr(float(v)) if str(v).strip() != '' else 'null'
    except ValueError: return 'null'
def j(v): return q(json.dumps(v, ensure_ascii=False)) + '::jsonb'
def clean(s): return (s or '').strip()

OWNER = "(select id from public.profiles where role = 'owner' and active order by created_at limit 1)"
SOURCE = {'Referral': 'referral', 'Instagram': 'instagram', 'Meta ad': 'meta', 'Website': 'website', 'Other': 'other',
          'WhatsApp': 'whatsapp', 'Email': 'email', 'Walk-in': 'walkin'}
GARMENT = {'Two-piece': 'twoPiece', 'Three-piece': 'threePiece', 'Jacket': 'jacket', 'Trouser': 'trouser', 'Shirt': 'shirt',
           'Nehru jacket': 'nehru', 'Bandhgala': 'bandhgala', 'Bandhgala two-piece': 'bandhgala', 'Overcoat': 'overcoat'}
SUIT_TIER = {'Ready-to-wear': 'rtw', 'Fused': 'rtw', 'Half canvas': 'half', 'Full canvas': 'full'}
STATUS = {'Delivered': 'delivered', 'With tailor': 'production', '1st trial done': 'trial2', '2nd trial done': 'trial2',
          'Confirmed': 'confirmed'}
STAGE_ORDER = ['new', 'booked', 'visited', 'quoted', 'confirmed', 'production', 'trial1', 'trial2', 'delivered', 'closed']

def money(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

# A lead that was never linked to a client but has the same phone number (or
# name) as one is the same person: fold it into that client, not a duplicate.
def digits(p): return ''.join(ch for ch in (p or '') if ch.isdigit())[-10:]
by_phone = {digits(c['phone']): c['id'] for c in clients if len(digits(c['phone'])) == 10}
by_name = {c['name'].strip().lower(): c['id'] for c in clients}
for l in leads:
    if not l.get('clientId'):
        match = by_phone.get(digits(l['phone'])) or by_name.get(l['name'].strip().lower())
        if match: l['clientId'] = match

lead_by_client = {}
for l in leads:
    if l.get('clientId'): lead_by_client.setdefault(l['clientId'], []).append(l)
orders_by_client = {}
for c in comms: orders_by_client.setdefault(c['clientId'], []).append(c)

sql = ["-- Turn & River Field — your data from the Client Book and the Cloth Reckoner.",
       "-- Run after 01_setup.sql, and after you have signed in to the app once (so",
       "-- every client can be put under your name). Safe to run again.",
       "begin;", ""]

# ---------------------------------------------------------------- clients ---
rows, tasks, acts = [], [], []
def client_row(cid, name, phone, email, city, address, source, detail, occasion, budget, stage, since, lost, follow, notes, created):
    return (f"({t(cid)}, {t(clean(name))}, {t(clean(phone))}, {t(clean(email))}, {t(city)}, {t(clean(address))}, {t(source)}, "
            f"{t(clean(detail))}, {t(occasion)}, {t(budget)}, {t(stage)}, {d(since)}, {t(lost)}, {d(follow)}, {t(notes)}, {d(created)})")

def budget_text(b):
    b = clean(b)
    if not b: return ''
    try: return '₹' + format(int(float(b)), ',')
    except ValueError: return b

for c in clients:
    ls = lead_by_client.get(c['id'], [])
    os_ = orders_by_client.get(c['id'], [])
    open_ = sorted([o for o in os_ if o['stage'] != 'Delivered'], key=lambda o: o['openedAt'])
    if open_: stage = STATUS.get(open_[-1]['stage'], 'production')
    elif os_: stage = 'delivered'
    elif any(l['status'] == 'Won' for l in ls): stage = 'visited'
    elif any(l['status'] == 'Lost' for l in ls): stage = 'lost'
    elif any(l['status'] == 'Dormant' for l in ls): stage = 'hold'
    else: stage = 'visited'
    since = max([o['openedAt'] for o in os_] + [c['createdAt']])
    notes = [clean(c['notes'])]
    if clean(c.get('officeAddress')): notes.append('Office: ' + clean(c['officeAddress']))
    if clean(c.get('occupation')): notes.append('Occupation: ' + clean(c['occupation']))
    for l in ls:
        if clean(l.get('interest')): notes.append('Interested in: ' + clean(l['interest']))
    budget = next((budget_text(l['budget']) for l in ls if clean(l.get('budget'))), '')
    rows.append(client_row(c['id'], c['name'], c['phone'], c['email'], c['city'], c['address'], SOURCE.get(c['acquiredVia'], 'other'),
                           c['referredBy'], '', budget, stage, since, 'Unknown Reason' if stage == 'lost' else '',
                           c['followUp'], '\n'.join(x for x in notes if x), c['createdAt']))
    if c.get('followUp'):
        tasks.append(f"({t('cb-task-' + c['id'])}, {t(c['id'])}, {t(clean(c.get('followUpNote')) or 'Follow up')}, {d(c['followUp'])})")
    for e in c.get('noteLog') or []:
        acts.append(f"({t('cb-note-' + e['id'])}, {t(c['id'])}, {q(e['date'])}::timestamptz, {t(clean(e['text']))})")

for l in leads:
    if l.get('clientId'): continue
    stage = {'Lost': 'lost', 'Dormant': 'hold'}.get(l['status'], 'new')
    notes = [clean(l['notes'])] + (['Interested in: ' + clean(l['interest'])] if clean(l.get('interest')) else [])
    rows.append(client_row(l['id'], l['name'], l['phone'], l['email'], l['city'], l['address'], SOURCE.get(l['source'], 'other'),
                           l['referredBy'], '', budget_text(l['budget']), stage, l['createdAt'],
                           'Unknown Reason' if stage == 'lost' else '', l['nextFollowUp'] if stage != 'lost' else '',
                           '\n'.join(x for x in notes if x), l['createdAt']))

sql.append("-- Clients (from the Client Book's clients, plus leads that never became clients)")
sql.append("insert into public.clients (id, name, phone, email, city, address, source, source_detail, occasion, budget, stage, stage_since, lost_reason, follow_up_on, notes, created_at, assigned_to)")
sql.append("select v.*, " + OWNER + " from (values\n  " + ',\n  '.join(rows) + "\n) v\non conflict (id) do nothing;\n")

# ----------------------------------------------------------------- orders ---
orows, crows, prows, dis = [], [], [], []
for o in comms:
    items = []
    for i, g in enumerate(o['garments']):
        gk = GARMENT.get(g.get('type'), (g.get('type') or 'other'))
        tier = SUIT_TIER.get(g.get('tier'), 'rtw') if gk not in ('trouser', 'shirt', 'nehru') else ('prem' if g.get('tier') in ('Half canvas', 'Full canvas', 'Premium') else 'std')
        cloth = ' · '.join(x for x in [clean(g.get('cloth')), clean(g.get('vendor'))] if x)
        items.append({'id': g.get('id') or f'i{i+1}', 'garment': gk, 'tier': tier, 'fabricId': None, 'cloth': cloth,
                      'qty': int(money(g.get('qty')) or 1), 'specs': ''})
    status = STATUS.get(o['stage'], 'production')
    delivery = o.get('deliveredDate') or o.get('promisedDate') or ''
    total = money(o['orderValue'])
    orows.append(f"({t(o['id'])}, {t(o['number'])}, {t(o['clientId'])}, {d(o['openedAt'])}, {t(status)}, {j(items)}, "
                 f"{j({'trial1': '', 'trial2': '', 'delivery': delivery})}, {n(o['orderValue'])}, {t(clean(o.get('notes')))})")
    cloth_cost = sum(money(g.get('clothCost')) for g in o['garments'])
    sale = o.get('sale') or {}
    fc, sc = money(sale.get('fabricCost')) or cloth_cost, money(sale.get('stitchingCost'))
    if fc or sc: crows.append(f"({t(o['id'])}, {fc}, {sc}, 0, 0)")
    # Payment stages follow the 50/30/20 split by how much had been paid before each one.
    before = 0.0
    for p in sorted([p for p in pays if p['commissionId'] == o['id']], key=lambda p: (p['date'], p['id'])):
        amt = money(p['amount'])
        if amt <= 0: continue
        stage = 'advance' if total <= 0 or before < 0.5 * total - 1 else 'trial' if before < 0.8 * total - 1 else 'delivery'
        prows.append(f"({t(p['id'])}, {t(o['id'])}, {t(stage)}, {amt}, {d(p['date'])}, {t(p['method'])}, {t(clean(p.get('reference')))})")
        before += amt
    # Past orders don't need "enter the form" or "check in on fit" reminders on day one.
    dis.append(f"({t('form:' + o['id'])})")
    if status == 'delivered': dis.append(f"({t('check:' + o['id'])})")

sql.append("-- Orders (the Client Book's commissions). Totals are kept exactly as recorded.")
sql.append("insert into public.orders (id, number, client_id, created_at, status, items, dates, total, notes, imported, price_incomplete, gst_pct, created_by)")
sql.append("select v.*, true, false, null::numeric, " + OWNER + " from (values\n  " + ',\n  '.join(orows) + "\n) v\non conflict (id) do nothing;\n")
if crows:
    sql.append("insert into public.order_costs (order_id, fabric, stitching, logistics, delivery) values\n  " + ',\n  '.join(crows) + "\non conflict (order_id) do nothing;\n")
sql.append("-- Payments")
sql.append("insert into public.payments (id, order_id, stage, amount, date, method, reference, created_by)")
sql.append("select v.*, " + OWNER + " from (values\n  " + ',\n  '.join(prows) + "\n) v\non conflict (id) do nothing;\n")
sql.append("-- Order numbers carry on from the last one")
sql.append("select setval('public.order_no', greatest((select coalesce(max(substring(number from '[0-9]+')::int), 0) from public.orders), 1));\n")

if tasks:
    sql.append("-- Follow-ups set in the Client Book")
    sql.append("insert into public.tasks (id, client_id, title, due, assigned_to, created_by)")
    sql.append("select v.*, " + OWNER + ", " + OWNER + " from (values\n  " + ',\n  '.join(tasks) + "\n) v\non conflict (id) do nothing;\n")
if acts:
    sql.append("-- Notes from the Client Book")
    sql.append("insert into public.activity (id, client_id, at, text) values\n  " + ',\n  '.join(acts) + "\non conflict (id) do nothing;\n")
sql.append("insert into public.dismissed (key) values\n  " + ',\n  '.join(dis) + "\non conflict (key) do nothing;\n")

# ------------------------------------------------------------------ cloth ---
frows, krows = [], []
def cap(s): s = clean(s); return s[:1].upper() + s[1:] if s else ''
for f in fabrics:
    frows.append(f"({t(f['id'])}, {t(clean(f['house']))}, {t(clean(f['vendor']))}, {t(clean(f['name']))}, {t(clean(f['composition']))}, "
                 f"{n(f['weightGsm'])}, {t(cap(f['weave']))}, {t(cap(f['pattern']))}, {t(f['use'] or 'suiting')}, {t(clean(f['fibre']))}, "
                 f"{n(f['widthCm'])}, {t(clean(f['book']))}, {t(clean(f['notes']))}, {q(f.get('stock') != 'out')})")
    krows.append(f"({t(f['id'])}, {t(clean(f['vendor']))}, {t(clean(f['ref']))}, {t(f['currency'] or 'INR')}, {n(f['rate'])}, "
                 f"{n(f['rateBulk'])}, {t(f['unit'] if f['unit'] in ('m', 'yd') else 'm')}, {n(f['uplift'])}, {n(f['minCut'])})")
sql.append("-- Cloth library from the reckoner. Ex-mill rates go to the owner-only table;")
sql.append("-- the database works out each cloth's price per metre from them.")
sql.append("insert into public.fabrics (id, house, mill, design, composition, weight, weave, pattern, use, fibre, width_cm, book, notes, active) values\n  "
           + ',\n  '.join(frows) + "\non conflict (id) do update set house = excluded.house, mill = excluded.mill, design = excluded.design, "
           "composition = excluded.composition, weight = excluded.weight, weave = excluded.weave, pattern = excluded.pattern, use = excluded.use, "
           "fibre = excluded.fibre, width_cm = excluded.width_cm, book = excluded.book, notes = excluded.notes, active = excluded.active;\n")
sql.append("insert into public.fabric_costs (fabric_id, vendor, ref, currency, rate, rate_bulk, unit, uplift, min_cut) values\n  "
           + ',\n  '.join(krows) + "\non conflict (fabric_id) do update set vendor = excluded.vendor, ref = excluded.ref, currency = excluded.currency, "
           "rate = excluded.rate, rate_bulk = excluded.rate_bulk, unit = excluded.unit, uplift = excluded.uplift, min_cut = excluded.min_cut;\n")

sql.append("commit;\n")
sql.append("-- Check: these counts should read " + f"{len(rows)} clients, {len(orows)} orders, {len(prows)} payments, {len(frows)} cloths.")
sql.append("select (select count(*) from public.clients) as clients, (select count(*) from public.orders) as orders, "
           "(select count(*) from public.payments) as payments, (select count(*) from public.fabrics) as cloths, "
           "(select count(*) from public.clients where assigned_to is null) as without_owner;")
open(out, 'w').write('\n'.join(sql))
print(f'{len(rows)} clients, {len(orows)} orders, {len(prows)} payments, {len(crows)} cost rows, {len(tasks)} tasks, {len(acts)} notes, {len(frows)} cloths')
