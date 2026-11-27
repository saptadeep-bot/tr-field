import { useSyncExternalStore } from 'react';
import { seed } from './seed.js';
import { priceQuote } from './pricing.js';
import { diffForms, reasonLabel } from './measureForm.js';
import { today, nowTime, addDays, diffDays, uid, inr } from './util.js';
import { can, PAY_STAGES, stageIndex } from './catalog.js';

// One store for both builds. Every action changes the copy on screen at once.
// In the preview that copy is all there is (kept in this browser). In the live
// app each action also queues a write to the database, in order, and the copy
// is refreshed from the database regularly.
import { LIVE } from '../config.js';
const KEY = 'tr-field-preview-v4';
let state = LIVE ? emptyState() : load();
const listeners = new Set();

function emptyState() {
  return { version: 1, live: true, me: '', users: [], fabrics: [], clients: [], appointments: [], quotes: [], orders: [], mforms: [], activity: [], tasks: [], pricing: {}, dismissed: {}, nextOrder: 0 };
}
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
  if (!s || s.version !== 1) s = seed();
  return finalize(s);
}
function finalize(s) {
  s.orders.forEach(o => {
    if (o.total == null) { const pq = priceQuote(o.items, s.fabrics, s.pricing); o.total = pq.total; o.gstPct = pq.gstPct; o.priceIncomplete = !pq.complete; }
    (o.payments || []).forEach(p => { if (p.amount == null) p.amount = Math.round(o.total * (p.pct || 0) / 100); });
  });
  if (!s.me) s.me = 'u-sap';
  if (!s.mforms) s.mforms = [];
  return s;
}
function save() {
  if (state.live) return; // client data stays off the phone's storage in the live app
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) {
    // Photos can fill this browser's small preview storage; keep the data, drop the oldest photos.
    try { const lite = { ...state, mforms: state.mforms.map((m, i, all) => (i < all.length - 2 ? { ...m, photos: [] } : m)) }; localStorage.setItem(KEY, JSON.stringify(lite)); } catch (e2) { /* preview only */ }
  }
}
function emit() { save(); listeners.forEach(l => l()); }
export function set(fn) { state = { ...state }; fn(state); emit(); }
export function get() { return state; }
export function useStore(sel = s => s) {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => sel(state));
}
export function resetPreview() { state = finalize(seed()); emit(); }

// ---------- live link ----------
let live = null;          // the database module, handed in by the live app
let chain = Promise.resolve();
let changes = 0, pending = 0;
let onError = () => {};
export function connect(mod, errorHandler) { live = mod; onError = errorHandler || onError; }
export function hydrate(s) { state = s; listeners.forEach(l => l()); }
export function pendingWrites() { return pending; }
// Queue a database write. Writes run one after another, so a new client is
// saved before its first appointment or note.
function persist(fn) {
  if (!state.live || !live) return;
  changes++; pending++;
  chain = chain.then(() => fn(live.db)).catch(e => {
    console.error(e);
    onError(e);
    refresh(true);
  }).finally(() => { pending--; });
}
let refreshing = null;
export function refresh(force) {
  if (!live || !state.live) return Promise.resolve();
  if (refreshing) return refreshing;
  const mark = changes;
  refreshing = live.loadAll(me()).then(s => {
    // Don't overwrite changes made while this was loading; the next refresh picks them up.
    if (force || (changes === mark && pending === 0)) hydrate(s);
  }).catch(e => { console.error(e); }).finally(() => { refreshing = null; });
  return refreshing;
}

// ---------- selectors ----------
export function me(s = state) { return s.users.find(u => u.id === s.me) || s.users[0]; }
export function userName(id, s = state) { const u = s.users.find(x => x.id === id); return u ? u.name : 'Unassigned'; }
export function clientById(id, s = state) { return s.clients.find(c => c.id === id); }

// What this person is allowed to see. The live app enforces this in the database.
export function visibleClients(user, s = state) {
  if (can(user, 'seeAllClients')) return s.clients;
  if (user.role === 'tailor') {
    const ids = new Set(s.orders.filter(o => o.status !== 'delivered').map(o => o.clientId));
    return s.clients.filter(c => ids.has(c.id));
  }
  // A rep sees clients assigned to them, plus anyone they have been sent to visit.
  const visiting = new Set(s.appointments.filter(a => a.assignedTo === user.id && a.status === 'scheduled').map(a => a.clientId));
  return s.clients.filter(c => c.assignedTo === user.id || visiting.has(c.id));
}
export function visibleIds(user, s = state) { return new Set(visibleClients(user, s).map(c => c.id)); }
export function visibleAppointments(user, s = state) {
  const ids = visibleIds(user, s);
  return s.appointments.filter(a => ids.has(a.clientId));
}
export function visibleOrders(user, s = state) { const ids = visibleIds(user, s); return s.orders.filter(o => ids.has(o.clientId)); }

export function paid(order) { return (order.payments || []).reduce((t, p) => t + (+p.amount || 0), 0); }
export function stageDue(order, stageKey) {
  const ps = PAY_STAGES.find(p => p.key === stageKey);
  return Math.round((order.total || 0) * ps.pct / 100);
}
export function paidForStage(order, stageKey) {
  return (order.payments || []).filter(p => p.stage === stageKey).reduce((t, p) => t + (+p.amount || 0), 0);
}
export function quoteFor(clientId, s = state) {
  return s.quotes.filter(q => q.clientId === clientId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}
export function clientValue(c, s = state) {
  const o = s.orders.filter(x => x.clientId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (o && ['confirmed', 'production', 'trial1', 'trial2', 'delivered', 'closed'].includes(c.stage)) return o.total;
  const q = quoteFor(c.id, s);
  return q ? priceQuote(q.items, s.fabrics, s.pricing).total : null;
}
export function nextAppointment(clientId, s = state) {
  return s.appointments.filter(a => a.clientId === clientId && a.status === 'scheduled' && a.date >= today())
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];
}
export function formVersions(clientId, s = state) { return s.mforms.filter(m => m.clientId === clientId).sort((a, b) => a.v - b.v); }
export function latestForm(clientId, s = state) { const v = formVersions(clientId, s); return v[v.length - 1]; }

// ---------- automatic follow-ups ----------
// Worked out from the data each time, so nobody has to create them.
// Each has a stable key; ticking one off records the key as dismissed.
export function followUps(user, s = state) {
  const t = today();
  const ids = visibleIds(user, s);
  const out = [];
  const push = (key, clientId, title, due, owner, kind) => {
    if (!ids.has(clientId) || s.dismissed[key]) return;
    out.push({ key, clientId, title, due, owner, kind, auto: true });
  };
  s.clients.forEach(c => {
    const next = nextAppointment(c.id, s);
    if (c.stage === 'new' && !next) push(`book:${c.id}:${c.stageSince}`, c.id, c.source === 'telecrm' && !c.assignedTo ? 'Assign a rep and book the consultation' : 'Call and book the consultation', addDays(c.stageSince, 1) < t ? addDays(c.stageSince, 1) : t, c.assignedTo, 'book');
    if (c.stage === 'quoted') push(`quote:${c.id}:${c.stageSince}`, c.id, 'Follow up on the quote', addDays(c.stageSince, 2), c.assignedTo, 'sales');
    if (c.stage === 'visited') push(`visit:${c.id}:${c.stageSince}`, c.id, 'Follow up after the consultation', c.followUpOn || addDays(c.stageSince, 3), c.assignedTo, 'sales');
    if (c.stage === 'hold') push(`hold:${c.id}:${c.stageSince}`, c.id, 'Check back in', c.followUpOn || addDays(c.stageSince, 14), c.assignedTo, 'sales');
  });
  s.orders.forEach(o => {
    const c = clientById(o.clientId, s); if (!c) return;
    const rep = c.assignedTo;
    if (!latestForm(c.id, s) && o.status !== 'delivered') push(`form:${o.id}`, c.id, `Enter the measurement form — ${o.number}`, o.createdAt, rep, 'measure');
    // One payment reminder per order: whatever is owed by the stage it has reached.
    if (o.total) {
      const got = paid(o);
      const owedBy = o.status === 'delivered' ? o.total : ['trial2'].includes(o.status) ? stageDue(o, 'advance') + stageDue(o, 'trial') : stageDue(o, 'advance');
      if (got < owedBy - 1) {
        const left = inr(o.total - got);
        if (o.status === 'delivered') push(`pay-del:${o.id}`, c.id, `Collect the balance, ${left} — ${o.number}`, o.dates.delivery || o.createdAt, rep, 'pay');
        else if (o.status === 'trial2') push(`pay-tri:${o.id}`, c.id, `Collect the trial payment — ${o.number}`, o.dates.trial1 || o.createdAt, rep, 'pay');
        else push(`pay-adv:${o.id}`, c.id, `Collect the 50% advance — ${o.number}`, o.createdAt, rep, 'pay');
      }
    }
    const tri = s.appointments.find(a => a.clientId === c.id && a.type === 'trial1' && a.status === 'scheduled');
    if (tri && diffDays(tri.date, t) <= 1 && diffDays(tri.date, t) >= 0) push(`conf-t1:${tri.id}`, c.id, 'Confirm the trial with the client', addDays(tri.date, -1) < t ? t : addDays(tri.date, -1), rep, 'confirm');
    if (o.status === 'delivered' && o.dates.delivery) push(`check:${o.id}`, c.id, 'Check in on fit, and ask for a photo in the suit', addDays(o.dates.delivery, 7), rep, 'care');
    if (o.status === 'production' && o.dates.trial1 && diffDays(o.dates.trial1, t) <= 3 && !tri) push(`book-t1:${o.id}`, c.id, `Book trial 1 — ${o.number}`, addDays(o.dates.trial1, -3) < t ? t : addDays(o.dates.trial1, -3), rep, 'book');
  });
  s.tasks.filter(x => !x.done && ids.has(x.clientId)).forEach(x => out.push({ key: x.id, clientId: x.clientId, title: x.title, due: x.due, owner: x.assignedTo, kind: 'manual', auto: false }));
  const mine = user.role === 'rep' ? out.filter(x => !x.owner || x.owner === user.id) : out;
  return mine.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

// ---------- actions ----------
export function log(clientId, text, by) {
  const id = uid('l');
  set(s => { s.activity = [{ id, clientId, at: today(), by: by || s.me, text }, ...s.activity]; });
  persist(db => db.insert('activity', { id, clientId, text }));
}
export function setMe(id) { set(s => { s.me = id; }); }
export function addClient(data) {
  const id = uid('c');
  const row = { id, createdAt: today(), stageSince: today(), lostReason: '', telecrmId: '', email: '', sourceDetail: '', ...data };
  set(s => { s.clients = [row, ...s.clients]; });
  persist(db => db.insert('clients', row));
  log(id, `Client added from ${data.source}.`);
  return id;
}
export function updateClient(id, patch) {
  set(s => { s.clients = s.clients.map(c => (c.id === id ? { ...c, ...patch } : c)); });
  persist(db => db.update('clients', id, patch));
}
// Hand a client to someone. Visits already booked for the client go with
// them, unless another rep was specifically sent on that visit.
export function assignClient(clientId, who) {
  const s0 = get();
  const c = clientById(clientId, s0); if (!c) return;
  const isRep = id => (s0.users.find(u => u.id === id) || {}).role === 'rep';
  const moved = s0.appointments.filter(a => a.clientId === clientId && a.status === 'scheduled' && a.assignedTo !== who && (!a.assignedTo || a.assignedTo === c.assignedTo || !isRep(a.assignedTo)));
  updateClient(clientId, { assignedTo: who });
  moved.forEach(a => updateAppointment(a.id, { assignedTo: who }));
  log(clientId, `Assigned to ${userName(who)}.${moved.length ? ` ${moved.length} booked visit${moved.length > 1 ? 's' : ''} moved to them.` : ''}`);
}
export function setStage(id, stage, extra = {}) {
  const c = clientById(id);
  if (!c || (c.stage === stage && !Object.keys(extra).length)) return;
  updateClient(id, { stage, stageSince: today(), ...extra });
  log(id, `Moved to ${stage}${extra.lostReason ? ` (${extra.lostReason})` : ''}.`);
}
// Only move forward automatically; never drag a client back a stage.
export function advanceStage(id, stage) {
  const c = clientById(id); if (!c) return;
  if (['lost', 'hold'].includes(c.stage) || stageIndex(stage) > stageIndex(c.stage)) setStage(id, stage);
}
export function addAppointment(data) {
  const id = uid('a');
  const row = { id, status: 'scheduled', notes: '', ...data };
  set(s => { s.appointments = [...s.appointments, row]; });
  persist(db => db.insert('appointments', row));
  return id;
}
export function updateAppointment(id, patch) {
  set(s => { s.appointments = s.appointments.map(a => (a.id === id ? { ...a, ...patch } : a)); });
  persist(db => db.update('appointments', id, patch));
}
export function saveQuote(q) {
  set(s => {
    const exists = s.quotes.some(x => x.id === q.id);
    s.quotes = exists ? s.quotes.map(x => (x.id === q.id ? q : x)) : [q, ...s.quotes];
  });
  persist(db => db.upsert('quotes', q));
}
export function createOrder({ clientId, items, dates, advance, by }) {
  const s0 = get();
  const number = s0.live ? 'TR-····' : 'TR-' + String(s0.nextOrder).padStart(4, '0');
  const pq = priceQuote(items, s0.fabrics, s0.pricing);
  const id = uid('o');
  const payments = advance && +advance.amount > 0 ? [{ id: uid('p'), stage: 'advance', amount: +advance.amount, date: today(), method: advance.method }] : [];
  set(s => {
    s.orders = [{ id, number, clientId, createdAt: today(), status: 'confirmed', by, items, dates, payments, total: pq.total, gstPct: pq.gstPct, priceIncomplete: !pq.complete, costs: { fabric: null, stitching: null, travel: null, other: 0, lines: {} }, notes: '' }, ...s.orders];
    s.nextOrder = s.nextOrder + 1;
  });
  if (s0.live) {
    // The database gives the order its number; show it as soon as it's back.
    const o = get().orders.find(x => x.id === id);
    persist(async db => {
      const { number: _n, ...row } = o; // the database numbers it
      await db.insert('orders', row);
      for (const p of payments) await db.insert('payments', { ...p, orderId: id });
      const n = await db.orderNumber(id);
      set(s => { s.orders = s.orders.map(x => (x.id === id ? { ...x, number: n } : x)); });
      await db.insert('activity', { id: uid('l'), clientId, text: `Order ${n} confirmed.` });
    });
    setStage(clientId, 'confirmed');
    return id;
  }
  setStage(clientId, 'confirmed');
  log(clientId, `Order ${number} confirmed.`);
  return id;
}
// An order entered by hand, as in the Client Book: garments, the order value
// and any payment so far. The value is kept as entered, never repriced.
export function addManualOrder({ clientId, items, total, createdAt, status, dates, payment, notes }) {
  const s0 = get();
  const id = uid('o');
  const number = s0.live ? 'TR-····' : 'TR-' + String(s0.nextOrder).padStart(4, '0');
  const payments = payment && +payment.amount > 0 ? [{ id: uid('p'), stage: 'advance', reference: '', ...payment, amount: +payment.amount }] : [];
  const o = { id, number, clientId, createdAt: createdAt || today(), status: status || 'confirmed', by: s0.me, items, dates: dates || {}, payments,
    total: +total || 0, gstPct: 5, priceIncomplete: false, imported: true, costs: { fabric: null, stitching: null, travel: null, other: 0, lines: {} }, notes: notes || '' };
  set(s => { s.orders = [o, ...s.orders]; s.nextOrder = s.nextOrder + 1; });
  setStage(clientId, o.status);
  if (s0.live) {
    persist(async db => {
      const { number: _n, ...row } = o;
      await db.insert('orders', row);
      for (const p of payments) await db.insert('payments', { ...p, orderId: id });
      const n = await db.orderNumber(id);
      set(s => { s.orders = s.orders.map(x => (x.id === id ? { ...x, number: n } : x)); });
      await db.insert('activity', { id: uid('l'), clientId, text: `Order ${n} entered: ${inr(o.total)}.` });
    });
  } else log(clientId, `Order ${number} entered: ${inr(o.total)}.`);
  return id;
}
// Change an order's value, garments, dates or stage by hand.
export function editOrder(id, patch) {
  const o = get().orders.find(x => x.id === id); if (!o) return;
  const p = { ...patch };
  if ('total' in p && +p.total !== o.total) { p.total = +p.total || 0; p.imported = true; p.priceIncomplete = false; if (o.gstPct == null) p.gstPct = 5; }
  updateOrder(id, p);
  if (p.status && p.status !== o.status) setStage(o.clientId, p.status);
  const what = [p.total !== undefined && +p.total !== o.total ? `value ${inr(o.total)} → ${inr(+p.total)}` : '', p.status && p.status !== o.status ? `stage → ${p.status}` : ''].filter(Boolean).join(', ');
  log(o.clientId, `${o.number} edited${what ? `: ${what}` : ''}.`);
}
export function updatePayment(orderId, pid, patch) {
  set(s => { s.orders = s.orders.map(o => (o.id === orderId ? { ...o, payments: o.payments.map(p => (p.id === pid ? { ...p, ...patch } : p)) } : o)); });
  persist(db => db.update('payments', pid, patch));
}
export function deletePayment(orderId, pid) {
  set(s => { s.orders = s.orders.map(o => (o.id === orderId ? { ...o, payments: o.payments.filter(p => p.id !== pid) } : o)); });
  persist(db => db.remove('payments', pid));
}
export function updateOrder(id, patch) {
  set(s => { s.orders = s.orders.map(o => (o.id === id ? { ...o, ...patch } : o)); });
  const { costs, payments, ...rest } = patch;
  if (costs) persist(db => db.orderCosts(id, costs));
  if (Object.keys(rest).length) persist(db => db.update('orders', id, rest));
}
export function setOrderStatus(id, status) {
  const o = get().orders.find(x => x.id === id); if (!o) return;
  if (state.live && me().role === 'tailor') {
    // The workroom can only move an order forward, through the database's own rule.
    set(s => { s.orders = s.orders.map(x => (x.id === id ? { ...x, status } : x)); });
    persist(db => db.workroomAdvance(id, status));
    return;
  }
  updateOrder(id, { status });
  advanceStage(o.clientId, status);
  log(o.clientId, `${o.number} moved to ${status}.`);
}
export function recordPayment(orderId, pay) {
  const o = get().orders.find(x => x.id === orderId);
  const p = { id: uid('p'), ...pay };
  set(s => { s.orders = s.orders.map(x => (x.id === orderId ? { ...x, payments: [...(x.payments || []), p] } : x)); });
  persist(db => db.insert('payments', { ...p, orderId }));
  if (o) log(o.clientId, `Payment of ₹${(+pay.amount).toLocaleString('en-IN')} recorded (${pay.method}) — ${o.number}.${pay.reference ? ` ${pay.reference}` : ''}`);
}
// Each save of the measurement form is a new version; earlier versions are never changed.
export function saveMeasureForm({ clientId, reason, form, photos }) {
  const prev = latestForm(clientId);
  const changes = diffForms(prev ? prev.form : null, form);
  const photosChanged = (photos || []).length !== ((prev && prev.photos) || []).length;
  if (prev && !changes.length && !photosChanged) return { saved: false, changes };
  const v = prev ? prev.v + 1 : 1;
  const id = uid('mf');
  const entry = { id, clientId, v, reason, by: state.me, date: today(), time: nowTime(), form, changes: prev ? changes : [], photos: photos || [] };
  set(s => { s.mforms = [...s.mforms, entry]; });
  persist(async db => {
    const paths = await db.photos(clientId, id, entry.photos);
    await db.insert('measure_forms', { id, clientId, reason, form, changes: entry.changes, photos: paths });
  });
  log(clientId, prev ? `Measurement form updated — ${reasonLabel(reason)}, ${changes.length} change${changes.length === 1 ? '' : 's'}.` : `Measurement form entered — ${reasonLabel(reason)}.`);
  return { saved: true, changes, v };
}
export function addTask(t) {
  const row = { id: uid('t'), done: false, ...t };
  set(s => { s.tasks = [...s.tasks, row]; });
  persist(db => db.insert('tasks', row));
}
export function completeFollowUp(f) {
  set(s => {
    if (f.auto) s.dismissed = { ...s.dismissed, [f.key]: today() };
    else s.tasks = s.tasks.map(t => (t.id === f.key ? { ...t, done: true } : t));
  });
  persist(db => (f.auto ? db.dismiss(f.key) : db.update('tasks', f.key, { done: true })));
  log(f.clientId, `Done: ${f.title}.`);
}
export function snoozeFollowUp(f, days) {
  const until = addDays(today(), days);
  if (f.auto) {
    const row = { id: uid('t'), clientId: f.clientId, title: f.title, due: until, assignedTo: f.owner || '', done: false };
    set(s => { s.dismissed = { ...s.dismissed, [f.key]: today() }; s.tasks = [...s.tasks, row]; });
    persist(async db => { await db.dismiss(f.key); await db.insert('tasks', row); });
  } else {
    set(s => { s.tasks = s.tasks.map(t => (t.id === f.key ? { ...t, due: until } : t)); });
    persist(db => db.update('tasks', f.key, { due: until }));
  }
}
// Saving rules never re-prices a confirmed order, except one that was
// waiting for a missing charge: that one picks up its full total now.
export function savePricing(p) {
  const repriced = [];
  set(s => {
    s.pricing = p;
    s.orders = s.orders.map(o => {
      if (!o.priceIncomplete) return o;
      const pq = priceQuote(o.items, s.fabrics, p);
      const patch = { total: pq.total, gstPct: pq.gstPct, priceIncomplete: !pq.complete };
      repriced.push([o.id, patch]);
      return { ...o, ...patch };
    });
  });
  persist(async db => {
    await db.pricing(p);
    for (const [id, patch] of repriced) await db.update('orders', id, patch);
  });
  if (state.live) chain.then(() => refresh(true)); // cloth prices follow a new uplift
}
// Owner only: stitching by city and construction, travel per order, dealers.
export function saveCostRules(rules) {
  set(s => { s.costRules = rules; });
  persist(db => db.costRules(rules));
}
// Owner only: add a cloth to the library, or change its dealer or rate.
export function saveFabric(f) {
  const id = f.id || uid('f');
  const row = { active: true, colour: '', use: 'suiting', ...f, id, pricePerM: null };
  set(s => {
    const P = s.pricing;
    const rate = +row.cost.rate || 0;
    row.pricePerM = P.fx ? Math.round(rate * (1 + (P.landingUpliftPct || 0) / 100) * 100) / 100 : null;
    s.fabrics = s.fabrics.some(x => x.id === id) ? s.fabrics.map(x => (x.id === id ? { ...x, ...row } : x)) : [row, ...s.fabrics];
  });
  persist(db => db.fabric(row));
  return id;
}
// Owner only: name, role, city, and whether someone can sign in.
export function updateUser(id, patch) {
  set(s => { s.users = s.users.map(u => (u.id === id ? { ...u, ...patch } : u)); });
  persist(db => db.profile(id, patch));
}
export function flushed() { return chain; }
