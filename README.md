# Clutch

Gestionnaire de terminaux multi-projets (Electron + xterm.js + node-pty).

- **Presets** : un nom, un dossier, une couleur et ce qui s'ouvre au lancement.
- **Au lancement** : une liste de terminaux, chacun dans la racine ou un sous-dossier (`front`, `back`…) et lançant Claude, un simple shell ou une commande (`npm run dev`…). « ＋ Un par sous-dossier » ajoute un shell par sous-dossier. Avec plusieurs terminaux, choisis la disposition : onglets, côte à côte, empilés, grille, « 1 + pile » (le premier terminal à gauche, les autres empilés à droite) ou « 1 + rangée » (le premier en haut, les autres côte à côte en bas). ↑ change l’ordre : le premier terminal est le principal. Le bouton ▦/▭ bascule le groupe actif entre sa disposition et les onglets.
- **Lancement rapide** : clic sur un projet dans la barre latérale, ou `⌘K` puis recherche floue.
- **Plusieurs terminaux** en onglets ou en grille (`⌘G`), avec un badge d'activité sur les onglets en arrière-plan.
- **Barre de prompt** (masquée en vue terminal pour laisser toute la hauteur aux terminaux : `⌘L` l'ouvre, Échap ou l'envoi la referme ; toujours visible en vue conversation) : écris un prompt multi-ligne et envoie-le au terminal actif ou à tous les terminaux (`⌘↵`). Les prompts récurrents s'enregistrent avec ★.
- **Skills** : l'onglet Skills de la barre latérale liste tes skills Claude Code (perso, claude.ai, plugins, et ceux de chaque projet dans `.claude/skills` / `.claude/commands`). Clic → choix du projet, formulaire des infos demandées, aperçu du prompt, puis lancement dans un nouveau terminal Claude ou dans une session déjà ouverte. `⚡` sur un projet ou `⌘J` ouvre directement la liste des skills pour ce projet. ☆ met un skill en favori : il remonte dans le groupe Favoris et en tête de `⌘J`.
- **Diff à droite** : dès que des fichiers changent dans le projet de l'onglet actif (dépôt git), l'écran se scinde : terminal et prompt à gauche, diff à droite, mis à jour en direct. L'en-tête indique la branche courante (une par dépôt quand le projet en contient plusieurs, le commit abrégé en HEAD détaché). Par défaut on compare à l'état au moment de l'ouverture de l'onglet (donc seulement ce que Claude a modifié) ; le menu permet de passer à « tout le non-commité ». `⌘D` ouvre/ferme, la barre centrale se fait glisser, la case « auto » coupe l'ouverture automatique. Le diff, le kanban, l'inbox ClickUp et les temps partagent ce panneau de droite, avec quatre onglets « Modifications », « Kanban », « Inbox » et « Temps » : un seul est affiché à la fois. Un seul bouton en haut à droite ouvre et ferme le panneau, sur le dernier onglet affiché. Quand un autre onglet est affiché, le diff ne prend pas sa place tout seul ; l'onglet « Modifications » affiche le nombre de fichiers modifiés.
- **Kanban** (`⌘B` ou l'onglet « Kanban » du panneau de droite) : un tableau de tâches par projet, dans l'onglet « Kanban » du panneau de droite (redimensionnable), qui suit le projet de l'onglet actif. Trois colonnes par défaut : À faire, En cours, À relire. Elles se règlent par projet, sur le tableau : un clic sur l'en-tête d'une colonne ouvre ses réglages (nom, statut ClickUp relié choisi dans la liste du projet, « chrono » pour celles où le temps passé est compté, place, retrait), et le « + » en bout de tableau en ajoute une. Le tableau tient sur une seule rangée et défile en largeur ; le bouton d'agrandissement lui donne la place des terminaux. Une carte liée à ClickUp affiche son statut en pastille, la priorité si elle est haute ou urgente, l'échéance (« 20 nov. · dans 7 j », en rouge une fois dépassée), l'initiale des personnes assignées, le chrono en cours et le temps déjà loggé. Si le ticket n'est plus au statut de sa colonne (carte reculée, ticket changé dans ClickUp), la pastille devient « ≠ statut » : un clic propose d'aligner le ticket ou de laisser. Le bouton « + Ticket » à côté du choix du projet ouvre un champ : un titre, puis Entrée, ajoute la tâche dans la première colonne (Échap referme) ; avec un numéro de ticket ClickUp (`#86c0abc12`, `CICD-123` ou un lien `app.clickup.com/t/…`), la carte est remplie depuis ClickUp : titre, description, statut, priorité, personnes assignées, échéance, étiquettes, sous-tâches (⟳ sur la carte pour recharger, le badge ouvre le ticket). Pour un skill qui a un champ `ticket`, c'est le numéro du ticket qui est prérempli. glisse les cartes d'une colonne à l'autre ou pour les réordonner ; au clavier, Tab atteint une carte, ← → la changent de colonne, ↵ l'ouvre, et le clic droit propose « Déplacer vers ». **Clic sur une carte** : la fiche de la tâche s'affiche (pour un ticket ClickUp : statut, priorité, personnes assignées, dates, étiquettes, liste, description mise en forme, sous-tâches et checklists, avec un lien vers ClickUp), puis en dessous le skill à lancer (ou « Juste la tâche ») et une ligne qui résume où ça part ; « Modifier » déplie le projet, la cible et le prompt. La tâche remplit le champ du skill avec son id (`tâche kanban t-…`) pour que le skill puisse la retrouver, puis Entrée lance dans un nouveau terminal Claude ou une session ouverte. Le dernier skill choisi est proposé la fois suivante. ✎ modifie le titre et les détails, ➤ envoie la tâche au terminal actif. Les tâches sont dans `.clutch/kanban.json` à la racine du projet : un skill Claude peut les faire avancer en modifiant ce fichier, le tableau se met à jour en direct et fait briller les cartes déplacées (voir [Format du kanban](#format-du-kanban)).
- **Temps par jour** (onglet « Temps » du panneau de droite) : ton temps par jour, une semaine à la fois. Chaque jour affiche son total face à l'objectif (7 h par défaut, du lundi au vendredi, réglable en bas du panneau), une barre en trois segments (loggé dans ClickUp, à valider en hachuré, chrono des cartes en cours), ce qui manque ou dépasse, et le détail par ticket ; l'en-tête donne le total de la semaine. Les temps à valider se corrigent et s'envoient depuis l'onglet (ou « Tout envoyer »), comme depuis la fenêtre en bas à droite. Un jour passé incomplet propose « Rattraper avec /temps » si ce skill existe. Les flèches changent de semaine. La journée en cours est aussi dans la barre du haut (« Aujourd'hui 3 h 20 / 7 h ») et sur l'onglet.
- **Inbox ClickUp** (`⌘I` ou l'onglet « Inbox » du panneau de droite) : ClickUp ne donne pas accès à son Inbox par l'API, alors Clutch la reconstitue. Dans ⚙ → ClickUp → Inbox ClickUp, coche les espaces, dossiers ou listes à suivre (cocher un espace ou un dossier inclut tout ce qu'il contient) les statuts à trier (par défaut : nouveau, à faire, rejeté) et les statuts où tu es assigné (par défaut : dev en cours). L'onglet liste les tickets ouverts de ces projets dans un statut à trier qui n'ont personne d'assigné ou qui te sont assignés, plus ceux qui te sont assignés dans un statut de la seconde liste, du plus récemment modifié au plus ancien. Les tickets sont groupés par liste, avec une étiquette quand la priorité est haute ou urgente. Un clic sur une ligne affiche le ticket en entier (relu dans ClickUp), avec les deux mêmes boutons. Le tri se fait aussi au clavier : `J` `K` naviguent, `↵` prend le ticket, `E` l'ignore, `Espace` ouvre le détail, `Z` annule le dernier « Ignorer » (comme le bouton « Annuler » de la notification). « Ignorer » masque le ticket (« Tout rétablir » en bas fait revenir tous les tickets ignorés). L'autre bouton porte le nom de la première colonne du kanban du projet choisi en haut du panneau (« À faire » par défaut) : il t'assigne au ticket dans ClickUp, le passe au statut relié à cette colonne (un ticket déjà plus loin, en dev en cours par exemple, garde son statut) et y crée la carte ; les tickets déjà présents sur ce tableau sortent de l'inbox. L'onglet affiche le nombre de tickets à trier ; la liste est relue toutes les 5 min quand l'inbox est affichée (⟳ pour forcer).
- **Synchro ClickUp** (formulaire du preset, désactivée par défaut) : une carte liée à un ticket qui passe en « En cours » fait passer le ticket en « dev en cours » (s'il était « à faire »), puis en « À relire » le passe en « revue de code à faire » (s'il était « à faire » ou « dev en cours ») et propose le temps passé en « En cours » (à partir d'1 min) dans une petite fenêtre en bas à droite : tu corriges les heures et minutes puis « Envoyer » le logge sur le ticket, « Ne pas logger » l'abandonne. Rien n'est loggé sans validation ; la fenêtre reste affichée (et revient à la relance) tant que tu n'as pas répondu. Le ticket n'est jamais reculé et aucun commentaire n'est posté. Noms des statuts réglables, bouton « Vérifier » pour les contrôler. En cas d'échec réseau, l'action est retentée plus tard et au redémarrage ; la carte affiche « non synchronisé ». Détails dans `docs/CLUTCH.md`.
- **Thèmes** (⚙ en haut à droite → Apparence, ou `⌘K` → « Thème ») : *Nuit* (d'origine), *Glass* (verre dépoli sur fond coloré), *Papier* (clair et doux, terminal présenté comme une carte de conversation et prompt comme une zone de message — pour ceux qui n'aiment pas la vue terminal), *Rétro* (arcade, assorti au logo), *Système* (fenêtres bleu néon façon Solo Leveling), *Kyōto* (encre sumi, vermillon, vagues seigaiha), *Magic* (cadre de carte Magic : or, prompt en parchemin, les cinq couleurs de mana). Les thèmes sont présentés en grille de vignettes.
- **Utilisation de Claude** (en haut à droite) : jauges de la session (5 h) et de la semaine pour le compte de l'espace actif ; clic pour le détail et les heures de réinitialisation. Les chiffres viennent de la commande `/usage` de Claude Code (aucun appel au modèle), rafraîchis toutes les 5 min, au retour sur l'app et après chaque réponse en mode conversation. Orange à 70 %, rouge à 90 %.
- **État de Claude** : dans l'onglet, l'en-tête du terminal et la liste des projets, un rond qui tourne quand Claude travaille, une bulle qui pulse quand il attend ta réponse (réponse terminée, autorisation ou question). Fonctionne en vue terminal (d'après le titre que Claude Code donne au terminal) comme en vue conversation.
- **Son de fin** : un petit son quand Claude passe de « travaille » à « attend ta réponse ». Choix du son (Carillon, Goutte, Cloche, Arcade, Doux, un son d’alerte du Mac comme Brise, ou Aucun) et du volume dans ◐ ; un clic sur un son le fait écouter.
- **Renommer un onglet** : double-clic sur l'onglet (ou sur l'en-tête du terminal en grille), Entrée pour valider, Échap pour annuler ; un nom vide rend le nom d'origine. Aussi via `⌘K` → « Renommer l'onglet ».
- **Grille modulable** : en grille, fais glisser les séparations entre terminaux pour les redimensionner (double-clic sur une séparation pour revenir à des tailles égales). Attrape un terminal par son en-tête pour l'échanger avec un autre, ou dépose-le dans la barre d'onglets pour le sortir de la grille. À l'inverse, dépose un onglet sur un terminal pour les mettre côte à côte (ou l'ajouter à la grille affichée). Les onglets se réordonnent aussi par glisser-déposer. `⌘G` réunit tous les terminaux en grille, ou bascule la grille active en onglets et inversement.
- **Fond personnalisé** (◐ → Fond) : couleur unie ou image (copiée dans les données de l'app), avec l'opacité des panneaux et le flou de l'image réglables ; les terminaux deviennent translucides pour laisser voir le fond. En thème clair, passe Claude Code en `/theme` → light pour des couleurs adaptées.
- **Thème Conversation** : les sessions Claude s'affichent comme une discussion (bulles, texte en markdown lisible, actions de Claude résumées en cartes : lecture, modification avec mini-diff, commande avec sa sortie, plan de travail). Quand Claude veut faire quelque chose qui demande validation, une carte « Autoriser / Toujours autoriser ici / Refuser » apparaît dans la conversation. Entrée envoie, ⇧Entrée va à la ligne. Taper `/` propose les commandes et skills (`/compact`, `/context`, `/model opus`, `/clear`…). `/resume` (ou le bouton **↺ Reprendre**, ou la liste sur l'écran d'accueil) rouvre une conversation précédente du projet avec son historique. En haut de la conversation : le mode d'autorisation, **Stop** pour interrompre, et **⌨ Terminal** pour continuer la même session dans un terminal classique. Fonctionne avec Claude Code en mode `stream-json` (`claude -p --input-format stream-json …`) ; les shells restent des terminaux.
- **Pro / Perso** : le bouton tout en haut à gauche bascule d'un compte Claude à l'autre. Chaque compte a ses propres projets, onglets, skills et historique, sans mélange : un projet appartient à un seul compte. Les sessions de l'autre compte continuent en arrière-plan (un point signale qu'il s'y passe quelque chose). Les comptes se gèrent dans ⚙ → Comptes Claude : chacun est un dossier `CLAUDE_CONFIG_DIR` (ex. Pro → `~/.claude`, Perso → `~/.claude-perso`) ; « Se connecter » ouvre Claude avec ce compte pour faire le `/login` la première fois.
- **Paramètres** (⚙ en haut à droite) : trois onglets, « Apparence » (thème, fond, son de fin), « Comptes Claude » et « ClickUp ». Clé API ClickUp (`pk_…`, ClickUp → Paramètres → Apps). Elle est vérifiée auprès de ClickUp puis chiffrée avec le trousseau du Mac (`safeStorage`) dans les données de l'app ; l'interface ne la relit jamais.
- **Import** (⇩) : crée un preset pour chaque sous-dossier d'un dossier (ex. `~/Documents/projects`).

## Lancer

```bash
npm install
npm start
```

## Application dans le Dock

```bash
npm run app
```

Construit `Clutch.app` (icône incluse), l'installe dans `/Applications` et l'épingle au Dock la première fois. À relancer après chaque modification du code pour mettre l'app à jour (quitter l'app avant). `npm start` reste disponible pour développer.

## Raccourcis

| Raccourci | Action |
|---|---|
| `⌘K` | Palette : lancer un projet / aller à un onglet |
| `⌘T` | Nouveau shell dans le dossier du terminal actif |
| `⌘W` | Fermer l'onglet |
| `⌘1`…`⌘9`, `⌘⇧[` / `⌘⇧]` | Changer d'onglet |
| `⌘L` | Aller dans la barre de prompt (`Échap` pour revenir au terminal) |
| `⌘↵` | Envoyer le prompt |
| `⌘J` | Lancer un skill sur le projet du terminal actif |
| `⌘↵` (fenêtre skill) | Lancer le skill |
| `⌘D` | Afficher / masquer le diff |
| `⌘B` | Afficher / masquer le kanban |
| `⌘I` | Afficher / masquer l'inbox ClickUp |
| `⌘N` | Nouveau projet |
| `⌘/` | Tous les raccourcis |
| `⌘G` | Basculer entre onglets et grille |

## Format du kanban

Fichier `<projet>/.clutch/kanban.json` (créé à la première tâche) :

```json
{
  "version": 1,
  "tasks": [
    {
      "id": "t-a1b2c3",
      "title": "Ajouter la page login",
      "description": "Facultatif, sur plusieurs lignes",
      "status": "in_progress",
      "created": "2026-11-09T10:12:00.000Z",
      "updated": "2026-11-09T10:40:00.000Z"
    }
  ]
}
```

- `status` : l'id d'une colonne du projet. Par défaut `todo` (À faire), `in_progress` (En cours), `review` (À relire) ; une colonne ajoutée reçoit un id tiré de son nom (« En test » donne `en_test`, visible au survol de son nom dans le formulaire du projet). `done` (terminée) n'a pas de colonne, sauf si le projet en ajoute une (« Fait ») : la tâche reste dans le fichier mais n'est plus affichée. Le nom de la colonne et les variantes courantes (`to do`, `doing`, `to_review`, `en cours`, `fait`…) sont acceptés à la lecture et réécrits sous la forme canonique dès que l'app modifie le tableau ; un statut inconnu tombe dans la première colonne.
- `id` et `title` sont obligatoires (une tâche sans eux est ignorée). L'ordre du tableau `tasks` est l'ordre d'affichage dans chaque colonne. Les autres champs ajoutés par un skill sont conservés.
- Pour faire avancer une tâche, il suffit de changer son `status` (et `updated`) ; pour en créer une, d'ajouter un objet avec un `id` unique.
- Si le JSON devient invalide, le tableau passe en lecture seule et l'affiche, sans écraser le fichier, jusqu'à ce qu'il soit corrigé.
- Une carte importée de ClickUp a en plus un objet `clickup` : `id`, `customId`, `url`, `status`, `priority`, `assignees`, `tags`, `due`, `list`, `subtasks`, `checklists` (champs vides omis).
- Le dossier `.clutch/` peut être ajouté au `.gitignore` du projet si le tableau doit rester local.

## Modèles de skills

Chaque skill a un modèle de prompt (par défaut `/<skill> {{arguments?}}`), modifiable avec ✎. Les champs du formulaire viennent des variables du modèle :

| Syntaxe | Champ |
|---|---|
| `{{ticket}}` | texte obligatoire |
| `{{note?}}` | texte facultatif |
| `{{contexte:long}}` / `{{contexte?:long}}` | zone de texte |
| `{{env:dev\|staging\|prod}}` | liste déroulante |
| `{{project}}`, `{{cwd}}`, `{{date}}` | remplis automatiquement |

Le bouton ＋ de l'onglet Skills crée un modèle personnalisé qui ne dépend d'aucun skill existant (ex. « Revue de PR » : `Fais une revue de la PR {{pr}} en te concentrant sur {{focus:sécurité|perf|lisibilité}}`).

## Notes

- La commande du preset tourne dans un shell de login interactif (`$SHELL -l -i`), donc le `PATH`, les alias et nvm sont chargés. Quand elle se termine, on retombe dans un shell dans le même dossier.
- Pour démarrer Claude avec un prompt initial, mets-le dans la commande du preset : `claude "lis le README et résume l'état du projet"`.
- **Mises à jour** : un bouton « Mise à jour » apparaît tout en haut à droite dès qu'il y a du nouveau — commits sur le dépôt GitHub (vérifié toutes les 5 min et au retour sur l'app) ou sources locales plus récentes que l'app installée. Au clic : `git pull`, `npm install` si les dépendances ont changé, reconstruction (`npm run app`) puis relance. En cas d'échec, la fin du journal s'affiche et l'app reste ouverte.
- La croix rouge cache la fenêtre (comme Discord) : les terminaux et les conversations continuent en arrière-plan. Clique sur l’icône du Dock pour la retrouver ; `⌘Q` quitte vraiment.
- Les données (presets, prompts) sont dans `~/Library/Application Support/Clutch/data.json`.
- Les glyphes Powerline/p10k demandent une Nerd Font (`brew install --cask font-meslo-lg-nerd-font`).
