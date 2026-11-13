/* ---------- Inbox ClickUp ---------- */
// ClickUp n'expose pas son Inbox : on liste les tickets à trier des projets ClickUp cochés dans les
// paramètres. « Ignorer » les masque (mémorisé ici), l'autre bouton m'assigne dans ClickUp, passe le
// ticket au statut relié à la première colonne du kanban du projet choisi en haut du panneau
// (« À faire » par défaut) et y crée la carte.

const IB_REFRESH_MS = 5 * 60 * 1000;
const IB_MAX_DISMISSED = 2000;
// sel : ticket sélectionné au clavier ; shown : tickets affichés, dans l'ordre de l'écran
const ib = { items: [], error: '', truncated: false, loading: false, at: 0, seq: 0, busy: new Set(), onBoard: new Set(), boardDir: '', sel: null, shown: [] };

const ibDismissed = () => new Set(state.inbox.dismissed);
const ibRef = (it) => it.customId || it.id;

function setInboxOpen(open) {
  if (open && state.diff.open) {
    if (activeTab()) activeTab().diffDismissed = true;
    setDiffOpen(false);
  }
  if (open && state.kanban.open) setKanbanOpen(false);
  if (open && state.times.open) setTimesOpen(false);
  state.inbox.open = open;
  $('#inbox-panel').classList.toggle('hidden', !open);
  updateSidePanel();
  persist();
  if (open) {
    loadInbox();
    // Le tri se fait au clavier : la liste prend le focus, Échap le rend au terminal
    $('#ib-list').focus();
  }
}
const toggleInbox = () => setInboxOpen(!state.inbox.open);

// Sans force, on ne réinterroge pas ClickUp à chaque changement d'onglet : seul le kanban de destination est relu
async function loadInbox(force) {
  renderKbProjects();
  if (!kbPreset()) state.kanban.presetId = spacePresets()[0]?.id || '';
  const dir = kbPreset()?.cwd || '';
  const refetch = force || !ib.at || Date.now() - ib.at > IB_REFRESH_MS;
  const seq = ++ib.seq;
  if (refetch && state.inbox.sources.length) {
    ib.loading = true;
    renderInbox();
  }
  const [res, board] = await Promise.all([
    refetch && state.inbox.sources.length ? api.clickupInbox(state.inbox.sources, state.inbox.statuses, state.inbox.mineStatuses) : null,
    dir ? api.kanbanRead(dir) : { tasks: [] },
  ]);
  if (seq !== ib.seq) return;
  ib.loading = false;
  if (res) {
    ib.at = Date.now();
    ib.error = res.error || '';
    if (!res.error) Object.assign(ib, { items: res.items, truncated: res.truncated });
  }
  // Tickets déjà sur le tableau du projet : triés, ils sortent de l'inbox
  ib.boardDir = dir;
  ib.onBoard = new Set(board.tasks.map((t) => t?.clickup?.id).filter(Boolean));
  renderInbox();
}

function ibItem(it) {
  const color = /^#[0-9a-f]{3,8}$/i.test(it.statusColor || '') ? ` style="--st:${it.statusColor}"` : '';
  const busy = ib.busy.has(it.id);
  const first = kbCols()[0];
  return `<div class="ib-item${busy ? ' busy' : ''}${it.id === ib.sel ? ' sel' : ''}" data-id="${esc(it.id)}" title="Clic ou Espace pour voir le ticket en entier">
    <div class="kb-cu">
      <button type="button" data-a="open" title="Ouvrir dans ClickUp">${icon('link')}${esc(ibRef(it))}</button>
      <span class="ib-status"${color}>${esc(it.status || '')}</span>
      ${it.priority === 'urgent' || it.priority === 'high' ? `<span class="kb-flag ${it.priority}" title="Priorité">${KB_PRIORITY[it.priority]}</span>` : ''}
    </div>
    <div class="kb-title">${esc(it.name)}</div>
    <div class="kb-meta">
      <span class="kb-time" title="Modifié le ${esc(new Date(it.updated).toLocaleString())}${it.creator ? ` · créé par ${esc(it.creator)}` : ''}">${esc(kbAgo(new Date(it.updated).toISOString()))}</span>
      <span class="ib-who">${it.mine ? 'assigné à toi' : 'personne'}</span>
      <span class="ib-actions">
        <button type="button" data-a="dismiss" title="Masquer ce ticket de l'inbox"${busy ? ' disabled' : ''}>Ignorer</button>
        <button type="button" class="primary" data-a="todo" title="M'assigner dans ClickUp${first.status ? `, passer le ticket en « ${esc(first.status)} »` : ''} et l'ajouter à « ${esc(first.label)} » du kanban"${busy || !ib.boardDir ? ' disabled' : ''}>${busy ? icon('spinner', 'ib-spin') : icon('plus')}${esc(first.label)}</button>
      </span>
    </div>
  </div>`;
}

function renderInbox() {
  const list = $('#ib-list');
  const dismissed = ibDismissed();
  const shown = ib.items.filter((it) => !dismissed.has(it.id) && !ib.onBoard.has(it.id));
  // Groupés par liste ClickUp, la liste du ticket le plus récent en premier
  const groups = new Map();
  for (const it of shown) {
    const where = [it.folder, it.list].filter(Boolean).join(' › ') || 'Sans liste';
    groups.set(where, [...(groups.get(where) || []), it]);
  }
  ib.shown = [...groups.values()].flat();
  if (!ib.shown.some((it) => it.id === ib.sel)) ib.sel = ib.shown[0]?.id || null;
  const hidden = ib.items.filter((it) => dismissed.has(it.id)).length;
  $('#side-inbox-count').textContent = shown.length || '';
  $('#ib-stats').textContent = ib.loading ? 'chargement…' : ib.at ? `${shown.length} à trier` : '';
  $('#ib-stats').title = ib.at ? `Mis à jour ${kbAgo(new Date(ib.at).toISOString())}` : '';
  const foot = $('#ib-foot');
  foot.classList.toggle('hidden', !hidden && !ib.truncated);
  foot.innerHTML = [
    ib.truncated && 'Beaucoup de tickets : seuls les plus récemment modifiés sont lus, coche des listes plus précises.',
    hidden && `${hidden} ignoré${hidden > 1 ? 's' : ''} · <button type="button" data-a="restore">Tout rétablir</button>`,
  ].filter(Boolean).map((x) => `<div>${x}</div>`).join('');
  if (!state.inbox.sources.length) {
    list.innerHTML = '<div class="diff-empty">Choisis les projets ClickUp à suivre dans les paramètres (⚙ → ClickUp → Inbox ClickUp).<br><button type="button" data-a="settings">Ouvrir les paramètres</button></div>';
  } else if (ib.error) {
    list.innerHTML = `<div id="ib-error">${esc(ib.error)}</div>`;
  } else if (!ib.at) {
    list.innerHTML = '<div class="diff-empty">Chargement des tickets…</div>';
  } else if (!shown.length) {
    list.innerHTML = '<div class="diff-empty">Rien à trier.</div>';
  } else {
    list.innerHTML = [...groups].map(([where, items]) => `<div class="ib-group">${esc(where)}<span>${items.length}</span></div>${items.map(ibItem).join('')}`).join('');
    list.querySelector('.ib-item.sel')?.scrollIntoView({ block: 'nearest' });
  }
  const first = kbCols()[0];
  $('#ib-keys').classList.toggle('hidden', !shown.length || !!ib.error);
  $('#ib-keys').innerHTML = `<kbd>J</kbd><kbd>K</kbd> naviguer <kbd>↵</kbd> ${esc(first.label)} <kbd>E</kbd> ignorer <kbd>Espace</kbd> détail <kbd>Z</kbd> annuler`;
}

function ibDismiss(ids) {
  const kept = state.inbox.dismissed.filter((x) => !ids.includes(x));
  state.inbox.dismissed = [...kept, ...ids].slice(-IB_MAX_DISMISSED);
  ib.lastDismissed = ids;
  ibSelectNear(ids[0]);
  persist();
  renderInbox();
  const names = ids.map((id) => { const it = ib.items.find((x) => x.id === id); return it ? ibRef(it) : id; }).join(', ');
  toast(`${names} ignoré`, '', { label: 'Annuler', run: ibUndoDismiss });
}
// Annule le dernier « Ignorer » seulement, sans faire revenir tous les tickets masqués
function ibUndoDismiss() {
  const ids = ib.lastDismissed;
  if (!ids?.length) return;
  ib.lastDismissed = null;
  state.inbox.dismissed = state.inbox.dismissed.filter((x) => !ids.includes(x));
  ib.sel = ids[0];
  persist();
  renderInbox();
}
// Le ticket traité sort de la liste : la sélection passe au suivant, sinon au précédent
function ibSelectNear(id) {
  const i = ib.shown.findIndex((it) => it.id === id);
  if (i >= 0 && ib.sel === id) ib.sel = (ib.shown[i + 1] || ib.shown[i - 1])?.id || null;
}

async function ibToTodo(it) {
  const dir = ib.boardDir;
  if (!dir || ib.busy.has(it.id)) return;
  ib.busy.add(it.id);
  renderInbox();
  const fail = (msg) => {
    ib.busy.delete(it.id);
    renderInbox();
    toast(`${ibRef(it)} : ${msg}`, 'err');
  };
  if (!it.mine) {
    const res = await api.clickupAssignMe(it.id);
    if (res.error) return fail(res.error);
    it.mine = true;
  }
  // Statut relié à la première colonne du projet de destination. Un échec n'empêche pas d'ajouter
  // la carte : il est signalé à la fin
  const preset = spacePresets().find((p) => p.cwd === dir);
  const first = kbColumns(preset)[0];
  const moved = first.status ? await api.clickupAdvance(it.id, state.inbox.statuses, first.status) : { ok: true, skipped: true };
  if (moved.status) it.status = moved.status;
  // Relu après l'assignation et le changement de statut : la carte porte les données à jour
  const res = await api.clickupTask(it.id);
  if (res.error) return fail(res.error);
  const board = await api.kanbanRead(dir);
  if (board.error) return fail(`assigné, mais .clutch/kanban.json est illisible (${board.error})`);
  if (!board.tasks.some((t) => t?.clickup?.id === it.id)) {
    board.tasks.push(kbFromClickup({ id: `t-${uid().slice(0, 6)}`, status: first.id, created: kbNow() }, res.task));
    await api.kanbanWrite(dir, board.tasks);
  }
  ib.busy.delete(it.id);
  ibSelectNear(it.id);
  if (dir === ib.boardDir) ib.onBoard.add(it.id);
  renderInbox();
  const where = preset?.name || shortPath(dir);
  if (moved.error) toast(`${ibRef(it)} assigné et ajouté à « ${first.label} » (${where}), mais son statut ClickUp n'a pas changé : ${moved.error}`, 'err');
  else toast(`${ibRef(it)} assigné et ajouté à « ${first.label} » (${where})${moved.skipped ? '' : ` · ClickUp → ${moved.status}`}`);
}

/* Détail d'un ticket : clic sur une ligne, le ticket est relu en entier dans ClickUp */
let ibViewing = null;
async function ibView(it) {
  ibViewing = it;
  const first = kbCols()[0];
  const todo = $('#ticket-view [data-a="todo"]');
  todo.textContent = first.label;
  todo.disabled = !ib.boardDir;
  $('#ticket-view-title').textContent = it.name;
  const body = $('#ticket-view-body');
  body.innerHTML = '<div class="tk-none">Chargement du ticket…</div>';
  $('#ticket-view').classList.remove('hidden');
  const res = await api.clickupTask(it.id);
  if (ibViewing !== it) return;
  if (res.error) body.innerHTML = `<div class="tk-none">${esc(res.error)}</div>`;
  else body.innerHTML = kbTicketInfo({ description: res.task.description, clickup: res.task });
}
$('#ticket-view').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  const it = ibViewing;
  if (!a || !it) return;
  closeOverlay($('#ticket-view'));
  if (a === 'dismiss') ibDismiss([it.id]);
  else if (a === 'todo') ibToTodo(it);
  if (state.inbox.open) $('#ib-list').focus();
});

// Tri au clavier, liste active : J/K ou flèches, Entrée met dans la première colonne, E ignore
$('#ib-list').addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target !== e.currentTarget) return;
  const k = e.key.toLowerCase();
  const i = ib.shown.findIndex((it) => it.id === ib.sel);
  const it = ib.shown[i];
  if (k === 'j' || k === 'arrowdown' || k === 'k' || k === 'arrowup') {
    const next = ib.shown[i + (k === 'j' || k === 'arrowdown' ? 1 : -1)];
    if (next) ib.sel = next.id;
    renderInbox();
  } else if (k === 'z') ibUndoDismiss();
  else if (k === 'escape') focusActive();
  else if (!it || ib.busy.has(it.id)) return;
  else if (k === 'enter') ibToTodo(it);
  else if (k === 'e') ibDismiss([it.id]);
  else if (k === ' ') ibView(it);
  else return;
  e.preventDefault();
  e.stopPropagation();
});

$('#inbox-panel').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (!b) {
    const it = ib.items.find((x) => x.id === e.target.closest('.ib-item')?.dataset.id);
    if (!it) return;
    ib.sel = it.id;
    renderInbox();
    if (!ib.busy.has(it.id)) ibView(it);
    return;
  }
  const a = b.dataset.a;
  if (a === 'settings') return openSettings('clickup');
  if (a === 'restore') {
    const ids = new Set(ib.items.map((it) => it.id));
    state.inbox.dismissed = state.inbox.dismissed.filter((x) => !ids.has(x));
    persist();
    return renderInbox();
  }
  const it = ib.items.find((x) => x.id === b.closest('.ib-item')?.dataset.id);
  if (!it) return;
  if (a === 'open') window.open(it.url || `https://app.clickup.com/t/${it.id}`);
  else if (a === 'dismiss') ibDismiss([it.id]);
  else if (a === 'todo') ibToTodo(it);
});

$('#ib-project').onchange = (e) => {
  state.kanban.presetId = e.target.value;
  persist();
  loadInbox();
};
$('#ib-close').onclick = toggleInbox;
$('#ib-reload').onclick = () => loadInbox(true);

/* Paramètres : projets ClickUp suivis (espaces, dossiers, listes) et statuts à trier */
let ibTree = null; // arborescence lue une fois par session (⟳ pour la relire)

async function openInboxSettings(reload) {
  $('#ib-statuses').value = state.inbox.statuses.join(', ');
  $('#ib-mine-statuses').value = state.inbox.mineStatuses.join(', ');
  renderIbSourceCount();
  const el = $('#ib-tree');
  if (ibTree && !reload) return renderIbTree();
  el.innerHTML = '<div class="desc">Chargement des projets ClickUp…</div>';
  const res = await api.clickupHierarchy();
  if (res.error) {
    el.innerHTML = `<div class="desc">${esc(res.error)} · <button type="button" data-a="tree-reload">Réessayer</button></div>`;
    return;
  }
  ibTree = res.teams;
  renderIbTree();
}

function renderIbSourceCount() {
  const n = state.inbox.sources.length;
  $('#ib-src-count').textContent = n ? `${n} sélection${n > 1 ? 's' : ''}` : 'aucun projet suivi';
}

function renderIbTree() {
  const picked = new Set(state.inbox.sources.map((s) => `${s.kind}:${s.id}`));
  // Un élément coché couvre ses enfants : affichés cochés et grisés
  const box = (kind, id, team, name, covered) => {
    const on = covered || picked.has(`${kind}:${id}`);
    return `<label class="ib-node"><input type="checkbox" data-kind="${kind}" data-id="${esc(id)}" data-team="${esc(team)}" data-name="${esc(name)}"${on ? ' checked' : ''}${covered ? ' disabled' : ''}> ${esc(name)}</label>`;
  };
  const lists = (ls, team, covered) => ls.map((l) => `<div class="ib-sub">${box('list', l.id, team, l.name, covered)}</div>`).join('');
  $('#ib-tree').innerHTML = `<div class="ib-tree-tools"><button type="button" data-a="tree-reload" title="Relire les projets ClickUp">${icon('refresh')}</button></div>` + ibTree.map((team) => `
    ${ibTree.length > 1 ? `<div class="ib-team">${esc(team.name)}</div>` : ''}
    ${team.spaces.map((s) => {
      const sOn = picked.has(`space:${s.id}`);
      const inside = [...s.folders.flatMap((f) => [`folder:${f.id}`, ...f.lists.map((l) => `list:${l.id}`)]), ...s.lists.map((l) => `list:${l.id}`)].some((k) => picked.has(k));
      return `<details class="ib-space"${inside ? ' open' : ''}>
        <summary>${box('space', s.id, team.id, s.name, false)}</summary>
        ${s.folders.map((f) => {
          const fOn = sOn || picked.has(`folder:${f.id}`);
          return `<div class="ib-sub">${box('folder', f.id, team.id, f.name, sOn)}${lists(f.lists, team.id, fOn)}</div>`;
        }).join('')}
        ${lists(s.lists, team.id, sOn)}
      </details>`;
    }).join('')}`).join('');
}

$('#ib-tree').addEventListener('change', (e) => {
  const c = e.target;
  if (c.type !== 'checkbox') return;
  const src = { kind: c.dataset.kind, id: c.dataset.id, teamId: c.dataset.team, name: c.dataset.name };
  let sources = state.inbox.sources.filter((s) => !(s.kind === src.kind && s.id === src.id));
  if (c.checked) {
    // Les enfants d'un élément coché deviennent inutiles : on les retire
    const children = new Set([...c.closest(src.kind === 'space' ? 'details' : '.ib-sub').querySelectorAll('input')].filter((x) => x !== c).map((x) => `${x.dataset.kind}:${x.dataset.id}`));
    sources = [...sources.filter((s) => !children.has(`${s.kind}:${s.id}`)), src];
  }
  state.inbox.sources = sources;
  ib.at = 0;
  persist();
  renderIbTree();
  renderIbSourceCount();
  if (state.inbox.open) loadInbox(true);
});
$('#ib-tree').addEventListener('click', (e) => {
  if (e.target.closest('[data-a="tree-reload"]')) openInboxSettings(true);
});
// Les statuts à trier reviennent aux valeurs par défaut si on vide le champ ; ceux « assigné à moi » peuvent rester vides
for (const [sel, key, fallback] of [['#ib-statuses', 'statuses', ['nouveau', 'à faire', 'rejeté']], ['#ib-mine-statuses', 'mineStatuses', []]]) {
  $(sel).addEventListener('change', (e) => {
    const list = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
    state.inbox[key] = list.length ? list : fallback;
    e.target.value = state.inbox[key].join(', ');
    persist();
    if (state.inbox.open) loadInbox(true);
  });
  // Entrée dans le champ ne doit pas soumettre la clé ClickUp
  $(sel).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });
}

function initInbox() {
  if (state.inbox.open && !state.kanban.open && !state.diff.open) setInboxOpen(true);
  setInterval(() => { if (state.inbox.open) loadInbox(); }, 60000);
  // Au retour sur l'app : relecture (ClickUp seulement si la dernière a plus de 5 min)
  window.addEventListener('focus', () => { if (state.inbox.open) loadInbox(); });
}
