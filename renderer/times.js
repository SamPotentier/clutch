/* ---------- Temps par jour ---------- */
// Une semaine à la fois : total de chaque jour face à l'objectif quotidien (7 h par défaut, du lundi au
// vendredi) et détail par ticket. Trois sources : les temps loggés dans ClickUp par l'utilisateur de la
// clé, les temps proposés qui attendent d'être validés, et le chrono des cartes en cours. La journée
// en cours s'affiche aussi dans la barre du haut.

const TM_REFRESH_MS = 5 * 60 * 1000;
const TM_HOUR = 3600000;
// offset : 0 pour la semaine en cours, -1 pour la précédente… ; weeks : lundi (ms) -> { entries, at } ;
// pending et running viennent de Clutch (pas de ClickUp) et valent pour maintenant
const tm = { offset: 0, weeks: new Map(), pending: [], running: [], error: '', loading: false, seq: 0 };

// Les sept jours de la semaine à minuit, plus le lundi suivant. setDate plutôt que + 24 h : changements d'heure
function tmWeek(offset) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 8 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
}
const tmDay = (d, opts) => d.toLocaleDateString('fr-FR', opts);
const tmSameDay = (ms, d) => new Date(ms).toDateString() === d.toDateString();

function setTimesOpen(open) {
  if (open && state.diff.open) {
    if (activeTab()) activeTab().diffDismissed = true;
    setDiffOpen(false);
  }
  if (open && state.kanban.open) setKanbanOpen(false);
  if (open && state.inbox.open) setInboxOpen(false);
  state.times.open = open;
  $('#times-panel').classList.toggle('hidden', !open);
  updateSidePanel();
  persist();
  if (open) loadTimes();
}
const toggleTimes = () => setTimesOpen(!state.times.open);

// Sans force, ClickUp n'est réinterrogé pour une semaine qu'après 5 min
async function tmFetch(offset, force) {
  const days = tmWeek(offset);
  const key = days[0].getTime();
  const have = tm.weeks.get(key);
  if (!force && have && Date.now() - have.at < TM_REFRESH_MS) return;
  const res = await api.clickupTimes(key, days[7].getTime() - 1);
  Object.assign(tm, { pending: res.pending || [], running: res.running || [], error: res.error || '' });
  if (!res.error) tm.weeks.set(key, { entries: res.entries, at: Date.now() });
}

async function loadTimes(force) {
  const seq = ++tm.seq;
  tm.loading = true;
  renderTimes();
  await tmFetch(tm.offset, force);
  if (seq !== tm.seq) return;
  tm.loading = false;
  renderTimes();
  renderToday();
}

// Journée en cours, panneau ouvert ou non : jauge de la barre du haut et pastille de l'onglet
async function refreshToday(force) {
  // Fonction masquée : ni jauge, ni appel à ClickUp
  if (feat('times')) await tmFetch(0, force);
  renderToday();
  if (state.times.open && !tm.loading) renderTimes();
}

// Ce qui compte pour un jour : loggé dans ClickUp, à valider, chrono des cartes en cours (aujourd'hui seulement)
function tmParts(d, entries) {
  const now = Date.now();
  const today = tmSameDay(now, d);
  // Un chrono lancé dans ClickUp même compte jusqu'à maintenant
  const logged = entries.filter((e) => tmSameDay(e.start, d)).map((e) => ({ ...e, duration: e.running ? now - e.start : e.duration }));
  const pending = tm.pending.filter((p) => tmSameDay(p.start, d));
  const running = today ? tm.running.map((r) => ({ ...r, duration: Math.max(0, now - r.start) })) : [];
  const sum = (list) => list.reduce((n, x) => n + x.duration, 0);
  return { today, logged, pending, running, ms: { logged: sum(logged), pending: sum(pending), running: sum(running) }, total: sum(logged) + sum(pending) + sum(running) };
}

function renderToday() {
  const week = tm.weeks.get(tmWeek(0)[0].getTime());
  const el = $('#today');
  el.classList.toggle('hidden', !week || !feat('times'));
  if (!week) return void ($('#side-times-count').textContent = '');
  const target = state.times.target * TM_HOUR;
  const p = tmParts(new Date(), week.entries);
  const pct = (ms) => `${Math.min(100, (ms / Math.max(target, p.total)) * 100).toFixed(1)}%`;
  el.classList.toggle('ok', p.total >= target);
  el.title = [`Aujourd'hui : ${kbDur(p.ms.logged)} loggé dans ClickUp`, p.ms.pending && `${kbDur(p.ms.pending)} à valider`, p.ms.running && `${kbDur(p.ms.running)} de chrono en cours`].filter(Boolean).join(', ')
    + ` · objectif ${kbDur(target)}. Clic pour le détail.`;
  el.innerHTML = `<span>Aujourd'hui</span><span class="tm-bar"><i class="tm-logged" style="width:${pct(p.ms.logged)}"></i><i class="tm-wait" style="width:${pct(p.ms.pending)}"></i><i class="tm-run" style="width:${pct(p.ms.running)}"></i></span><b>${kbDur(p.total)}</b><span>/ ${kbDur(target)}</span>`;
  $('#side-times-count').textContent = kbDur(p.total);
}

// Un jour : total, barre en trois segments face à l'objectif, puis les tickets du plus long au plus court
function tmDayBlock(d, entries, target) {
  const p = tmParts(d, entries);
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  if (weekend && !p.total) return '';
  const now = Date.now();
  const tasks = new Map();
  for (const e of p.logged) {
    const k = e.taskId || `sans:${e.name}`;
    const t = tasks.get(k) || { ...e, duration: 0, running: false };
    t.duration += e.duration;
    t.running ||= e.running;
    tasks.set(k, t);
  }
  let note = '';
  let cls = '';
  if (weekend) note = 'hors objectif';
  else if (p.total >= target) { cls = ' ok'; note = p.total - target >= 60000 ? `+ ${kbDur(p.total - target)}` : 'objectif atteint'; }
  else if (p.today) note = `reste ${kbDur(target - p.total)}`;
  else if (d < now) { cls = ' short'; note = `manque ${kbDur(target - p.total)}`; }
  const extra = [p.ms.pending && `${kbDur(p.ms.pending)} à valider`, p.ms.running && `${kbDur(p.ms.running)} en cours`].filter(Boolean).join(', ');
  const pct = (ms) => `${Math.min(100, (ms / Math.max(target, p.total)) * 100).toFixed(1)}%`;
  const link = (x) => (x.clickupId || x.taskId ? `<a href="${esc(/^https?:\/\//.test(x.url || '') ? x.url : `https://app.clickup.com/t/${x.clickupId || x.taskId}`)}" title="Ouvrir dans ClickUp">${esc(x.ref || x.clickupId || x.taskId)}</a>` : '');
  const name = (x) => `<span class="tm-name" title="${esc(x.name)}">${esc(x.name || 'Sans ticket')}</span>`;
  const rows = [
    ...[...tasks.values()].sort((a, b) => b.duration - a.duration).map((t) => `<li>${link(t)}${name(t)}<span class="tm-dur${t.running ? ' kb-live' : ''}">${kbDur(t.duration)}</span></li>`),
    ...p.running.map((r) => `<li title="Chrono de la carte, pas encore dans ClickUp">${link(r)}${name(r)}<span class="tm-dur kb-live">${kbDur(r.duration)}</span></li>`),
    ...p.pending.map((x) => `<li class="tm-pending" data-id="${esc(x.id)}">${link(x)}${name(x)}
      <span class="tm-tag">à valider</span><input type="number" min="1" step="1" value="${Math.max(1, Math.round(x.duration / 60000))}" aria-label="Minutes à logger" title="Minutes à logger"><span class="tm-unit">min</span>
      <button type="button" class="primary" data-a="send" title="Créer ce temps dans ClickUp">Envoyer</button><button type="button" data-a="skip" title="Ne rien logger pour ce passage">${icon('x')}</button></li>`),
  ];
  // Un jour passé incomplet : le skill « temps », s'il existe, sait le reconstituer
  const catchUp = cls === ' short' && allSkills().some((s) => s.name === 'temps')
    ? `<button type="button" class="tm-catch" data-a="catchup" data-day="${d.getTime()}" title="Lance le skill temps pour reconstituer cette journée">Rattraper avec /temps</button>` : '';
  return `<section class="tm-day${cls}${p.today ? ' today' : ''}${d > now ? ' future' : ''}">
    <header><span class="tm-date">${esc(tmDay(d, { weekday: 'long', day: 'numeric', month: 'short' }))}</span><span class="tm-note"${extra ? ` title="Dont ${esc(extra)}"` : ''}>${esc(note)}${extra ? ' en comptant tout' : ''}</span>${catchUp}<span class="tm-total">${p.total ? kbDur(p.total) : '—'}${weekend ? '' : `<small> / ${kbDur(target)}</small>`}</span></header>
    ${weekend ? '' : `<div class="tm-bar"><i class="tm-logged" style="width:${pct(p.ms.logged)}"></i><i class="tm-wait" style="width:${pct(p.ms.pending)}" title="À valider"></i><i class="tm-run" style="width:${pct(p.ms.running)}" title="Chrono en cours"></i></div>`}
    ${rows.length ? `<ul>${rows.join('')}</ul>` : ''}
  </section>`;
}

function renderTimes() {
  const days = tmWeek(tm.offset);
  const target = state.times.target * TM_HOUR;
  const week = tm.weeks.get(days[0].getTime());
  const total = week ? days.slice(0, 7).reduce((n, d) => n + tmParts(d, week.entries).total, 0) : 0;
  $('#tm-week').textContent = tm.offset ? `Semaine du ${tmDay(days[0], { day: 'numeric', month: 'short' })}` : 'Cette semaine';
  $('#tm-stats').textContent = tm.loading && !week ? 'chargement…' : week ? `${kbDur(total)} / ${kbDur(target * 5)}` : '';
  $('#tm-stats').title = week ? `Mis à jour ${kbAgo(new Date(week.at).toISOString())}` : '';
  $('#tm-next').disabled = tm.offset >= 0;
  $('#tm-today').classList.toggle('hidden', !tm.offset);
  $('#tm-send-all').classList.toggle('hidden', tm.pending.length < 2);
  $('#tm-send-all').textContent = `Tout envoyer (${tm.pending.length})`;
  if ($('#tm-target') !== document.activeElement) $('#tm-target').value = state.times.target;
  const list = $('#tm-list');
  // Une durée en cours de correction ne doit pas être perdue par un rafraîchissement
  if (week && document.activeElement?.closest?.('.tm-pending')) return;
  if (!week) list.innerHTML = tm.error ? `<div id="ib-error">${esc(tm.error)}</div>` : '<div class="diff-empty">Chargement des temps…</div>';
  else list.innerHTML = (tm.error ? `<div id="ib-error">${esc(tm.error)} — affichage de la dernière lecture.</div>` : '') + days.slice(0, 7).map((d) => tmDayBlock(d, week.entries, target)).join('');
}

/* Temps à valider : mêmes propositions que les fenêtres en bas à droite, envoyées d'ici une par une ou toutes */
function tmForget(id) {
  tm.pending = tm.pending.filter((p) => p.id !== id);
  if (document.activeElement?.closest?.('.tm-pending')) document.activeElement.blur();
  if (state.times.open) renderTimes();
  renderToday();
}
function tmConfirm(id, ms) {
  api.clickupTimeConfirm(id, ms);
  kbTimePromptClose(id);
  tmForget(id);
}
api.onClickupTimePending((p) => {
  if (tm.pending.some((x) => x.id === p.id)) return;
  tm.pending.push({ id: p.id, clickupId: p.clickupId, ref: p.ref, name: p.title, start: p.start, duration: p.duration });
  // Le chrono de la carte vient de s'arrêter
  tm.running = tm.running.filter((r) => r.clickupId !== p.clickupId);
  if (state.times.open) renderTimes();
  renderToday();
});

function tmCatchUp(d) {
  const skill = allSkills().find((s) => s.name === 'temps');
  if (!skill) return;
  openSkillRun(skill, activeTab()?.presetId);
  const input = $('#skill-run-fields [data-key]');
  if (input && !input.value) {
    input.value = tmDay(d, { weekday: 'long', day: 'numeric', month: 'long' });
    updateRunPreview();
  }
}

$('#tm-list').addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]');
  if (!a) return;
  if (a.dataset.a === 'catchup') return tmCatchUp(new Date(+a.dataset.day));
  const row = a.closest('.tm-pending');
  if (!row) return;
  const min = Math.floor(+row.querySelector('input').value) || 0;
  if (a.dataset.a === 'skip') tmConfirm(row.dataset.id, 0);
  else if (min > 0) tmConfirm(row.dataset.id, min * 60000);
  else row.querySelector('input').focus();
});
$('#tm-list').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('.tm-pending')) e.target.closest('.tm-pending').querySelector('[data-a="send"]').click();
});
$('#tm-send-all').onclick = () => [...tm.pending].forEach((p) => tmConfirm(p.id, p.duration));

function tmGo(offset) {
  tm.offset = Math.min(0, offset);
  loadTimes();
}
$('#tm-prev').onclick = () => tmGo(tm.offset - 1);
$('#tm-next').onclick = () => tmGo(tm.offset + 1);
$('#tm-today').onclick = () => tmGo(0);
$('#tm-reload').onclick = () => loadTimes(true);
$('#tm-close').onclick = toggleTimes;
$('#today').onclick = () => {
  tm.offset = 0;
  if (state.times.open) loadTimes();
  else setTimesOpen(true);
};
$('#tm-target').addEventListener('change', (e) => {
  const h = Math.min(24, Math.max(0.5, +e.target.value || 7));
  state.times.target = h;
  e.target.value = h;
  persist();
  renderTimes();
  renderToday();
});
// Statut ou temps synchronisé : un chrono a pu démarrer ou s'arrêter, un temps vient d'arriver dans ClickUp
api.onClickupSync((ev) => {
  if (ev.ok) setTimeout(() => (state.times.open ? loadTimes(true) : refreshToday(true)), 1500);
});

function initTimes() {
  if (state.times.open && !state.kanban.open && !state.diff.open && !state.inbox.open) setTimesOpen(true);
  refreshToday();
  // Les chronos avancent chaque minute ; ClickUp n'est relu que toutes les 5 min
  setInterval(() => refreshToday(), 60000);
  window.addEventListener('focus', () => refreshToday());
}
