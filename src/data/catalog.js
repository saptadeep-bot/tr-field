// Fixed vocabularies shared by every screen.

export const ROLES = {
  owner: { label: 'Owner' },
  coordinator: { label: 'Client coordinator' },
  rep: { label: 'Sales & styling' },
  tailor: { label: 'Workroom' }
};

// Permissions per role. In the live app these are enforced by the database,
// not just hidden on screen.
const PERMS = {
  owner: ['seeAllClients', 'assign', 'seeContact', 'seePrices', 'seeCosts', 'recordPayment', 'editPricing', 'manageTeam', 'editClients', 'book', 'editMeasure'],
  coordinator: ['seeAllClients', 'assign', 'seeContact', 'seePrices', 'recordPayment', 'editClients', 'book', 'editMeasure'],
  rep: ['seeContact', 'seePrices', 'recordPayment', 'editClients', 'book', 'editMeasure'],
  tailor: []
};
export function can(user, perm) { return !!user && (PERMS[user.role] || []).includes(perm); }

export const STAGES = [
  { key: 'new', label: 'New lead', short: 'New' },
  { key: 'booked', label: 'Appointment booked', short: 'Booked' },
  { key: 'visited', label: 'Visited', short: 'Visited' },
  { key: 'quoted', label: 'Quote given', short: 'Quoted' },
  { key: 'confirmed', label: 'Order confirmed', short: 'Confirmed' },
  { key: 'production', label: 'With tailor', short: 'With tailor' },
  { key: 'trial1', label: 'Trial 1', short: 'Trial 1' },
  { key: 'trial2', label: 'Trial 2 / alterations', short: 'Trial 2' },
  { key: 'delivered', label: 'Delivered', short: 'Delivered' },
  { key: 'closed', label: 'Closed', short: 'Closed' }
];
export const SIDE_STAGES = [
  { key: 'hold', label: 'On hold', short: 'On hold' },
  { key: 'lost', label: 'Lost', short: 'Lost' }
];
export const ALL_STAGES = [...STAGES, ...SIDE_STAGES];
export function stageLabel(k) { return (ALL_STAGES.find(s => s.key === k) || {}).label || k; }
export function stageShort(k) { return (ALL_STAGES.find(s => s.key === k) || {}).short || k; }
export function stageIndex(k) { return STAGES.findIndex(s => s.key === k); }

// Same lost reasons as TeleCRM, so reports line up.
export const LOST_REASONS = ['No Need', 'Unable to Connect', 'Budget Issues', 'Product does not fit need', 'Lost to competitor', 'Unknown Reason'];

export const SOURCES = [
  { key: 'telecrm', label: 'TeleCRM', auto: true },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'referral', label: 'Referral' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'website', label: 'Website' },
  { key: 'walkin', label: 'Walk-in / event' },
  { key: 'repeat', label: 'Repeat client' },
  { key: 'other', label: 'Other' }
];
export function sourceLabel(k) { return (SOURCES.find(s => s.key === k) || {}).label || k; }

export const CITIES = ['Delhi', 'Bangalore', 'Mumbai'];

export const APPT_TYPES = [
  { key: 'consult', label: 'Consultation' },
  { key: 'measure', label: 'Measurements' },
  { key: 'trial1', label: 'Trial 1' },
  { key: 'trial2', label: 'Trial 2' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'alteration', label: 'Alteration' }
];
export function apptLabel(k) { return (APPT_TYPES.find(a => a.key === k) || {}).label || k; }

export const PAY_METHODS = ['UPI', 'Bank transfer', 'Card', 'Cash', 'Cheque'];
export const PAY_STAGES = [
  { key: 'advance', label: 'Advance', pct: 50, when: 'At order' },
  { key: 'trial', label: 'At trial', pct: 30, when: 'At trial fitting' },
  { key: 'delivery', label: 'On delivery', pct: 20, when: 'On delivery' }
];

export const ORDER_STATUS = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'production', label: 'With tailor' },
  { key: 'trial1', label: 'Trial 1' },
  { key: 'trial2', label: 'Trial 2' },
  { key: 'delivered', label: 'Delivered' }
];
export function orderStatusLabel(k) { return (ORDER_STATUS.find(s => s.key === k) || {}).label || k; }

export const OCCASIONS = ['Wedding — own', 'Wedding — guest', 'Reception', 'Work', 'Festive', 'Black tie', 'Travel', 'Everyday'];
export const BUDGETS = ['Under ₹50,000', '₹50,000–1,00,000', '₹1–2 lakh', '₹2–5 lakh', 'Above ₹5 lakh', 'Not discussed'];
