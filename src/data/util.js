// Dates are stored as local YYYY-MM-DD strings; times as HH:MM.
export function iso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function today() { return iso(new Date()); }
export function nowTime() { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
export function addDays(dateStr, n) {
  const d = parse(dateStr); d.setDate(d.getDate() + n); return iso(d);
}
export function dayOffset(n) { return addDays(today(), n); }
export function parse(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / 86400000); }
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = parse(dateStr);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}
export function fmtLong(dateStr) {
  const d = parse(dateStr);
  return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MON_LONG[d.getMonth()]}`;
}
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')} ${ap}` : `${hh} ${ap}`;
}
export function rel(dateStr) {
  const n = diffDays(dateStr, today());
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return `In ${n} days`;
  return fmtDate(dateStr);
}
// "today", "in 3 days", or "on Thu 3 Dec" — for use mid-sentence.
export function relWord(dateStr) {
  const n = diffDays(dateStr, today());
  return Math.abs(n) < 7 ? rel(dateStr).toLowerCase() : 'on ' + fmtDate(dateStr);
}
export function dueLabel(dateStr) {
  const n = diffDays(dateStr, today());
  if (n < 0) return `Overdue ${-n}d`;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Tomorrow';
  return fmtDate(dateStr);
}
export function inr(n) {
  if (n == null || !isFinite(n)) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
export function uid(p = 'x') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
export function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}
export function digits(phone) { return String(phone || '').replace(/\D/g, ''); }
