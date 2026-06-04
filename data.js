const DB_KEY = 'restaurant_v1';
const SYNC_KEY = 'restaurant_sync';

// ── Stockage local ────────────────────────────────────────

function load() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '{"employes":[],"pointages":{},"pin":"91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203","archives":[]}');
}

let _syncTimer = null;
function save(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => syncToGist(data), 4000);
}

// ── Sync GitHub Gist ──────────────────────────────────────

function getSyncConfig() {
  return JSON.parse(localStorage.getItem(SYNC_KEY) || 'null');
}

function setSyncConfig(cfg) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
}

async function syncToGist(data) {
  const cfg = getSyncConfig();
  if (!cfg?.token) return;
  const headers = { 'Authorization': `token ${cfg.token}`, 'Content-Type': 'application/json' };
  const body = { files: { 'restaurant-backup.json': { content: JSON.stringify(data) } } };
  try {
    let gistId = cfg.gistId;
    if (gistId) {
      const r = await fetch(`https://api.github.com/gists/${gistId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      if (r.status === 404) gistId = null;
    }
    if (!gistId) {
      const r = await fetch('https://api.github.com/gists', {
        method: 'POST', headers,
        body: JSON.stringify({ ...body, description: 'Restaurant Pointage Backup', public: false })
      });
      const g = await r.json();
      gistId = g.id;
      setSyncConfig({ ...cfg, gistId });
    }
    setSyncConfig({ ...getSyncConfig(), lastSync: new Date().toISOString() });
    updateSyncBadge(true);
  } catch {
    updateSyncBadge(false);
  }
}

async function restoreFromGist() {
  const cfg = getSyncConfig();
  if (!cfg?.token || !cfg?.gistId) return false;
  try {
    const r = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
      headers: { 'Authorization': `token ${cfg.token}` }
    });
    const g = await r.json();
    const content = g.files?.['restaurant-backup.json']?.content;
    if (content) { localStorage.setItem(DB_KEY, content); return true; }
  } catch {}
  return false;
}

async function setupSync(token) {
  const r = await fetch('https://api.github.com/user', { headers: { 'Authorization': `token ${token}` } });
  if (!r.ok) throw new Error('Token invalide');
  const existing = getSyncConfig();
  setSyncConfig({ token, gistId: existing?.gistId || null });
  await syncToGist(load());
}

function updateSyncBadge(ok) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  const cfg = getSyncConfig();
  if (!cfg?.token) { el.textContent = ''; return; }
  if (ok) {
    const t = cfg.lastSync ? new Date(cfg.lastSync).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' }) : '';
    el.textContent = `☁ ${t}`;
    el.style.color = '#4caf50';
  } else {
    el.textContent = '☁ ✗';
    el.style.color = '#f44336';
  }
}

// ── Utilitaires ───────────────────────────────────────────

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

function deleteEmploye(id) {
  const data = load();
  data.employes = data.employes.filter(e => e.id !== id);
  delete data.pointages[id];
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

// ── Export / Import manuel ────────────────────────────────

function exportData() {
  const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `restaurant-backup-${today()}.json`;
  a.click();
}

function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        resolve();
      } catch { reject(new Error('Fichier invalide')); }
    };
    reader.readAsText(file);
  });
}
