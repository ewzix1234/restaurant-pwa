# Design — Saisie rapide + réorganisation navigation

**Date :** 2026-06-30
**App :** restaurant-pwa (PWA de pointage des heures, mono-fichier `index.html` + `data.js` + `style.css`)

## Problème

Le gérant trouve la saisie des heures **trop lente** par rapport à une simple calculette : on perd du temps. Deux causes :

1. **Saisie par menus déroulants** — chaque heure se saisit avec 2 `<select>` (heures + minutes). Pour une journée complète (Midi début/fin + Soir début/fin) = jusqu'à **8 menus déroulants**, chacun nécessitant tap → scroll → valider sur mobile. Les horaires sont **variables** (changent souvent), donc le gérant ressaisit tous les jours.
2. **Navigation encombrée** — l'Espace Responsable entasse 7 boutons mélangeant rapports et configuration technique ; revenir à l'accueil oblige à enchaîner plusieurs « ← Retour ».

## Objectifs

- Saisie d'une journée la plus proche possible d'une calculette : taper des chiffres, pas de scroll.
- Espace Responsable recentré sur les rapports ; configuration technique isolée et protégée.
- Retour à l'accueil en un seul tap depuis n'importe quel écran.
- **Aucune perte de données** : le format de stockage et le modèle de données ne changent pas.

## Non-objectifs (YAGNI)

- Pas de raccourcis « shifts pré-remplis » (écarté lors du brainstorming).
- Pas de refonte visuelle globale ni de migration de données.
- Pas de suppression de fonctionnalité — uniquement réorganisation.

---

## Chantier 1 — Saisie ultra-rapide (frappe directe)

### Principe

Remplacer, pour chaque heure, le couple `<select class="tp-h">` + `<select class="tp-m">` par **un seul champ texte numérique** (`inputmode="numeric"`) où l'on tape les chiffres comme sur une calculette.

### Comportement d'un champ heure

- **Clavier numérique** : `inputmode="numeric"` → pavé numérique direct sur mobile, aucun scroll.
- **Formatage à la volée** : en tapant `1`,`1`,`3`,`0` l'affichage devient `11h30`. Le champ n'accepte que des chiffres.
- **Frappes partielles tolérées** (souplesse calculette) :
  - `11` → `11h00`
  - `9` → `09h00`
  - `930` → `09h30`
  - `1130` → `11h30`
  - Règle : 1–2 chiffres = heure (minutes = 00) ; 3–4 chiffres = HHMM (les 1–2 premiers = heure, les 2 derniers = minutes).
- **Sélection-tout au focus** : au focus, le contenu est sélectionné → taper remplace immédiatement la valeur existante. Les valeurs par défaut (Midi 11h00, Soir 18h30) restent un point de départ mais ne gênent jamais.
- **Saut automatique** : dès qu'une heure complète et non-ambiguë est saisie (4 chiffres, ou validation au blur), le focus passe au champ suivant dans l'ordre : Midi-Début → Midi-Fin → Soir-Début → Soir-Fin.
- **Normalisation au blur** : quand on quitte le champ, la valeur est normalisée et bornée (heures 06–23, minutes arrondies aux 5 min comme aujourd'hui ; valeurs hors plage corrigées ou vidées).

### Stockage — INCHANGÉ

La valeur reste stockée au format `"HH:MM"` (ex. `"11:30"`). `savePointage` / `getPointages` / les calculs de durée ne changent pas. **Aucune migration**, les pointages déjà saisis restent valides.

### Impact technique

Fichier `index.html` :

- **HTML** (lignes ~66–79) : remplacer chaque `<div class="time-picker">…<select>…</select>…</div>` par un `<input type="text" inputmode="numeric" class="time-input" id="midi-debut" …>`.
- **JS** :
  - Supprimer `buildTimePickers()` (plus de `<select>` à peupler).
  - Réécrire `getTime(id)` : lit l'input, parse l'affichage `HHhMM` → retourne `"HH:MM"` ou `""`.
  - Réécrire `setTime(id, val)` : écrit la valeur `"HH:MM"` formatée en `HHhMM` dans l'input (ou vide).
  - Ajouter une fonction de **parsing/formatage** des chiffres saisis (`parseTimeInput(raw) → "HH:MM" | ""`) et brancher les écouteurs `input` (formatage live + saut auto) et `blur` (normalisation).
- **CSS** (`style.css`) : ajouter `.time-input` (champ large, gros chiffres, `text-align:center`, hauteur ≥ 44px pour le touch target, `font-variant-numeric: tabular-nums`). Retirer/laisser inutilisés `.time-picker .tp-h .tp-m`.

`renderSaisie`, `sauvegarder`, `effacerJour`, `setConge` continuent d'utiliser `getTime`/`setTime` sans changement de signature.

---

## Chantier 2 — Réorganisation de l'Espace Responsable

### Avant

Dashboard `section-responsable` = 7 boutons mélangés :
`📊 Tableau` · `📅 Semaines` · `🏖 Congés` · `Imprimer` · `🔑 Code PIN` · `⚙️ Réglages (token GitHub)` · `🔴 Clôturer le mois`
+ sections séparées `section-sync` (sauvegarde) et `section-code` (PIN).

### Après

**Dashboard = rapports uniquement** (5 boutons) :
`📊 Tableau / PDF` · `📅 Semaines` · `🏖 Congés` · `Imprimer` · `🔴 Clôturer le mois`
+ petite icône **⚙️** dans le header (haut droite) → ouvre la page Réglages.

**Nouvelle page `section-reglages`** (derrière le PIN, réglée une fois) regroupe ce qui était éparpillé :
- `☁ Sauvegarde automatique` (token GitHub, activer, restaurer) — contenu actuel de `section-sync`.
- `📁 Sauvegarde manuelle` (exporter / importer fichier) — contenu actuel de `section-sync`.
- `🔑 Changer le code PIN` — contenu actuel de `section-code`.

### Décision de sécurité

Les Réglages restent **derrière le PIN** (accessibles uniquement depuis l'Espace Responsable déverrouillé), car le token GitHub donne un accès en écriture à toutes les données et le changement de PIN doit rester protégé. On ne les expose **pas** sur l'accueil (écran utilisé par les employés).

### Impact technique

- `section-responsable` (lignes ~112–120) : retirer les boutons `🔑 Code PIN` et `⚙️ Réglages` de la barre ; ajouter une icône ⚙️ dans le header.
- Fusionner `section-sync` + `section-code` en une seule `section-reglages` (la page Réglages contient les 3 blocs : sauvegarde auto, sauvegarde manuelle, code PIN). Les anciens id `section-sync` / `section-code` peuvent être supprimés une fois le contenu déplacé ; vérifier qu'aucun `showSection('section-sync'|'section-code')` ne subsiste ailleurs.
- Les fonctions JS (`activerSync`, `restaurerDepuisGist`, `exportData`, `importerFichier`, `changerCode`, accordéons) restent identiques ; seuls leurs conteneurs déménagent.

---

## Chantier 3 — Bouton accueil 🏠 persistant

### Principe

Un **bouton accueil 🏠** affiché en haut à gauche de chaque écran **sauf l'accueil** (`section-home`). Un seul tap → retour direct à `section-home`, sans enchaîner les « ← Retour ».

### Comportement

- Position constante : header en haut à gauche. Quand un écran a aussi l'engrenage (Espace Responsable), 🏠 à gauche / ⚙️ à droite.
- Action : `showSection('section-home')`.
- Les boutons « ← Retour » contextuels existants peuvent rester pour le pas-à-pas ; le 🏠 est le raccourci d'évasion.
- Depuis l'Espace Responsable, revenir à l'accueil sort de la zone déverrouillée (re-saisie du PIN nécessaire pour y revenir) — comportement attendu et cohérent avec la sécurité.
- Touch target ≥ 44×44 px, `aria-label="Accueil"`.

### Impact technique

- Ajouter un petit header/barre (ou un bouton flottant cohérent) en haut des sections concernées dans `index.html`.
- CSS dans `style.css` pour le bouton accueil et l'alignement header (🏠 gauche / ⚙️ droite).
- Aucune logique métier touchée : c'est de la navigation (`showSection`).

---

## Validation / tests manuels

1. **Saisie** : sur mobile, taper `1130` dans Midi-Début → affiche `11h30`, focus saute à Midi-Fin. Enregistrer, recharger, rouvrir le jour → `11h30` toujours là (format `"11:30"` en storage).
2. **Frappes partielles** : `11`→`11h00`, `9`→`09h00`, `930`→`09h30`.
3. **Validation** : fin ≤ début → message d'erreur inchangé.
4. **Congés** : chips congé continuent de vider/griser les services correctement.
5. **Navigation** : ⚙️ ouvre Réglages (token GitHub, sauvegarde manuelle, PIN tous présents et fonctionnels). Dashboard ne montre plus que les 5 boutons rapports.
6. **Accueil** : 🏠 visible sur tous les écrans sauf l'accueil ; un tap revient à l'accueil depuis la saisie ET depuis l'Espace Responsable.
7. **Service worker** : incrémenter la version de cache (`sw.js`) pour invalider l'ancien cache après déploiement.
