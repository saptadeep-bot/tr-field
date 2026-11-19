import React, { useState } from 'react';
import { useApp, Chips, Empty, StagePill } from './kit.jsx';
import * as S from '../data/store.js';
import { useStore } from '../data/store.js';
import { STAGES, SIDE_STAGES, CITIES, can, stageLabel } from '../data/catalog.js';
import { today, diffDays, inr, relWord } from '../data/util.js';

// How long a client can sit in a stage before the row is flagged.
const STALE = { new: 1, booked: 7, visited: 3, quoted: 3, confirmed: 5, production: 21, trial1: 10, trial2: 10, delivered: 10 };

export function Pipeline() {
  const s = useStore();
  const me = S.me(s);
  const [group, setGroup] = useState('sales');
  const [city, setCity] = useState('All');
  const [stage, setStage] = useState('');
  let clients = S.visibleClients(me, s);
  if (city !== 'All') clients = clients.filter(c => c.city === city);
  const groups = {
    sales: STAGES.filter(x => ['new', 'booked', 'visited', 'quoted'].includes(x.key)),
    orders: STAGES.filter(x => ['confirmed', 'production', 'trial1', 'trial2', 'delivered'].includes(x.key)),
    closed: [...STAGES.filter(x => x.key === 'closed'), ...SIDE_STAGES]
  };
  const stages = groups[group];
  const inGroup = clients.filter(c => stages.some(x => x.key === c.stage));
  const shown = stage ? inGroup.filter(c => c.stage === stage) : inGroup;
  const value = shown.reduce((t, c) => t + (S.clientValue(c, s) || 0), 0);

  return (
    <div className="stack">
      <header className="stack-s">
        <h1 className="h1">Pipeline</h1>
        <Chips value={group} onChange={g => { setGroup(g); setStage(''); }} options={[
          { key: 'sales', label: 'Selling', n: clients.filter(c => groups.sales.some(x => x.key === c.stage)).length },
          { key: 'orders', label: 'In the works', n: clients.filter(c => groups.orders.some(x => x.key === c.stage)).length },
          { key: 'closed', label: 'Closed & lost', n: clients.filter(c => groups.closed.some(x => x.key === c.stage)).length }
        ]} />
        {can(me, 'seeAllClients') && <Chips value={city} onChange={setCity} options={['All', ...CITIES]} />}
      </header>

      <div className="funnel" role="group" aria-label="Stages">
        {stages.map(st => {
          const n = inGroup.filter(c => c.stage === st.key).length;
          return (
            <button key={st.key} aria-pressed={stage === st.key} onClick={() => setStage(stage === st.key ? '' : st.key)}>
              <b>{n}</b><span>{st.short}</span>
            </button>
          );
        })}
      </div>

      <div className="row between small muted">
        <span>{shown.length} client{shown.length === 1 ? '' : 's'}{stage ? ` · ${stageLabel(stage)}` : ''}</span>
        {can(me, 'seePrices') && value > 0 && <span className="num">{inr(value)} {group === 'sales' ? 'quoted' : 'in orders'}</span>}
      </div>

      {shown.length === 0 ? <Empty title="No one here.">{group === 'sales' ? 'New leads and booked consultations show here.' : 'Confirmed orders show here until delivery.'}</Empty> : (
        <div className="list">
          {stages.filter(st => !stage || st.key === stage).map(st => {
            const rows = shown.filter(c => c.stage === st.key).sort((a, b) => (a.stageSince < b.stageSince ? -1 : 1));
            if (!rows.length) return null;
            return (
              <div key={st.key}>
                {!stage && <div className="eyebrow" style={{ padding: '14px 0 4px' }}>{st.label}</div>}
                {rows.map(c => <Deal key={c.id} c={c} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Deal({ c }) {
  const app = useApp();
  const s = useStore();
  const me = S.me(s);
  const days = diffDays(today(), c.stageSince);
  const stale = days > (STALE[c.stage] ?? 99);
  const next = S.nextAppointment(c.id, s);
  const val = S.clientValue(c, s);
  const nextFu = S.followUps(me, s).find(f => f.clientId === c.id);
  const what = next && (next.type === 'consult' ? 'consultation' : next.type === 'measure' ? 'measurements' : next.type.replace('trial', 'trial '));
  return (
    <button className="deal" onClick={() => app.push({ view: 'client', id: c.id })}>
      <div className="item-main">
        <div className="row wrap" style={{ gap: 6 }}>
          <span className="item-title">{c.name}</span>
          {c.source === 'telecrm' && <span className="pill">TeleCRM</span>}
          {['lost', 'hold', 'closed'].includes(c.stage) && <StagePill stage={c.stage} />}
        </div>
        <div className="item-sub">{c.city}{me.role !== 'rep' ? ` · ${S.userName(c.assignedTo, s)}` : ''}{c.occasion ? ` · ${c.occasion}` : ''}</div>
        <div className="item-sub" style={{ color: 'var(--fg)' }}>
          {next ? `Next: ${what} ${relWord(next.date)}` : nextFu ? `Next: ${nextFu.title.toLowerCase()}` : c.stage === 'lost' ? (c.lostReason || 'Lost') : ''}
        </div>
      </div>
      <div className="item-end">
        {can(me, 'seePrices') && val ? <div className="num">{inr(val)}</div> : null}
        <div className={'age' + (stale ? ' stale' : '')}>{days === 0 ? 'today' : `${days}d in stage`}</div>
      </div>
    </button>
  );
}
