// The live app's link to the database. Loads everything the signed-in person
// is allowed to see (the database decides that) into the same shape the
// screens already use, and writes each change back.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { DEFAULT_PRICING } from './pricing.js';
import { iso } from './util.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'tr-field-auth' }
});

// [screen name, column, kind]. Kinds: d = date ('' on screen, null in the
// database), u = person id (same), j = json, n = number, b = yes/no.
const MAPS = {
  clients: [['id'], ['name'], ['phone'], ['email'], ['city'], ['address'], ['source'], ['sourceDetail', 'source_detail'],
    ['occasion'], ['eventDate', 'event_date', 'd'], ['budget'], ['assignedTo', 'assigned_to', 'u'], ['stage'],
    ['stageSince', 'stage_since', 'd'], ['lostReason', 'lost_reason'], ['followUpOn', 'follow_up_on', 'd'],
    ['telecrmId', 'telecrm_id'], ['notes'], ['createdAt', 'created_at', 'd']],
  appointments: [['id'], ['clientId', 'client_id'], ['type'], ['date', 'date', 'd'], ['time'], ['assignedTo', 'assigned_to', 'u'],
    ['status'], ['notes'], ['outcome']],
  orders: [['id'], ['number'], ['clientId', 'client_id'], ['createdAt', 'created_at', 'd'], ['status'], ['by', 'created_by', 'u'],
    ['items', 'items', 'j'], ['dates', 'dates', 'j'], ['total', 'total', 'n'], ['gstPct', 'gst_pct', 'n'],
    ['priceIncomplete', 'price_incomplete', 'b'], ['imported', 'imported', 'b'], ['notes']],
  payments: [['id'], ['orderId', 'order_id'], ['stage'], ['amount', 'amount', 'n'], ['date', 'date', 'd'], ['method'], ['reference']],
  quotes: [['id'], ['clientId', 'client_id'], ['createdAt', 'created_at', 'd'], ['by', 'created_by', 'u'], ['status'], ['items', 'items', 'j']],
  tasks: [['id'], ['clientId', 'client_id'], ['title'], ['due', 'due', 'd'], ['assignedTo', 'assigned_to', 'u'], ['done', 'done', 'b']],
  activity: [['id'], ['clientId', 'client_id'], ['text']],
  measure_forms: [['id'], ['clientId', 'client_id'], ['reason'], ['form', 'form', 'j'], ['changes', 'changes', 'j'], ['photos', 'photos', 'j']],
  profiles: [['id'], ['name'], ['role'], ['city'], ['phone'], ['active', 'active', 'b'], ['email']]
};

function fromRow(table, row) {
  const o = {};
  MAPS[table].forEach(([k, col = k, kind]) => {
    if (!(col in row)) return;
    let v = row[col];
    if ((kind === 'd' || kind === 'u') && v == null) v = '';
    else if (kind === 'n' && v != null) v = +v;
    else if (v == null && !kind) v = '';
    o[k] = v;
  });
  return o;
}
export function toRow(table, obj) {
  const r = {};
  MAPS[table].forEach(([k, col = k, kind]) => {
    if (!(k in obj)) return;
    let v = obj[k];
    if ((kind === 'd' || kind === 'u') && (v === '' || v == null)) v = null;
    else if (kind === 'n') v = v === '' || v == null ? null : +v;
    else if (!kind && v == null) v = '';
    r[col] = v;
  });
  return r;
}

// Read a whole table, a thousand rows at a time.
async function all(table, cols = '*', order = 'id') {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

function localDate(ts) { return ts ? iso(new Date(ts)) : ''; }
function localTime(ts) { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }

// Photo links expire, so the app keeps the stored path behind each link.
export const photoPath = new Map();

export async function loadAll(me) {
  const staff = me.role !== 'tailor';
  const owner = me.role === 'owner';
  const [profiles, clients, appts, orders, payments, costs, quotes, fabrics, fcosts, settings, csettings, forms, activity, tasks, dismissed] = await Promise.all([
    all('profiles', '*', 'created_at'),
    staff ? all('clients') : all('workroom_clients'),
    staff ? all('appointments') : Promise.resolve([]),
    staff ? all('orders') : all('workroom_orders'),
    staff ? all('payments', '*', 'created_at') : Promise.resolve([]),
    owner ? all('order_costs', '*', 'order_id') : Promise.resolve([]),
    staff ? all('quotes') : Promise.resolve([]),
    staff ? all('fabrics', '*', 'house') : all('workroom_fabrics', '*', 'house'),
    owner ? all('fabric_costs', '*', 'fabric_id') : Promise.resolve([]),
    staff ? sb.from('settings').select('*').eq('id', 1).maybeSingle() : Promise.resolve({ data: null }),
    owner ? sb.from('cost_settings').select('*').eq('id', 1).maybeSingle() : Promise.resolve({ data: null }),
    all('measure_forms', '*', 'created_at'),
    staff ? all('activity', '*', 'at') : Promise.resolve([]),
    staff ? all('tasks') : Promise.resolve([]),
    staff ? all('dismissed', '*', 'key') : Promise.resolve([])
  ]);

  const pricing = JSON.parse(JSON.stringify(DEFAULT_PRICING));
  if (settings && settings.data) Object.assign(pricing, settings.data.pricing);
  if (csettings && csettings.data) { pricing.fx = csettings.data.fx; pricing.landingUpliftPct = +csettings.data.landing_uplift_pct; }
  if (!owner) { delete pricing.fx; delete pricing.landingUpliftPct; }

  const costBy = Object.fromEntries(fcosts.map(c => [c.fabric_id, c]));
  const payBy = {};
  payments.forEach(p => { (payBy[p.order_id] = payBy[p.order_id] || []).push(fromRow('payments', p)); });
  const orderCost = Object.fromEntries(costs.map(c => [c.order_id, { fabric: +c.fabric, stitching: +c.stitching, logistics: +c.logistics, delivery: +c.delivery }]));

  // Signed links for form photos, one request for all of them.
  const paths = forms.flatMap(f => f.photos || []);
  const urls = {};
  if (paths.length) {
    const { data } = await sb.storage.from('forms').createSignedUrls(paths, 3600);
    (data || []).forEach(x => { if (x.signedUrl) { urls[x.path] = x.signedUrl; photoPath.set(x.signedUrl, x.path); } });
  }

  return {
    version: 1,
    live: true,
    me: me.id,
    users: profiles.map(p => fromRow('profiles', p)),
    clients: clients.map(c => ({ phone: '', email: '', address: '', source: '', sourceDetail: '', occasion: '', eventDate: '', budget: '', assignedTo: '', stageSince: '', lostReason: '', telecrmId: '', notes: '', createdAt: '', ...fromRow('clients', c) })),
    appointments: appts.map(a => fromRow('appointments', a)),
    orders: orders.map(o => ({ total: null, gstPct: null, priceIncomplete: false, imported: false, by: '', ...fromRow('orders', o), items: o.items || [], dates: o.dates || {}, payments: payBy[o.id] || [], costs: orderCost[o.id] || { fabric: 0, stitching: 0, logistics: 0, delivery: 0 } })),
    quotes: quotes.map(q => fromRow('quotes', q)),
    fabrics: fabrics.map(f => {
      const c = costBy[f.id];
      return { id: f.id, house: f.house, mill: f.mill, design: f.design, colour: f.colour, composition: f.composition, weight: f.weight, weave: f.weave,
        pattern: f.pattern, use: f.use, book: f.book || '', active: f.active !== false, pricePerM: f.price_per_m != null ? +f.price_per_m : null,
        cost: c ? { vendor: c.vendor, ref: c.ref, currency: c.currency, rate: c.rate != null ? +c.rate : null, rateBulk: c.rate_bulk, unit: c.unit, uplift: c.uplift != null ? +c.uplift : null } : null };
    }).filter(f => f.active),
    mforms: forms.map(f => ({ ...fromRow('measure_forms', f), v: f.v, by: f.created_by || '', date: localDate(f.created_at), time: localTime(f.created_at),
      paths: f.photos || [], photos: (f.photos || []).map(p => urls[p]).filter(Boolean) })),
    activity: activity.map(a => ({ ...fromRow('activity', a), at: localDate(a.at), by: a.by || 'system' })).reverse(),
    tasks: tasks.map(t => fromRow('tasks', t)),
    dismissed: Object.fromEntries(dismissed.map(d => [d.key, d.at])),
    pricing,
    nextOrder: 0
  };
}

// ---------- writes ----------
function check({ error }) { if (error) throw error; }
export const db = {
  insert: async (table, obj) => check(await sb.from(table).insert(toRow(table, obj))),
  update: async (table, id, patch) => {
    const row = toRow(table, patch);
    if (Object.keys(row).length) check(await sb.from(table).update(row).eq('id', id));
  },
  remove: async (table, id) => check(await sb.from(table).delete().eq('id', id)),
  upsert: async (table, obj) => check(await sb.from(table).upsert(toRow(table, obj))),
  orderCosts: async (orderId, c) => check(await sb.from('order_costs').upsert({ order_id: orderId, fabric: +c.fabric || 0, stitching: +c.stitching || 0, logistics: +c.logistics || 0, delivery: +c.delivery || 0 })),
  orderNumber: async id => { const { data, error } = await sb.from('orders').select('number').eq('id', id).single(); if (error) throw error; return data.number; },
  dismiss: async key => check(await sb.from('dismissed').upsert({ key }, { onConflict: 'key', ignoreDuplicates: true })),
  workroomAdvance: async (id, status) => check(await sb.rpc('workroom_advance', { order_id: id, next_status: status })),
  pricing: async p => {
    const { fx, landingUpliftPct, ...pub } = p;
    check(await sb.from('settings').update({ pricing: pub }).eq('id', 1));
    if (fx) check(await sb.from('cost_settings').update({ fx, landing_uplift_pct: landingUpliftPct }).eq('id', 1));
  },
  profile: async (id, patch) => check(await sb.from('profiles').update(toRow('profiles', patch)).eq('id', id)),
  // Each new photo is uploaded under the client; returns the stored paths in order.
  photos: async (clientId, formId, photos) => {
    const out = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (!p.startsWith('data:')) { const known = photoPath.get(p); if (known) out.push(known); continue; }
      const blob = await (await fetch(p)).blob();
      const path = `${clientId}/${formId}/${i + 1}.jpg`;
      check(await sb.storage.from('forms').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      out.push(path);
    }
    return out;
  }
};
