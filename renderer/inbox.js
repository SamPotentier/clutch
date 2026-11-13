/* ---------- Inbox ClickUp ---------- */
// ClickUp n'expose pas son Inbox : on liste les tickets à trier des listes ClickUp suivies (onglet
// « Inbox » des paramètres). « Ignorer » les masque (mémorisé ici), l'autre bouton m'assigne dans
// ClickUp, passe le ticket au statut relié à la première colonne du kanban (« À faire » par défaut) et
// crée la carte dans le projet de sa liste ClickUp, affiché et modifiable sur l'en-tête de chaque liste.

const IB_REFRESH_MS = 5 * 60 * 1000;
const IB_MAX_DISMISSED = 2000;
// sel : ticket sélectionné au clavier ; shown : tickets affichés, dans l'ordre de l'écran ;
// boards : projets de l'espace et leurs cartes ({ dir, preset, tasks, error }) ; seen : statuts rencontrés dans les listes suivies
const ib = { items: [], error: '', truncated: false, loading: false, at: 0, seq: 0, busy: new Set(), boards: [], seen: [], sel: null, shown: [] };

const ibDismissed = () => new Set(state.inbox.dismissed);
const ibRef = (it) => it.customId || it.id;
const ibListKey = (it) => it.listId || it.list || '';
const ibOpenBoards = () => ib.boards.filter((b) => !b.error);

// Projet où ranger un ticket : celui choisi pour sa liste ClickUp, sinon celui qui a déjà des cartes de
// cette liste, sinon celui de l'onglet actif
function ibRoute(it) {
  const open = ibOpenBoards();
  return open.find((b) => b.preset.id === state.inbox.routes[ibListKey(it)]) || kbListBoard(it, open)
    || open.find((b) => b.preset.id === activeTab()?.presetId) || open[0] || null;
}

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

// force : true relit ClickUp ; 'filter' redemande les tickets à main, qui refiltre ceux qu'il garde
// (statuts à trier changés) ; sinon ClickUp n'est réinterrogé qu'après 5 min et seuls les tableaux sont relus
async function loadInbox(force) {
  const stale = !ib.at || Date.now() - ib.at > IB_REFRESH_MS;
  await Promise.all([(force || stale) && state.inbox.sources.length ? ibFetch(force === true || stale) : null, ibReadBoards()]);
  renderInbox();
  renderIbStatuses();
}

// fresh : ClickUp est réinterrogé, sinon main refiltre les tickets qu'il garde
async function ibFetch(fresh) {
  // Seule une demande plus récente annule celle-ci : la relecture des tableaux (chaque minute) n'y touche pas
  const seq = ++ib.seq;
  if (fresh) {
    ib.loading = true;
    renderInbox();
  }
  const res = await api.clickupInbox(state.inbox.sources, state.inbox.statuses, state.inbox.mineStatuses, fresh);
  if (seq !== ib.seq) return;
  ib.loading = false;
  ib.at = res.at || Date.now();
  ib.error = res.error || '';
  if (!res.error) Object.assign(ib, { items: res.items, truncated: res.truncated, seen: res.statuses });
}

// Cartes de tous les projets : les tickets déjà rangés sortent de l'inbox, les autres suivent ceux de leur liste
async function ibReadBoards() {
  ib.boards = await Promise.all(kbProjects().map(async (preset) => ({ dir: preset.cwd, preset, ...(await api.kanbanRead(preset.cwd)) })));
}

function ibItem(it) {
  const color = /^#[0-9a-f]{3,8}$/i.test(it.statusColor || '') ? ` style="--st:${it.statusColor}"` : '';
  const busy = ib.busy.has(it.id);
  const to = ibRoute(it);
  const first = kbColumns(to?.preset, state.kanban.columns)[0];
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
        <button type="button" class="primary" data-a="todo" title="M'assigner dans ClickUp${first.status ? `, passer le ticket en « ${esc(first.status)} »` : ''} et l'ajouter à « ${esc(first.label)} »${to ? ` de ${esc(to.preset.name)}` : ''}"${busy || !to ? ' disabled' : ''}>${busy ? icon('spinner', 'ib-spin') : icon('plus')}${esc(first.label)}</button>
      </span>
    </div>
  </div>`;
}

// En-tête d'une liste ClickUp : le projet où vont ses tickets, à choisir une fois
function ibGroup(where, items) {
  const open = ibOpenBoards();
  const to = ibRoute(items[0]);
  const route = open.length > 1
    ? `<label class="ib-route" title="Projet où sont rangés les tickets de cette liste">→<select data-list="${esc(ibListKey(items[0]))}">${open.map((b) => `<option value="${b.preset.id}"${b === to ? ' selected' : ''}>${esc(b.preset.name)}</option>`).join('')}</select></label>`
    : '';
  return `<div class="ib-group">${esc(where)}<span>${items.length}</span>${route}</div>${items.map(ibItem).join('')}`;
}

function renderInbox() {
  const list = $('#ib-list');
  const dismissed = ibDismissed();
  // Tickets déjà sur le tableau, quel que soit le projet : triés, ils sortent de l'inbox
  const onBoard = new Set(ib.boards.flatMap((b) => b.tasks).map((t) => t?.clickup?.id).filter(Boolean));
  const shown = ib.items.filter((it) => !dismissed.has(it.id) && !onBoard.has(it.id));
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
    ib.truncated && 'Beaucoup de tickets : seuls les plus récemment modifiés sont lus, suis des listes plus précises.',
    hidden && `${hidden} ignoré${hidden > 1 ? 's' : ''} · <button type="button" data-a="restore">Tout rétablir</button>`,
  ].filter(Boolean).map((x) => `<div>${x}</div>`).join('');
  if (!state.inbox.sources.length) {
    list.innerHTML = '<div class="diff-empty">Choisis les listes ClickUp à suivre.<br><button type="button" data-a="settings">Régler l\'inbox</button></div>';
  } else if (ib.error) {
    list.innerHTML = `<div id="ib-error">${esc(ib.error)}</div>`;
  } else if (!ib.at) {
    list.innerHTML = '<div class="diff-empty">Chargement des tickets…</div>';
  } else if (!shown.length) {
    list.innerHTML = '<div class="diff-empty">Rien à trier.</div>';
  } else {
    list.innerHTML = [...groups].map(([where, items]) => ibGroup(where, items)).join('');
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
  const to = ibRoute(it);
  if (!to || ib.busy.has(it.id)) return;
  const { dir, preset } = to;
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
  // Statut relié à la première colonne, tel que le projet de destination le nomme. Un échec n'empêche
  // pas d'ajouter la carte : il est signalé à la fin
  const first = kbColumns(preset, state.kanban.columns)[0];
  const moved = first.status ? await api.clickupAdvance(it.id, state.inbox.statuses, first.status) : { ok: true, skipped: true };
  if (moved.status) it.status = moved.status;
  // Relu après l'assignation et le changement de statut : la carte porte les données à jour
  const res = await api.clickupTask(it.id);
  if (res.error) return fail(res.error);
  const board = await api.kanbanRead(dir);
  if (board.error) return fail(`assigné, mais .clutch/kanban.json de ${preset.name} est illisible (${board.error})`);
  if (!board.tasks.some((t) => t?.clickup?.id === it.id)) {
    board.tasks.push(kbFromClickup({ id: kbNewId(), status: first.id, created: kbNow() }, res.task));
    await api.kanbanWrite(dir, board.tasks);
  }
  ib.busy.delete(it.id);
  ibSelectNear(it.id);
  // La carte est sur le tableau : le ticket sort de l'inbox sans attendre la prochaine relecture
  const cur = ib.boards.find((b) => b.dir === dir);
  if (cur) cur.tasks = board.tasks;
  renderInbox();
  if (moved.error) toast(`${ibRef(it)} assigné et ajouté à « ${first.label} » (${preset.name}), mais son statut ClickUp n'a pas changé : ${moved.error}`, 'err');
  else toast(`${ibRef(it)} assigné et ajouté à « ${first.label} » (${preset.name})${moved.skipped ? '' : ` · ClickUp → ${moved.status}`}`);
}

/* Détail d'un ticket : clic sur une ligne, le ticket est relu en entier dans ClickUp */
let ibViewing = null;
async function ibView(it) {
  ibViewing = it;
  const to = ibRoute(it);
  const todo = $('#ticket-view [data-a="todo"]');
  todo.textContent = `${kbCols()[0].label}${to && ibOpenBoards().length > 1 ? ` · ${to.preset.name}` : ''}`;
  todo.disabled = !to;
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
// Projet d'une liste ClickUp, choisi sur son en-tête : retenu pour les tickets suivants
$('#ib-list').addEventListener('change', (e) => {
  const list = e.target.dataset?.list;
  if (list == null) return;
  state.inbox.routes[list] = e.target.value;
  persist();
  renderInbox();
  $('#ib-list').focus();
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
  if (a === 'settings') return openSettings('inbox');
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

$('#ib-close').onclick = toggleInbox;
$('#ib-reload').onclick = () => loadInbox(true);
$('#ib-settings').onclick = () => openSettings('inbox');

/* Réglages (onglet « Inbox » des paramètres) : listes ClickUp suivies et statuts à trier. Rien à
   valider : chaque choix est enregistré et l'inbox relue aussitôt. */
// tree : espaces › dossiers › listes, d'abord celle que main a gardée, puis relue une fois par session ;
// q : recherche en cours
const ibSet = { tree: null, fresh: false, loading: false, error: '', q: '' };
const IB_KINDS = { space: 'Espace', folder: 'Dossier', list: 'Liste' };
const IB_MAX_FOUND = 80;
const ibSrcKey = (s) => `${s.kind}:${s.id}`;

async function openInboxSettings(reload) {
  $('#ib-search').value = ibSet.q = '';
  renderIbSources();
  renderIbStatuses();
  $('#ib-search').focus();
  // Les statuts proposés sont ceux des tickets des listes suivies : il faut les avoir lus une fois
  if (state.inbox.sources.length && !ib.at) loadInbox('filter');
  if (ibSet.fresh && !reload) return;
  if (!ibSet.tree) {
    ibSet.tree = (await api.clickupHierarchy(true))?.teams || null;
    renderIbSources();
  }
  ibSet.loading = true;
  renderIbSources();
  const res = await api.clickupHierarchy();
  ibSet.loading = false;
  ibSet.error = res.error || '';
  if (!res.error) Object.assign(ibSet, { tree: res.teams, fresh: true });
  renderIbSources();
}

// L'arbre à plat : chaque élément avec son chemin et les clés de ses parents
function ibNodes() {
  const out = [];
  for (const team of ibSet.tree || []) {
    for (const s of team.spaces) {
      const sk = `space:${s.id}`;
      out.push({ kind: 'space', id: s.id, teamId: team.id, name: s.name, path: '', parents: [] });
      const lists = (ls, path, parents) => ls.forEach((l) => out.push({ kind: 'list', id: l.id, teamId: team.id, name: l.name, path, parents }));
      for (const f of s.folders) {
        out.push({ kind: 'folder', id: f.id, teamId: team.id, name: f.name, path: s.name, parents: [sk] });
        lists(f.lists, `${s.name} › ${f.name}`, [sk, `folder:${f.id}`]);
      }
      lists(s.lists, s.name, [sk]);
    }
  }
  return out;
}

function ibToggleSource(node, on) {
  const key = ibSrcKey(node);
  let sources = state.inbox.sources.filter((s) => ibSrcKey(s) !== key);
  if (on) {
    // Les enfants d'un élément suivi deviennent inutiles : on les retire
    const inside = new Set(ibNodes().filter((n) => n.parents.includes(key)).map(ibSrcKey));
    sources = [...sources.filter((s) => !inside.has(ibSrcKey(s))), { kind: node.kind, id: node.id, teamId: node.teamId, name: node.name }];
  }
  state.inbox.sources = sources;
  if (!sources.length) Object.assign(ib, { items: [], seen: [], at: 0 });
  persist();
  renderIbSources();
  loadInbox(true);
}

function renderIbSources() {
  const n = state.inbox.sources.length;
  $('#ib-src-count').textContent = ibSet.loading ? 'lecture de ClickUp…' : n ? `${n} suivie${n > 1 ? 's' : ''}` : 'aucune';
  $('#ib-picked').innerHTML = state.inbox.sources.map((s) => `<button type="button" data-key="${esc(ibSrcKey(s))}" title="Ne plus suivre">${IB_KINDS[s.kind] || ''} <b>${esc(s.name || s.id)}</b>${icon('x')}</button>`).join('');
  const el = $('#ib-tree');
  if (!ibSet.tree) {
    el.innerHTML = ibSet.error
      ? `<div class="desc">${esc(ibSet.error)} · <button type="button" data-a="tree-reload">Réessayer</button> · <button type="button" data-a="key">Clé ClickUp</button></div>`
      : '<div class="desc">Lecture des espaces ClickUp…</div>';
    return;
  }
  const picked = new Set(state.inbox.sources.map(ibSrcKey));
  // Un élément suivi couvre ses enfants : affichés cochés et grisés
  const box = (n, label) => {
    const covered = n.parents.some((k) => picked.has(k));
    return `<label class="ib-node"><input type="checkbox" data-key="${esc(ibSrcKey(n))}"${covered || picked.has(ibSrcKey(n)) ? ' checked' : ''}${covered ? ' disabled' : ''}> ${label}</label>`;
  };
  const nodes = ibNodes();
  const tools = `<div class="ib-tree-tools"><button type="button" data-a="tree-reload" title="Relire les espaces ClickUp">${icon('refresh')}</button></div>`;
  const q = kbNorm(ibSet.q);
  if (q) {
    // Recherche : les résultats à plat, avec leur chemin
    const found = nodes.filter((n) => kbNorm(`${n.path} ${n.name}`).includes(q));
    el.innerHTML = tools + (found.length
      ? found.slice(0, IB_MAX_FOUND).map((n) => box(n, `${esc(n.name)}<small>${IB_KINDS[n.kind]}${n.path ? ` · ${esc(n.path)}` : ''}</small>`)).join('') + (found.length > IB_MAX_FOUND ? `<div class="desc">${found.length - IB_MAX_FOUND} autres : précise la recherche.</div>` : '')
      : '<div class="desc">Rien ne correspond.</div>');
    return;
  }
  const kids = (key) => nodes.filter((n) => n.parents.at(-1) === key);
  const sub = (n) => `<div class="ib-sub">${box(n, esc(n.name))}${kids(ibSrcKey(n)).map(sub).join('')}</div>`;
  el.innerHTML = tools + ibSet.tree.map((team) => `
    ${ibSet.tree.length > 1 ? `<div class="ib-team">${esc(team.name)}</div>` : ''}
    ${nodes.filter((n) => n.kind === 'space' && n.teamId === team.id).map((s) => {
      const inside = nodes.some((n) => n.parents.includes(ibSrcKey(s)) && picked.has(ibSrcKey(n)));
      return `<details class="ib-space"${inside ? ' open' : ''}><summary>${box(s, esc(s.name))}</summary>${kids(ibSrcKey(s)).map(sub).join('')}</details>`;
    }).join('')}`).join('');
}

$('#ib-search').addEventListener('input', (e) => {
  ibSet.q = e.target.value;
  renderIbSources();
});
// Entrée suit le premier résultat de la recherche : une liste se trouve et se coche sans la souris
$('#ib-search').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const first = $('#ib-tree input:not(:disabled):not(:checked)');
  if (!ibSet.q.trim() || !first) return;
  ibToggleSource(ibNodes().find((n) => ibSrcKey(n) === first.dataset.key), true);
  e.target.select();
});
$('#ib-tree').addEventListener('change', (e) => {
  const node = e.target.type === 'checkbox' && ibNodes().find((n) => ibSrcKey(n) === e.target.dataset.key);
  if (node) ibToggleSource(node, e.target.checked);
});
$('#ib-tree').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'tree-reload') openInboxSettings(true);
  else if (a === 'key') showSettingsTab('clickup');
});
$('#ib-picked').addEventListener('click', (e) => {
  const key = e.target.closest('[data-key]')?.dataset.key;
  const s = state.inbox.sources.find((x) => ibSrcKey(x) === key);
  if (s) ibToggleSource(s, false);
});

/* Statuts : ceux rencontrés dans les listes suivies, avec ce que chaque choix ferait apparaître.
   « à trier » (statuses) montre les tickets sans personne ou à moi, « si à moi » (mineStatuses)
   seulement ceux qui me sont assignés. */
const ibStatusMode = (name) => (state.inbox.statuses.some((x) => kbSame(x, name)) ? 'open' : state.inbox.mineStatuses.some((x) => kbSame(x, name)) ? 'mine' : 'off');

function renderIbStatuses() {
  if ($('#settings').classList.contains('hidden') || settingsTab !== 'inbox') return;
  const el = $('#ib-st');
  // Les statuts réglés restent proposés même si aucun ticket ouvert ne les porte en ce moment
  const rows = [...ib.seen];
  for (const name of [...state.inbox.statuses, ...state.inbox.mineStatuses]) if (!rows.some((r) => kbSame(r.name, name))) rows.push({ name, open: 0, mine: 0 });
  const rank = { open: 0, mine: 1, off: 2 };
  rows.sort((a, b) => rank[ibStatusMode(a.name)] - rank[ibStatusMode(b.name)] || b.open - a.open);
  const on = rows.filter((r) => ibStatusMode(r.name) !== 'off').length;
  $('#ib-st-count').textContent = ib.loading ? 'lecture des tickets…' : `${on} sur ${rows.length}`;
  const seg = (r, mode, label, n) => `<button type="button" data-mode="${mode}"${ibStatusMode(r.name) === mode ? ' class="on"' : ''}>${label}${n ? `<i>${n}</i>` : ''}</button>`;
  el.innerHTML = rows.map((r) => `<div class="ib-st-row" data-name="${esc(r.name)}">
      <span class="ib-status"${/^#[0-9a-f]{3,8}$/i.test(r.color || '') ? ` style="--st:${r.color}"` : ''}>${esc(r.name)}</span>
      <span class="seg">${seg(r, 'off', 'Masqué')}${seg(r, 'mine', 'Si assigné à moi', r.mine)}${seg(r, 'open', 'À moi ou à personne', r.open)}</span>
    </div>`).join('')
    || `<div class="desc">${state.inbox.sources.length ? (ib.error ? esc(ib.error) : 'Lecture des tickets…') : 'Suis d\'abord une liste : ses statuts apparaîtront ici.'}</div>`;
}

function ibSetStatus(name, mode) {
  for (const key of ['statuses', 'mineStatuses']) state.inbox[key] = state.inbox[key].filter((x) => !kbSame(x, name));
  if (mode === 'open') state.inbox.statuses.push(name);
  else if (mode === 'mine') state.inbox.mineStatuses.push(name);
  persist();
  renderIbStatuses();
  // Les tickets sont déjà lus : main refiltre, sans réinterroger ClickUp
  loadInbox('filter');
}
$('#ib-st').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (b) ibSetStatus(b.closest('.ib-st-row').dataset.name, b.dataset.mode);
});
$('#ib-st-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  ibSetStatus(name, 'open');
});

function initInbox() {
  if (state.inbox.open && !state.kanban.open && !state.diff.open) setInboxOpen(true);
  // Pas de relecture pendant qu'on choisit le projet d'une liste : la liste déroulante se refermerait
  setInterval(() => { if (state.inbox.open && !document.activeElement?.closest?.('.ib-route')) loadInbox(); }, 60000);
  // Au retour sur l'app : relecture (ClickUp seulement si la dernière a plus de 5 min)
  window.addEventListener('focus', () => { if (state.inbox.open) loadInbox(); });
}
