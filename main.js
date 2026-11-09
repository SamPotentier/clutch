const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
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

function saveData(data) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2));
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
ipcMain.handle('git:diff', (_e, repos, sinceBaseline) =>
  Promise.all(repos.map(async (r) => ({ name: r.name, patch: await gitDiff(r.root, sinceBaseline ? r : null) }))));

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
ipcMain.handle('data:save', (_e, data) => saveData(data));
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
    return e.code === 'ENOENT' ? { tasks: [] } : { tasks: [], error: e.message };
  }
}
ipcMain.handle('kanban:read', (_e, dir) => readKanban(dir));
ipcMain.handle('kanban:write', (_e, dir, tasks) => {
  const file = kanbanFile(dir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, tasks }, null, 2) + '\n');
  fs.renameSync(tmp, file);
  return true;
});
// Surveillance par sondage : fonctionne même si le fichier n'existe pas encore ou est remplacé d'un bloc
let kanbanWatched = null;
ipcMain.on('kanban:watch', (_e, dir) => {
  if (kanbanWatched) fs.unwatchFile(kanbanWatched);
  kanbanWatched = dir ? kanbanFile(dir) : null;
  if (kanbanWatched) {
    fs.watchFile(kanbanWatched, { interval: 700 }, () => win && !win.isDestroyed() && win.webContents.send('kanban:changed', dir));
  }
});
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
