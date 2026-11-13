# Clutch

Application macOS pour piloter plusieurs projets et plusieurs sessions Claude Code depuis une seule fenêtre : terminaux, skills, diff, suivi des tâches.

---

## 1. Vue métier

### Le problème

Un développeur qui travaille avec Claude Code jongle avec plusieurs projets (souvent un front et un back), plusieurs sessions Claude en parallèle, parfois deux comptes (Pro / Perso), et un outil de tickets (ClickUp). Avec un terminal classique :

- chaque projet demande d'ouvrir les bons onglets, dans les bons dossiers, avec les bonnes commandes ;
- on ne sait pas quelle session Claude travaille encore et laquelle attend une réponse ;
- on ne voit pas ce que Claude a modifié sans aller dans un autre outil ;
- les prompts récurrents et les skills se retapent à la main ;
- le lien entre un ticket et la session qui le traite n'existe que dans la tête.

### Ce que fait Clutch

| Besoin | Réponse de Clutch |
|---|---|
| Ouvrir un projet en un clic | **Projets (presets)** : dossier, couleur, compte Claude et la liste des terminaux à ouvrir (racine, `front`, `back`, Claude, shell ou commande comme `npm run dev`), avec leur disposition. |
| Voir plusieurs terminaux à la fois | **Onglets ou grille** : côte à côte, empilés, grille, « 1 + pile », « 1 + rangée ». Séparations redimensionnables, terminaux déplaçables par glisser-déposer, passage grille ↔ onglets. |
| Savoir où en est Claude | **Indicateurs d'état** sur les onglets, les en-têtes et la liste des projets : rond qui tourne quand Claude travaille, bulle qui pulse quand il attend une réponse. **Son de fin** au choix (sons synthétisés ou sons du Mac, dont « Brise »). |
| Voir ce que Claude a changé | Onglet **Modifications** du panneau de droite (partagé avec le kanban, l'inbox et les temps, un seul visible à la fois ; un bouton en haut à droite l'ouvre et le ferme sur le dernier onglet affiché, `side.last` dans `data.json`), en direct, depuis l'ouverture de l'onglet ou depuis le dernier commit. |
| Relancer les prompts et skills habituels | **Barre de prompt** (vers le terminal actif ou tous), **prompts enregistrés**, **skills** Claude Code listés et lancés via un formulaire avec aperçu. |
| Séparer pro et perso | **Espaces par compte Claude** (facultatif) : chaque compte a ses projets, onglets, skills et historique. |
| Ne voir que ce dont on se sert | **Fonctionnalités au choix** (⚙ → Fonctionnalités) : kanban, inbox ClickUp, temps et comptes multiples sont masqués sur une nouvelle installation, chacun coche ce qu'il veut. |
| Suivre les tâches et les relier à Claude | **Un seul kanban pour tous les projets**, en liste (une colonne à la fois) ou en tableau (chaque carte porte son projet, filtre par projet, colonnes communes réglables, par défaut À faire, En cours, À relire), tickets **ClickUp** importés par leur numéro, lancement d'un skill sur une carte, mise à jour du tableau par un skill Claude. |
| Vérifier ses heures | Onglet **Temps** : temps loggés dans ClickUp par jour et par ticket, face à l'objectif quotidien (7 h par défaut). |
| Trier les nouveaux tickets | **Inbox ClickUp** : tickets à trier des listes ClickUp suivies (⚙ → Inbox) ; « Ignorer » ou « À faire » (assignation et statut de la première colonne dans ClickUp + carte dans le kanban, dans le projet de la liste du ticket). |
| Tenir ClickUp à jour sans y penser | **Synchro ClickUp** (par projet, désactivée par défaut) : quand une carte liée passe en « En cours » puis en « À relire », le ticket avance (« dev en cours », puis « revue de code à faire ») et le temps passé en « En cours » est proposé dans une fenêtre : on le corrige, puis on l'envoie sur le ticket. |
| Surveiller sa consommation | **Jauge d'utilisation** du forfait Claude (session de 5 h et semaine). |
| Préférer une vue « conversation » | **Thème Conversation** : sessions Claude affichées en bulles, actions résumées en cartes, autorisations en boutons. |
| Rester à jour sans ligne de commande | **Bouton « Mise à jour »** qui apparaît quand le dépôt a avancé, puis reconstruit et relance l'app. |

### Parcours type

1. Le matin, clic sur le projet *jefacture* : Claude s'ouvre à la racine, un shell dans `front`, un `npm run dev` dans `back`, en disposition « 1 + pile ».
2. `⌘B` ouvre le kanban, le même pour tous les projets. « + Ticket » puis `CICD-42` crée la carte à partir du ticket ClickUp (titre, description, priorité, échéance…), dans le projet qui a déjà des cartes de sa liste.
3. Clic sur la carte → choix du skill `ticket` et du projet → Entrée : une session Claude démarre avec `/ticket CICD-42 (tâche kanban t-…)`.
4. Le skill fait passer la carte en « En cours », puis « À relire ». Le tableau se met à jour tout seul et fait briller la carte déplacée. Si la synchro est activée sur le projet, le ticket passe en « dev en cours », puis en « revue de code à faire », et une fenêtre propose les 47 minutes passées en « En cours » : tu les corriges si besoin, puis « Envoyer » les logge dans ClickUp.
5. Pendant ce temps, l'onglet « Modifications » compte les fichiers modifiés (le diff s'ouvre seul si le kanban n'est pas affiché). Quand Claude a fini, le son « Brise » retentit et l'onglet affiche une bulle : c'est à toi.
6. Le soir, la croix ferme la fenêtre mais garde les sessions vivantes (comme Discord) ; un clic sur l'icône du Dock la rouvre.

### Glossaire

- **Preset / projet** : un dossier et la façon de l'ouvrir.
- **Espace** : l'ensemble des projets et onglets d'un compte Claude (Pro, Perso…).
- **Groupe** : des terminaux affichés ensemble dans une disposition.
- **Skill** : une commande Claude Code (`/nom`), perso, de projet, de plugin ou synchronisée depuis claude.ai ; ou un modèle de prompt créé dans Clutch.
- **Carte / tâche** : une ligne du kanban, éventuellement liée à un ticket ClickUp.

---

## 2. Vue technique

### Pile

| Élément | Choix |
|---|---|
| Application | Electron 45 (macOS), sans framework front : HTML, CSS et JavaScript simples |
| Terminaux | `node-pty` (pseudo-terminaux natifs) + `@xterm/xterm` 6 avec les extensions `fit` et `web-links` |
| Sessions conversation | `claude -p --input-format stream-json --output-format stream-json` |
| Paquet | `@electron/packager`, sans asar (node-pty est natif) |
| Données | JSON dans le dossier de l'app (`~/Library/Application Support/Clutch`) et dans chaque projet (`.clutch/kanban.json`) |

Environ 5 000 lignes au total.

### Arborescence

```
main.js              Processus principal : fenêtre, pty, git, Claude stream-json, skills,
                     kanban, ClickUp, mises à jour, utilisation, sons, persistance
preload.js           Pont sécurisé : expose window.api (IPC) au rendu
renderer/
  index.html         Structure de la fenêtre, fenêtres modales, CSP
  renderer.js        Cœur de l'interface : état, onglets, groupes, presets, skills,
                     palette ⌘K, diff, thèmes, fond, sons, utilisation, mises à jour
  chat.js            Vue conversation (thème Conversation) au-dessus de stream-json
  kanban-cols.js     Colonnes du kanban et rangement des statuts (chargé aussi par main.js)
  kanban.js          Tableau des tâches, glisser-déposer, import ClickUp
  inbox.js           Inbox ClickUp reconstituée : tri des tickets, choix des projets suivis
  times.js           Temps loggés dans ClickUp, par jour, face à l'objectif quotidien
  icons.js           Pictogrammes SVG au trait (style Lucide)
  styles.css         Thèmes par variables CSS, mises en page, composants
build/
  make-app.sh        Construit Clutch.app, l'installe et l'épingle au Dock
  icon.svg / .png    Logo (disque d'embrayage)
docs/CLUTCH.md       Ce document
```

### Architecture

```
┌──────────────────────────── Processus principal (main.js) ────────────────────────────┐
│ node-pty ── shells/claude     git (diff, fs.watch)     claude stream-json            │
│ data.json / secrets.json      .clutch/kanban.json (fs.watchFile)     api.clickup.com  │
└───────────────▲───────────────────────────── IPC ─────────────────────────▲───────────┘
                │ invoke / send                                  events     │
┌───────────────┴──────── preload.js (contextBridge → window.api) ──────────┴───────────┐
└───────────────▲─────────────────────────────────────────────────────────────────────────┘
┌───────────────┴──────────── Rendu (renderer/*.js, contextIsolation) ────────────────────┐
│ state (presets, onglets, groupes, thème…)  xterm.js  chat  kanban  diff  palette       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- `contextIsolation` actif : le rendu n'a pas accès à Node, seulement aux fonctions de `window.api`.
- CSP stricte : scripts et styles locaux, images locales ou `data:`.
- Les liens externes (clic dans un terminal, `window.open`) s'ouvrent dans le navigateur par défaut, jamais dans l'app.

### Canaux IPC

| Domaine | Canaux |
|---|---|
| Terminaux | `pty:create`, `pty:write`, `pty:resize`, `pty:kill` ; événements `pty:data`, `pty:exit` |
| Conversation Claude | `chat:start`, `chat:send`, `chat:respond`, `chat:interrupt`, `chat:kill`, `chat:sessions`, `chat:history` ; événements `chat:event`, `chat:stderr`, `chat:exit` |
| Git / diff | `git:track`, `git:untrack`, `git:diff` ; événement `git:changed` |
| Données | `data:load`, `data:save`, `dialog:folder`, `fs:subdirs` |
| Skills | `skills:scan` |
| Comptes / utilisation | `account:status`, `usage:get` |
| Kanban | `kanban:read`, `kanban:write`, `kanban:watch` (liste des dossiers du tableau) ; événement `kanban:changed` |
| ClickUp | `clickup:status`, `clickup:set-token`, `clickup:task`, `clickup:check-statuses`, `clickup:hierarchy`, `clickup:inbox`, `clickup:assign-me`, `clickup:advance`, `clickup:align`, `clickup:times`, `clickup:time-pending`, `clickup:time-confirm` ; événement `clickup:time-pending` `{ id, project, taskId, ref, title, start, duration }` ; événement `clickup:sync` `{ project, taskId, ref, action, ok, error?, detail?, status?, skipped?, queued? }` |
| Apparence / sons | `bg:pick`, `bg:read`, `win:bg`, `sound:system` |
| Mises à jour | `app:update-status`, `app:rebuild` ; événement `app:rebuild-log` |

### Fonctionnement détaillé

#### Terminaux

- Chaque terminal est un shell de login interactif (`$SHELL -l -i`), pour récupérer le PATH complet (nvm, brew, claude) même quand l'app est lancée depuis le Finder. Une commande de preset est lancée avec `-c "<commande>; exec $SHELL -l -i"` : à la fin de la commande, on retombe dans un shell au même endroit.
- Variables : `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=Clutch`, et `CLAUDE_CONFIG_DIR` selon le compte.
- `.term-body` est en `box-sizing: content-box` : sinon l'extension `fit` compte le padding et la dernière ligne est coupée.

#### Onglets, groupes et grille

- Chaque onglet peut appartenir à un groupe `{ id, layout, split, order, cols, rows }`. `applyLayout()` traduit le groupe actif en grille CSS : ordre des terminaux, cases fusionnées pour « 1 + pile » et « 1 + rangée », tailles en `fr`.
- Les poignées de redimensionnement sont calculées à partir des pistes réelles (`getComputedStyle(...).gridTemplateColumns/Rows`). Un double-clic remet des tailles égales.
- Le glisser-déposer (HTML5) permet d'échanger deux terminaux, de sortir un terminal vers la barre d'onglets, ou d'en déposer un sur un autre pour former une grille.
- Raccourcis lus avec `e.code` (touche physique) : `⌘1…9` fonctionne aussi en AZERTY.

#### État de Claude (travaille / attend)

- **Terminal** : Claude Code donne un titre au terminal (séquence OSC 0). `◐◑◒◓` signifie qu'il travaille, `✳` qu'il attend. Clutch l'écoute via `term.onTitleChange`. L'état « attend » s'efface quand on valide une saisie (Entrée) ou qu'on envoie un prompt.
- **Conversation** : déduit des événements stream-json (occupé, résultat, demande d'autorisation).
- Le passage de « travaille » à « attend » joue le son choisi : synthèse WebAudio, ou son système via `afplay -v <volume> /System/Library/Sounds/<Nom>.aiff` (« Brise » = `Blow.aiff`). Un délai de 1,5 s évite les répétitions.

#### Diff

- À l'ouverture d'un onglet, `git:track` trouve le dépôt qui contient le dossier, ou les dépôts des sous-dossiers sur deux niveaux (front/back). Il note un point de référence : `git stash create` (qui capture aussi les modifications non commitées) ou `HEAD`, plus la liste des fichiers non suivis.
- `fs.watch` récursif sur chaque dépôt (en ignorant `node_modules`, l'intérieur de `.git` sauf index/HEAD, et `.clutch`) déclenche `git:changed`, avec un délai de 400 ms.
- `git diff -M <référence>` plus `git diff --no-index` pour les nouveaux fichiers. Le patch est découpé et affiché par fichier, et limité à 2 000 lignes par fichier.

#### Vue conversation

- `claude -p --input-format stream-json --output-format stream-json …` lancé avec `spawn`. Les messages utilisateur sont écrits sur stdin, et les événements lus ligne par ligne.
- Les outils (lecture, modification, commande, recherche, plan…) sont rendus en cartes. Les demandes d'autorisation passent par le protocole de contrôle (`chat:respond`).
- `/resume` relit les sessions du projet dans le dossier de config du compte (`projects/<chemin encodé>/*.jsonl`).
- « Terminal » relance la même session (`claude --resume <id>`) dans un vrai terminal, dans le même groupe.

#### Skills

- Sources parcourues : `~/.claude/skills` et `~/.claude/commands` (perso), `skills/synced/*` (claude.ai, préfixe `anthropic-skills:`), `plugins/synced/*/*/skills` (préfixe `<plugin>:`), `.claude/skills` et `.claude/commands` de chaque projet. Le tout par compte (`CLAUDE_CONFIG_DIR`).
- Modèles de prompt : `{{cle}}`, `{{cle?}}` (facultatif), `{{cle:long}}` (zone de texte), `{{cle:a|b|c}}` (liste), plus `{{project}}`, `{{cwd}}` et `{{date}}` remplis automatiquement. Le formulaire est généré à partir du modèle, avec un aperçu en direct.
- Lancement dans un nouveau terminal Claude ou dans une session déjà ouverte (collage en « bracketed paste », puis Entrée).

#### Fonctionnalités au choix

- `data.json`, clé `features` : `{ kanban, inbox, times, accounts }`. Sans cette clé, une nouvelle installation n'en a aucune ; une installation qui a déjà des projets garde le kanban, l'inbox et les temps, et les comptes si elle en a.
- `feat(k)` dit si une fonction est cochée ; `applyFeatures` masque ce qui en dépend : onglets du panneau de droite, jauge du jour, bascule des comptes, onglets des paramètres (Comptes Claude, ClickUp, Inbox) et du formulaire de projet (ClickUp), raccourcis `⌘B` et `⌘I`, entrées de la palette. Rien n'est supprimé.
- L'inbox range ses tickets dans le kanban : la cocher coche le kanban, décocher le kanban la décoche.
- Sans les comptes multiples, `inSpace` réunit les projets et les onglets de tous les comptes dans un seul espace ; chaque session garde le compte de son projet.
- Fonction masquée, pas d'appel à ClickUp pour elle (jauge du jour, relecture de l'inbox). La synchro ClickUp d'un projet, elle, dépend de son réglage, pas de l'affichage du kanban.

#### Kanban

- **Un seul tableau** pour tous les projets de l'espace (`kanban.js`) : `kb.boards` tient un projet par dossier (`{ dir, preset, tasks, error… }`), lu et écrit séparément ; une carte se désigne par son dossier et son id (`kbKey`), deux projets pouvant avoir une tâche de même id. Chaque carte affiche son projet ; le filtre (`kanban.only` dans `data.json`, pastilles sous l'en-tête) n'en montre qu'un. Changer d'onglet ne change pas le tableau.
- **Deux affichages** (`kanban.view` dans `data.json`, bascule dans l'en-tête) : `list`, par défaut, montre une colonne à la fois (`kanban.col`), choisie dans une rangée d'onglets qui portent le nombre de cartes (`kbListView`, `kbRow`) ; `board` montre toutes les colonnes côte à côte. Les deux partagent les mêmes cartes (`.kb-card`), donc les mêmes clics, menus et raccourcis. En liste : bouton « → colonne suivante » sur chaque carte (`kbAdvance`), dépôt d'une carte sur un onglet pour la changer de colonne, ← → pour changer de colonne affichée, J K pour naviguer, M pour faire avancer ; la roue et le « + » à droite des onglets règlent ou ajoutent une colonne. L'agrandissement sur la place des terminaux ne vaut que pour le tableau.
- Le stockage reste par projet, `<projet>/.clutch/kanban.json` : un skill n'a que le fichier de son projet à modifier.
  ```json
  { "version": 1, "tasks": [ { "id": "t-a1b2c3", "title": "…", "description": "…",
    "status": "id de colonne (todo|in_progress|review par défaut) ou done", "created": "ISO", "updated": "ISO",
    "clickup": { "id": "…", "customId": "CICD-42", "url": "…", "status": "…", "statusColor": "#…", "priority": "…",
                 "assignees": [], "tags": [], "start": "AAAA-MM-JJ", "due": "AAAA-MM-JJ", "list": "…",
                 "creator": "…", "created": "AAAA-MM-JJ",
                 "subtasks": [], "checklists": [], "teamId": "…", "listId": "…" },
    "timing": { "startedAt": "ISO ou null", "loggedMs": 0 } } ] }
  ```
- `clickup.teamId` et `clickup.listId` sont stockés à l'import ; pour une carte plus ancienne, ils sont récupérés à la première synchro et sauvegardés. `timing` n'existe que pour les cartes synchronisées ; il est écrit uniquement par le processus principal.
- **Écriture** : fichier temporaire puis `rename`, pour qu'un lecteur ne voie jamais un fichier à moitié écrit.
- **Lecture en direct** : `fs.watchFile`, qui vérifie le fichier toutes les 700 ms. Ce mode fonctionne même si le fichier n'existe pas encore ou s'il est remplacé d'un bloc, comme le fait l'outil d'écriture de Claude. L'interface donne à main la liste des dossiers du tableau (`kanban:watch`) ; au changement d'un fichier, seul ce projet est relu.
- **Colonnes** : communes à tous les projets, réglées sur le tableau (clic sur l'en-tête d'une colonne, « + » en bout de tableau ; `kbColAction`, `kbSetCols`) et enregistrées dans `data.json`, clé `kanban.columns`, dans l'ordre d'affichage :
  ```json
  "kanban": { "columns": [ { "id": "todo", "label": "À faire", "status": "à faire", "timer": false },
                           { "id": "in_progress", "label": "En cours", "status": "dev en cours", "timer": true },
                           { "id": "review", "label": "À relire", "status": "revue de code à faire", "timer": false } ] }
  ```
  `id` est la valeur de `status` dans `kanban.json` ; il est tiré du nom à la création de la colonne (`kbNewColId` : « En test » donne `en_test`, « Fait » donne `done`) et ne change plus quand on la renomme. `status` est le statut ClickUp relié (facultatif), `timer` marque les colonnes dont le temps est compté. Un projet dont la liste ClickUp nomme ses statuts autrement garde les siens dans son preset, `kanban.statuses` (id de colonne → statut) : ils se règlent dans la même fenêtre, tableau filtré sur ce projet (`kbSetOwnStatus`), et disparaissent quand ils rejoignent le statut commun. `renderer/kanban-cols.js` porte ces règles (`kbColumns(preset, colonnes communes)`, `kbStatus`) ; il est chargé par l'interface et par `main.js`, pour que les deux rangent une tâche dans la même colonne.
- **Reprise des colonnes par projet** (`kbMigrateCols`, au premier lancement sans `kanban.columns`) : les colonnes communes sont la réunion de celles que chaque projet avait (`preset.kanban.columns`, ou les statuts de l'ancien réglage `clickupSync.todo|inProgress|review`), dans l'ordre de chaque projet, les projets synchronisés d'abord ; un statut relié qui n'est pas celui retenu devient un statut propre au projet. Aucune carte ne change de colonne. Les anciennes colonnes restent dans le preset, sans effet.
- **Tolérance** : un statut est rangé dans la colonne dont il donne l'id ou le nom, sinon par ses variantes courantes (`doing`, `to review`, `en cours`, `fait`…), sinon dans la première colonne. Une tâche en `done` n'a pas de colonne, sauf si le tableau en a une avec cet id : elle reste dans le fichier sans être affichée. Les cartes d'une colonne supprimée vont dans la première. Une tâche sans `id` ou sans `title` est ignorée. Les champs inconnus sont conservés.
- **JSON invalide** : les cartes du projet touché restent affichées en lecture seule et rien n'est écrasé ; les autres projets restent modifiables. Le bandeau dit quel fichier est cassé et où (`kanban:read` renvoie `line`, retrouvée dans le message d'analyse), propose de demander la réparation à Claude, et garde le message technique sous « Détail ».
- Les cartes changées depuis l'extérieur sont repérées en comparant les statuts avec la lecture précédente, puis mises en évidence 2 s.
- Une saisie en cours (nouvelle tâche, modification) survit aux rafraîchissements.
- **Lancement depuis une carte** : la fenêtre des skills affiche d'abord la fiche de la tâche (`kbTicketInfo` : tout ce que la carte garde du ticket, description rendue en Markdown), puis le choix du skill (dont « Juste la tâche ») et une ligne de résumé ; le projet, la cible et le prompt sont repliés tant qu'aucun champ obligatoire n'est vide. La fiche vient du fichier, pas d'un appel à ClickUp : ⟳ sur la carte la met à jour. La tâche remplit le champ `arguments`, `tache`, `ticket`… avec son identifiant, `(tâche kanban t-…)`, pour que le skill retrouve la carte.
- **Carte** : projet (quand le tableau en montre plusieurs), statut ClickUp en pastille, priorité haute ou urgente, échéance datée, initiales, chrono en cours (colonne chronométrée) et temps loggé. Atteignable au clavier (`tabindex`), ← → la changent de colonne, ↵ l'ouvre, clic droit pour « Déplacer vers » et « Changer de projet ».
- **Ordre** : dans une colonne, les cartes d'un même projet se suivent, dans l'ordre de son fichier. Déposée devant une carte d'un autre projet, une carte se place avant la suivante du sien (`kbMoveCard`).
- **Ajout** (`kbOpenAdd`, `kbAddTicket`) : le projet de destination est affiché (« dans … ») : celui du filtre, sinon celui de l'onglet actif. Sans choix à la main, un ticket ClickUp rejoint le projet qui a déjà le plus de cartes de sa liste (`kbListBoard`, par `clickup.listId`, à défaut le nom de la liste). Un ticket déjà présent dans un autre projet est signalé comme doublon.
- **Changer de projet** (`kbChangeProject`) : la carte est écrite dans le fichier du nouveau projet avant d'être retirée de l'ancien (au pire un doublon, jamais une perte) ; elle garde sa colonne, et reçoit un nouvel id si le sien y existe déjà.
- **Écart avec ClickUp** (`kbDiverges`) : projet synchronisé, colonne reliée à un statut et `clickup.status` différent. La pastille devient « ≠ statut » ; « Passer le ticket en … » appelle `clickup:align` (action de statut forcée, y compris en arrière), « Laisser » note l'écart vu dans `ack` sur la carte.

#### ClickUp

- La clé API (`pk_…`) est vérifiée par `GET /api/v2/user`, puis chiffrée avec `safeStorage` (trousseau macOS) dans `secrets.json`, avec les droits `0600`. Elle ne revient jamais au rendu : seuls « configuré » et le nom d'utilisateur sont renvoyés.
- **Numéros acceptés** : id ClickUp (`86c0abc12`, `#86c0abc12`), id personnalisé (`CICD-123`) ou lien `app.clickup.com/t/[équipe/]id`.
- **Requêtes** : `GET /api/v2/task/{id}?include_markdown_description=true&include_subtasks=true`. Pour un id personnalisé, on ajoute `custom_task_ids=true&team_id=…` en essayant chaque espace de travail du compte (`GET /team`, gardé en cache).
- Les appels partent du processus principal (`fetch` de Node), pas du rendu.

#### Synchro ClickUp

Faite par le processus principal, jamais par les skills : elle se déclenche quelle que soit l'origine du changement (interface, glisser-déposer, skill Claude qui réécrit le fichier).

**Réglages par preset** (`data.json`, onglet ClickUp du formulaire du projet) :
```json
"clickupSync": { "enabled": false, "logTime": true }
```
Les statuts ClickUp sont ceux reliés aux colonnes du kanban (`kanban.columns[].status` de `data.json`, remplacés par `kanban.statuses` du preset quand le projet a les siens, voir Kanban) ; main les reçoit à chaque sauvegarde (`syncConfigChanged(presets, colonnes)`). Un preset sans synchro reste enregistré sans cette clé, et rien ne change pour lui. Le bouton **Vérifier** prend une carte liée du kanban, lit les statuts de sa liste (`GET /list/{listId}`) et signale les noms introuvables ; ces statuts sont aussi proposés dans le champ « Statut ClickUp » de chaque colonne (lus à l'ouverture du formulaire).

**Détection des transitions** (`kanbanSnapshot`) :
- une table en mémoire par projet (id de tâche → statut tel qu'écrit), comparée à chaque nouvelle lecture ou écriture : `kanban:read`, `kanban:write`, chaque déclenchement de `watchFile` ;
- au premier chargement d'un projet, la table est remplie sans rien déclencher ;
- la table est mise à jour avant tout appel réseau : l'écriture de l'interface relue ensuite par `watchFile` ne voit plus de différence, une transition ne part donc qu'une fois ;
- tous les projets dont la synchro est activée sont surveillés, que leur panneau soit ouvert ou non ;
- l'ancien et le nouveau statut sont rangés en colonnes au moment de comparer (`kbStatus`, variantes `doing`, `en cours`… comprises) : modifier les colonnes du tableau ne crée pas de transition.

**Règles** (uniquement pour les cartes qui ont `clickup.id`) :

| Déplacement de la carte | ClickUp | Temps |
|---|---|---|
| vers une colonne plus à droite qui a un statut relié | `PUT` vers ce statut seulement si le ticket est au statut relié à une colonne précédente | selon les colonnes, ci-dessous |
| vers une colonne plus à gauche | rien | selon les colonnes, ci-dessous |
| entrée dans une colonne « chrono » | selon le sens, ci-dessus | `startedAt = maintenant` (nouveau segment) ; d'une colonne chrono à une autre, le chrono continue |
| d'une colonne chrono vers une colonne plus à droite sans chrono | selon le sens, ci-dessus | segment clos ; s'il dure au moins 60 s et que `logTime` est actif : le temps est mis en attente et proposé à l'utilisateur (voir ci-dessous) |
| passage en `done` sans colonne « done » | rien | rien |

Avec les colonnes par défaut : `todo → in_progress` passe le ticket de « à faire » à « dev en cours » et lance le chrono ; `in_progress → review` le passe en « revue de code à faire » s'il est « à faire » ou « dev en cours » et propose le temps ; `todo → review` le passe aussi en « revue de code à faire », sans temps.

- Le statut ClickUp est toujours relu (`GET /task/{id}`) juste avant le `PUT` : un ticket n'est jamais reculé, et un ticket déjà plus avancé est laissé tel quel.
- **Statut affiché sur la carte** : après chaque synchro de statut, main écrit le statut réel du ticket dans `clickup.status` de la carte (le nouveau après un `PUT`, celui relu si rien n'a été changé) et le joint à l'événement `clickup:sync` : la carte est à jour sans passer par ⟳.
- Noms comparés sans casse, accents ni espaces en trop. Avant le `PUT`, le nom réglé est remplacé par le nom exact du statut dans la liste du ticket (`GET /list/{listId}`, gardé 10 min) : ClickUp refuse un nom qui n'est pas identique (« revue de code à faire » pour « revue de code a faire »). Un statut absent de la liste donne une erreur explicite qui cite les statuts disponibles.
- L'id natif `clickup.id` est utilisé pour le `PUT` et le temps, jamais `customId`.
- Aucun commentaire n'est créé dans ClickUp.
- **Temps à valider** : le temps n'est jamais loggé tout seul. Main garde la proposition dans `clickupPendingTime` (`data.json`) et envoie l'événement `clickup:time-pending` ; l'interface affiche une fenêtre par proposition en bas à droite, au-dessus des notifications, sans prendre le focus (un skill peut déplacer la carte pendant qu'on tape ailleurs). Elle montre la durée arrondie à la minute, modifiable en heures et minutes. « Envoyer » appelle `clickup:time-confirm(id, durée en ms)` : l'entrée part dans la file (`POST /team/{teamId}/time_entries` `{ tid, start, duration }`, puis `loggedMs += durée`), la fin du segment est conservée et le début recalculé à partir de la durée corrigée. « Ne pas logger » appelle `clickup:time-confirm(id, 0)` : rien n'est envoyé. Les propositions sans réponse sont relues au démarrage de l'interface (`clickup:time-pending`) et réaffichées.
- `timing` est écrit par main (relecture du fichier puis écriture atomique) ; ces écritures ne changent aucun statut et ne déclenchent donc pas de transition. Quand l'interface sauvegarde (`kanban:write`), main reprend sa propre valeur de `timing`, `teamId` et `listId`, pour qu'une sauvegarde faite avant relecture ne les efface pas. Si un skill réécrit la carte sans `timing`, le `startedAt` gardé en mémoire sert de secours.

**Erreurs et reprise** :
- les erreurs ClickUp passent par `clickupError` : connexion coupée, clé refusée, accès refusé, élément introuvable, limite de requêtes et erreur serveur ont chacune un message qui dit quoi faire ; les erreurs levées par Clutch (statut absent de la liste…) gardent leur texte ;
- chaque action (statut ou temps) passe par une file traitée une par une ;
- réseau coupé, 429 ou erreur 5xx : l'action reste en file, avec de nouvelles tentatives après 30 s, 2 min, 10 min, 30 min puis toutes les heures, et une reprise au démarrage de l'app ;
- autres erreurs (clé absente ou refusée, ticket introuvable) : l'action est abandonnée et signalée ;
- la file (`clickupQueue`), les temps en attente de validation (`clickupPendingTime`) et les clés des entrées de temps déjà créées (`clickupLogged`, `taskId:startedAt`, 500 dernières) sont dans `data.json`. Ces clés sont tenues par main : la sauvegarde de l'interface, qui réécrit tout le fichier, les conserve ;
- idempotence : le statut est relu avant chaque `PUT`, et une entrée de temps dont la clé est déjà connue n'est pas recréée ;
- chaque résultat (succès, refus, mise en file) est ajouté à `clickup-sync.log` dans le dossier de l'app, sans la clé ;
- côté interface : un succès donne une notification discrète ; un échec donne une notification visible et un marqueur « non synchronisé » sur la carte, retiré au succès suivant. La carte affiche aussi le temps loggé et un point quand le chrono tourne.

#### Inbox ClickUp

- ClickUp n'expose pas son Inbox (notifications) dans l'API publique : Clutch la reconstitue à partir des listes ClickUp suivies.
- **Réglages** (onglet « Inbox » des paramètres, ouvert aussi par la roue de l'en-tête de l'inbox ; `openInboxSettings`) : rien à valider, chaque choix est enregistré et l'inbox relue aussitôt.
- **Listes suivies** : `clickup:hierarchy` lit `GET /team`, puis par espace de travail `GET /team/{id}/space`, et par espace `GET /space/{id}/folder` et `GET /space/{id}/list` (listes hors dossier). Le résultat est gardé dans `clickup-hierarchy.json` (dossier de l'app) : l'interface affiche d'abord cette copie (`clickup:hierarchy` avec `cached`), puis relit ClickUp une fois par session (⟳ pour forcer). Un champ de recherche filtre espaces, dossiers et listes (résultats à plat avec leur chemin, Entrée suit le premier) ; sans recherche, l'arbre à cocher. La sélection est rappelée en pastilles et enregistrée dans `data.json`, clé `inbox.sources` : `[{ kind: "space"|"folder"|"list", id, teamId, name }]`. Suivre un parent retire ses enfants de la sélection.
- **Tickets** : `clickup:inbox` envoie une requête `GET /team/{teamId}/task?space_ids[]|project_ids[]|list_ids[]=…&subtasks=true&order_by=updated` par source, jusqu'à 10 pages de 100 tickets. Il fait une requête par source parce que ClickUp combine ces filtres en ET. Les tickets fermés sont exclus. Les tickets ouverts sont gardés 5 min par main, tous statuts confondus, et filtrés à chaque demande : changer les statuts ne réinterroge pas ClickUp (`fresh` force la relecture). Les statuts (`inbox.statuses`, par défaut nouveau, à faire, rejeté) sont comparés sans tenir compte de la casse ni des accents, car leur nom exact varie d'une liste à l'autre. Sont gardés les tickets qui n'ont personne d'assigné ou qui sont assignés à l'utilisateur de la clé, plus ceux assignés à l'utilisateur dans un statut de `inbox.mineStatuses` (par défaut dev en cours).
- **Statuts à trier** : la réponse de `clickup:inbox` donne aussi les statuts rencontrés (`statuses` : nom, couleur, nombre de tickets à moi ou à personne, nombre à moi). Les réglages les listent avec trois choix par statut, « Masqué », « Si assigné à moi » (`inbox.mineStatuses`) et « À moi ou à personne » (`inbox.statuses`), et le nombre de tickets que le choix ferait apparaître ; un statut absent se tape à la main.
- **Détail** : un clic sur une ligne (ou Espace) relit le ticket (`clickup:task`) et l'affiche avec le même rendu que le kanban, plus les boutons Ignorer et À faire.
- **Clavier** : la liste prend le focus à l'ouverture ; J/K ou flèches, ↵, E, Espace, Z. Les tickets sont groupés par liste ClickUp.
- **Ignorer** : l'id est ajouté à `inbox.dismissed` (2 000 derniers), le ticket ne revient plus. La notification propose « Annuler » (dernier ticket ignoré seulement) ; « Tout rétablir » vide la liste des ignorés.
- **À faire** : `clickup:assign-me` (`PUT /task/{id}` avec `assignees.add`), puis `clickup:advance` (`PUT /task/{id}` avec `status`) qui passe le ticket au statut relié à la première colonne du kanban, tel que le projet de destination le nomme (par défaut à faire, nom exact relu dans la liste ; rien si la colonne n'a pas de statut) s'il est dans un statut de `inbox.statuses` ; un ticket dans un autre statut (dev en cours…) n'est pas modifié, et un échec n'empêche pas l'ajout de la carte. Le bouton porte le nom de cette colonne. Ensuite relecture du ticket et ajout d'une carte dans cette colonne, dans `.clutch/kanban.json` du projet de destination, comme un import par numéro. Ce projet (`ibRoute`) est celui choisi pour la liste ClickUp du ticket (`inbox.routes` : id de liste → id de projet, réglé sur l'en-tête de chaque liste dans l'inbox), sinon celui qui a déjà des cartes de cette liste, sinon celui de l'onglet actif. Les tickets déjà présents sur le tableau, quel que soit le projet, ne sont pas affichés dans l'inbox.
- Relecture : à l'ouverture, avec ⟳, et toutes les 5 min quand l'inbox est affichée. Chaque minute et au retour sur l'app, seuls les fichiers des projets sont relus ; cette relecture n'annule pas une demande de tickets en cours.

#### Temps par jour

- `clickup:times(début, fin)` lit `GET /team/{teamId}/time_entries?start_date=…&end_date=…` pour chaque espace de travail du compte ; sans autre filtre, ClickUp renvoie les entrées de l'utilisateur de la clé. Chaque entrée est ramenée à `{ id, start, duration, running, taskId, ref, name, url }` ; un chrono ClickUp en cours (durée négative) est marqué `running` et compté jusqu'à maintenant par l'interface.
- L'interface (`times.js`) demande une semaine, du lundi 0 h au dimanche soir (heure locale), range chaque entrée dans le jour de son début, puis regroupe par ticket. L'objectif (`times.target`, en heures, dans `data.json`) s'applique du lundi au vendredi ; un week-end n'est affiché que s'il a du temps. Les semaines lues sont gardées 5 min.
- Relecture : à l'ouverture, au changement de semaine, avec ⟳, au retour sur l'app, après chaque synchro réussie, et toutes les 5 min, panneau ouvert ou non : la journée en cours alimente la jauge « Aujourd'hui » de la barre du haut et la pastille de l'onglet (`refreshToday`).
- La réponse de `clickup:times` porte aussi ce qui n'est pas encore dans ClickUp (`localTimes`) : `pending`, les propositions en attente de validation, et `running`, le chrono des cartes placées dans une colonne chronométrée d'un projet synchronisé. Les trois sont comptés dans le total du jour et forment les trois segments de la barre. Une proposition se valide depuis l'onglet comme depuis la fenêtre flottante (`clickup:time-confirm`), l'une refermant l'autre.

#### Utilisation du forfait

- `claude -p "/usage" --output-format json --no-session-persistence` avec le `CLAUDE_CONFIG_DIR` du compte. La commande `/usage` est locale (aucun appel au modèle) ; son texte est analysé pour en tirer les pourcentages et les heures de réinitialisation.
- Rafraîchie toutes les 5 min, au retour sur l'app, au changement d'espace et après chaque réponse en mode conversation.

#### Mises à jour

- `make-app.sh` écrit dans le paquet un `source.json` : `{ source: <dossier des sources>, commit: <HEAD> }`.
- `app:update-status` lance `git fetch` (au plus toutes les 2 min), puis compare `HEAD..@{u}` (commits distants) et `<commit construit>..HEAD` (sources locales plus récentes). Le bouton « Mise à jour » n'apparaît que s'il y a du nouveau. La vérification a lieu toutes les 5 min et au retour sur l'app.
- **Application** : `git pull --ff-only`, `npm install` si `package.json` ou le verrou a changé, `npm run app`, puis `open -n /Applications/Clutch.app` et fermeture. Les sessions ouvertes sont annoncées avant.
- La mise à jour suit la **branche en cours** du dossier des sources.

#### Fenêtre et apparence

- La croix masque la fenêtre (un indicateur `quitting` est armé par `before-quit`) ; `activate` la réaffiche.
- **Thèmes** : variables CSS sur `body[data-theme]`, plus une palette xterm par thème. Thèmes : Nuit, Glass, Papier, Rétro, Système, Kyōto, Magic, Conversation. Barres de défilement teintées par thème.
- **Fond personnalisé** : couleur ou image (copiée dans `userData/backgrounds`, relue en `data:`), panneaux translucides et terminaux transparents.
- Au démarrage, l'initialisation attend `DOMContentLoaded` : sans cette attente, les données pouvaient arriver avant le chargement de `chat.js` et `kanban.js`.

### Données et sécurité

| Donnée | Emplacement | Remarque |
|---|---|---|
| Presets, prompts, réglages, thème, son, comptes | `~/Library/Application Support/Clutch/data.json` | Écrit à chaque changement |
| File de synchro ClickUp, entrées de temps créées | `data.json` (`clickupQueue`, `clickupLogged`) | Tenues par le processus principal, conservées quand l'interface sauvegarde |
| Clé ClickUp | `…/Clutch/secrets.json` | Chiffrée (`safeStorage`), droits `0600`, jamais renvoyée au rendu |
| Image de fond | `…/Clutch/backgrounds/` | Copie de l'image choisie |
| Tâches | `<projet>/.clutch/kanban.json` | À mettre dans le `.gitignore` si le tableau doit rester local |
| Connexions Claude | Dossiers `CLAUDE_CONFIG_DIR` (`~/.claude`, `~/.claude-perso`…) | Gérés par Claude Code ; Clutch ne lit pas les identifiants |

### Construire et lancer

```bash
npm install          # installe les dépendances, rend spawn-helper de node-pty exécutable
npm start            # lance en développement (electron .)
npm run app          # construit Clutch.app, l'installe dans /Applications, l'épingle au Dock
```

Prérequis : macOS, Node, git, Claude Code dans le PATH du shell de login.

### Points d'attention

- **macOS uniquement** : `afplay`, sons système, trousseau, Dock, `sips`/`iconutil`.
- **node-pty est natif** : le paquet est construit sans asar, et `spawn-helper` doit être exécutable.
- **État de Claude en terminal** : il dépend des titres que Claude Code donne au terminal (`✳`, `◐`). Un changement de convention chez Claude Code le casserait.
- **Kanban** : la dernière écriture gagne. Si Claude et l'interface écrivent exactement en même temps, une modification peut être perdue (le risque est faible, chaque écriture étant atomique).
- **ClickUp** : un titre de la forme `MOT-123` est interprété comme un id de ticket personnalisé.
- **Synchro ClickUp** :
  - les transitions faites pendant que l'app est fermée ne sont pas vues : au démarrage, l'état du fichier sert de point de départ ;
  - si l'app s'arrête entre la création d'une entrée de temps et l'enregistrement de sa clé, une reprise peut la créer une seconde fois ;
  - un écart « ≠ statut » n'est vu que si `clickup.status` de la carte est à jour : un ticket changé dans ClickUp n'apparaît qu'après une synchro ou un ⟳ ;
  - le marqueur « non synchronisé » est gardé en mémoire : il disparaît à la relance de l'app, même si l'action est encore en file ;
  - `todo → in_progress → todo → in_progress` repart de zéro : le premier segment n'est pas loggé ;
  - le temps est celui passé dans les colonnes « chrono » du tableau, pas un temps de travail mesuré ;
  - deux presets sur le même dossier partagent le fichier du kanban : le tableau et main retiennent celui dont la synchro est activée (son nom sur les cartes, ses statuts propres).
- **Kanban unique** : l'ordre des cartes se garde par projet (un fichier chacun), pas entre projets ; une carte changée de projet pendant qu'un temps est à valider garde ce temps dans ClickUp, mais son total loggé sur la carte n'est pas mis à jour.
- **Tests** : scripts de test rapides Electron, écrits au besoin, avec un dossier `userData` isolé et des simulations pour ClickUp et le trousseau. Il n'y a pas de suite de tests automatisés dans le dépôt.
