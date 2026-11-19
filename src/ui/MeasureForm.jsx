import React, { useMemo, useState } from 'react';
import { Sheet, Field, Chips, Icon, Empty, useApp } from './kit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { can } from '../data/catalog.js';
import { FORM, REASONS, reasonLabel, emptyForm, sectionFilled, diffForms, changeText } from '../data/measureForm.js';
import { fmtDate, fmtTime } from '../data/util.js';

const clone = x => JSON.parse(JSON.stringify(x));

// Which occasion a save most likely belongs to, from where the client is.
function guessReason(clientId, s) {
  if (!S.latestForm(clientId, s)) return 'consult';
  const c = S.clientById(clientId, s);
  if (c && c.stage === 'trial1') return 'trial1';
  if (c && c.stage === 'trial2') return 'trial2';
  return 'correction';
}

// Shrink a phone photo so the form photo is readable but light.
function shrink(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const max = 1100, k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.62));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

// ---------- fill in or adjust the form ----------
const MAX_LIVE = 6, MAX_PREVIEW = 3;
export function MeasureFormSheet({ clientId, reason, onDone }) {
  const app = useApp();
  const s = useStore();
  const c = S.clientById(clientId, s);
  const prev = S.latestForm(clientId, s);
  const order = s.orders.filter(o => o.clientId === clientId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const [form, setForm] = useState(() => {
    const f = prev ? clone(prev.form) : emptyForm();
    if (!f.billNo && order) f.billNo = order.number;
    return f;
  });
  const MAX = S.get().live ? MAX_LIVE : MAX_PREVIEW;
  const [photos, setPhotos] = useState(() => (prev ? [...(prev.photos || [])] : []));
  const [why, setWhy] = useState(reason || guessReason(clientId, s));
  const [tab, setTab] = useState(() => (FORM.find(x => sectionFilled((prev ? prev.form : {})[x.key])) || FORM[0]).key);
  const changes = useMemo(() => diffForms(prev ? prev.form : null, form), [form, prev]);
  const changedSet = useMemo(() => new Set(changes.map(x => `${x.section}|${x.field}`)), [changes]);

  const upSec = (sec, patch) => setForm(f => ({ ...f, [sec]: { ...f[sec], ...patch } }));
  const upM = (sec, k, v) => setForm(f => ({ ...f, [sec]: { ...f[sec], m: { ...f[sec].m, [k]: v.replace(/[^\d./ ]/g, '') } } }));
  const upO = (sec, k, v) => setForm(f => ({ ...f, [sec]: { ...f[sec], o: { ...f[sec].o, [k]: v } } }));

  const addPhoto = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      if (photos.length >= MAX) { app.toast(`Up to ${MAX} photos per form`); break; }
      try { const url = await shrink(file); setPhotos(p => (p.length >= MAX ? p : [...p, url])); } catch (err) { app.toast("That photo couldn't be read"); }
    }
  };
  const save = () => {
    const r = S.saveMeasureForm({ clientId, reason: why, form, photos });
    if (!r.saved) { app.toast('Nothing has changed since the last save'); return; }
    if (onDone) onDone(); else app.close();
    app.toast(prev ? `Saved — ${r.changes.length} change${r.changes.length === 1 ? '' : 's'} recorded for ${reasonLabel(why)}` : 'Measurement form saved');
  };
  const sec = FORM.find(x => x.key === tab);
  const n = prev ? changes.length : null;

  return (
    <Sheet size="tall wide" eyebrow={c.name} title={prev ? 'Measurement form' : 'Fill the measurement form'}
      foot={<><button className="btn ghost" onClick={onDone || app.close}>{onDone ? 'Back' : 'Cancel'}</button><button className="btn primary" onClick={save}>{prev ? (n ? `Save ${n} change${n === 1 ? '' : 's'}` : 'Save') : 'Save the form'}</button></>}>
      <div className="form">
        <Field label="This is for">
          <Chips wrap value={why} onChange={setWhy} options={REASONS} />
        </Field>
        {prev && <p className="tiny muted" style={{ margin: '-6px 0 0' }}>Change only what was adjusted. The last version (v{prev.v}, {reasonLabel(prev.reason)}, {fmtDate(prev.date)}) stays in the history.</p>}
        <div className="grid2">
          <Field label="Bill No."><input id="mf-bill" value={form.billNo} onChange={e => setForm(f => ({ ...f, billNo: e.target.value }))} /></Field>
          <div />
        </div>

        <nav className="seg" aria-label="Form sections">
          {[...FORM.map(x => [x.key, x.label, sectionFilled(form[x.key])]), ['other', 'Notes & photos', !!(form.notes || photos.length || (form.extra || []).length)]].map(([k, l, filled]) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}{filled ? ' ·' : ''}</button>
          ))}
        </nav>

        {sec && <div className="stack">
          <div className="grid2">
            <Field label={`${sec.label} fitting`}><Chips wrap toggle value={form[sec.key].fitting} onChange={v => upSec(sec.key, { fitting: v })} options={sec.fitting} /></Field>
            <Field label="Style"><Chips wrap toggle value={form[sec.key].style} onChange={v => upSec(sec.key, { style: v })} options={sec.styles} /></Field>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Measurements · inches</div>
            <div className="mgrid">
              {sec.measures.map(m => {
                const was = prev ? ((prev.form[sec.key] || {}).m || {})[m] : '';
                const ch = prev && changedSet.has(`${sec.label}|${m}`);
                return (
                  <Field key={m} label={m} className={ch ? 'changed' : ''} hint={ch && was ? `was ${was}` : null}>
                    <input id={`mf-${sec.key}-${m.replace(/\s/g, '')}`} inputMode="decimal" value={form[sec.key].m[m] || ''} onChange={e => upM(sec.key, m, e.target.value)} />
                  </Field>
                );
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Construction</div>
            {sec.options.map(([label, opts]) => (
              <div key={label} className={'optrow' + (prev && changedSet.has(`${sec.label}|${label}`) ? ' changed' : '')}>
                <span>{label}</span>
                <Chips toggle value={form[sec.key].o[label] || ''} onChange={v => upO(sec.key, label, v)} options={opts} />
              </div>
            ))}
          </div>
          <Field label={`${sec.label} note`}><textarea id={`mf-${sec.key}-note`} value={form[sec.key].note} onChange={e => upSec(sec.key, { note: e.target.value })} placeholder="Anything the cutter should know for this garment" /></Field>
        </div>}

        {tab === 'other' && <div className="stack">
          <Field label="Other customisations" hint="Monograms, lining colour, button choice, piping, anything agreed that the form doesn't cover.">
            <textarea id="mf-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div className="stack-s">
            <div className="eyebrow">Other measurements</div>
            {(form.extra || []).map((l, i) => (
              <div className="mline" key={i}>
                <input id={`mf-x-${i}-a`} value={l[0]} onChange={e => setForm(f => ({ ...f, extra: f.extra.map((x, k) => (k === i ? [e.target.value, x[1]] : x)) }))} placeholder="e.g. Waistcoat length" aria-label="Measurement name" />
                <input id={`mf-x-${i}-b`} value={l[1]} inputMode="decimal" onChange={e => setForm(f => ({ ...f, extra: f.extra.map((x, k) => (k === i ? [x[0], e.target.value] : x)) }))} placeholder="in" aria-label="Inches" />
                <button type="button" className="iconbtn" aria-label="Remove line" onClick={() => setForm(f => ({ ...f, extra: f.extra.filter((_, k) => k !== i) }))}><Icon n="x" /></button>
              </div>
            ))}
            <button type="button" className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setForm(f => ({ ...f, extra: [...(f.extra || []), ['', '']] }))}><Icon n="plus" />Add a line</button>
          </div>
          <div className="stack-s">
            <div className="eyebrow">Photos of the paper form</div>
            <div className="photos">
              {photos.map((p, i) => (
                <figure key={i}><img src={p} alt={`Form photo ${i + 1}`} /><button type="button" aria-label="Remove photo" onClick={() => setPhotos(ps => ps.filter((_, k) => k !== i))}><Icon n="x" /></button></figure>
              ))}
              {photos.length < MAX && <label><Icon n="camera" />Add photo<input type="file" accept="image/*" multiple onChange={addPhoto} style={{ display: 'none' }} /></label>}
            </div>
            <p className="tiny muted" style={{ margin: 0 }}>{S.get().live ? 'The coordinator can type the form in from these later. Photos are kept privately with the client.' : 'The coordinator can type the form in from these later. In the live app photos are stored with the client; this preview keeps up to three.'}</p>
          </div>
        </div>}
      </div>
    </Sheet>
  );
}

// ---------- the form as it stands, with the latest changes marked ----------
export function MeasureView({ clientId, compact }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const versions = S.formVersions(clientId, s);
  const latest = versions[versions.length - 1];
  const editable = can(me, 'editMeasure');
  if (!latest) {
    return (
      <div className="stack-s">
        <Empty title="No measurement form yet.">The rep fills it in at the consultation, or the coordinator types it in later from the photos.</Empty>
        {editable && <button className="btn primary" onClick={() => app.open(<MeasureFormSheet clientId={clientId} />)}><Icon n="tape" />Fill the measurement form</button>}
      </div>
    );
  }
  const f = latest.form;
  const changed = new Map((latest.changes || []).map(x => [`${x.section}|${x.field}`, x]));
  return (
    <div className="stack">
      <div className="row between wrap" style={{ gap: 8 }}>
        <div>
          <div className="item-title">Version {latest.v} · {reasonLabel(latest.reason)}</div>
          <div className="item-sub">{fmtDate(latest.date)}, {fmtTime(latest.time)} · {S.userName(latest.by, s)}{f.billNo ? ` · Bill ${f.billNo}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {versions.length > 1 && <button className="btn small ghost" onClick={() => app.open(<HistorySheet clientId={clientId} />)}><Icon n="history" />History · {versions.length}</button>}
          {editable && <button className="btn small" onClick={() => app.open(<MeasureFormSheet clientId={clientId} />)}><Icon n="edit" />{compact ? 'Adjust' : 'Edit or adjust'}</button>}
        </div>
      </div>
      {changed.size > 0 && <div className="row wrap" style={{ gap: 6 }}><span className="pill chg">{changed.size} changed at {reasonLabel(latest.reason)}</span><span className="tiny muted">Marked below with the previous figure.</span></div>}

      {FORM.filter(sec => sectionFilled(f[sec.key])).map(sec => {
        const d = f[sec.key];
        const ms = sec.measures.filter(m => String(d.m[m] || '').trim());
        const os = sec.options.filter(([l]) => d.o[l]);
        return (
          <section className="formsec" key={sec.key}>
            <div className="head"><span className="h2" style={{ fontSize: 20 }}>{sec.label}</span><span className="small muted">{[d.fitting, d.style].filter(Boolean).join(' · ')}</span></div>
            <div className="body">
              {ms.length > 0 && <div className="mread">{ms.map(m => {
                const ch = changed.get(`${sec.label}|${m}`);
                return <div key={m} className={ch ? 'changed' : ''}><span>{m}</span><span>{d.m[m]}{ch && ch.from && <span className="was">was {ch.from}</span>}</span></div>;
              })}</div>}
              {os.length > 0 && <dl className="kv small">{os.map(([l]) => {
                const ch = changed.get(`${sec.label}|${l}`);
                return <React.Fragment key={l}><dt>{l}</dt><dd style={ch ? { color: 'var(--chg)' } : null}>{d.o[l]}{ch && ch.from ? ` (was ${ch.from})` : ''}</dd></React.Fragment>;
              })}</dl>}
              {d.note && <div className="small" style={{ borderLeft: '2px solid var(--gold)', paddingLeft: 10 }}>{d.note}</div>}
            </div>
          </section>
        );
      })}
      {(f.extra || []).filter(x => x[0]).length > 0 && <section className="formsec"><div className="head"><span className="h2" style={{ fontSize: 20 }}>Other measurements</span></div><div className="body"><div className="mread">{f.extra.filter(x => x[0]).map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}</div></div></section>}
      {f.notes && <div className="card"><div className="eyebrow">Other customisations</div><p style={{ margin: '6px 0 0' }}>{f.notes}</p></div>}
      {(latest.photos || []).length > 0 && <div className="stack-s"><div className="eyebrow">Photos of the paper form</div><div className="photos">{latest.photos.map((p, i) => <figure key={i}><a href={p} target="_blank" rel="noreferrer"><img src={p} alt={`Form photo ${i + 1}`} /></a></figure>)}</div></div>}
    </div>
  );
}

export function HistorySheet({ clientId }) {
  const s = useStore();
  const c = S.clientById(clientId, s);
  const versions = [...S.formVersions(clientId, s)].reverse();
  return (
    <Sheet eyebrow={c.name} title="Measurement history">
      <p className="small muted" style={{ marginTop: 0 }}>Every save is kept. Earlier versions can't be changed.</p>
      <div>{versions.map(v => (
        <div className="ver" key={v.id}>
          <div className="row between wrap"><span className="item-title">v{v.v} · {reasonLabel(v.reason)}</span><span className="tiny muted">{fmtDate(v.date)}, {fmtTime(v.time)} · {S.userName(v.by, s)}</span></div>
          {v.v === 1 ? <div className="item-sub">First entry — {FORM.filter(x => sectionFilled(v.form[x.key])).map(x => x.label.toLowerCase()).join(', ') || 'notes only'}{(v.photos || []).length ? ` · ${v.photos.length} photo${v.photos.length > 1 ? 's' : ''}` : ''}</div>
            : (v.changes || []).length ? <ul>{v.changes.map((ch, i) => <li key={i}>{changeText(ch)}</li>)}</ul>
            : <div className="item-sub">Photos updated</div>}
        </div>
      ))}</div>
    </Sheet>
  );
}
