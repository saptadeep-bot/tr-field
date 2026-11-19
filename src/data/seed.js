import { dayOffset as d } from './util.js';
import { DEFAULT_PRICING } from './pricing.js';
import { emptyForm, diffForms } from './measureForm.js';

// Sample data for the preview. Names, numbers and prices are invented.
export function seed() {
  const users = [
    { id: 'u-sap', name: 'Saptadeep', role: 'owner', city: 'Bangalore', phone: '' },
    { id: 'u-ana', name: 'Ananya', role: 'coordinator', city: 'Bangalore', phone: '' },
    { id: 'u-roh', name: 'Rohit', role: 'rep', city: 'Delhi', phone: '' },
    { id: 'u-kar', name: 'Karan', role: 'rep', city: 'Bangalore', phone: '' },
    { id: 'u-wrk', name: 'Delhi workroom', role: 'tailor', city: 'Delhi', phone: '' }
  ];

  const fabrics = [
    f('f01', 'TR-S101', 'Valenzo', 'Gatsby 412', 'Navy', '100% wool, Super 120s', 260, 'Twill', 'Plain', 'suiting', 1450),
    f('f02', 'TR-S102', 'Valenzo', 'Gatsby 418', 'Charcoal', '100% wool, Super 120s', 260, 'Twill', 'Chalk stripe', 'suiting', 1520),
    f('f03', 'TR-S115', 'Echelon', 'Como 07', 'Mid grey', '100% wool, Super 130s', 240, 'Plain weave', 'Plain', 'suiting', 2100),
    f('f04', 'TR-S120', 'Echelon', 'Laine 22', 'Brown', 'Wool 98%, elastane 2%', 280, 'Twill', 'Pinstripe', 'suiting', 1680),
    f('f05', 'TR-S131', 'Echelon', 'Melange 03', 'Camel', 'Wool 70%, cashmere 30%', 300, 'Twill', 'Plain', 'coating', 3400),
    f('f06', 'TR-S140', '—', 'Monte Napoleone', 'Navy', '100% wool, Super 150s', 230, 'Birdseye', 'Plain', 'suiting', 4200),
    f('f07', 'TR-S141', '—', 'Milan Superlight', 'Light grey', '100% wool, Super 140s', 210, 'Fresco', 'Plain', 'suiting', 3600),
    f('f08', 'TR-S144', '—', 'Irish Weaves', 'Ivory', 'Linen 100%', 250, 'Plain weave', 'Plain', 'suiting', 1900),
    f('f09', 'TR-S150', '—', 'Velluto DLX', 'Midnight', 'Cotton velvet', 320, 'Velvet', 'Plain', 'suiting', 2600),
    f('f10', 'TR-H201', 'Echelon', 'Refined Cotton 11', 'White', '100% cotton, 2-ply 100s', 110, 'Poplin', 'Plain', 'shirting', 780),
    f('f11', 'TR-H205', 'Echelon', 'Artisan Linen 04', 'Sky blue', '100% linen', 140, 'Plain weave', 'Plain', 'shirting', 920),
    f('f12', 'TR-H210', 'Echelon', 'Glacial Bamboo 02', 'Pale pink', 'Bamboo 70%, cotton 30%', 120, 'Twill', 'Plain', 'shirting', 860)
  ];

  const clients = [
    c('c01', 'Arjun Mehra', '98100 11223', 'Delhi', 'Golf Links, New Delhi', 'telecrm', 'Wedding — own', d(48), '₹2–5 lakh', 'u-roh', 'booked', d(-1), 'TC-48211', 'Groom. Wants a navy three-piece for the reception and a bandhgala for the sangeet.'),
    c('c02', 'Vikram Rao', '98450 33441', 'Bangalore', 'Indiranagar, Bangalore', 'telecrm', 'Work', '', '₹50,000–1,00,000', 'u-kar', 'quoted', d(-3), 'TC-48190', 'Partner at a law firm. Two business suits; prefers half canvas.'),
    c('c03', 'Siddharth Iyer', '99860 77120', 'Bangalore', 'Koramangala 5th Block, Bangalore', 'referral', 'Reception', d(26), '₹1–2 lakh', 'u-kar', 'trial1', d(-6), '', 'Referred by Vikram Rao.'),
    c('c04', 'Kabir Malhotra', '98112 66590', 'Delhi', 'Vasant Vihar, New Delhi', 'whatsapp', 'Wedding — guest', d(34), '₹1–2 lakh', 'u-roh', 'production', d(-9), '', 'Messaged on WhatsApp after seeing the reception post.'),
    c('c05', 'Rahul Bansal', '98730 55012', 'Delhi', 'Sector 42, Gurugram', 'telecrm', 'Festive', '', 'Not discussed', 'u-roh', 'booked', d(0), 'TC-48233', ''),
    c('c06', 'Aditya Shetty', '99000 21876', 'Bangalore', 'Whitefield, Bangalore', 'email', 'Black tie', d(60), '₹2–5 lakh', 'u-kar', 'new', d(-1), '', 'Emailed asking about a velvet dinner jacket.'),
    c('c07', 'Nikhil Kapoor', '98111 40981', 'Delhi', 'Defence Colony, New Delhi', 'instagram', 'Work', '', '₹50,000–1,00,000', 'u-roh', 'visited', d(-4), '', 'Liked the charcoal chalk stripe. Thinking it over.'),
    c('c08', 'Pranav Desai', '98200 88731', 'Mumbai', 'Bandra West, Mumbai', 'repeat', 'Work', '', '₹1–2 lakh', 'u-sap', 'delivered', d(-8), '', 'Second order. Very particular about trouser break.'),
    c('c09', 'Ishaan Verma', '98101 32007', 'Delhi', 'Greater Kailash II, New Delhi', 'telecrm', 'Wedding — own', d(90), '₹2–5 lakh', 'u-roh', 'confirmed', d(-2), 'TC-48102', ''),
    c('c10', 'Manav Gupta', '98450 90812', 'Bangalore', 'HSR Layout, Bangalore', 'website', 'Work', '', 'Under ₹50,000', 'u-kar', 'lost', d(-12), '', ''),
    c('c11', 'Dev Khanna', '98111 02234', 'Delhi', 'Shanti Niketan, New Delhi', 'referral', 'Reception', d(19), '₹1–2 lakh', 'u-roh', 'trial2', d(-2), '', 'Jacket sleeve pitch needs correcting.'),
    c('c12', 'Rohan Pillai', '99001 45566', 'Bangalore', 'Sadashivanagar, Bangalore', 'telecrm', 'Wedding — guest', d(40), '₹1–2 lakh', '', 'new', d(0), 'TC-48240', 'Marked Appointment Taken in TeleCRM — needs a rep and a slot.')
  ];
  clients.find(x => x.id === 'c10').lostReason = 'Budget Issues';
  clients.find(x => x.id === 'c03').sourceDetail = 'Vikram Rao';
  clients.find(x => x.id === 'c11').sourceDetail = 'Pranav Desai';

  const appointments = [
    a('a01', 'c01', 'consult', d(0), '11:00', 'u-roh', 'scheduled'),
    a('a02', 'c05', 'consult', d(0), '16:30', 'u-roh', 'scheduled'),
    a('a03', 'c03', 'trial1', d(0), '18:00', 'u-kar', 'scheduled'),
    a('a04', 'c11', 'trial2', d(1), '12:00', 'u-roh', 'scheduled'),
    a('a05', 'c06', 'consult', d(2), '17:00', 'u-kar', 'scheduled'),
    a('a06', 'c09', 'measure', d(3), '11:30', 'u-roh', 'scheduled'),
    a('a07', 'c02', 'consult', d(-3), '19:00', 'u-kar', 'done'),
    a('a08', 'c07', 'consult', d(-4), '18:30', 'u-roh', 'done'),
    a('a09', 'c08', 'delivery', d(-8), '10:00', 'u-sap', 'done'),
    a('a10', 'c04', 'measure', d(-12), '12:00', 'u-roh', 'done'),
    a('a11', 'c09', 'consult', d(-5), '15:00', 'u-roh', 'done'),
    a('a12', 'c04', 'trial1', d(6), '12:30', 'u-roh', 'scheduled')
  ];

  const quotes = [
    { id: 'q01', clientId: 'c02', createdAt: d(-3), by: 'u-kar', status: 'open', items: [
      { id: 'i1', garment: 'twoPiece', tier: 'half', fabricId: 'f03', qty: 1 },
      { id: 'i2', garment: 'twoPiece', tier: 'half', fabricId: 'f02', qty: 1 }
    ] },
    { id: 'q02', clientId: 'c07', createdAt: d(-4), by: 'u-roh', status: 'open', items: [
      { id: 'i1', garment: 'twoPiece', tier: 'full', fabricId: 'f02', qty: 1 },
      { id: 'i2', garment: 'shirt', tier: 'std', fabricId: 'f10', qty: 2 }
    ] }
  ];

  const orders = [
    o('o07', 'TR-0007', 'c08', d(-40), 'delivered', 'u-sap',
      [{ id: 'i1', garment: 'twoPiece', tier: 'full', fabricId: 'f06', qty: 1, specs: 'Peak lapel 9 cm, two button, side vents, slight break' }],
      { trial1: d(-20), trial2: '', delivery: d(-8) },
      [p('advance', 50, d(-40), 'Bank transfer'), p('trial', 30, d(-20), 'UPI')],
      { fabric: 16800, stitching: 22000, logistics: 1800, delivery: 600 }),
    o('o08', 'TR-0008', 'c03', d(-21), 'trial1', 'u-kar',
      [{ id: 'i1', garment: 'threePiece', tier: 'half', fabricId: 'f01', qty: 1, specs: 'Notch lapel 8.5 cm, single vent, waistcoat with lapels' }],
      { trial1: d(0), trial2: d(9), delivery: d(18) },
      [p('advance', 50, d(-21), 'UPI')],
      { fabric: 6500, stitching: 14000, logistics: 1200, delivery: 0 }),
    o('o09', 'TR-0009', 'c04', d(-10), 'production', 'u-roh',
      [{ id: 'i1', garment: 'jacket', tier: 'full', fabricId: 'f09', qty: 1, specs: 'Shawl collar in self, one button, jetted pockets' },
       { id: 'i2', garment: 'trouser', tier: 'prem', fabricId: 'f01', qty: 1, specs: 'Flat front, side adjusters, no break' }],
      { trial1: d(6), trial2: d(14), delivery: d(24) },
      [p('advance', 50, d(-10), 'Card')],
      { fabric: 7600, stitching: 17000, logistics: 1000, delivery: 0 }),
    o('o10', 'TR-0010', 'c11', d(-28), 'trial2', 'u-roh',
      [{ id: 'i1', garment: 'twoPiece', tier: 'full', fabricId: 'f07', qty: 1, specs: 'Notch lapel, two button, double vents' },
       { id: 'i2', garment: 'shirt', tier: 'prem', fabricId: 'f11', qty: 2, specs: 'Cutaway collar, single cuff' }],
      { trial1: d(-6), trial2: d(1), delivery: d(10) },
      [p('advance', 50, d(-28), 'Bank transfer'), p('trial', 30, d(-6), 'UPI')],
      { fabric: 17500, stitching: 26000, logistics: 1500, delivery: 0 }),
    o('o11', 'TR-0011', 'c09', d(-2), 'confirmed', 'u-roh',
      [{ id: 'i1', garment: 'threePiece', tier: 'full', fabricId: 'f06', qty: 1, specs: 'Peak lapel, double-breasted waistcoat' },
       { id: 'i2', garment: 'bandhgala', tier: 'full', fabricId: 'f09', qty: 1, specs: 'Closed collar, five buttons, matching trousers' }],
      { trial1: d(30), trial2: d(45), delivery: d(70) },
      [],
      { fabric: 0, stitching: 0, logistics: 0, delivery: 0 })
  ];

  // Measurement forms, kept as versions. Each later version records what changed.
  const mforms = [];
  const addForm = (clientId, reason, by, date, time, form, photos = []) => {
    const prev = mforms.filter(x => x.clientId === clientId).slice(-1)[0];
    mforms.push({ id: 'mf' + (mforms.length + 1), clientId, v: prev ? prev.v + 1 : 1, reason, by, date, time, form, changes: prev ? diffForms(prev.form, form) : [], photos });
  };
  const pranav = jt({ fitting: 'Regular', style: 'Jacket', m: { 'Jacket Length': '30.5', Shoulder: '18.25', Sleeve: '25.5', Chest: '40.5', Waist: '35', Hip: '41', Neck: '15.5', Bicep: '14', 'Armhole Round': '18', 'Cross Back': '16.75', 'Half Chest': '20.25' },
    o: { 'Body Type': 'Low Shoulder', Button: '2 Button', Lapel: 'Peak', 'Lapel Width': 'Broad', 'Chest Pocket': 'Regular', 'Front Pocket': 'Ticket Pocket', Vent: 'Side Vents', 'Front Cut': 'Round', 'Inner Lining': 'Full Lining', Canvas: 'Handmade', 'Button Code': 'Regular' }, note: 'Right shoulder lower — pad accordingly.' },
    { fitting: 'Regular', style: 'Trouser', m: { 'Trouser Length': '41.5', Inseam: '31', Waist: '34', Hip: '41', Thigh: '24', Knee: '17', Bottom: '15.5', Fork: '11', 'U Fork': '26' },
      o: { 'Body Type': 'Regular', 'Cut Belt': 'Hook', 'Back Pocket': '2 Pockets', 'Back Button': 'Yes', Front: 'Plain', 'Front Pocket': 'Cross', 'Watch Pocket': 'No', 'Inner Lining': 'Half Lining' }, note: 'Slight break only.' });
  pranav.billNo = 'TR-0007';
  addForm('c08', 'consult', 'u-sap', d(-40), '18:10', pranav);
  const pranav2 = JSON.parse(JSON.stringify(pranav));
  pranav2.trouser.m.Waist = '34.5'; pranav2.trouser.m['Trouser Length'] = '41.25'; pranav2.jacket.m.Sleeve = '25.25';
  addForm('c08', 'trial1', 'u-sap', d(-20), '12:40', pranav2);

  const sid = jt({ fitting: 'Slim', style: 'Jacket', m: { 'Jacket Length': '29.5', Shoulder: '17.75', Sleeve: '25', Chest: '39', Waist: '33', Hip: '39.5', Neck: '15', 'Cross Back': '16.25' },
    o: { 'Body Type': 'Regular', Button: '2 Button', Lapel: 'Notch', 'Lapel Width': 'Regular', 'Chest Pocket': 'Smiley', 'Front Pocket': 'Slant', Vent: 'Single Vent', 'Front Cut': 'Round', 'Inner Lining': 'Full Lining', Canvas: 'Fused', 'Button Code': 'MOP' }, note: 'Waistcoat with lapels in the same cloth.' });
  sid.billNo = 'TR-0008';
  addForm('c03', 'consult', 'u-kar', d(-21), '19:30', sid);

  const kabir = jt({ fitting: 'Regular', style: 'Tuxedo', m: { 'Jacket Length': '31', Shoulder: '18.5', Sleeve: '25.75', Chest: '42', Waist: '37', Hip: '42.5', Neck: '16', Bicep: '15' },
    o: { 'Body Type': 'High Shoulder', Button: '1 Button', Lapel: 'Shawl', 'Lapel Width': 'Regular', 'Chest Pocket': 'No Pocket', Vent: 'No Vent', 'Front Cut': 'Round', 'Inner Lining': 'Full Lining', Canvas: 'Handmade', 'Button Code': 'Regular' }, note: 'Shawl collar in self velvet. Prefers a softer shoulder.' },
    { fitting: 'Slim', style: 'Trouser', m: { 'Trouser Length': '42', Inseam: '31.5', Waist: '36', Hip: '42.5', Thigh: '25', Knee: '17.5', Bottom: '15' },
      o: { 'Body Type': 'High Waist', 'Cut Belt': 'Button', 'Back Pocket': '1 Pocket', Front: 'Plain', 'Front Pocket': 'Straight', 'Inner Lining': 'Half Lining' }, note: 'Side adjusters, no belt loops.' });
  kabir.billNo = 'TR-0009';
  kabir.notes = 'Satin piping on the trouser outseam.';
  addForm('c04', 'consult', 'u-roh', d(-12), '12:45', kabir);

  const dev = jt({ fitting: 'Regular', style: 'Jacket', m: { 'Jacket Length': '30.25', Shoulder: '18', Sleeve: '25', Chest: '41', Waist: '36', Hip: '42', 'Cross Back': '16.5' },
    o: { 'Body Type': 'Regular', Button: '2 Button', Lapel: 'Notch', 'Lapel Width': 'Regular', 'Chest Pocket': 'Regular', 'Front Pocket': 'Straight', Vent: 'Side Vents', 'Front Cut': 'Round', 'Inner Lining': 'Half Lining', Canvas: 'Handmade', 'Button Code': 'MOP' }, note: '' },
    { fitting: 'Regular', style: 'Trouser', m: { 'Trouser Length': '42', Waist: '35', Hip: '42', Thigh: '24.5', Bottom: '16' }, o: { Front: '1 Pleat', 'Front Pocket': 'Cross' }, note: '' });
  dev.billNo = 'TR-0010';
  dev.shirt = { fitting: 'Slim', style: 'Shirt', m: { 'Shirt Length': '30', Shoulder: '18', Sleeve: '25.5', Chest: '41', Waist: '36', Neck: '15.75', Cuff: '9.5' }, o: { Collar: 'Cutaway', 'Cuff Type': '1 Button', Front: 'French', Button: 'MOP' }, note: '' };
  addForm('c11', 'consult', 'u-roh', d(-28), '17:20', dev);
  const dev2 = JSON.parse(JSON.stringify(dev));
  dev2.jacket.m.Sleeve = '24.75'; dev2.jacket.m.Waist = '35.5'; dev2.jacket.note = 'Sleeve pitch to move forward.';
  addForm('c11', 'trial1', 'u-roh', d(-6), '13:05', dev2);

  const activity = [
    { id: 'l1', clientId: 'c02', at: d(-3), by: 'u-kar', text: 'Consultation done. Quote for two half-canvas suits shared.' },
    { id: 'l2', clientId: 'c07', at: d(-4), by: 'u-roh', text: 'Consultation done. Shortlisted Gatsby 418; wants to check with his wife.' },
    { id: 'l3', clientId: 'c12', at: d(0), by: 'system', text: 'Arrived from TeleCRM as Appointment Taken.' },
    { id: 'l4', clientId: 'c05', at: d(0), by: 'system', text: 'Arrived from TeleCRM as Appointment Taken.' },
    { id: 'l6', clientId: 'c05', at: d(0), by: 'u-ana', text: 'Assigned to Rohit. Consultation booked for 4:30 pm.' },
    { id: 'l5', clientId: 'c09', at: d(-2), by: 'u-roh', text: 'Order TR-0011 confirmed. Advance to be collected at measurements.' }
  ];

  const tasks = [
    { id: 't1', clientId: 'c06', title: 'Send velvet swatch photos on email', due: d(0), assignedTo: 'u-kar', done: false },
    { id: 't2', clientId: 'c09', title: 'Bring the velvet bunch to the measurements visit', due: d(1), assignedTo: 'u-roh', done: false }
  ];

  return {
    version: 1, users, fabrics, clients, appointments, quotes, orders, mforms,
    activity, tasks, pricing: JSON.parse(JSON.stringify(DEFAULT_PRICING)), dismissed: {}, nextOrder: 12
  };
}

function jt(jacket, trouser) {
  const fm = emptyForm();
  fm.jacket = { ...fm.jacket, ...jacket };
  if (trouser) fm.trouser = { ...fm.trouser, ...trouser };
  return fm;
}
function f(id, house, mill, design, colour, composition, weight, weave, pattern, use, rate) {
  return { id, house, mill, design, colour, composition, weight, weave, pattern, use,
    cost: { vendor: mill === '—' ? 'Bangalore sheet' : mill, currency: 'INR', rate, unit: 'm', uplift: null } };
}
function c(id, name, phone, city, address, source, occasion, eventDate, budget, assignedTo, stage, stageSince, telecrmId, notes) {
  return { id, name, phone: '+91 ' + phone, email: '', city, address, source, sourceDetail: '', occasion, eventDate, budget,
    assignedTo, stage, stageSince, telecrmId, notes, createdAt: stageSince, lostReason: '' };
}
function a(id, clientId, type, date, time, assignedTo, status) {
  return { id, clientId, type, date, time, assignedTo, status, notes: '' };
}
function o(id, number, clientId, createdAt, status, by, items, dates, payments, costs) {
  return { id, number, clientId, createdAt, status, by, items, dates, payments, costs, notes: '' };
}
// Sample payments are given as a share of the order; amounts are filled in once the total is priced.
function p(stage, pct, date, method) {
  return { id: 'p' + Math.random().toString(36).slice(2, 7), stage, pct, amount: null, date, method };
}
