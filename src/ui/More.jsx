import React, { useState } from 'react';
import { useApp, Icon, Empty, Chips, Avatar, Field, Sheet } from './kit.jsx';
import { signOut, changePassword, downloadEverything } from './Live.jsx';
import { ClothSheet } from './Profit.jsx';
import { NotifySection } from './Notify.jsx';
import { ApptRow } from './Today.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can, ROLES, CITIES } from '../data/catalog.js';
import { GARMENTS, TIERS, garment, tierLabel, priceLine, character, landedPerMetre } from '../data/pricing.js';
import { today, addDays, parse, inr, fmtLong } from '../data/util.js';

export function More() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const items = [
    can(me, 'book') && ['bookings', 'cal', 'Bookings', 'Every visit and fitting, day by day'],
    ['orders', 'box', me.role === 'tailor' ? 'All orders' : 'Orders', 'Confirmed orders through to delivery'],
    me.role !== 'tailor' && ['cloth', 'cloth', 'Cloth library', can(me, 'seeCosts') ? 'Prices and costs, from the reckoner' : 'Mill, design, character and price'],
    can(me, 'manageTeam') && ['team', 'people', 'Team and access', 'Who signs in and what they see'],
    can(me, 'editPricing') && ['pricing', 'sliders', 'Pricing rules', 'Stitching charges, cloth consumption, fees, GST'],
    can(me, 'seeCosts') && ['profit', 'box', 'Costs & profit', 'Only you: costs by city, profit per order, Excel'],
    s.live ? ['about', 'info', 'Account', 'Password, backup, sign out'] : ['about', 'info', 'About this preview', 'What is sample data, and what changes when it goes live']
  ].filter(Boolean);
  return (
    <div className="stack">
      <h1 className="h1">More</h1>
      <div className="list">
        {items.map(([v, ic, t, sub]) => (
          <button className="item" key={v} onClick={() => app.push({ view: v })}>
            <span className="iconbtn" style={{ border: 0, background: 'var(--sunk)' }}><Icon n={ic} /></span>
            <div className="item-main"><div className="item-title">{t}</div><div className="item-sub">{sub}</div></div>
            <Icon n="right" style={{ width: 18, height: 18, color: 'var(--muted)', marginTop: 8 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- bookings calendar ----------
export function Bookings() {
  const s = useStore();
  const me = S.me(s);
  const [day, setDay] = useState(today());
  const [who, setWho] = useState(me.role === 'rep' ? me.id : 'all');
  const [city, setCity] = useState('All');
  const start = (() => { const d = parse(today()); const off = (d.getDay() + 6) % 7; return addDays(today(), -off); })();
  const [weekStart, setWeekStart] = useState(start);
  let appts = S.visibleAppointments(me, s).filter(a => a.status !== 'cancelled');
  if (who !== 'all') appts = appts.filter(a => a.assignedTo === who);
  if (city !== 'All') appts = appts.filter(a => (S.clientById(a.clientId, s) || {}).city === city);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayAppts = appts.filter(a => a.date === day).sort((a, b) => (a.time < b.time ? -1 : 1));
  const people = s.users.filter(u => ['rep', 'owner'].includes(u.role));
  return (
    <div className="stack">
      <header className="stack-s">
        <div className="row between">
          <h1 className="h1">Bookings</h1>
          <div className="row" style={{ gap: 6 }}>
            <button className="iconbtn" aria-label="Previous week" onClick={() => { setWeekStart(addDays(weekStart, -7)); setDay(addDays(day, -7)); }}><Icon n="left" /></button>
            <button className="iconbtn" aria-label="Next week" onClick={() => { setWeekStart(addDays(weekStart, 7)); setDay(addDays(day, 7)); }}><Icon n="right" /></button>
          </div>
        </div>
        {me.role !== 'rep' && <Chips value={who} onChange={setWho} options={[{ key: 'all', label: 'Everyone' }, ...people.map(u => ({ key: u.id, label: u.name }))]} />}
        {can(me, 'seeAllClients') && <Chips value={city} onChange={setCity} options={['All', ...CITIES]} />}
      </header>
      <div className="week" role="group" aria-label="Week">
        {days.map(d => {
          const dt = parse(d); const n = appts.filter(a => a.date === d).length;
          return <button key={d} aria-pressed={day === d} onClick={() => setDay(d)} aria-label={`${fmtLong(d)}, ${n} visits`}>
            <small>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()]}</small><b>{dt.getDate()}</b><i className={n ? '' : 'none'} />
          </button>;
        })}
      </div>
      <div className="eyebrow">{fmtLong(day)}{day === today() ? ' · today' : ''}</div>
      {dayAppts.length ? <div className="list">{dayAppts.map(a => <ApptRow key={a.id} a={a} />)}</div> : <Empty title="Nothing booked." />}
    </div>
  );
}

// ---------- cloth library ----------
export function ClothLibrary() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const owner = can(me, 'seeCosts');
  const [g, setG] = useState('twoPiece');
  const [tier, setTier] = useState('rtw');
  const [q, setQ] = useState('');
  const gd = garment(g);
  const tierOk = gd.tiers.includes(tier) ? tier : gd.def;
  const t = q.trim().toLowerCase();
  const list = s.fabrics.filter(f => gd.uses.includes(f.use)).filter(f => !t || [f.house, f.mill, f.design, f.colour, f.composition, f.weave].join(' ').toLowerCase().includes(t))
    .map(f => ({ f, p: priceLine({ garment: g, tier: tierOk, qty: 1 }, f, s.pricing) })).sort((a, b) => (a.p.base || 0) - (b.p.base || 0));
  return (
    <div className="stack">
      <header className="stack-s">
        <h1 className="h1">Cloth library</h1>
        <p className="lead" style={{ marginTop: 0 }}>{owner ? 'Same cloth and rules as the reckoner. Prices are before 5% GST. Costs show only on your login.' : 'Price for one garment, including home service, before 5% GST.'}</p>
        <Chips value={g} onChange={setG} options={GARMENTS.map(x => ({ key: x.key, label: x.label }))} />
        <Chips value={tierOk} onChange={setTier} options={gd.tiers.map(k => ({ key: k, label: tierLabel(k) }))} />
        {owner && <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => app.open(<ClothSheet />)}><Icon n="plus" />Add a cloth</button>}
        <label className="f search"><Icon n="search" /><input id="cl-lib-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Colour, mill, design, weave" aria-label="Search cloth" /></label>
      </header>
      <div className="small muted num">Stitching for {gd.label.toLowerCase()}, {tierLabel(tierOk).toLowerCase()}: {(s.pricing.making[tierOk] || {})[g] != null ? inr(s.pricing.making[tierOk][g]) : 'not set'}</div>
      {list.length > 120 && <div className="tiny muted">Showing the first 120 of {list.length}. Search to narrow it down.</div>}
      <div>{list.slice(0, 120).map(({ f, p }) => (
        <div key={f.id} className="cloth" role={owner ? 'button' : undefined} tabIndex={owner ? 0 : undefined} onClick={owner ? () => app.open(<ClothSheet fabric={f} />) : undefined} style={owner ? { cursor: 'pointer' } : null}>
          <div style={{ minWidth: 0 }}>
            <div className="code">{f.house}{f.mill !== '—' ? ` · ${f.mill}` : ''}</div>
            <div className="nm">{f.design}</div>
            <div className="item-sub">{[f.colour, character(f)].filter(Boolean).join(" · ")}</div>
            {owner && <div className="tiny" style={{ color: 'var(--gold)' }}>{(f.cost || {}).vendor} · ex-mill {inr((f.cost || {}).rate)}/{(f.cost || {}).unit} · landed {inr(landedPerMetre(f, s.pricing))}/m</div>}
          </div>
          <div className="pr">{p.ok ? inr(p.base + p.fee) : '—'}</div>
        </div>
      ))}</div>
    </div>
  );
}

// ---------- team ----------
export function Team() {
  const s = useStore();
  const app = useApp();
  return (
    <div className="stack">
      <h1 className="h1">Team and access</h1>
      {s.live && s.users.some(u => !u.active) && <div className="card gold small">Waiting for access: {s.users.filter(u => !u.active).map(u => u.email || u.name).join(', ')}. Tap a name to choose their role and switch them on.</div>}
      <div className="list">{s.users.map(u => (
        <button className="item" key={u.id} onClick={() => s.live && u.id !== s.me && app.open(<PersonSheet id={u.id} />)} style={{ opacity: u.active === false ? 0.6 : 1 }}>
          <Avatar name={u.name} />
          <div className="item-main"><div className="item-title">{u.name}{u.id === s.me ? ' (you)' : ''}</div><div className="item-sub">{u.active === false ? 'Switched off' : ROLES[u.role].label}{u.city ? ` · ${u.city}` : ''}{s.live && u.email ? ` · ${u.email}` : ''}</div></div>
          {u.active !== false && <div className="item-end tiny muted">{S.visibleClients(u, s).length} clients</div>}
        </button>
      ))}</div>
      {s.live ? (
        <section className="card">
          <div className="eyebrow">Adding someone</div>
          <ol className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>In Supabase, open Authentication → Users → Add user → Create new user.</li>
            <li>Enter their email and a starting password, tick Auto Confirm User, and create.</li>
            <li>Come back here: they appear as switched off. Tap their name, pick the role and city, and switch them on.</li>
            <li>Send them the app link with their email and password. They can change the password under More → Account.</li>
          </ol>
        </section>
      ) : <button className="btn ghost" onClick={() => app.toast('Invites start once the app is live')}><Icon n="plus" />Invite someone</button>}
      <section className="card">
        <div className="eyebrow">What each role can see</div>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Owner</dt><dd>Everything, including cloth costs, vendor rates and profit on each order.</dd>
          <dt>Client coordinator</dt><dd>All clients and bookings, assigns reps, records payments, enters and corrects measurement forms. No costs.</dd>
          <dt>Sales & styling</dt><dd>Only clients assigned to them. Fills in the measurement form at the consultation and trials. Quotes show mill, design, cloth character, stitching and total. No costs.</dd>
          <dt>Workroom</dt><dd>Open orders with cloth, specifications, the measurement form with trial changes marked, and fitting dates. No prices, phone numbers or addresses.</dd>
        </dl>
      </section>
    </div>
  );
}

function PersonSheet({ id }) {
  const app = useApp();
  const s = useStore();
  const u = s.users.find(x => x.id === id);
  const [v, setV] = useState({ name: u.name, role: u.role, city: u.city || '', phone: u.phone || '', active: u.active !== false });
  const up = (k, x) => setV(o => ({ ...o, [k]: x }));
  return (
    <Sheet eyebrow="Team and access" title={u.email || u.name}
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!v.name.trim()} onClick={() => { S.updateUser(id, { ...v, name: v.name.trim(), phone: v.phone.trim() }); app.close(); app.toast(v.active ? `${v.name} can sign in as ${ROLES[v.role].label.toLowerCase()}` : `${v.name} is switched off`); }}>Save</button></>}>
      <Field label="Name"><input id="ps-name" value={v.name} onChange={e => up('name', e.target.value)} /></Field>
      <Field label="WhatsApp number" hint="Used to message them when you assign a lead"><input id="ps-phone" inputMode="tel" value={v.phone} onChange={e => up('phone', e.target.value)} placeholder="+91" /></Field>
      <div className="stack-s"><div className="eyebrow">Role</div><Chips wrap value={v.role} onChange={x => up('role', x)} options={Object.entries(ROLES).map(([k, r]) => ({ key: k, label: r.label }))} /></div>
      <div className="stack-s"><div className="eyebrow">City</div><Chips value={v.city} onChange={x => up('city', x)} options={CITIES} /></div>
      <div className="stack-s"><div className="eyebrow">Access</div><Chips value={v.active ? 'on' : 'off'} onChange={x => up('active', x === 'on')} options={[{ key: 'on', label: 'Can sign in' }, { key: 'off', label: 'Switched off' }]} /></div>
      <p className="tiny muted" style={{ margin: 0 }}>Switching someone off takes effect the next time their app checks in, within a minute. Reps see only the clients assigned to them.</p>
    </Sheet>
  );
}

// ---------- pricing rules ----------
export function Pricing() {
  const app = useApp();
  const s = useStore();
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(s.pricing)));
  const setMaking = (t, g, v) => setP(x => ({ ...x, making: { ...x.making, [t]: { ...x.making[t], [g]: v === '' ? null : +v } } }));
  const setCons = (g, v) => setP(x => ({ ...x, consumption: { ...x.consumption, [g]: v === '' ? null : +v } }));
  const setFee = (g, v) => setP(x => ({ ...x, convenience: { ...x.convenience, [g]: v === '' ? 0 : +v } }));
  return (
    <div className="stack">
      <header className="stack-s">
        <h1 className="h1">Pricing rules</h1>
        <p className="lead" style={{ marginTop: 0 }}>Copied from the cloth reckoner. Blank means not set yet — quotes for that garment say so instead of guessing.</p>
      </header>
      <div className="grid2">
        <Field label="Landing uplift on ex-mill (%)"><input id="pr-up" inputMode="numeric" value={p.landingUpliftPct} onChange={e => setP(x => ({ ...x, landingUpliftPct: +e.target.value.replace(/[^\d.]/g, '') || 0 }))} /></Field>
        <Field label="GST on the final price (%)"><input id="pr-gst" inputMode="numeric" value={p.gstOnPrice != null ? p.gstOnPrice : 5} onChange={e => setP(x => ({ ...x, gstOnPrice: +e.target.value.replace(/[^\d.]/g, '') || 0 }))} /></Field>
      </div>
      {GARMENTS.map(g => (
        <section className="card" key={g.key}>
          <div className="item-title">{g.label}</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <Field label="Cloth (metres)"><input id={`pr-c-${g.key}`} inputMode="decimal" value={p.consumption[g.key] ?? ''} onChange={e => setCons(g.key, e.target.value)} placeholder="not set" /></Field>
            <Field label="Home-service fee (₹)"><input id={`pr-f-${g.key}`} inputMode="numeric" value={p.convenience[g.key] ?? ''} onChange={e => setFee(g.key, e.target.value)} /></Field>
            {g.tiers.map(t => <Field key={t} label={`Stitching — ${TIERS[t]} (₹)`}><input id={`pr-m-${g.key}-${t}`} inputMode="numeric" value={(p.making[t] || {})[g.key] ?? ''} onChange={e => setMaking(t, g.key, e.target.value)} placeholder="not set" /></Field>)}
          </div>
        </section>
      ))}
      <button className="btn primary" onClick={() => { S.savePricing(p); app.toast('Pricing rules saved'); }}>Save rules</button>
    </div>
  );
}

// ---------- about the preview ----------
export function About() {
  const s = useStore();
  if (s.live) return <Account />;
  return <AboutPreview />;
}
function Account() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await changePassword(pw); setPw(''); app.toast('Password changed'); } catch (e) { app.toast(e.message || "Couldn't change the password"); }
    setBusy(false);
  };
  return (
    <div className="stack">
      <h1 className="h1">Account</h1>
      <dl className="kv"><dt>Signed in as</dt><dd>{me.name}{me.email ? ` · ${me.email}` : ''}</dd><dt>Role</dt><dd>{ROLES[me.role].label}{me.city ? ` · ${me.city}` : ''}</dd></dl>
      <NotifySection />
      <section className="sec">
        <h2 className="h2">Change your password</h2>
        <Field label="New password" hint="At least 8 characters."><input id="ac-pw" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></Field>
        <button className="btn ghost" disabled={busy || pw.length < 8} onClick={save}>Change password</button>
      </section>
      {can(me, 'manageTeam') && <section className="sec">
        <h2 className="h2">Your own copy</h2>
        <p className="small muted" style={{ margin: 0 }}>Supabase backs everything up every day. This downloads a file of every client, order, payment, measurement form and cloth, for your own records.</p>
        <button className="btn ghost" onClick={() => { downloadEverything(); app.toast('Download started'); }}>Download everything</button>
      </section>}
      <button className="btn" onClick={() => signOut()}>Sign out</button>
      <p className="tiny muted" style={{ margin: 0 }}>Turn &amp; River Field · beta</p>
    </div>
  );
}
function AboutPreview() {
  const app = useApp();
  return (
    <div className="stack">
      <h1 className="h1">About this preview</h1>
      <section className="sec">
        <h2 className="h2">What you're looking at</h2>
        <p style={{ margin: 0 }}>Every screen of the field app, working, with sample clients, orders and cloth. Prices are worked out with the reckoner's real rules (landing uplift, cloth per garment, stitching by construction, home-service fee once per order, 5% GST on the final price), but the cloth rates are invented.</p>
        <p style={{ margin: 0 }}>Changes you make are kept in this browser only, so you can try things freely.</p>
      </section>
      <section className="sec">
        <h2 className="h2">What changes when it goes live</h2>
        <dl className="kv">
          <dt>Sign-in</dt><dd>Everyone signs in as themselves with email and password, plus a PIN or fingerprint on the phone. The role switcher disappears.</dd>
          <dt>Security</dt><dd>Visibility is enforced by the database: a rep's phone never receives other reps' clients or any cost figure.</dd>
          <dt>Install</dt><dd>Opens from the home screen with its own icon, full screen, on iPhone and Android, and keeps working with a weak signal.</dd>
          <dt>Your data</dt><dd>Clients, measurements and orders imported from the Client Book; cloth and rules from the reckoner.</dd>
          <dt>Measurement forms</dt><dd>Every version kept on the server with who changed what and when; photos of the paper form stored with the client.</dd>
          <dt>TeleCRM</dt><dd>A lead marked Appointment Taken arrives here by itself, waiting to be assigned.</dd>
          <dt>Backups</dt><dd>Daily automatic backups, plus a download of everything for your own copy.</dd>
        </dl>
      </section>
      <button className="btn ghost" onClick={() => { S.resetPreview(); app.go('today'); app.toast('Sample data restored'); }}>Reset the sample data</button>
    </div>
  );
}
