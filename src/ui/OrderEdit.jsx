import React, { useState } from 'react';
import { useApp, Sheet, Field, Chips, Icon } from './kit.jsx';
import * as S from '../data/store.js';
import { ORDER_STATUS, PAY_METHODS, PAY_STAGES, can } from '../data/catalog.js';
import { GARMENTS, TIERS, garment } from '../data/pricing.js';
import { today, inr, uid, fmtDate } from '../data/util.js';

const digits = v => String(v).replace(/[^\d]/g, '');
function newLine() { return { id: uid('i'), garment: 'twoPiece', tier: 'rtw', qty: 1, cloth: '', fabricId: null, specs: '' }; }

// Garments on an order typed in by hand: type, construction, how many, which cloth.
function Lines({ items, setItems }) {
  const up = (id, k, v) => setItems(xs => xs.map(x => {
    if (x.id !== id) return x;
    const n = { ...x, [k]: v };
    if (k === 'garment') n.tier = garment(v).def; // a shirt has no canvas
    return n;
  }));
  return (
    <div className="stack-s">
      {items.map((i, n) => (
        <div className="card" key={i.id} style={{ padding: 12 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <div className="eyebrow">Garment {n + 1}</div>
            {items.length > 1 && <button type="button" className="link" onClick={() => setItems(xs => xs.filter(x => x.id !== i.id))}>Remove</button>}
          </div>
          <div className="grid2">
            <Field label="Garment">
              <select id={`oe-g-${i.id}`} value={i.garment} onChange={e => up(i.id, 'garment', e.target.value)}>
                {GARMENTS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Construction">
              <select id={`oe-t-${i.id}`} value={i.tier} onChange={e => up(i.id, 'tier', e.target.value)}>
                {garment(i.garment).tiers.map(t => <option key={t} value={t}>{TIERS[t]}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid2" style={{ marginTop: 8, gridTemplateColumns: '1fr 3fr' }}>
            <Field label="How many"><input id={`oe-q-${i.id}`} inputMode="numeric" value={i.qty} onChange={e => up(i.id, 'qty', Math.max(1, +digits(e.target.value) || 1))} /></Field>
            <Field label="Cloth"><input id={`oe-c-${i.id}`} value={i.cloth || ''} placeholder="e.g. LAI-6514/64 · Vitale Barberis" onChange={e => up(i.id, 'cloth', e.target.value)} /></Field>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => setItems(xs => [...xs, newLine()])}><Icon n="plus" />Add a garment</button>
    </div>
  );
}

// Enter an order by hand from the client's page, as in the Client Book.
export function NewOrderSheet({ clientId }) {
  const app = useApp();
  const c = S.clientById(clientId);
  const [items, setItems] = useState([newLine()]);
  const [total, setTotal] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('confirmed');
  const [trial, setTrial] = useState('');
  const [delivery, setDelivery] = useState('');
  const [paid, setPaid] = useState('');
  const [method, setMethod] = useState('UPI');
  const [payDate, setPayDate] = useState(today());
  const [notes, setNotes] = useState('');
  const ok = +total > 0 && items.length > 0;
  const save = () => {
    const id = S.addManualOrder({ clientId, items, total: +total, createdAt: date, status, dates: { trial1: trial, trial2: '', delivery },
      payment: +paid > 0 ? { amount: +paid, method, date: payDate } : null, notes: notes.trim() });
    app.close(); app.toast('Order saved'); app.push({ view: 'order', id });
  };
  return (
    <Sheet size="tall" eyebrow={c.name} title="Enter an order"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!ok} onClick={save}>Save order{+total > 0 ? ` · ${inr(+total)}` : ''}</button></>}>
      <div className="form">
        <Lines items={items} setItems={setItems} />
        <div className="grid2">
          <Field label="Order value (₹)" hint="Including GST"><input id="oe-total" inputMode="numeric" value={total} onChange={e => setTotal(digits(e.target.value))} /></Field>
          <Field label="Order date"><input id="oe-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <div className="stack-s"><div className="eyebrow">Stage</div><Chips wrap value={status} onChange={setStatus} options={ORDER_STATUS.map(x => ({ key: x.key, label: x.label }))} /></div>
        <div className="grid2">
          <Field label="Trial 1"><input id="oe-trial" type="date" value={trial} onChange={e => setTrial(e.target.value)} /></Field>
          <Field label="Delivery"><input id="oe-del" type="date" value={delivery} onChange={e => setDelivery(e.target.value)} /></Field>
        </div>
        <section className="stack-s">
          <div className="eyebrow">Payment received so far</div>
          <div className="grid2">
            <Field label="Amount (₹)"><input id="oe-paid" inputMode="numeric" value={paid} onChange={e => setPaid(digits(e.target.value))} placeholder="0" /></Field>
            <Field label="Date"><input id="oe-pdate" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></Field>
          </div>
          {+paid > 0 && <Chips wrap value={method} onChange={setMethod} options={PAY_METHODS} />}
          <p className="tiny muted" style={{ margin: 0 }}>Add more payments from the order afterwards.</p>
        </section>
        <Field label="Notes"><textarea id="oe-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything about this order" /></Field>
      </div>
    </Sheet>
  );
}

// Change an order's value, garments, date, stage or notes.
export function EditOrderSheet({ order }) {
  const app = useApp();
  const [items, setItems] = useState(order.items.map(i => ({ ...i })));
  const [total, setTotal] = useState(String(Math.round(order.total || 0)));
  const [date, setDate] = useState(order.createdAt);
  const [status, setStatus] = useState(order.status);
  const [notes, setNotes] = useState(order.notes || '');
  const save = () => {
    S.editOrder(order.id, { items, total: +total, createdAt: date, status, notes: notes.trim() });
    app.close(); app.toast('Order updated');
  };
  return (
    <Sheet size="tall" eyebrow={order.number} title="Edit the order"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!(+total > 0)} onClick={save}>Save</button></>}>
      <div className="form">
        <div className="grid2">
          <Field label="Order value (₹)" hint="Including GST"><input id="oe-total" inputMode="numeric" value={total} onChange={e => setTotal(digits(e.target.value))} /></Field>
          <Field label="Order date"><input id="oe-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        {+total !== Math.round(order.total || 0) && !order.imported && <p className="tiny muted" style={{ margin: 0 }}>The value you type is kept as it is: it won't follow later changes to cloth prices.</p>}
        <div className="stack-s"><div className="eyebrow">Stage</div><Chips wrap value={status} onChange={setStatus} options={ORDER_STATUS.map(x => ({ key: x.key, label: x.label }))} /></div>
        <Lines items={items} setItems={setItems} />
        <Field label="Notes"><textarea id="oe-notes" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}

// The payments on an order, each one tappable by the owner to correct or remove.
export function PaymentList({ order }) {
  const app = useApp();
  const me = S.me();
  const owner = can(me, 'seeCosts');
  const ps = [...(order.payments || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ps.length) return <p className="small muted" style={{ margin: 0 }}>No payments yet.</p>;
  return (
    <div className="list">{ps.map(p => (
      <button className="item" key={p.id} disabled={!owner} onClick={() => owner && app.open(<EditPaymentSheet order={order} pay={p} />)}>
        <div className="item-main">
          <div className="item-title" style={{ fontWeight: 400 }}>{fmtDate(p.date)} · {p.method || '—'}</div>
          {p.reference && <div className="item-sub">{p.reference}</div>}
        </div>
        <div className="item-end num">{inr(p.amount)}</div>
      </button>
    ))}</div>
  );
}

function EditPaymentSheet({ order, pay }) {
  const app = useApp();
  const [amount, setAmount] = useState(String(Math.round(pay.amount)));
  const [date, setDate] = useState(pay.date);
  const [method, setMethod] = useState(pay.method || 'UPI');
  const [stage, setStage] = useState(pay.stage || 'advance');
  const [reference, setReference] = useState(pay.reference || '');
  const [sure, setSure] = useState(false);
  return (
    <Sheet eyebrow={order.number} title="Payment"
      foot={<>
        <button className="btn ghost" onClick={() => { if (!sure) { setSure(true); return; } S.deletePayment(order.id, pay.id); S.log(order.clientId, `Payment of ${inr(pay.amount)} removed — ${order.number}.`); app.close(); app.toast('Payment removed'); }} style={sure ? { color: 'var(--late)' } : null}>{sure ? 'Tap again to remove' : 'Remove'}</button>
        <button className="btn primary" disabled={!(+amount > 0)} onClick={() => { S.updatePayment(order.id, pay.id, { amount: +amount, date, method, stage, reference: reference.trim() }); if (+amount !== +pay.amount) S.log(order.clientId, `Payment corrected ${inr(pay.amount)} → ${inr(+amount)} — ${order.number}.`); app.close(); app.toast('Payment updated'); }}>Save</button>
      </>}>
      <div className="form">
        <div className="grid2">
          <Field label="Amount (₹)"><input id="pe-a" inputMode="numeric" value={amount} onChange={e => setAmount(digits(e.target.value))} /></Field>
          <Field label="Date"><input id="pe-d" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Method"><Chips wrap value={method} onChange={setMethod} options={PAY_METHODS} /></Field>
        <div className="stack-s"><div className="eyebrow">Towards</div><Chips value={stage} onChange={setStage} options={PAY_STAGES.map(p => ({ key: p.key, label: p.label }))} /></div>
        <Field label="Note"><input id="pe-r" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. UTR number" /></Field>
      </div>
    </Sheet>
  );
}
