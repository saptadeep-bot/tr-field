import React, { useEffect, useState } from 'react';
import { useApp, Icon } from './kit.jsx';
import { pushStatus, turnOn, turnOff } from '../data/push.js';
import * as L from '../data/live.js';

const HIDE = 'tr-field-notify-later';

function useStatus() {
  const [st, setSt] = useState('');
  const check = () => pushStatus().then(setSt).catch(() => setSt('unsupported'));
  useEffect(() => { check(); }, []);
  return [st, check];
}

const HELP = {
  'install-first': 'On iPhone, notifications work once the app is on your home screen: tap Share → Add to Home Screen, then open Turn & River from that icon and turn them on there.',
  blocked: 'Notifications are blocked for this app. Turn them on in your phone\'s settings (Settings → Notifications, or the site settings in Chrome), then come back.'
};

// On Today: a one-time nudge until this phone is signed up.
export function NotifyCard() {
  const app = useApp();
  const [st, check] = useStatus();
  const [later, setLater] = useState(() => { try { return +localStorage.getItem(HIDE) > Date.now(); } catch (e) { return false; } });
  const [busy, setBusy] = useState(false);
  if (!st || st === 'on' || st === 'unsupported' || later) return null;
  const snooze = () => { try { localStorage.setItem(HIDE, String(Date.now() + 3 * 86400e3)); } catch (e) { /* none */ } setLater(true); };
  const on = async () => {
    setBusy(true);
    try { await turnOn(L.db); app.toast('Notifications on for this phone'); } catch (e) { app.toast(e.message === 'blocked' ? 'Blocked in your phone settings' : "Notifications weren't turned on"); }
    setBusy(false); check();
  };
  return (
    <section className="card gold">
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <Icon n="bell" style={{ width: 20, height: 20, flex: 'none', marginTop: 2 }} />
        <div className="stack-s" style={{ flex: 1 }}>
          <div className="item-title">Get told about new leads and visits</div>
          <p className="small" style={{ margin: 0 }}>{HELP[st] || 'Turn on notifications and this phone will buzz when a lead is assigned to you or a visit is booked, moved or cancelled.'}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            {st === 'off' && <button className="btn primary small" disabled={busy} onClick={on}>Turn on notifications</button>}
            <button className="btn ghost small" onClick={snooze}>Later</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// In More → Account: status, on/off, and a test.
export function NotifySection() {
  const app = useApp();
  const [st, check] = useStatus();
  const [busy, setBusy] = useState(false);
  const run = async fn => { setBusy(true); try { await fn(); } catch (e) { app.toast(e.message === 'blocked' ? 'Blocked in your phone settings' : e.message || 'Something went wrong'); } setBusy(false); check(); };
  if (!st || st === 'unsupported') return null;
  return (
    <section className="sec">
      <h2 className="h2">Notifications on this phone</h2>
      <p className="small muted" style={{ margin: 0 }}>{st === 'on' ? 'On. Each phone you use is turned on separately.' : HELP[st] || 'Off.'}</p>
      <div className="row wrap" style={{ gap: 8 }}>
        {st === 'off' && <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await turnOn(L.db); app.toast('Notifications on'); })}>Turn on</button>}
        {st === 'on' && <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await L.db.notifyTest(); app.toast('Test sent — it should arrive in a few seconds'); })}>Send me a test</button>}
        {st === 'on' && <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await turnOff(L.db); app.toast('Notifications off for this phone'); })}>Turn off</button>}
      </div>
    </section>
  );
}
