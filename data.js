const DB_KEY = 'restaurant_v1';

function load() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '{"employes":[],"pointages":{},"pin":"8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92","archives":[]}');
}

function save(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(pin)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function minutesDiff(debut, fin) {
  const [dh, dm] = debut.split(':').map(Number);
  const [fh, fm] = fin.split(':').map(Number);
  return (fh * 60 + fm) - (dh * 60 + dm);
}

function formatDuration(mins) {
  if (mins <= 0) return '0h00';
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Employés ──────────────────────────────────────────────

function getEmployes() {
  return load().employes.filter(e => e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom));
}

function addEmploye(nom) {
  const data = load();
  const id = Date.now();
  data.employes.push({ id, nom: nom.trim(), actif: true });
  save(data);
  return { id, nom };
}

function renameEmploye(id, nom) {
  const data = load();
  const emp = data.employes.find(e => e.id === id);
  if (emp) emp.nom = nom.trim();
  save(data);
}

// ── Pointages ─────────────────────────────────────────────

function getPointages(employeId, date) {
  const data = load();
  return (data.pointages[employeId] || {})[date] || {};
}

function savePointage(employeId, date, service, heureDebut, heureFin, repasPris) {
  if (!heureDebut && !heureFin && !repasPris) return;
  const data = load();
  if (!data.pointages[employeId]) data.pointages[employeId] = {};
  if (!data.pointages[employeId][date]) data.pointages[employeId][date] = {};
  data.pointages[employeId][date][service] = { heureDebut: heureDebut || null, heureFin: heureFin || null, repasPris: !!repasPris };
  save(data);
}

// ── Récap ─────────────────────────────────────────────────

function calcRecap(mois) {
  const data = load();
  return data.employes.filter(e => e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom)).map(emp => {
    let totalMinutes = 0, totalRepas = 0;
    const detail = {};
    const pts = data.pointages[emp.id] || {};
    for (const [date, services] of Object.entries(pts)) {
      if (!date.startsWith(mois)) continue;
      detail[date] = services;
      for (const s of ['midi', 'soir']) {
        const p = services[s];
        if (!p) continue;
        if (p.heureDebut && p.heureFin) totalMinutes += minutesDiff(p.heureDebut, p.heureFin);
        if (p.repasPris) totalRepas++;
      }
    }
    return { id: emp.id, nom: emp.nom, totalMinutes, totalHeures: formatDuration(totalMinutes), totalRepas, detail };
  });
}

// ── Auth PIN ──────────────────────────────────────────────

async function verifyPin(pin) {
  const data = load();
  return data.pin === await hashPin(pin);
}

async function changePin(ancienPin, nouveauPin) {
  if (!/^\d{6}$/.test(nouveauPin)) throw new Error('Le code doit contenir 6 chiffres');
  const data = load();
  if (data.pin !== await hashPin(ancienPin)) throw new Error('Ancien code incorrect');
  data.pin = await hashPin(nouveauPin);
  save(data);
}

// ── Clôture ───────────────────────────────────────────────

function cloturerMois(mois) {
  const data = load();
  const recap = calcRecap(mois);
  if (!data.archives) data.archives = [];
  data.archives = data.archives.filter(a => a.mois !== mois);
  data.archives.push({ mois, employes: recap, date: new Date().toISOString() });
  for (const empId of Object.keys(data.pointages)) {
    for (const date of Object.keys(data.pointages[empId])) {
      if (date.startsWith(mois)) delete data.pointages[empId][date];
    }
  }
  save(data);
}
