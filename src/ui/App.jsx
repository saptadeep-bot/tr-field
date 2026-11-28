import React, { useEffect } from 'react';
import { AppCtx, useAppState, Icon, Avatar, pendingDraft } from './kit.jsx';
import { RoleSheet, NewClientSheet, EditClientSheet } from './forms.jsx';
import { Today } from './Today.jsx';
import { Pipeline } from './Pipeline.jsx';
import { Clients, ClientView } from './Clients.jsx';
import { Quote } from './Quote.jsx';
import { OrdersList, OrderView } from './Orders.jsx';
import { More, Bookings, ClothLibrary, Team, Pricing, About } from './More.jsx';
import { ProfitPage } from './Profit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { ROLES, can } from '../data/catalog.js';
import { today } from '../data/util.js';

const TABS = {
  today: { label: 'Today', icon: 'today' },
  pipeline: { label: 'Pipeline', icon: 'pipe' },
  clients: { label: 'Clients', icon: 'people' },
  quote: { label: 'Quote', icon: 'quote' },
  work: { label: 'Work', icon: 'scissors' },
  more: { label: 'More', icon: 'more' }
};

export function App() {
  const app = useAppState();
  const s = useStore();
  const me = S.me(s);
  const tabs = me.role === 'tailor' ? ['work', 'more'] : ['today', 'pipeline', 'clients', 'quote', 'more'];
  const tab = tabs.includes(app.tab) ? app.tab : tabs[0];
  const top = app.stack[app.stack.length - 1];
  // The owner's home leaves out delivered and lost clients; the badge matches it.
  const due = me.role === 'tailor' ? 0 : S.followUps(me, s).filter(f => f.due <= today() && !(can(me, 'seeCosts') && ['delivered', 'lost', 'closed'].includes((S.clientById(f.clientId, s) || {}).stage))).length;
  // If the phone reloaded the app while a form was half-filled, open it again.
  useEffect(() => {
    const d = pendingDraft();
    if (d && d.kind === 'newClient' && can(me, 'editClients')) app.open(<NewClientSheet />);
    else if (d && d.kind === 'editClient' && S.clientById(d.key, s)) app.open(<EditClientSheet clientId={d.key} />);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Tapping a notification opens its client or order.
  useEffect(() => {
    const go = g => {
      const [kind, id] = String(g || '').split(':');
      if (kind === 'client' && id) app.push({ view: 'client', id });
      else if (kind === 'order' && id) app.push({ view: 'order', id });
    };
    const q = new URLSearchParams(location.search).get('go');
    if (q) { go(q); history.replaceState(null, '', location.pathname); }
    const onMsg = e => e.data && e.data.go && go(e.data.go);
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', onMsg);
    if (s.live) import('../data/push.js').then(P => import('../data/live.js').then(L => P.resync(L.db)));
    return () => { if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', onMsg); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // A change that didn't reach the database: say so, and show the saved copy again.
  useEffect(() => {
    const h = () => app.toast("That didn't save — check your signal and try again");
    window.addEventListener('tr-save-error', h);
    return () => window.removeEventListener('tr-save-error', h);
  }, [app]);

  let body;
  if (top) {
    if (top.view === 'client') body = <ClientView id={top.id} startTab={top.tab} key={top.id + (top.tab || '')} />;
    else if (top.view === 'order') body = <OrderView id={top.id} key={top.id} />;
    else if (top.view === 'bookings') body = <Bookings />;
    else if (top.view === 'orders') body = <OrdersList />;
    else if (top.view === 'cloth') body = <ClothLibrary />;
    else if (top.view === 'team') body = <Team />;
    else if (top.view === 'pricing') body = <Pricing />;
    else if (top.view === 'profit') body = can(me, 'seeCosts') ? <ProfitPage /> : null;
    else if (top.view === 'about') body = <About />;
  } else {
    body = tab === 'today' ? <Today /> : tab === 'pipeline' ? <Pipeline /> : tab === 'clients' ? <Clients /> : tab === 'quote' ? <Quote /> : tab === 'work' ? <OrdersList work /> : <More />;
  }
  let title = '';
  if (top && top.view === 'client') title = (S.clientById(top.id, s) || {}).name || '';
  if (top && top.view === 'order') title = (s.orders.find(o => o.id === top.id) || {}).number || '';

  return (
    <AppCtx.Provider value={app}>
      <div className="app">
        {!s.live && <div className="banner"><div className="banner-in"><b>Preview</b><span>Sample data — nothing here is a real client.</span><button onClick={() => app.push({ view: 'about' })}>What changes when it goes live</button></div></div>}
        <header className="top">
          <div className="top-in">
            {top ? (
              <>
                <button className="back" onClick={app.back} aria-label="Back"><Icon n="left" style={{ width: 20, height: 20 }} /></button>
                <div className="top-title">{title}</div>
              </>
            ) : <div className="mark">Turn &amp; River<small>Field</small></div>}
            <div className="spacer" />
            <button className="as" onClick={() => (s.live ? app.push({ view: 'about' }) : app.open(<RoleSheet />))} aria-label={s.live ? `Signed in as ${me.name}. Account` : `Viewing as ${me.name}. Switch`}>
              <Avatar name={me.name} /><span>{me.name} <em>· {ROLES[me.role].label}</em></span><Icon n="down" style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </header>
        <main className="main">{body}</main>
        <nav className="nav" aria-label="Main">
          <div className="nav-in">
            {tabs.map(t => (
              <button key={t} className="tab" aria-current={!top && tab === t ? 'page' : undefined} onClick={() => app.go(t)}>
                <Icon n={TABS[t].icon} /><span>{TABS[t].label}</span>
                {t === 'today' && due > 0 && <span className="dot">{due}</span>}
              </button>
            ))}
          </div>
        </nav>
        {app.sheet}
        {app.toastMsg && <div className="toast" role="status">{app.toastMsg}</div>}
      </div>
    </AppCtx.Provider>
  );
}
