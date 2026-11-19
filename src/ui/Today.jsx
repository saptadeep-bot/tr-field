import React from 'react';
import { useApp, Icon, Empty } from './kit.jsx';
import { OutcomeSheet, AssignSheet } from './forms.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, apptLabel } from '../data/catalog.js';
import { today, fmtLong, fmtTime, dueLabel, addDays, fmtDate, rel } from '../data/util.js';

export function Today() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const t = today();
  const appts = S.visibleAppointments(me, s).filter(a => a.status === 'scheduled' && (me.role !== 'rep' || a.assignedTo === me.id));
  const todays = appts.filter(a => a.date === t).sort((a, b) => (a.time < b.time ? -1 : 1));
  const later = appts.filter(a => a.date > t && a.date <= addDays(t, 7)).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const fus = S.followUps(me, s);
  const due = fus.filter(f => f.due <= t);
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
        <div className="item-title" style={{ fontWeight: 400 }}>{f.title}</div>
        <div className="item-sub">
          {!hideClient && <>{c.name} · </>}
          <span style={late ? { color: 'var(--late)' } : null}>{dueLabel(f.due)}</span>
          {me.role !== 'rep' && f.owner ? ` · ${S.userName(f.owner, s)}` : ''}
          {f.auto ? '' : ' · added by hand'}
        </div>
      </button>
      <button className="iconbtn" aria-label="Snooze two days" title="Snooze two days" onClick={() => { S.snoozeFollowUp(f, 2); app.toast('Moved to ' + fmtDate(addDays(today(), 2))); }}><Icon n="snooze" /></button>
    </div>
  );
}
