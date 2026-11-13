/* ---------- Colonnes du kanban ---------- */
// Chargé par l'interface (<script>) et par le processus principal (require) : les deux doivent ranger
// une tâche dans la même colonne. Les colonnes se règlent par projet, dans preset.kanban.columns :
// id (valeur de « status » dans kanban.json), label, status (statut ClickUp relié, facultatif) et
// timer (le temps passé dans la colonne est compté).

const KB_DEFAULT_COLS = [
  { id: 'todo', label: 'À faire', status: 'à faire', timer: false },
  { id: 'in_progress', label: 'En cours', status: 'dev en cours', timer: true },
  { id: 'review', label: 'À relire', status: 'revue de code à faire', timer: false },
];
// Avant les colonnes réglables, les trois statuts ClickUp étaient dans preset.clickupSync
const KB_LEGACY_STATUS = { todo: 'todo', in_progress: 'inProgress', review: 'review' };
// Statuts tolérés à la lecture (écrits à la main ou par Claude), ramenés à l'id de la colonne.
// « done » n'a pas de colonne, sauf si le projet en crée une : la tâche reste dans le fichier mais n'est plus affichée.
const KB_ALIASES = { todo: 'todo', afaire: 'todo', backlog: 'todo', inprogress: 'in_progress', doing: 'in_progress', encours: 'in_progress', wip: 'in_progress', review: 'review', toreview: 'review', inreview: 'review', arelire: 'review', done: 'done', fait: 'done', termine: 'done' };
const kbNorm = (s) => String(s || '').normalize('NFD').replace(/[^a-z0-9]/gi, '').toLowerCase();

// Colonnes du projet, toujours au moins une
function kbColumns(preset) {
  const own = (Array.isArray(preset?.kanban?.columns) ? preset.kanban.columns : []).filter((c) => c && c.id && c.label);
  const old = preset?.clickupSync || {};
  const cols = own.length ? own : KB_DEFAULT_COLS.map((c) => ({ ...c, status: old[KB_LEGACY_STATUS[c.id]] ?? c.status }));
  return cols.map((c) => ({ id: String(c.id), label: String(c.label), status: String(c.status || '').trim(), timer: !!c.timer }));
}

// Colonne d'un statut écrit dans le fichier : son id, son nom (« En test ») ou une variante courante.
// Un statut inconnu tombe dans la première colonne.
function kbStatus(s, cols) {
  const n = kbNorm(s);
  const col = n && (cols.find((c) => kbNorm(c.id) === n) || cols.find((c) => kbNorm(c.label) === n) || cols.find((c) => c.id === KB_ALIASES[n]));
  return col ? col.id : KB_ALIASES[n] === 'done' ? 'done' : cols[0].id;
}

// Id d'une nouvelle colonne, tiré de son nom : « Fait » donne done, « En test » donne en_test
function kbNewColId(label, taken) {
  const free = (id) => !taken.some((x) => kbNorm(x) === kbNorm(id));
  const alias = KB_ALIASES[kbNorm(label)];
  const base = alias && free(alias) ? alias : String(label).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col';
  let id = base;
  for (let i = 2; !free(id); i++) id = `${base}_${i}`;
  return id;
}

if (typeof module !== 'undefined') module.exports = { kbColumns, kbStatus };
