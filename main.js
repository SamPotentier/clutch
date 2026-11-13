const { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, spawn } = require('child_process');
const pty = require('node-pty');

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
const ptys = new Map();
let nextId = 1;
let win;

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return { presets: [], prompts: [] };
  }
}

// L'app s'appelait « Terminal Hub » : on reprend ses données au premier lancement sous le nom Clutch
function migrateOldData() {
  const old = path.join(app.getPath('appData'), 'Terminal Hub', 'data.json');
  if (fs.existsSync(dataFile()) || !fs.existsSync(old)) return;
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.copyFileSync(old, dataFile());
}

// Clés de data.json tenues par le processus principal (file de synchro ClickUp) :
// l'interface réécrit le fichier en entier sans les connaître, on les remet à chaque sauvegarde.
const mainOwned = {};
function saveData(data) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify({ ...data, ...mainOwned }, null, 2));
}
function saveMainOwned() {
  saveData(loadData());
}

const expandHome = (p) => String(p || '').replace(/^~(?=$|\/)/, os.homedir());

// Compte Claude : chaque dossier de config (CLAUDE_CONFIG_DIR) a sa propre connexion, ses réglages et son historique
const claudeEnv = (configDir) => (configDir ? { CLAUDE_CONFIG_DIR: expandHome(configDir) } : {});
const claudeHome = (configDir) => (configDir ? expandHome(configDir) : process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));

function resolveCwd(cwd) {
  if (!cwd) return os.homedir();
  const p = cwd.replace(/^~(?=$|\/)/, os.homedir());
  try {
    if (fs.statSync(p).isDirectory()) return p;
  } catch {}
  return os.homedir();
}

/* ---------- Skills Claude Code ---------- */

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = {};
  if (!m) return fm;
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    // Valeurs multi-lignes YAML (description: > / |)
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(' ');
    }
    fm[kv[1]] = value.replace(/^["']|["']$/g, '');
  }
  return fm;
}

const listDirs = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name);
  } catch {
    return [];
  }
};

function readSkill(file, { name, prefix = '', source, project = null }) {
  try {
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const invoke = prefix + (fm.name || name);
    return {
      key: `${source}:${invoke}:${project || ''}`,
      invoke, name: fm.name || name, description: fm.description || '',
      argumentHint: fm['argument-hint'] || '', source, project, path: file,
    };
  } catch {
    return null;
  }
}

function scanSkillsDir(dir, opts) {
  return listDirs(dir)
    .filter((n) => n !== 'synced' && fs.existsSync(path.join(dir, n, 'SKILL.md')))
    .map((n) => readSkill(path.join(dir, n, 'SKILL.md'), { ...opts, name: n }));
}

function scanCommandsDir(dir, opts) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
      .map((f) => readSkill(path.join(dir, f), { ...opts, name: f.slice(0, -3) }));
  } catch {
    return [];
  }
}

function scanSkills(projectDirs, configDir) {
  const claude = claudeHome(configDir);
  const out = [
    ...scanSkillsDir(path.join(claude, 'skills'), { source: 'perso' }),
    ...scanCommandsDir(path.join(claude, 'commands'), { source: 'perso' }),
  ];
  // Skills synchronisés depuis claude.ai : invoqués avec le préfixe anthropic-skills:
  for (const acc of listDirs(path.join(claude, 'skills', 'synced'))) {
    out.push(...scanSkillsDir(path.join(claude, 'skills', 'synced', acc), { source: 'claude.ai', prefix: 'anthropic-skills:' }));
  }
  // Plugins synchronisés : invoqués avec le préfixe <plugin>:
  for (const acc of listDirs(path.join(claude, 'plugins', 'synced'))) {
    for (const plugin of listDirs(path.join(claude, 'plugins', 'synced', acc))) {
      out.push(...scanSkillsDir(path.join(claude, 'plugins', 'synced', acc, plugin, 'skills'), { source: 'plugin', prefix: `${plugin}:` }));
    }
  }
  for (const dir of projectDirs) {
    const cwd = resolveCwd(dir);
    out.push(...scanSkillsDir(path.join(cwd, '.claude', 'skills'), { source: 'projet', project: dir }));
    out.push(...scanCommandsDir(path.join(cwd, '.claude', 'commands'), { source: 'projet', project: dir }));
  }
  const seen = new Set();
  return out.filter((s) => s && !seen.has(s.key) && seen.add(s.key));
}

/* ---------- Git : diff et surveillance ---------- */

function git(cwd, args, okCodes = [0]) {
  return new Promise((resolve) => {
    execFile('git', ['-c', 'core.quotepath=off', ...args], { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      const code = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      resolve(okCodes.includes(code) ? stdout : null);
    });
  });
}

const untrackedFiles = async (root) =>
  ((await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])) || '').split('\0').filter(Boolean);

// Point de départ d'un onglet : l'état de l'arbre de travail au moment de l'ouverture.
// `git stash create` fabrique un commit de cet état sans toucher au dépôt ni à la pile de stash.
async function gitBaseline(root) {
  const head = (await git(root, ['rev-parse', 'HEAD'])) || '';
  const stash = (await git(root, ['stash', 'create'])) || '';
  return { root, sha: stash.trim() || head.trim() || null, untracked: await untrackedFiles(root) };
}

// Dépôts à suivre pour un dossier : le dépôt qui le contient, sinon les dépôts
// trouvés dans ses sous-dossiers sur deux niveaux (ex. projet/front et projet/back).
async function findRepos(cwd) {
  const dir = resolveCwd(cwd);
  const top = await git(dir, ['rev-parse', '--show-toplevel']);
  if (top !== null) return [{ root: top.trim(), name: '' }];
  const repos = [];
  const walk = (d, depth) => {
    for (const n of listDirs(d)) {
      if (n === 'node_modules') continue;
      const sub = path.join(d, n);
      if (fs.existsSync(path.join(sub, '.git'))) repos.push({ root: sub, name: path.relative(dir, sub) });
      else if (depth < 2) walk(sub, depth + 1);
    }
  };
  walk(dir, 1);
  return repos;
}

async function gitDiff(root, base) {
  const ref = base?.sha || 'HEAD';
  let patch = (await git(root, ['diff', '--no-color', '--no-ext-diff', '-M', ref])) || '';
  const known = new Set(base?.untracked || []);
  for (const file of (await untrackedFiles(root)).filter((f) => !known.has(f)).slice(0, 100)) {
    try {
      if (fs.statSync(path.join(root, file)).size > 1024 * 1024) continue;
    } catch {
      continue;
    }
    // --no-index sort en code 1 quand il y a des différences
    patch += (await git(root, ['diff', '--no-color', '--no-index', '--', '/dev/null', file], [0, 1])) || '';
  }
  return patch;
}

const watchers = new Map(); // root -> { watcher, refs, timer }

function gitWatch(root) {
  const existing = watchers.get(root);
  if (existing) {
    existing.refs++;
    return;
  }
  const entry = { refs: 1, timer: null, watcher: null };
  try {
    entry.watcher = fs.watch(root, { recursive: true }, (_ev, file) => {
      const f = String(file || '');
      // On ignore node_modules et l'intérieur de .git, sauf index/HEAD (commit, checkout, add)
      if (/(^|\/)node_modules(\/|$)/.test(f) || /^\.clutch(\/|$)/.test(f)) return;
      if (/^\.git(\/|$)/.test(f) && !/^\.git\/(index|HEAD)$/.test(f)) return;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => win && !win.isDestroyed() && win.webContents.send('git:changed', root), 400);
    });
  } catch {}
  watchers.set(root, entry);
}

function gitUnwatch(root) {
  const entry = watchers.get(root);
  if (!entry || --entry.refs > 0) return;
  clearTimeout(entry.timer);
  entry.watcher?.close();
  watchers.delete(root);
}

ipcMain.handle('git:track', async (_e, cwd) => {
  const repos = await Promise.all((await findRepos(cwd)).map(async (r) => ({ ...r, ...(await gitBaseline(r.root)) })));
  repos.forEach((r) => gitWatch(r.root));
  return repos.length ? { repos } : null;
});
ipcMain.on('git:untrack', (_e, root) => gitUnwatch(root));
// Branche courante ; en HEAD détaché, le commit abrégé
async function gitBranch(root) {
  const name = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim();
  if (name && name !== 'HEAD') return name;
  return (await git(root, ['rev-parse', '--short', 'HEAD']))?.trim() || '';
}

ipcMain.handle('git:diff', (_e, repos, sinceBaseline) =>
  Promise.all(repos.map(async (r) => ({ name: r.name, branch: await gitBranch(r.root), patch: await gitDiff(r.root, sinceBaseline ? r : null) }))));

/* ---------- Sessions Claude en mode conversation (stream-json) ---------- */

const chats = new Map();
let loginPath = null;

// PATH du shell de login (claude est souvent dans /opt/homebrew/bin, absent quand l'app part du Finder)
function getLoginPath() {
  if (loginPath) return Promise.resolve(loginPath);
  return new Promise((resolve) => {
    execFile(process.env.SHELL || '/bin/zsh', ['-lic', 'printf "__PATH__%s__END__" "$PATH"'], { timeout: 15000 }, (_err, stdout) => {
      const m = String(stdout || '').match(/__PATH__(.*)__END__/);
      loginPath = m ? m[1] : process.env.PATH;
      resolve(loginPath);
    });
  });
}

// Utilisation du forfait : la commande /usage de Claude Code, sans appel au modèle (gratuite)
function claudeUsage(configDir) {
  return getLoginPath().then((PATH) => new Promise((resolve) => {
    execFile('claude', ['-p', '/usage', '--output-format', 'json', '--no-session-persistence'], {
      cwd: os.tmpdir(), timeout: 30000, env: { ...process.env, PATH, ...claudeEnv(configDir) },
    }, (err, stdout) => {
      let text = '';
      try { text = JSON.parse(stdout).result || ''; } catch { return resolve({ error: err ? err.message : 'Réponse illisible' }); }
      const items = [];
      for (const m of text.matchAll(/^Current (session|week)(?: \(([^)]+)\))?: (\d+)% used(?: · resets (.+))?$/gm)) {
        items.push({ kind: m[1], scope: m[2] || '', pct: +m[3], resets: (m[4] || '').replace(/\s*\([^)]*\)\s*$/, '') });
      }
      resolve({ subscription: /subscription/i.test(text), items, text: text.split('\n\n')[0] });
    });
  }));
}

// Petit découpage façon shell pour les options du preset (ex. « claude --model opus »)
const splitArgs = (str) => (str.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((a) => a.replace(/^(["'])(.*)\1$/, '$2'));

async function startChat({ cwd, mode, resume, extraArgs, configDir }) {
  const PATH = await getLoginPath();
  const args = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json',
    '--verbose', '--include-partial-messages', '--permission-mode', mode || 'acceptEdits',
    // Les demandes d'autorisation arrivent sur stdout (control_request) et l'app y répond
    '--permission-prompt-tool', 'stdio',
    ...(resume ? ['--resume', resume] : []),
    ...splitArgs(extraArgs || ''),
  ];
  const env = { ...process.env, PATH, ...claudeEnv(configDir) };
  delete env.ELECTRON_RUN_AS_NODE;
  const id = nextId++;
  const child = spawn('claude', args, { cwd: resolveCwd(cwd), env, stdio: ['pipe', 'pipe', 'pipe'] });
  const send = (ch, ...a) => win && !win.isDestroyed() && win.webContents.send(ch, id, ...a);
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('{')) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      // On ne transmet pas les morceaux inutiles à l'affichage
      const d = ev.type === 'stream_event' && ev.event?.delta?.type;
      if (d === 'input_json_delta' || d === 'signature_delta' || d === 'thinking_delta') continue;
      send('chat:event', ev);
    }
  });
  child.stderr.on('data', (chunk) => send('chat:stderr', String(chunk)));
  child.on('error', (err) => send('chat:stderr', `Impossible de lancer claude : ${err.message}`));
  child.on('exit', (code) => { chats.delete(id); send('chat:exit', code); });
  chats.set(id, child);
  return id;
}

/* Historique des sessions Claude Code d'un dossier (~/.claude/projects/<dossier encodé>/<id>.jsonl) */

const sessionsDir = (cwd, configDir) => path.join(claudeHome(configDir), 'projects', resolveCwd(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

function readChunk(file, start, length) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const n = fs.readSync(fd, buf, 0, length, start);
    return buf.slice(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

const jsonLines = (text) => text.split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Texte tapé par l'utilisateur, hors messages techniques (<command-name>, rappels système…)
function promptText(entry) {
  if (entry?.type !== 'user' || entry.isMeta || entry.isSidechain) return '';
  const c = entry.message?.content;
  const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x) => x.type === 'text').map((x) => x.text).join('\n') : '';
  return text.startsWith('<') ? '' : text.trim();
}

function listSessions(cwd, configDir) {
  const dir = sessionsDir(cwd, configDir);
  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => {
      const file = path.join(dir, f);
      const st = fs.statSync(file);
      return { id: f.slice(0, -6), file, mtime: st.mtimeMs, size: st.size };
    });
  } catch {
    return [];
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, 60).map((f) => {
    // Les fichiers font plusieurs Mo : titre et dernier prompt sont lus à la fin, le premier message au début
    const tail = jsonLines(readChunk(f.file, Math.max(0, f.size - 256 * 1024), 256 * 1024));
    const head = f.size > 256 * 1024 ? jsonLines(readChunk(f.file, 0, 128 * 1024)) : tail;
    const last = (type) => tail.filter((e) => e.type === type).pop();
    const first = head.map(promptText).find(Boolean) || '';
    const lastPrompt = last('last-prompt')?.lastPrompt || '';
    return {
      id: f.id, mtime: f.mtime,
      title: last('ai-title')?.aiTitle || first.split('\n')[0].slice(0, 120) || '(sans titre)',
      lastPrompt: lastPrompt.split('\n')[0].slice(0, 160),
    };
  }).filter((s) => s.title !== '(sans titre)' || s.lastPrompt);
}

// Derniers échanges d'une session, pour réafficher la conversation avant de la reprendre
function sessionHistory(cwd, id, configDir) {
  try {
    const entries = jsonLines(fs.readFileSync(path.join(sessionsDir(cwd, configDir), `${id}.jsonl`), 'utf8'))
      .filter((e) => (e.type === 'user' || e.type === 'assistant') && !e.isSidechain && !e.isMeta)
      .map((e) => ({ type: e.type, message: e.message }));
    return entries.slice(-400);
  } catch {
    return [];
  }
}

ipcMain.handle('chat:sessions', (_e, cwd, configDir) => listSessions(cwd, configDir));
ipcMain.handle('chat:history', (_e, cwd, id, configDir) => sessionHistory(cwd, id, configDir));
// Un compte est « connecté » si son dossier contient des identifiants ou un état de session
ipcMain.handle('account:status', (_e, configDir) => {
  const home = claudeHome(configDir);
  return { exists: fs.existsSync(home), path: home };
});
ipcMain.handle('chat:start', (_e, opts) => startChat(opts));
ipcMain.on('chat:send', (_e, id, text) => {
  chats.get(id)?.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n');
});
ipcMain.on('chat:respond', (_e, id, requestId, response) => {
  const payload = response.error
    ? { subtype: 'error', request_id: requestId, error: response.error }
    : { subtype: 'success', request_id: requestId, response };
  chats.get(id)?.stdin.write(JSON.stringify({ type: 'control_response', response: payload }) + '\n');
});
ipcMain.on('chat:interrupt', (_e, id) => {
  chats.get(id)?.stdin.write(JSON.stringify({ type: 'control_request', request_id: `int-${Date.now()}`, request: { subtype: 'interrupt' } }) + '\n');
});
ipcMain.on('chat:kill', (_e, id) => { chats.get(id)?.kill(); chats.delete(id); });

function createPty({ cwd, cols, rows, command, configDir }) {
  const shellPath = process.env.SHELL || '/bin/zsh';
  // Shell de login interactif : récupère le PATH complet (claude, nvm, brew...)
  // même quand l'app est lancée depuis le Finder. Après la commande du preset,
  // on retombe dans un shell normal dans le même dossier.
  const args = command && command.trim()
    ? ['-l', '-i', '-c', `${command}; exec ${shellPath} -l -i`]
    : ['-l', '-i'];

  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Clutch', ...claudeEnv(configDir) };
  delete env.ELECTRON_RUN_AS_NODE;

  const id = nextId++;
  const p = pty.spawn(shellPath, args, {
    name: 'xterm-256color',
    cols: cols || 80,
    rows: rows || 24,
    cwd: resolveCwd(cwd),
    env,
  });
  p.onData((data) => win && !win.isDestroyed() && win.webContents.send('pty:data', id, data));
  p.onExit(({ exitCode }) => {
    ptys.delete(id);
    if (win && !win.isDestroyed()) win.webContents.send('pty:exit', id, exitCode);
  });
  ptys.set(id, p);
  return id;
}

ipcMain.handle('data:load', () => loadData());
ipcMain.handle('data:save', (_e, data) => {
  saveData(data);
  syncConfigChanged(data.presets, data.kanban?.columns);
});
ipcMain.handle('dialog:folder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});
// Fond personnalisé : l'image est copiée dans userData pour ne pas dépendre du fichier d'origine
ipcMain.handle('bg:pick', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
  if (res.canceled) return null;
  const src = res.filePaths[0];
  const dir = path.join(app.getPath('userData'), 'backgrounds');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `fond-${Date.now()}${path.extname(src).toLowerCase()}`);
  fs.copyFileSync(src, dest);
  return { path: dest, name: path.basename(src) };
});
ipcMain.handle('bg:read', (_e, file) => {
  try {
    const ext = path.extname(file).slice(1).replace('jpg', 'jpeg');
    return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
  } catch {
    return null;
  }
});
// Kanban : un fichier .clutch/kanban.json par projet, lisible et modifiable par Claude (skill) comme par l'app
const kanbanFile = (dir) => path.join(expandHome(dir), '.clutch', 'kanban.json');
function readKanban(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(kanbanFile(dir), 'utf8'));
    return { tasks: Array.isArray(data.tasks) ? data.tasks : [] };
  } catch (e) {
    // Fichier absent : tableau vide ; fichier cassé : on le signale sans l'écraser
    return e.code === 'ENOENT' ? { tasks: [] } : { tasks: [], error: e.message, line: jsonErrorLine(kanbanFile(dir), e) };
  }
}
// Ligne d'une erreur d'analyse JSON (« … at position 214 » ou « … (line 12 column 3) »), si on la retrouve
function jsonErrorLine(file, e) {
  const line = String(e.message).match(/line (\d+)/);
  if (line) return +line[1];
  const pos = String(e.message).match(/position (\d+)/);
  if (!pos) return null;
  try { return fs.readFileSync(file, 'utf8').slice(0, +pos[1]).split('\n').length; } catch { return null; }
}
function writeKanban(dir, tasks) {
  const file = kanbanFile(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, tasks }, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
ipcMain.handle('kanban:read', (_e, dir) => {
  const res = readKanban(dir);
  if (!res.error) kanbanSnapshot(dir, res.tasks);
  return res;
});
ipcMain.handle('kanban:write', (_e, dir, tasks) => {
  // timing et les ids ClickUp récupérés à la volée sont tenus par main : une sauvegarde de
  // l'interface faite avant d'avoir relu le fichier ne doit pas les effacer
  const current = new Map(readKanban(dir).tasks.map((t) => [String(t.id), t]));
  for (const t of tasks) {
    const cur = current.get(String(t.id));
    if (!cur) continue;
    if (cur.timing) t.timing = cur.timing;
    if (t.clickup && cur.clickup?.id === t.clickup.id) {
      for (const k of ['teamId', 'listId']) if (cur.clickup[k] && !t.clickup[k]) t.clickup[k] = cur.clickup[k];
    }
  }
  writeKanban(dir, tasks);
  kanbanSnapshot(dir, tasks);
  return true;
});

// Surveillance par sondage : fonctionne même si le fichier n'existe pas encore ou est remplacé d'un bloc.
// Un fichier est surveillé pour l'interface (projets du tableau) et/ou pour la synchro ClickUp (presets activés).
const kanbanWatches = new Map(); // fichier -> { dir, uiDir, sync }
function setKanbanWatch(dir, role, on) {
  const file = kanbanFile(dir);
  let w = kanbanWatches.get(file);
  if (on && !w) {
    w = { dir, uiDir: null, sync: false };
    kanbanWatches.set(file, w);
    fs.watchFile(file, { interval: 700 }, () => kanbanFileChanged(file));
  }
  if (!w) return;
  if (role === 'ui') w.uiDir = on ? dir : null;
  else w.sync = on;
  if (!w.uiDir && !w.sync) {
    fs.unwatchFile(file);
    kanbanWatches.delete(file);
  }
}
function kanbanFileChanged(file) {
  const w = kanbanWatches.get(file);
  if (!w) return;
  const res = readKanban(w.dir);
  if (!res.error) kanbanSnapshot(w.dir, res.tasks);
  if (w.uiDir && win && !win.isDestroyed()) win.webContents.send('kanban:changed', w.uiDir);
}
// Le tableau réunit tous les projets : l'interface donne la liste des dossiers à surveiller
let kanbanUiDirs = [];
ipcMain.on('kanban:watch', (_e, dirs) => {
  dirs = Array.isArray(dirs) ? dirs : [];
  for (const dir of kanbanUiDirs) if (!dirs.includes(dir)) setKanbanWatch(dir, 'ui', false);
  for (const dir of dirs) setKanbanWatch(dir, 'ui', true);
  kanbanUiDirs = dirs;
});
/* ---------- ClickUp ---------- */
// La clé API est chiffrée avec le trousseau macOS (safeStorage) et ne repasse jamais par l'interface.
const secretsFile = () => path.join(app.getPath('userData'), 'secrets.json');
function readSecrets() {
  try { return JSON.parse(fs.readFileSync(secretsFile(), 'utf8')); } catch { return {}; }
}
function writeSecrets(data) {
  fs.writeFileSync(secretsFile(), JSON.stringify(data), { mode: 0o600 });
}
function clickupToken() {
  const enc = readSecrets().clickup;
  if (!enc) return '';
  try { return safeStorage.decryptString(Buffer.from(enc, 'base64')); } catch { return ''; }
}
let clickupTeams = null;

async function clickupGet(token, route) {
  const res = await fetch(`https://api.clickup.com/api/v2/${route}`, { headers: { Authorization: token } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.err || `ClickUp a répondu ${res.status}`), { status: res.status, http: true });
  return body;
}

// Message affiché pour une erreur ClickUp : ce qui se passe et quoi faire, plutôt que le texte brut.
// Les erreurs levées par Clutch (statut introuvable dans la liste, clé absente…) portent déjà leur message.
function clickupError(e) {
  if (e.message === 'fetch failed' || e.cause?.code) return 'ClickUp est injoignable : vérifie ta connexion';
  if (!e.http) return e.message;
  if (e.status === 401) return 'Clé ClickUp refusée : vérifie-la dans les paramètres';
  if (e.status === 403) return 'ClickUp refuse l\'accès à cet élément avec ta clé';
  if (e.status === 404) return 'Introuvable dans ClickUp (supprimé ou déplacé ?)';
  if (e.status === 429) return 'ClickUp limite les requêtes pour l\'instant : réessaie dans une minute';
  if (e.status >= 500) return `ClickUp ne répond pas pour l'instant (erreur ${e.status}) : réessaie dans un moment`;
  return `ClickUp a refusé la demande : ${e.message}`;
}

ipcMain.handle('clickup:status', async () => {
  const token = clickupToken();
  if (!token) return { configured: false };
  try {
    const { user } = await clickupGet(token, 'user');
    return { configured: true, user: user?.username || user?.email || '' };
  } catch (e) {
    return { configured: true, error: clickupError(e) };
  }
});
ipcMain.handle('clickup:set-token', async (_e, token) => {
  const secrets = readSecrets();
  clickupTeams = null;
  // Autre clé, autre compte : rien de ce qui a été lu avec l'ancienne ne vaut encore
  inboxCache = null;
  try { fs.unlinkSync(hierarchyFile()); } catch {}
  token = String(token || '').trim();
  if (!token) {
    delete secrets.clickup;
    writeSecrets(secrets);
    return { configured: false };
  }
  let user;
  try {
    ({ user } = await clickupGet(token, 'user'));
  } catch (e) {
    return { configured: false, error: e.status === 401 ? 'Clé refusée par ClickUp' : clickupError(e) };
  }
  if (!safeStorage.isEncryptionAvailable()) return { configured: false, error: 'Chiffrement indisponible sur ce Mac' };
  secrets.clickup = safeStorage.encryptString(token).toString('base64');
  writeSecrets(secrets);
  return { configured: true, user: user?.username || user?.email || '' };
});

// Accepte un id (86c0abc12, #86c0abc12), un id personnalisé (CICD-123) ou un lien app.clickup.com/t/…
function parseClickupRef(ref) {
  ref = String(ref || '').trim().replace(/^#/, '');
  const url = ref.match(/clickup\.com\/t\/(?:(\d+)\/)?([\w-]+)/);
  if (url) return { id: url[2], teamId: url[1], custom: !!url[1] };
  return { id: ref, custom: /^[A-Za-z][\w]*-\d+$/.test(ref) };
}

async function clickupTask(ref) {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  const { id, teamId, custom } = parseClickupRef(ref);
  if (!/^[\w-]+$/.test(id)) return { error: 'Numéro de ticket invalide' };
  const q = 'include_markdown_description=true&include_subtasks=true';
  try {
    let task;
    if (custom) {
      // Les ids personnalisés demandent l'espace de travail : on essaie ceux du compte
      clickupTeams ||= (await clickupGet(token, 'team')).teams.map((t) => t.id);
      for (const team of teamId ? [teamId] : clickupTeams) {
        try { task = await clickupGet(token, `task/${encodeURIComponent(id)}?custom_task_ids=true&team_id=${team}&${q}`); break; } catch (e) { if (e.status !== 401 && e.status !== 404 && e.status !== 400) throw e; }
      }
      if (!task) return { error: `Ticket ${id} introuvable` };
    } else {
      task = await clickupGet(token, `task/${encodeURIComponent(id)}?${q}`);
    }
    const day = (ms) => (ms ? new Date(+ms).toISOString().slice(0, 10) : undefined);
    return {
      task: {
        id: task.id,
        customId: task.custom_id || undefined,
        name: task.name,
        description: (task.markdown_description || task.text_content || '').trim(),
        url: task.url,
        status: task.status?.status,
        statusColor: task.status?.color,
        priority: task.priority?.priority,
        assignees: (task.assignees || []).map((a) => a.username || a.email).filter(Boolean),
        tags: (task.tags || []).map((t) => t.name),
        start: day(task.start_date),
        due: day(task.due_date),
        creator: task.creator?.username,
        created: day(task.date_created),
        list: task.list?.name,
        listId: task.list?.id,
        teamId: task.team_id,
        subtasks: (task.subtasks || []).map((t) => ({ name: t.name, status: t.status?.status })),
        checklists: (task.checklists || []).map((c) => ({ name: c.name, items: (c.items || []).map((i) => ({ name: i.name, done: !!i.resolved })) })),
      },
    };
  } catch (e) {
    return { error: e.status === 404 || e.status === 400 ? `Ticket ${id} introuvable` : clickupError(e) };
  }
}
ipcMain.handle('clickup:task', (_e, ref) => clickupTask(ref));

/* ---------- Synchro ClickUp depuis le kanban ---------- */
// Les changements de colonne du kanban (interface, skill Claude ou glisser-déposer) font avancer
// le ticket ClickUp lié vers le statut relié à la colonne, et proposent de logger le temps passé dans
// les colonnes chronométrées (envoyé seulement après validation dans l'interface). Jamais de recul,
// jamais de commentaire.

// Colonnes du tableau et rangement des statuts : mêmes règles que l'interface
const { kbColumns, kbStatus } = require('./renderer/kanban-cols.js');
const SYNC_DEFAULTS = { enabled: false, logTime: true };
const SYNC_MIN_MS = 60 * 1000;
const SYNC_BACKOFF = [30, 120, 600, 1800, 3600].map((s) => s * 1000);
// Noms de statuts ClickUp comparés sans casse, accents ni espaces en trop
const statusKey = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const sameStatus = (a, b) => statusKey(a) === statusKey(b);
const projectKey = (dir) => path.resolve(expandHome(dir));

let syncPresets = [];
let syncColumns = null; // colonnes communes à tous les projets (kanban.columns de data.json)
const syncTables = new Map(); // projet -> Map(id de tâche -> statut lu en dernier)
let syncQueue = [];
let syncLogged = []; // clés « taskId:startedAt » des entrées de temps déjà créées
let syncPending = []; // temps proposés, en attente de validation : { id, project, dir, taskId, clickupId, ref, title, teamId, start, duration, key }
let syncTimer = null;
const syncStarted = new Map(); // « projet:tâche » -> startedAt, au cas où un skill réécrit la carte sans timing
let syncRunning = false;

function syncConfig(dir) {
  const key = projectKey(dir);
  const p = syncPresets.find((x) => x.clickupSync?.enabled && x.cwd && projectKey(x.cwd) === key);
  return p ? { ...SYNC_DEFAULTS, ...p.clickupSync, cwd: p.cwd, columns: kbColumns(p, syncColumns) } : null;
}

// Les presets ou les colonnes ont changé : on surveille le kanban de chaque projet synchronisé, panneau ouvert ou non
function syncConfigChanged(presets, columns) {
  syncPresets = Array.isArray(presets) ? presets : [];
  syncColumns = columns;
  const wanted = new Set(syncPresets.filter((p) => p.clickupSync?.enabled && p.cwd).map((p) => kanbanFile(p.cwd)));
  for (const [file, w] of kanbanWatches) if (w.sync && !wanted.has(file)) setKanbanWatch(w.dir, 'sync', false);
  for (const p of syncPresets) {
    if (!p.clickupSync?.enabled || !p.cwd || kanbanWatches.get(kanbanFile(p.cwd))?.sync) continue;
    setKanbanWatch(p.cwd, 'sync', true);
    // Premier chargement : la table est initialisée sans rien déclencher
    const res = readKanban(p.cwd);
    if (!res.error) kanbanSnapshot(p.cwd, res.tasks);
  }
}

// Appelée après chaque lecture ou écriture du kanban : compare aux statuts connus et déclenche la synchro.
// La table est mise à jour avant tout appel réseau : une relecture de la même écriture (watchFile)
// ne voit plus de différence, une transition ne part donc qu'une fois.
// Les statuts sont gardés tels qu'écrits et rangés en colonnes au moment de comparer : modifier les
// colonnes du tableau ne crée pas de transition.
function kanbanSnapshot(dir, tasks) {
  const key = projectKey(dir);
  const prev = syncTables.get(key);
  syncTables.set(key, new Map(tasks.filter((t) => t?.id != null).map((t) => [String(t.id), t.status])));
  const cfg = prev && syncConfig(dir);
  if (!cfg) return;
  for (const t of tasks) {
    if (t?.id == null || !t.clickup?.id || !prev.has(String(t.id))) continue;
    const from = kbStatus(prev.get(String(t.id)), cfg.columns);
    const to = kbStatus(t.status, cfg.columns);
    if (from !== to) syncTransition(cfg, dir, t, from, to);
  }
}

// Modifie une carte directement dans le fichier (écriture atomique). Les statuts ne changent pas,
// la relecture qui suit ne crée donc pas de transition. fn renvoie false pour ne rien écrire.
function patchKanbanTask(dir, taskId, fn) {
  const res = readKanban(dir);
  if (res.error) return null;
  const t = res.tasks.find((x) => String(x.id) === String(taskId));
  if (!t || fn(t) === false) return t || null;
  writeKanban(dir, res.tasks);
  kanbanSnapshot(dir, res.tasks);
  return t;
}

function syncTransition(cfg, dir, task, from, to) {
  const base = { project: cfg.cwd, dir, taskId: String(task.id), clickupId: task.clickup.id, ref: task.clickup.customId || task.clickup.id };
  const cols = cfg.columns;
  // « done » sans colonne se place après la dernière : y passer ne déclenche rien, en revenir est un recul
  const at = (id) => { const x = cols.findIndex((c) => c.id === id); return x < 0 ? cols.length : x; };
  const [i, j] = [at(from), at(to)];
  const col = cols[j];
  if (!col) return;
  const now = Date.now();
  const key = `${projectKey(dir)}:${task.id}`;
  const startedAt = cols[i]?.timer ? task.timing?.startedAt || syncStarted.get(key) : null;
  if (col.timer) {
    // D'une colonne chronométrée à une autre, le chrono continue
    if (!startedAt) {
      const started = new Date(now).toISOString();
      syncStarted.set(key, started);
      patchKanbanTask(dir, task.id, (t) => { t.timing = { loggedMs: 0, ...t.timing, startedAt: started }; });
    }
  } else if (cols[i]?.timer && j > i) {
    syncStarted.delete(key);
    if (startedAt) {
      const start = Date.parse(startedAt);
      const duration = now - start;
      // Le segment est clos tout de suite ; loggedMs n'augmente qu'une fois l'entrée créée dans ClickUp
      patchKanbanTask(dir, task.id, (t) => { t.timing = { loggedMs: 0, ...t.timing, startedAt: null }; });
      if (cfg.logTime && duration >= SYNC_MIN_MS) {
        // Rien ne part tout seul : l'interface propose la durée, on la corrige puis on l'envoie (clickup:time-confirm)
        const pending = { ...base, id: Math.random().toString(36).slice(2, 10), title: task.title, teamId: task.clickup.teamId, start, duration, key: `${task.id}:${startedAt}` };
        syncPending.push(pending);
        persistSyncQueue();
        if (win && !win.isDestroyed()) win.webContents.send('clickup:time-pending', pending);
      }
    }
  }
  // La carte avance vers une colonne reliée : le ticket suit s'il est encore au statut d'une colonne précédente
  if (j > i && col.status) {
    const allowed = cols.slice(0, j).map((c) => c.status).filter((s) => s && !sameStatus(s, col.status));
    if (allowed.length) enqueueSync({ ...base, kind: 'status', allowed, target: col.status });
  }
}

function enqueueSync(action) {
  syncQueue.push({ ...action, id: Math.random().toString(36).slice(2, 10), tries: 0, next: 0 });
  persistSyncQueue();
  runSyncQueue();
}

function persistSyncQueue() {
  mainOwned.clickupQueue = syncQueue;
  syncLogged = syncLogged.slice(-500);
  mainOwned.clickupLogged = syncLogged;
  mainOwned.clickupPendingTime = syncPending;
  saveMainOwned();
}

// Journal des synchros (sans la clé), pour comprendre après coup ce qui est parti ou non
const syncLogFile = () => path.join(app.getPath('userData'), 'clickup-sync.log');
function syncNotify(a, ok, extra = {}) {
  const line = { at: new Date().toISOString(), project: a.project, task: a.taskId, ticket: a.ref, action: a.kind, ok, ...extra };
  try { fs.appendFileSync(syncLogFile(), JSON.stringify(line) + '\n'); } catch {}
  if (win && !win.isDestroyed()) win.webContents.send('clickup:sync', { project: a.project, taskId: a.taskId, ref: a.ref, action: a.kind, ok, ...extra });
}

// Équipe et liste de la carte : stockées à l'import, sinon récupérées une fois et sauvegardées
function rememberIds(a, task) {
  const ids = { teamId: task.team_id, listId: task.list?.id };
  patchKanbanTask(a.dir, a.taskId, (t) => {
    const missing = Object.keys(ids).filter((k) => ids[k] && t.clickup?.id === a.clickupId && !t.clickup[k]);
    missing.forEach((k) => { t.clickup[k] = ids[k]; });
    return missing.length > 0;
  });
  return ids;
}

// Statut ClickUp affiché sur la carte : tenu à jour après chaque synchro, sans avoir à recharger le ticket
function rememberStatus(a, status) {
  patchKanbanTask(a.dir, a.taskId, (t) => {
    if (!status || t.clickup?.id !== a.clickupId || t.clickup.status === status) return false;
    t.clickup.status = status;
  });
}

async function clickupSend(token, method, route, body) {
  const res = await fetch(`https://api.clickup.com/api/v2/${route}`, {
    method, headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.err || `ClickUp a répondu ${res.status}`), { status: res.status, http: true });
  return json;
}

// Statuts de chaque liste, gardés 10 min, pour retrouver le nom exact à partir du réglage
const listStatuses = new Map(); // listId -> { at, list, names }
async function exactStatus(token, listId, name) {
  if (!listId) return name;
  let c = listStatuses.get(listId);
  if (!c || Date.now() - c.at > 10 * 60 * 1000) {
    const list = await clickupGet(token, `list/${encodeURIComponent(listId)}`);
    c = { at: Date.now(), list: list.name, names: (list.statuses || []).map((x) => x.status) };
    listStatuses.set(listId, c);
  }
  if (!c.names.length) return name;
  const found = c.names.find((n) => sameStatus(n, name));
  if (!found) throw Object.assign(new Error(`statut « ${name} » introuvable dans la liste « ${c.list} » (${c.names.join(', ')})`), { status: 400 });
  return found;
}

async function runSyncAction(a, token) {
  const task = await clickupGet(token, `task/${encodeURIComponent(a.clickupId)}`);
  const ids = rememberIds(a, task);
  if (a.kind === 'status') {
    // Relu juste avant d'écrire : on n'avance que depuis un statut attendu, sinon on ne touche à rien
    const current = task.status?.status;
    if (sameStatus(current, a.target) || (!a.force && !a.allowed.some((s) => sameStatus(s, current)))) {
      rememberStatus(a, current);
      return { skipped: true, status: current, detail: `déjà « ${current} », inchangé` };
    }
    // ClickUp n'accepte que le nom exact du statut (« a faire » sans accent, par exemple)
    const target = await exactStatus(token, ids.listId || task.list?.id, a.target);
    await clickupSend(token, 'PUT', `task/${encodeURIComponent(a.clickupId)}`, { status: target });
    rememberStatus(a, target);
    return { detail: `→ ${target}`, status: target };
  }
  if (syncLogged.includes(a.key)) return { skipped: true, detail: 'temps déjà loggé' };
  const teamId = a.teamId || ids.teamId;
  if (!teamId) throw Object.assign(new Error('Espace de travail du ticket inconnu'), { status: 400 });
  await clickupSend(token, 'POST', `team/${encodeURIComponent(teamId)}/time_entries`, { tid: a.clickupId, start: a.start, duration: a.duration });
  syncLogged.push(a.key);
  patchKanbanTask(a.dir, a.taskId, (t) => { t.timing = { startedAt: null, ...t.timing, loggedMs: (t.timing?.loggedMs || 0) + a.duration }; });
  return { detail: `${Math.round(a.duration / 60000)} min loggées` };
}

// Réseau coupé, 429 ou erreur serveur : on retentera. Le reste (clé refusée, ticket supprimé…) est abandonné.
const retryable = (e) => !e.status || e.status === 429 || e.status >= 500;

async function runSyncQueue() {
  if (syncRunning) return;
  syncRunning = true;
  clearTimeout(syncTimer);
  try {
    for (;;) {
      const a = syncQueue.find((x) => x.next <= Date.now());
      if (!a) break;
      const token = clickupToken();
      let result = null;
      let error = null;
      try {
        if (!token) throw Object.assign(new Error('Ajoute ta clé ClickUp dans les paramètres'), { status: 401 });
        result = await runSyncAction(a, token);
      } catch (e) {
        error = e;
      }
      if (error && retryable(error)) {
        const wait = SYNC_BACKOFF[Math.min(a.tries, SYNC_BACKOFF.length - 1)];
        a.tries++;
        a.next = Date.now() + wait;
        syncNotify(a, false, { error: `${clickupError(error)} — nouvelle tentative dans ${Math.round(wait / 60000) || 1} min`, queued: true });
      } else {
        syncQueue = syncQueue.filter((x) => x !== a);
        if (error) syncNotify(a, false, { error: clickupError(error) });
        else syncNotify(a, true, result);
      }
      persistSyncQueue();
    }
  } finally {
    syncRunning = false;
  }
  const next = Math.min(...syncQueue.map((x) => x.next));
  if (Number.isFinite(next)) syncTimer = setTimeout(runSyncQueue, Math.max(1000, next - Date.now()));
}

// Carte et ticket qui ne disent plus la même chose (carte reculée, ticket changé dans ClickUp) : sur
// demande explicite, le ticket prend le statut relié à la colonne de la carte, y compris en arrière
ipcMain.handle('clickup:align', (_e, dir, taskId) => {
  const cfg = syncConfig(dir);
  const task = readKanban(dir).tasks.find((t) => String(t.id) === String(taskId));
  const col = cfg && task?.clickup?.id && cfg.columns.find((c) => c.id === kbStatus(task.status, cfg.columns));
  if (!col?.status) return false;
  enqueueSync({ project: cfg.cwd, dir, taskId: String(task.id), clickupId: task.clickup.id, ref: task.clickup.customId || task.clickup.id, kind: 'status', force: true, allowed: [], target: col.status });
  return true;
});

// Temps en attente de validation : relus par l'interface au démarrage, ils survivent à une relance
ipcMain.handle('clickup:time-pending', () => syncPending);
// duration : durée validée en ms, 0 pour ne rien logger
ipcMain.handle('clickup:time-confirm', (_e, id, duration) => {
  const p = syncPending.find((x) => x.id === id);
  if (!p) return false;
  syncPending = syncPending.filter((x) => x !== p);
  persistSyncQueue();
  // La fin du segment ne bouge pas : c'est le début qui suit la durée corrigée
  if (duration > 0) enqueueSync({ ...p, kind: 'time', start: p.start + p.duration - duration, duration });
  else syncNotify({ ...p, kind: 'time' }, true, { skipped: true, detail: 'temps non loggé' });
  return true;
});

// Bouton « Vérifier » du preset : statuts de la liste d'une carte liée, et noms introuvables
ipcMain.handle('clickup:check-statuses', async (_e, dir, names) => {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  const card = readKanban(dir).tasks.find((t) => t.clickup?.id);
  if (!card) return { error: 'Aucune carte liée à ClickUp dans le kanban de ce projet' };
  try {
    let listId = card.clickup.listId;
    if (!listId) listId = rememberIds({ dir, taskId: card.id, clickupId: card.clickup.id }, await clickupGet(token, `task/${encodeURIComponent(card.clickup.id)}`)).listId;
    const list = await clickupGet(token, `list/${encodeURIComponent(listId)}`);
    const statuses = (list.statuses || []).map((x) => x.status);
    return { list: list.name, statuses, missing: names.filter((n) => !statuses.some((x) => sameStatus(x, n))) };
  } catch (e) {
    return { error: clickupError(e) };
  }
});

/* ---------- Inbox ClickUp ---------- */
// ClickUp n'expose pas son Inbox dans l'API : on la reconstitue à partir des espaces, dossiers et
// listes choisis dans les paramètres. Tickets ouverts dans un statut d'entrée (nouveau, à faire…),
// sans personne d'assigné ou assignés à moi.
let clickupMe = null; // { token, id } : l'utilisateur de la clé
async function clickupUserId(token) {
  if (clickupMe?.token !== token) clickupMe = { token, id: (await clickupGet(token, 'user')).user.id };
  return clickupMe.id;
}

// Arborescence à cocher dans les paramètres : espaces › dossiers › listes, par espace de travail.
// Elle change rarement et demande plusieurs requêtes par espace : la dernière lue est gardée dans un
// fichier, que l'interface affiche tout de suite (cached) avant de la relire.
const hierarchyFile = () => path.join(app.getPath('userData'), 'clickup-hierarchy.json');
ipcMain.handle('clickup:hierarchy', async (_e, cached) => {
  if (cached) {
    try { return JSON.parse(fs.readFileSync(hierarchyFile(), 'utf8')); } catch { return null; }
  }
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  try {
    const { teams } = await clickupGet(token, 'team');
    const lists = (ls) => (ls || []).map((l) => ({ id: l.id, name: l.name }));
    const res = {
      teams: await Promise.all(teams.map(async (team) => {
        const { spaces } = await clickupGet(token, `team/${team.id}/space?archived=false`);
        return {
          id: team.id, name: team.name,
          spaces: await Promise.all(spaces.map(async (s) => {
            const [{ folders }, { lists: loose }] = await Promise.all([
              clickupGet(token, `space/${s.id}/folder?archived=false`),
              clickupGet(token, `space/${s.id}/list?archived=false`),
            ]);
            return { id: s.id, name: s.name, folders: folders.map((f) => ({ id: f.id, name: f.name, lists: lists(f.lists) })), lists: lists(loose) };
          })),
        };
      })),
    };
    try { fs.writeFileSync(hierarchyFile(), JSON.stringify(res)); } catch {}
    return res;
  } catch (e) {
    return { error: clickupError(e) };
  }
});

const INBOX_MAX_PAGES = 10;
const INBOX_CACHE_MS = 5 * 60 * 1000;
const INBOX_PARAM = { space: 'space_ids[]', folder: 'project_ids[]', list: 'list_ids[]' };

// sources : [{ kind: 'space' | 'folder' | 'list', id, teamId }] ; statuses : à trier (personne ou moi),
// mineStatuses : gardés seulement s'ils me sont assignés (dev en cours…). Noms comparés sans accents.
// Les tickets ouverts des sources sont gardés 5 min, tous statuts confondus : changer les statuts à trier
// refiltre sans réinterroger ClickUp (fresh force la relecture). La réponse donne aussi les statuts
// rencontrés, avec le nombre de tickets que chacun ferait apparaître, pour les proposer dans les réglages.
let inboxCache = null; // { key, at, tasks, truncated }
ipcMain.handle('clickup:inbox', async (_e, sources, statuses, mineStatuses = [], fresh = false) => {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  try {
    const key = JSON.stringify(sources.map((s) => [s.kind, s.id, s.teamId]));
    if (fresh || inboxCache?.key !== key || Date.now() - inboxCache.at > INBOX_CACHE_MS) {
      const me = await clickupUserId(token);
      const found = new Map();
      let truncated = false;
      // Une requête par source : les filtres d'espace, de dossier et de liste se cumulent (ET) chez ClickUp
      await Promise.all(sources.filter((s) => INBOX_PARAM[s.kind] && s.teamId).map(async (s) => {
        for (let page = 0; page < INBOX_MAX_PAGES; page++) {
          const q = new URLSearchParams({ page, subtasks: 'true', include_closed: 'false', order_by: 'updated' });
          q.append(INBOX_PARAM[s.kind], s.id);
          const res = await clickupGet(token, `team/${encodeURIComponent(s.teamId)}/task?${q}`);
          for (const t of res.tasks || []) {
            found.set(t.id, {
              id: t.id,
              customId: t.custom_id || undefined,
              name: t.name,
              url: t.url,
              status: t.status?.status,
              statusColor: t.status?.color,
              priority: t.priority?.priority,
              mine: (t.assignees || []).some((a) => a.id === me),
              free: !t.assignees?.length,
              list: t.list?.name,
              listId: t.list?.id,
              folder: t.folder?.hidden ? undefined : t.folder?.name,
              space: t.space?.id,
              created: +t.date_created || 0,
              updated: +t.date_updated || 0,
              creator: t.creator?.username,
            });
          }
          if (res.last_page !== false || (res.tasks || []).length < 100) return;
        }
        truncated = true;
      }));
      inboxCache = { key, at: Date.now(), tasks: [...found.values()].sort((a, b) => b.updated - a.updated), truncated };
    }
    const { tasks, truncated, at } = inboxCache;
    // Les statuts ne sont pas filtrés côté ClickUp : leur nom exact varie d'une liste à l'autre
    const is = (names, t) => names.some((x) => sameStatus(x, t.status));
    const seen = new Map();
    for (const t of tasks) {
      if (!t.status) continue;
      const st = seen.get(statusKey(t.status)) || { name: t.status, color: t.statusColor, open: 0, mine: 0 };
      if (t.mine || t.free) st.open++;
      if (t.mine) st.mine++;
      seen.set(statusKey(t.status), st);
    }
    return {
      items: tasks.filter((t) => (is(statuses, t) && (t.mine || t.free)) || (t.mine && is(mineStatuses, t))).map(({ free, ...t }) => t),
      statuses: [...seen.values()], truncated, at,
    };
  } catch (e) {
    return { error: clickupError(e) };
  }
});

ipcMain.handle('clickup:assign-me', async (_e, taskId) => {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  try {
    const me = await clickupUserId(token);
    await clickupSend(token, 'PUT', `task/${encodeURIComponent(taskId)}`, { assignees: { add: [me], rem: [] } });
    return { ok: true };
  } catch (e) {
    return { error: clickupError(e) };
  }
});

// Passe le ticket au statut target s'il est dans l'un des statuts allowed (ceux à trier) : un ticket
// déjà plus loin (dev en cours…) n'est pas ramené en arrière
ipcMain.handle('clickup:advance', async (_e, taskId, allowed, target) => {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  try {
    const task = await clickupGet(token, `task/${encodeURIComponent(taskId)}`);
    const current = task.status?.status;
    if (sameStatus(current, target) || !allowed.some((s) => sameStatus(s, current))) return { ok: true, skipped: true, status: current };
    const status = await exactStatus(token, task.list?.id, target);
    await clickupSend(token, 'PUT', `task/${encodeURIComponent(taskId)}`, { status });
    return { ok: true, status };
  } catch (e) {
    return { error: clickupError(e) };
  }
});

/* ---------- Temps par jour ---------- */
// Entrées de temps de l'utilisateur de la clé entre deux dates (ms), tous espaces de travail confondus
ipcMain.handle('clickup:times', async (_e, start, end) => {
  const token = clickupToken();
  if (!token) return { error: 'Ajoute ta clé ClickUp dans les paramètres' };
  try {
    clickupTeams ||= (await clickupGet(token, 'team')).teams.map((t) => t.id);
    const q = new URLSearchParams({ start_date: Math.round(start), end_date: Math.round(end) });
    const lists = await Promise.all(clickupTeams.map((team) => clickupGet(token, `team/${encodeURIComponent(team)}/time_entries?${q}`)));
    const entries = lists.flatMap((r) => r.data || []).map((e) => {
      const task = e.task && typeof e.task === 'object' ? e.task : null;
      return {
        id: e.id,
        start: +e.start,
        // Un chrono ClickUp en cours a une durée négative : l'interface compte jusqu'à maintenant
        duration: Math.max(0, +e.duration || 0),
        running: +e.duration < 0,
        taskId: task?.id,
        ref: task?.custom_id || task?.id,
        name: task?.name || e.description || '',
        url: e.task_url,
      };
    });
    return { entries: entries.sort((a, b) => a.start - b.start), ...localTimes() };
  } catch (e) {
    return { error: clickupError(e), ...localTimes() };
  }
});

// Temps pas encore dans ClickUp : propositions en attente de validation, et chrono des cartes qui
// sont dans une colonne chronométrée d'un projet synchronisé
function localTimes() {
  const running = [];
  const seen = new Set();
  for (const p of syncPresets) {
    if (!p.clickupSync?.enabled || !p.cwd || seen.has(projectKey(p.cwd))) continue;
    seen.add(projectKey(p.cwd));
    const cols = kbColumns(p, syncColumns);
    for (const t of readKanban(p.cwd).tasks) {
      if (!t?.clickup?.id || !t.timing?.startedAt || !cols.find((c) => c.id === kbStatus(t.status, cols))?.timer) continue;
      running.push({ project: p.name, taskId: String(t.id), clickupId: t.clickup.id, ref: t.clickup.customId || t.clickup.id, name: t.title, start: Date.parse(t.timing.startedAt) });
    }
  }
  return { running, pending: syncPending.map((p) => ({ id: p.id, clickupId: p.clickupId, ref: p.ref, name: p.title, start: p.start, duration: p.duration })) };
}

// Démarrage : config des presets, surveillance, et reprise de la file laissée par la session précédente
function startClickupSync() {
  const data = loadData();
  syncQueue = Array.isArray(data.clickupQueue) ? data.clickupQueue.map((a) => ({ ...a, next: 0 })) : [];
  syncLogged = Array.isArray(data.clickupLogged) ? data.clickupLogged : [];
  syncPending = Array.isArray(data.clickupPendingTime) ? data.clickupPendingTime : [];
  mainOwned.clickupQueue = syncQueue;
  mainOwned.clickupLogged = syncLogged;
  mainOwned.clickupPendingTime = syncPending;
  syncConfigChanged(data.presets, data.kanban?.columns);
  if (syncQueue.length) setTimeout(runSyncQueue, 3000);
}
// Mises à jour : l'app installée connaît son dossier de sources et le commit dont elle est issue (source.json).
// Une mise à jour est disponible si le dépôt distant a de nouveaux commits, ou si les sources locales ont avancé.
function buildInfo() {
  if (!app.isPackaged) return { source: __dirname, commit: null };
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'source.json'), 'utf8')); } catch { return {}; }
}
const devCommit = !app.isPackaged ? git(__dirname, ['rev-parse', 'HEAD']).then((c) => c?.trim()) : null;
let lastFetch = 0;

async function updateStatus() {
  const { source: dir, commit } = buildInfo();
  if (!dir || !fs.existsSync(path.join(dir, 'build', 'make-app.sh'))) return { available: false };
  const built = commit || (await devCommit);
  if (Date.now() - lastFetch > 2 * 60000) {
    lastFetch = Date.now();
    await new Promise((r) => execFile('git', ['fetch', '--quiet'], { cwd: dir, timeout: 20000 }, () => r()));
  }
  const log = async (range) => ((await git(dir, ['log', '--format=%s', range])) || '').split('\n').filter(Boolean);
  const remote = (await git(dir, ['rev-parse', '--abbrev-ref', '@{u}'])) ? await log('HEAD..@{u}') : [];
  const local = built ? await log(`${built}..HEAD`) : [];
  return { available: remote.length + local.length > 0, remote, local };
}

ipcMain.handle('app:update-status', () => updateStatus());
ipcMain.handle('app:rebuild', async (_e, openCount) => {
  const dir = buildInfo().source;
  const st = await updateStatus();
  const changes = [...st.remote || [], ...st.local || []];
  const { response } = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Mettre à jour et relancer', 'Annuler'], defaultId: 0, cancelId: 1,
    message: 'Mettre à jour Clutch ?',
    detail: (changes.length ? `Nouveautés :\n${changes.slice(0, 12).map((c) => `• ${c}`).join('\n')}${changes.length > 12 ? `\n… et ${changes.length - 12} autres` : ''}\n\n` : '')
      + `Clutch est ${st.remote?.length ? 'mis à jour depuis le dépôt, puis ' : ''}reconstruit depuis ${dir.replace(os.homedir(), '~')} et relancé.`
      + (openCount ? ` ${openCount > 1 ? `Les ${openCount} terminaux ouverts seront fermés` : 'Le terminal ouvert sera fermé'} au moment de la relance ; les conversations Claude restent reprenables.` : ''),
  });
  if (response !== 0) return { cancelled: true };
  const PATH = await getLoginPath();
  let log = '';
  const run = (cmd, args) => new Promise((resolve) => {
    log += `\n$ ${cmd} ${args.join(' ')}\n`;
    const child = spawn(cmd, args, { cwd: dir, env: { ...process.env, PATH } });
    const onData = (d) => { log += d; win?.webContents.send('app:rebuild-log', String(d)); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => { log += err.message; resolve(1); });
    child.on('close', resolve);
  });
  const fail = async (what) => {
    await dialog.showMessageBox(win, { type: 'error', message: what, detail: log.trim().split('\n').slice(-25).join('\n') });
    return { ok: false };
  };
  if (st.remote?.length) {
    const before = (await git(dir, ['rev-parse', 'HEAD']))?.trim();
    if (await run('git', ['pull', '--ff-only'])) return fail('La récupération de la mise à jour a échoué');
    // Dépendances modifiées : on les réinstalle avant de reconstruire
    const changed = (await git(dir, ['diff', '--name-only', before, 'HEAD'])) || '';
    if (/^package(-lock)?\.json$/m.test(changed) && await run('npm', ['install'])) return fail('L’installation des dépendances a échoué');
  }
  if (await run('npm', ['run', 'app'])) return fail('La reconstruction a échoué');
  spawn('/bin/sh', ['-c', 'sleep 1; open -n /Applications/Clutch.app'], { detached: true, stdio: 'ignore' }).unref();
  quitting = true;
  app.quit();
  return { ok: true };
});
// Sons d'alerte du Mac (/System/Library/Sounds), joués avec afplay
ipcMain.on('sound:system', (_e, name, volume) => {
  if (!/^[A-Za-z]+$/.test(name)) return;
  const file = `/System/Library/Sounds/${name}.aiff`;
  if (fs.existsSync(file)) execFile('afplay', ['-v', String(Math.max(0, Math.min(1, volume))), file], () => {});
});
ipcMain.handle('usage:get', (_e, configDir) => claudeUsage(configDir));
ipcMain.handle('fs:subdirs', (_e, dir) => {
  try {
    dir = expandHome(dir);
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({ name: d.name, path: path.join(dir, d.name) }));
  } catch {
    return [];
  }
});
ipcMain.handle('skills:scan', (_e, projectDirs, configDir) => scanSkills(projectDirs || [], configDir));
ipcMain.handle('pty:create', (_e, opts) => createPty(opts));
ipcMain.on('win:bg', (_e, color) => win?.setBackgroundColor(color));
ipcMain.on('pty:write', (_e, id, data) => ptys.get(id)?.write(data));
ipcMain.on('pty:resize', (_e, id, cols, rows) => {
  try { ptys.get(id)?.resize(cols, rows); } catch {}
});
ipcMain.on('pty:kill', (_e, id) => {
  try { ptys.get(id)?.kill(); } catch {}
  ptys.delete(id);
});

function buildMenu() {
  // Menu minimal : on garde copier/coller, mais Cmd+W / Cmd+T / Cmd+K sont gérés par l'app.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'Affichage',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
    },
    { label: 'Fenêtre', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
  ]));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#16161e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Comme Discord : la croix cache la fenêtre, les terminaux continuent ; ⌘Q quitte vraiment
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    if (win.isFullScreen()) {
      win.once('leave-full-screen', () => win.hide());
      win.setFullScreen(false);
    } else {
      win.hide();
    }
  });
  // Un lien cliqué dans la page s'ouvre dans le navigateur au lieu de remplacer l'app
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:')) return;
    e.preventDefault();
    shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  migrateOldData();
  startClickupSync();
  buildMenu();
  createWindow();
  app.on('activate', () => (win && !win.isDestroyed() ? win.show() : createWindow()));
});

let quitting = false;
app.on('before-quit', () => {
  quitting = true;
  for (const p of ptys.values()) { try { p.kill(); } catch {} }
  for (const c of chats.values()) { try { c.kill(); } catch {} }
});
app.on('window-all-closed', () => app.quit());
