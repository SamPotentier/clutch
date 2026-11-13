/* ---------- Kanban du projet ---------- */
// Les tâches vivent dans <projet>/.clutch/kanban.json : l'app les affiche et les édite,
// un skill Claude peut les faire avancer en modifiant le même fichier, surveillé en direct.

// Les colonnes et le statut ClickUp relié à chacune se règlent par projet, sur le tableau : un clic
// sur l'en-tête d'une colonne ouvre ses réglages (kanban-cols.js pour les règles).

// colEdit : colonne dont les réglages sont ouverts ; colFresh : colonne tout juste ajoutée (son id suit son premier nom) ;
// diverge : carte dont l'écart avec ClickUp est déplié ; synced : dernier changement de statut à montrer sur la carte
const kb = { dir: '', tasks: [], error: '', errorLine: null, loaded: false, seen: new Map(), editing: null, dragId: null, flash: new Map(), unsynced: new Map(),
  colEdit: null, colFresh: null, colFocus: false, diverge: null, synced: new Map(), cuStatuses: new Map(), focusId: null };
// Numéro de ticket ClickUp : #86c0abc12, CICD-123 ou un lien app.clickup.com/t/…
const KB_TICKET = /^(#\S+|[A-Za-z][\w]*-\d+|https?:\/\/(app\.)?clickup\.com\/t\/\S+)$/;

const kbPreset = () => spacePresets().find((p) => p.id === state.kanban.presetId);
const kbCols = () => kbColumns(kbPreset());
const kbNow = () => new Date().toISOString();

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

// Le tableau suit le projet de l'onglet actif
function kanbanFollow(tab) {
  if (tab?.presetId && spacePresets().some((p) => p.id === tab.presetId)) state.kanban.presetId = tab.presetId;
  else if (!kbPreset()) state.kanban.presetId = spacePresets()[0]?.id || '';
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
    Object.assign(kb, { dir, tasks: [], error: '', loaded: false, editing: null, colEdit: null, colFresh: null, diverge: null });
    kb.seen.clear();
    api.kanbanWatch(dir || null);
  }
  if (!dir) return renderKanban();
  const res = await api.kanbanRead(dir);
  if (dir !== kb.dir) return;
  kb.error = res.error || '';
  kb.errorLine = res.line || null;
  // Pendant une erreur (fichier en cours d'écriture ou cassé), on garde l'affichage précédent
  if (!kb.error) {
    const cols = kbCols();
    kb.tasks = res.tasks.filter((t) => t && t.id != null && t.title).map((t) => ({ ...t, id: String(t.id), status: kbStatus(t.status, cols) }));
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
  $('#kb-project').innerHTML = $('#ib-project').innerHTML = presets.length
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
  return `<div class="kb-card${flash}" draggable="true" tabindex="0" data-id="${esc(t.id)}" title="Clic ou Entrée : voir la tâche et lancer un skill · glisser ou ← → : changer de colonne">
    ${t.clickup ? kbClickupLine(t) : ''}
    <div class="kb-title">${esc(t.title)}</div>
    ${t.description ? `<div class="kb-desc">${esc(t.description)}</div>` : ''}
    ${kb.diverge === t.id ? kbDivergePanel(t) : ''}
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

// Ligne ClickUp de la carte : numéro et personnes assignées
function kbClickupLine(t) {
  const cu = t.clickup;
  const err = kb.unsynced.get(kbSyncKey(kb.dir, t.id));
  const who = (cu.assignees || []).slice(0, 3).map((n) => `<i class="kb-who" title="${esc(n)}">${esc(String(n).trim()[0]?.toUpperCase() || '?')}</i>`).join('');
  return `<div class="kb-cu"><button type="button" data-a="cu-open" title="Ouvrir dans ClickUp">${icon('link')}${esc(cu.customId || cu.id)}</button>${err ? `<em class="kb-unsynced" title="${esc(err)}">non synchronisé</em>` : ''}${who ? `<span class="kb-whos">${who}</span>` : ''}</div>`;
}

// Statut ClickUp en pastille, en tête des étiquettes de la carte (la ligne passe à la suite s'il est long)
function kbStatusChip(t) {
  const cu = t.clickup;
  const done = kb.synced.get(t.id);
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
  const col = kbPreset()?.clickupSync?.enabled && kbCols().find((c) => c.id === t.status);
  if (!col?.status || !t.clickup?.status || kbSame(t.clickup.status, col.status)) return false;
  // Écart déjà vu et laissé tel quel, ou carte tout juste déplacée (la synchro est en route)
  return t.ack !== `${t.clickup.status}|${t.status}` && Date.now() - Date.parse(t.updated || 0) > 2500;
}
function kbDivergePanel(t) {
  const col = kbCols().find((c) => c.id === t.status);
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
const kbSyncKey = (dir, taskId) => `${dir}\n${taskId}`;
const kbRenderSoon = (ms) => setTimeout(() => { if (state.kanban.open && !kb.editing && !kb.dragId) renderKanban(); }, ms);
api.onClickupSync((ev) => {
  const key = kbSyncKey(ev.project, ev.taskId);
  const what = ev.action === 'time' ? 'temps' : 'statut';
  // Statut du ticket après la synchro : la carte l'affiche tout de suite, sans recharger depuis ClickUp
  const t = ev.status && ev.project === kb.dir && kb.tasks.find((x) => x.id === ev.taskId);
  const shown = t?.clickup && state.kanban.open && ev.action === 'status';
  if (t?.clickup) {
    if (!ev.skipped && !kbSame(t.clickup.status, ev.status)) {
      kb.synced.set(t.id, { from: t.clickup.status, to: ev.status, at: Date.now() });
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
  if (ev.project === kb.dir) renderKanban();
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

// Réglages d'une colonne, ouverts sous son en-tête : nom, statut ClickUp relié, chrono, place
function kbColSettings(c, i, cols) {
  const known = kb.cuStatuses.get(kb.dir);
  const current = known?.find((x) => kbSame(x, c.status));
  const status = known
    ? `<select data-f="status"><option value="">Aucun</option>${known.map((x) => `<option${x === current ? ' selected' : ''}>${esc(x)}</option>`).join('')}${c.status && !current ? `<option selected value="${esc(c.status)}">${esc(c.status)} (absent de la liste)</option>` : ''}</select>`
    : `<input data-f="status" value="${esc(c.status)}" placeholder="aucun" spellcheck="false">`;
  const cards = kb.tasks.filter((t) => t.status === c.id).length;
  return `<div class="kb-colset" data-col="${esc(c.id)}">
    <label>Nom<input data-f="label" value="${esc(c.label)}" spellcheck="false" title="« status » dans kanban.json : ${esc(c.id)}"></label>
    <label title="Statut donné au ticket quand sa carte avance dans cette colonne">Statut ClickUp relié${status}</label>
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
  err.classList.toggle('hidden', !kb.error);
  // Ce qui est cassé, ce que ça change, et une sortie ; le message technique reste à un clic
  err.innerHTML = kb.error ? `<b>Le fichier du tableau est abîmé.</b>
    <span><code>.clutch/kanban.json</code> n'est plus un JSON valide${kb.errorLine ? `, autour de la ligne ${kb.errorLine}` : ''}. Le tableau reste en lecture seule et rien n'est écrasé tant qu'il n'est pas réparé.</span>
    <div><button type="button" data-a="err-fix">Demander à Claude de le réparer</button><details><summary>Détail</summary><code>${esc(kb.error)}</code></details></div>` : '';
  const cols = kbCols();
  const n = kb.tasks.filter((t) => cols.some((c) => c.id === t.status)).length;
  $('#kb-stats').textContent = kb.dir ? `${n} tâche${n > 1 ? 's' : ''}` : '';
  $('#kb-stats').title = kb.dir ? `${shortPath(kb.dir)}/.clutch/kanban.json` : '';
  $('#kb-wide').classList.toggle('on', !!state.side.wide);
  if (!kb.dir) {
    board.innerHTML = '<div class="diff-empty">Ajoute un projet pour avoir un tableau de tâches.</div>';
    return;
  }
  // Un rafraîchissement (Claude qui écrit) ne doit pas faire perdre une modification en cours
  $('#kb-add-btn').classList.toggle('hidden', !!kb.error);
  if (kb.error) kbCloseAdd();
  const active = document.activeElement;
  const editFocus = active?.closest?.('.kb-card.editing') ? active.className : '';
  // Saisie en cours dans les réglages d'une colonne, ou carte active au clavier : à retrouver après le rendu
  const setFocus = active?.closest?.('.kb-colset') && active.dataset.f ? { f: active.dataset.f, value: active.value, at: active.selectionStart } : null;
  const cardFocus = kb.focusId || (active?.classList?.contains('kb-card') && !editFocus ? active.dataset.id : null);
  kb.focusId = null;
  if (!cols.some((c) => c.id === kb.colEdit)) kb.colEdit = null;
  board.innerHTML = cols.map((c, i) => {
    const tasks = kb.tasks.filter((t) => t.status === c.id);
    return `<section class="kb-col${c.timer ? ' timed' : ''}" data-status="${esc(c.id)}">
      <header><button type="button" class="kb-col-name" data-a="col" title="${c.status ? `Statut ClickUp relié : ${esc(c.status)} · ` : ''}clic pour régler la colonne (Échap ou nouveau clic pour refermer)"><span class="kb-dot"></span>${esc(c.label)}</button><span class="kb-count">${tasks.length}</span></header>
      ${kb.colEdit === c.id ? kbColSettings(c, i, cols) : ''}
      <div class="kb-cards">${tasks.map(kbCard).join('')}</div>
    </section>`;
  }).join('') + (kbPreset() && !kb.error ? `<button type="button" class="kb-col-add" data-a="col-add" title="Ajouter une colonne au tableau">${icon('plus')}</button>` : '');
  board.classList.toggle('readonly', !!kb.error);
  if (editFocus) board.querySelector(`.kb-card.editing .${editFocus.split(' ')[0]}`)?.focus();
  const field = board.querySelector(`.kb-colset [data-f="${kb.colFocus ? 'label' : setFocus?.f}"]`);
  if (kb.colFocus && field) {
    field.focus();
    field.select();
  } else if (setFocus && field) {
    if (field.type !== 'checkbox' && field.tagName !== 'SELECT') field.value = setFocus.value;
    field.focus();
    try { field.setSelectionRange(setFocus.at, setFocus.at); } catch {}
  } else if (cardFocus) [...board.querySelectorAll('.kb-card')].find((c) => c.dataset.id === cardFocus)?.focus();
  kb.colFocus = false;
}

/* Colonnes : enregistrées dans le projet (preset.kanban.columns), le tableau est relu avec la nouvelle disposition */
function kbSetCols(cols) {
  const p = kbPreset();
  if (!p) return;
  p.kanban = { ...p.kanban, columns: cols };
  persist();
  loadKanban();
  if (state.inbox.open) renderInbox();
}
// Statuts de la liste ClickUp du projet, proposés dans les réglages d'une colonne (lus une fois par projet)
async function kbLoadCuStatuses() {
  const dir = kb.dir;
  if (!dir || kb.cuStatuses.has(dir)) return;
  kb.cuStatuses.set(dir, null);
  const res = await api.clickupCheckStatuses(dir, []);
  if (res.statuses?.length) kb.cuStatuses.set(dir, res.statuses);
  // Pas de carte liée ou ClickUp injoignable : saisie libre, et nouvel essai à la prochaine ouverture
  else kb.cuStatuses.delete(dir);
  if (kb.dir === dir && kb.colEdit) renderKanban();
}
function kbColAction(a, id) {
  const cols = kbCols();
  const i = cols.findIndex((c) => c.id === id);
  if (a === 'col-add') {
    const fresh = { id: kbNewColId('Nouvelle colonne', cols.map((c) => c.id)), label: 'Nouvelle colonne', status: '', timer: false };
    Object.assign(kb, { colEdit: fresh.id, colFresh: fresh.id, colFocus: true });
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
    const n = kb.tasks.filter((t) => t.status === id).length;
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
  else if (f === 'status') c.status = e.target.value.trim();
  else {
    const label = e.target.value.trim();
    if (!label) return renderKanban();
    c.label = label;
    // Colonne tout juste ajoutée et encore vide : son id suit le nom qu'on lui donne (« En test » → en_test)
    if (kb.colFresh === id && !kb.tasks.some((t) => t.status === id)) {
      c.id = kbNewColId(label, cols.filter((x) => x !== c).map((x) => x.id));
      kb.colEdit = c.id;
    }
    kb.colFresh = null;
  }
  kbSetCols(cols);
});

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

/* Ajout : le bouton « Ticket » de l'en-tête ouvre un champ, la tâche arrive dans la première colonne */
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
  kb.tasks.push(kbFromClickup({ id: `t-${uid().slice(0, 6)}`, status: kbCols()[0].id, created: now }, res.task));
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
  kb.tasks.push({ id: `t-${uid().slice(0, 6)}`, title, status: kbCols()[0].id, created: now, updated: now });
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

// Change une carte de colonne (ou de place) : avant la carte beforeId, sinon en fin de colonne
function kbMoveCard(t, status, beforeId) {
  const rest = kb.tasks.filter((x) => x !== t);
  let at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1;
  if (at < 0) {
    // En fin de colonne : juste après la dernière tâche de ce statut
    const last = rest.map((x) => x.status).lastIndexOf(status);
    at = last < 0 ? rest.length : last + 1;
  }
  if (t.status !== status) {
    Object.assign(t, { status, updated: kbNow() });
    if (kb.diverge === t.id) kb.diverge = null;
    if (t.clickup && !kbPreset()?.clickupSync?.enabled) kbSyncOffHint();
    // La synchro part : l'écart éventuel avec ClickUp ne s'affiche qu'une fois son résultat connu
    else if (t.clickup) kbRenderSoon(2600);
  }
  rest.splice(at, 0, t);
  kb.tasks = rest;
  saveKanban();
}

function kbFixFile() {
  const p = kbPreset();
  if (!p) return;
  const prompt = `Le fichier .clutch/kanban.json de ce projet n'est plus un JSON valide (${kb.error}). Répare-le sans perdre de tâche : il doit rester de la forme { "version": 1, "tasks": [ … ] }.`;
  const tab = activeTab();
  if (tab && tab.presetId === p.id && !tab.exited) {
    sendToTab(tab, prompt);
    focusTab(tab);
  } else openSession(p, { prompt, title: `${p.name} · réparer le tableau` });
}
$('#kb-error').addEventListener('click', (e) => { if (e.target.closest('[data-a="err-fix"]')) kbFixFile(); });

$('#kb-board').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]');
  if (b?.dataset.a.startsWith('col')) return kbColAction(b.dataset.a, b.closest('.kb-col')?.dataset.status);
  const card = e.target.closest('.kb-card');
  if (!card) return;
  if (!b) {
    // Clic sur la carte : le détail de la tâche, puis choisir un skill et un projet pour lancer
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
  else if (a === 'diverge') { kb.diverge = kb.diverge === t.id ? null : t.id; renderKanban(); }
  else if (a === 'align') {
    kb.diverge = null;
    api.clickupAlign(kb.dir, t.id);
    renderKanban();
  } else if (a === 'ack') {
    kb.diverge = null;
    t.ack = `${t.clickup.status}|${t.status}`;
    saveKanban();
  } else if (a === 'del' && !kb.error) {
    kb.tasks = kb.tasks.filter((x) => x !== t);
    saveKanban();
  }
});
$('#kb-board').addEventListener('input', (e) => {
  if (!kb.editing) return;
  if (e.target.classList.contains('kb-e-title')) kb.editing.title = e.target.value;
  if (e.target.classList.contains('kb-e-desc')) kb.editing.description = e.target.value;
});
// Carte active au clavier : Entrée l'ouvre, ← → la changent de colonne, ↑ ↓ passent à la voisine
$('#kb-board').addEventListener('keydown', (e) => {
  const card = e.target;
  if (!card.classList?.contains('kb-card') || card.classList.contains('editing') || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = kb.tasks.find((x) => x.id === card.dataset.id);
  if (!t) return;
  const cols = kbCols();
  const i = cols.findIndex((c) => c.id === t.status);
  if (e.key === 'Enter') openTaskRun(t, state.kanban.presetId);
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !kb.error) {
    const to = cols[i + (e.key === 'ArrowLeft' ? -1 : 1)];
    if (to) {
      kb.focusId = t.id;
      kbMoveCard(t, to.id);
    }
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const cards = [...card.parentElement.querySelectorAll('.kb-card')];
    cards[cards.indexOf(card) + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
  } else return;
  e.preventDefault();
  e.stopPropagation();
});
// Clic droit sur une carte : « Déplacer vers », pour qui ne veut ni glisser ni passer par le clavier
$('#kb-board').addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.kb-card:not(.editing)');
  const t = card && !kb.error && kb.tasks.find((x) => x.id === card.dataset.id);
  if (!t) return;
  e.preventDefault();
  contextMenu(e, kbCols().filter((c) => c.id !== t.status).map((c) => ({ label: `Déplacer vers « ${c.label} »`, run: () => kbMoveCard(t, c.id) })));
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
  kbMoveCard(t, spot.col.dataset.status, spot.before?.dataset.id);
});

$('#kb-project').onchange = (e) => {
  state.kanban.presetId = e.target.value;
  persist();
  loadKanban();
};
$('#kb-close').onclick = toggleKanban;
// Synchro ClickUp du projet : dans son formulaire
$('#kb-settings').onclick = () => {
  const p = kbPreset();
  if (p) openPresetModal(p, 'clickup');
};
// Le tableau prend la place des terminaux le temps d'une réorganisation
$('#kb-wide').onclick = () => {
  state.side.wide = !state.side.wide;
  updateSidePanel();
  renderKanban();
};
api.onKanbanChanged((dir) => { if (dir === kb.dir) loadKanban(); });

function initKanban() {
  if (state.kanban.open) setKanbanOpen(true);
  // Les « il y a 5 min » vieillissent
  setInterval(() => { if (state.kanban.open && !kb.editing && !kb.dragId) renderKanban(); }, 60000);
}
