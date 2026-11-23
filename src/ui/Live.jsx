import React, { useEffect, useState, useCallback } from 'react';
import { App } from './App.jsx';
import { Field } from './kit.jsx';
import * as S from '../data/store.js';
import * as L from '../data/live.js';

const sb = L.sb;

// Signs the person in, checks they've been switched on, loads what they may
// see, and keeps it fresh while the app is open.
export function LiveRoot() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [phase, setPhase] = useState('start');       // start | waiting | loading | ready | error
  const [err, setErr] = useState('');

  useEffect(() => {
    // Supabase re-announces the session whenever the app comes back to the
    // front (switching to WhatsApp and back). Only a different person signing
    // in or out should reload — otherwise the screen you were on is kept.
    const keep = next => setSession(prev => {
      if (!next) return null;
      if (prev && prev.user && prev.user.id === next.user.id) return prev;
      return next;
    });
    sb.auth.getSession().then(({ data }) => keep(data.session || null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => keep(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const boot = useCallback(async () => {
    if (!session) return;
    setPhase('loading'); setErr('');
    try {
      const { data: p, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (error) throw error;
      if (!p || !p.active) { setProfile(p); setPhase('waiting'); return; }
      setProfile(p);
      S.connect(L, e => window.dispatchEvent(new CustomEvent('tr-save-error', { detail: e })));
      const s = await L.loadAll({ id: p.id, role: p.role });
      S.hydrate(s);
      setPhase('ready');
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e)); setPhase('error');
    }
  }, [session]);

  const uid = session ? session.user.id : session;
  useEffect(() => { if (session) boot(); else if (session === null) setPhase('start'); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the data fresh: every minute while open, and whenever the app comes back to the front.
  useEffect(() => {
    if (phase !== 'ready') return;
    const tick = () => { if (document.visibilityState === 'visible') S.refresh(); };
    const t = setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
  }, [phase]);

  if (session === undefined) return <Splash />;
  if (!session) return <SignIn />;
  if (phase === 'waiting') return <Waiting profile={profile} onRetry={boot} />;
  if (phase === 'error') return <Splash><p className="small" style={{ color: 'var(--late)' }}>Couldn't load: {err}</p><button className="btn" onClick={boot}>Try again</button><button className="btn ghost" onClick={signOut}>Sign out</button></Splash>;
  if (phase !== 'ready') return <Splash><p className="small muted">Loading your clients…</p></Splash>;
  return <App />;
}

export async function signOut() {
  await S.flushed();
  await sb.auth.signOut();
  S.hydrate({ ...S.get(), clients: [], orders: [], appointments: [], mforms: [], activity: [], tasks: [], quotes: [], users: [] });
  try { ['tr-field-preview-v4', 'tr-field-nav', 'tr-field-draft'].forEach(k => localStorage.removeItem(k)); } catch (e) { /* nothing kept */ }
  window.location.reload();
}

function Shell({ children }) {
  return (
    <div className="gate">
      <div className="gate-in">
        <div className="mark" style={{ fontSize: 26 }}>Turn &amp; River<small>Field</small></div>
        {children}
      </div>
    </div>
  );
}
function Splash({ children }) { return <Shell><div className="stack-s">{children}</div></Shell>; }

function SignIn() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const go = async e => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) setMsg(error.message === 'Invalid login credentials' ? 'That email and password don\'t match.' : error.message);
  };
  return (
    <Shell>
      <form className="stack" onSubmit={go}>
        <p className="lead" style={{ margin: 0 }}>Sign in with the email and password Saptadeep set up for you.</p>
        <Field label="Email"><input id="si-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
        <Field label="Password"><input id="si-pw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required /></Field>
        {msg && <p className="small" role="alert" style={{ color: 'var(--late)', margin: 0 }}>{msg}</p>}
        <button className="btn primary block" disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="tiny muted" style={{ margin: 0 }}>Forgot your password? Ask Saptadeep to reset it.</p>
      </form>
    </Shell>
  );
}

function Waiting({ profile, onRetry }) {
  return (
    <Shell>
      <div className="stack-s">
        <h1 className="h1" style={{ fontSize: 24 }}>Almost there</h1>
        <p className="lead" style={{ margin: 0 }}>You're signed in{profile && profile.email ? ` as ${profile.email}` : ''}, but your access hasn't been switched on yet. Ask Saptadeep to turn it on under Team and access, then tap below.</p>
        <button className="btn primary" onClick={onRetry}>Check again</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </div>
    </Shell>
  );
}

// Change your own password, from More → Account.
export async function changePassword(pw) {
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) throw error;
}

// A copy of everything this person can see, as one file.
export function downloadEverything() {
  const s = S.get();
  const out = { exportedAt: new Date().toISOString(), clients: s.clients, appointments: s.appointments, orders: s.orders, quotes: s.quotes,
    measurementForms: s.mforms.map(m => ({ ...m, photos: m.paths || [] })), activity: s.activity, tasks: s.tasks, cloth: s.fabrics, pricing: s.pricing, team: s.users };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `turn-and-river-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
