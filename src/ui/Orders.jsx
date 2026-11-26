import React, { useState } from 'react';
import { useApp, Icon, Empty, Chips, Sheet, Field } from './kit.jsx';
import { PaymentSheet, BookSheet } from './forms.jsx';
import { MeasureView } from './MeasureForm.jsx';
import { EditOrderSheet, PaymentList } from './OrderEdit.jsx';
import { CostSection } from './Profit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, ORDER_STATUS, PAY_STAGES, orderStatusLabel } from '../data/catalog.js';
import { garment, tierLabel, character, priceQuote } from '../data/pricing.js';
import { today, fmtDate, inr, rel, relWord, diffDays } from '../data/util.js';

function when(d) {
  if (!d) return '—';
  const n = diffDays(d, today());
  return rel(d);
}

export function OrdersList({ work }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [f, setF] = useState('open');
  let list = S.visibleOrders(me, s);
  const open = list.filter(o => o.status !== 'delivered');
  if (f === 'open') list = open; else if (f !== 'all') list = list.filter(o => o.status === f);
  list = [...list].sort((a, b) => ((a.dates.trial1 || a.dates.delivery || '') < (b.dates.trial1 || b.dates.delivery || '') ? -1 : 1));
  return (
    <div className="stack">
      <header className="stack-s">
        <h1 className="h1">{work ? 'Work in hand' : 'Orders'}</h1>
        {work && <p className="lead" style={{ marginTop: 0 }}>Garments, cloth, the measurement form and fitting dates. No prices or client contact details.</p>}
        <Chips value={f} onChange={setF} options={[{ key: 'open', label: 'Open', n: open.length }, ...ORDER_STATUS.map(x => ({ key: x.key, label: x.label })), { key: 'all', label: 'All' }]} />
      </header>
      {list.length ? <div className="list">{list.map(o => {
        const c = S.clientById(o.clientId, s);
        const next = ['confirmed', 'production', 'trial1'].includes(o.status) ? ['Trial 1', o.dates.trial1] : o.status === 'trial2' ? ['Trial 2', o.dates.trial2] : ['Delivered', o.dates.delivery];
        const owed = (o.total || 0) - S.paid(o);
        const form = S.latestForm(c.id, s);
        return (
          <button className="item" key={o.id} onClick={() => app.push({ view: 'order', id: o.id })}>
            <div className="item-main">
              <div className="row wrap" style={{ gap: 6 }}><span className="item-title">{o.number}</span><span className="pill">{orderStatusLabel(o.status)}</span>{work && form && (form.changes || []).length > 0 && <span className="pill chg">Measurements changed</span>}</div>
              <div className="item-sub">{c.name} · {c.city} · {o.items.map(i => garment(i.garment).label + (i.qty > 1 ? ` × ${i.qty}` : '')).join(', ')}</div>
              {next[1] && <div className="item-sub" style={{ color: o.status !== 'delivered' && next[1] < today() ? 'var(--late)' : 'var(--fg)' }}>{next[0]} {relWord(next[1])}</div>}
            </div>
            {can(me, 'seePrices') && <div className="item-end num">{inr(o.total)}{owed > 0 && <div className="tiny" style={{ color: 'var(--late)' }}>{inr(owed)} due</div>}</div>}
          </button>
        );
      })}</div> : <Empty title="Nothing here." />}
    </div>
  );
}

export function OrderView({ id }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const o = s.orders.find(x => x.id === id);
  if (!o || !S.visibleIds(me, s).has(o.clientId)) return <Empty title="Not available." />;
  const c = S.clientById(o.clientId, s);
  const idx = ORDER_STATUS.findIndex(x => x.key === o.status);
  const nextStatus = ORDER_STATUS[idx + 1];
  const paid = S.paid(o);
  const prices = can(me, 'seePrices');
  const late = o.dates.delivery && c.eventDate && o.dates.delivery > c.eventDate;
  const canMove = can(me, 'book') || (me.role === 'tailor' && ['confirmed', 'production'].includes(o.status));
  return (
    <div className="stack">
      <header className="ch">
        <div className="row wrap" style={{ gap: 6 }}><span className="pill dark">{orderStatusLabel(o.status)}</span><span className="pill">Ordered {fmtDate(o.createdAt)}</span></div>
        <h1 className="ch-name">{o.number}</h1>
        <button className="link" style={{ alignSelf: 'flex-start', fontSize: 15 }} onClick={() => app.push({ view: 'client', id: c.id })}>{c.name} · {c.city}</button>
        <div className="steps">{ORDER_STATUS.map((st, i) => <i key={st.key} className={i < idx ? 'on' : i === idx ? 'now' : ''} />)}</div>
        <div className="row wrap tiny muted" style={{ gap: 14 }}>{ORDER_STATUS.map((st, i) => <span key={st.key} style={i === idx ? { color: 'var(--fg)' } : null}>{st.label}</span>)}</div>
        {nextStatus && canMove && (
          <button className="btn primary" onClick={() => { S.setOrderStatus(o.id, nextStatus.key); app.toast(`Moved to ${nextStatus.label}`); }}>
            {o.status === 'confirmed' ? 'Sent to the workroom' : o.status === 'production' ? 'Ready for trial 1' : o.status === 'trial1' ? 'Trial 1 done' : 'Mark delivered'}
          </button>
        )}
      </header>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Dates</h2></div>
        <dl className="kv num">
          <dt>Trial 1</dt><dd>{when(o.dates.trial1)}</dd>
          <dt>Trial 2</dt><dd>{when(o.dates.trial2)}</dd>
          <dt>Delivery</dt><dd>{when(o.dates.delivery)}</dd>
          {c.eventDate && <><dt>His event</dt><dd style={late ? { color: 'var(--late)' } : null}>{fmtDate(c.eventDate)}{late ? ' — before delivery' : ` · ${diffDays(c.eventDate, o.dates.delivery || today())} days after delivery`}</dd></>}
        </dl>
        {can(me, 'book') && <div className="row wrap"><button className="btn small ghost" onClick={() => app.open(<DatesSheet order={o} />)}>Change dates</button><button className="btn small ghost" onClick={() => app.open(<BookSheet clientId={c.id} type={o.status === 'trial1' || o.status === 'trial2' ? 'trial2' : 'trial1'} />)}>Book the fitting</button></div>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Garments</h2><span className="count">{o.items.length}</span></div>
        <div className="list">{o.items.map(i => {
          const f = s.fabrics.find(x => x.id === i.fabricId);
          return (
            <div className="item" key={i.id}>
              <div className="item-main">
                <div className="item-title">{garment(i.garment).label}{i.qty > 1 ? ` × ${i.qty}` : ''} <span className="muted" style={{ fontWeight: 400 }}>· {tierLabel(i.tier)}</span></div>
                {f && <div className="small" style={{ marginTop: 2 }}>{[f.house, f.mill !== '—' ? f.mill : '', f.design, f.colour].filter(Boolean).join(' · ')}</div>}
                {!f && i.cloth && <div className="small" style={{ marginTop: 2 }}>Cloth: {i.cloth}</div>}
                {f && <div className="item-sub">{character(f)}</div>}
                {i.specs && <div className="small" style={{ marginTop: 6, borderLeft: '2px solid var(--gold)', paddingLeft: 10 }}>{i.specs}</div>}
              </div>
            </div>
          );
        })}</div>
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Measurement form</h2><span className="count">inches</span></div>
        <MeasureView clientId={c.id} compact />
      </section>

      {prices && o.priceIncomplete && <p className="small" style={{ color: 'var(--late)', margin: 0 }}>One garment on this order has no price yet, so the total and the payment stages below leave it out. {can(me, 'editPricing') ? 'Set its stitching charge under More → Pricing rules.' : 'Ask Saptadeep to set it.'}</p>}

      {prices && <section className="sec">
        <div className="sec-h"><h2 className="h2">Payments</h2><span className="count num">{inr(paid)} of {inr(o.total)}</span></div>
        <div className="bar" aria-hidden="true"><i style={{ width: `${o.total ? Math.min(100, paid / o.total * 100) : 0}%` }} /></div>
        <div>{PAY_STAGES.map(ps => {
          // Money received fills the stages in order, however it was paid in.
          const before = PAY_STAGES.slice(0, PAY_STAGES.indexOf(ps)).reduce((t, x) => t + S.stageDue(o, x.key), 0);
          const due = S.stageDue(o, ps.key), got = Math.max(0, Math.min(due, paid - before));
          return (
            <div className="pay" key={ps.key}>
              <div><div className="item-title" style={{ fontWeight: 400 }}>{ps.label} · {ps.pct}%</div><div className="item-sub">{ps.when}</div></div>
              <div className="item-end num">{inr(due)}<div className="tiny" style={{ color: got >= due ? 'var(--ok)' : got > 0 ? 'var(--hold)' : 'var(--muted)' }}>{got >= due ? 'Received' : got > 0 ? `${inr(got)} received` : 'Not yet'}</div></div>
            </div>
          );
        })}</div>
        <div className="tiny muted">{o.imported ? 'Order value as entered, including GST.' : `Total includes GST at ${o.gstPct != null ? o.gstPct : 5}%.`}{paid < o.total ? ` Balance ${inr(o.total - paid)}.` : ''}</div>
        <div className="eyebrow" style={{ marginTop: 4 }}>Received</div>
        <PaymentList order={o} />
        <div className="row wrap">
          {can(me, 'recordPayment') && paid < o.total && <button className="btn ghost" onClick={() => app.open(<PaymentSheet order={o} />)}><Icon n="plus" />Record a payment</button>}
          {can(me, 'editOrders') && <button className="btn ghost" onClick={() => app.open(<EditOrderSheet order={o} />)}>Edit the order</button>}
        </div>
      </section>}

      {can(me, 'seeCosts') && <CostSection o={o} />}
    </div>
  );
}

function DatesSheet({ order }) {
  const app = useApp();
  const [d, setD] = useState({ ...order.dates });
  return (
    <Sheet eyebrow={order.number} title="Fitting and delivery dates"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={() => { S.updateOrder(order.id, { dates: d }); S.log(order.clientId, `${order.number} dates changed.`); app.close(); app.toast('Dates saved'); }}>Save</button></>}>
      <div className="form">
        <Field label="Trial 1"><input id="ds-1" type="date" value={d.trial1} onChange={e => setD(x => ({ ...x, trial1: e.target.value }))} /></Field>
        <Field label="Trial 2"><input id="ds-2" type="date" value={d.trial2} onChange={e => setD(x => ({ ...x, trial2: e.target.value }))} /></Field>
        <Field label="Delivery"><input id="ds-3" type="date" value={d.delivery} onChange={e => setD(x => ({ ...x, delivery: e.target.value }))} /></Field>
      </div>
    </Sheet>
  );
}
