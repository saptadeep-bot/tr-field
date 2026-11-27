import React, { useState } from 'react';
import { Sheet, Field, Chips, Opt, Avatar, useApp, readDraft, useDraft } from './kit.jsx';
import { MeasureFormSheet } from './MeasureForm.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { SOURCES, CITIES, APPT_TYPES, OCCASIONS, BUDGETS, LOST_REASONS, PAY_METHODS, PAY_STAGES, ALL_STAGES, ROLES, can, stageLabel, apptLabel } from '../data/catalog.js';
import { today, addDays, inr, fmtDate } from '../data/util.js';

function reps(s, city) {
  return s.users.filter(u => u.active !== false && ['rep', 'owner'].includes(u.role) && (!city || u.city === city || u.role === 'owner'));
}

// ---------- new client (manual leads: WhatsApp, email, referral…) ----------
export function NewClientSheet() {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const [v, setV] = useState(() => readDraft('newClient') || { name: '', phone: '', email: '', city: me.city, address: '', source: 'whatsapp', sourceDetail: '', occasion: '', eventDate: '', budget: '', notes: '', assignedTo: me.role === 'rep' ? me.id : '', book: true, date: addDays(today(), 1), time: '11:00' });
  const up = (k, val) => setV(x => ({ ...x, [k]: val }));
  useDraft('newClient', '', v);
  const ok = v.name.trim() && v.phone.trim();
  const submit = () => {
    if (!ok) return;
    const stage = v.book ? 'booked' : 'new';
    const id = S.addClient({ name: v.name.trim(), phone: v.phone.trim(), email: v.email, city: v.city, address: v.address, source: v.source, sourceDetail: v.sourceDetail, occasion: v.occasion, eventDate: v.eventDate, budget: v.budget, notes: v.notes, assignedTo: v.assignedTo, stage });
    if (v.book) S.addAppointment({ clientId: id, type: 'consult', date: v.date, time: v.time, assignedTo: v.assignedTo || me.id });
    app.close(); app.toast(v.book ? 'Client added and consultation booked' : 'Client added');
    app.push({ view: 'client', id });
  };
  return (
    <Sheet eyebrow="Leads from WhatsApp, email, referrals" title="New client"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!ok} onClick={submit}>Save client</button></>}>
      <div className="form">
        <Field label="Name"><input id="nc-name" value={v.name} onChange={e => up('name', e.target.value)} autoComplete="off" /></Field>
        <Field label="Email"><input id="nc-email" type="email" inputMode="email" value={v.email} onChange={e => up('email', e.target.value)} autoComplete="off" /></Field>
        <div className="grid2">
          <Field label="Phone"><input id="nc-phone" inputMode="tel" value={v.phone} onChange={e => up('phone', e.target.value)} placeholder="+91" /></Field>
          <Field label="City"><select id="nc-city" value={v.city} onChange={e => up('city', e.target.value)}>{CITIES.map(c => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label="Where did he come from?">
          <Chips wrap value={v.source} onChange={x => up('source', x)} options={SOURCES.filter(x => !x.auto)} />
        </Field>
        <span className="hint tiny muted" style={{ marginTop: -8 }}>TeleCRM leads arrive by themselves once marked Appointment Taken.</span>
        {['referral', 'other', 'walkin'].includes(v.source) && <Field label={v.source === 'referral' ? 'Referred by' : 'Detail'}><input id="nc-sd" value={v.sourceDetail} onChange={e => up('sourceDetail', e.target.value)} /></Field>}
        <Field label="Address for the visit"><textarea id="nc-addr" value={v.address} onChange={e => up('address', e.target.value)} style={{ minHeight: 64 }} /></Field>
        <div className="grid2">
          <Field label="Occasion"><select id="nc-occ" value={v.occasion} onChange={e => up('occasion', e.target.value)}><option value="">—</option>{OCCASIONS.map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Event date"><input id="nc-ev" type="date" value={v.eventDate} onChange={e => up('eventDate', e.target.value)} /></Field>
        </div>
        <Field label="Budget"><select id="nc-bud" value={v.budget} onChange={e => up('budget', e.target.value)}><option value="">—</option>{BUDGETS.map(o => <option key={o}>{o}</option>)}</select></Field>
        {can(me, 'assign') && <Field label="Assign to"><select id="nc-as" value={v.assignedTo} onChange={e => up('assignedTo', e.target.value)}><option value="">Not yet</option>{reps(s, v.city).map(u => <option key={u.id} value={u.id}>{u.name} — {u.city}</option>)}</select></Field>}
        <Field label="Notes"><textarea id="nc-notes" value={v.notes} onChange={e => up('notes', e.target.value)} placeholder="What he asked for, how he found us" /></Field>
        <div className="stack-s">
          <Opt on={v.book} onClick={() => up('book', true)} title="Book the consultation now" />
          <Opt on={!v.book} onClick={() => up('book', false)} title="Save as a new lead" sub="A follow-up to call and book is created for tomorrow." />
        </div>
        {v.book && <div className="grid2">
          <Field label="Date"><input id="nc-d" type="date" value={v.date} onChange={e => up('date', e.target.value)} /></Field>
          <Field label="Time"><input id="nc-t" type="time" value={v.time} onChange={e => up('time', e.target.value)} /></Field>
        </div>}
      </div>
    </Sheet>
  );
}

// ---------- edit a client's details ----------
const EDITABLE = [['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['city', 'City'], ['address', 'Address'], ['source', 'Came from'], ['sourceDetail', 'Source detail'], ['occasion', 'Occasion'], ['eventDate', 'Event date'], ['budget', 'Budget'], ['telecrmId', 'TeleCRM id'], ['notes', 'Notes']];
export function EditClientSheet({ clientId }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const c = S.clientById(clientId, s);
  const [v, setV] = useState(() => readDraft('editClient', clientId) || Object.fromEntries(EDITABLE.map(([k]) => [k, c[k] || ''])));
  const up = (k, val) => setV(x => ({ ...x, [k]: val }));
  useDraft('editClient', clientId, v);
  const changed = EDITABLE.filter(([k]) => String(v[k] || '').trim() !== String(c[k] || '').trim());
  const ok = v.name.trim() && v.phone.trim() && changed.length > 0;
  const save = () => {
    const patch = Object.fromEntries(changed.map(([k]) => [k, typeof v[k] === 'string' ? v[k].trim() : v[k]]));
    S.updateClient(clientId, patch);
    S.log(clientId, `Details updated: ${changed.map(([, l]) => l.toLowerCase()).join(', ')}.`);
    app.close(); app.toast('Details saved');
  };
  const sources = SOURCES.filter(x => !x.auto || x.key === v.source);
  return (
    <Sheet size="tall" eyebrow={c.name} title="Edit details"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!ok} onClick={save}>{changed.length ? `Save ${changed.length} change${changed.length > 1 ? 's' : ''}` : 'Save'}</button></>}>
      <div className="form">
        <Field label="Name"><input id="ec-name" value={v.name} onChange={e => up('name', e.target.value)} autoComplete="off" /></Field>
        <div className="grid2">
          <Field label="Phone"><input id="ec-phone" inputMode="tel" value={v.phone} onChange={e => up('phone', e.target.value)} /></Field>
          <Field label="City"><select id="ec-city" value={v.city} onChange={e => up('city', e.target.value)}>{[...new Set([...CITIES, v.city].filter(Boolean))].map(x => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <Field label="Email"><input id="ec-email" type="email" inputMode="email" value={v.email} onChange={e => up('email', e.target.value)} autoComplete="off" /></Field>
        <Field label="Address"><textarea id="ec-addr" value={v.address} onChange={e => up('address', e.target.value)} style={{ minHeight: 64 }} /></Field>
        <div className="grid2">
          <Field label="Occasion"><select id="ec-occ" value={v.occasion} onChange={e => up('occasion', e.target.value)}><option value="">—</option>{[...new Set([...OCCASIONS, v.occasion].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Event date"><input id="ec-ev" type="date" value={v.eventDate} onChange={e => up('eventDate', e.target.value)} /></Field>
        </div>
        {can(me, 'seePrices') && <Field label="Budget"><select id="ec-bud" value={v.budget} onChange={e => up('budget', e.target.value)}><option value="">—</option>{[...new Set([...BUDGETS, v.budget].filter(Boolean))].map(o => <option key={o}>{o}</option>)}</select></Field>}
        <Field label="Where did he come from?"><Chips wrap value={v.source} onChange={x => up('source', x)} options={sources} /></Field>
        <Field label={v.source === 'referral' ? 'Referred by' : 'Source detail'}><input id="ec-sd" value={v.sourceDetail} onChange={e => up('sourceDetail', e.target.value)} /></Field>
        <Field label="TeleCRM id"><input id="ec-tc" value={v.telecrmId} onChange={e => up('telecrmId', e.target.value)} /></Field>
        <Field label="Notes"><textarea id="ec-notes" value={v.notes} onChange={e => up('notes', e.target.value)} /></Field>
        <p className="tiny muted" style={{ margin: 0 }}>Each change is written into the client's history with your name.</p>
      </div>
    </Sheet>
  );
}

// ---------- book a visit ----------
export function BookSheet({ clientId, type = 'consult', appt }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(clientId, s);
  const me = S.me(s);
  const [v, setV] = useState(appt ? { ...appt } : { type, date: addDays(today(), 1), time: '11:00', assignedTo: c.assignedTo || me.id, notes: '' });
  const up = (k, val) => setV(x => ({ ...x, [k]: val }));
  const save = () => {
    if (appt) { S.updateAppointment(appt.id, { date: v.date, time: v.time, type: v.type, assignedTo: v.assignedTo, notes: v.notes }); S.log(clientId, `${apptLabel(v.type)} moved to ${fmtDate(v.date)}.`); app.toast('Visit moved'); }
    else {
      S.addAppointment({ clientId, type: v.type, date: v.date, time: v.time, assignedTo: v.assignedTo, notes: v.notes });
      if (v.type === 'consult') S.advanceStage(clientId, 'booked');
      S.log(clientId, `${apptLabel(v.type)} booked for ${fmtDate(v.date)}.`);
      app.toast(`${apptLabel(v.type)} booked`);
    }
    app.close();
  };
  return (
    <Sheet eyebrow={c.name} title={appt ? 'Move the visit' : 'Book a visit'}
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={save}>{appt ? 'Save' : 'Book'}</button></>}>
      <div className="form">
        <Field label="Visit"><Chips wrap value={v.type} onChange={x => up('type', x)} options={APPT_TYPES} /></Field>
        <div className="grid2">
          <Field label="Date"><input id="bk-d" type="date" value={v.date} onChange={e => up('date', e.target.value)} /></Field>
          <Field label="Time"><input id="bk-t" type="time" value={v.time} onChange={e => up('time', e.target.value)} /></Field>
        </div>
        {can(me, 'assign') && <Field label="Who goes"><select id="bk-as" value={v.assignedTo} onChange={e => up('assignedTo', e.target.value)}>{reps(s, c.city).map(u => <option key={u.id} value={u.id}>{u.name} — {u.city}</option>)}</select></Field>}
        <Field label="Address"><input id="bk-addr" value={c.address} readOnly /></Field>
        <Field label="Note for the visit"><textarea id="bk-n" value={v.notes} onChange={e => up('notes', e.target.value)} placeholder="Bring the velvet bunch, gate code…" /></Field>
      </div>
    </Sheet>
  );
}

// ---------- after a visit ----------
export function OutcomeSheet({ appt }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(appt.clientId, s);
  const isConsult = appt.type === 'consult' || appt.type === 'measure';
  const isTrial = appt.type === 'trial1' || appt.type === 'trial2' || appt.type === 'alteration';
  const [out, setOut] = useState(isConsult ? 'quote' : isTrial ? 'good' : 'delivered');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [follow, setFollow] = useState(addDays(today(), 3));
  const order = s.orders.filter(o => o.clientId === c.id && o.status !== 'delivered')[0];
  const save = () => {
    S.updateAppointment(appt.id, { status: out === 'noshow' ? 'no-show' : 'done', notes: note });
    const label = apptLabel(appt.type);
    if (out === 'noshow') { S.log(c.id, `${label}: client not available.${note ? ' ' + note : ''}`); app.close(); app.toast('Marked as missed — rebook from the client page'); return; }
    S.log(c.id, `${label} done.${note ? ' ' + note : ''}`);
    if (isConsult) {
      if (out === 'order') { S.advanceStage(c.id, 'visited'); app.go('quote', { clientId: c.id }); app.toast('Build the order from a quote'); return; }
      if (out === 'quote') { S.setStage(c.id, 'quoted'); app.go('quote', { clientId: c.id }); app.toast('Pick the cloth and save the quote'); return; }
      if (out === 'think') S.setStage(c.id, 'visited', { followUpOn: follow });
      if (out === 'lost') S.setStage(c.id, 'lost', { lostReason: reason });
    }
    // Two fittings per order — the Turn and the River. Trial 1 always leads to trial 2;
    // a good trial 2 leads to delivery. Alterations open the measurement form.
    if (isTrial && order) {
      if (appt.type === 'trial1') {
        S.setOrderStatus(order.id, 'trial2');
        S.addTask({ clientId: c.id, title: out === 'alter' ? 'Book trial 2 once the alterations are back' : 'Book trial 2', due: addDays(today(), out === 'alter' ? 7 : 3), assignedTo: c.assignedTo });
      } else {
        S.addTask({ clientId: c.id, title: out === 'alter' ? 'Book the next fitting after alterations' : 'Book the delivery', due: addDays(today(), out === 'alter' ? 7 : 3), assignedTo: c.assignedTo });
      }
    }
    if (appt.type === 'delivery' && order) S.setOrderStatus(order.id, 'delivered');
    if (isTrial && out === 'alter') { app.open(<MeasureFormSheet clientId={c.id} reason={appt.type === 'alteration' ? 'alteration' : appt.type} />); app.toast('Visit saved — now note the adjustments'); return; }
    app.close(); app.toast('Visit saved');
  };
  return (
    <Sheet eyebrow={`${apptLabel(appt.type)} · ${c.name}`} title="How did it go?"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <div className="form">
        <div className="stack-s">
          {isConsult && <>
            <Opt on={out === 'order'} onClick={() => setOut('order')} title="He's ordering" sub="Opens the quote, then confirm it as an order." />
            <Opt on={out === 'quote'} onClick={() => setOut('quote')} title="Quote given" sub="A follow-up is set for two days from now." />
            <Opt on={out === 'think'} onClick={() => setOut('think')} title="Thinking it over" />
            <Opt on={out === 'lost'} onClick={() => setOut('lost')} title="Not going ahead" />
          </>}
          {isTrial && <>
            <Opt on={out === 'good'} onClick={() => setOut('good')} title="Fit is right" sub="Moves the order on." />
            <Opt on={out === 'alter'} onClick={() => setOut('alter')} title="Adjustments needed" sub="Opens the measurement form to note what changes." />
          </>}
          {appt.type === 'delivery' && <Opt on={out === 'delivered'} onClick={() => setOut('delivered')} title="Delivered" sub="The final 20% and a check-in a week later are added to follow-ups." />}
          <Opt on={out === 'noshow'} onClick={() => setOut('noshow')} title="Client wasn't available" />
        </div>
        {out === 'think' && <Field label="Follow up on"><input id="oc-f" type="date" value={follow} onChange={e => setFollow(e.target.value)} /></Field>}
        {out === 'lost' && <Field label="Reason"><select id="oc-r" value={reason} onChange={e => setReason(e.target.value)}>{LOST_REASONS.map(r => <option key={r}>{r}</option>)}</select></Field>}
        <Field label="Notes"><textarea id="oc-n" value={note} onChange={e => setNote(e.target.value)} placeholder="What he liked, what he pushed back on" /></Field>
        {isConsult && <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => app.open(<MeasureFormSheet clientId={c.id} reason="consult" onDone={() => app.open(<OutcomeSheet appt={appt} />)} />)}>{S.latestForm(c.id, s) ? 'Update the measurement form' : 'Fill the measurement form first'}</button>}
      </div>
    </Sheet>
  );
}

// ---------- change stage by hand ----------
export function StageSheet({ clientId }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(clientId, s);
  const [stage, setStage] = useState(c.stage);
  const [reason, setReason] = useState(c.lostReason || LOST_REASONS[0]);
  const [follow, setFollow] = useState(addDays(today(), 14));
  return (
    <Sheet eyebrow={c.name} title="Move to stage"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" onClick={() => { S.setStage(c.id, stage, stage === 'lost' ? { lostReason: reason } : stage === 'hold' ? { followUpOn: follow } : {}); app.close(); app.toast(`Moved to ${stageLabel(stage)}`); }}>Move</button></>}>
      <div className="form">
        <div className="stack-s">{ALL_STAGES.map(st => <Opt key={st.key} on={stage === st.key} onClick={() => setStage(st.key)} title={st.label} />)}</div>
        {stage === 'lost' && <Field label="Reason"><select id="st-r" value={reason} onChange={e => setReason(e.target.value)}>{LOST_REASONS.map(r => <option key={r}>{r}</option>)}</select></Field>}
        {stage === 'hold' && <Field label="Check back on"><input id="st-f" type="date" value={follow} onChange={e => setFollow(e.target.value)} /></Field>}
      </div>
    </Sheet>
  );
}

// ---------- assign ----------
export function AssignSheet({ clientId }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(clientId, s);
  const [who, setWho] = useState(c.assignedTo);
  return (
    <Sheet eyebrow={c.name} title="Assign"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!who} onClick={() => { S.assignClient(c.id, who); app.close(); app.toast(`Assigned to ${S.userName(who)}`); }}>Assign</button></>}>
      <div className="stack-s">
        {reps(s).map(u => <Opt key={u.id} on={who === u.id} onClick={() => setWho(u.id)} title={u.name} sub={`${ROLES[u.role].label} · ${u.city}${u.city === c.city ? ' · same city' : ''}`} />)}
      </div>
    </Sheet>
  );
}

// ---------- payments ----------
export function PaymentSheet({ order }) {
  const app = useApp();
  const due = PAY_STAGES.map(ps => ({ ...ps, owed: Math.max(0, S.stageDue(order, ps.key) - S.paidForStage(order, ps.key)) }));
  const first = (due.find(d => d.owed > 0) || due[0]).key;
  const [stage, setStage] = useState(first);
  const [amount, setAmount] = useState(String((due.find(d => d.key === first) || {}).owed || ''));
  const [method, setMethod] = useState('UPI');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const pick = k => { setStage(k); setAmount(String(due.find(d => d.key === k).owed || '')); };
  return (
    <Sheet eyebrow={order.number} title="Record a payment"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!(+amount > 0)} onClick={() => { S.recordPayment(order.id, { stage, amount: +amount, method, date, reference: note.trim() }); app.close(); app.toast('Payment recorded'); }}>Record {+amount > 0 ? inr(+amount) : ''}</button></>}>
      <div className="form">
        <div className="stack-s">{due.map(d => <Opt key={d.key} on={stage === d.key} onClick={() => pick(d.key)} title={`${d.label} — ${d.pct}%`} sub={d.owed > 0 ? `${inr(d.owed)} still due` : 'Paid'} />)}</div>
        <div className="grid2">
          <Field label="Amount (₹)"><input id="py-a" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} /></Field>
          <Field label="Date"><input id="py-d" type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Method"><Chips wrap value={method} onChange={setMethod} options={PAY_METHODS} /></Field>
        <Field label="Notes"><textarea id="py-n" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. UTR number, paid by his brother, part of the trial payment" style={{ minHeight: 72 }} /></Field>
      </div>
    </Sheet>
  );
}

// ---------- notes and tasks ----------
export function NoteSheet({ clientId }) {
  const app = useApp();
  const [t, setT] = useState('');
  const [task, setTask] = useState(false);
  const [due, setDue] = useState(addDays(today(), 2));
  const c = S.clientById(clientId);
  return (
    <Sheet eyebrow={c.name} title="Add a note"
      foot={<><button className="btn ghost" onClick={app.close}>Cancel</button><button className="btn primary" disabled={!t.trim()} onClick={() => { if (task) S.addTask({ clientId, title: t.trim(), due, assignedTo: c.assignedTo || S.get().me }); else S.log(clientId, t.trim()); app.close(); app.toast(task ? 'Follow-up added' : 'Note added'); }}>Save</button></>}>
      <div className="form">
        <Field label={task ? 'What needs doing' : 'Note'}><textarea id="nt-t" value={t} onChange={e => setT(e.target.value)} autoFocus /></Field>
        <div className="stack-s">
          <Opt on={!task} onClick={() => setTask(false)} title="Just a note" sub="Goes into the client's history." />
          <Opt on={task} onClick={() => setTask(true)} title="A follow-up with a date" sub="Shows up on Today when it's due." />
        </div>
        {task && <Field label="Due"><input id="nt-d" type="date" value={due} onChange={e => setDue(e.target.value)} /></Field>}
      </div>
    </Sheet>
  );
}

// ---------- preview only: switch who you are ----------
export function RoleSheet() {
  const app = useApp();
  const s = useStore();
  return (
    <Sheet eyebrow="Preview only" title="See the app as…">
      <p className="small muted" style={{ marginTop: 0 }}>In the live app everyone signs in as themselves and sees only what their role allows. Here you can switch to check each view.</p>
      <div className="stack-s">
        {s.users.map(u => (
          <button key={u.id} className="opt" aria-pressed={s.me === u.id} onClick={() => { S.setMe(u.id); app.close(); app.go(u.role === 'tailor' ? 'work' : 'today'); }}>
            <Avatar name={u.name} />
            <span><span style={{ fontWeight: 500 }}>{u.name}</span><span className="item-sub" style={{ display: 'block' }}>{ROLES[u.role].label} · {u.city}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
