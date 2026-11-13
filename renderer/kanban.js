/* ---------- Kanban ---------- */
// Un seul tableau pour tous les projets de l'espace : chaque carte porte le nom du sien, et un filtre
// n'en montre qu'un. Les tâches restent dans <projet>/.clutch/kanban.json : l'app les affiche et les
// édite, un skill Claude peut les faire avancer en modifiant le fichier de son projet, surveillé en direct.

// Deux affichages (kanban.view) : en liste, par défaut, une colonne à la fois, choisie en haut ; en
// tableau, toutes les colonnes côte à côte.

// Les colonnes sont communes à tous les projets et se règlent sur le tableau : un clic sur l'en-tête
// d'une colonne (en liste, la roue à côté des colonnes) ouvre ses réglages (kanban-cols.js pour les règles).

// boards : un par dossier de projet, { dir, preset, tasks, error, errorLine, loaded, seen } ; home : projet de chaque tâche ;
// editing, drag, diverge, focus : carte concernée, par sa clé (kbKey) ; colEdit : colonne dont les réglages sont ouverts ;
// colFresh : colonne tout juste ajoutée (son id suit son premier nom) ; synced : dernier changement de statut à montrer sur la carte ;
// addPicked : la destination de l'ajout a été choisie à la main
const kb = { boards: [], home: new WeakMap(), watched: '', editing: null, drag: null, flash: new Map(), unsynced: new Map(),
  colEdit: null, colFresh: null, colFocus: false, diverge: null, synced: new Map(), cuStatuses: new Map(), focus: null, addPicked: false };
// Numéro de ticket ClickUp : #86c0abc12, CICD-123 ou un lien app.clickup.com/t/…
const KB_TICKET = /^(#\S+|[A-Za-z][\w]*-\d+|https?:\/\/(app\.)?clickup\.com\/t\/\S+)$/;

const kbCols = () => kbColumns(null, state.kanban.columns);
// Les mêmes colonnes vues d'un projet, avec ses propres statuts ClickUp s'il en a
const kbColsOf = (b) => kbColumns(b.preset, state.kanban.columns);
const kbNow = () => new Date().toISOString();
const kbNewId = () => `t-${uid().slice(0, 6)}`;

// Deux projets peuvent avoir une tâche de même id : une carte se désigne par son dossier et son id
const kbSyncKey = (dir, taskId) => `${dir}\n${taskId}`;
const kbHome = (t) => kb.home.get(t);
const kbKey = (t) => kbSyncKey(kbHome(t).dir, t.id);
const kbElKey = (el) => kbSyncKey(el.dataset.dir, el.dataset.id);
const kbBoard = (dir) => kb.boards.find((b) => b.dir === dir);
const kbTasks = () => kb.boards.flatMap((b) => b.tasks);
const kbByKey = (key) => kbTasks().find((t) => kbKey(t) === key);
const kbCardTask = (el) => kbBoard(el?.dataset.dir)?.tasks.find((t) => t.id === el.dataset.id);
// Projets affichés : tous, ou celui du filtre
const kbShown = () => kb.boards.filter((b) => !state.kanban.only || b.preset.id === state.kanban.only);
const kbIsList = () => state.kanban.view !== 'board';
// Colonne affichée en liste : celle choisie, sinon la première
const kbListCol = (cols) => cols.find((c) => c.id === state.kanban.col) || cols[0];

const kbDur = (ms) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
};
// « 20 nov. » plutôt que 2026-11-20 (l'année seulement si ce n'est pas la nôtre)
function kbDate(day) {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(day || '');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
}
const KB_PRIORITY = { urgent: 'Urgent', high: 'Haute', normal: 'Normale', low: 'Basse' };

function kbAgo(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!(s >= 0)) return '';
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

// Les projets de l'espace ont changé (autre espace, projet ajouté, modifié ou retiré) : le tableau et l'inbox suivent
function kanbanProjectsChanged() {
  if (state.kanban.open) loadKanban();
  if (state.inbox.open) loadInbox();
}

function setKanbanOpen(open) {
  if (open && state.diff.open) {
    // Passer au kanban vaut fermeture du diff : il ne se rouvre pas tout seul sur cet onglet
    if (activeTab()) activeTab().diffDismissed = true;
    setDiffOpen(false);
  }
  if (open && state.inbox.open) setInboxOpen(false);
  if (open && state.times.open) setTimesOpen(false);
  state.kanban.open = open;
  $('#kanban-panel').classList.toggle('hidden', !open);
  updateSidePanel();
  persist();
  if (open) loadKanban();
  else {
    Object.assign(kb, { boards: [], watched: '' });
    api.kanbanWatch([]);
  }
}
const toggleKanban = () => setKanbanOpen(!state.kanban.open);

// Un projet par dossier, dans l'ordre de la liste. Deux projets sur le même dossier partagent le
// fichier : celui dont la synchro est activée l'emporte, comme dans le processus principal.
function kbProjects() {
  const byDir = new Map();
  for (const p of spacePresets()) {
    if (p.cwd && (!byDir.has(p.cwd) || (p.clickupSync?.enabled && !byDir.get(p.cwd).clickupSync?.enabled))) byDir.set(p.cwd, p);
  }
  return [...byDir.values()];
}

// dir : le seul fichier à relire (il vient de changer) ; sans lui, tous
async function loadKanban(dir) {
  // Les projets déjà lus gardent leurs cartes le temps de la relecture
  kb.boards = kbProjects().map((preset) => Object.assign(kbBoard(preset.cwd) || { dir: preset.cwd, tasks: [], error: '', errorLine: null, loaded: false, seen: new Map() }, { preset }));
  if (!kb.boards.some((b) => b.preset.id === state.kanban.only)) state.kanban.only = '';
  const watched = kb.boards.map((b) => b.dir).join('\n');
  if (watched !== kb.watched) api.kanbanWatch(kb.boards.map((b) => b.dir));
  kb.watched = watched;
  await Promise.all(kb.boards.filter((b) => !dir || b.dir === dir || !b.loaded).map(kbReadBoard));
  if (state.kanban.open) renderKanban();
}

async function kbReadBoard(b) {
  const res = await api.kanbanRead(b.dir);
  if (!kb.boards.includes(b)) return;
  b.error = res.error || '';
  b.errorLine = res.line || null;
  // Pendant une erreur (fichier en cours d'écriture ou cassé), on garde l'affichage précédent
  if (b.error) return;
  const cols = kbCols();
  b.tasks = res.tasks.filter((t) => t && t.id != null && t.title).map((t) => ({ ...t, id: String(t.id), status: kbStatus(t.status, cols) }));
  for (const t of b.tasks) kb.home.set(t, b);
  // Cartes déplacées ou ajoutées depuis l'extérieur (Claude) : on les fait briller un instant
  if (b.loaded) {
    for (const t of b.tasks) if (b.seen.get(t.id) !== t.status) kb.flash.set(kbKey(t), Date.now());
  }
  b.seen = new Map(b.tasks.map((t) => [t.id, t.status]));
  b.loaded = true;
}

// Chaque projet a son fichier : on n'écrit que celui de la carte touchée
async function saveKanban(b) {
  if (b.error) return;
  b.seen = new Map(b.tasks.map((t) => [t.id, t.status]));
  renderKanban();
  await api.kanbanWrite(b.dir, b.tasks);
}

// Filtre par projet : « Tous », puis les projets qui ont des cartes
function renderKbFilter() {
  const cols = kbCols();
  const count = (b) => b.tasks.filter((t) => cols.some((c) => c.id === t.status)).length;
  const used = kb.boards.filter((b) => count(b) || b.preset.id === state.kanban.only);
  $('#kb-filter').classList.toggle('hidden', used.length < 2 && !state.kanban.only);
  const chip = (id, label, n, color) => `<button type="button" data-only="${id}"${id === (state.kanban.only || '') ? ' class="on"' : ''}>${color ? `<span class="dot" style="background:${color}"></span>` : ''}${esc(label)}<span>${n}</span></button>`;
  $('#kb-filter').innerHTML = chip('', 'Tous', kb.boards.reduce((n, b) => n + count(b), 0)) + used.map((b) => chip(b.preset.id, b.preset.name, count(b), b.preset.color)).join('');
}

// multi : plusieurs projets sont affichés, la carte dit duquel elle est
function kbCard(t, multi) {
  const home = kbHome(t);
  const key = kbKey(t);
  const at = `data-id="${esc(t.id)}" data-dir="${esc(home.dir)}"`;
  const e = kb.editing;
  if (e?.key === key) {
    return `<div class="kb-card editing" ${at}>
      <input class="kb-e-title" value="${esc(e.title)}" spellcheck="false">
      <textarea class="kb-e-desc" rows="3" placeholder="Détails (facultatif)" spellcheck="false">${esc(e.description)}</textarea>
      <div class="kb-e-actions"><button type="button" data-a="cancel">Annuler</button><button type="button" class="primary" data-a="save">Enregistrer</button></div>
    </div>`;
  }
  const flash = Date.now() - (kb.flash.get(key) || 0) < 2500 ? ' flash' : '';
  const proj = multi ? `<span class="kb-proj" style="--c:${home.preset.color || 'var(--faint)'}" title="${esc(shortPath(home.dir))}">${esc(home.preset.name)}</span>` : '';
  // Fichier du projet abîmé : ses cartes restent affichées, sans pouvoir être modifiées
  return `<div class="kb-card${flash}${home.error ? ' ro' : ''}" draggable="${!home.error}" tabindex="0" ${at} title="Clic ou Entrée : voir la tâche et lancer un skill · glisser ou ← → : changer de colonne · clic droit : déplacer, changer de projet">
    ${proj || t.clickup ? kbHeadLine(t, proj) : ''}
    <div class="kb-title">${esc(t.title)}</div>
    ${t.description ? `<div class="kb-desc">${esc(t.description)}</div>` : ''}
    ${kb.diverge === key ? kbDivergePanel(t) : ''}
    <div class="kb-meta">
      ${t.clickup ? kbStatusChip(t) + kbFlags(t.clickup) : ''}
      <span class="kb-time" title="${esc(t.updated || '')}">${esc(kbAgo(t.updated || t.created))}</span>
      ${kbTiming(t)}
      <span class="kb-tools">
        ${t.clickup ? `<button type="button" data-a="cu-refresh" title="Recharger depuis ClickUp">${icon('refresh')}</button>` : ''}
        <button type="button" data-a="send" title="Envoyer la tâche au terminal actif">${icon('send')}</button>
        <button type="button" data-a="edit" title="Modifier">${icon('pencil')}</button>
        <button type="button" data-a="del" title="Supprimer">${icon('trash')}</button>
      </span>
    </div>
  </div>`;
}

// Première ligne de la carte : son projet, puis le numéro ClickUp et les personnes assignées
function kbHeadLine(t, proj) {
  const cu = t.clickup;
  const err = cu && kb.unsynced.get(kbKey(t));
  const who = (cu?.assignees || []).slice(0, 3).map((n) => `<i class="kb-who" title="${esc(n)}">${esc(String(n).trim()[0]?.toUpperCase() || '?')}</i>`).join('');
  return `<div class="kb-cu">${proj}${cu ? `<button type="button" data-a="cu-open" title="Ouvrir dans ClickUp">${icon('link')}${esc(cu.customId || cu.id)}</button>` : ''}${err ? `<em class="kb-unsynced" title="${esc(err)}">non synchronisé</em>` : ''}${who ? `<span class="kb-whos">${who}</span>` : ''}</div>`;
}

// Une carte en vue liste : le titre, puis ce que la carte du tableau montre, sur une ligne ; next est
// la colonne suivante, où le bouton de droite l'envoie
function kbRow(t, multi, next) {
  const home = kbHome(t);
  const key = kbKey(t);
  if (kb.editing?.key === key) return kbCard(t, multi);
  const cu = t.clickup;
  const err = cu && kb.unsynced.get(key);
  const flash = Date.now() - (kb.flash.get(key) || 0) < 2500 ? ' flash' : '';
  const who = (cu?.assignees || []).slice(0, 3).map((n) => `<i class="kb-who" title="${esc(n)}">${esc(String(n).trim()[0]?.toUpperCase() || '?')}</i>`).join('');
  return `<div class="kb-card kb-row${flash}${home.error ? ' ro' : ''}" draggable="${!home.error}" tabindex="0" data-id="${esc(t.id)}" data-dir="${esc(home.dir)}" title="Clic ou Entrée : voir la tâche et lancer un skill · glisser sur une colonne ou clic droit : déplacer, changer de projet">
    ${multi ? `<span class="kb-row-dot" style="background:${home.preset.color || 'var(--faint)'}"></span>` : ''}
    <div class="kb-row-main">
      <div class="kb-title">${esc(t.title)}</div>
      ${kb.diverge === key ? kbDivergePanel(t) : ''}
      <div class="kb-meta">
        ${multi ? `<span class="kb-row-proj" title="${esc(shortPath(home.dir))}">${esc(home.preset.name)}</span>` : ''}
        ${cu ? `<span class="kb-cu"><button type="button" data-a="cu-open" title="Ouvrir dans ClickUp">${icon('link')}${esc(cu.customId || cu.id)}</button></span>` : ''}
        ${err ? `<em class="kb-unsynced" title="${esc(err)}">non synchronisé</em>` : ''}
        ${cu ? kbStatusChip(t) + kbFlags(cu) : ''}
        ${kbTiming(t)}
        <span class="kb-time" title="${esc(t.updated || '')}">${esc(kbAgo(t.updated || t.created))}</span>
        <span class="kb-tools">
          ${cu ? `<button type="button" data-a="cu-refresh" title="Recharger depuis ClickUp">${icon('refresh')}</button>` : ''}
          <button type="button" data-a="send" title="Envoyer la tâche au terminal actif">${icon('send')}</button>
          <button type="button" data-a="edit" title="Modifier">${icon('pencil')}</button>
          <button type="button" data-a="del" title="Supprimer">${icon('trash')}</button>
        </span>
      </div>
    </div>
    ${who ? `<span class="kb-whos">${who}</span>` : ''}
    ${next && !home.error ? `<button type="button" class="kb-next" data-a="advance" title="Déplacer vers « ${esc(next.label)} » (M)">${icon('arrow-right')}${esc(next.label)}</button>` : ''}
  </div>`;
}

// Vue liste : les colonnes en onglets avec leur nombre de cartes, puis les cartes de celle qui est choisie
function kbListView(cols, tasks, multi) {
  const cur = kbListCol(cols);
  const i = cols.indexOf(cur);
  const rows = tasks.filter((t) => t.status === cur.id);
  return `<div class="kb-listhead" data-status="${esc(cur.id)}">
      <div class="kb-listbar">
        <div class="kb-tabs" role="tablist" aria-label="Colonne affichée">${cols.map((c) => `<button type="button" role="tab" data-a="tab" data-col="${esc(c.id)}" aria-selected="${c === cur}" class="${c === cur ? 'on' : ''}${c.timer ? ' timed' : ''}" title="${c.status ? `Statut ClickUp relié : ${esc(c.status)} · ` : ''}glisse une carte ici pour l'y déplacer">${esc(c.label)}<span>${tasks.filter((t) => t.status === c.id).length}</span></button>`).join('')}</div>
        <button type="button" class="kb-tab-tool${kb.colEdit === cur.id ? ' on' : ''}" data-a="col" title="Régler la colonne « ${esc(cur.label)} » : nom, statut ClickUp relié, chrono, place" aria-label="Régler la colonne">${icon('settings')}</button>
        <button type="button" class="kb-tab-tool" data-a="col-add" title="Ajouter une colonne" aria-label="Ajouter une colonne">${icon('plus')}</button>
      </div>
      ${kb.colEdit === cur.id ? kbColSettings(cur, i, cols) : ''}
    </div>
    <div class="kb-rows" data-status="${esc(cur.id)}">${rows.map((t) => kbRow(t, multi, cols[i + 1])).join('') || `<div class="diff-empty">Aucune carte dans « ${esc(cur.label)} ».</div>`}</div>`;
}

// Change la colonne affichée en liste ; focus : 'tab' pour rester sur les onglets, 'card' pour aller à la première carte
function kbPickCol(id, focus) {
  state.kanban.col = id;
  if (kb.colEdit) kb.colEdit = null;
  persist();
  renderKanban();
  if (focus === 'tab') $('#kb-board .kb-tabs .on')?.focus();
  else if (focus === 'card') ($('#kb-board .kb-row') || $('#kb-board .kb-tabs .on'))?.focus();
}

// Statut ClickUp en pastille, en tête des étiquettes de la carte (la ligne passe à la suite s'il est long)
function kbStatusChip(t) {
  const cu = t.clickup;
  const done = kb.synced.get(kbKey(t));
  const color = /^#[0-9a-f]{3,8}$/i.test(cu.statusColor || '') ? ` style="--st:${cu.statusColor}"` : '';
  // Une synchro vient de passer : l'ancien statut puis le nouveau, quelques secondes
  if (done && Date.now() - done.at < 4000) return `${done.from ? `<span class="ib-status kb-was">${esc(done.from)}</span><span class="kb-arrow">→</span>` : ''}<span class="ib-status kb-now">${esc(done.to)} ✓</span>`;
  if (kbDiverges(t)) return `<button type="button" class="kb-diff" data-a="diverge" title="Dans ClickUp, le ticket n'est pas au statut de cette colonne : clique pour choisir">≠ ${esc(cu.status)}</button>`;
  return cu.status ? `<span class="ib-status"${color}>${esc(cu.status)}</span>` : '';
}

// Priorité et échéance : affichées seulement quand elles demandent de l'attention ou portent une date
function kbFlags(cu) {
  const out = [];
  if (cu.priority === 'urgent' || cu.priority === 'high') out.push(`<span class="kb-flag ${cu.priority}" title="Priorité">${KB_PRIORITY[cu.priority]}</span>`);
  if (cu.due) {
    const days = Math.round((new Date(`${cu.due}T00:00:00`) - new Date().setHours(0, 0, 0, 0)) / 86400000);
    const when = days < 0 ? `en retard de ${-days} j` : days === 0 ? "aujourd'hui" : days === 1 ? 'demain' : days <= 14 ? `dans ${days} j` : '';
    out.push(`<span class="kb-flag due${days < 0 ? ' late' : days <= 2 ? ' soon' : ''}" title="Échéance">${esc(kbDate(cu.due))}${when ? ` · ${when}` : ''}</span>`);
  }
  return out.join('');
}

/* Écart entre la carte et ClickUp : la synchro ne recule jamais un ticket, et un ticket peut changer
   ailleurs. La carte le signale au lieu de laisser un statut faux sans le dire. */
const kbSame = (a, b) => kbNorm(a) === kbNorm(b);
function kbDiverges(t) {
  const col = kbHome(t).preset.clickupSync?.enabled && kbColsOf(kbHome(t)).find((c) => c.id === t.status);
  if (!col?.status || !t.clickup?.status || kbSame(t.clickup.status, col.status)) return false;
  // Écart déjà vu et laissé tel quel, ou carte tout juste déplacée (la synchro est en route)
  return t.ack !== `${t.clickup.status}|${t.status}` && Date.now() - Date.parse(t.updated || 0) > 2500;
}
function kbDivergePanel(t) {
  const col = kbColsOf(kbHome(t)).find((c) => c.id === t.status);
  return `<div class="kb-diverge">
    <span>Dans ClickUp le ticket est « ${esc(t.clickup.status)} », alors que « ${esc(col.label)} » correspond à « ${esc(col.status)} ».</span>
    <div><button type="button" data-a="align">Passer le ticket en « ${esc(col.status)} »</button><button type="button" data-a="ack" title="Ne plus signaler cet écart pour cette carte">Laisser</button></div>
  </div>`;
}

// Détail d'une tâche, affiché quand on clique dessus (lancement depuis une carte, inbox) : tout ce que
// la carte sait du ticket ClickUp, et la description en entier
function kbTicketInfo(t) {
  const cu = t.clickup || {};
  const url = /^https?:\/\//.test(cu.url || '') ? cu.url : cu.id ? `https://app.clickup.com/t/${cu.id}` : '';
  const color = /^#[0-9a-f]{3,8}$/i.test(cu.statusColor || '') ? ` style="--st:${cu.statusColor}"` : '';
  const rows = [
    ['Priorité', KB_PRIORITY[cu.priority] || cu.priority], ['Assigné à', cu.assignees?.join(', ')], ['Début', cu.start && kbDate(cu.start)], ['Échéance', cu.due && kbDate(cu.due)],
    ['Étiquettes', cu.tags?.join(', ')], ['Liste', cu.list], ['Créé', [cu.created && `le ${kbDate(cu.created)}`, cu.creator && `par ${cu.creator}`].filter(Boolean).join(' ')],
  ].filter(([, v]) => v);
  const checklists = (cu.checklists || []).filter((c) => c.items?.length);
  return [
    url && `<div class="tk-head"><a href="${esc(url)}" title="Ouvrir dans ClickUp">${icon('link')}${esc(cu.customId || cu.id)}</a>${cu.status ? `<span class="ib-status"${color}>${esc(cu.status)}</span>` : ''}</div>`,
    rows.length && `<dl class="tk-meta">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
    t.description ? `<div class="tk-desc md">${md(t.description)}</div>` : url && '<div class="tk-none">Pas de description.</div>',
    cu.subtasks?.length && `<div class="tk-sec">Sous-tâches</div><ul class="tk-list">${cu.subtasks.map((s) => `<li><span>${esc(s.name)}</span>${s.status ? `<span class="ib-status">${esc(s.status)}</span>` : ''}</li>`).join('')}</ul>`,
    ...checklists.map((c) => `<div class="tk-sec">${esc(c.name)}</div><ul class="tk-list">${c.items.map((i) => `<li${i.done ? ' class="done"' : ''}>${icon(i.done ? 'box-done' : 'box-todo')}<span>${esc(i.name)}</span></li>`).join('')}</ul>`),
  ].filter(Boolean).join('');
}

// Chrono en cours pour une carte dans une colonne chronométrée, puis temps déjà loggé dans ClickUp
function kbTiming(t) {
  const ms = t.timing?.loggedMs || 0;
  const run = t.timing?.startedAt && kbCols().find((c) => c.id === t.status)?.timer ? Math.max(0, Date.now() - Date.parse(t.timing.startedAt)) : 0;
  if (!ms && !run) return '';
  return `<span class="kb-timing">${run ? `<b class="kb-live" title="Chrono en cours dans cette colonne">${kbDur(run)}</b>` : ''}${ms ? `<span title="Temps loggé dans ClickUp">${run ? '+ ' : ''}${kbDur(ms)} loggé</span>` : ''}</span>`;
}

/* Retours de la synchro ClickUp (faite par le processus principal) */
const kbRenderSoon = (ms) => setTimeout(() => { if (state.kanban.open && !kb.editing && !kb.drag) renderKanban(); }, ms);
api.onClickupSync((ev) => {
  const key = kbSyncKey(ev.project, ev.taskId);
  const what = ev.action === 'time' ? 'temps' : 'statut';
  // Statut du ticket après la synchro : la carte l'affiche tout de suite, sans recharger depuis ClickUp
  const t = ev.status && kbBoard(ev.project)?.tasks.find((x) => x.id === ev.taskId);
  const shown = t?.clickup && state.kanban.open && ev.action === 'status';
  if (t?.clickup) {
    if (!ev.skipped && !kbSame(t.clickup.status, ev.status)) {
      kb.synced.set(key, { from: t.clickup.status, to: ev.status, at: Date.now() });
      kbRenderSoon(4100);
    }
    t.clickup.status = ev.status;
  }
  if (ev.ok) {
    kb.unsynced.delete(key);
    // Carte sous les yeux : le changement de statut s'y lit, pas besoin de notification
    if (!shown) toast(`ClickUp ${ev.ref} : ${ev.detail || what + ' synchronisé'}`);
  } else {
    kb.unsynced.set(key, ev.error);
    toast(`ClickUp ${ev.ref} non synchronisé (${what}) : ${ev.error}`, 'err');
  }
  if (state.kanban.open && kbBoard(ev.project)) renderKanban();
});

/* Temps à valider : une carte liée qui quitte une colonne chronométrée vers la suite propose le temps passé.
   Rien n'est loggé dans ClickUp sans « Envoyer ». La fenêtre reste affichée sans prendre le focus :
   un skill peut déplacer la carte pendant qu'on tape ailleurs. */
const kbTimePrompts = new Set(); // ids affichés
function kbTimePrompt(p) {
  if (kbTimePrompts.has(p.id)) return;
  kbTimePrompts.add(p.id);
  const min = Math.max(1, Math.round(p.duration / 60000));
  const hm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = new Date(p.start).toDateString() === new Date().toDateString() ? '' : `${new Date(p.start).toLocaleDateString([], { day: 'numeric', month: 'short' })}, `;
  const el = document.createElement('form');
  el.className = 'time-prompt';
  el.dataset.id = p.id;
  el.innerHTML = `<div class="kbt-head">Temps passé sur <b>${esc(p.ref)}</b><small>${esc(p.project.split('/').filter(Boolean).pop() || '')}</small></div>
    ${p.title ? `<div class="kbt-title" title="${esc(p.title)}">${esc(p.title)}</div>` : ''}
    <div class="kbt-time">
      <input name="h" type="number" min="0" step="1" value="${Math.floor(min / 60)}" aria-label="Heures"> h
      <input name="m" type="number" min="0" step="1" value="${min % 60}" aria-label="Minutes"> min
      <small>en cours ${esc(day)}de ${esc(hm(p.start))} à ${esc(hm(p.start + p.duration))}</small>
    </div>
    <div class="kbt-actions">
      <button type="button" data-a="skip" title="Ne rien logger dans ClickUp pour ce passage en cours">Ne pas logger</button>
      <button type="submit" class="primary">${icon('send')}Envoyer</button>
    </div>`;
  const done = (duration) => {
    kbTimePromptClose(p.id);
    api.clickupTimeConfirm(p.id, duration);
    tmForget(p.id);
  };
  el.onsubmit = (e) => {
    e.preventDefault();
    const total = (Math.floor(+el.elements.h.value) || 0) * 60 + (Math.floor(+el.elements.m.value) || 0);
    if (total <= 0) return el.elements.m.focus();
    done(total * 60000);
  };
  el.querySelector('[data-a="skip"]').onclick = () => done(0);
  $('#toasts').prepend(el);
}
// La même proposition se valide aussi depuis l'onglet Temps : la fenêtre se referme alors
function kbTimePromptClose(id) {
  kbTimePrompts.delete(id);
  [...document.querySelectorAll('.time-prompt')].find((x) => x.dataset.id === id)?.remove();
}
api.onClickupTimePending(kbTimePrompt);
api.clickupTimePending().then((list) => list.forEach(kbTimePrompt));

// Réglages d'une colonne, ouverts sous son en-tête : nom, statut ClickUp relié, chrono, place.
// Le statut réglé est celui de tous les projets ; avec le filtre sur un projet, c'est le sien.
function kbColSettings(c, i, cols) {
  const own = state.kanban.only && kbShown()[0];
  const value = own ? kbColsOf(own).find((x) => x.id === c.id).status : c.status;
  const known = kbKnownStatuses();
  const current = known?.find((x) => kbSame(x, value));
  const status = known
    ? `<select data-f="status"><option value="">Aucun</option>${known.map((x) => `<option${x === current ? ' selected' : ''}>${esc(x)}</option>`).join('')}${value && !current ? `<option selected value="${esc(value)}">${esc(value)} (absent de la liste)</option>` : ''}</select>`
    : `<input data-f="status" value="${esc(value)}" placeholder="aucun" spellcheck="false">`;
  const cards = kbTasks().filter((t) => t.status === c.id).length;
  return `<div class="kb-colset" data-col="${esc(c.id)}">
    <label>Nom<input data-f="label" value="${esc(c.label)}" spellcheck="false" title="« status » dans kanban.json : ${esc(c.id)}"></label>
    <label title="Statut donné au ticket quand sa carte avance dans cette colonne">Statut ClickUp relié${own ? ` pour ${esc(own.preset.name)}` : ''}${status}
      ${own ? (kbSame(value, c.status) ? '' : `<small>Les autres projets : ${esc(c.status || 'aucun')}</small>`) : kb.boards.length > 1 ? '<small>Pour un projet aux statuts différents : filtre le tableau sur lui.</small>' : ''}</label>
    <label class="check" title="Le temps passé dans cette colonne est compté, puis proposé pour ClickUp quand la carte avance"><input type="checkbox" data-f="timer"${c.timer ? ' checked' : ''}> Chrono</label>
    <div class="kb-colset-acts">
      <button type="button" data-a="col-left" title="Déplacer vers la gauche"${i ? '' : ' disabled'}>${icon('chevron-left')}</button>
      <button type="button" data-a="col-right" title="Déplacer vers la droite"${i < cols.length - 1 ? '' : ' disabled'}>${icon('chevron-right')}</button>
      <button type="button" class="danger" data-a="col-del" title="${cards ? `Ses ${cards} carte${cards > 1 ? 's' : ''} iront dans la première colonne` : 'Retirer cette colonne'}"${cols.length > 1 ? '' : ' disabled'}>Retirer</button>
    </div>
  </div>`;
}

function renderKanban() {
  const board = $('#kb-board');
  const err = $('#kb-error');
  const broken = kb.boards.filter((b) => b.error);
  err.classList.toggle('hidden', !broken.length);
  // Ce qui est cassé, ce que ça change, et une sortie ; le message technique reste à un clic
  err.innerHTML = broken.map((b) => `<b>Le fichier des tâches de ${esc(b.preset.name)} est abîmé.</b>
    <span><code>.clutch/kanban.json</code> n'est plus un JSON valide${b.errorLine ? `, autour de la ligne ${b.errorLine}` : ''}. Ses cartes restent en lecture seule et rien n'est écrasé tant qu'il n'est pas réparé.</span>
    <div><button type="button" data-a="err-fix" data-dir="${esc(b.dir)}">Demander à Claude de le réparer</button><details><summary>Détail</summary><code>${esc(b.error)}</code></details></div>`).join('');
  const cols = kbCols();
  const shown = kbShown();
  const tasks = shown.flatMap((b) => b.tasks);
  const n = tasks.filter((t) => cols.some((c) => c.id === t.status)).length;
  $('#kb-stats').textContent = kb.boards.length ? `${n} tâche${n > 1 ? 's' : ''}` : '';
  $('#kb-stats').title = shown.map((b) => `${shortPath(b.dir)}/.clutch/kanban.json`).join('\n');
  $('#kb-wide').classList.toggle('on', !!state.side.wide);
  renderKbFilter();
  $('#kb-keys').classList.add('hidden');
  const writable = kb.boards.some((b) => !b.error);
  $('#kb-add-btn').classList.toggle('hidden', !writable);
  if (!writable) kbCloseAdd();
  if (!kb.boards.length) {
    board.innerHTML = '<div class="diff-empty">Ajoute un projet pour avoir un tableau de tâches.</div>';
    return;
  }
  // Un rafraîchissement (Claude qui écrit) ne doit pas faire perdre une modification en cours
  const active = document.activeElement;
  const editFocus = active?.closest?.('.kb-card.editing') ? active.className : '';
  // Saisie en cours dans les réglages d'une colonne, ou carte active au clavier : à retrouver après le rendu
  const setFocus = active?.closest?.('.kb-colset') && active.dataset.f ? { f: active.dataset.f, value: active.value, at: active.selectionStart } : null;
  const cardFocus = kb.focus || (active?.classList?.contains('kb-card') && !editFocus ? kbElKey(active) : null);
  kb.focus = null;
  if (!cols.some((c) => c.id === kb.colEdit)) kb.colEdit = null;
  const multi = shown.length > 1;
  const list = kbIsList();
  board.classList.toggle('list', list);
  document.querySelectorAll('#kb-view button').forEach((b) => b.classList.toggle('on', (b.dataset.view === 'list') === list));
  // Agrandir sur la place des terminaux ne sert qu'au tableau
  $('#kb-wide').classList.toggle('hidden', list);
  $('#kb-keys').classList.toggle('hidden', !list);
  // Dans une colonne, les cartes d'un même projet se suivent, dans l'ordre de son fichier
  board.innerHTML = list ? kbListView(cols, tasks, multi) : cols.map((c, i) => {
    const cards = tasks.filter((t) => t.status === c.id);
    return `<section class="kb-col${c.timer ? ' timed' : ''}" data-status="${esc(c.id)}">
      <header><button type="button" class="kb-col-name" data-a="col" title="${c.status ? `Statut ClickUp relié : ${esc(c.status)} · ` : ''}clic pour régler la colonne (Échap ou nouveau clic pour refermer)"><span class="kb-dot"></span>${esc(c.label)}</button><span class="kb-count">${cards.length}</span></header>
      ${kb.colEdit === c.id ? kbColSettings(c, i, cols) : ''}
      <div class="kb-cards">${cards.map((t) => kbCard(t, multi)).join('')}</div>
    </section>`;
  }).join('') + `<button type="button" class="kb-col-add" data-a="col-add" title="Ajouter une colonne au tableau">${icon('plus')}</button>`;
  if (editFocus) board.querySelector(`.kb-card.editing .${editFocus.split(' ')[0]}`)?.focus();
  const field = board.querySelector(`.kb-colset [data-f="${kb.colFocus ? 'label' : setFocus?.f}"]`);
  if (kb.colFocus && field) {
    field.focus();
    field.select();
  } else if (setFocus && field) {
    if (field.type !== 'checkbox' && field.tagName !== 'SELECT') field.value = setFocus.value;
    field.focus();
    try { field.setSelectionRange(setFocus.at, setFocus.at); } catch {}
  } else if (cardFocus) [...board.querySelectorAll('.kb-card')].find((c) => kbElKey(c) === cardFocus)?.focus();
  kb.colFocus = false;
}

/* Colonnes : communes à tous les projets (kanban.columns), le tableau est relu avec la nouvelle disposition */
function kbSetCols(cols) {
  state.kanban.columns = cols;
  persist();
  loadKanban();
  if (state.inbox.open) renderInbox();
}
// Statut ClickUp d'une colonne propre à un projet ; s'il rejoint celui de tous, l'exception disparaît
function kbSetOwnStatus(p, c, status) {
  const statuses = { ...p.kanban?.statuses };
  if (kbSame(status, c.status)) delete statuses[c.id];
  else statuses[c.id] = status;
  p.kanban = { ...p.kanban, statuses };
  persist();
  renderKanban();
}
// Statuts ClickUp proposés dans les réglages d'une colonne : ceux des listes des projets affichés
// (lus une fois par projet, à partir d'une carte liée) ; saisie libre tant qu'aucun n'est connu
function kbKnownStatuses() {
  const lists = kbShown().map((b) => kb.cuStatuses.get(b.dir)).filter(Boolean);
  // « a faire » et « à faire » de deux listes : le même statut, proposé une fois
  return lists.length ? lists.flat().filter((x, i, all) => all.findIndex((y) => kbSame(x, y)) === i) : null;
}
async function kbLoadCuStatuses() {
  await Promise.all(kbShown().filter((b) => !kb.cuStatuses.has(b.dir) && b.tasks.some((t) => t.clickup)).map(async (b) => {
    kb.cuStatuses.set(b.dir, null);
    const res = await api.clickupCheckStatuses(b.dir, []);
    if (res.statuses?.length) kb.cuStatuses.set(b.dir, res.statuses);
    // ClickUp injoignable : saisie libre, et nouvel essai à la prochaine ouverture
    else kb.cuStatuses.delete(b.dir);
  }));
  if (state.kanban.open && kb.colEdit) renderKanban();
}
function kbColAction(a, id) {
  const cols = kbCols();
  const i = cols.findIndex((c) => c.id === id);
  if (a === 'col-add') {
    const fresh = { id: kbNewColId('Nouvelle colonne', cols.map((c) => c.id)), label: 'Nouvelle colonne', status: '', timer: false };
    Object.assign(kb, { colEdit: fresh.id, colFresh: fresh.id, colFocus: true });
    state.kanban.col = fresh.id;
    kbLoadCuStatuses();
    return kbSetCols([...cols, fresh]);
  }
  if (i < 0) return;
  if (a === 'col') {
    kb.colEdit = kb.colEdit === id ? null : id;
    if (kb.colEdit) kbLoadCuStatuses();
    return renderKanban();
  }
  if (a === 'col-left' || a === 'col-right') {
    const j = i + (a === 'col-left' ? -1 : 1);
    if (!cols[j]) return;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    return kbSetCols(cols);
  }
  if (a === 'col-del' && cols.length > 1) {
    const n = kbTasks().filter((t) => t.status === id).length;
    const first = cols.find((c) => c.id !== id);
    if (n && !confirm(`Retirer la colonne « ${cols[i].label} » ? Ses ${n} carte${n > 1 ? 's' : ''} iront dans « ${first.label} ».`)) return;
    kb.colEdit = null;
    kbSetCols(cols.filter((c) => c.id !== id));
  }
}
$('#kb-board').addEventListener('change', (e) => {
  const f = e.target.dataset?.f;
  const id = e.target.closest('.kb-colset')?.dataset.col;
  if (!f || !id) return;
  const cols = kbCols();
  const c = cols.find((x) => x.id === id);
  if (!c) return;
  if (f === 'timer') c.timer = e.target.checked;
  else if (f === 'status') {
    const own = state.kanban.only && kbShown()[0];
    if (own) return kbSetOwnStatus(own.preset, c, e.target.value.trim());
    c.status = e.target.value.trim();
  } else {
    const label = e.target.value.trim();
    if (!label) return renderKanban();
    c.label = label;
    // Colonne tout juste ajoutée et encore vide : son id suit le nom qu'on lui donne (« En test » → en_test)
    if (kb.colFresh === id && !kbTasks().some((t) => t.status === id)) {
      c.id = kbNewColId(label, cols.filter((x) => x !== c).map((x) => x.id));
      kb.colEdit = c.id;
      if (state.kanban.col === id) state.kanban.col = c.id;
    }
    kb.colFresh = null;
  }
  kbSetCols(cols);
});

/* Avant le tableau unique, chaque projet avait ses colonnes (preset.kanban.columns, ou les statuts de
   clickupSync). Les colonnes communes en sont la réunion, dans l'ordre de chaque projet ; un statut
   ClickUp qui n'est pas celui retenu reste propre à son projet. Les anciennes colonnes sont laissées
   dans le preset : elles ne servent plus. */
function kbMigrateCols() {
  if (state.kanban.columns?.length) return;
  const cols = [];
  const custom = state.presets.filter((p) => p.kanban?.columns?.length || Object.values(KB_LEGACY_STATUS).some((k) => p.clickupSync?.[k] != null));
  // Les projets synchronisés d'abord : leurs statuts sont ceux qui servent
  for (const p of custom.sort((a, b) => !!b.clickupSync?.enabled - !!a.clickupSync?.enabled)) {
    let at = -1;
    for (const c of kbColumns(p)) {
      let i = cols.findIndex((x) => kbNorm(x.id) === kbNorm(c.id));
      if (i < 0) cols.splice((i = at + 1), 0, c);
      else if (!kbSame(c.status, cols[i].status)) p.kanban = { ...p.kanban, statuses: { ...p.kanban?.statuses, [cols[i].id]: c.status } };
      at = i;
    }
  }
  state.kanban.columns = cols.length ? cols : kbColumns(null);
  persist();
}

function kbStartEdit(t) {
  if (kbHome(t).error) return;
  kb.editing = { key: kbKey(t), title: t.title, description: t.description || '' };
  renderKanban();
  const input = $('#kb-board .kb-e-title');
  input.focus();
  input.select();
}

function kbSaveEdit() {
  const e = kb.editing;
  const t = e && kbByKey(e.key);
  kb.editing = null;
  if (t && e.title.trim()) {
    Object.assign(t, { title: e.title.trim(), description: e.description.trim(), updated: kbNow() });
    if (!t.description) delete t.description;
    saveKanban(kbHome(t));
  } else renderKanban();
}

function kbSend(t) {
  const tab = activeTab();
  if (!tab) return;
  sendToTab(tab, `Tâche du kanban « ${t.title} » (id ${t.id})${t.description ? `\n\n${t.description}` : ''}`);
  focusTab(tab);
}

// Données ClickUp rangées dans la carte (le skill peut s'en servir aussi)
function kbFromClickup(t, cu) {
  const { name, description, ...meta } = cu;
  for (const k of Object.keys(meta)) if (meta[k] === undefined || (Array.isArray(meta[k]) && !meta[k].length)) delete meta[k];
  Object.assign(t, { title: name, clickup: meta, updated: kbNow() });
  if (description) t.description = description;
  else delete t.description;
  return t;
}

// Deux tickets de la même liste ClickUp (par son id ; les cartes anciennes n'ont que son nom)
const kbSameList = (a, b) => (a?.listId && b?.listId ? a.listId === b.listId : !!a?.list && a.list === b?.list);
// Projet qui a déjà le plus de cartes de la liste ClickUp d'un ticket : c'est là qu'on range les suivants
function kbListBoard(cu, boards) {
  let best = null;
  let max = 0;
  for (const b of boards) {
    const n = b.error ? 0 : b.tasks.filter((t) => kbSameList(t?.clickup, cu)).length;
    if (n > max) [best, max] = [b, n];
  }
  return best;
}

// Une carte qu'on vient d'ajouter, de déplacer ou de retrouver doit être sous les yeux : le filtre ne la cache pas
function kbReveal(t) {
  if (!kbShown().includes(kbHome(t))) {
    state.kanban.only = '';
    persist();
  }
  kb.flash.set(kbKey(t), Date.now());
}

/* Ajout : le bouton « Ticket » de l'en-tête ouvre un champ et le choix du projet, la tâche arrive dans
   la première colonne. Projet proposé : celui du filtre, sinon celui de l'onglet actif. */
const kbAddInput = () => $('#kb-add input');
function kbAddMessage(text) {
  $('#kb-add-msg').textContent = text;
  $('#kb-add-msg').classList.toggle('hidden', !text);
}
function kbOpenAdd() {
  const open = kb.boards.filter((b) => !b.error);
  if (!open.length) return;
  const tabDir = state.presets.find((p) => p.id === activeTab()?.presetId)?.cwd;
  const to = open.find((b) => b.preset.id === state.kanban.only) || open.find((b) => b.dir === tabDir) || open[0];
  $('#kb-add-project').innerHTML = open.map((b) => `<option value="${esc(b.dir)}"${b === to ? ' selected' : ''}>${esc(b.preset.name)}</option>`).join('');
  $('#kb-add-to').classList.toggle('hidden', open.length < 2);
  // Projet filtré : c'est un choix ; sinon un ticket ClickUp ira d'abord là où sont ceux de sa liste
  kb.addPicked = !!state.kanban.only;
  $('#kb-add').classList.remove('hidden');
  $('#kb-add-btn').classList.add('on');
  kbAddInput().focus();
}
function kbCloseAdd() {
  $('#kb-add').classList.add('hidden');
  $('#kb-add-btn').classList.remove('on');
  kbAddInput().value = '';
  kbAddMessage('');
}
$('#kb-add-project').onchange = () => {
  kb.addPicked = true;
  kbAddInput().focus();
};

function kbAddTask(b, t) {
  b.tasks.push(t);
  kb.home.set(t, b);
  kbReveal(t);
  kbCloseAdd();
  saveKanban(b);
}

async function kbAddTicket(ref) {
  const input = kbAddInput();
  input.disabled = true;
  kbAddMessage('Recherche du ticket dans ClickUp…');
  const res = await api.clickupTask(ref);
  input.disabled = false;
  if (res.error) {
    // On garde la saisie pour pouvoir la corriger
    kbAddMessage(res.error);
    return input.focus();
  }
  const dup = kbTasks().find((t) => t.clickup?.id === res.task.id);
  if (dup) {
    kbAddMessage(`Déjà sur le tableau${kb.boards.length > 1 ? ` (${kbHome(dup).preset.name})` : ''} : ${dup.title}`);
    kbReveal(dup);
    renderKanban();
    input.select();
    return input.focus();
  }
  // Sans choix à la main, le ticket rejoint le projet qui a déjà des cartes de sa liste ClickUp
  const b = (!kb.addPicked && kbListBoard(res.task, kb.boards)) || kbBoard($('#kb-add-project').value);
  // Tableau fermé ou projet retiré pendant la recherche
  if (!b || b.error) return kbCloseAdd();
  kbAddTask(b, kbFromClickup({ id: kbNewId(), status: kbCols()[0].id, created: kbNow() }, res.task));
}

$('#kb-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = kbAddInput();
  const title = input.value.trim();
  const b = kbBoard($('#kb-add-project').value);
  if (!title || !b || b.error || input.disabled) return;
  if (KB_TICKET.test(title)) return kbAddTicket(title);
  const now = kbNow();
  kbAddTask(b, { id: kbNewId(), title, status: kbCols()[0].id, created: now, updated: now });
});
$('#kb-add').addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  kbCloseAdd();
});
$('#kb-add-btn').onclick = () => ($('#kb-add').classList.contains('hidden') ? kbOpenAdd() : kbCloseAdd());

async function kbRefreshTicket(t) {
  const res = await api.clickupTask(t.clickup.id);
  if (res.error) {
    return toast(`${t.clickup.customId || t.clickup.id} : ${res.error}`, 'err');
  }
  // Le tableau a pu être relu entre-temps : la carte est celle du fichier courant
  t = kbHome(t).tasks.find((x) => x.id === t.id);
  if (!t) return;
  kbFromClickup(t, res.task);
  kb.flash.set(kbKey(t), Date.now());
  saveKanban(kbHome(t));
}

// Change une carte de colonne (ou de place) : avant la carte before, sinon en fin de colonne
function kbMoveCard(t, status, before) {
  const b = kbHome(t);
  if (b.error) return;
  if (before && kbHome(before) !== b) {
    // L'ordre se garde par projet (un fichier chacun) : devant une carte d'un autre projet, la carte
    // prend place avant la suivante du sien dans la colonne
    const col = kbShown().flatMap((x) => x.tasks).filter((x) => x.status === status);
    before = col.slice(col.indexOf(before)).find((x) => kbHome(x) === b && x !== t);
  }
  const rest = b.tasks.filter((x) => x !== t);
  let at = before ? rest.indexOf(before) : -1;
  if (at < 0) {
    // En fin de colonne : juste après la dernière tâche de ce statut
    const last = rest.map((x) => x.status).lastIndexOf(status);
    at = last < 0 ? rest.length : last + 1;
  }
  if (t.status !== status) {
    Object.assign(t, { status, updated: kbNow() });
    if (kb.diverge === kbKey(t)) kb.diverge = null;
    if (t.clickup && !b.preset.clickupSync?.enabled) kbSyncOffHint(b.preset);
    // La synchro part : l'écart éventuel avec ClickUp ne s'affiche qu'une fois son résultat connu
    else if (t.clickup) kbRenderSoon(2600);
  }
  rest.splice(at, 0, t);
  b.tasks = rest;
  saveKanban(b);
}

// Carte rangée dans le mauvais projet : elle change de fichier, en gardant sa colonne. Elle est écrite
// dans le nouveau avant d'être retirée de l'ancien : au pire elle est en double, jamais perdue.
async function kbChangeProject(t, to) {
  const from = kbHome(t);
  if (from.error || to.error || from === to) return;
  const moved = { ...t, updated: kbNow() };
  if (to.tasks.some((x) => x.id === t.id)) moved.id = kbNewId();
  to.tasks.push(moved);
  kb.home.set(moved, to);
  from.tasks = from.tasks.filter((x) => x !== t);
  kbReveal(moved);
  await saveKanban(to);
  await saveKanban(from);
}

function kbFixFile(b) {
  const p = b.preset;
  const prompt = `Le fichier .clutch/kanban.json de ce projet n'est plus un JSON valide (${b.error}). Répare-le sans perdre de tâche : il doit rester de la forme { "version": 1, "tasks": [ … ] }.`;
  const tab = activeTab();
  if (tab && tab.presetId === p.id && !tab.exited) {
    sendToTab(tab, prompt);
    focusTab(tab);
  } else openSession(p, { prompt, title: `${p.name} · réparer le tableau` });
}
$('#kb-error').addEventListener('click', (e) => {
  const b = kbBoard(e.target.closest('[data-a="err-fix"]')?.dataset.dir);
  if (b) kbFixFile(b);
});

$('#kb-filter').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-only]');
  if (!chip) return;
  state.kanban.only = chip.dataset.only;
  persist();
  if (kb.colEdit) kbLoadCuStatuses();
  renderKanban();
});

$('#kb-board').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-a]');
  if (btn?.dataset.a === 'tab') return kbPickCol(btn.dataset.col, 'tab');
  if (btn?.dataset.a.startsWith('col')) return kbColAction(btn.dataset.a, btn.closest('[data-status]')?.dataset.status);
  const card = e.target.closest('.kb-card');
  const t = card && kbCardTask(card);
  if (!t) return;
  const home = kbHome(t);
  if (!btn) {
    // Clic sur la carte : le détail de la tâche, puis choisir un skill pour le lancer sur son projet
    if (!card.classList.contains('editing')) openTaskRun(t, home.preset.id);
    return;
  }
  const a = btn.dataset.a;
  if (a === 'send') kbSend(t);
  else if (a === 'advance') kbAdvance(t);
  else if (a === 'cu-open') window.open(t.clickup.url || `https://app.clickup.com/t/${t.clickup.id}`);
  else if (a === 'cu-refresh') kbRefreshTicket(t);
  else if (a === 'edit') kbStartEdit(t);
  else if (a === 'save') kbSaveEdit();
  else if (a === 'cancel') { kb.editing = null; renderKanban(); }
  else if (a === 'diverge') { kb.diverge = kb.diverge === kbKey(t) ? null : kbKey(t); renderKanban(); }
  else if (a === 'align') {
    kb.diverge = null;
    api.clickupAlign(home.dir, t.id);
    renderKanban();
  } else if (a === 'ack') {
    kb.diverge = null;
    t.ack = `${t.clickup.status}|${t.status}`;
    saveKanban(home);
  } else if (a === 'del' && !home.error) {
    home.tasks = home.tasks.filter((x) => x !== t);
    saveKanban(home);
  }
});
$('#kb-board').addEventListener('input', (e) => {
  if (!kb.editing) return;
  if (e.target.classList.contains('kb-e-title')) kb.editing.title = e.target.value;
  if (e.target.classList.contains('kb-e-desc')) kb.editing.description = e.target.value;
});
// La carte passe dans la colonne suivante ; en liste elle quitte l'écran, la voisine prend le focus
function kbAdvance(t) {
  const cols = kbCols();
  const next = cols[cols.findIndex((c) => c.id === t.status) + 1];
  if (!next || kbHome(t).error) return;
  const cards = [...document.querySelectorAll('#kb-board .kb-row')];
  const at = cards.findIndex((c) => kbElKey(c) === kbKey(t));
  const near = cards[at + 1] || cards[at - 1];
  if (near && document.activeElement === cards[at]) kb.focus = kbElKey(near);
  kbMoveCard(t, next.id);
  // Dernière carte de la colonne : le focus revient aux onglets plutôt que de se perdre
  if (!near && kbIsList()) $('#kb-board .kb-tabs .on')?.focus();
}

// Carte active au clavier : Entrée l'ouvre, ↑ ↓ (ou J K) passent à la voisine. En tableau, ← → la changent
// de colonne ; en liste, ← → changent la colonne affichée et M fait avancer la carte
$('#kb-board').addEventListener('keydown', (e) => {
  const card = e.target;
  if (!card.classList?.contains('kb-card') || card.classList.contains('editing') || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = kbCardTask(card);
  if (!t) return;
  const cols = kbCols();
  const i = cols.findIndex((c) => c.id === t.status);
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const side = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
  if (k === 'Enter') openTaskRun(t, kbHome(t).preset.id);
  else if (side && kbIsList()) {
    if (cols[i + side]) kbPickCol(cols[i + side].id, 'card');
  } else if (side && !kbHome(t).error) {
    const to = cols[i + side];
    if (to) {
      kb.focus = kbKey(t);
      kbMoveCard(t, to.id);
    }
  } else if (k === 'm' && kbIsList()) kbAdvance(t);
  else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'j' || k === 'k') {
    const cards = [...card.parentElement.querySelectorAll('.kb-card')];
    cards[cards.indexOf(card) + (k === 'ArrowUp' || k === 'k' ? -1 : 1)]?.focus();
  } else return;
  e.preventDefault();
  e.stopPropagation();
});
// Onglets des colonnes (vue liste) : ← → passent à la colonne voisine, ↓ descend dans ses cartes
$('#kb-board').addEventListener('keydown', (e) => {
  const tab = e.target.closest?.('.kb-tabs [data-col]');
  if (!tab || e.metaKey || e.ctrlKey || e.altKey) return;
  const cols = kbCols();
  const i = cols.findIndex((c) => c.id === tab.dataset.col);
  const to = cols[i + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)];
  if (e.key === 'ArrowDown') $('#kb-board .kb-row')?.focus();
  else if (to && to !== cols[i]) kbPickCol(to.id, 'tab');
  else return;
  e.preventDefault();
  e.stopPropagation();
});
// Clic droit sur une carte : « Déplacer vers », pour qui ne veut ni glisser ni passer par le clavier,
// et « Changer de projet », pour une carte rangée au mauvais endroit
$('#kb-board').addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.kb-card:not(.editing)');
  const t = card && kbCardTask(card);
  if (!t || kbHome(t).error) return;
  e.preventDefault();
  contextMenu(e, [
    ...kbCols().filter((c) => c.id !== t.status).map((c) => ({ label: `Déplacer vers « ${c.label} »`, run: () => kbMoveCard(t, c.id) })),
    ...kb.boards.filter((b) => b !== kbHome(t) && !b.error).map((b) => ({ label: `Changer de projet : ${b.preset.name}`, run: () => kbChangeProject(t, b) })),
  ]);
});
$('#kb-board').addEventListener('keydown', (e) => {
  if (!e.target.closest('.kb-colset')) return;
  // Entrée valide le champ (comme en le quittant), Échap referme les réglages
  if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur();
  else if (e.key === 'Escape') { kb.colEdit = null; renderKanban(); }
  else return;
  e.stopPropagation();
});
$('#kb-board').addEventListener('keydown', (e) => {
  if (!e.target.closest('.kb-card.editing')) return;
  if (e.key === 'Escape') { kb.editing = null; renderKanban(); }
  else if (e.key === 'Enter' && (e.target.classList.contains('kb-e-title') || e.metaKey)) { e.preventDefault(); kbSaveEdit(); }
  else return;
  e.stopPropagation();
});

// Carte ClickUp déplacée dans un projet sans synchro : on le dit, une fois par projet et par session
const kbHinted = new Set();
function kbSyncOffHint(p) {
  if (kbHinted.has(p.id)) return;
  kbHinted.add(p.id);
  toast(`Synchro ClickUp désactivée pour ${p.name} : le ticket ne change pas dans ClickUp. Active-la dans Modifier le projet → Synchro ClickUp.`, 'err');
}

/* Glisser-déposer : changer de colonne, ou d'ordre dans la colonne. En liste, une carte se dépose sur
   l'onglet d'une colonne pour y aller. */
const kbClearDrop = () => document.querySelectorAll('.kb-drop-before, .kb-drop-end, .kb-drop-tab').forEach((x) => x.classList.remove('kb-drop-before', 'kb-drop-end', 'kb-drop-tab'));

function kbDropSpot(e) {
  const tab = e.target.closest('.kb-tabs [data-col]');
  if (tab) return { tab, status: tab.dataset.col };
  const col = e.target.closest('.kb-col, .kb-rows');
  if (!col) return null;
  const cards = [...col.querySelectorAll('.kb-card:not(.dragging)')];
  const before = cards.find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  return { col, before, status: col.dataset.status };
}

$('#kb-board').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.kb-card');
  if (!card || card.classList.contains('ro')) return e.preventDefault();
  kb.drag = kbElKey(card);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', card.querySelector('.kb-title').textContent);
  requestAnimationFrame(() => card.classList.add('dragging'));
});
$('#kb-board').addEventListener('dragend', () => {
  kb.drag = null;
  kbClearDrop();
  $('#kb-board .kb-card.dragging')?.classList.remove('dragging');
});
$('#kb-board').addEventListener('dragover', (e) => {
  if (!kb.drag) return;
  const spot = kbDropSpot(e);
  if (!spot) return;
  e.preventDefault();
  kbClearDrop();
  if (spot.tab) spot.tab.classList.add('kb-drop-tab');
  else if (spot.before) spot.before.classList.add('kb-drop-before');
  else spot.col.classList.add('kb-drop-end');
});
$('#kb-board').addEventListener('drop', (e) => {
  const spot = kb.drag && kbDropSpot(e);
  const t = spot && kbByKey(kb.drag);
  if (!t) return;
  e.preventDefault();
  kbMoveCard(t, spot.status, spot.before && kbCardTask(spot.before));
});

$('#kb-close').onclick = toggleKanban;
// Liste ou tableau : le choix est retenu
$('#kb-view').onclick = (e) => {
  const b = e.target.closest('[data-view]');
  if (!b || b.dataset.view === (kbIsList() ? 'list' : 'board')) return;
  state.kanban.view = b.dataset.view;
  persist();
  updateSidePanel();
  renderKanban();
};
// Synchro ClickUp : elle se règle par projet, dans son formulaire
$('#kb-settings').onclick = (e) => {
  const shown = kbShown();
  if (shown.length === 1) return openPresetModal(shown[0].preset, 'clickup');
  contextMenu(e, shown.map((b) => ({ label: `Synchro ClickUp de ${b.preset.name}`, run: () => openPresetModal(b.preset, 'clickup') })));
};
// Le tableau prend la place des terminaux le temps d'une réorganisation
$('#kb-wide').onclick = () => {
  state.side.wide = !state.side.wide;
  updateSidePanel();
  renderKanban();
};
api.onKanbanChanged((dir) => { if (kbBoard(dir)) loadKanban(dir); });

function initKanban() {
  kbMigrateCols();
  if (state.kanban.open) setKanbanOpen(true);
  // Les « il y a 5 min » vieillissent
  setInterval(() => { if (state.kanban.open && !kb.editing && !kb.drag) renderKanban(); }, 60000);
}
