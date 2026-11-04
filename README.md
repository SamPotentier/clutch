# Clutch

Gestionnaire de terminaux multi-projets (Electron + xterm.js + node-pty).

- **Presets** : un nom, un dossier, une couleur et ce qui s'ouvre au lancement.
- **Au lancement** : une liste de terminaux, chacun dans la racine ou un sous-dossier (`front`, `back`…) et lançant Claude, un simple shell ou une commande (`npm run dev`…). « ＋ Un par sous-dossier » ajoute un shell par sous-dossier. Avec plusieurs terminaux, choisis la disposition : onglets, côte à côte, empilés, grille, « 1 + pile » (le premier terminal à gauche, les autres empilés à droite) ou « 1 + rangée » (le premier en haut, les autres côte à côte en bas). ↑ change l’ordre : le premier terminal est le principal. Le bouton ▦/▭ bascule le groupe actif entre sa disposition et les onglets.
- **Lancement rapide** : clic sur un projet dans la barre latérale, ou `⌘K` puis recherche floue.
- **Plusieurs terminaux** en onglets ou en grille (`⌘G`), avec un badge d'activité sur les onglets en arrière-plan.
- **Barre de prompt** : écris un prompt multi-ligne et envoie-le au terminal actif ou à tous les terminaux (`⌘↵`). Les prompts récurrents s'enregistrent avec ★.
- **Skills** : l'onglet Skills de la barre latérale liste tes skills Claude Code (perso, claude.ai, plugins, et ceux de chaque projet dans `.claude/skills` / `.claude/commands`). Clic → choix du projet, formulaire des infos demandées, aperçu du prompt, puis lancement dans un nouveau terminal Claude ou dans une session déjà ouverte. `⚡` sur un projet ou `⌘J` ouvre directement la liste des skills pour ce projet. ☆ met un skill en favori : il remonte dans le groupe Favoris et en tête de `⌘J`.
- **Diff à droite** : dès que des fichiers changent dans le projet de l'onglet actif (dépôt git), l'écran se scinde : terminal et prompt à gauche, diff à droite, mis à jour en direct. Par défaut on compare à l'état au moment de l'ouverture de l'onglet (donc seulement ce que Claude a modifié) ; le menu permet de passer à « tout le non-commité ». `⌘D` ou `±` ouvre/ferme, la barre centrale se fait glisser, la case « auto » coupe l'ouverture automatique.
- **Thèmes** (◐ en haut à droite, ou `⌘K` → « Thème ») : *Nuit* (d'origine), *Glass* (verre dépoli sur fond coloré), *Papier* (clair et doux, terminal présenté comme une carte de conversation et prompt comme une zone de message — pour ceux qui n'aiment pas la vue terminal), *Rétro* (arcade, assorti au logo), *Système* (fenêtres bleu néon façon Solo Leveling), *Kyōto* (encre sumi, vermillon, vagues seigaiha). Les thèmes sont présentés en grille de vignettes.
- **Utilisation de Claude** (en haut à droite) : jauges de la session (5 h) et de la semaine pour le compte de l'espace actif ; clic pour le détail et les heures de réinitialisation. Les chiffres viennent de la commande `/usage` de Claude Code (aucun appel au modèle), rafraîchis toutes les 5 min, au retour sur l'app et après chaque réponse en mode conversation. Orange à 70 %, rouge à 90 %.
- **État de Claude** : dans l'onglet, l'en-tête du terminal et la liste des projets, un rond qui tourne quand Claude travaille, une bulle qui pulse quand il attend ta réponse (réponse terminée, autorisation ou question). Fonctionne en vue terminal (d'après le titre que Claude Code donne au terminal) comme en vue conversation.
- **Grille modulable** : en grille, fais glisser les séparations entre terminaux pour les redimensionner (double-clic sur une séparation pour revenir à des tailles égales). Attrape un terminal par son en-tête pour l'échanger avec un autre, ou dépose-le dans la barre d'onglets pour le sortir de la grille. À l'inverse, dépose un onglet sur un terminal pour les mettre côte à côte (ou l'ajouter à la grille affichée). Les onglets se réordonnent aussi par glisser-déposer. `⌘G` réunit tous les terminaux en grille, ou bascule la grille active en onglets et inversement.
- **Fond personnalisé** (◐ → Fond) : couleur unie ou image (copiée dans les données de l'app), avec l'opacité des panneaux et le flou de l'image réglables ; les terminaux deviennent translucides pour laisser voir le fond. En thème clair, passe Claude Code en `/theme` → light pour des couleurs adaptées.
- **Thème Conversation** : les sessions Claude s'affichent comme une discussion (bulles, texte en markdown lisible, actions de Claude résumées en cartes : lecture, modification avec mini-diff, commande avec sa sortie, plan de travail). Quand Claude veut faire quelque chose qui demande validation, une carte « Autoriser / Toujours autoriser ici / Refuser » apparaît dans la conversation. Entrée envoie, ⇧Entrée va à la ligne. Taper `/` propose les commandes et skills (`/compact`, `/context`, `/model opus`, `/clear`…). `/resume` (ou le bouton **↺ Reprendre**, ou la liste sur l'écran d'accueil) rouvre une conversation précédente du projet avec son historique. En haut de la conversation : le mode d'autorisation, **Stop** pour interrompre, et **⌨ Terminal** pour continuer la même session dans un terminal classique. Fonctionne avec Claude Code en mode `stream-json` (`claude -p --input-format stream-json …`) ; les shells restent des terminaux.
- **Pro / Perso** : le bouton tout en haut à gauche bascule d'un compte Claude à l'autre. Chaque compte a ses propres projets, onglets, skills et historique, sans mélange : un projet appartient à un seul compte. Les sessions de l'autre compte continuent en arrière-plan (un point signale qu'il s'y passe quelque chose). Les comptes se gèrent avec 👤 : chacun est un dossier `CLAUDE_CONFIG_DIR` (ex. Pro → `~/.claude`, Perso → `~/.claude-perso`) ; « Se connecter » ouvre Claude avec ce compte pour faire le `/login` la première fois.
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
| `⌘N` | Nouveau preset |
| `⌘G` | Basculer entre onglets et grille |

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
