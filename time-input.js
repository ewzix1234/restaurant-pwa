// Logique pure de saisie d'heure (frappe directe type calculette).
// Format de stockage : "HH:MM". Format d'affichage : "HHhMM".

function parseDigits(value) {
  return String(value).replace(/\D/g, '').slice(0, 4);
}

function digitsToStorage(value) {
  const d = parseDigits(value);
  if (!d) return '';
  let h, m;
  if (d.length <= 2) { h = parseInt(d, 10); m = 0; }
  else { h = parseInt(d.slice(0, d.length - 2), 10); m = parseInt(d.slice(-2), 10); }
  m = Math.round(m / 5) * 5;
  if (m >= 60) return '';
  if (h < 6 || h > 23) return '';
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function storageToDisplay(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':');
  return h + 'h' + m;
}

function formatLiveDisplay(value) {
  const d = parseDigits(value);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + 'h' + d.slice(2);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDigits, digitsToStorage, storageToDisplay, formatLiveDisplay };
}
