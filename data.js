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
  const headers = { 'Authorization': `Bearer ${cfg.token}`, 'Content-Type': 'application/json' };
  const body = { files: { 'restaurant-backup.json': { content: JSON.stringify(data) } } };
  try {
    let gistId = cfg.gistId;
    if (gistId) {
      const r = await fetch(`https://api.github.com/gists/${gistId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      if (r.status === 404) gistId = null;
      else if (!r.ok) throw new Error(`sync ${r.status}`);
    }
    if (!gistId) {
      const r = await fetch('https://api.github.com/gists', {
        method: 'POST', headers,
        body: JSON.stringify({ ...body, description: 'Restaurant Pointage Backup', public: false })
      });
      if (!r.ok) throw new Error(`sync ${r.status}`);
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
      headers: { 'Authorization': `Bearer ${cfg.token}` }
    });
    if (!r.ok) return false;
    const g = await r.json();
    const content = g.files?.['restaurant-backup.json']?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed.employes) || typeof parsed.pointages !== 'object' || !parsed.pin) return false;
      localStorage.setItem(DB_KEY, content);
      return true;
    }
  } catch {}
  return false;
}

async function setupSync(token) {
  const r = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${token}` } });
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

// Heures en centièmes (paie) : 1h30 → 1h50
function formatCentiemes(mins) {
  if (mins <= 0) return '0h00';
  let h = Math.floor(mins / 60);
  let c = Math.round((mins % 60) / 60 * 100);
  if (c === 100) { h += 1; c = 0; }
  return `${h}h${String(c).padStart(2, '0')}`;
}

// Affiche un nombre de congés (gère les demi-journées) : 2 → "2", 2.5 → "2,5"
function formatConges(n) {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
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
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
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
  if (data.conges) delete data.conges[id];
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

function clearPointage(employeId, date) {
  const data = load();
  if (data.pointages[employeId]) {
    delete data.pointages[employeId][date];
  }
  save(data);
}

function clearService(employeId, date, service) {
  const data = load();
  const jour = data.pointages[employeId]?.[date];
  if (jour) {
    delete jour[service];
    if (Object.keys(jour).length === 0) delete data.pointages[employeId][date];
  }
  save(data);
}

// ── Congés ────────────────────────────────────────────────

function setJoursCongeHabituels(empId, jours) {
  const data = load();
  const emp = data.employes.find(e => e.id === empId);
  if (emp) emp.joursConge = jours;
  save(data);
}

function setCongeJour(empId, date, value) {
  const data = load();
  if (!data.conges) data.conges = {};
  if (!data.conges[empId]) data.conges[empId] = {};
  if (value === null) {
    delete data.conges[empId][date];
  } else {
    data.conges[empId][date] = value;
  }
  save(data);
}

// État de congé d'un jour : 'full' (journée), 'midi', 'soir' (demi-journées) ou null
function getCongeState(empId, date) {
  const data = load();
  const emp = data.employes.find(e => e.id === empId);
  if (!emp) return null;
  const explicit = ((data.conges || {})[empId] || {})[date];
  if (explicit === true) return 'full';
  if (explicit === 'midi' || explicit === 'soir') return explicit;
  if (explicit === false) return null;
  const dow = new Date(date + 'T12:00:00').getDay();
  return (emp.joursConge || []).includes(dow) ? 'full' : null;
}

function isCongeJour(empId, date) {
  return getCongeState(empId, date) === 'full';
}

function calcCongesDuMois(empId, mois) {
  const data = load();
  const emp = data.employes.find(e => e.id === empId);
  if (!emp) return 0;
  const [y, m] = mois.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${mois}-${String(d).padStart(2,'0')}`;
    const explicit = ((data.conges || {})[empId] || {})[date];
    if (explicit === true) {
      count += 1;
    } else if (explicit === 'midi' || explicit === 'soir') {
      count += 0.5;
    } else if (explicit === false) {
      // pas de congé
    } else {
      const dow = new Date(date + 'T12:00:00').getDay();
      if ((emp.joursConge || []).includes(dow)) {
        // Jour de congé habituel — annulé si des heures ont été saisies
        const pts = (data.pointages[empId] || {})[date] || {};
        const aDesHeures = ['midi', 'soir'].some(s => pts[s]?.heureDebut && pts[s]?.heureFin);
        if (!aDesHeures) count += 1;
      }
    }
  }
  return count;
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
    return { id: emp.id, nom: emp.nom, totalMinutes, totalHeures: formatCentiemes(totalMinutes), totalRepas, detail };
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
  if (data.conges) {
    for (const empId of Object.keys(data.conges)) {
      for (const date of Object.keys(data.conges[empId])) {
        if (date.startsWith(mois)) delete data.conges[empId][date];
      }
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
        if (!Array.isArray(data.employes) || typeof data.pointages !== 'object' || !data.pin) {
          throw new Error('Fichier invalide (structure incorrecte)');
        }
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        resolve();
      } catch (err) {
        reject(err instanceof SyntaxError ? new Error('Fichier invalide') : err);
      }
    };
    reader.readAsText(file);
  });
}
