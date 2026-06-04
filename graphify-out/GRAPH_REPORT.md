# Graph Report - .  (2026-06-04)

## Corpus Check
- Corpus is ~2,821 words - fits in a single context window. You may not need a graph.

## Summary
- 114 nodes · 167 edges · 18 communities (8 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Couche Données AST|Couche Données AST]]
- [[_COMMUNITY_Stockage Local & Sync|Stockage Local & Sync]]
- [[_COMMUNITY_Interface Saisie|Interface Saisie]]
- [[_COMMUNITY_Fichiers du Projet|Fichiers du Projet]]
- [[_COMMUNITY_Sauvegarde GitHub|Sauvegarde GitHub]]
- [[_COMMUNITY_Manifeste PWA|Manifeste PWA]]
- [[_COMMUNITY_Authentification PIN|Authentification PIN]]
- [[_COMMUNITY_Suppression Employés|Suppression Employés]]
- [[_COMMUNITY_Accordéon UI|Accordéon UI]]
- [[_COMMUNITY_Page Code PIN|Page Code PIN]]
- [[_COMMUNITY_Page Détail|Page Détail]]
- [[_COMMUNITY_Page Employés|Page Employés]]
- [[_COMMUNITY_Accueil|Accueil]]
- [[_COMMUNITY_Page PIN|Page PIN]]
- [[_COMMUNITY_Espace Responsable|Espace Responsable]]
- [[_COMMUNITY_Saisie Heures|Saisie Heures]]
- [[_COMMUNITY_Paramètres Sync|Paramètres Sync]]

## God Nodes (most connected - your core abstractions)
1. `load()` - 15 edges
2. `load()` - 13 edges
3. `save(data)` - 11 edges
4. `save()` - 7 edges
5. `getSyncConfig()` - 7 edges
6. `calcRecap(mois)` - 7 edges
7. `localStorage` - 7 edges
8. `showSection(id)` - 7 edges
9. `syncToGist(data)` - 6 edges
10. `getSyncConfig()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `renderSaisie()` --calls--> `getPointages(employeId, date)`  [EXTRACTED]
  index.html → data.js
- `renderSyncStatus()` --calls--> `getSyncConfig()`  [EXTRACTED]
  index.html → data.js
- `activerSync()` --calls--> `setupSync(token)`  [EXTRACTED]
  index.html → data.js
- `activerSync()` --calls--> `updateSyncBadge(ok)`  [EXTRACTED]
  index.html → data.js
- `updateSyncBadge(ok)` --renders--> `#sync-badge`  [EXTRACTED]
  data.js → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **savePointage → save → syncToGist data flow** — fn_save_pointage, fn_save, fn_sync_to_gist, github_gist_api, local_storage [INFERRED]
- **PIN authentication flow** — section_pin, fn_valider_pin, fn_verify_pin, fn_hash_pin, web_crypto, section_responsable [INFERRED]
- **Employee CRUD operations** — fn_add_employe, fn_rename_employe, fn_delete_employe, fn_get_employes, fn_load, fn_save, local_storage [INFERRED]
- **GitHub Gist sync setup and restore** — fn_setup_sync, fn_sync_to_gist, fn_restore_from_gist, fn_get_sync_config, fn_set_sync_config, github_gist_api [INFERRED]

## Communities (18 total, 10 thin omitted)

### Community 0 - "Couche Données AST"
Cohesion: 0.16
Nodes (21): addEmploye(), calcRecap(), changePin(), cloturerMois(), deleteEmploye(), exportData(), getEmployes(), getPointages() (+13 more)

### Community 1 - "Stockage Local & Sync"
Cohesion: 0.14
Nodes (18): Data Schema, DB_KEY (restaurant_v1), addEmploye(nom), ajouterEmploye(), changePin(ancienPin, nouveauPin), confirmerSuppression(), deleteEmploye(id), exportData() (+10 more)

### Community 2 - "Interface Saisie"
Cohesion: 0.18
Nodes (17): App State Variables, calcRecap(mois), changerJour(delta), changerMois(delta), cloturerMois(mois), cloturerMoisAction(), exportTableau(), formatDate(iso) (+9 more)

### Community 3 - "Fichiers du Projet"
Cohesion: 0.18
Nodes (8): manifest.json (PWA Manifest), Restaurant PWA App, SW activate event, CACHE (pointage-v5), SW fetch event, FILES, SW install event, sw.js (Service Worker)

### Community 4 - "Sauvegarde GitHub"
Cohesion: 0.27
Nodes (11): activerSync(), getSyncConfig(), renderSyncStatus(), restoreFromGist(), setSyncConfig(cfg), setupSync(token), syncToGist(data), updateSyncBadge(ok) (+3 more)

### Community 5 - "Manifeste PWA"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 6 - "Authentification PIN"
Cohesion: 0.50
Nodes (4): hashPin(pin), validerPin(), verifyPin(pin), Web Crypto API

## Knowledge Gaps
- **29 isolated node(s):** `name`, `short_name`, `start_url`, `display`, `background_color` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `load()` connect `Stockage Local & Sync` to `Interface Saisie`, `Sauvegarde GitHub`, `Authentification PIN`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `showSection(id)` connect `Interface Saisie` to `Stockage Local & Sync`, `Sauvegarde GitHub`, `Authentification PIN`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `save(data)` connect `Stockage Local & Sync` to `Interface Saisie`, `Sauvegarde GitHub`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `start_url` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Stockage Local & Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.13852813852813853 - nodes in this community are weakly interconnected._