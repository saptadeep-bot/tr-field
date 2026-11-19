import React, { createContext, useContext, useEffect, useState } from 'react';
import { initials } from '../data/util.js';
import { stageShort } from '../data/catalog.js';

// ---------- icons (1.6px strokes, drawn for this app) ----------
const P = {
  today: 'M4 6h16M4 6v13h16V6M8 3v5M16 3v5M8 12h3v3H8z',
  pipe: 'M4 5h16l-6 7v6l-4 2v-8z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c1.8.8 3.1 2.8 3.5 5.6',
  quote: 'M7 3h8l4 4v14H7zM15 3v4h4M10 11h6M10 15h6M10 19h3',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  chat: 'M4 20l1.4-4A8 8 0 1 1 8 19.6z',
  map: 'M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  check: 'M4 12.5l5 5L20 6.5',
  plus: 'M12 5v14M5 12h14',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 7.5L20 19M8.5 16.5L20 5',
  cloth: 'M4 5h16v14H4zM4 9h16M4 13h16M8 5v14M12 5v14M16 5v14',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01',
  box: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10',
  x: 'M6 6l12 12M18 6L6 18',
  snooze: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l3 2M5 3L2 6M19 3l3 3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  tape: 'M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  history: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2'
};
export function Icon({ n, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[n]} />
    </svg>
  );
}

// ---------- app context: navigation, sheets, toasts ----------
export const AppCtx = createContext(null);
export function useApp() { return useContext(AppCtx); }

export function useAppState() {
  const [tab, setTab] = useState('today');
  const [params, setParams] = useState({});
  const [stack, setStack] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToast] = useState('');
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toastMsg]);
  return {
    tab, params, stack, sheet, toastMsg,
    go: (t, p = {}) => { setTab(t); setParams({ ...p, at: Date.now() }); setStack([]); setSheet(null); window.scrollTo(0, 0); },
    push: v => { setStack(s => [...s, v]); window.scrollTo(0, 0); },
    back: () => { setStack(s => s.slice(0, -1)); window.scrollTo(0, 0); },
    open: el => setSheet(el),
    close: () => setSheet(null),
    toast: m => setToast(m)
  };
}

export function Sheet({ eyebrow, title, children, foot, size }) {
  const app = useApp();
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') app.close(); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  return (
    <>
      <div className="scrim" onClick={app.close} />
      <section className={'sheet' + (size ? ' ' + size : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-in">
          <div className="sheet-h">
            <div style={{ minWidth: 0 }}>
              {eyebrow && <div className="eyebrow">{eyebrow}</div>}
              <h2 className="h2">{title}</h2>
            </div>
            <button className="iconbtn" onClick={app.close} aria-label="Close"><Icon n="x" /></button>
          </div>
          {children}
          {foot && <div className="sheet-foot">{foot}</div>}
        </div>
      </section>
    </>
  );
}

export function Field({ label, hint, children, className }) {
  return <label className={'f' + (className ? ' ' + className : '')}><span>{label}</span>{children}{hint && <span className="hint">{hint}</span>}</label>;
}
export function Chips({ options, value, onChange, wrap, multi, toggle }) {
  return (
    <div className={'chips' + (wrap ? ' wrap-ok' : '')} role="group">
      {options.map(o => {
        const k = typeof o === 'string' ? o : o.key; const l = typeof o === 'string' ? o : o.label;
        const on = multi ? (value || []).includes(k) : value === k;
        return (
          <button type="button" key={k} className="chip" aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter(x => x !== k) : [...(value || []), k]) : (toggle && on ? '' : k))}>
            {l}{o.n != null && <span className="n">{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}
export function Opt({ on, onClick, title, sub }) {
  return (
    <button type="button" className="opt" aria-pressed={on} onClick={onClick}>
      <span className="ring" />
      <span><span style={{ fontWeight: 500 }}>{title}</span>{sub && <span className="item-sub" style={{ display: 'block' }}>{sub}</span>}</span>
    </button>
  );
}
export function Avatar({ name }) { return <span className="av" aria-hidden="true">{initials(name)}</span>; }
export function StagePill({ stage }) {
  const cls = stage === 'lost' ? 'pill late' : ['delivered', 'closed'].includes(stage) ? 'pill ok' : ['confirmed', 'production', 'trial1', 'trial2'].includes(stage) ? 'pill gold' : 'pill';
  return <span className={cls}>{stageShort(stage)}</span>;
}
export function Empty({ title, children }) { return <div className="empty"><b>{title}</b>{children}</div>; }
