const KENYAN_PHONE_REGEX = /^(?:\+254|0)(7\d{8}|1\d{8})$/;

function normalizeKenyanPhone(phone) {
  const clean = String(phone || '').replace(/[\s-]/g, '');
  if (!KENYAN_PHONE_REGEX.test(clean)) return null;

  if (clean.startsWith('+254')) return clean;
  if (clean.startsWith('0')) return `+254${clean.slice(1)}`;
  return `+${clean}`;
}

function toKes(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2
  }).format(amount);
}

module.exports = {
  normalizeKenyanPhone,
  toKes
};
