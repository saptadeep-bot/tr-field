// What each order cost, and the profit on it. Owner only: the rules and the
// per-order figures come from tables the database gives to no one else.
//
// Cloth:     dealer's rate per metre × metres × quantity. From the cloth
//            library when the garment's cloth is in it; otherwise the dealer,
//            rate and metres typed on the order.
// Stitching: the city's rate for that garment and construction × quantity.
// Travel:    one amount per order for the client's city.
// Other:     anything else, typed on the order.
// Any of cloth, stitching or travel can be set by hand on an order instead.
// Profit is on the order value without GST.
import { GARMENTS, garment } from './pricing.js';
import { CITIES } from './catalog.js';

export const DEFAULT_DEALERS = ['Echelon', 'M/S Enterprises', 'KBS', 'Valenzo'];
export function emptyRules() { return { dealers: [...DEFAULT_DEALERS], travel: {}, stitching: {} }; }
export function rulesOf(s) {
  const r = s.costRules || {};
  return { dealers: r.dealers && r.dealers.length ? r.dealers : [...DEFAULT_DEALERS], travel: r.travel || {}, stitching: r.stitching || {} };
}
export const COST_CITIES = CITIES.filter(c => c !== 'Other');

const num = v => (v === '' || v == null || !isFinite(+v) ? null : +v);

export function stitchRate(rules, city, tier, g) {
  return num(((rules.stitching[city] || {})[tier] || {})[g]);
}

export function orderCost(o, s, client) {
  const rules = rulesOf(s);
  const P = s.pricing || {};
  const k = o.costs || {};
  const entered = (k.lines || {});
  const city = (client || {}).city || '';
  const missing = [];
  const lines = (o.items || []).map(i => {
    const g = garment(i.garment);
    const qty = +i.qty || 1;
    const f = i.fabricId ? s.fabrics.find(x => x.id === i.fabricId) : null;
    const e = entered[i.id] || {};
    const libRate = f && f.cost ? num(f.cost.rate) : null;
    const rate = num(e.rate) != null ? num(e.rate) : libRate;
    const metres = num(e.metres) != null ? num(e.metres) : num((P.consumption || {})[i.garment]);
    const dealer = e.dealer || (f && f.cost ? f.cost.vendor : '') || '';
    const cloth = rate != null && metres != null ? Math.round(rate * metres * qty) : null;
    const stRate = stitchRate(rules, city, i.tier, i.garment);
    const stitch = stRate != null ? stRate * qty : null;
    return { item: i, label: `${qty > 1 ? qty + ' × ' : ''}${g.label || i.garment}`, f, dealer, rate, metres, cloth,
      clothFrom: num(e.rate) != null ? 'entered' : libRate != null ? 'library' : 'missing', stRate, stitch, qty };
  });
  const sum = (xs, key) => xs.reduce((t, x) => t + (x[key] || 0), 0);
  const autoCloth = lines.every(l => l.cloth != null) ? sum(lines, 'cloth') : null;
  const autoStitch = lines.every(l => l.stitch != null) ? sum(lines, 'stitch') : null;
  const autoTravel = num(rules.travel[city]);
  const cloth = num(k.fabric) != null ? num(k.fabric) : autoCloth;
  const stitching = num(k.stitching) != null ? num(k.stitching) : autoStitch;
  const travel = num(k.travel) != null ? num(k.travel) : autoTravel;
  const other = num(k.other) || 0;
  if (cloth == null) missing.push('cloth');
  if (stitching == null) missing.push('stitching');
  if (travel == null) missing.push('travel');
  const gstPct = o.gstPct != null ? o.gstPct : 5;
  const total = o.total || 0;
  const net = Math.round(total / (1 + gstPct / 100));
  const gst = total - net;
  const cost = (cloth || 0) + (stitching || 0) + (travel || 0) + other;
  const profit = net - cost;
  return { lines, city, cloth, stitching, travel, other, cost, total, net, gst, gstPct, profit,
    margin: net ? profit / net : 0, complete: missing.length === 0, missing,
    by: { cloth: num(k.fabric) != null ? 'hand' : 'rules', stitching: num(k.stitching) != null ? 'hand' : 'rules', travel: num(k.travel) != null ? 'hand' : 'rules' } };
}

export function monthKey(d) { return (d || '').slice(0, 7); }

// One row per order for a month (or a run of months), ready for a spreadsheet.
export function profitRows(s, from, to) {
  return s.orders
    .filter(o => o.createdAt >= from && o.createdAt <= to)
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.number < b.number ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1))
    .map(o => {
      const c = s.clients.find(x => x.id === o.clientId) || {};
      const k = orderCost(o, s, c);
      return { o, c, k };
    });
}

export async function exportProfit(s, from, to, label) {
  const XLSX = await import('xlsx');
  const rows = profitRows(s, from, to);
  const head = ['Month', 'Order date', 'Order', 'Client', 'City', 'Stage', 'Garments', 'Order value (incl. GST)', 'GST', 'Value before GST',
    'Cloth', 'Stitching', 'Travel', 'Other', 'Total cost', 'Profit', 'Margin %', 'Received so far', 'Costs complete', 'Missing'];
  const body = rows.map(({ o, c, k }) => [
    o.createdAt.slice(0, 7), o.createdAt, o.number, c.name || '', c.city || '', o.status,
    k.lines.map(l => l.label).join(', '), k.total, k.gst, k.net, k.cloth ?? '', k.stitching ?? '', k.travel ?? '', k.other,
    k.cost, k.complete ? k.profit : '', k.complete && k.net ? Math.round(k.margin * 1000) / 10 : '', (o.payments || []).reduce((t, p) => t + (+p.amount || 0), 0),
    k.complete ? 'Yes' : 'No', k.missing.join(', ')
  ]);
  const tot = (i, rs = body) => rs.reduce((t, r) => t + (+r[i] || 0), 0);
  const totals = ['', '', '', `Total · ${body.length} orders`, '', '', '', tot(7), tot(8), tot(9), tot(10), tot(11), tot(12), tot(13), tot(14), '', '', tot(17), '', ''];
  // Profit only from orders whose costs are all in, so the figure is never flattering.
  const full = body.filter(r => r[18] === 'Yes');
  const profitRow = ['', '', '', `Profit · ${full.length} of ${body.length} orders with full costs`, '', '', '', tot(7, full), tot(8, full), tot(9, full), tot(10, full), tot(11, full), tot(12, full), tot(13, full), tot(14, full), tot(15, full),
    tot(9, full) ? Math.round(tot(15, full) / tot(9, full) * 1000) / 10 : '', tot(17, full), '', ''];
  const ws = XLSX.utils.aoa_to_sheet([head, ...body, [], totals, profitRow]);
  ws['!cols'] = head.map((h, i) => ({ wch: [8, 11, 9, 22, 10, 10, 30][i] || Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  // A month-by-month summary when the export covers more than one month.
  const months = [...new Set(rows.map(r => r.o.createdAt.slice(0, 7)))];
  if (months.length > 1) {
    const sh = [['Month', 'Orders', 'Order value (incl. GST)', 'Orders with full costs', 'Their value before GST', 'Their cost', 'Profit', 'Margin %', 'Orders missing costs']];
    months.forEach(m => {
      const rs = rows.filter(r => r.o.createdAt.startsWith(m));
      const fs = rs.filter(r => r.k.complete);
      const v = rs.reduce((t, r) => t + r.k.total, 0), n = fs.reduce((t, r) => t + r.k.net, 0), c = fs.reduce((t, r) => t + r.k.cost, 0), p = fs.reduce((t, r) => t + r.k.profit, 0);
      sh.push([m, rs.length, v, fs.length, n, c, p, n ? Math.round(p / n * 1000) / 10 : '', rs.length - fs.length]);
    });
    const wsm = XLSX.utils.aoa_to_sheet(sh);
    wsm['!cols'] = sh[0].map(h => ({ wch: Math.max(10, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, wsm, 'By month');
  }
  XLSX.writeFile(wb, `turn-and-river-profit-${label}.xlsx`);
  return rows.length;
}

export { GARMENTS };
