import React, { useState } from 'react';
import { useApp, Icon, Empty, StagePill, Avatar, Chips } from './kit.jsx';
import { NewClientSheet, BookSheet, StageSheet, AssignSheet, NoteSheet, OutcomeSheet } from './forms.jsx';
import { MeasureView } from './MeasureForm.jsx';
import { FollowRow } from './Today.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, stageLabel, sourceLabel, apptLabel, orderStatusLabel, STAGES } from '../data/catalog.js';
import { today, fmtDate, fmtTime, inr, rel, diffDays } from '../data/util.js';

export function Clients() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [q, setQ] = useState('');
  const [f, setF] = useState('active');
  let list = S.visibleClients(me, s);
  const counts = {
    active: list.filter(c => !['lost', 'closed'].includes(c.stage)).length,
    all: list.length,
    past: list.filter(c => ['lost', 'closed', 'delivered'].includes(c.stage)).length
  };
  if (f === 'active') list = list.filter(c => !['lost', 'closed'].includes(c.stage));
  if (f === 'past') list = list.filter(c => ['lost', 'closed', 'delivered'].includes(c.stage));
  const term = q.trim().toLowerCase();
  if (term) list = list.filter(c => [c.name, c.phone, c.city, c.address, c.telecrmId].join(' ').toLowerCase().includes(term));
  list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="stack">
      <header className="stack-s">
        <h1 className="h1">Clients</h1>
        <label className="f search"><Icon n="search" /><input id="cl-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, phone, area, TeleCRM id" aria-label="Search clients" /></label>
        <Chips value={f} onChange={setF} options={[{ key: 'active', label: 'Active', n: counts.active }, { key: 'past', label: 'Past & lost', n: counts.past }, { key: 'all', label: 'All', n: counts.all }]} />
      </header>
      {list.length ? (
        <div className="list">
          {list.map(c => (
            <button className="item" key={c.id} onClick={() => app.push({ view: 'client', id: c.id })}>
              <Avatar name={c.name} />
              <div className="item-main">
                <div className="item-title">{c.name}</div>
                <div className="item-sub">{c.city}{me.role !== 'rep' ? ` · ${S.userName(c.assignedTo, s)}` : ''} · {sourceLabel(c.source)}</div>
              </div>
              <div className="item-end"><StagePill stage={c.stage} /></div>
            </button>
          ))}
        </div>
      ) : <Empty title={term ? 'No match.' : 'No clients yet.'}>{term ? 'Try part of the name or the last digits of the phone.' : 'Add the first one with New client.'}</Empty>}
      {can(me, 'editClients') && <button className="fab" onClick={() => app.open(<NewClientSheet />)}><Icon n="plus" />New client</button>}
    </div>
  );
}

export function ClientView({ id, startTab }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const c = S.clientById(id, s);
  const tailor = me.role === 'tailor';
  const [tab, setTab] = useState(startTab || (tailor ? 'measure' : 'overview'));
  if (!c || !S.visibleIds(me, s).has(id)) return <Empty title="Not available.">This client isn't assigned to you.</Empty>;
  const appts = s.appointments.filter(a => a.clientId === id).sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  const upcoming = appts.filter(a => a.status === 'scheduled').reverse();
  const orders = s.orders.filter(o => o.clientId === id);
  const quotes = s.quotes.filter(q => q.clientId === id);
  const fus = S.followUps(me, s).filter(f => f.clientId === id);
  const hist = s.activity.filter(l => l.clientId === id);
  const form = S.latestForm(id, s);
  const idx = STAGES.findIndex(x => x.key === c.stage);
  const tabs = tailor ? [['measure', 'Measurements'], ['orders', 'Orders']] : [['overview', 'Overview'], ['visits', `Visits${upcoming.length ? ` · ${upcoming.length}` : ''}`], ['measure', form ? `Measurements · v${form.v}` : 'Measurements'], ['orders', 'Orders & quotes'], ['history', 'History']];

  return (
    <div className="stack">
      <header className="ch">
        <div className="row wrap" style={{ gap: 6 }}>
          <button onClick={() => !tailor && app.open(<StageSheet clientId={id} />)} aria-label="Change stage" disabled={tailor}><StagePill stage={c.stage} /></button>
          {!tailor && <span className="pill">{sourceLabel(c.source)}{c.sourceDetail ? ` · ${c.sourceDetail}` : ''}</span>}
          {c.telecrmId && !tailor && <span className="pill">{c.telecrmId}</span>}
        </div>
        <h1 className="ch-name">{c.name}</h1>
        {idx >= 0 && <div className="steps" aria-label={`Stage ${idx + 1} of ${STAGES.length}: ${stageLabel(c.stage)}`}>{STAGES.map((st, i) => <i key={st.key} className={i < idx ? 'on' : i === idx ? 'now' : ''} />)}</div>}
        <div className="small muted">{c.city}{!tailor ? ` · ${S.userName(c.assignedTo, s)}` : ''}{c.stage === 'lost' && c.lostReason ? ` · ${c.lostReason}` : ''} · {stageLabel(c.stage)} since {fmtDate(c.stageSince)}</div>
        {can(me, 'seeContact') && <>
          <div className="num small">{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
          <div className="appt-acts" style={{ marginTop: 0 }}>
            <a className="btn ghost small" href={`tel:${c.phone.replace(/\s/g, '')}`}><Icon n="phone" />Call</a>
            <a className="btn ghost small" href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><Icon n="chat" />WhatsApp</a>
            {can(me, 'book') && <button className="btn ghost small" onClick={() => app.open(<BookSheet clientId={id} type={orders.some(o => o.status !== 'delivered') ? 'trial1' : 'consult'} />)}><Icon n="cal" />Book</button>}
            {can(me, 'seePrices') && <button className="btn ghost small" onClick={() => app.go('quote', { clientId: id })}><Icon n="quote" />Quote</button>}
            <button className="btn ghost small" onClick={() => app.open(<NoteSheet clientId={id} />)}><Icon n="edit" />Note</button>
          </div>
        </>}
      </header>

      <nav className="seg" aria-label="Client sections">{tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>

      {tab === 'overview' && <div className="stack">
        {fus.length > 0 && <section className="sec"><div className="eyebrow">To do</div><div className="list">{fus.map(f => <FollowRow key={f.key} f={f} hideClient />)}</div></section>}
        {upcoming[0] && <section className="card gold">
          <div className="eyebrow">Next visit</div>
          <div className="row between" style={{ marginTop: 4 }}>
            <div><div className="item-title">{apptLabel(upcoming[0].type)} · {rel(upcoming[0].date)}, {fmtTime(upcoming[0].time)}</div><div className="item-sub">{S.userName(upcoming[0].assignedTo, s)}</div></div>
            <button className="btn small ghost" onClick={() => app.open(<BookSheet clientId={id} appt={upcoming[0]} />)}>Move</button>
          </div>
        </section>}
        <dl className="kv">
          <dt>Occasion</dt><dd>{c.occasion || '—'}{c.eventDate ? ` · ${fmtDate(c.eventDate)} (${diffDays(c.eventDate, today())} days away)` : ''}</dd>
          {can(me, 'seePrices') && <><dt>Budget</dt><dd>{c.budget || '—'}</dd></>}
          {can(me, 'seeContact') && <><dt>Address</dt><dd>{c.address || '—'}</dd></>}
          <dt>Came from</dt><dd>{sourceLabel(c.source)}{c.sourceDetail ? ` — ${c.sourceDetail}` : ''}</dd>
          <dt>Looked after by</dt><dd>{S.userName(c.assignedTo, s)}{can(me, 'assign') && <> · <button className="link" onClick={() => app.open(<AssignSheet clientId={id} />)}>{c.assignedTo ? 'Reassign' : 'Assign'}</button></>}</dd>
          <dt>Measurements</dt><dd>{form ? <button className="link" onClick={() => setTab('measure')}>Version {form.v}, {fmtDate(form.date)}</button> : 'Not taken yet'}</dd>
          <dt>Client since</dt><dd>{fmtDate(c.createdAt)}</dd>
        </dl>
        {c.notes && <div className="card"><div className="eyebrow">Notes</div><p style={{ margin: '6px 0 0' }}>{c.notes}</p></div>}
      </div>}

      {tab === 'visits' && <section className="sec">
        {can(me, 'book') && <button className="btn ghost" onClick={() => app.open(<BookSheet clientId={id} />)}><Icon n="plus" />Book a visit</button>}
        {appts.length ? <div className="list">{appts.map(a => (
          <div className="item" key={a.id}>
            <div className="item-main">
              <div className="item-title">{apptLabel(a.type)}</div>
              <div className="item-sub">{fmtDate(a.date)}, {fmtTime(a.time)} · {S.userName(a.assignedTo, s)}{a.notes ? ` · ${a.notes}` : ''}</div>
            </div>
            <div className="item-end">
              {a.status === 'scheduled'
                ? <div className="row" style={{ gap: 6 }}><button className="btn small ghost" onClick={() => app.open(<BookSheet clientId={id} appt={a} />)}>Move</button><button className="btn small" onClick={() => app.open(<OutcomeSheet appt={a} />)}>Done</button></div>
                : <span className={a.status === 'done' ? 'pill ok' : 'pill late'}>{a.status === 'done' ? 'Done' : 'Missed'}</span>}
            </div>
          </div>
        ))}</div> : <Empty title="No visits yet." />}
      </section>}

      {tab === 'measure' && <MeasureView clientId={id} />}

      {tab === 'orders' && <section className="stack">
        {orders.length ? <div className="list">{orders.map(o => (
          <button className="item" key={o.id} onClick={() => app.push({ view: 'order', id: o.id })}>
            <div className="item-main">
              <div className="item-title">{o.number} · {orderStatusLabel(o.status)}</div>
              <div className="item-sub">{o.items.length} garment{o.items.length > 1 ? 's' : ''} · ordered {fmtDate(o.createdAt)}{o.dates.delivery ? ` · delivery ${fmtDate(o.dates.delivery)}` : ''}</div>
            </div>
            {can(me, 'seePrices') && <div className="item-end num">{inr(o.total)}<div className="tiny muted">{inr(S.paid(o))} paid</div></div>}
          </button>
        ))}</div> : <Empty title="No orders yet." />}
        {!tailor && quotes.length > 0 && <>
          <div className="eyebrow">Quotes</div>
          <div className="list">{quotes.map(q => (
            <button className="item" key={q.id} onClick={() => app.go('quote', { quoteId: q.id })}>
              <div className="item-main"><div className="item-title">Quote of {fmtDate(q.createdAt)}</div><div className="item-sub">{q.items.length} garment{q.items.length > 1 ? 's' : ''} · {S.userName(q.by, s)}</div></div>
            </button>
          ))}</div>
        </>}
      </section>}

      {tab === 'history' && <section className="list">
        {hist.length ? hist.map(l => (
          <div className="item" key={l.id}>
            <div className="item-main"><div style={{ lineHeight: 1.45 }}>{l.text}</div><div className="item-sub">{fmtDate(l.at)} · {l.by === 'system' ? 'Automatic' : S.userName(l.by, s)}</div></div>
          </div>
        )) : <Empty title="Nothing logged yet." />}
      </section>}
    </div>
  );
}
