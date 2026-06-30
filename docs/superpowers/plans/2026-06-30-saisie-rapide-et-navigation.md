# Saisie rapide + réorganisation navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la saisie des heures aussi rapide qu'une calculette (frappe directe au lieu de menus déroulants) et réorganiser la navigation (Réglages isolés derrière le PIN, bouton accueil persistant).

**Architecture:** PWA mono-page statique (`index.html` + `data.js` + `style.css`, déployée sur GitHub Pages). On extrait la logique pure de parsing/formatage des heures dans un nouveau fichier `time-input.js` (testable sous Node), on remplace les `<select>` par des `<input>` numériques, puis on restructure la navigation. Le format de stockage `"HH:MM"` ne change pas → aucune migration.

**Tech Stack:** HTML/CSS/JS vanilla, pas de build. Tests unitaires de la logique pure via `node --test` (intégré à Node 24, aucune dépendance). Vérification UI manuelle dans le navigateur.

## Global Constraints

- Format de stockage des heures : `"HH:MM"` (ex. `"11:30"`) — INCHANGÉ. Aucune migration de données.
- Plage horaire valide : heures 06–23, minutes arrondies au multiple de 5 (comportement identique aux anciens `<select>`).
- Ne supprimer aucune fonctionnalité existante (sauvegarde GitHub, sauvegarde manuelle, congés, semaines, clôture, PIN).
- Icônes via emoji déjà en place dans l'app — on reste cohérent avec l'existant (pas de refonte visuelle).
- Touch targets ≥ 44 px de hauteur.
- Réglages techniques (token GitHub, changement de PIN) restent accessibles uniquement depuis l'Espace Responsable déverrouillé (jamais depuis l'accueil).
- Incrémenter la version de cache du service worker (`sw.js`) avant déploiement.

---

## File Structure

- **Create** `time-input.js` — logique pure de parsing/formatage des heures (4 fonctions). Chargé par `index.html`, testé par Node.
- **Create** `time-input.test.js` — tests unitaires Node de `time-input.js`.
- **Modify** `index.html` — remplacer les time-pickers par des inputs ; brancher les écouteurs ; restructurer la navigation (topbar accueil+engrenage, section Réglages fusionnée).
- **Modify** `style.css` — styles `.time-input`, `.topbar`, `.icon-btn`.
- **Modify** `sw.js` — ajouter `time-input.js` à la liste des fichiers cachés + bump version.

---

## Task 1 : Logique pure de saisie d'heure (`time-input.js`)

**Files:**
- Create: `time-input.js`
- Test: `time-input.test.js`
- Modify: `index.html:228` (ajouter `<script src="time-input.js">`)
- Modify: `sw.js:2` (ajouter `'time-input.js'` à `FILES`)

**Interfaces:**
- Produces (globaux navigateur + `module.exports` Node) :
  - `parseDigits(value: string) -> string` — extrait jusqu'à 4 chiffres.
  - `digitsToStorage(digits: string) -> string` — `"1130"` → `"11:30"`, invalide → `""`.
  - `storageToDisplay(hhmm: string) -> string` — `"11:30"` → `"11h30"`, `""` → `""`.
  - `formatLiveDisplay(value: string) -> string` — formatage à la volée pendant la frappe.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `time-input.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert');
const { parseDigits, digitsToStorage, storageToDisplay, formatLiveDisplay } = require('./time-input.js');

test('parseDigits ne garde que les chiffres, max 4', () => {
  assert.strictEqual(parseDigits('11h30'), '1130');
  assert.strictEqual(parseDigits('abc9'), '9');
  assert.strictEqual(parseDigits('113055'), '1130');
  assert.strictEqual(parseDigits(''), '');
});

test('digitsToStorage gère les frappes complètes et partielles', () => {
  assert.strictEqual(digitsToStorage('1130'), '11:30');
  assert.strictEqual(digitsToStorage('1830'), '18:30');
  assert.strictEqual(digitsToStorage('2300'), '23:00');
  assert.strictEqual(digitsToStorage('9'), '09:00');
  assert.strictEqual(digitsToStorage('11'), '11:00');
  assert.strictEqual(digitsToStorage('930'), '09:30');
  assert.strictEqual(digitsToStorage('600'), '06:00');
  assert.strictEqual(digitsToStorage(''), '');
});

test('digitsToStorage arrondit les minutes au multiple de 5', () => {
  assert.strictEqual(digitsToStorage('1132'), '11:30');
  assert.strictEqual(digitsToStorage('1133'), '11:35');
});

test('digitsToStorage rejette les valeurs hors plage', () => {
  assert.strictEqual(digitsToStorage('0500'), '');  // heure < 6
  assert.strictEqual(digitsToStorage('2500'), '');  // heure > 23
  assert.strictEqual(digitsToStorage('1175'), '');  // minute > 59
});

test('storageToDisplay formate pour affichage', () => {
  assert.strictEqual(storageToDisplay('11:30'), '11h30');
  assert.strictEqual(storageToDisplay('09:00'), '09h00');
  assert.strictEqual(storageToDisplay(''), '');
});

test('formatLiveDisplay insère le h seulement avec des minutes', () => {
  assert.strictEqual(formatLiveDisplay('1'), '1');
  assert.strictEqual(formatLiveDisplay('11'), '11');
  assert.strictEqual(formatLiveDisplay('113'), '11h3');
  assert.strictEqual(formatLiveDisplay('1130'), '11h30');
  assert.strictEqual(formatLiveDisplay('11h30'), '11h30');
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `cd ~/restaurant-pwa && node --test`
Expected: FAIL — `Cannot find module './time-input.js'`

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `time-input.js` :

```js
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
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `cd ~/restaurant-pwa && node --test`
Expected: PASS — `# pass 6  # fail 0`

- [ ] **Step 5 : Charger le script dans `index.html`**

Dans `index.html`, ligne 228, ajouter AVANT `<script src="data.js"></script>` :

```html
<script src="time-input.js"></script>
<script src="data.js"></script>
```

- [ ] **Step 6 : Ajouter le fichier au cache du service worker**

Dans `sw.js` ligne 2, ajouter `'time-input.js'` :

```js
const FILES = ['.', 'index.html', 'style.css', 'time-input.js', 'data.js', 'manifest.json', 'icon.svg'];
```

- [ ] **Step 7 : Commit**

```bash
cd ~/restaurant-pwa
git add time-input.js time-input.test.js index.html sw.js
git commit -m "feat: logique pure de saisie d'heure par frappe directe + tests"
```

---

## Task 2 : Remplacer les menus déroulants par des champs de frappe directe

**Files:**
- Modify: `index.html:66-67` et `:78-79` (HTML des time-pickers)
- Modify: `index.html:321-347` (supprimer `buildTimePickers`, réécrire `getTime`/`setTime`)
- Modify: `index.html:966` (remplacer l'appel `buildTimePickers()` par `initTimeInputs()`)
- Modify: `style.css:126-161` (ajouter `.time-input`)

**Interfaces:**
- Consumes (de Task 1) : `parseDigits`, `digitsToStorage`, `storageToDisplay`, `formatLiveDisplay`.
- Produces : `getTime(id) -> "HH:MM"|""`, `setTime(id, "HH:MM"|"")`, `initTimeInputs()` — signatures de `getTime`/`setTime` inchangées (consommées par `renderSaisie`, `sauvegarder`, `effacerJour`).

- [ ] **Step 1 : Remplacer le HTML des 4 champs (service Midi)**

Dans `index.html`, lignes 66-67, remplacer les deux `<div class="field">…<div class="time-picker">…</div></div>` par :

```html
          <div class="field"><label>Début</label><input type="text" inputmode="numeric" class="time-input" id="midi-debut" placeholder="--h--" maxlength="5" aria-label="Heure de début midi"></div>
          <div class="field"><label>Fin</label><input type="text" inputmode="numeric" class="time-input" id="midi-fin" placeholder="--h--" maxlength="5" aria-label="Heure de fin midi"></div>
```

- [ ] **Step 2 : Remplacer le HTML des 4 champs (service Soir)**

Dans `index.html`, lignes 78-79, remplacer de même par :

```html
          <div class="field"><label>Début</label><input type="text" inputmode="numeric" class="time-input" id="soir-debut" placeholder="--h--" maxlength="5" aria-label="Heure de début soir"></div>
          <div class="field"><label>Fin</label><input type="text" inputmode="numeric" class="time-input" id="soir-fin" placeholder="--h--" maxlength="5" aria-label="Heure de fin soir"></div>
```

- [ ] **Step 3 : Réécrire `getTime`, `setTime` et supprimer `buildTimePickers`**

Dans `index.html`, remplacer tout le bloc lignes 321-347 (`buildTimePickers`, `getTime`, `setTime`) par :

```js
function getTime(id) {
  return digitsToStorage(document.getElementById(id).value);
}

function setTime(id, val) {
  document.getElementById(id).value = storageToDisplay(val);
}

function initTimeInputs() {
  const ids = ['midi-debut', 'midi-fin', 'soir-debut', 'soir-fin'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.addEventListener('focus', () => el.select());
    el.addEventListener('input', () => {
      el.value = formatLiveDisplay(el.value);
      if (parseDigits(el.value).length === 4 && i < ids.length - 1) {
        document.getElementById(ids[i + 1]).focus();
      }
    });
    el.addEventListener('blur', () => { el.value = storageToDisplay(getTime(id)); });
  });
}
```

- [ ] **Step 4 : Remplacer l'appel d'init au démarrage**

Dans `index.html` ligne 966, remplacer :

```js
  buildTimePickers();
```

par :

```js
  initTimeInputs();
```

- [ ] **Step 5 : Ajouter le style `.time-input` (et retirer les anciens styles inutilisés)**

Dans `style.css`, remplacer le bloc lignes 126-161 (`.time-picker`, `.time-picker:focus-within`, `.tp-h, .tp-m`, `.tp-sep`) par :

```css
.time-input {
  width: 100%;
  background: #fafbfc;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  min-height: 48px;
  padding: 0.65rem 0.4rem;
  font-family: inherit;
  font-size: 1.35rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  touch-action: manipulation;
  transition: border-color var(--t), box-shadow var(--t);
}
.time-input:focus {
  border-color: var(--accent);
  background: white;
  box-shadow: 0 0 0 3px rgba(180,83,9,0.1);
}
.time-input::placeholder { color: #cbd5e1; font-weight: 500; letter-spacing: normal; }
```

- [ ] **Step 6 : Vérification manuelle dans le navigateur**

Run: `cd ~/restaurant-pwa && python3 -m http.server 8000`
Puis ouvrir `http://localhost:8000` (sur mobile ou avec l'inspecteur en mode appareil mobile).

Vérifier, écran de saisie d'un employé :
- Taper `1130` dans Midi-Début → affiche `11h30`, le focus saute automatiquement à Midi-Fin. **PASS attendu.**
- Taper `9` dans un champ puis cliquer ailleurs (blur) → affiche `09h00`. **PASS.**
- Taper `930` → blur → `09h30`. **PASS.**
- Le focus sur un champ pré-rempli sélectionne tout ; taper remplace immédiatement. **PASS.**
- Le clavier numérique apparaît sur mobile (pas de menu déroulant). **PASS.**
- Cliquer « Enregistrer », recharger la page (Cmd+R), rouvrir le même jour pour le même employé → les heures saisies sont toujours là. **PASS.**
- Saisir Fin avant Début (ex. début 15h, fin 11h) → « Enregistrer » affiche l'erreur « l'heure de fin doit être après le début ». **PASS.**

- [ ] **Step 7 : Commit**

```bash
cd ~/restaurant-pwa
git add index.html style.css
git commit -m "feat: saisie des heures par frappe directe (remplace les menus déroulants)"
```

---

## Task 3 : Réorganisation de la navigation (Réglages + accueil)

**Files:**
- Modify: `index.html:20` (ajouter la topbar après `<div class="container">`)
- Modify: `index.html:112-120` (retirer les boutons Code PIN et Réglages du dashboard)
- Modify: `index.html:159-208` (fusionner `section-code` + `section-sync` en `section-reglages`)
- Modify: `index.html:237-248` (mettre à jour `showSection` : topbar, engrenage contextuel, branche reglages)
- Modify: `style.css` (ajouter `.topbar`, `.icon-btn`)

**Interfaces:**
- Consumes : `showSection(id)`, `renderSyncStatus()`, `renderRecap()` (existants).
- Produces : section `section-reglages` ; topbar avec bouton accueil + engrenage contextuel.

- [ ] **Step 1 : Ajouter la topbar (accueil + engrenage) en haut du conteneur**

Dans `index.html`, juste après `<div class="container">` (ligne 20), ajouter :

```html
  <div id="topbar" class="topbar" style="display:none">
    <button class="icon-btn" onclick="showSection('section-home')" aria-label="Accueil">🏠</button>
    <button id="topbar-gear" class="icon-btn" onclick="showSection('section-reglages')" aria-label="Réglages" style="display:none">⚙️</button>
  </div>
```

- [ ] **Step 2 : Retirer les boutons « Code PIN » et « Réglages » du dashboard**

Dans `index.html`, supprimer les lignes 117 et 118 :

```html
        <button class="btn btn-secondary btn-sm" onclick="showSection('section-code')">🔑 Code PIN</button>
        <button class="btn btn-secondary btn-sm" onclick="showSection('section-sync')">⚙️ Réglages</button>
```

Le dashboard ne garde alors que : `📊 Tableau`, `📅 Semaines`, `🏖 Congés`, `Imprimer`, `🔴 Clôturer le mois`.

- [ ] **Step 3 : Fusionner `section-code` + `section-sync` en `section-reglages`**

Dans `index.html`, remplacer tout le bloc des lignes 159-208 (les deux `<div id="section-code">` et `<div id="section-sync">` complets) par une seule section :

```html
  <!-- Réglages (sauvegarde + PIN) -->
  <div id="section-reglages" class="section">
    <div class="card">
      <div class="accordion-header" onclick="toggleAccordion('acc-auto')">
        <h2 style="font-size:1rem;margin:0">☁ Sauvegarde automatique</h2>
        <span id="acc-auto-icon" class="accordion-icon">▼</span>
      </div>
      <div id="acc-auto" class="accordion-body">
        <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1rem">Les données sont envoyées sur GitHub après chaque saisie. Configurez une seule fois.</p>
        <div id="alert-sync" class="alert"></div>
        <div id="sync-status-detail" style="margin-bottom:0.8rem;font-size:0.85rem"></div>
        <div class="field">
          <label>Token GitHub (scope : gist)</label>
          <input type="password" id="github-token" placeholder="ghp_...">
        </div>
        <button class="btn btn-primary btn-block" onclick="activerSync()">Activer la sauvegarde auto</button>
        <button class="btn btn-secondary btn-block" style="margin-top:0.5rem" onclick="restaurerDepuisGist()">Restaurer depuis le cloud</button>
      </div>
    </div>

    <div class="card">
      <div class="accordion-header" onclick="toggleAccordion('acc-manuel')">
        <h2 style="font-size:1rem;margin:0">📁 Sauvegarde manuelle</h2>
        <span id="acc-manuel-icon" class="accordion-icon">▼</span>
      </div>
      <div id="acc-manuel" class="accordion-body">
        <div style="display:flex;gap:0.5rem;padding-top:0.2rem">
          <button class="btn btn-secondary" style="flex:1" onclick="exportData()">Exporter fichier</button>
          <label class="btn btn-secondary" style="flex:1;text-align:center;cursor:pointer">
            Importer fichier
            <input type="file" accept=".json" style="display:none" onchange="importerFichier(this)">
          </label>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="accordion-header" onclick="toggleAccordion('acc-pin')">
        <h2 style="font-size:1rem;margin:0">🔑 Changer le code PIN</h2>
        <span id="acc-pin-icon" class="accordion-icon">▼</span>
      </div>
      <div id="acc-pin" class="accordion-body">
        <div id="alert-code" class="alert"></div>
        <div class="field"><label>Ancien code</label><input type="password" id="ancien-code" inputmode="numeric" maxlength="6"></div>
        <div class="field"><label>Nouveau code (6 chiffres)</label><input type="password" id="nouveau-code" inputmode="numeric" maxlength="6"></div>
        <button class="btn btn-primary btn-block" onclick="changerCode()">Valider</button>
      </div>
    </div>

    <button class="btn btn-secondary btn-block" onclick="showSection('section-responsable')">← Retour</button>
  </div>
```

- [ ] **Step 4 : Mettre à jour `showSection`**

Dans `index.html`, remplacer le corps de `showSection` (lignes 237-248) par :

```js
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('topbar').style.display = (id === 'section-home') ? 'none' : 'flex';
  document.getElementById('topbar-gear').style.display = (id === 'section-responsable') ? 'inline-flex' : 'none';
  if (id === 'section-employes') renderEmployes();
  if (id === 'section-saisie') renderSaisie();
  if (id === 'section-responsable') renderRecap();
  if (id === 'section-reglages') { renderSyncStatus(); document.getElementById('alert-sync').style.display = 'none'; }
  if (id === 'section-pin') {
    document.getElementById('pin-input').value = '';
    document.getElementById('alert-pin').style.display = 'none';
  }
}
```

- [ ] **Step 5 : Vérifier qu'aucune référence orpheline ne subsiste**

Run: `cd ~/restaurant-pwa && grep -n "section-sync\|section-code" index.html`
Expected: aucune ligne retournée (toutes les références ont disparu).

- [ ] **Step 6 : Ajouter les styles `.topbar` et `.icon-btn`**

Dans `style.css`, ajouter à la fin du fichier :

```css
/* ── Topbar (accueil + réglages) ─────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0;
  margin-bottom: 0.6rem;
  padding-top: env(safe-area-inset-top, 0);
}
.topbar > :only-child { margin-right: auto; }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: white;
  font-size: 1.25rem;
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--t), border-color var(--t);
}
.icon-btn:active { background: var(--border); }
```

Note : `.topbar > :only-child { margin-right:auto }` garde le bouton accueil à gauche quand l'engrenage est masqué.

- [ ] **Step 7 : Vérification manuelle dans le navigateur**

Run: `cd ~/restaurant-pwa && python3 -m http.server 8000` puis ouvrir `http://localhost:8000`.

- Sur l'accueil : pas de topbar (🏠 absent). **PASS.**
- Entrer dans « Saisir les heures » → un employé : le 🏠 apparaît en haut à gauche, pas d'engrenage. Cliquer 🏠 → retour direct à l'accueil. **PASS.**
- Espace Responsable (PIN par défaut au besoin) : 🏠 à gauche ET ⚙️ à droite dans la topbar. Le dashboard ne montre que 5 boutons (Tableau, Semaines, Congés, Imprimer, Clôturer). **PASS.**
- Cliquer ⚙️ → page Réglages avec les 3 blocs : Sauvegarde automatique (token GitHub), Sauvegarde manuelle (export/import), Changer le code PIN. Déplier chaque accordéon, vérifier que les champs et boutons sont présents. **PASS.**
- Tester un changement de PIN bidon (ancien correct → nouveau) pour confirmer que `changerCode` fonctionne toujours depuis la nouvelle section. **PASS.**
- Depuis l'Espace Responsable, cliquer 🏠 → retour à l'accueil (la zone responsable se referme). **PASS.**

- [ ] **Step 8 : Commit**

```bash
cd ~/restaurant-pwa
git add index.html style.css
git commit -m "feat: topbar accueil persistante + page Réglages unifiée (GitHub/sauvegarde/PIN)"
```

---

## Task 4 : Bump du cache service worker + vérification finale

**Files:**
- Modify: `sw.js:1` (version de cache)

- [ ] **Step 1 : Incrémenter la version de cache**

Dans `sw.js` ligne 1, passer la version de `v18` à `v19` :

```js
const CACHE = 'pointage-v19';
```

- [ ] **Step 2 : Relancer la suite de tests Node (non-régression logique)**

Run: `cd ~/restaurant-pwa && node --test`
Expected: PASS — `# fail 0`

- [ ] **Step 3 : Vérification finale de bout en bout**

Run: `cd ~/restaurant-pwa && python3 -m http.server 8000` puis ouvrir `http://localhost:8000`.

Scénario complet « le gérant saisit une journée » :
- Accueil → Saisir les heures → choisir un employé.
- Taper `1100` (Midi début) → saut auto → `1500` (Midi fin) → ne rien faire pour le soir ou taper `1830`/`2300`.
- Cocher « Repas pris » si besoin.
- Enregistrer → message « ✓ Heures enregistrées ».
- 🏠 → accueil. **Toute la saisie s'est faite au clavier numérique, sans aucun menu déroulant ni scroll. PASS.**

- [ ] **Step 4 : Commit**

```bash
cd ~/restaurant-pwa
git add sw.js
git commit -m "chore: bump cache service worker v19"
```

---

## Self-Review (effectué)

**Couverture de la spec :**
- Chantier 1 (saisie frappe directe) → Tasks 1 & 2. ✓
- Chantier 2 (réorg Espace Responsable + page Réglages) → Task 3 (steps 2-4). ✓
- Chantier 3 (bouton accueil 🏠) → Task 3 (steps 1, 4, 6). ✓
- Stockage `"HH:MM"` inchangé → Task 1 (`digitsToStorage`/`storageToDisplay`) ; `getTime`/`setTime` gardent leur signature → Task 2. ✓
- Bump cache SW → Task 4. ✓

**Cohérence des types :** `getTime`/`setTime` conservent exactement la signature consommée par `renderSaisie`/`sauvegarder`/`effacerJour`. Les 4 fonctions pures de Task 1 sont consommées telles quelles dans Task 2. ✓

**Pas de placeholder :** chaque step contient le code complet et les commandes exactes. ✓

**Limitation connue documentée :** une minute saisie qui s'arrondit à ≥ 60 (ex. `1158`) est rejetée (champ vidé) plutôt que reportée à l'heure suivante — cas rare, l'utilisateur ressaisit. Comportement volontaire pour rester prévisible.
