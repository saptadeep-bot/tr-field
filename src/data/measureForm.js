// The Turn & River measurement form, field for field, as on the printed sheet.
// Measurements are in inches. Each section has its fitting, style, the
// measurements, the construction choices and a note.

export const FORM = [
  {
    key: 'jacket', label: 'Jacket',
    fitting: ['Slim', 'Regular'],
    styles: ['Jacket', 'Bandgala', 'Bundi', 'Sherwani', 'Tuxedo'],
    measures: ['Jacket Length', 'Bundi Length', 'Bandgala Length', 'Sherwani Length', 'Shoulder', 'Sleeve', 'Chest', 'Waist', 'Hip', 'Neck', 'Cuff', 'Sleeve Round', 'Bicep', 'Armhole Round', 'Cross Front', 'Cross Back', 'Half Chest', 'Half Waist', 'Half Hip'],
    options: [
      ['Body Type', ['Regular', 'Low Shoulder', 'High Shoulder']],
      ['Button', ['2 Button', '1 Button', 'Double-Breasted']],
      ['Lapel', ['Notch', 'Peak', 'Shawl']],
      ['Lapel Width', ['Regular', 'Narrow', 'Broad']],
      ['Chest Pocket', ['Smiley', 'Regular', 'No Pocket']],
      ['Front Pocket', ['Straight', 'Slant', 'Ticket Pocket']],
      ['Vent', ['Side Vents', 'Single Vent', 'No Vent']],
      ['Front Cut', ['Round', 'Slant', 'Straight']],
      ['Inner Lining', ['Full Lining', 'Half Lining']],
      ['Canvas', ['Handmade', 'Fused']],
      ['Button Code', ['MOP', 'Regular']]
    ]
  },
  {
    key: 'shirt', label: 'Shirt',
    fitting: ['Slim', 'Regular'],
    styles: ['Shirt', 'Kurta', 'Shirt Kurta'],
    measures: ['Shirt Length', 'Kurta Length', 'Short Kurta Length', 'Shoulder', 'Sleeve', 'Chest', 'Waist', 'Hip', 'Neck', 'Cuff', 'Sleeve Round', 'Bicep', 'Armhole Round', 'Cross Front', 'Cross Back', 'Half Chest', 'Half Waist', 'Half Hip'],
    options: [
      ['Body Type', ['Regular', 'Low Shoulder', 'High Shoulder']],
      ['Collar', ['Box', 'Cutaway', 'Button-Down']],
      ['Mandarin', ['Wing', 'Narrow']],
      ['Cuff Type', ['1 Button', '2 Button', 'Size']],
      ['Cuff Size', ['Double Cuff', 'Narrow', 'Size']],
      ['Half Sleeve', ['Plain', 'Fold', 'Loop']],
      ['Contrast Collar', ['Inside', 'Outside Top']],
      ['Contrast Cuff', ['Inside', 'Outside']],
      ['Front', ['French', 'Polo', 'Concealed']],
      ['Front Style', ['None', 'Piping', 'C Button Patti']],
      ['Button', ['MOP', 'Regular', 'Contrast Colour']]
    ]
  },
  {
    key: 'trouser', label: 'Trouser',
    fitting: ['Slim', 'Regular'],
    styles: ['Trouser', 'Chinos', 'Pyjama', 'Churidar', 'Jeans'],
    measures: ['Trouser Length', 'Chinos Length', 'Pyjama Length', 'Churidar Length', 'Jeans Length', 'Inseam', 'Waist', 'Hip', 'Thigh', 'Knee', 'Calf', 'Bottom', 'Fork', 'U Fork', 'Across Front', 'Across Back'],
    options: [
      ['Body Type', ['Low Waist', 'Regular', 'High Waist']],
      ['Cut Belt', ['Button', 'Hook', 'French Fly']],
      ['Long Belt', ['Button', 'Hook', 'French Fly']],
      ['Back Pocket', ['2 Pockets', '1 Pocket', 'No Pocket']],
      ['Back Button', ['No', 'Yes']],
      ['Front', ['Plain', '1 Pleat', '2 Pleats']],
      ['Front Pocket', ['Cross', 'Straight', 'Jeans']],
      ['Watch Pocket', ['No', 'Yes']],
      ['Inner Lining', ['No', 'Half Lining']]
    ]
  }
];

export const REASONS = [
  { key: 'consult', label: 'Consultation' },
  { key: 'trial1', label: 'Trial 1' },
  { key: 'trial2', label: 'Trial 2' },
  { key: 'alteration', label: 'Alteration' },
  { key: 'correction', label: 'Correction' }
];
export function reasonLabel(k) { return (REASONS.find(r => r.key === k) || {}).label || k; }

export function emptySection() { return { fitting: '', style: '', m: {}, o: {}, note: '' }; }
export function emptyForm() { return { billNo: '', jacket: emptySection(), shirt: emptySection(), trouser: emptySection(), extra: [], notes: '' }; }

export function sectionFilled(sec) {
  return !!(sec && (sec.fitting || sec.style || sec.note || Object.values(sec.m || {}).some(v => String(v).trim()) || Object.values(sec.o || {}).some(Boolean)));
}

// Every field that differs between two saved versions, in form order.
export function diffForms(prev, next) {
  const out = [];
  const p = prev || emptyForm();
  const add = (section, field, a, b) => { if (String(a || '').trim() !== String(b || '').trim()) out.push({ section, field, from: a || '', to: b || '' }); };
  add('', 'Bill No.', p.billNo, next.billNo);
  FORM.forEach(s => {
    const a = p[s.key] || emptySection(), b = next[s.key] || emptySection();
    add(s.label, 'Fitting', a.fitting, b.fitting);
    add(s.label, 'Style', a.style, b.style);
    s.measures.forEach(f => add(s.label, f, (a.m || {})[f], (b.m || {})[f]));
    s.options.forEach(([f]) => add(s.label, f, (a.o || {})[f], (b.o || {})[f]));
    add(s.label, 'Note', a.note, b.note);
  });
  const ea = Object.fromEntries((p.extra || []).filter(x => x[0]).map(x => [x[0], x[1]]));
  const eb = Object.fromEntries((next.extra || []).filter(x => x[0]).map(x => [x[0], x[1]]));
  new Set([...Object.keys(ea), ...Object.keys(eb)]).forEach(k => add('Other', k, ea[k], eb[k]));
  add('', 'Customisations', p.notes, next.notes);
  return out;
}

export function changeText(c) {
  const where = !c.section || c.field.toLowerCase().startsWith(c.section.toLowerCase()) ? c.field : `${c.section} ${c.field.toLowerCase()}`;
  if (!c.from) return `${where}: ${c.to}`;
  if (!c.to) return `${where}: cleared (was ${c.from})`;
  return `${where}: ${c.from} → ${c.to}`;
}
