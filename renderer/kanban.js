/* ---------- Kanban du projet ---------- */
// Les tâches vivent dans <projet>/.clutch/kanban.json : l'app les affiche et les édite,
// un skill Claude peut les faire avancer en modifiant le même fichier, surveillé en direct.

const KB_COLS = [
  { id: 'todo', label: 'À faire' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'review', label: 'À relire' },
  { id: 'done', label: 'Fait' },
];
// Statuts tolérés à la lecture (écrits à la main ou par Claude), ramenés aux quatre colonnes
const KB_ALIASES = { todo: 'todo', afaire: 'todo', backlog: 'todo', inprogress: 'in_progress', doing: 'in_progress', encours: 'in_progress', wip: 'in_progress', review: 'review', toreview: 'review', inreview: 'review', arelire: 'review', done: 'done', fait: 'done', termine: 'done' };
const kbStatus = (s) => KB_ALIASES[String(s || '').normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase()] || 'todo';

const kb = { dir: '', tasks: [], error: '', loaded: false, seen: new Map(), editing: null, dragId: null, flash: new Map(), unsynced: new Map() };
// Numéro de ticket ClickUp : #86c0abc12, CICD-123 ou un lien app.clickup.com/t/…
const KB_TICKET = /^(#\S+|[A-Za-z][\w]*-\d+|https?:\/\/(app\.)?clickup\.com\/t\/\S+)$/;

const kbPreset = () => spacePresets().find((p) => p.id === state.kanban.presetId);
const kbNow = () => new Date().toISOString();

function kbAgo(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!(s >= 0)) return '';
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

// Le tableau suit le projet de l'onglet actif
function kanbanFollow(tab) {
  if (tab?.presetId && spacePresets().some((p) => p.id === tab.presetId)) state.kanban.presetId = tab.presetId;
  else if (!kbPreset()) state.kanban.presetId = spacePresets()[0]?.id || '';
  if (state.kanban.open) loadKanban();
}

function setKanbanOpen(open) {
  if (open && state.diff.open) {
    // Passer au kanban vaut fermeture du diff : il ne se rouvre pas tout seul sur cet onglet
    if (activeTab()) activeTab().diffDismissed = true;
    setDiffOpen(false);
  }
  state.kanban.open = open;
  $('#kanban-panel').classList.toggle('hidden', !open);
  $('#btn-kanban').classList.toggle('on', open);
  updateSidePanel();
  persist();
  if (open) kanbanFollow(activeTab());
  else {
    kb.dir = '';
    api.kanbanWatch(null);
  }
}
const toggleKanban = () => setKanbanOpen(!state.kanban.open);

async function loadKanban() {
  renderKbProjects();
  const dir = kbPreset()?.cwd || '';
  if (dir !== kb.dir) {
    kbCloseAdd();
    Object.assign(kb, { dir, tasks: [], error: '', loaded: false, editing: null });
    kb.seen.clear();
    api.kanbanWatch(dir || null);
  }
  if (!dir) return renderKanban();
  const res = await api.kanbanRead(dir);
  if (dir !== kb.dir) return;
  kb.error = res.error || '';
  // Pendant une erreur (fichier en cours d'écriture ou cassé), on garde l'affichage précédent
  if (!kb.error) {
    kb.tasks = res.tasks.filter((t) => t && t.id != null && t.title).map((t) => ({ ...t, id: String(t.id), status: kbStatus(t.status) }));
    // Cartes déplacées ou ajoutées depuis l'extérieur (Claude) : on les fait briller un instant
    if (kb.loaded) {
      for (const t of kb.tasks) if (kb.seen.get(t.id) !== t.status) kb.flash.set(t.id, Date.now());
    }
    kb.seen = new Map(kb.tasks.map((t) => [t.id, t.status]));
    kb.loaded = true;
  }
  renderKanban();
}

async function saveKanban() {
  if (!kb.dir || kb.error) return;
  kb.seen = new Map(kb.tasks.map((t) => [t.id, t.status]));
  renderKanban();
  await api.kanbanWrite(kb.dir, kb.tasks);
}

function renderKbProjects() {
  const presets = spacePresets();
  $('#kb-project').innerHTML = presets.length
    ? presets.map((p) => `<option value="${p.id}"${p.id === state.kanban.presetId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')
    : '<option value="">Aucun projet</option>';
}

function kbCard(t) {
  const e = kb.editing;
  if (e?.id === t.id) {
    return `<div class="kb-card editing" data-id="${esc(t.id)}">
      <input class="kb-e-title" value="${esc(e.title)}" spellcheck="false">
      <textarea class="kb-e-desc" rows="3" placeholder="Détails (facultatif)" spellcheck="false">${esc(e.description)}</textarea>
      <div class="kb-e-actions"><button type="button" data-a="cancel">Annuler</button><button type="button" class="primary" data-a="save">Enregistrer</button></div>
    </div>`;
  }
  const flash = Date.now() - (kb.flash.get(t.id) || 0) < 2500 ? ' flash' : '';
  return `<div class="kb-card${flash}" draggable="true" data-id="${esc(t.id)}" title="Clic pour lancer un skill sur cette tâche · glisse pour changer de colonne">
    ${t.clickup ? kbClickupLine(t) : ''}
    <div class="kb-title">${esc(t.title)}</div>
    ${t.description ? `<div class="kb-desc">${esc(t.description)}</div>` : ''}
    <div class="kb-meta">
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

function kbClickupLine(t) {
  const cu = t.clickup;
  const bits = [cu.status, cu.priority && `priorité ${cu.priority}`, cu.due && `échéance ${cu.due}`, cu.assignees?.length && cu.assignees.join(', ')].filter(Boolean);
  const err = kb.unsynced.get(kbSyncKey(kb.dir, t.id));
  return `<div class="kb-cu"><button type="button" data-a="cu-open" title="Ouvrir dans ClickUp">${icon('link')}${esc(cu.customId || cu.id)}</button>${err ? `<em class="kb-unsynced" title="${esc(err)}">non synchronisé</em>` : ''}<span>${esc(bits.join(' · '))}</span></div>`;
}

// Temps déjà loggé dans ClickUp, et chrono en cours pour une carte « En cours »
function kbTiming(t) {
  const ms = t.timing?.loggedMs || 0;
  if (!ms && !t.timing?.startedAt) return '';
  const fmt = (x) => (x >= 3600000 ? `${Math.floor(x / 3600000)} h ${String(Math.round((x % 3600000) / 60000)).padStart(2, '0')}` : `${Math.round(x / 60000)} min`);
  return `<span class="kb-timing" title="Temps loggé dans ClickUp${t.timing?.startedAt ? ' · chrono en cours' : ''}">${ms ? fmt(ms) : ''}${t.timing?.startedAt ? ' ●' : ''}</span>`;
}

/* Retours de la synchro ClickUp (faite par le processus principal) */
const kbSyncKey = (dir, taskId) => `${dir}\n${taskId}`;
api.onClickupSync((ev) => {
  const key = kbSyncKey(ev.project, ev.taskId);
  const what = ev.action === 'time' ? 'temps' : 'statut';
  if (ev.ok) {
    kb.unsynced.delete(key);
    toast(`ClickUp ${ev.ref} : ${ev.detail || what + ' synchronisé'}`);
  } else {
    kb.unsynced.set(key, ev.error);
    toast(`ClickUp ${ev.ref} non synchronisé (${what}) : ${ev.error}`, 'err');
  }
  if (ev.project === kb.dir) renderKanban();
});

function renderKanban() {
  const board = $('#kb-board');
  const err = $('#kb-error');
  err.classList.toggle('hidden', !kb.error);
  err.textContent = kb.error ? `.clutch/kanban.json est illisible (${kb.error}). Le tableau est en lecture seule tant que le fichier n'est pas corrigé.` : '';
  const n = kb.tasks.length;
  $('#kb-stats').textContent = kb.dir ? `${n} tâche${n > 1 ? 's' : ''}` : '';
  $('#kb-stats').title = kb.dir ? `${shortPath(kb.dir)}/.clutch/kanban.json` : '';
  if (!kb.dir) {
    board.innerHTML = '<div class="diff-empty">Ajoute un projet pour avoir un tableau de tâches.</div>';
    return;
  }
  // Un rafraîchissement (Claude qui écrit) ne doit pas faire perdre une modification en cours
  $('#kb-add-btn').classList.toggle('hidden', !!kb.error);
  if (kb.error) kbCloseAdd();
  const editFocus = document.activeElement?.closest?.('.kb-card.editing') ? document.activeElement.className : '';
  board.innerHTML = KB_COLS.map((c) => {
    const tasks = kb.tasks.filter((t) => t.status === c.id);
    return `<section class="kb-col" data-status="${c.id}">
      <header><span class="kb-dot"></span>${c.label}<span class="kb-count">${tasks.length}</span></header>
      <div class="kb-cards">${tasks.map(kbCard).join('')}</div>
    </section>`;
  }).join('');
  board.classList.toggle('readonly', !!kb.error);
  if (editFocus) board.querySelector(`.kb-card.editing .${editFocus.split(' ')[0]}`)?.focus();
}

function kbStartEdit(id) {
  const t = kb.tasks.find((x) => x.id === id);
  if (!t || kb.error) return;
  kb.editing = { id, title: t.title, description: t.description || '' };
  renderKanban();
  const input = $('#kb-board .kb-e-title');
  input.focus();
  input.select();
}

function kbSaveEdit() {
  const e = kb.editing;
  const t = e && kb.tasks.find((x) => x.id === e.id);
  kb.editing = null;
  if (t && e.title.trim()) {
    Object.assign(t, { title: e.title.trim(), description: e.description.trim(), updated: kbNow() });
    if (!t.description) delete t.description;
    saveKanban();
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

/* Ajout : le bouton « Ticket » de l'en-tête ouvre un champ, la tâche arrive dans « À faire » */
const kbAddInput = () => $('#kb-add input');
function kbAddMessage(text) {
  $('#kb-add-msg').textContent = text;
  $('#kb-add-msg').classList.toggle('hidden', !text);
}
function kbOpenAdd() {
  if (!kb.dir || kb.error) return;
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

async function kbAddTicket(ref) {
  const input = kbAddInput();
  input.disabled = true;
  kbAddMessage('Recherche du ticket dans ClickUp…');
  const dir = kb.dir;
  const res = await api.clickupTask(ref);
  input.disabled = false;
  if (dir !== kb.dir) return kbCloseAdd();
  if (res.error) {
    // On garde la saisie pour pouvoir la corriger
    kbAddMessage(res.error);
    return input.focus();
  }
  const dup = kb.tasks.find((t) => t.clickup?.id === res.task.id);
  if (dup) {
    kbAddMessage(`Déjà sur le tableau : ${dup.title}`);
    kb.flash.set(dup.id, Date.now());
    renderKanban();
    input.select();
    return input.focus();
  }
  const now = kbNow();
  kb.tasks.push(kbFromClickup({ id: `t-${uid().slice(0, 6)}`, status: 'todo', created: now }, res.task));
  kb.flash.set(kb.tasks.at(-1).id, Date.now());
  kbCloseAdd();
  saveKanban();
}

$('#kb-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = kbAddInput();
  const title = input.value.trim();
  if (!title || kb.error || input.disabled) return;
  if (KB_TICKET.test(title)) return kbAddTicket(title);
  const now = kbNow();
  kb.tasks.push({ id: `t-${uid().slice(0, 6)}`, title, status: 'todo', created: now, updated: now });
  kb.flash.set(kb.tasks.at(-1).id, Date.now());
  kbCloseAdd();
  saveKanban();
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
  kbFromClickup(t, res.task);
  kb.flash.set(t.id, Date.now());
  saveKanban();
}

$('#kb-board').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  const card = e.target.closest('.kb-card');
  if (!card) return;
  if (!b) {
    // Clic sur la carte : choisir un skill et un projet, puis lancer
    const t = !card.classList.contains('editing') && kb.tasks.find((x) => x.id === card.dataset.id);
    if (t) openTaskRun(t, state.kanban.presetId);
    return;
  }
  const t = kb.tasks.find((x) => x.id === card.dataset.id);
  if (!t) return;
  const a = b.dataset.a;
  if (a === 'send') kbSend(t);
  else if (a === 'cu-open') window.open(t.clickup.url || `https://app.clickup.com/t/${t.clickup.id}`);
  else if (a === 'cu-refresh') kbRefreshTicket(t);
  else if (a === 'edit') kbStartEdit(t.id);
  else if (a === 'save') kbSaveEdit();
  else if (a === 'cancel') { kb.editing = null; renderKanban(); }
  else if (a === 'del' && !kb.error) {
    kb.tasks = kb.tasks.filter((x) => x !== t);
    saveKanban();
  }
});
$('#kb-board').addEventListener('input', (e) => {
  if (!kb.editing) return;
  if (e.target.classList.contains('kb-e-title')) kb.editing.title = e.target.value;
  if (e.target.classList.contains('kb-e-desc')) kb.editing.description = e.target.value;
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
function kbSyncOffHint() {
  const p = kbPreset();
  if (!p || kbHinted.has(p.id)) return;
  kbHinted.add(p.id);
  toast(`Synchro ClickUp désactivée pour ${p.name} : le ticket ne change pas dans ClickUp. Active-la dans Modifier le projet → Synchro ClickUp.`, 'err');
}

/* Glisser-déposer : changer de colonne, ou d'ordre dans la colonne */
const kbClearDrop = () => document.querySelectorAll('.kb-drop-before, .kb-drop-end').forEach((x) => x.classList.remove('kb-drop-before', 'kb-drop-end'));

function kbDropSpot(e) {
  const col = e.target.closest('.kb-col');
  if (!col) return null;
  const cards = [...col.querySelectorAll('.kb-card:not(.dragging)')];
  const before = cards.find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
  return { col, before };
}

$('#kb-board').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.kb-card');
  if (!card || kb.error) return e.preventDefault();
  kb.dragId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', card.querySelector('.kb-title').textContent);
  requestAnimationFrame(() => card.classList.add('dragging'));
});
$('#kb-board').addEventListener('dragend', () => {
  kb.dragId = null;
  kbClearDrop();
  $('#kb-board .kb-card.dragging')?.classList.remove('dragging');
});
$('#kb-board').addEventListener('dragover', (e) => {
  if (!kb.dragId) return;
  const spot = kbDropSpot(e);
  if (!spot) return;
  e.preventDefault();
  kbClearDrop();
  if (spot.before) spot.before.classList.add('kb-drop-before');
  else spot.col.classList.add('kb-drop-end');
});
$('#kb-board').addEventListener('drop', (e) => {
  const spot = kb.dragId && kbDropSpot(e);
  const t = spot && kb.tasks.find((x) => x.id === kb.dragId);
  if (!t) return;
  e.preventDefault();
  const status = spot.col.dataset.status;
  const rest = kb.tasks.filter((x) => x !== t);
  let at = spot.before ? rest.findIndex((x) => x.id === spot.before.dataset.id) : -1;
  if (at < 0) {
    // En fin de colonne : juste après la dernière tâche de ce statut
    const last = rest.map((x) => x.status).lastIndexOf(status);
    at = last < 0 ? rest.length : last + 1;
  }
  if (t.status !== status) {
    Object.assign(t, { status, updated: kbNow() });
    if (t.clickup && !kbPreset()?.clickupSync?.enabled) kbSyncOffHint();
  }
  rest.splice(at, 0, t);
  kb.tasks = rest;
  saveKanban();
});

$('#kb-project').onchange = (e) => {
  state.kanban.presetId = e.target.value;
  persist();
  loadKanban();
};
$('#btn-kanban').onclick = toggleKanban;
$('#kb-close').onclick = toggleKanban;
$('#kb-reload').onclick = loadKanban;
api.onKanbanChanged((dir) => { if (dir === kb.dir) loadKanban(); });

function initKanban() {
  if (state.kanban.open) setKanbanOpen(true);
  // Les « il y a 5 min » vieillissent
  setInterval(() => { if (state.kanban.open && !kb.editing && !kb.dragId) renderKanban(); }, 60000);
}
