// Pricing engine — the same rules as the Cloth Reckoner:
// garment price = landed cloth per metre × metres for the garment + stitching charge,
// with the convenience (home-service) fee charged once per order,
// then GST added on the final price.
// Landed per metre = ex-mill rate × currency × (1 + landing uplift %).

export const GARMENTS = [
  { key: 'twoPiece', label: 'Two-piece', uses: ['suiting'], tiers: ['rtw', 'half', 'full'], def: 'rtw' },
  { key: 'threePiece', label: 'Three-piece', uses: ['suiting'], tiers: ['rtw', 'half', 'full'], def: 'rtw' },
  { key: 'jacket', label: 'Jacket', uses: ['suiting', 'coating'], tiers: ['rtw', 'half', 'full'], def: 'rtw' },
  { key: 'bandhgala', label: 'Bandhgala two-piece', uses: ['suiting'], tiers: ['rtw', 'half', 'full'], def: 'rtw' },
  { key: 'nehru', label: 'Nehru jacket', uses: ['suiting'], tiers: ['std'], def: 'std' },
  { key: 'overcoat', label: 'Overcoat', uses: ['coating', 'suiting'], tiers: ['rtw', 'half', 'full'], def: 'rtw' },
  { key: 'trouser', label: 'Trouser', uses: ['suiting'], tiers: ['std', 'prem'], def: 'std' },
  { key: 'shirt', label: 'Shirt', uses: ['shirting'], tiers: ['std', 'prem'], def: 'std' }
];
// "rtw" is kept as the internal key so the reckoner's rules map across; it is called Fused.
export const TIERS = { rtw: 'Fused', half: 'Half canvas', full: 'Full canvas', std: 'Standard', prem: 'Premium' };
export function garment(key) { return GARMENTS.find(g => g.key === key) || GARMENTS[0]; }
export function tierLabel(k) { return TIERS[k] || k; }

export const DEFAULT_PRICING = {
  fx: { INR: 1, EUR: 100, GBP: 116, USD: 87 },
  landingUpliftPct: 70,
  gstOnPrice: 5,
  consumption: { twoPiece: 4.0, threePiece: 4.5, jacket: 2.4, overcoat: 3.9, trouser: 1.6, shirt: 2.2, bandhgala: 4.0, nehru: 1.5 },
  making: {
    rtw: { twoPiece: 13000, threePiece: 15000, jacket: 8000, overcoat: 9000, bandhgala: 13000 },
    half: { twoPiece: 25000, threePiece: 32000, jacket: 15000, overcoat: 17000, bandhgala: 25000 },
    full: { twoPiece: 40000, threePiece: 45000, jacket: 25000, overcoat: 28000, bandhgala: 40000 },
    std: { trouser: 2500, shirt: 2000, nehru: 2500 },
    prem: { trouser: 6000, shirt: 6000 }
  },
  convenience: { twoPiece: 1500, threePiece: 1500, jacket: 1500, overcoat: 1500, trouser: 1500, shirt: 500, bandhgala: 1500, nehru: 1500 }
};

function num(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }

// The cloth price per metre that goes into a quote. The owner's copy has the
// ex-mill rate and works it out (so a changed uplift shows at once); everyone
// else gets the figure the database worked out, and never sees the rate.
export function landedPerMetre(fabric, P) {
  const c = fabric.cost || {};
  const rate = num(c.rate);
  if (rate == null || !P.fx) return num(fabric.pricePerM);
  const perM = c.unit === 'yd' ? rate / 0.9144 : rate;
  const uplift = num(c.uplift) ?? P.landingUpliftPct;
  return Math.round(perM * (P.fx[c.currency || 'INR'] || 1) * (1 + uplift / 100) * 100) / 100;
}

// Price one garment line. Returns null pieces when a rule is not set yet,
// so the screen can say "price not set" instead of inventing one.
export function priceLine(item, fabric, P) {
  const g = garment(item.garment);
  const metres = num(P.consumption[g.key]);
  const making = num((P.making[item.tier] || {})[g.key]);
  const perM = fabric ? landedPerMetre(fabric, P) : null;
  const fee = num(P.convenience[g.key]) || 0;
  const qty = Math.max(1, parseInt(item.qty || 1, 10));
  if (metres == null || making == null || perM == null) {
    return { ok: false, missing: metres == null ? 'cloth consumption' : making == null ? 'stitching charge' : 'cloth rate', qty, fee };
  }
  const cloth = perM * metres;
  return { ok: true, perM, metres, cloth, making, fee, qty, base: Math.round(cloth + making) };
}

// Price a whole quote. The convenience fee is charged once and folded into the
// highest-priced line, so the lines add up to the subtotal and the fee never
// shows as its own line. GST is then added on the subtotal.
export function priceQuote(items, fabrics, P) {
  const lines = items.map(it => ({ item: it, fabric: fabrics.find(f => f.id === it.fabricId), ...priceLine(it, fabrics.find(f => f.id === it.fabricId), P) }));
  const okLines = lines.filter(l => l.ok);
  const fee = okLines.reduce((m, l) => Math.max(m, l.fee), 0);
  let top = -1, topVal = -1;
  okLines.forEach(l => { const v = l.base * l.qty; if (v > topVal) { topVal = v; top = lines.indexOf(l); } });
  lines.forEach((l, i) => {
    if (!l.ok) return;
    l.unit = l.base;
    l.lineTotal = l.base * l.qty + (i === top ? fee : 0);
    l.stitching = l.making * l.qty;
    l.feeHere = i === top ? fee : 0;
  });
  const subtotal = okLines.reduce((s, l) => s + l.lineTotal, 0);
  const gstPct = P.gstOnPrice != null ? +P.gstOnPrice : 5;
  const gst = Math.round(subtotal * gstPct / 100);
  const clothCost = okLines.reduce((s, l) => s + l.cloth * l.qty, 0);
  return { lines, fee, subtotal, gstPct, gst, total: subtotal + gst, clothCost, complete: okLines.length === lines.length && lines.length > 0 };
}

export function character(f) {
  return [f.composition, f.weight ? f.weight + ' gsm' : '', f.weave, f.pattern && f.pattern !== 'Plain' ? f.pattern : ''].filter(Boolean).join(' · ');
}
