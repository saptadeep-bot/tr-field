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
// How far away a day is, in words: "today", "tomorrow", "in 3 days", "5 days ago".
function away(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n < 0 ? `${-n} days ago` : `in ${n} days`;
}
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
// "Tomorrow · Fri 27 Nov", "In 12 days · Tue 8 Dec": always the date beside the days.
export function rel(dateStr) {
  if (!dateStr) return '';
  return `${cap(away(diffDays(dateStr, today())))} · ${fmtDate(dateStr)}`;
}
// For use mid-sentence: "tomorrow (Fri 27 Nov)", "in 12 days (Tue 8 Dec)".
export function relWord(dateStr) {
  if (!dateStr) return '';
  return `${away(diffDays(dateStr, today()))} (${fmtDate(dateStr)})`;
}
// Follow-ups: "Overdue 6d · Fri 20 Nov", "Due today", "Due in 4 days · Mon 30 Nov".
export function dueLabel(dateStr) {
  const n = diffDays(dateStr, today());
  if (n < 0) return `Overdue ${-n}d · ${fmtDate(dateStr)}`;
  if (n === 0) return `Due today · ${fmtDate(dateStr)}`;
  return `Due ${away(n)} · ${fmtDate(dateStr)}`;
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
