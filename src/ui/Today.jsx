import React from 'react';
import { useApp, Icon, Empty } from './kit.jsx';
import { OutcomeSheet, AssignSheet, BookSheet } from './forms.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, apptLabel, CITIES, orderStatusLabel } from '../data/catalog.js';
import { Chips } from './kit.jsx';
import { orderCost } from '../data/costs.js';
import { NotifyCard } from './Notify.jsx';
import { today, fmtLong, fmtTime, dueLabel, addDays, fmtDate, rel, inr } from '../data/util.js';

export function Today() {
  const s = useStore();
  if (can(S.me(s), 'seeCosts')) return <OwnerToday />;
  return <TeamToday />;
}

function TeamToday() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const t = today();
  // A rep's visits: ones they're sent on, and any booked for clients assigned to them.
  const mine = a => me.role !== 'rep' || a.assignedTo === me.id || (S.clientById(a.clientId, s) || {}).assignedTo === me.id;
  const appts = S.visibleAppointments(me, s).filter(a => a.status === 'scheduled' && mine(a));
  const todays = appts.filter(a => a.date === t).sort((a, b) => (a.time < b.time ? -1 : 1));
  const later = appts.filter(a => a.date > t).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  // New leads handed to this rep that haven't been visited yet, newest first.
  const leads = me.role === 'rep' ? s.clients.filter(c => c.assignedTo === me.id && ['new', 'booked'].includes(c.stage))
    .sort((a, b) => ((a.stageSince || a.createdAt) < (b.stageSince || b.createdAt) ? 1 : -1)) : [];
  const fus = S.followUps(me, s);
  // Most recent first, oldest at the bottom.
  const due = fus.filter(f => f.due <= t).sort((a, b) => (a.due === b.due ? 0 : a.due < b.due ? 1 : -1));
  const soon = fus.filter(f => f.due > t && f.due <= addDays(t, 3));
  const inbox = can(me, 'assign') ? s.clients.filter(c => c.source === 'telecrm' && !c.assignedTo && !['lost', 'closed'].includes(c.stage)) : [];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const overdue = due.filter(f => f.due < t).length;

  return (
    <div className="stack">
      <header>
        <div className="eyebrow">{fmtLong(t)}</div>
        <h1 className="h1" style={{ marginTop: 4 }}>{greet}, {me.name.split(' ')[0]}.</h1>
        {s.live && <div style={{ marginTop: 12 }}><NotifyCard /></div>}
        <p className="lead">
          {todays.length ? `${todays.length} visit${todays.length > 1 ? 's' : ''} today` : 'No visits today'}
          {' · '}{due.length ? `${due.length} follow-up${due.length > 1 ? 's' : ''} due${overdue ? `, ${overdue} overdue` : ''}` : 'nothing due'}
        </p>
      </header>

      {inbox.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2 className="h2">New from TeleCRM</h2><span className="count">{inbox.length} to assign</span></div>
          <div className="list">
            {inbox.map(c => (
              <div className="item" key={c.id}>
                <div className="item-main press" role="button" tabIndex={0} onClick={() => app.push({ view: 'client', id: c.id })}>
                  <div className="item-title">{c.name}</div>
                  <div className="item-sub">{c.city} · {c.occasion || 'Occasion not given'}{c.telecrmId ? ` · ${c.telecrmId}` : ''}</div>
                </div>
                <button className="btn small" onClick={() => app.open(<AssignSheet clientId={c.id} />)}>Assign</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {leads.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2 className="h2">Your new leads</h2><span className="count">{leads.length}</span></div>
          <div className="list">{leads.map(c => {
            const next = s.appointments.filter(a => a.clientId === c.id && a.status === 'scheduled' && a.date >= t).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];
            return (
              <div className="item" key={c.id}>
                <div className="item-main press" role="button" tabIndex={0} onClick={() => app.push({ view: 'client', id: c.id })}>
                  <div className="item-title">{c.name}</div>
                  <div className="item-sub">{[c.city, c.occasion, c.address ? c.address.split('\n')[0] : ''].filter(Boolean).join(' · ')}</div>
                  <div className="tiny" style={{ marginTop: 2, color: next ? 'var(--fg)' : 'var(--late)' }}>{next ? `${apptLabel(next.type)} · ${rel(next.date)}${next.time ? `, ${fmtTime(next.time)}` : ''}` : 'No visit booked yet'}</div>
                </div>
                {!next && can(me, 'book') && <button className="btn small" onClick={() => app.open(<BookSheet clientId={c.id} />)}>Book</button>}
              </div>
            );
          })}</div>
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Visits today</h2><span className="count">{todays.length}</span></div>
        {todays.length ? <div className="list">{todays.map(a => <ApptRow key={a.id} a={a} />)}</div>
          : <Empty title="A clear day.">Visits booked for today will show here with the address and a way to call.</Empty>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Follow-ups</h2><span className="count">{due.length} due</span></div>
        {due.length ? <div className="list">{due.map(f => <FollowRow key={f.key} f={f} />)}</div>
          : <Empty title="Nothing due.">Follow-ups appear on their own — after a quote, before a trial, when a payment is owed.</Empty>}
        {soon.length > 0 && <>
          <div className="eyebrow" style={{ marginTop: 8 }}>Next three days</div>
          <div className="list">{soon.map(f => <FollowRow key={f.key} f={f} />)}</div>
        </>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Coming up</h2><span className="count">{later.length} visit{later.length === 1 ? '' : 's'}</span></div>
        {later.length ? <div className="list">{later.map(a => {
          const c = S.clientById(a.clientId, s);
          return (
            <button className="item" key={a.id} onClick={() => app.push({ view: 'client', id: c.id })}>
              <div className="item-main">
                <div className="item-title">{c.name}</div>
                <div className="item-sub">{apptLabel(a.type)} · {c.city}{me.role !== 'rep' ? ` · ${S.userName(a.assignedTo, s)}` : ''}</div>
              </div>
              <div className="item-end num">{rel(a.date)}<div className="muted tiny">{fmtTime(a.time)}</div></div>
            </button>
          );
        })}</div> : <Empty title="Nothing booked yet.">Book consultations and trials from a client's page.</Empty>}
      </section>
    </div>
  );
}

export function ApptRow({ a, showDate }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const c = S.clientById(a.clientId, s);
  const fromTele = c.source === 'telecrm';
  return (
    <div className="appt">
      <div className="appt-time">{fmtTime(a.time)}<small>{showDate ? fmtDate(a.date) : apptLabel(a.type)}</small></div>
      <div style={{ minWidth: 0 }}>
        <button className="press" style={{ display: 'block', width: '100%' }} onClick={() => app.push({ view: 'client', id: c.id })}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span className="item-title">{c.name}</span>
            {showDate && <span className="pill">{apptLabel(a.type)}</span>}
            {fromTele && a.type === 'consult' && <span className="pill">TeleCRM</span>}
          </div>
          {can(me, 'seeContact') && <div className="item-sub">{c.address}</div>}
          <div className="item-sub">{[me.role !== 'rep' ? c.city : '', me.role !== 'rep' ? S.userName(a.assignedTo, s) : '', c.occasion, c.budget && can(me, 'seePrices') ? c.budget : ''].filter(Boolean).join(' · ')}</div>
          {a.notes && <div className="item-sub" style={{ color: 'var(--fg)' }}>{a.notes}</div>}
        </button>
        {can(me, 'seeContact') && <div className="tiny muted num" style={{ marginTop: 6 }}>{c.phone}</div>}
        <div className="appt-acts">
          {can(me, 'seeContact') && <>
            <a className="btn ghost small" href={`tel:${c.phone.replace(/\s/g, '')}`}><Icon n="phone" />Call</a>
            <a className="btn ghost small" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`} target="_blank" rel="noreferrer"><Icon n="map" />Map</a>
          </>}
          {can(me, 'book') && <button className="btn small" onClick={() => app.open(<OutcomeSheet appt={a} />)}><Icon n="check" />Done</button>}
        </div>
      </div>
    </div>
  );
}

export function FollowRow({ f, hideClient }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const c = S.clientById(f.clientId, s);
  const late = f.due < today();
  return (
    <div className="fu">
      <button className="check" aria-label={`Mark done: ${f.title}`} onClick={() => { S.completeFollowUp(f); app.toast('Done'); }}><Icon n="check" /></button>
      <button className="item-main press" style={{ textAlign: 'left' }} onClick={() => app.push({ view: 'client', id: c.id, tab: f.kind === 'measure' ? 'measure' : undefined })}>
        {!hideClient && <div className="item-title">{c.name}</div>}
        <div className={hideClient ? 'item-title' : 'fu-what'} style={hideClient ? { fontWeight: 400 } : null}>{f.title}</div>
        <div className="item-sub">
          <span style={late ? { color: 'var(--late)' } : null}>{dueLabel(f.due)}</span>
          {me.role !== 'rep' && f.owner ? ` · ${S.userName(f.owner, s)}` : ''}
          {f.auto ? '' : ' · added by hand'}
        </div>
      </button>
      <button className="iconbtn" aria-label="Snooze two days" title="Snooze two days" onClick={() => { S.snoozeFollowUp(f, 2); app.toast('Moved to ' + fmtDate(addDays(today(), 2))); }}><Icon n="snooze" /></button>
    </div>
  );
}

// The owner's home: sales, every city's visits for today and the week, the
// orders in the making (newest first), then follow-ups for clients still in play.
const DONE = ['delivered', 'lost', 'closed'];
function OwnerToday() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const t = today();
  const [city, setCity] = React.useState('All');
  const inCity = c => city === 'All' || (c && c.city === city);
  const appts = s.appointments.filter(a => a.status === 'scheduled' && inCity(S.clientById(a.clientId, s)));
  const todays = appts.filter(a => a.date === t).sort((a, b) => (a.time < b.time ? -1 : 1));
  const week = appts.filter(a => a.date > t && a.date <= addDays(t, 7)).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const open = s.orders
    .filter(o => o.status !== 'delivered' && !DONE.includes((S.clientById(o.clientId, s) || {}).stage) && inCity(S.clientById(o.clientId, s)))
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.number < b.number ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
  const fus = S.followUps(me, s).filter(f => !DONE.includes((S.clientById(f.clientId, s) || {}).stage) && inCity(S.clientById(f.clientId, s)));
  const due = fus.filter(f => f.due <= t).sort((a, b) => (a.due === b.due ? 0 : a.due < b.due ? 1 : -1));
  const inbox = s.clients.filter(c => c.source === 'telecrm' && !c.assignedTo && !DONE.includes(c.stage));
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const counts = Object.fromEntries(CITIES.map(c => [c, s.appointments.filter(a => a.status === 'scheduled' && a.date >= t && a.date <= addDays(t, 7) && (S.clientById(a.clientId, s) || {}).city === c).length]));

  return (
    <div className="stack">
      <header>
        <div className="eyebrow">{fmtLong(t)}</div>
        <h1 className="h1" style={{ marginTop: 4 }}>{greet}, {me.name.split(' ')[0]}.</h1>
      </header>

      {s.live && <NotifyCard />}
      <Sales orders={s.orders} />

      {inbox.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2 className="h2">New from TeleCRM</h2><span className="count">{inbox.length} to assign</span></div>
          <div className="list">{inbox.map(c => (
            <div className="item" key={c.id}>
              <div className="item-main press" role="button" tabIndex={0} onClick={() => app.push({ view: 'client', id: c.id })}>
                <div className="item-title">{c.name}</div>
                <div className="item-sub">{c.city} · {c.occasion || 'Occasion not given'}</div>
              </div>
              <button className="btn small" onClick={() => app.open(<AssignSheet clientId={c.id} />)}>Assign</button>
            </div>
          ))}</div>
        </section>
      )}

      <Chips value={city} onChange={setCity} options={[{ key: 'All', label: 'All cities' }, ...CITIES.map(c => ({ key: c, label: counts[c] ? `${c} · ${counts[c]}` : c }))]} />

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Appointments today</h2><span className="count">{todays.length}</span></div>
        {todays.length ? <div className="list">{todays.map(a => <ApptRow key={a.id} a={a} />)}</div>
          : <p className="small muted" style={{ margin: 0 }}>Nothing booked for today{city !== 'All' ? ` in ${city}` : ''}.</p>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">This week</h2><span className="count">{week.length}</span></div>
        {week.length ? <div className="list">{week.map(a => {
          const c = S.clientById(a.clientId, s);
          return (
            <button className="item" key={a.id} onClick={() => app.push({ view: 'client', id: c.id })}>
              <div className="item-main">
                <div className="item-title">{c.name}</div>
                <div className="item-sub">{apptLabel(a.type)} · {c.city} · {S.userName(a.assignedTo, s)}</div>
              </div>
              <div className="item-end num">{rel(a.date)}<div className="muted tiny">{fmtTime(a.time)}</div></div>
            </button>
          );
        })}</div> : <p className="small muted" style={{ margin: 0 }}>Nothing booked for the next seven days{city !== 'All' ? ` in ${city}` : ''}.</p>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Open orders</h2><span className="count">{open.length}</span></div>
        {open.length ? <div className="list">{open.map(o => {
          const c = S.clientById(o.clientId, s);
          const paid = S.paid(o);
          return (
            <button className="item" key={o.id} onClick={() => app.push({ view: 'order', id: o.id })}>
              <div className="item-main">
                <div className="item-title">{c ? c.name : '—'}</div>
                <div className="item-sub"><span className="pill gold">{orderStatusLabel(o.status)}</span> {o.number} · {c ? c.city : ''} · ordered {fmtDate(o.createdAt)}</div>
              </div>
              <div className="item-end num">{inr(o.total)}<div className="tiny" style={{ color: paid >= (o.total || 0) ? 'var(--ok)' : 'var(--muted)' }}>{paid >= (o.total || 0) ? 'Paid' : `${inr((o.total || 0) - paid)} due`}</div></div>
            </button>
          );
        })}</div> : <p className="small muted" style={{ margin: 0 }}>No orders in the making.</p>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Follow-ups</h2><span className="count">{due.length} due</span></div>
        {due.length ? <div className="list">{due.map(f => <FollowRow key={f.key} f={f} />)}</div>
          : <p className="small muted" style={{ margin: 0 }}>Nothing due.</p>}
      </section>
    </div>
  );
}

// Owner only: order value closed and the number of deals, by month, as in the Client Book.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function Sales({ orders }) {
  const app = useApp();
  const st = useStore();
  const [back, setBack] = React.useState(0); // months before this one
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const key = m => `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
  const sum = list => ({ value: list.reduce((t, o) => t + (o.total || 0), 0), n: list.length });
  const month = sum(orders.filter(o => (o.createdAt || '').startsWith(key(d))));
  const prev = sum(orders.filter(o => (o.createdAt || '').startsWith(key(new Date(d.getFullYear(), d.getMonth() - 1, 1)))));
  const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; // April to March
  const fy = sum(orders.filter(o => o.createdAt >= `${fyStart}-04-01` && o.createdAt < `${fyStart + 1}-04-01`));
  const received = orders.reduce((t, o) => t + (o.payments || []).filter(p => (p.date || '').startsWith(key(d))).reduce((x, p) => x + (+p.amount || 0), 0), 0);
  const change = prev.value ? Math.round(((month.value - prev.value) / prev.value) * 100) : null;
  const costed = orders.filter(o => (o.createdAt || '').startsWith(key(d))).map(o => orderCost(o, st, S.clientById(o.clientId, st)));
  const profit = costed.filter(k => k.complete).reduce((t, k) => t + k.profit, 0);
  const notFinal = costed.filter(k => !k.complete).length;
  return (
    <section className="card sales">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="eyebrow">Closed in {MONTHS[d.getMonth()]}{d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}</div>
        <div className="row" style={{ gap: 4 }}>
          <button className="iconbtn" aria-label="Previous month" onClick={() => setBack(b => b + 1)}><Icon n="left" /></button>
          <button className="iconbtn" aria-label="Next month" disabled={back === 0} onClick={() => setBack(b => Math.max(0, b - 1))} style={{ transform: 'scaleX(-1)', opacity: back === 0 ? 0.3 : 1 }}><Icon n="left" /></button>
        </div>
      </div>
      <div className="sales-big num">{inr(month.value)}</div>
      <div className="small">{month.n} deal{month.n === 1 ? '' : 's'} closed{change != null ? ` · ${change >= 0 ? '+' : ''}${change}% on ${MONTHS[(d.getMonth() + 11) % 12].slice(0, 3)}` : ''}</div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div><div className="tiny muted">Received in {MONTHS[d.getMonth()].slice(0, 3)}</div><div className="num">{inr(received)}</div></div>
        <div><div className="tiny muted">FY {String(fyStart).slice(2)}–{String(fyStart + 1).slice(2)} so far</div><div className="num">{inr(fy.value)} · {fy.n} deal{fy.n === 1 ? '' : 's'}</div></div>
      </div>
      {month.n > 0 && <button className="row between" onClick={() => app.push({ view: 'profit' })} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rule)', width: '100%', textAlign: 'left', alignItems: 'baseline' }}>
        <div><div className="tiny muted">Profit in {MONTHS[d.getMonth()].slice(0, 3)}, before GST</div><div className="num">{inr(profit)}{notFinal ? <span className="tiny" style={{ color: 'var(--late)' }}> · {notFinal} order{notFinal === 1 ? '' : 's'} not counted yet, costs missing</span> : ''}</div></div>
        <Icon n="right" style={{ width: 18, height: 18, flex: 'none' }} />
      </button>}
    </section>
  );
}
