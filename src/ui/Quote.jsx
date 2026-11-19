import React, { useEffect, useMemo, useState } from 'react';
import { useApp, Icon, Empty, Sheet, Field, Chips, Opt } from './kit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, PAY_METHODS } from '../data/catalog.js';
import { GARMENTS, garment, tierLabel, priceLine, priceQuote, character } from '../data/pricing.js';
import { today, addDays, inr, uid, fmtDate } from '../data/util.js';

// The quote being built survives switching tabs.
let draft = null;
function blank(clientId = '') { return { id: uid('q'), clientId, createdAt: today(), status: 'open', items: [] }; }

export function Quote() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [q, setQ] = useState(() => draft || blank());
  useEffect(() => {
    const p = app.params || {};
    if (p.quoteId) { const ex = s.quotes.find(x => x.id === p.quoteId); if (ex) setQ(JSON.parse(JSON.stringify(ex))); }
    else if (p.clientId && p.clientId !== q.clientId) setQ(q.items.length && !q.clientId ? { ...q, clientId: p.clientId } : blank(p.clientId));
  }, [app.params.at]);
  useEffect(() => { draft = q; }, [q]);

  const priced = useMemo(() => priceQuote(q.items, s.fabrics, s.pricing), [q.items, s.fabrics, s.pricing]);
  const clients = S.visibleClients(me, s).filter(c => c.stage !== 'lost');
  const client = q.clientId ? S.clientById(q.clientId, s) : null;
  const owner = can(me, 'seeCosts');
  const saved = s.quotes.some(x => x.id === q.id);

  const addItem = item => setQ(x => ({ ...x, items: [...x.items, { id: uid('i'), qty: 1, ...item }] }));
  const setItem = (id, patch) => setQ(x => ({ ...x, items: x.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeItem = id => setQ(x => ({ ...x, items: x.items.filter(i => i.id !== id) }));

  const save = () => {
    S.saveQuote({ ...q, by: q.by || me.id });
    if (client) { S.advanceStage(client.id, 'quoted'); S.log(client.id, `Quote saved — ${inr(priced.total)}.`); }
    app.toast('Quote saved to ' + (client ? client.name : 'the client'));
  };
  const copyText = () => {
    const lines = priced.lines.filter(l => l.ok).map(l => {
      const f = l.fabric;
      return `${garment(l.item.garment).label}${l.qty > 1 ? ` × ${l.qty}` : ''}, ${tierLabel(l.item.tier).toLowerCase()} — ${f.house}, ${[(f.colour || '').toLowerCase(), f.composition].filter(Boolean).join(' ')}${f.weave ? ', ' + f.weave.toLowerCase() : ''}: ${inr(l.lineTotal)}`;
    });
    const text = `${client ? client.name + ' — ' : ''}your quote from Turn & River\n\n${lines.join('\n')}\n\nSubtotal ${inr(priced.subtotal)}\nGST ${priced.gstPct}%: ${inr(priced.gst)}\nTotal ${inr(priced.total)}, including cloth, construction, fittings at home, delivery and GST.\n50% to begin, 30% at the trial, 20% on delivery.`;
    const done = () => app.toast('Copied — paste it into WhatsApp');
    try { navigator.clipboard.writeText(text).then(done, () => app.open(<CopySheet text={text} />)); } catch (e) { app.open(<CopySheet text={text} />); }
  };

  return (
    <div className="stack">
      <header className="stack-s">
        <div className="row between">
          <h1 className="h1">Quote</h1>
          {(q.items.length > 0 || q.clientId) && <button className="link" onClick={() => setQ(blank())}>Start a new one</button>}
        </div>
        <label className="f"><span>For</span>
          <select id="qt-client" value={q.clientId} onChange={e => setQ(x => ({ ...x, clientId: e.target.value }))}>
            <option value="">No client yet — just pricing</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
          </select>
        </label>
        {saved && <div className="tiny muted">Saved quote of {fmtDate(q.createdAt)}. Changes need saving again.</div>}
      </header>

      {q.items.length === 0 ? (
        <Empty title="Add the first garment.">Pick the garment, the construction and the cloth. Prices come straight from the cloth reckoner's rules.</Empty>
      ) : (
        <div>
          {priced.lines.map(l => <QuoteLine key={l.item.id} l={l} owner={owner} onQty={n => setItem(l.item.id, { qty: n })} onRemove={() => removeItem(l.item.id)} onEdit={() => app.open(<ClothPicker initial={l.item} onPick={it => setItem(l.item.id, it)} />)} />)}
          <div className="row between small num" style={{ padding: '12px 0 0' }}><span className="muted">Subtotal</span><span>{inr(priced.subtotal)}</span></div>
          <div className="row between small num" style={{ padding: '4px 0 10px' }}><span className="muted">GST {priced.gstPct}%</span><span>{inr(priced.gst)}</span></div>
          <div className="total"><span className="eyebrow">Total</span><b>{inr(priced.total)}</b></div>
          <div className="tiny muted" style={{ textAlign: 'right' }}>
            Includes cloth, construction, fittings at home, delivery and GST
          </div>
          {!priced.complete && <p className="small" style={{ color: 'var(--late)' }}>One garment has no price yet — its stitching charge or cloth consumption isn't set. {owner ? 'Set it under More → Pricing rules.' : 'Ask Saptadeep to set it.'}</p>}
          {owner && priced.complete && <OwnerSummary priced={priced} />}
        </div>
      )}

      <button className="btn ghost" onClick={() => app.open(<ClothPicker onPick={addItem} />)}><Icon n="plus" />Add a garment</button>

      {q.items.length > 0 && (
        <div className="stack-s">
          <div className="acts">
            <button className="btn ghost" onClick={copyText}>Copy for WhatsApp</button>
            <button className="btn ghost" disabled={!client} onClick={save}>Save quote</button>
          </div>
          <button className="btn primary block" disabled={!client || !priced.complete} onClick={() => { S.saveQuote({ ...q, by: q.by || me.id, status: 'ordered' }); app.open(<OrderSheet clientId={q.clientId} items={q.items} total={priced.total} onDone={() => { draft = null; setQ(blank()); }} />); }}>Confirm as an order</button>
          {!client && <div className="tiny muted" style={{ textAlign: 'center' }}>Choose the client to save the quote or confirm the order.</div>}
        </div>
      )}
    </div>
  );
}

function QuoteLine({ l, owner, onQty, onRemove, onEdit }) {
  const g = garment(l.item.garment);
  const f = l.fabric;
  const [open, setOpen] = useState(false);
  return (
    <div className="qline">
      <div style={{ minWidth: 0 }}>
        <div className="item-title">{g.label}{l.qty > 1 ? ` × ${l.qty}` : ''} <span className="muted" style={{ fontWeight: 400 }}>· {tierLabel(l.item.tier)}</span></div>
        {f && <div className="small" style={{ marginTop: 2 }}><span className="swatch" style={{ background: swatchColour(f.colour) }} />{f.house} · {f.mill !== '—' ? `${f.mill} · ` : ''}{f.design}</div>}
        {f && <div className="item-sub">{character(f)}</div>}
      </div>
      <div className="price">{l.ok ? inr(l.lineTotal) : '—'}</div>
      {l.ok && <div className="small muted num" style={{ gridColumn: '1 / -1' }}>Stitching {inr(l.stitching)}</div>}
      {!l.ok && <div className="small" style={{ gridColumn: '1 / -1', color: 'var(--late)' }}>Price not set — {l.missing} missing</div>}
      <div className="row wrap" style={{ gridColumn: '1 / -1', gap: 6, marginTop: 4 }}>
        <div className="row" style={{ gap: 0, border: '1px solid var(--rule)', borderRadius: 2 }}>
          <button className="iconbtn" style={{ border: 0 }} aria-label="One fewer" onClick={() => onQty(Math.max(1, l.qty - 1))}>−</button>
          <span className="num" style={{ minWidth: 22, textAlign: 'center' }}>{l.qty}</span>
          <button className="iconbtn" style={{ border: 0 }} aria-label="One more" onClick={() => onQty(l.qty + 1)}>+</button>
        </div>
        <button className="btn small ghost" onClick={onEdit}>Change</button>
        <button className="btn small ghost" onClick={onRemove}>Remove</button>
        {owner && l.ok && <button className="link" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Cost'}</button>}
      </div>
      {owner && open && l.ok && (
        <div className="costbox">
          <dl className="kv num">
            <dt>Stitching</dt><dd>{inr(l.stitching)}</dd>
            <dt>Cloth ex-mill</dt><dd>{inr(((f.cost || {}).rate || 0) * l.metres * l.qty)}</dd>
            <dt>Cloth in the price</dt><dd>{inr(l.cloth * l.qty)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function OwnerSummary({ priced }) {
  const exMill = priced.lines.reduce((t, l) => t + (l.ok ? (((l.fabric.cost || {}).rate || 0) * l.metres * l.qty) : 0), 0);
  const stitch = priced.lines.reduce((t, l) => t + (l.ok ? l.stitching : 0), 0);
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="eyebrow">Only you see this</div>
      <dl className="kv num" style={{ marginTop: 8 }}>
        <dt>Stitching</dt><dd>{inr(stitch)}</dd>
        <dt>Cloth ex-mill</dt><dd>{inr(exMill)}</dd>
        <dt>Cloth in the price</dt><dd>{inr(priced.clothCost)}</dd>
        <dt>GST</dt><dd>{inr(priced.gst)}</dd>
      </dl>
    </div>
  );
}

const SW = { navy: '#1f2a44', charcoal: '#3a3b3d', 'mid grey': '#7b7d80', brown: '#5b4636', camel: '#b48a5a', 'light grey': '#b9bbbd', ivory: '#ece6d6', midnight: '#151a2c', white: '#f7f7f4', 'sky blue': '#a9c4dd', 'pale pink': '#ecc9c6' };
function swatchColour(c) { return SW[String(c || '').toLowerCase()] || 'var(--sunk)'; }

// ---------- pick garment, construction and cloth ----------
export function ClothPicker({ onPick, initial }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [g, setG] = useState(initial ? initial.garment : 'twoPiece');
  const [tier, setTier] = useState(initial ? initial.tier : garment('twoPiece').def);
  const [term, setTerm] = useState('');
  const [fid, setFid] = useState(initial ? initial.fabricId : '');
  const gd = garment(g);
  const changeG = k => { setG(k); setTier(garment(k).def); setFid(''); };
  const t = term.trim().toLowerCase();
  const list = s.fabrics.filter(f => gd.uses.includes(f.use)).filter(f => !t || [f.house, f.mill, f.design, f.colour, f.composition, f.weave, f.pattern].join(' ').toLowerCase().includes(t))
    .map(f => ({ f, p: priceLine({ garment: g, tier, qty: 1 }, f, s.pricing) }))
    .sort((a, b) => ((a.p.base || 0) - (b.p.base || 0)));
  const making = (s.pricing.making[tier] || {})[g];
  return (
    <Sheet eyebrow="Add to the quote" title="Garment and cloth"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!fid} onClick={() => { onPick({ garment: g, tier, fabricId: fid }); app.close(); }}>{initial ? 'Update' : 'Add'}</button></>}>
      <div className="form">
        <Field label="Garment"><Chips wrap value={g} onChange={changeG} options={GARMENTS.map(x => ({ key: x.key, label: x.label }))} /></Field>
        <Field label="Construction"><Chips wrap value={tier} onChange={setTier} options={gd.tiers.map(k => ({ key: k, label: tierLabel(k) }))} /></Field>
        <div className="small muted num">Stitching for this: {making != null ? inr(making) : 'not set yet'}</div>
        <label className="f search"><Icon n="search" /><input id="cp-q" type="search" value={term} onChange={e => setTerm(e.target.value)} placeholder="Colour, mill, design, weave" aria-label="Search cloth" /></label>
        <div>
          {list.length ? list.slice(0, 80).map(({ f, p }) => (
            <button key={f.id} className="cloth" aria-pressed={fid === f.id} onClick={() => setFid(f.id)}>
              <div style={{ minWidth: 0 }}>
                <div className="code">{f.house}{f.mill !== '—' ? ` · ${f.mill}` : ''}</div>
                <div className="nm"><span className="swatch" style={{ background: swatchColour(f.colour) }} />{f.design}</div>
                <div className="item-sub">{[f.colour, character(f)].filter(Boolean).join(" · ")}</div>
                {can(me, 'seeCosts') && p.ok && <div className="tiny" style={{ color: 'var(--gold)' }}>Cloth ex-mill {inr(((f.cost || {}).rate || 0) * p.metres)} · in the price {inr(p.cloth)}</div>}
              </div>
              <div className="pr">{p.ok ? inr(p.base + p.fee) : '—'}</div>
            </button>
          )) : <Empty title="No cloth matches." />}
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>Prices shown are for this garment on its own, including home service, before 5% GST. On a quote with several garments the home-service fee is counted once, and GST is added on the total.</p>
      </div>
    </Sheet>
  );
}

function CopySheet({ text }) {
  return (
    <Sheet eyebrow="Copy this" title="Quote text">
      <p className="small muted" style={{ marginTop: 0 }}>This browser wouldn't copy automatically. Press and hold the text to select it.</p>
      <textarea id="cp-text" readOnly value={text} style={{ width: '100%', minHeight: 220, padding: 12, border: '1px solid var(--rule)', borderRadius: 2, background: 'var(--panel)' }} onFocus={e => e.target.select()} />
    </Sheet>
  );
}

// ---------- confirm as an order ----------
export function OrderSheet({ clientId, items, total, onDone }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const c = S.clientById(clientId, s);
  const [dates, setDates] = useState({ trial1: addDays(today(), 21), trial2: addDays(today(), 35), delivery: addDays(today(), 45) });
  const [specs, setSpecs] = useState(() => Object.fromEntries(items.map(i => [i.id, ''])));
  const [adv, setAdv] = useState(String(Math.round(total * 0.5)));
  const [method, setMethod] = useState('UPI');
  const [paidNow, setPaidNow] = useState(true);
  const confirm = () => {
    const id = S.createOrder({ clientId, by: me.id, dates, items: items.map(i => ({ ...i, specs: specs[i.id] || '' })), advance: paidNow ? { amount: +adv, method } : null });
    app.close(); onDone && onDone();
    app.go('clients'); app.push({ view: 'order', id });
    app.toast('Order confirmed');
  };
  return (
    <Sheet eyebrow={c.name} title="Confirm the order"
      foot={<><button className="btn ghost" onClick={app.close}>Back</button><button className="btn primary" onClick={confirm}>Confirm {inr(total)}</button></>}>
      <div className="form">
        <div className="eyebrow">Fittings and delivery</div>
        <div className="grid3">
          <Field label="Trial 1"><input id="os-t1" type="date" value={dates.trial1} onChange={e => setDates(d => ({ ...d, trial1: e.target.value }))} /></Field>
          <Field label="Trial 2"><input id="os-t2" type="date" value={dates.trial2} onChange={e => setDates(d => ({ ...d, trial2: e.target.value }))} /></Field>
          <Field label="Delivery"><input id="os-dl" type="date" value={dates.delivery} onChange={e => setDates(d => ({ ...d, delivery: e.target.value }))} /></Field>
        </div>
        {c.eventDate && dates.delivery > c.eventDate && <p className="small" style={{ color: 'var(--late)', margin: 0 }}>Delivery falls after his event on {fmtDate(c.eventDate)}.</p>}
        <div className="eyebrow">Specifications for the workroom</div>
        {items.map(i => {
          const f = s.fabrics.find(x => x.id === i.fabricId);
          return <Field key={i.id} label={`${garment(i.garment).label} — ${f ? f.house : ''}`}><textarea id={`os-sp-${i.id}`} value={specs[i.id]} onChange={e => setSpecs(x => ({ ...x, [i.id]: e.target.value }))} placeholder="Anything beyond the measurement form" style={{ minHeight: 64 }} /></Field>;
        })}
        <div className="eyebrow">Advance — 50%</div>
        <div className="stack-s">
          <Opt on={paidNow} onClick={() => setPaidNow(true)} title="Received now" />
          <Opt on={!paidNow} onClick={() => setPaidNow(false)} title="Not yet" sub="A follow-up to collect it is added." />
        </div>
        {paidNow && <>
          <Field label="Amount (₹)"><input id="os-adv" inputMode="numeric" value={adv} onChange={e => setAdv(e.target.value.replace(/[^\d]/g, ''))} /></Field>
          <Field label="Method"><Chips wrap value={method} onChange={setMethod} options={PAY_METHODS} /></Field>
        </>}
      </div>
    </Sheet>
  );
}
