import React, { useState } from 'react';
import { useApp, Sheet, Field, Chips, Icon } from './kit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { GARMENTS, TIERS, garment } from '../data/pricing.js';
import { orderCost, rulesOf, COST_CITIES, profitRows, exportProfit } from '../data/costs.js';
import { inr, today } from '../data/util.js';

const digits = v => String(v).replace(/[^\d]/g, '');
const dec = v => String(v).replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = k => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const pct = x => `${Math.round(x * 100)}%`;

// ---------------------------------------------------------------- on an order
export function CostSection({ o }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(o.clientId, s);
  const k = orderCost(o, s, c);
  const tag = w => (k.by[w] === 'hand' ? ' · set by hand' : '');
  const show = (v, what) => (v == null ? <span style={{ color: 'var(--late)' }}>{what}</span> : inr(v));
  return (
    <section className="card">
      <div className="row between"><div className="eyebrow">Only you see this</div><button className="link" onClick={() => app.open(<CostSheet order={o} />)}>Edit costs</button></div>
      <dl className="kv num" style={{ marginTop: 8 }}>
        <dt>Value before GST</dt><dd>{inr(k.net)}</dd>
        <dt>Cloth{tag('cloth')}</dt><dd>{show(k.cloth, 'Rate missing')}</dd>
        <dt>Stitching{tag('stitching')}</dt><dd>{show(k.stitching, `No ${k.city || 'city'} rate`)}</dd>
        <dt>Travel{tag('travel')}</dt><dd>{show(k.travel, `No ${k.city || 'city'} rate`)}</dd>
        {k.other > 0 && <><dt>Other</dt><dd>{inr(k.other)}</dd></>}
        <dt>GST to pay</dt><dd>{inr(k.gst)}</dd>
        <dt style={{ color: 'var(--fg)' }}>Profit</dt>
        <dd style={{ fontWeight: 500 }}>{inr(k.profit)} · {pct(k.margin)}{!k.complete && <div className="tiny" style={{ color: 'var(--late)', fontWeight: 400 }}>Not final: {k.missing.join(', ')} missing</div>}</dd>
      </dl>
      <div className="tiny muted" style={{ marginTop: 8 }}>
        {k.lines.map(l => `${l.label}: cloth ${l.cloth != null ? `${inr(l.cloth)} (${l.dealer || 'dealer?'} ${inr(l.rate)}/m × ${l.metres} m${l.qty > 1 ? ` × ${l.qty}` : ''})` : 'rate missing'}, stitching ${l.stitch != null ? inr(l.stitch) : '—'}`).join(' · ')}
      </div>
    </section>
  );
}

function CostSheet({ order }) {
  const app = useApp();
  const s = useStore();
  const rules = rulesOf(s);
  const c = S.clientById(order.clientId, s);
  const k0 = order.costs || {};
  const [lines, setLines] = useState(() => ({ ...(k0.lines || {}) }));
  const [over, setOver] = useState({ fabric: k0.fabric ?? '', stitching: k0.stitching ?? '', travel: k0.travel ?? '', other: k0.other || '' });
  const draft = { ...order, costs: { ...over, lines } };
  const k = orderCost(draft, s, c);
  const upLine = (id, f, v) => setLines(x => ({ ...x, [id]: { ...(x[id] || {}), [f]: v } }));
  const save = () => {
    const clean = Object.fromEntries(Object.entries(lines).filter(([, v]) => v && (v.rate !== '' && v.rate != null || v.dealer || v.metres)).map(([id, v]) => [id, {
      dealer: v.dealer || '', rate: v.rate === '' || v.rate == null ? null : +v.rate, metres: v.metres === '' || v.metres == null ? null : +v.metres }]));
    const n = v => (v === '' || v == null ? null : +v);
    S.updateOrder(order.id, { costs: { fabric: n(over.fabric), stitching: n(over.stitching), travel: n(over.travel), other: +over.other || 0, lines: clean } });
    app.close(); app.toast('Costs saved');
  };
  return (
    <Sheet size="tall" eyebrow={`${order.number} · ${c ? c.city : ''}`} title="Costs"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={save}>Save · profit {inr(k.profit)}</button></>}>
      <div className="form">
        <p className="small muted" style={{ margin: 0 }}>Cloth comes from the dealer's rate in the cloth library. For cloth that isn't listed, enter the dealer and rate here.</p>
        {k.lines.map(l => {
          const e = lines[l.item.id] || {};
          return (
            <div className="card" key={l.item.id} style={{ padding: 12 }}>
              <div className="row between"><div className="item-title">{l.label}</div><div className="num small">{l.cloth != null ? inr(l.cloth) : <span style={{ color: 'var(--late)' }}>rate missing</span>}</div></div>
              <div className="tiny muted" style={{ margin: '2px 0 8px' }}>{l.f ? `${l.f.house} · ${l.f.design}${l.f.cost && l.f.cost.rate ? ` · library rate ${inr(l.f.cost.rate)}/m` : ''}` : l.item.cloth ? `Cloth: ${l.item.cloth}` : 'Cloth not in the library'}</div>
              <Field label="Dealer"><Chips wrap value={e.dealer || l.dealer || ''} onChange={v => upLine(l.item.id, 'dealer', v)} options={rules.dealers} /></Field>
              <div className="grid2" style={{ marginTop: 8 }}>
                <Field label="Rate per metre (₹)"><input id={`cs-r-${l.item.id}`} inputMode="decimal" value={e.rate ?? ''} placeholder={l.f && l.f.cost && l.f.cost.rate ? String(l.f.cost.rate) : ''} onChange={ev => upLine(l.item.id, 'rate', dec(ev.target.value))} /></Field>
                <Field label="Metres each"><input id={`cs-m-${l.item.id}`} inputMode="decimal" value={e.metres ?? ''} placeholder={String((s.pricing.consumption || {})[l.item.garment] ?? '')} onChange={ev => upLine(l.item.id, 'metres', dec(ev.target.value))} /></Field>
              </div>
              <div className="tiny muted" style={{ marginTop: 6 }}>Stitching in {k.city || '—'}: {l.stRate != null ? `${inr(l.stRate)} each (${TIERS[l.item.tier]})` : `no rate for ${TIERS[l.item.tier] || ''} ${garment(l.item.garment).label || ''} — set it under Costs & profit`}</div>
            </div>
          );
        })}
        <section className="stack-s">
          <div className="eyebrow">Set by hand for this order</div>
          <p className="tiny muted" style={{ margin: 0 }}>Leave blank to use the rules. A figure here replaces the worked-out one.</p>
          <div className="grid2">
            <Field label="Cloth total (₹)"><input id="cs-f" inputMode="numeric" value={over.fabric} placeholder={k.by.cloth === 'rules' && k.cloth != null ? String(k.cloth) : ''} onChange={e => setOver(x => ({ ...x, fabric: digits(e.target.value) }))} /></Field>
            <Field label="Stitching total (₹)"><input id="cs-s" inputMode="numeric" value={over.stitching} placeholder={k.by.stitching === 'rules' && k.stitching != null ? String(k.stitching) : ''} onChange={e => setOver(x => ({ ...x, stitching: digits(e.target.value) }))} /></Field>
            <Field label="Travel (₹)"><input id="cs-t" inputMode="numeric" value={over.travel} placeholder={k.by.travel === 'rules' && k.travel != null ? String(k.travel) : ''} onChange={e => setOver(x => ({ ...x, travel: digits(e.target.value) }))} /></Field>
            <Field label="Other costs (₹)"><input id="cs-o" inputMode="numeric" value={over.other} placeholder="0" onChange={e => setOver(x => ({ ...x, other: digits(e.target.value) }))} /></Field>
          </div>
        </section>
        <dl className="kv num">
          <dt>Value before GST</dt><dd>{inr(k.net)}</dd>
          <dt>Costs</dt><dd>{inr(k.cost)}</dd>
          <dt style={{ color: 'var(--fg)' }}>Profit</dt><dd style={{ fontWeight: 500 }}>{inr(k.profit)} · {pct(k.margin)}</dd>
        </dl>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------- Costs & profit page
export function ProfitPage() {
  const app = useApp();
  const s = useStore();
  const rules = rulesOf(s);
  const now = today();
  const [month, setMonth] = useState(now.slice(0, 7));
  const end = m => { const [y, mm] = m.split('-').map(Number); return `${m}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`; };
  const rows = profitRows(s, `${month}-01`, end(month));
  const done = rows.filter(r => r.k.complete);
  const incomplete = rows.filter(r => !r.k.complete);
  // Profit counts only orders whose costs are all in, so it never looks better than it is.
  const sum = f => done.reduce((t, r) => t + (r.k[f] || 0), 0);
  const fyStart = +month.slice(5, 7) >= 4 ? +month.slice(0, 4) : +month.slice(0, 4) - 1;
  const [busy, setBusy] = useState(false);
  const download = async (from, to, label) => {
    setBusy(true);
    try { const n = await exportProfit(s, from, to, label); app.toast(`Excel downloaded · ${n} orders`); } catch (e) { console.error(e); app.toast("Couldn't make the Excel file"); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <header>
        <div className="eyebrow">Only you see this</div>
        <h1 className="h1" style={{ marginTop: 4 }}>Costs &amp; profit</h1>
      </header>

      <section className="card">
        <div className="row between" style={{ alignItems: 'center' }}>
          <div className="eyebrow">Profit in {monthName(month)}</div>
          <input id="pf-month" type="month" value={month} max={now.slice(0, 7)} onChange={e => e.target.value && setMonth(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <div className="sales-big num">{inr(sum('profit'))}</div>
        <div className="small">{done.length} of {rows.length} order{rows.length === 1 ? '' : 's'} · value before GST {inr(sum('net'))} · costs {inr(sum('cost'))}{sum('net') ? ` · ${pct(sum('profit') / sum('net'))}` : ''}</div>
        {incomplete.length > 0 && <div className="tiny" style={{ color: 'var(--late)', marginTop: 6 }}>{incomplete.length} order{incomplete.length === 1 ? ' is' : 's are'} missing costs and left out of this figure. Add the city rates or fill them in on each order.</div>}
        <div className="row wrap" style={{ marginTop: 12 }}>
          <button className="btn" disabled={busy} onClick={() => download(`${month}-01`, end(month), month)}><Icon n="down" />Excel for {MONTHS[+month.slice(5, 7) - 1]}</button>
          <button className="btn ghost" disabled={busy} onClick={() => download(`${fyStart}-04-01`, `${fyStart + 1}-03-31`, `FY${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`)}>Whole year {String(fyStart).slice(2)}–{String(fyStart + 1).slice(2)}</button>
        </div>
      </section>

      {rows.length > 0 && <section className="sec">
        <div className="sec-h"><h2 className="h2">Orders in {MONTHS[+month.slice(5, 7) - 1]}</h2><span className="count">{rows.length}</span></div>
        <div className="list">{rows.map(({ o, c, k }) => (
          <button className="item" key={o.id} onClick={() => app.push({ view: 'order', id: o.id })}>
            <div className="item-main">
              <div className="item-title">{c.name}</div>
              <div className="item-sub">{o.number} · {c.city} · costs {inr(k.cost)}{!k.complete ? <span style={{ color: 'var(--late)' }}> · {k.missing.join(', ')} missing</span> : ''}</div>
            </div>
            <div className="item-end num">{k.complete ? inr(k.profit) : '—'}<div className="tiny muted">{k.complete ? pct(k.margin) : 'not final'}</div></div>
          </button>
        ))}</div>
      </section>}

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Rules for each city</h2></div>
        <p className="small muted" style={{ margin: 0 }}>Stitching is what the workroom charges you for each garment and construction. Travel is one amount per order. Each order uses the rates for its client's city.</p>
        <div className="list">{COST_CITIES.map(city => {
          const st = rules.stitching[city] || {};
          const filled = Object.values(st).reduce((t, x) => t + Object.values(x || {}).filter(v => v !== '' && v != null).length, 0);
          return (
            <button className="item" key={city} onClick={() => app.open(<CityRulesSheet city={city} />)}>
              <div className="item-main">
                <div className="item-title">{city}</div>
                <div className="item-sub">Travel {rules.travel[city] != null && rules.travel[city] !== '' ? `${inr(+rules.travel[city])} per order` : 'not set'} · {filled ? `${filled} stitching rates` : 'stitching not set'}</div>
              </div>
              <Icon n="right" style={{ width: 18, height: 18, flex: 'none' }} />
            </button>
          );
        })}</div>
      </section>

      <section className="sec">
        <div className="sec-h"><h2 className="h2">Cloth dealers</h2></div>
        <p className="small muted" style={{ margin: 0 }}>Each cloth's rate per metre is set in the cloth library. Add cloths from a new dealer there.</p>
        <DealerList />
      </section>
    </div>
  );
}

function DealerList() {
  const s = useStore();
  const rules = rulesOf(s);
  const [name, setName] = useState('');
  const count = d => s.fabrics.filter(f => f.cost && f.cost.vendor === d).length;
  return (
    <div className="stack-s">
      <div className="list">{rules.dealers.map(d => (
        <div className="item" key={d}>
          <div className="item-main"><div className="item-title">{d}</div><div className="item-sub">{count(d)} cloths in the library</div></div>
          {count(d) === 0 && <button className="link" onClick={() => S.saveCostRules({ ...rules, dealers: rules.dealers.filter(x => x !== d) })}>Remove</button>}
        </div>
      ))}</div>
      <div className="row" style={{ gap: 8 }}>
        <input id="dl-new" value={name} onChange={e => setName(e.target.value)} placeholder="Add a dealer" />
        <button className="btn ghost" disabled={!name.trim() || rules.dealers.includes(name.trim())} onClick={() => { S.saveCostRules({ ...rules, dealers: [...rules.dealers, name.trim()] }); setName(''); }}>Add</button>
      </div>
    </div>
  );
}

function CityRulesSheet({ city }) {
  const app = useApp();
  const s = useStore();
  const rules = rulesOf(s);
  const [travel, setTravel] = useState(rules.travel[city] ?? '');
  const [st, setSt] = useState(() => JSON.parse(JSON.stringify(rules.stitching[city] || {})));
  const up = (tier, g, v) => setSt(x => ({ ...x, [tier]: { ...(x[tier] || {}), [g]: v === '' ? '' : +v } }));
  const copyFrom = other => setSt(JSON.parse(JSON.stringify(rules.stitching[other] || {})));
  const others = COST_CITIES.filter(c => c !== city && rules.stitching[c] && Object.keys(rules.stitching[c]).length);
  const save = () => {
    S.saveCostRules({ ...rules, travel: { ...rules.travel, [city]: travel === '' ? '' : +travel }, stitching: { ...rules.stitching, [city]: st } });
    app.close(); app.toast(`${city} rates saved`);
  };
  return (
    <Sheet size="tall" eyebrow="Costs & profit" title={city}
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={save}>Save {city}</button></>}>
      <div className="form">
        <Field label="Travel per order (₹)" hint="Flights, cabs and stay for all the visits on one order"><input id="cr-travel" inputMode="numeric" value={travel} onChange={e => setTravel(digits(e.target.value))} /></Field>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <div className="eyebrow">Stitching, per garment</div>
          {others.length > 0 && <div className="tiny">Copy from {others.map((o, i) => <React.Fragment key={o}>{i > 0 && ', '}<button type="button" className="link" onClick={() => copyFrom(o)}>{o}</button></React.Fragment>)}</div>}
        </div>
        {GARMENTS.map(g => (
          <div key={g.key} className="stack-s">
            <div className="small" style={{ fontWeight: 500 }}>{g.label}</div>
            <div className="grid2" style={{ gridTemplateColumns: `repeat(${g.tiers.length}, 1fr)` }}>
              {g.tiers.map(t => (
                <Field key={t} label={TIERS[t]}>
                  <input id={`cr-${t}-${g.key}`} inputMode="numeric" value={(st[t] || {})[g.key] ?? ''} onChange={e => up(t, g.key, digits(e.target.value))} />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------- add or change a cloth ----
export function ClothSheet({ fabric }) {
  const app = useApp();
  const s = useStore();
  const rules = rulesOf(s);
  const [v, setV] = useState({
    house: fabric ? fabric.house : '', design: fabric ? fabric.design : '', mill: fabric ? fabric.mill : '', composition: fabric ? fabric.composition : '',
    use: fabric ? fabric.use : 'suiting', dealer: fabric && fabric.cost ? fabric.cost.vendor : rules.dealers[0], rate: fabric && fabric.cost && fabric.cost.rate != null ? String(fabric.cost.rate) : ''
  });
  const up = (k, x) => setV(o => ({ ...o, [k]: x }));
  const ok = v.design.trim() && +v.rate > 0 && v.dealer;
  const save = () => {
    S.saveFabric({ ...(fabric || {}), house: v.house.trim(), design: v.design.trim(), mill: v.mill.trim() || v.dealer, composition: v.composition.trim(), use: v.use,
      cost: { ...((fabric && fabric.cost) || {}), vendor: v.dealer, rate: +v.rate, unit: 'm', currency: 'INR' } });
    app.close(); app.toast(fabric ? 'Cloth updated' : 'Cloth added');
  };
  return (
    <Sheet eyebrow="Cloth library" title={fabric ? `${fabric.house || fabric.design}` : 'Add a cloth'}
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!ok} onClick={save}>Save</button></>}>
      <div className="form">
        <Field label="Dealer"><Chips wrap value={v.dealer} onChange={x => up('dealer', x)} options={rules.dealers} /></Field>
        <div className="grid2">
          <Field label="Rate per metre (₹)" hint="What the dealer charges you"><input id="cl-rate" inputMode="decimal" value={v.rate} onChange={e => up('rate', dec(e.target.value))} /></Field>
          <Field label="House code"><input id="cl-house" value={v.house} onChange={e => up('house', e.target.value)} placeholder="e.g. TR-S-0300" /></Field>
        </div>
        <div className="grid2">
          <Field label="Design name"><input id="cl-design" value={v.design} onChange={e => up('design', e.target.value)} /></Field>
          <Field label="Mill"><input id="cl-mill" value={v.mill} onChange={e => up('mill', e.target.value)} placeholder="If not the dealer" /></Field>
        </div>
        <Field label="Composition"><input id="cl-comp" value={v.composition} onChange={e => up('composition', e.target.value)} placeholder="e.g. 100% wool, 260 gsm" /></Field>
        <Field label="Used for"><Chips value={v.use} onChange={x => up('use', x)} options={[{ key: 'suiting', label: 'Suiting' }, { key: 'shirting', label: 'Shirting' }, { key: 'coating', label: 'Coating' }]} /></Field>
        <p className="tiny muted" style={{ margin: 0 }}>The team sees the design, mill and the price in a quote, worked out with your uplift. The dealer's rate stays with you.</p>
      </div>
    </Sheet>
  );
}
