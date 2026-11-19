import React from 'react';
import { useApp, Icon, Empty } from './kit.jsx';
import { OutcomeSheet, AssignSheet } from './forms.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, apptLabel } from '../data/catalog.js';
import { today, fmtLong, fmtTime, dueLabel, addDays, fmtDate, rel, inr } from '../data/util.js';

export function Today() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const t = today();
  const appts = S.visibleAppointments(me, s).filter(a => a.status === 'scheduled' && (me.role !== 'rep' || a.assignedTo === me.id));
  const todays = appts.filter(a => a.date === t).sort((a, b) => (a.time < b.time ? -1 : 1));
  const later = appts.filter(a => a.date > t && a.date <= addDays(t, 7)).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
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
        <p className="lead">
          {todays.length ? `${todays.length} visit${todays.length > 1 ? 's' : ''} today` : 'No visits today'}
          {' · '}{due.length ? `${due.length} follow-up${due.length > 1 ? 's' : ''} due${overdue ? `, ${overdue} overdue` : ''}` : 'nothing due'}
        </p>
      </header>

      {can(me, 'seeCosts') && <Sales orders={s.orders} />}

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
        <div className="sec-h"><h2 className="h2">This week</h2><span className="count">{later.length} visit{later.length === 1 ? '' : 's'}</span></div>
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
          <div className="item-sub">{[c.occasion, c.budget && can(me, 'seePrices') ? c.budget : '', me.role !== 'rep' ? S.userName(a.assignedTo, s) : ''].filter(Boolean).join(' · ')}</div>
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

// Owner only: order value closed and the number of deals, by month, as in the Client Book.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function Sales({ orders }) {
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
    </section>
  );
}
