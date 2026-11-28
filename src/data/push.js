// Phone notifications: asking permission, signing this phone up, and a test.
import { VAPID_PUBLIC_KEY, LIVE } from '../config.js';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// 'unsupported' | 'install-first' (iPhone, not opened from the home screen) | 'blocked' | 'off' | 'on'
export async function pushStatus() {
  if (!LIVE) return 'unsupported';
  if (isIOS() && !standalone()) return 'install-first';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS() ? 'install-first' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function turnOn(db) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'blocked' : 'not allowed');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const device = (navigator.userAgentData && navigator.userAgentData.platform) || (isIOS() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer');
  await db.pushSave(j.endpoint, j.keys.p256dh, j.keys.auth, device);
}

export async function turnOff(db) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) { await db.pushRemove(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
}

// Keep the server's copy of this phone fresh (browsers rotate them now and then).
export async function resync(db) {
  try { if ((await pushStatus()) === 'on') await turnOn(db); } catch (e) { /* ignore */ }
}
