const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortPath = (p) => (p || '').replace(/^\/Users\/[^/]+/, '~');

const COLORS = ['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#c0caf5'];
const THEME = {
  background: '#16161e', foreground: '#c0caf5', cursor: '#c0caf5', selectionBackground: '#33467c',
  black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
  brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
};

const NERD_MONO = '"MesloLGS NF", "JetBrainsMono Nerd Font", "Hack Nerd Font", "SF Mono", Menlo, monospace';
const THEMES = {
  nuit: {
    label: 'Nuit', desc: 'Sombre et sobre, le thème d’origine', swatches: ['#16161e', '#24283b', '#7aa2f7', '#9ece6a'],
    scroll: '#7aa2f7',
    winBg: '#16161e', fontSize: 13, lineHeight: 1.15, cursor: 'block', placeholder: 'Prompt à envoyer au terminal… (⌘↵ pour envoyer)',
    xterm: THEME,
  },
  glass: {
    label: 'Glass', desc: 'Verre dépoli sur fond coloré', swatches: ['#7c5cff', '#00c2ff', '#ff54a0', 'rgba(255,255,255,.5)'],
    scroll: '#ffffff',
    winBg: '#0b0b1a', fontSize: 13, lineHeight: 1.2, cursor: 'bar', placeholder: 'Prompt à envoyer au terminal… (⌘↵ pour envoyer)',
    xterm: {
      ...THEME, background: 'rgba(0,0,0,0)', foreground: '#f4f4ff', cursor: '#ffffff', selectionBackground: 'rgba(255,255,255,.22)',
      blue: '#a5b4ff', brightBlue: '#c3cdff', magenta: '#ff9ad5', cyan: '#7fe3ff', green: '#7ef0b0', red: '#ff8fb1', yellow: '#ffd479', brightBlack: '#8a8fb8',
    },
  },
  papier: {
    label: 'Papier', desc: 'Clair et doux, loin de l’ambiance terminal', swatches: ['#f4f1ea', '#fffefb', '#c96442', '#2d2a24'],
    scroll: '#c96442',
    winBg: '#f4f1ea', fontSize: 14, lineHeight: 1.45, cursor: 'bar', placeholder: 'Écris ton message à Claude… (⌘↵ pour envoyer)',
    xterm: {
      background: '#fffefb', foreground: '#2d2a24', cursor: '#c96442', cursorAccent: '#fffefb', selectionBackground: '#f1d9cc',
      black: '#2d2a24', red: '#b4432f', green: '#3f7a2a', yellow: '#9a6a12', blue: '#2b6cb0', magenta: '#9b4f96', cyan: '#2a7f86', white: '#8a8374',
      brightBlack: '#8a8374', brightRed: '#c96442', brightGreen: '#4f8f36', brightYellow: '#b7791f', brightBlue: '#3b7dc4', brightMagenta: '#b05fab', brightCyan: '#35939b', brightWhite: '#5c574d',
    },
  },
  retro: {
    label: 'Rétro', desc: 'Arcade pixel, assorti au logo', swatches: ['#070707', '#e8795a', '#f5c542', '#b6e35a'],
    scroll: '#e8795a',
    winBg: '#070707', fontSize: 13, lineHeight: 1.2, cursor: 'block', placeholder: '> PROMPT… (⌘↵ POUR ENVOYER)',
    xterm: {
      background: '#070707', foreground: '#f3e6da', cursor: '#e8795a', cursorAccent: '#070707', selectionBackground: '#4a2a1f',
      black: '#070707', red: '#ff5c5c', green: '#b6e35a', yellow: '#f5c542', blue: '#e8795a', magenta: '#ff8fa3', cyan: '#5ad1e3', white: '#d8c8bb',
      brightBlack: '#6b5a4f', brightRed: '#ff7b7b', brightGreen: '#c9f075', brightYellow: '#ffd865', brightBlue: '#f39477', brightMagenta: '#ffa8b8', brightCyan: '#7fe0ee', brightWhite: '#fff4ea',
    },
  },
  systeme: {
    label: 'Système', desc: 'Fenêtres du Système façon Solo Leveling : bleu néon, angles vifs', swatches: ['#03060f', '#0a1630', '#3fa9ff', '#9b6bff'],
    scroll: '#3fa9ff',
    winBg: '#03060f', fontSize: 13, lineHeight: 1.2, cursor: 'block', placeholder: '[SYSTÈME] Entrez une commande… (⌘↵ pour envoyer)',
    xterm: {
      background: 'rgba(0,0,0,0)', foreground: '#d4ecff', cursor: '#5cc8ff', cursorAccent: '#03060f', selectionBackground: 'rgba(63,169,255,.28)',
      black: '#0a1630', red: '#ff5c7a', green: '#4dffc3', yellow: '#ffd36b', blue: '#3fa9ff', magenta: '#9b6bff', cyan: '#5ce1ff', white: '#a9c4e0',
      brightBlack: '#4f6a8f', brightRed: '#ff8099', brightGreen: '#7dffd6', brightYellow: '#ffe299', brightBlue: '#7cc4ff', brightMagenta: '#b896ff', brightCyan: '#8eecff', brightWhite: '#f0f8ff',
    },
  },
  kyoto: {
    label: 'Kyōto', desc: 'Encre sumi, vermillon des torii, vagues seigaiha', swatches: ['#14110f', '#211b16', '#e0533d', '#f2a7b8'],
    scroll: '#e0533d',
    winBg: '#14110f', fontSize: 13, lineHeight: 1.25, cursor: 'bar', placeholder: '一 Écris ta commande… (⌘↵ pour envoyer)',
    xterm: {
      background: '#17130f', foreground: '#ece3d3', cursor: '#e0533d', cursorAccent: '#17130f', selectionBackground: 'rgba(224,83,61,.25)',
      black: '#14110f', red: '#e0533d', green: '#8fb573', yellow: '#d4a64a', blue: '#6f8fb8', magenta: '#d98aa6', cyan: '#6fa8a0', white: '#d9cfbf',
      brightBlack: '#6e6052', brightRed: '#f07a62', brightGreen: '#a9cc8d', brightYellow: '#e6c06e', brightBlue: '#94b0d4', brightMagenta: '#f2a7b8', brightCyan: '#8fc4bc', brightWhite: '#fbf6ec',
    },
  },
  magic: {
    label: 'Magic', desc: 'Cadre de carte Magic : or, parchemin et les cinq couleurs de mana', swatches: ['#14110c', '#2a2318', '#d4af5a', '#6aa9dc'],
    scroll: '#d4af5a',
    winBg: '#0d0b08', fontSize: 13, lineHeight: 1.2, cursor: 'block', placeholder: 'Lance ton sort… (⌘↵ pour envoyer)',
    xterm: {
      background: '#110e0a', foreground: '#eadfc4', cursor: '#d4af5a', cursorAccent: '#110e0a', selectionBackground: 'rgba(212,175,90,.26)',
      black: '#14110c', red: '#e0604a', green: '#6fb87c', yellow: '#d4af5a', blue: '#6aa9dc', magenta: '#9a88ad', cyan: '#6fbdb4', white: '#d6cab0',
      brightBlack: '#6f634c', brightRed: '#f08570', brightGreen: '#8fd09a', brightYellow: '#e9cd84', brightBlue: '#8fc2ea', brightMagenta: '#b8a6ca', brightCyan: '#92d4cc', brightWhite: '#f6ecd2',
    },
  },
};
THEMES.conversation = {
  ...THEMES.papier, label: 'Conversation', desc: 'Claude comme une discussion : bulles, texte lisible, actions résumées',
  swatches: ['#faf9f5', '#ffffff', '#d97757', '#3d3929'], winBg: '#faf9f5', chat: true,
  placeholder: 'Écris à Claude…  (Entrée pour envoyer, ⇧Entrée pour aller à la ligne)',
};
const currentTheme = () => THEMES[state.theme] || THEMES.nuit;
// Barre de défilement discrète, lisible sur fond clair comme sombre
const SCROLLBAR = { scrollbarSliderBackground: 'rgba(127,127,127,.22)', scrollbarSliderHoverBackground: 'rgba(127,127,127,.38)', scrollbarSliderActiveBackground: 'rgba(127,127,127,.5)', overviewRulerBorder: 'rgba(0,0,0,0)' };
// Barre du terminal (dessinée par xterm) teintée par la couleur `scroll` du thème, comme les barres CSS
const rgba = (hex, a) => `rgba(${hex.match(/\w\w/g).map((h) => parseInt(h, 16)).join(',')},${a})`;
const scrollbarFor = (th) => (th.scroll ? { scrollbarSliderBackground: rgba(th.scroll, .3), scrollbarSliderHoverBackground: rgba(th.scroll, .55), scrollbarSliderActiveBackground: rgba(th.scroll, .8) } : {});
// Avec un fond personnalisé, le terminal devient transparent pour laisser voir l'image
const hasBg = () => state.bg.kind === 'color' || (state.bg.kind === 'image' && !!state.bg.image);
const termOptions = (th) => ({ theme: { ...SCROLLBAR, ...scrollbarFor(th), ...th.xterm, ...(hasBg() ? { background: 'rgba(0,0,0,0)' } : {}) }, fontSize: th.fontSize, lineHeight: th.lineHeight, cursorStyle: th.cursor, fontFamily: NERD_MONO });

const state = { theme: 'nuit', accounts: [], account: '', defaultName: 'Pro', lastActive: {}, presets: [], prompts: [], layout: 'tabs', tabs: [], activeKey: null, skills: [], skillConfigs: {}, customSkills: [],
  diff: { open: false, scope: 'session', auto: true, width: 560, collapsed: new Set() },
  bg: { kind: '', color: '#1e2a44', image: '', imageName: '', opacity: 78, blur: 0 },
  sound: { name: 'carillon', volume: 60 },
  // only : projet auquel le tableau est filtré ; columns : colonnes communes à tous les projets
  kanban: { open: false, width: 640, only: '', columns: null }, side: { width: 640 },
  // routes : projet où ranger les tickets de chaque liste ClickUp (id de liste → id de projet)
  inbox: { open: false, statuses: ['nouveau', 'à faire', 'rejeté'], mineStatuses: ['dev en cours'], sources: [], dismissed: [], routes: {} },
  times: { open: false, target: 7 },
  // Fonctions facultatives (kanban, inbox, times, accounts) : masquées tant qu'elles ne sont pas cochées dans les paramètres
  features: {} };
const feat = (k) => !!state.features[k];
const byPty = new Map(); // ptyId -> tab

function persist() {
  api.saveData({
    theme: state.theme, accounts: state.accounts, account: state.account, defaultName: state.defaultName, chatMode: state.chatMode, presets: state.presets, prompts: state.prompts, layout: state.layout,
    skillConfigs: state.skillConfigs, customSkills: state.customSkills, bg: state.bg, sound: state.sound,
    diff: { scope: state.diff.scope, auto: state.diff.auto },
    side: { width: state.side.width, last: state.side.last },
    kanban: { open: state.kanban.open, only: state.kanban.only, columns: state.kanban.columns, lastSkill: state.kanban.lastSkill },
    inbox: { open: state.inbox.open, statuses: state.inbox.statuses, mineStatuses: state.inbox.mineStatuses, sources: state.inbox.sources, dismissed: state.inbox.dismissed, routes: state.inbox.routes },
    times: { open: state.times.open, target: state.times.target },
    features: state.features,
  });
}

/* ---------- Terminaux ---------- */

// ⌘⌫ efface jusqu'au début de la ligne (Ctrl-U), ⌥⌫ le mot précédent (Ctrl-W) ; avec fn (⌦) : vers la droite
const MAC_ERASE = { 'Meta+Backspace': '\x15', 'Alt+Backspace': '\x17', 'Meta+Delete': '\x0b', 'Alt+Delete': '\x1bd' };

async function openTerminal({ name, cwd, command, color, presetId, accountId = state.account, group }) {
  const sameName = state.tabs.filter((t) => t.baseName === name).length;
  const tab = {
    key: uid(), presetId, baseName: name, title: sameName ? `${name} (${sameName + 1})` : name,
    cwd, command, color: color || '#737aa2', ptyId: null, exited: false,
    accountId, configDir: accountFor(accountId).dir, group,
  };

  tab.wrap = document.createElement('div');
  tab.wrap.className = 'term-wrap';
  tab.wrap.innerHTML = `<div class="term-head"><span class="dot" style="background:${tab.color}"></span><span>${esc(tab.title)}</span><span>${esc(shortPath(cwd))}</span><span class="cstate"></span></div><div class="term-body"></div>`;
  tab.wrap.querySelector('.term-head').onclick = () => activate(tab.key);
  makeDraggable(tab.wrap.querySelector('.term-head'), tab, 'pane');
  tab.wrap.querySelector('.term-head').ondblclick = () => startRename(tab);
  $('#terms').appendChild(tab.wrap);

  tab.term = new Terminal({
    ...termOptions(currentTheme()),
    cursorBlink: true, allowProposedApi: true, scrollback: 10000, macOptionIsMeta: true,
  });
  tab.fit = new FitAddon.FitAddon();
  tab.term.loadAddon(tab.fit);
  tab.term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, url) => window.open(url)));
  tab.term.open(tab.wrap.querySelector('.term-body'));

  tab.term.onData((data) => {
    if (data.includes('\r') && tab.cstate === 'waiting') setClaudeState(tab, null);
    if (tab.exited) {
      if (data === '\r') restart(tab);
      return;
    }
    api.write(tab.ptyId, data);
  });
  // xterm.js ignore ⌘ et envoie ⌥⌫ en Échap+DEL : on reprend les raccourcis d'effacement de Terminal/iTerm
  tab.term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || e.ctrlKey || e.shiftKey || e.metaKey === e.altKey) return true;
    const seq = MAC_ERASE[`${e.metaKey ? 'Meta' : 'Alt'}+${e.key}`];
    if (!seq) return true;
    e.preventDefault();
    tab.term.input(seq);
    return false;
  });
  tab.term.onResize(({ cols, rows }) => tab.ptyId && api.resize(tab.ptyId, cols, rows));
  // Claude Code met « ◐ ◑ ◒ ◓ » en tête du titre pendant qu'il travaille, « ✳ » quand c'est à nous
  tab.term.onTitleChange((title) => {
    if (/^[◐◑◒◓]/.test(title)) setClaudeState(tab, 'working');
    else if (/^✳/.test(title) && tab.cstate === 'working') setClaudeState(tab, 'waiting');
  });
  tab.term.onBell(() => { if (tab.key !== state.activeKey) { tab.bell = true; renderTabs(); } });
  tab.term.textarea.addEventListener('focus', () => state.activeKey !== tab.key && activate(tab.key));

  new ResizeObserver(() => fitTab(tab)).observe(tab.wrap);

  state.tabs.push(tab);
  tab.wrap.classList.toggle('away', !inSpace(tab));
  applyLayout();
  activate(tab.key);
  fitTab(tab);
  api.gitTrack(cwd).then((g) => {
    tab.git = g;
    if (tab.key === state.activeKey) refreshDiff();
  });
  await spawn(tab);
  return tab;
}

async function spawn(tab) {
  tab.exited = false;
  tab.ptyId = await api.createPty({ cwd: tab.cwd, command: tab.command, cols: tab.term.cols, rows: tab.term.rows, configDir: tab.configDir });
  byPty.set(tab.ptyId, tab);
  renderTabs();
  renderPresets();
}

function restart(tab) {
  tab.term.reset();
  spawn(tab);
}

function fitTab(tab) {
  if (!tab.fit) return;
  if (!tab.wrap.offsetWidth || !tab.wrap.offsetHeight) return;
  try { tab.fit.fit(); } catch {}
}

function closeTab(key) {
  const i = state.tabs.findIndex((t) => t.key === key);
  if (i < 0) return;
  const tab = state.tabs[i];
  if (tab.kind === 'chat') stopChatProcess(tab);
  else if (tab.ptyId && !tab.exited) api.kill(tab.ptyId);
  byPty.delete(tab.ptyId);
  tab.git?.repos.forEach((r) => api.gitUntrack(r.root));
  tab.term?.dispose();
  tab.wrap.remove();
  state.tabs.splice(i, 1);
  if (state.activeKey === key) {
    const rest = spaceTabs();
    const next = rest.find((t) => state.tabs.indexOf(t) >= i) || rest[rest.length - 1];
    state.activeKey = null;
    if (next) activate(next.key);
  }
  renderTabs();
  renderPresets();
  applyLayout();
  refreshDiff();
}

function activate(key) {
  const tab = state.tabs.find((t) => t.key === key);
  if (!tab || !inSpace(tab)) return;
  state.activeKey = key;
  tab.activity = false;
  tab.bell = false;
  for (const t of state.tabs) {
    t.wrap.classList.toggle('visible', t.key === key);
    t.wrap.classList.toggle('active', t.key === key);
  }
  renderTabs();
  applyLayout();
  refreshDiff();
  updatePromptBar();
  requestAnimationFrame(() => { fitTab(tab); focusTab(tab); });
}

const activeTab = () => state.tabs.find((t) => t.key === state.activeKey && inSpace(t));
const focusTab = (t) => (renamingKey ? null : t?.kind === 'chat' ? $('#prompt').focus() : t?.term.focus());
const focusActive = () => focusTab(activeTab());

api.onData((id, data) => {
  const tab = byPty.get(id);
  if (!tab) return;
  tab.term.write(data);
  if (tab.key !== state.activeKey && !tab.activity) { tab.activity = true; renderTabs(); }
});

api.onExit((id, code) => {
  const tab = byPty.get(id);
  if (!tab) return;
  byPty.delete(id);
  tab.exited = true;
  tab.cstate = null;
  tab.term.write(`\r\n\x1b[2m[processus terminé (code ${code}) — Entrée pour relancer, ⌘W pour fermer]\x1b[0m\r\n`);
  renderTabs();
});

/* ---------- État de Claude : travaille / attend notre réponse ---------- */

const CSTATE = {
  working: ['spinner', 'Claude travaille…'],
  waiting: ['reply', 'Claude attend ta réponse'],
};
const cstateIcon = (t) => (CSTATE[t.cstate] ? `<span class="cstate ${t.cstate}" title="${CSTATE[t.cstate][1]}">${icon(CSTATE[t.cstate][0])}</span>` : '');

function setClaudeState(tab, s) {
  if (tab.cstate === s) return;
  // Claude vient de finir (ou demande quelque chose) : petit son
  if (tab.cstate === 'working' && s === 'waiting') playDoneSound(tab);
  tab.cstate = s;
  const head = tab.wrap.querySelector('.term-head .cstate');
  if (head) head.outerHTML = cstateIcon(tab) || '<span class="cstate"></span>';
  renderTabs();
  renderPresets();
}

/* ---------- Son de fin ---------- */

// Sons synthétisés (Web Audio), sans fichier : [fréquence, départ (s), durée (s), forme, glissando vers]
const SOUNDS = {
  carillon: { label: 'Carillon', notes: [[880, 0, .7, 'sine'], [1318.5, .13, .9, 'sine']] },
  goutte: { label: 'Goutte', notes: [[1250, 0, .28, 'sine', 520]] },
  cloche: { label: 'Cloche', notes: [[660, 0, 1.4, 'sine'], [1320, 0, .9, 'sine'], [1980, 0, .5, 'sine']] },
  arcade: { label: 'Arcade', notes: [[988, 0, .09, 'square'], [1319, .09, .22, 'square']] },
  doux: { label: 'Doux', notes: [[523.25, 0, .9, 'triangle'], [659.25, .18, 1, 'triangle']] },
};
// Sons d'alerte du Mac, avec leur nom français (« Brise » = Blow.aiff)
const MAC_SOUNDS = { Blow: 'Brise', Hero: 'Héroïne', Glass: 'Cristal', Pop: 'Bulle', Tink: 'Boop', Ping: 'Sonar', Bottle: 'Galet', Funk: 'Funky', Morse: 'Pong', Purr: 'Pincement', Frog: 'Saut', Basso: 'Mezzo', Sosumi: 'Sonumi', Submarine: 'Submersible' };
let audioCtx = null;

function playSound(name, volume = state.sound.volume) {
  if (name?.startsWith('mac:')) return api.playSystemSound(name.slice(4), volume / 100);
  const snd = SOUNDS[name];
  if (!snd) return;
  audioCtx ||= new AudioContext();
  const now = audioCtx.currentTime + .02;
  const level = (volume / 100) * (name === 'arcade' ? .06 : .22);
  for (const [freq, at, dur, type, glideTo] of snd.notes) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + at + dur * .6);
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(level, now + at + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + at + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now + at);
    osc.stop(now + at + dur + .05);
  }
}

function playDoneSound(tab) {
  if (!state.sound.name || Date.now() - (tab.soundAt || 0) < 1500) return;
  tab.soundAt = Date.now();
  playSound(state.sound.name);
}

/* ---------- Rendu ---------- */

// Renommer un onglet : double-clic sur l'onglet ou sur l'en-tête du terminal, Entrée pour valider, Échap pour annuler
let renamingKey = null;
function startRename(t) {
  if (!t) return;
  const el = [...$('#tabs').children][spaceTabs().indexOf(t)];
  const titleEl = el?.querySelector('.title');
  if (!titleEl) return;
  renamingKey = t.key;
  el.draggable = false;
  const input = document.createElement('input');
  input.className = 'tab-rename';
  input.value = t.title;
  input.spellcheck = false;
  input.size = Math.max(6, t.title.length + 1);
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  // Le clic qui précède le double-clic a pu programmer un focus du terminal : on reprend la main
  setTimeout(() => { if (renamingKey === t.key) { input.focus(); input.select(); } }, 30);
  const done = (save) => {
    if (renamingKey !== t.key) return;
    renamingKey = null;
    if (save) {
      t.title = input.value.trim() || t.baseName;
      const head = t.wrap.querySelector('.term-head span:nth-child(2)');
      if (head) head.textContent = t.title;
    }
    renderTabs();
    if (t.key === state.activeKey) focusTab(t);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    if (e.key === 'Escape') { e.preventDefault(); done(false); }
  });
  input.addEventListener('input', () => { input.size = Math.max(6, input.value.length + 1); });
  input.addEventListener('blur', () => done(true));
  ['mousedown', 'click', 'dblclick'].forEach((ev) => input.addEventListener(ev, (e) => e.stopPropagation()));
}

function renderTabs() {
  if (renamingKey) return; // ne pas écraser le champ en cours d'édition
  const el = $('#tabs');
  el.innerHTML = '';
  spaceTabs().forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'tab' + (t.key === state.activeKey ? ' active' : '') + (t.exited && t.kind !== 'chat' ? ' exited' : '') + (t.bell ? ' bell' : t.activity ? ' activity' : '');
    d.title = `${shortPath(t.cwd)}${t.command ? ' — ' + t.command : ''}${i < 9 ? `  (⌘${i + 1})` : ''}`;
    d.innerHTML = `<span class="dot" style="background:${t.color}"></span>${cstateIcon(t)}<span class="title">${esc(t.title)}</span><span class="badge"></span><button class="close" title="Fermer (⌘W)">${icon('x')}</button>`;
    d.onclick = () => activate(t.key);
    // Au mousedown : les onglets sont souvent redessinés, un auxclick n'arrive pas toujours au même élément
    d.onmousedown = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.key); } };
    makeDraggable(d, t, 'tab');
    d.ondblclick = (e) => { if (!e.target.closest('.close')) startRename(t); };
    d.querySelector('.title').title = 'Double-clic pour renommer';
    d.querySelector('.close').onclick = (e) => { e.stopPropagation(); closeTab(t.key); };
    el.appendChild(d);
  });
  $('#empty').classList.toggle('hidden', spaceTabs().length > 0);
  renderSpaceSwitch();
}

function renderPresets() {
  const q = $('#preset-filter').value.trim().toLowerCase();
  const el = $('#preset-list');
  el.innerHTML = '';
  for (const p of spacePresets()) {
    if (q && !`${p.name} ${p.cwd}`.toLowerCase().includes(q)) continue;
    const n = state.tabs.filter((t) => t.presetId === p.id && !t.exited).length;
    // Claude qui attend une réponse prime sur Claude qui travaille
    const states = state.tabs.filter((t) => t.presetId === p.id).map((t) => t.cstate);
    const pstate = states.includes('waiting') ? 'waiting' : states.includes('working') ? 'working' : null;
    const li = document.createElement('li');
    const panes = panesOf(p);
    const summary = panes.length > 1 ? `${panes.length} terminaux` : p.command;
    // Projet ouvert : sa branche dit plus que son chemin (qui reste dans l'infobulle)
    const branches = state.tabs.find((t) => t.presetId === p.id && t.branches?.length)?.branches;
    const where = branches ? `${icon('branch')}${esc(branches.map((b) => b.branch).join(', '))}` : esc(shortPath(p.cwd));
    li.title = `${p.cwd}\n${panes.map((x) => '• ' + paneLabel(x)).join('\n')}`;
    li.innerHTML = `<span class="dot" style="background:${p.color}"></span>
      <div class="info"><div class="name">${esc(p.name)}</div><div class="path">${where}${summary ? ' · ' + esc(summary) : ''}</div></div>
      ${n ? `<span class="count${pstate ? ' ' + pstate : ''}" title="${pstate ? CSTATE[pstate][1] : ''}">${pstate ? icon(CSTATE[pstate][0]) : n}</span>` : ''}
      <div class="tools"><button data-a="skill" title="Lancer un skill sur ce projet (⌘J)">${icon('zap')}</button><button data-a="edit" title="Modifier">${icon('pencil')}</button><button data-a="del" title="Supprimer">${icon('trash')}</button></div>`;
    li.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'skill') return openPalette({ mode: 'skills', presetId: p.id });
      if (a === 'edit') return openPresetModal(p);
      if (a === 'del') return deletePreset(p);
      launchPreset(p);
    };
    el.appendChild(li);
  }
  if (!spacePresets().length) el.innerHTML = '<li style="cursor:default;color:var(--muted)">Aucun projet. Clique sur + pour en créer un, ou importe un dossier de projets.</li>';
}

// Groupe = terminaux affichés ensemble (lancés par un projet, ou réunis à la main / par glisser-déposer).
// g = { id, layout, split, order: [clés], cols: [fr], rows: [fr] } ; layout 'tabs' = groupe replié en onglets
const groupTabs = (g) => {
  if (!g) return [];
  const tabs = spaceTabs().filter((t) => t.group === g);
  const pos = (t) => { const i = (g.order || []).indexOf(t.key); return i < 0 ? 1e9 + state.tabs.indexOf(t) : i; };
  return tabs.sort((a, b) => pos(a) - pos(b));
};
const splitGroup = () => { const g = activeTab()?.group; return groupTabs(g).length > 1 && g.split !== 'tabs' ? g : null; };
const newGroup = (layout, tabs) => {
  const g = { id: uid(), layout, split: layout, order: tabs.map((t) => t.key) };
  tabs.forEach((t) => leaveGroup(t, g));
  return g;
};
// Retire un terminal de son groupe (et le met dans `into` si fourni) ; un groupe réduit à un terminal disparaît
function leaveGroup(t, into = null) {
  const old = t.group;
  t.group = into;
  if (old && old !== into) {
    old.order = (old.order || []).filter((k) => k !== t.key);
    old.cols = old.rows = null;
    const rest = state.tabs.filter((x) => x.group === old);
    if (rest.length === 1) rest[0].group = null;
  }
}

let layoutInfo = { mode: 'tabs', shown: [], cols: 0, rows: 0, g: null };

// Le groupe de l'onglet actif impose sa disposition ; sinon un seul terminal à la fois
function applyLayout() {
  const g = splitGroup();
  const shown = g && g.layout !== 'tabs' ? groupTabs(g) : [];
  const mode = shown.length > 1 ? g.layout : 'tabs';
  const terms = $('#terms');
  terms.classList.toggle('grid', mode !== 'tabs');
  for (const t of state.tabs) {
    t.wrap.classList.toggle('shown', shown.includes(t));
    t.wrap.style.gridRow = t.wrap.style.gridColumn = t.wrap.style.order = '';
  }
  let cols = 0;
  let rows = 0;
  if (mode !== 'tabs') {
    const n = shown.length;
    shown.forEach((t, i) => { t.wrap.style.order = i; });
    // main-left : le premier terminal prend la moitié gauche, les autres s'empilent à droite
    // main-top : le premier prend le haut, les autres se partagent le bas
    cols = mode === 'cols' ? n : mode === 'rows' ? 1 : Math.ceil(Math.sqrt(n));
    rows = Math.ceil(n / cols);
    if (mode === 'main-left') { cols = 2; rows = n - 1; shown[0].wrap.style.gridRow = `1 / span ${rows}`; }
    if (mode === 'main-top') { cols = n - 1; rows = 2; shown[0].wrap.style.gridColumn = `1 / span ${cols}`; }
    if (g.cols?.length !== cols) g.cols = Array(cols).fill(1);
    if (g.rows?.length !== rows) g.rows = Array(rows).fill(1);
    terms.style.gridTemplateColumns = g.cols.map((f) => `minmax(0, ${f}fr)`).join(' ');
    terms.style.gridTemplateRows = g.rows.map((f) => `minmax(0, ${f}fr)`).join(' ');
  } else {
    terms.style.gridTemplateColumns = terms.style.gridTemplateRows = '';
  }
  layoutInfo = { mode, shown, cols, rows, g };
  const grouped = !!activeTab()?.group && groupTabs(activeTab().group).length > 1;
  $('#btn-layout').innerHTML = icon(mode !== 'tabs' ? 'tabs' : 'grid');
  $('#btn-layout').title = mode !== 'tabs' ? 'Afficher en onglets (⌘G)' : grouped ? 'Revenir à la disposition du groupe (⌘G)' : 'Afficher tous les terminaux en grille (⌘G)';
  requestAnimationFrame(() => { renderSplitHandles(); state.tabs.forEach(fitTab); });
}

/* ---------- Redimensionnement des terminaux ---------- */

// Poignées posées sur les séparations de la grille ; la taille des pistes est lue dans le style calculé
function renderSplitHandles() {
  const terms = $('#terms');
  terms.querySelectorAll('.split-handle').forEach((h) => h.remove());
  const { mode, cols, rows, g } = layoutInfo;
  if (mode === 'tabs') return;
  const cs = getComputedStyle(terms);
  const colPx = cs.gridTemplateColumns.split(' ').map(parseFloat);
  const rowPx = cs.gridTemplateRows.split(' ').map(parseFloat);
  const gap = parseFloat(cs.columnGap) || 0;
  const padL = parseFloat(cs.paddingLeft);
  const padT = parseFloat(cs.paddingTop);
  const start = (px, i, pad) => pad + px.slice(0, i).reduce((a, b) => a + b, 0) + i * gap;
  const add = (axis, i, style) => {
    const h = document.createElement('div');
    h.className = `split-handle ${axis}`;
    Object.assign(h.style, style);
    h.addEventListener('pointerdown', (e) => startSplitDrag(e, g, axis, i, axis === 'col' ? colPx : rowPx));
    terms.appendChild(h);
  };
  const fullH = { top: `${padT}px`, height: `${rowPx.reduce((a, b) => a + b, 0) + (rows - 1) * gap}px` };
  const fullW = { left: `${padL}px`, width: `${colPx.reduce((a, b) => a + b, 0) + (cols - 1) * gap}px` };
  for (let i = 1; i < cols; i++) {
    const v = mode === 'main-top' ? { top: `${start(rowPx, 1, padT)}px`, height: `${rowPx[1]}px` } : fullH;
    add('col', i, { left: `${start(colPx, i, padL) - gap / 2 - 4}px`, ...v });
  }
  for (let i = 1; i < rows; i++) {
    const h = mode === 'main-left' ? { left: `${start(colPx, 1, padL)}px`, width: `${colPx[1]}px` } : fullW;
    add('row', i, { top: `${start(rowPx, i, padT) - gap / 2 - 4}px`, ...h });
  }
}

function startSplitDrag(e, g, axis, i, px) {
  e.preventDefault();
  const sizes = [...px];
  const pair = sizes[i - 1] + sizes[i];
  const min = axis === 'col' ? 160 : 90;
  const origin = axis === 'col' ? e.clientX : e.clientY;
  document.body.classList.add('resizing', axis === 'col' ? 'resizing-col' : 'resizing-row');
  let raf = 0;
  const move = (ev) => {
    const d = (axis === 'col' ? ev.clientX : ev.clientY) - origin;
    const a = Math.max(min, Math.min(pair - min, px[i - 1] + d));
    sizes[i - 1] = a;
    sizes[i] = pair - a;
    g[axis === 'col' ? 'cols' : 'rows'] = [...sizes];
    $('#terms').style[axis === 'col' ? 'gridTemplateColumns' : 'gridTemplateRows'] = sizes.map((f) => `minmax(0, ${f}fr)`).join(' ');
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { renderSplitHandles(); layoutInfo.shown.forEach(fitTab); });
  };
  const up = () => {
    document.body.classList.remove('resizing', 'resizing-col', 'resizing-row');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    applyLayout();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
new ResizeObserver(() => requestAnimationFrame(renderSplitHandles)).observe($('#terms'));
// Double-clic sur une poignée : tailles égales
$('#terms').addEventListener('dblclick', (e) => {
  if (!e.target.classList.contains('split-handle') || !layoutInfo.g) return;
  layoutInfo.g.cols = layoutInfo.g.rows = null;
  applyLayout();
});

/* ---------- Glisser-déposer des terminaux ---------- */

// Un terminal se saisit par son en-tête (en grille) ou par son onglet.
// Déposé sur un autre terminal : ils échangent leur place, ou le terminal rejoint la grille.
// Déposé dans la barre d'onglets : il sort de la grille (et se range avant l'onglet visé).
let dragKey = null;
let dragFrom = '';
const dragTab = () => state.tabs.find((t) => t.key === dragKey);

function makeDraggable(el, tab, from) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    dragKey = tab.key;
    dragFrom = from;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.title);
    document.body.classList.add('dragging-term');
  });
  el.addEventListener('dragend', () => {
    dragKey = null;
    document.body.classList.remove('dragging-term');
    document.querySelectorAll('.drop-target, .drop-before').forEach((x) => x.classList.remove('drop-target', 'drop-before'));
  });
}

const paneAt = (e) => state.tabs.find((t) => t.wrap === e.target.closest?.('.term-wrap'));

$('#terms').addEventListener('dragover', (e) => {
  if (!dragKey) return;
  e.preventDefault();
  e.stopPropagation();
  const t = paneAt(e);
  document.querySelectorAll('.term-wrap.drop-target').forEach((x) => x !== t?.wrap && x.classList.remove('drop-target'));
  if (t && t.key !== dragKey) t.wrap.classList.add('drop-target');
}, true);
$('#terms').addEventListener('drop', (e) => {
  const src = dragTab();
  if (!src) return;
  e.preventDefault();
  e.stopPropagation();
  const tgt = paneAt(e) || activeTab();
  if (!tgt || tgt === src) return;
  const g = layoutInfo.mode !== 'tabs' && layoutInfo.shown.includes(tgt) ? layoutInfo.g : null;
  if (g) {
    const keys = groupTabs(g).map((t) => t.key);
    if (src.group === g) {
      // Échange de places dans la grille
      const a = keys.indexOf(src.key);
      const b = keys.indexOf(tgt.key);
      [keys[a], keys[b]] = [keys[b], keys[a]];
    } else {
      leaveGroup(src, g);
      keys.splice(keys.indexOf(tgt.key), 0, src.key);
      g.cols = g.rows = null;
    }
    g.order = keys;
  } else if (tgt.group && groupTabs(tgt.group).length > 1) {
    // Groupe replié en onglets : on y ajoute le terminal et on le redéploie
    const tg = tgt.group;
    leaveGroup(src, tg);
    tg.order = [...groupTabs(tg).map((t) => t.key).filter((k) => k !== src.key), src.key];
    if (tg.split === 'tabs') tg.split = 'cols';
    tg.layout = tg.split;
    tg.cols = tg.rows = null;
  } else {
    // Deux terminaux seuls : on crée une grille côte à côte
    newGroup('cols', [tgt, src]);
  }
  activate(src.key);
});

$('#tabbar').addEventListener('dragover', (e) => {
  if (!dragKey) return;
  e.preventDefault();
  const tabEl = e.target.closest('.tab');
  document.querySelectorAll('.tab.drop-before').forEach((x) => x !== tabEl && x.classList.remove('drop-before'));
  if (tabEl) tabEl.classList.add('drop-before');
  $('#tabs').classList.add('drop-target');
});
$('#tabbar').addEventListener('dragleave', (e) => {
  if (!$('#tabbar').contains(e.relatedTarget)) $('#tabs').classList.remove('drop-target');
});
$('#tabbar').addEventListener('drop', (e) => {
  const src = dragTab();
  if (!src) return;
  e.preventDefault();
  $('#tabs').classList.remove('drop-target');
  // Un terminal saisi par son en-tête sort de la grille ; un onglet déplacé est seulement réordonné
  if (dragFrom === 'pane' && src.group) leaveGroup(src);
  const tabEl = e.target.closest('.tab');
  const before = tabEl && spaceTabs()[[...$('#tabs').children].indexOf(tabEl)];
  if (before && before !== src) {
    state.tabs.splice(state.tabs.indexOf(src), 1);
    state.tabs.splice(state.tabs.indexOf(before), 0, src);
  }
  activate(src.key);
});

/* ---------- Presets ---------- */

const isClaudeCmd = (c) => /^claude\b/.test(c || '');

// Ouvre une session sur un projet : vue conversation (thème Conversation) ou terminal
function openSession(p, { prompt = '', title, accountId = p.accountId || '', dir = '', cmd = p.command, group } = {}) {
  const name = title || p.name;
  const cwd = dir ? `${p.cwd.replace(/\/+$/, '')}/${dir}` : p.cwd;
  const claude = isClaudeCmd(cmd);
  if (currentTheme().chat && (claude || prompt)) {
    return openChat({ name, cwd, color: p.color, presetId: p.id, accountId, extraArgs: claude ? cmd.replace(/^claude\s*/, '') : '', prompt, group });
  }
  const command = prompt ? `${claude ? cmd : 'claude'} ${shq(prompt)}` : cmd;
  return openTerminal({ name, cwd, command, color: p.color, presetId: p.id, accountId, group });
}

// Ce que lance un projet : une liste de terminaux (dossier + commande) et une disposition
const panesOf = (p) => (p.panes?.length ? p.panes : [{ dir: '', cmd: p.command || '' }]);
const paneLabel = (x) => `${x.dir || 'racine'}${x.cmd ? ' · ' + x.cmd : ' · shell'}`;

async function launchPreset(p) {
  const panes = panesOf(p);
  if (panes.length === 1) return openSession(p, panes[0]);
  const layout = p.layout || 'cols';
  const group = { id: uid(), layout, split: layout };
  const tabs = [];
  for (const x of panes) {
    const title = x.dir ? `${p.name} › ${x.dir}` : p.name;
    tabs.push(await openSession(p, { ...x, title, group }));
  }
  activate(tabs[0].key);
}

/* ---------- Comptes Claude ---------- */

// Le compte « par défaut » utilise ~/.claude ; son nom est modifiable (Pro par défaut)
const defaultAccount = () => ({ id: '', name: state.defaultName || 'Pro', dir: '' });
const allAccounts = () => [defaultAccount(), ...state.accounts];
const accountFor = (id) => state.accounts.find((a) => a.id === id) || defaultAccount();
const accountOptions = (selected) => allAccounts()
  .map((a) => `<option value="${a.id}"${a.id === (selected || '') ? ' selected' : ''}>${esc(a.name)} — ${esc(a.dir || '~/.claude')}</option>`).join('');

function renderAccounts() {
  const list = $('#account-list');
  list.innerHTML = '';
  for (const a of allAccounts()) {
    const used = state.presets.filter((p) => (p.accountId || '') === a.id).length;
    const row = el('div', 'account-row', `
      <input class="account-name" value="${esc(a.name)}" spellcheck="false" title="Renommer">
      <code>${esc(a.dir || '~/.claude')}</code>
      <span class="account-used">${used} projet${used > 1 ? 's' : ''}</span>
      <button data-a="login" title="Ouvre Claude avec ce compte : il demande de se connecter si ce n'est pas encore fait (sinon tape /login)">Se connecter</button>
      ${a.id ? `<button data-a="del" title="Retirer ce compte de Clutch (le dossier n’est pas supprimé)">${icon('x')}</button>` : ''}`);
    row.querySelector('.account-name').onchange = (e) => {
      const name = e.target.value.trim() || a.name;
      if (a.id) state.accounts.find((x) => x.id === a.id).name = name;
      else state.defaultName = name;
      persist();
      renderSpaceSwitch();
    };
    row.onclick = (e) => {
      const action = e.target.closest('[data-a]')?.dataset.a;
      if (action === 'login') {
        closeOverlay($('#settings'));
        switchSpace(a.id);
        openTerminal({ name: `Connexion · ${a.name}`, cwd: '~', command: 'claude', accountId: a.id });
      } else if (action === 'del' && confirm(`Retirer le compte « ${a.name} » de Clutch ? Les projets qui l’utilisent repasseront sur le compte par défaut.`)) {
        state.accounts = state.accounts.filter((x) => x.id !== a.id);
        state.presets.forEach((p) => { if (p.accountId === a.id) p.accountId = ''; });
        if (state.account === a.id) switchSpace('');
        persist();
        renderAccounts();
        renderPresets();
      }
    };
    list.appendChild(row);
  }
}

const openAccounts = () => openSettings('accounts');

$('#account-form').name.addEventListener('input', (e) => {
  const slug = e.target.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  $('#account-form').dir.placeholder = `~/.claude-${slug || 'perso'}`;
});
$('#account-form').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  const name = f.name.value.trim();
  const dir = f.dir.value.trim() || f.dir.placeholder;
  state.accounts.push({ id: uid(), name, dir });
  persist();
  f.reset();
  f.dir.placeholder = '~/.claude-perso';
  renderAccounts();
  renderSpaceSwitch();
  // Le formulaire de preset ouvert en dessous doit proposer le nouveau compte
  $('#preset-account').innerHTML = accountOptions($('#preset-account').value);
};
/* Espaces : un compte à la fois, ses projets, ses onglets et ses skills */

// Sans la fonction « plusieurs comptes », tout est réuni dans un seul espace
function inSpace(x) { return !feat('accounts') || (x.accountId || '') === state.account; }
function spaceTabs() { return state.tabs.filter(inSpace); }
function spacePresets() { return state.presets.filter(inSpace); }

function renderSpaceSwitch() {
  const sw = $('#space-switch');
  sw.innerHTML = allAccounts().map((a) => {
    // Un point signale de l'activité dans un espace masqué (Claude a fini, demande quelque chose…)
    const busy = a.id !== state.account && state.tabs.some((t) => (t.accountId || '') === a.id && (t.bell || t.activity));
    return `<button data-id="${a.id}" class="${a.id === state.account ? 'on' : ''}" title="${esc(a.dir || '~/.claude')}">${esc(a.name)}${busy ? '<span class="space-dot"></span>' : ''}</button>`;
  }).join('') + (state.accounts.length ? '' : `<button data-add title="Ajouter un compte (ex. Perso)">${icon('plus')} Perso</button>`);
  document.title = feat('accounts') && state.accounts.length ? `Clutch — ${accountFor(state.account).name}` : 'Clutch';
}

function switchSpace(id) {
  if (id === state.account) return;
  state.lastActive[state.account] = state.activeKey;
  state.account = id;
  persist();
  state.activeKey = null;
  for (const t of state.tabs) {
    t.wrap.classList.toggle('away', !inSpace(t));
    t.wrap.classList.remove('visible', 'active');
  }
  const tabs = spaceTabs();
  const back = tabs.find((t) => t.key === state.lastActive[id]) || tabs[0];
  $('#preset-filter').value = '';
  $('#skill-filter').value = '';
  renderPresets();
  renderTabs();
  applyLayout();
  scanSkills();
  refreshUsage();
  if (back) activate(back.key);
  else refreshDiff();
  kanbanProjectsChanged();
}

$('#space-switch').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-add')) return openAccounts();
  switchSpace(b.dataset.id);
});
$('#preset-account').addEventListener('change', (e) => {
  if (e.target.value !== '__add') return;
  e.target.value = editing?.accountId || '';
  openAccounts();
});

function deletePreset(p) {
  if (!confirm(`Supprimer le projet « ${p.name} » ?`)) return;
  state.presets = state.presets.filter((x) => x.id !== p.id);
  persist();
  renderPresets();
  kanbanProjectsChanged();
}

let editing = null;
let pickedColor = COLORS[0];

// Formulaire du projet en trois onglets : général, lancement, ClickUp
function showPresetTab(tab) {
  document.querySelectorAll('#preset-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('#preset-form .preset-pane').forEach((x) => x.classList.toggle('hidden', x.dataset.pane !== tab));
}
$('#preset-tabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) showPresetTab(b.dataset.tab);
};
// Nom ou dossier manquant alors qu'un autre onglet est affiché : on y revient, sinon rien ne se passe
$('#preset-form').addEventListener('invalid', () => showPresetTab('general'), true);

function openPresetModal(p, tab = 'general') {
  editing = p || null;
  const f = $('#preset-form');
  $('#modal-title').textContent = p ? 'Modifier le projet' : 'Nouveau projet';
  showPresetTab(tab);
  f.name.value = p?.name || '';
  f.cwd.value = p?.cwd || '';
  modalPanes = (p ? panesOf(p) : [{ dir: '', cmd: 'claude' }]).map(({ dir, cmd }) => {
    const kind = paneKind(cmd);
    return { dir, kind, arg: kind === 'claude' ? cmd.replace(/^claude\s*/, '') : cmd };
  });
  modalLayout = p?.layout || 'cols';
  modalSubdirs = [];
  renderLaunch();
  loadModalSubdirs();
  $('#preset-account').innerHTML = accountOptions(p ? p.accountId : state.account) + '<option value="__add">+ Ajouter un compte…</option>';
  pickedColor = p?.color || COLORS[state.presets.length % COLORS.length];
  renderColors();
  const cu = { ...CU_SYNC_DEFAULTS, ...p?.clickupSync };
  f.cuEnabled.checked = cu.enabled;
  f.cuLogTime.checked = cu.logTime;
  $('#cu-check-result').textContent = '';
  renderCuSync();
  // Les colonnes se règlent sur le tableau ; ici, un rappel de ce qui est relié pour ce projet
  $('#cu-cols').textContent = `Colonnes du tableau : ${kbColumns(p, state.kanban.columns).map((c) => `${c.label} → ${c.status || 'aucun statut'}${c.timer ? ' (chrono)' : ''}`).join(' · ')}. Elles sont communes à tous les projets et se règlent sur le kanban, en cliquant sur l'en-tête d'une colonne ; avec le tableau filtré sur ce projet, le statut réglé ne vaut que pour lui.`;
  $('#modal').classList.remove('hidden');
  if (tab === 'general') f.name.focus();
}

function renderColors() {
  const el = $('#color-picker');
  el.innerHTML = '';
  for (const c of COLORS) {
    const s = document.createElement('span');
    s.className = 'swatch' + (c === pickedColor ? ' selected' : '');
    s.style.background = c;
    s.onclick = () => { pickedColor = c; renderColors(); };
    el.appendChild(s);
  }
}

/* Lancement : terminaux à ouvrir et disposition */
let modalPanes = [];
let modalLayout = 'cols';
let modalSubdirs = [];
const PANE_KINDS = [['claude', 'Claude'], ['', 'Terminal'], ['custom', 'Commande…']];
const paneKind = (cmd) => (isClaudeCmd(cmd) ? 'claude' : cmd ? 'custom' : '');
const paneCmd = ({ kind, arg }) => (kind === 'claude' ? `claude ${arg.trim()}`.trim() : kind === 'custom' ? arg.trim() : '');

async function loadModalSubdirs() {
  const cwd = $('#preset-form').cwd.value.trim();
  modalSubdirs = cwd ? (await api.subdirs(cwd)).map((d) => d.name).filter((n) => n !== 'node_modules') : [];
  renderLaunch();
}

function renderLaunch() {
  const el = $('#launch-panes');
  el.innerHTML = '';
  modalPanes.forEach((x, i) => {
    const dirs = ['', ...modalSubdirs];
    if (x.dir && !dirs.includes(x.dir)) dirs.push(x.dir);
    const row = document.createElement('div');
    row.className = 'pane-row';
    row.innerHTML = `
      <select class="pane-dir" title="Dossier">${dirs.map((d) => `<option value="${esc(d)}">${d ? esc(d) + '/' : 'racine'}</option>`).join('')}</select>
      <select class="pane-kind">${PANE_KINDS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <input class="pane-cmd${x.kind ? '' : ' hidden'}" spellcheck="false" placeholder="${x.kind === 'claude' ? 'options, ex. --model sonnet' : 'npm run dev'}">
      <button type="button" class="pane-up" title="Monter (le premier terminal est le principal)"${i ? '' : ' disabled'}>${icon('arrow-up')}</button>
      <button type="button" class="pane-del" title="Retirer"${modalPanes.length === 1 ? ' disabled' : ''}>${icon('x')}</button>`;
    row.querySelector('.pane-dir').value = x.dir;
    row.querySelector('.pane-kind').value = x.kind;
    row.querySelector('.pane-cmd').value = x.arg;
    row.querySelector('.pane-dir').onchange = (e) => { x.dir = e.target.value; };
    row.querySelector('.pane-kind').onchange = (e) => {
      x.kind = e.target.value;
      x.arg = '';
      renderLaunch();
      if (x.kind === 'custom') el.children[i].querySelector('.pane-cmd').focus();
    };
    row.querySelector('.pane-cmd').oninput = (e) => { x.arg = e.target.value; };
    row.querySelector('.pane-up').onclick = () => { modalPanes.splice(i - 1, 0, ...modalPanes.splice(i, 1)); renderLaunch(); };
    row.querySelector('.pane-del').onclick = () => { modalPanes.splice(i, 1); renderLaunch(); };
    el.appendChild(row);
  });
  const seg = $('#launch-layout');
  seg.classList.toggle('disabled', modalPanes.length < 2);
  seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.l === modalLayout));
}

$('#launch-layout').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  modalLayout = b.dataset.l;
  renderLaunch();
};
$('#btn-add-pane').onclick = () => { modalPanes.push({ dir: '', kind: '', arg: '' }); renderLaunch(); };
$('#btn-add-subs').onclick = async () => {
  if (!modalSubdirs.length) await loadModalSubdirs();
  const have = new Set(modalPanes.filter((x) => !x.kind).map((x) => x.dir));
  modalSubdirs.filter((d) => !have.has(d)).forEach((dir) => modalPanes.push({ dir, kind: '', arg: '' }));
  renderLaunch();
};
$('#preset-form').cwd.addEventListener('change', loadModalSubdirs);

/* Synchro ClickUp du preset (appliquée par le processus principal) */
const CU_SYNC_DEFAULTS = { enabled: false, logTime: true };
const renderCuSync = () => $('#cu-sync-fields').classList.toggle('off', !$('#preset-form').cuEnabled.checked);
$('#preset-form').cuEnabled.addEventListener('change', renderCuSync);
function formCuSync(f) {
  return { enabled: f.cuEnabled.checked, logTime: f.cuLogTime.checked };
}
$('#btn-cu-check').onclick = async () => {
  const f = $('#preset-form');
  const out = $('#cu-check-result');
  const names = [...new Set(kbColumns(editing, state.kanban.columns).map((c) => c.status).filter(Boolean))];
  out.className = '';
  out.textContent = 'Vérification…';
  const res = await api.clickupCheckStatuses(f.cwd.value.trim(), names);
  out.className = res.error || res.missing.length ? 'err' : 'ok';
  out.textContent = res.error
    || (res.missing.length ? `Introuvable dans « ${res.list} » : ${res.missing.join(', ')}. Statuts de la liste : ${res.statuses.join(', ')}`
      : names.length ? `Les statuts reliés existent dans « ${res.list} »` : `Aucun statut relié. Statuts de « ${res.list} » : ${res.statuses.join(', ')}`);
};

const closeModal = () => { $('#modal').classList.add('hidden'); focusActive(); };

$('#preset-form').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  const panes = modalPanes.map((x) => ({ dir: x.dir, cmd: paneCmd(x) }));
  // `command` reste la commande principale (celle utilisée pour lancer un skill sur le projet)
  const main = panes.find((x) => isClaudeCmd(x.cmd)) || panes[0];
  const data = { name: f.name.value.trim(), cwd: f.cwd.value.trim(), command: main.cmd, panes, layout: modalLayout, color: pickedColor, accountId: f.account.value === '__add' ? '' : f.account.value };
  const cu = formCuSync(f);
  // Synchro désactivée et réglages par défaut : rien d'enregistré, le preset reste comme avant
  if (cu.enabled || editing?.clickupSync || Object.keys(CU_SYNC_DEFAULTS).some((k) => k !== 'enabled' && cu[k] !== CU_SYNC_DEFAULTS[k])) data.clickupSync = cu;
  if (editing) Object.assign(editing, data);
  else state.presets.push({ id: uid(), ...data });
  if (data.accountId !== state.account) renderSpaceSwitch();
  state.presets.sort((a, b) => a.name.localeCompare(b.name));
  persist();
  renderPresets();
  closeModal();
  scanSkills();
  // Le projet, son dossier ou sa synchro ont pu changer : le tableau affiché en tient compte
  kanbanProjectsChanged();
};
$('#btn-cancel').onclick = closeModal;
$('#btn-browse').onclick = async () => {
  const dir = await api.pickFolder();
  if (!dir) return;
  const f = $('#preset-form');
  f.cwd.value = dir;
  if (!f.name.value) f.name.value = dir.split('/').pop();
  loadModalSubdirs();
};
$('#btn-add').onclick = () => openPresetModal();
$('#btn-import').onclick = async () => {
  const dir = await api.pickFolder();
  if (!dir) return;
  const known = new Set(spacePresets().map((p) => p.cwd));
  const dirs = (await api.subdirs(dir)).filter((d) => !known.has(d.path));
  dirs.forEach((d, i) => state.presets.push({ id: uid(), name: d.name, cwd: d.path, command: 'claude', color: COLORS[(state.presets.length + i) % COLORS.length], accountId: state.account }));
  state.presets.sort((a, b) => a.name.localeCompare(b.name));
  persist();
  renderPresets();
  kanbanProjectsChanged();
  scanSkills();
};
$('#btn-free').onclick = () => openTerminal({ name: 'shell', cwd: '~', command: '' });
$('#preset-filter').oninput = renderPresets;
$('#btn-layout').onclick = () => {
  const t = activeTab();
  if (!t) return;
  const g = t.group && groupTabs(t.group).length > 1 ? t.group : null;
  if (g) {
    if (g.split === 'tabs') g.split = 'grid';
    g.layout = g.layout === 'tabs' ? g.split : 'tabs';
  } else {
    // Réunit en grille tous les terminaux de l'espace
    if (spaceTabs().length > 1) newGroup('grid', spaceTabs());
  }
  applyLayout();
};

/* ---------- Skills ---------- */

// Syntaxe des modèles : {{cle}}, {{cle?}} facultatif, {{cle:long}} zone de texte, {{cle:a|b|c}} liste.
const PH = /\{\{\s*([\w-]+)(\?)?(?::([^}]*))?\s*\}\}/g;
const BUILTINS = ['project', 'cwd', 'date'];
const SOURCE_GROUPS = [['fav', 'Favoris'], ['custom', 'Mes modèles'], ['projet', 'Skills de projet'], ['perso', 'Skills perso'], ['plugin', 'Plugins'], ['claude.ai', 'claude.ai']];
const shq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const humanize = (k) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/[_-]/g, ' ');
const defaultTemplate = (s) => `/${s.invoke} {{arguments?}}`;
const presetFor = (cwd) => state.presets.find((p) => p.cwd === cwd);

function parseFields(tpl) {
  const fields = new Map();
  for (const [, key, opt, type] of tpl.matchAll(PH)) {
    if (BUILTINS.includes(key) || fields.has(key)) continue;
    fields.set(key, {
      key, optional: !!opt,
      type: !type ? 'text' : type.trim() === 'long' ? 'long' : 'select',
      options: type && type.trim() !== 'long' ? type.split('|').map((o) => o.trim()) : [],
    });
  }
  return [...fields.values()];
}

function fillTemplate(tpl, values) {
  return tpl.replace(PH, (_, key) => values[key] ?? '').replace(/[ \t]+$/gm, '').trim();
}

function allSkills() {
  const custom = state.customSkills.map((c) => ({ ...c, key: 'custom:' + c.id, invoke: c.name, source: 'custom', custom: true }));
  return [...custom, ...state.skills].map((s) => ({
    ...s,
    template: state.skillConfigs[s.key]?.template || s.template || defaultTemplate(s),
    fav: !!state.skillConfigs[s.key]?.fav,
  }));
}

function toggleFav(skill) {
  const cfg = { ...state.skillConfigs[skill.key] };
  if (cfg.fav) delete cfg.fav;
  else cfg.fav = true;
  state.skillConfigs[skill.key] = cfg;
  persist();
  renderSkills();
}

async function scanSkills() {
  state.skills = await api.scanSkills(spacePresets().map((p) => p.cwd), accountFor(state.account).dir);
  renderSkills();
}

function renderSkills() {
  const q = $('#skill-filter').value.trim().toLowerCase();
  const el = $('#skill-list');
  el.innerHTML = '';
  const skills = allSkills().filter((s) => !q || fuzzy(q, s.invoke) || s.description.toLowerCase().includes(q));
  for (const [source, label] of SOURCE_GROUPS) {
    // Un favori n'apparaît que dans le groupe Favoris
    const group = skills.filter((s) => (source === 'fav' ? s.fav : !s.fav && s.source === source));
    if (!group.length) continue;
    el.insertAdjacentHTML('beforeend', `<li class="group">${label}</li>`);
    for (const s of group) {
      const li = document.createElement('li');
      li.title = s.description;
      const project = s.project ? presetFor(s.project)?.name : '';
      if (s.fav) li.className = 'fav';
      li.innerHTML = `<span class="skill-icon">${icon('zap')}</span>
        <div class="info"><div class="name">${esc(s.name)}</div><div class="path">${esc(s.description || s.template)}</div></div>
        ${project ? `<span class="tag">${esc(project)}</span>` : ''}
        <div class="tools"><button data-a="edit" title="Modifier le modèle">${icon('pencil')}</button></div>
        <button class="star" data-a="fav" title="${s.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon('star', s.fav ? 'filled' : '')}</button>`;
      li.onclick = (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'fav') return toggleFav(s);
        if (a === 'edit') return openSkillEdit(s);
        openSkillRun(s, activeTab()?.presetId);
      };
      el.appendChild(li);
    }
  }
  if (!skills.length) el.innerHTML = '<li style="cursor:default;color:var(--muted)">Aucun skill trouvé.</li>';
}

function showSideView(view) {
  document.querySelectorAll('.side-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  $('#view-projects').classList.toggle('hidden', view !== 'projects');
  $('#view-skills').classList.toggle('hidden', view !== 'skills');
}

function closeOverlay(el) {
  el.classList.add('hidden');
  if (el.id === 'skill-run') runTask = null;
  // La fiche d'un ticket de l'inbox refermée : le tri au clavier continue
  if (el.id === 'ticket-view' && state.inbox.open) return $('#ib-list').focus();
  focusActive();
}

/* Lancement d'un skill */

let running = null;
// Lancement depuis une carte du kanban : on choisit aussi le skill, et la tâche remplit le premier champ
let runTask = null;
const PLAIN_TASK = { key: 'kanban:plain', name: 'Juste la tâche', description: 'Envoie la tâche telle quelle à Claude', template: '{{tache:long}}' };
const TASK_KEYS = ['arguments', 'tache', 'ticket', 'task', 'demande', 'sujet'];

function openTaskRun(task, presetId) {
  runTask = task;
  const skill = [PLAIN_TASK, ...allSkills()].find((s) => s.key === state.kanban.lastSkill) || PLAIN_TASK;
  openSkillRun(skill, presetId);
}

function renderRunSkills(current) {
  const skills = allSkills();
  const groups = SOURCE_GROUPS.map(([source, label]) => {
    const group = skills.filter((s) => (source === 'fav' ? s.fav : !s.fav && s.source === source));
    return group.length ? `<optgroup label="${label}">${group.map((s) => `<option value="${esc(s.key)}">${esc(s.name)}</option>`).join('')}</optgroup>` : '';
  });
  $('#skill-run-skill').innerHTML = `<option value="${PLAIN_TASK.key}">${PLAIN_TASK.name}</option>` + groups.join('');
  $('#skill-run-skill').value = current.key;
}

function openSkillRun(skill, presetId) {
  const presets = skill.project ? spacePresets().filter((p) => p.cwd === skill.project) : spacePresets();
  if (!presets.length) return openPresetModal();
  running = skill;
  const last = state.skillConfigs[skill.key]?.last;
  const sel = $('#skill-run-preset');
  // Sans terminal ouvert, on ne devine pas le projet : on le fait choisir (le dernier utilisé en tête)
  const ask = !presetId && presets.length > 1;
  const ordered = ask ? [...presets].sort((a, b) => (b.id === last?.presetId) - (a.id === last?.presetId)) : presets;
  sel.required = true;
  sel.innerHTML = (ask ? '<option value="" disabled selected>Choisis un projet…</option>' : '')
    + ordered.map((p) => `<option value="${p.id}">${esc(p.name)} — ${esc(shortPath(p.cwd))}${ask && p.id === last?.presetId ? ' (dernier utilisé)' : ''}</option>`).join('');
  sel.value = ask ? '' : (presets.find((p) => p.id === presetId) || presets.find((p) => p.id === last?.presetId) || presets[0]).id;
  const taskRef = runTask?.clickup ? runTask.clickup.customId || runTask.clickup.id : '';
  $('#skill-run-title').textContent = runTask ? `${taskRef ? `${taskRef} · ` : ''}${runTask.title}` : skill.name;
  $('#skill-run-form button[type=submit]').textContent = !runTask ? 'Lancer ⌘↵' : skill.key === PLAIN_TASK.key ? 'Envoyer à Claude ⌘↵' : `Lancer /${skill.invoke} ⌘↵`;
  $('#skill-run-desc').textContent = skill.description || skill.invoke;
  $('#skill-run-skill-wrap').classList.toggle('hidden', !runTask);
  // Depuis une carte : la fiche de la tâche d'abord, le lancement en dessous avec ses réglages repliés
  $('#skill-run-task').innerHTML = runTask ? kbTicketInfo(runTask) : '';
  $('#skill-run-task').scrollTop = 0;
  $('#skill-run-form').classList.toggle('with-task', !!runTask);
  $('#skill-run-sum').classList.toggle('hidden', !runTask);
  if (runTask) renderRunSkills(skill);
  $('#btn-skill-run-edit').classList.toggle('hidden', skill.key === PLAIN_TASK.key);

  const fieldsEl = $('#skill-run-fields');
  fieldsEl.innerHTML = '';
  for (const f of parseFields(skill.template)) {
    const label = document.createElement('label');
    label.innerHTML = `<span>${esc(humanize(f.key))}${f.optional ? ' <small>(facultatif)</small>' : ''}</span>`;
    let input;
    if (f.type === 'select') {
      input = document.createElement('select');
      input.innerHTML = f.options.map((o) => `<option>${esc(o)}</option>`).join('');
      if (f.options.includes(last?.values?.[f.key])) input.value = last.values[f.key];
    } else if (f.type === 'long') {
      input = document.createElement('textarea');
      input.rows = 4;
    } else {
      input = document.createElement('input');
    }
    input.dataset.key = f.key;
    input.required = !f.optional;
    input.spellcheck = false;
    if (f.key === 'arguments' && skill.argumentHint) input.placeholder = skill.argumentHint;
    label.appendChild(input);
    fieldsEl.appendChild(label);
  }

  let prefilled = null;
  if (runTask) {
    const inputs = [...fieldsEl.querySelectorAll('input[data-key], textarea[data-key]')];
    prefilled = TASK_KEYS.map((k) => inputs.find((i) => i.dataset.key === k)).find(Boolean) || inputs[0];
    if (prefilled) {
      const { title, description, id, clickup: cu } = runTask;
      const ref = cu ? cu.customId || cu.id : '';
      // L'id permet au skill de retrouver la carte pour la faire avancer
      if (prefilled.tagName === 'TEXTAREA') {
        prefilled.value = `${ref ? `Ticket ClickUp ${ref} : ` : ''}${title}${cu?.url ? `\n${cu.url}` : ''}${description ? `\n\n${description}` : ''}\n\n(tâche kanban ${id})`;
      } else if (ref) {
        // Un skill qui prend un ticket attend le numéro ; les autres reçoivent aussi le titre
        prefilled.value = prefilled.dataset.key === 'ticket' ? `${ref} (tâche kanban ${id})` : `${ref} ${title} (tâche kanban ${id})`;
      } else {
        prefilled.value = `${title}${description ? ` — ${description.replace(/\s+/g, ' ')}` : ''} (tâche kanban ${id})`;
      }
    }
  }

  renderRunTargets();
  updateRunPreview();
  $('#skill-run').classList.remove('hidden');
  // Depuis le kanban tout est prérempli : Entrée lance directement
  const firstEmpty = [...fieldsEl.querySelectorAll('[data-key]')].find((i) => i.required && !i.value);
  // Réglages repliés tant qu'il n'y a rien à compléter (un champ obligatoire caché bloquerait l'envoi)
  $('#skill-run-more').classList.toggle('folded', !!runTask && !ask && !firstEmpty);
  updateRunSummary();
  (ask ? sel : firstEmpty || (runTask ? null : fieldsEl.querySelector('[data-key]')) || $('#skill-run-form button[type=submit]')).focus();
}

function renderRunTargets() {
  const pid = $('#skill-run-preset').value;
  const tabs = state.tabs.filter((t) => t.presetId === pid && !t.exited);
  $('#skill-run-target').innerHTML = '<option value="new">Nouveau terminal Claude</option>'
    + tabs.map((t) => `<option value="${t.key}">Session ouverte : ${esc(t.title)}</option>`).join('');
}

// Résumé du lancement depuis une carte : où ça part, et de quoi déplier les réglages
function updateRunSummary() {
  if (!runTask) return;
  const p = state.presets.find((x) => x.id === $('#skill-run-preset').value);
  const target = $('#skill-run-target').selectedOptions[0]?.textContent || '';
  const folded = $('#skill-run-more').classList.contains('folded');
  $('#skill-run-sum').innerHTML = `Dans <b>${esc(p?.name || '…')}</b>, ${esc(target.charAt(0).toLowerCase() + target.slice(1))} · <button type="button" class="link" data-a="more">${folded ? 'Modifier le projet, la cible ou le prompt' : 'Replier'}</button>`;
}
$('#skill-run-sum').onclick = (e) => {
  if (!e.target.closest('[data-a="more"]')) return;
  $('#skill-run-more').classList.toggle('folded');
  updateRunSummary();
};

function runValues() {
  const p = state.presets.find((x) => x.id === $('#skill-run-preset').value);
  const values = { project: p?.name || '', cwd: p?.cwd || '', date: new Date().toISOString().slice(0, 10) };
  for (const i of $('#skill-run-fields').querySelectorAll('[data-key]')) values[i.dataset.key] = i.value.trim();
  return { p, values };
}

function updateRunPreview() {
  $('#skill-run-preview').textContent = fillTemplate(running.template, runValues().values);
}

$('#skill-run-form').addEventListener('input', (e) => { if (e.target.id !== 'skill-run-skill') updateRunPreview(); });
$('#skill-run-skill').addEventListener('change', (e) => {
  const skill = [PLAIN_TASK, ...allSkills()].find((s) => s.key === e.target.value);
  if (skill) openSkillRun(skill, $('#skill-run-preset').value);
});
$('#skill-run-preset').addEventListener('change', () => { renderRunTargets(); updateRunPreview(); updateRunSummary(); });
$('#skill-run-target').addEventListener('change', updateRunSummary);
$('#skill-run-form').onsubmit = (e) => {
  e.preventDefault();
  const { p, values } = runValues();
  if (!p) {
    const sel = $('#skill-run-preset');
    sel.setCustomValidity('Choisis le projet sur lequel lancer ce skill');
    sel.reportValidity();
    sel.addEventListener('change', () => sel.setCustomValidity(''), { once: true });
    return sel.focus();
  }
  const prompt = fillTemplate(running.template, values);
  if (runTask) state.kanban.lastSkill = running.key;
  // Les valeurs tirées d'une tâche ne servent pas de « dernière saisie » pour le skill
  else state.skillConfigs[running.key] = { ...state.skillConfigs[running.key], last: { presetId: p.id, values } };
  runTask = null;
  persist();
  closeOverlay($('#skill-run'));
  const tab = state.tabs.find((t) => t.key === $('#skill-run-target').value);
  if (tab) {
    activate(tab.key);
    sendToTab(tab, prompt);
  } else {
    openSession(p, { prompt, title: `${p.name} · ${running.name}` });
  }
};
$('#btn-skill-run-edit').onclick = () => {
  if (running.key === PLAIN_TASK.key) return;
  runTask = null;
  $('#skill-run').classList.add('hidden');
  openSkillEdit(running, $('#skill-run-preset').value);
};

/* Édition des modèles */

let editingSkill = null;
let editReturnPreset = null;

function openSkillEdit(skill, returnPreset = null) {
  editingSkill = skill || null;
  editReturnPreset = returnPreset;
  const f = $('#skill-edit-form');
  const isCustom = !skill || skill.custom;
  $('#skill-edit-title').textContent = skill ? `Modèle : ${skill.name}` : 'Nouveau skill personnalisé';
  f.name.value = skill?.name || '';
  f.description.value = skill?.description || '';
  f.name.readOnly = f.description.readOnly = !isCustom;
  f.template.value = skill?.template || '';
  f.template.placeholder = '/ticket {{ticket}}\n\nContexte : {{contexte?:long}}';
  const reset = $('#btn-skill-reset');
  reset.textContent = skill?.custom ? 'Supprimer' : 'Réinitialiser';
  reset.classList.toggle('hidden', !skill || (!skill.custom && !state.skillConfigs[skill.key]?.template));
  renderEditFields();
  $('#skill-edit').classList.remove('hidden');
  (isCustom && !skill ? f.name : f.template).focus();
}

function renderEditFields() {
  const fields = parseFields($('#skill-edit-form').template.value);
  $('#skill-edit-fields').textContent = fields.length
    ? 'Champs demandés au lancement : ' + fields.map((f) => humanize(f.key) + (f.optional ? ' (facultatif)' : '')).join(', ')
    : 'Aucun champ : le prompt est envoyé tel quel.';
}

function afterSkillEdit(key) {
  persist();
  renderSkills();
  closeOverlay($('#skill-edit'));
  const skill = key && allSkills().find((s) => s.key === key);
  if (skill && editReturnPreset) openSkillRun(skill, editReturnPreset);
}

$('#skill-edit-form').template.addEventListener('input', renderEditFields);
$('#skill-edit-form').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  const data = { name: f.name.value.trim(), description: f.description.value.trim(), template: f.template.value.trim() };
  let key = editingSkill?.key;
  if (!editingSkill) {
    const id = uid();
    state.customSkills.push({ id, ...data });
    key = 'custom:' + id;
  } else if (editingSkill.custom) {
    Object.assign(state.customSkills.find((c) => 'custom:' + c.id === key), data);
  } else {
    const cfg = { ...state.skillConfigs[key], template: data.template };
    if (data.template === defaultTemplate(editingSkill)) delete cfg.template;
    state.skillConfigs[key] = cfg;
  }
  afterSkillEdit(key);
};
$('#btn-skill-reset').onclick = () => {
  const key = editingSkill.key;
  if (editingSkill.custom) {
    if (!confirm(`Supprimer le skill « ${editingSkill.name} » ?`)) return;
    state.customSkills = state.customSkills.filter((c) => 'custom:' + c.id !== key);
    delete state.skillConfigs[key];
    editReturnPreset = null;
  } else {
    delete state.skillConfigs[key]?.template;
  }
  afterSkillEdit(key);
};

document.querySelectorAll('.side-tabs button').forEach((b) => { b.onclick = () => showSideView(b.dataset.view); });
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => closeOverlay(b.closest('.overlay')); });
for (const id of ['#skill-run', '#skill-edit']) {
  $(id).addEventListener('mousedown', (e) => { if (e.target === $(id)) closeOverlay($(id)); });
}
$('#skill-filter').oninput = renderSkills;
$('#btn-skills-rescan').onclick = scanSkills;
$('#btn-skill-add').onclick = () => openSkillEdit();

/* ---------- Panneau de diff ---------- */

function parseDiff(patch) {
  const files = [];
  let f = null;
  let oldN = 0;
  let newN = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      f = { path: (line.match(/ b\/(.*)$/) || [])[1] || line, status: 'M', hunks: [], add: 0, del: 0, binary: false };
      files.push(f);
    } else if (!f) {
      continue;
    } else if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
      oldN = +(m?.[1] || 0);
      newN = +(m?.[2] || 0);
      f.hunks.push({ header: line, lines: [] });
    } else if (f.hunks.length) {
      const lines = f.hunks[f.hunks.length - 1].lines;
      const c = line[0];
      if (c === '+') { lines.push({ t: 'add', n2: newN++, s: line.slice(1) }); f.add++; }
      else if (c === '-') { lines.push({ t: 'del', n1: oldN++, s: line.slice(1) }); f.del++; }
      else if (c === ' ') lines.push({ t: 'ctx', n1: oldN++, n2: newN++, s: line.slice(1) });
    } else if (line.startsWith('new file')) f.status = 'A';
    else if (line.startsWith('deleted file')) f.status = 'D';
    else if (line.startsWith('rename from ')) { f.status = 'R'; f.from = line.slice(12); }
    else if (line.startsWith('rename to ')) f.path = line.slice(10);
    else if (line.startsWith('Binary files')) f.binary = true;
  }
  return files;
}

let diffSeq = 0;
let diffTimer = null;

// Regroupe les rafales de changements (activation d'onglet + notification du watcher)
function refreshDiff() {
  clearTimeout(diffTimer);
  diffTimer = setTimeout(loadDiff, 50);
}

async function loadDiff() {
  const t = activeTab();
  const seq = ++diffSeq;
  if (!t?.git) {
    $('#side-diff-count').textContent = '';
    return renderDiff(t, null);
  }
  const patches = await api.gitDiff(t.git.repos, state.diff.scope === 'session');
  if (seq !== diffSeq) return;
  const before = JSON.stringify(t.branches);
  t.branches = patches.filter((p) => p.branch).map((p) => ({ name: p.name, branch: p.branch }));
  if (JSON.stringify(t.branches) !== before) renderPresets();
  // Plusieurs dépôts (ex. front/ et back/) : chaque chemin est préfixé par son dépôt
  const files = patches.flatMap(({ name, patch }) =>
    parseDiff(patch).map((f) => ({ ...f, repo: name, path: name ? `${name}/${f.path}` : f.path })));
  if (!files.length) t.diffDismissed = false;
  // L'ouverture auto ne prend pas la place du kanban : le compteur de l'onglet suffit
  else if (state.diff.auto && !t.diffDismissed && !state.diff.open && !state.kanban.open && !state.inbox.open && !state.times.open) setDiffOpen(true);
  $('#side-diff-count').textContent = files.length || '';
  renderDiff(t, files);
}

// Diff, kanban, inbox et temps partagent le panneau de droite : un seul visible à la fois, choisi par onglet
function updateSidePanel() {
  const open = state.diff.open || state.kanban.open || state.inbox.open || state.times.open;
  $('#side-panel').classList.toggle('hidden', !open);
  $('#side-resizer').classList.toggle('hidden', !open);
  // Tableau agrandi : il ne laisse aux terminaux que le minimum, le temps d'une réorganisation
  const wide = state.side.wide && state.kanban.open;
  $('#side-panel').style.width = (wide ? Math.max(state.side.width, $('#workspace').offsetWidth - 320) : state.side.width) + 'px';
  document.querySelectorAll('#side-tabs button').forEach((b) => b.classList.toggle('on', state[b.dataset.side].open));
  $('#btn-side').classList.toggle('on', open);
  // Retenu pour le bouton du panneau : il rouvre le dernier onglet affiché
  state.side.last = SIDE_TABS.find((k) => state[k].open) || state.side.last;
  requestAnimationFrame(() => state.tabs.forEach(fitTab));
}

// Un seul bouton en haut à droite pour le panneau : les onglets choisissent ce qu'il affiche
const SIDE_TABS = ['diff', 'kanban', 'inbox', 'times'];
function toggleSide() {
  const cur = SIDE_TABS.find((k) => state[k].open);
  // Le dernier onglet affiché a pu être masqué depuis : les modifications, toujours là
  const k = cur || (feat(state.side.last) ? state.side.last : 'diff');
  if (k === 'inbox') setInboxOpen(!cur);
  else if (k === 'times') setTimesOpen(!cur);
  else if (k === 'kanban') setKanbanOpen(!cur);
  else toggleDiff();
}
$('#btn-side').onclick = toggleSide;

function setDiffOpen(open) {
  if (open && state.kanban.open) setKanbanOpen(false);
  if (open && state.inbox.open) setInboxOpen(false);
  if (open && state.times.open) setTimesOpen(false);
  state.diff.open = open;
  $('#diff-panel').classList.toggle('hidden', !open);
  updateSidePanel();
}

function toggleDiff() {
  const t = activeTab();
  if (state.diff.open) {
    if (t) t.diffDismissed = true;
    setDiffOpen(false);
  } else {
    if (t) t.diffDismissed = false;
    setDiffOpen(true);
    refreshDiff();
  }
}

const ln = (n) => `<td class="ln">${n ?? ''}</td>`;

function renderDiff(t, files) {
  $('#diff-project').textContent = t ? t.title : '';
  const branches = (t?.git && t.branches) || [];
  $('#diff-branch').innerHTML = branches.map((b) => `${icon('branch')}${b.name ? `<span class="repo">${esc(b.name)}</span> ` : ''}${esc(b.branch)}`).join(' ');
  $('#diff-branch').title = branches.map((b) => (b.name ? `${b.name} : ` : '') + b.branch).join('\n');
  const body = $('#diff-body');
  const list = $('#diff-files');
  const scrollTop = body.scrollTop;
  list.innerHTML = '';
  let msg = '';
  if (!t) msg = 'Aucun terminal ouvert.';
  else if (!t.git) msg = 'Aucun dépôt git dans ce dossier ni dans ses sous-dossiers.';
  else if (!files.length) msg = state.diff.scope === 'session' ? "Aucune modification depuis l'ouverture de l'onglet." : 'Aucune modification non commitée.';
  if (msg) {
    $('#diff-stats').textContent = '';
    body.innerHTML = `<div class="diff-empty">${msg}</div>`;
    return;
  }

  const add = files.reduce((n, f) => n + f.add, 0);
  const del = files.reduce((n, f) => n + f.del, 0);
  $('#diff-stats').innerHTML = `${files.length} fichier${files.length > 1 ? 's' : ''} <span class="add">+${add}</span> <span class="del">−${del}</span>`;

  let html = '';
  files.forEach((f, i) => {
    const slash = f.path.lastIndexOf('/');
    const name = `<span class="dir">${esc(f.path.slice(0, slash + 1))}</span>${esc(f.path.slice(slash + 1))}`;
    const collapsed = state.diff.collapsed.has(f.path);
    let rows = '';
    let count = 0;
    if (f.binary) rows = '<tr class="hunk"><td colspan="3">Fichier binaire</td></tr>';
    for (const h of f.hunks) {
      if (count > 2000) break;
      rows += `<tr class="hunk"><td colspan="3">${esc(h.header)}</td></tr>`;
      for (const l of h.lines) {
        if (++count > 2000) { rows += '<tr class="hunk"><td colspan="3">… diff tronqué</td></tr>'; break; }
        const sign = l.t === 'add' ? '+' : l.t === 'del' ? '-' : ' ';
        rows += `<tr class="${l.t}">${ln(l.n1)}${ln(l.n2)}<td class="code"><span class="sign">${sign}</span>${esc(l.s)}</td></tr>`;
      }
    }
    html += `<div class="dfile${collapsed ? ' collapsed' : ''}" id="dfile-${i}" data-path="${esc(f.path)}">
      <div class="dfile-head"><span class="caret">${icon('chevron-down')}</span><span class="st st-${f.status}">${f.status}</span>
        <span class="dpath" title="${esc(f.from ? f.from + ' → ' + f.path : f.path)}">${name}</span>
        <span class="dstat"><span class="add">+${f.add}</span> <span class="del">−${f.del}</span></span></div>
      <table class="dt"><colgroup><col class="c-ln"><col class="c-ln"><col></colgroup>${rows}</table></div>`;
    const chip = document.createElement('button');
    chip.className = `chip st-${f.status}`;
    chip.textContent = (f.repo ? f.repo + ' · ' : '') + f.path.slice(slash + 1);
    chip.title = f.path;
    chip.onclick = () => {
      state.diff.collapsed.delete(f.path);
      const el = $(`#dfile-${i}`);
      el.classList.remove('collapsed');
      el.scrollIntoView({ block: 'start' });
    };
    list.appendChild(chip);
  });
  body.innerHTML = html;
  body.scrollTop = scrollTop;
}

$('#diff-body').addEventListener('click', (e) => {
  const head = e.target.closest('.dfile-head');
  if (!head) return;
  const file = head.parentElement;
  file.classList.toggle('collapsed');
  if (file.classList.contains('collapsed')) state.diff.collapsed.add(file.dataset.path);
  else state.diff.collapsed.delete(file.dataset.path);
});
$('#diff-collapse').onclick = () => {
  const files = [...document.querySelectorAll('.dfile')];
  const collapse = files.some((f) => !f.classList.contains('collapsed'));
  for (const f of files) {
    f.classList.toggle('collapsed', collapse);
    if (collapse) state.diff.collapsed.add(f.dataset.path);
    else state.diff.collapsed.delete(f.dataset.path);
  }
};
$('#diff-close').onclick = toggleDiff;
$('#diff-refresh').onclick = refreshDiff;
$('#diff-scope').onchange = (e) => { state.diff.scope = e.target.value; persist(); refreshDiff(); };
$('#diff-auto').onchange = (e) => { state.diff.auto = e.target.checked; persist(); };
api.onGitChanged((root) => { if (activeTab()?.git?.repos.some((r) => r.root === root)) refreshDiff(); });

document.querySelectorAll('#side-tabs button').forEach((b) => b.onclick = () => {
  if (b.dataset.side === 'kanban') return state.kanban.open || setKanbanOpen(true);
  if (b.dataset.side === 'inbox') return state.inbox.open || setInboxOpen(true);
  if (b.dataset.side === 'times') return state.times.open || setTimesOpen(true);
  if (!state.diff.open) toggleDiff();
});

$('#side-resizer').addEventListener('mousedown', (e) => {
  e.preventDefault();
  const right = $('#workspace').getBoundingClientRect().right;
  const max = $('#workspace').offsetWidth - 320;
  document.body.classList.add('resizing');
  const move = (ev) => {
    state.side.width = Math.max(320, Math.min(max, right - ev.clientX));
    $('#side-panel').style.width = state.side.width + 'px';
  };
  const up = () => {
    document.body.classList.remove('resizing');
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    persist();
    state.tabs.forEach(fitTab);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

/* ---------- Notifications ---------- */

// Discrète par défaut ; une erreur reste plus longtemps et se ferme d'un clic.
// action : { label, run } ajoute un bouton (« Annuler »…) et laisse le temps de s'en servir
function toast(text, kind = '', action = null) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${kind === 'err' ? icon('x') : icon('check')}<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  el.onclick = (e) => {
    if (action && e.target.closest('button')) action.run();
    el.remove();
  };
  $('#toasts').appendChild(el);
  const stay = kind === 'err' ? 9000 : action ? 6000 : 2500;
  setTimeout(() => el.classList.add('out'), stay);
  setTimeout(() => el.remove(), stay + 400);
}

// Petit menu au clic droit : items = [{ label, run }], refermé au premier clic ou à Échap
function contextMenu(e, items) {
  document.querySelector('.ctx-menu')?.remove();
  if (!items.length) return;
  const el = document.createElement('div');
  el.className = 'ctx-menu';
  el.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${esc(it.label)}</button>`).join('');
  document.body.appendChild(el);
  el.style.left = `${Math.min(e.clientX, window.innerWidth - el.offsetWidth - 8)}px`;
  el.style.top = `${Math.min(e.clientY, window.innerHeight - el.offsetHeight - 8)}px`;
  const close = (ev) => {
    if (ev.type === 'keydown' && ev.key !== 'Escape') return;
    const i = ev.type === 'mousedown' && ev.target.closest?.('.ctx-menu button')?.dataset.i;
    el.remove();
    window.removeEventListener('mousedown', close, true);
    window.removeEventListener('keydown', close, true);
    if (i != null && i !== false) items[+i].run();
  };
  window.addEventListener('mousedown', close, true);
  window.addEventListener('keydown', close, true);
}

/* Raccourcis clavier : la liste complète, ouverte par ⌘/ ou le rappel en bas de la barre latérale */
const KEYS = [
  ['⌘K', 'Lancer un projet, aller à un onglet, changer de thème'], ['⌘J', 'Lancer un skill sur le projet actif'], ['⌘L', 'Écrire un prompt'],
  ['⌘T', 'Nouveau terminal'], ['⌘W', 'Fermer l\'onglet'], ['⌘1-9', 'Aller à un onglet'], ['⌘G', 'Onglets ou grille'],
  ['⌘D', 'Modifications'], ['⌘B', 'Kanban', 'kanban'], ['⌘I', 'Inbox ClickUp', 'inbox'],
  ['Kanban', 'Tab pour atteindre une carte, ← → pour la changer de colonne, ↵ pour l\'ouvrir, clic droit pour la déplacer ou la changer de projet', 'kanban'],
  ['Inbox', 'J K pour naviguer, ↵ pour prendre le ticket, E pour l\'ignorer, Espace pour le détail, Z pour annuler', 'inbox'],
];
// Le troisième élément est la fonction facultative dont dépend le raccourci
function openKeys() {
  $('#keys-list').innerHTML = KEYS.filter(([, , f]) => !f || feat(f)).map(([k, what]) => `<dt><kbd>${k}</kbd></dt><dd>${esc(what)}</dd>`).join('');
  $('#keys').classList.remove('hidden');
}
$('#btn-keys').onclick = openKeys;

/* ---------- Paramètres ---------- */

async function renderClickupStatus(res) {
  res ||= await api.clickupStatus();
  const st = $('#cu-status');
  st.className = res.error ? 'err' : res.configured ? 'ok' : '';
  st.textContent = res.error ? res.error : res.configured ? `connecté${res.user ? ` · ${res.user}` : ''}` : 'non configuré';
  $('#cu-remove').classList.toggle('hidden', !res.configured);
  $('#cu-token').placeholder = res.configured ? 'Nouvelle clé pk_… (la clé actuelle est enregistrée)' : 'pk_…';
}

/* Fonctions facultatives : chacun choisit ce qu'il veut dans l'app (onglet « Fonctionnalités »). Une
   nouvelle installation commence sans aucune ; ce qui n'est pas coché disparaît de l'interface, sans
   rien supprimer. */
const FEATURES = [
  ['kanban', 'Kanban', 'Un tableau de tâches pour tous les projets, relié à Claude et aux tickets ClickUp (⌘B).'],
  ['inbox', 'Inbox ClickUp', 'Les tickets à trier des listes ClickUp suivies, à ranger dans le kanban (⌘I). Demande le kanban et une clé ClickUp.'],
  ['times', 'Temps', 'Les temps loggés dans ClickUp, jour par jour face à l\'objectif, et la jauge du jour dans la barre du haut. Demande une clé ClickUp.'],
  ['accounts', 'Plusieurs comptes Claude', 'Un espace par compte (pro, perso…), chacun avec ses projets, ses onglets et ses skills.'],
];
// Affiche ou masque ce qui dépend des fonctions facultatives
function applyFeatures() {
  const side = { kanban: setKanbanOpen, inbox: setInboxOpen, times: setTimesOpen };
  for (const [k, setOpen] of Object.entries(side)) {
    $(`#side-tabs [data-side="${k}"]`).classList.toggle('hidden', !feat(k));
    if (!feat(k) && state[k].open) setOpen(false);
  }
  $('#btn-side').title = `Panneau de droite : modifications (⌘D)${feat('kanban') ? ', kanban (⌘B)' : ''}${feat('inbox') ? ', inbox (⌘I)' : ''}${feat('times') ? ', temps' : ''}`;
  $('#settings-tabs [data-tab="accounts"]').classList.toggle('hidden', !feat('accounts'));
  // La clé ClickUp sert au kanban, à l'inbox et aux temps
  $('#settings-tabs [data-tab="clickup"]').classList.toggle('hidden', !feat('kanban') && !feat('inbox') && !feat('times'));
  $('#settings-tabs [data-tab="inbox"]').classList.toggle('hidden', !feat('inbox'));
  $('#preset-tabs [data-tab="clickup"]').classList.toggle('hidden', !feat('kanban'));
  $('#preset-account').closest('label').classList.toggle('hidden', !feat('accounts'));
  $('#space-switch').classList.toggle('hidden', !feat('accounts'));
  $('#empty-features').classList.toggle('hidden', FEATURES.some(([k]) => feat(k)));
}

function setFeature(k, on) {
  state.features[k] = on;
  // L'inbox range ses tickets dans le kanban : elle ne va pas sans lui
  if (k === 'inbox' && on) state.features.kanban = true;
  if (k === 'kanban' && !on) state.features.inbox = false;
  persist();
  applyFeatures();
  if (k === 'accounts') {
    // Sans les comptes, les projets et les onglets de tous les espaces sont réunis
    if (!on && state.account) switchSpace('');
    for (const t of state.tabs) t.wrap.classList.toggle('away', !inSpace(t));
    renderSpaceSwitch();
    renderPresets();
    renderTabs();
    applyLayout();
    scanSkills();
  }
  if (k === 'times') refreshToday();
  renderFeatures();
  $(`#features-list [data-feat="${k}"]`).focus();
}

function renderFeatures() {
  $('#features-list').innerHTML = FEATURES.map(([k, name, desc]) => `<label class="feature"><input type="checkbox" data-feat="${k}"${feat(k) ? ' checked' : ''}><span><b>${name}</b><small>${esc(desc)}</small></span></label>`).join('');
}
$('#features-list').addEventListener('change', (e) => {
  if (e.target.dataset?.feat) setFeature(e.target.dataset.feat, e.target.checked);
});
$('#btn-features').onclick = () => openSettings('features');

// Paramètres en onglets : apparence (thème, fond, son), fonctionnalités, comptes Claude, ClickUp, inbox
let settingsTab = 'look';
function showSettingsTab(tab) {
  // Onglet d'une fonction masquée depuis : on revient au premier
  if ($(`#settings-tabs [data-tab="${tab}"]`)?.classList.contains('hidden') !== false) tab = 'look';
  settingsTab = tab;
  document.querySelectorAll('#settings-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('#settings .settings-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== tab));
  if (tab === 'look') renderThemePop();
  else if (tab === 'features') renderFeatures();
  else if (tab === 'accounts') {
    renderAccounts();
    $('#account-form').name.focus();
  } else if (tab === 'inbox') openInboxSettings();
  else {
    $('#cu-token').value = '';
    $('#cu-status').textContent = '…';
    $('#cu-token').focus();
    renderClickupStatus();
  }
}
// Sans onglet précisé, le dernier affiché
function openSettings(tab = settingsTab) {
  $('#settings').classList.remove('hidden');
  showSettingsTab(tab);
}

$('#btn-settings').onclick = () => openSettings();
$('#settings-tabs').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) showSettingsTab(b.dataset.tab);
};
$('#settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeOverlay($('#settings')); });
$('#settings-form').onsubmit = async (e) => {
  e.preventDefault();
  const token = $('#cu-token').value.trim();
  if (!token) return;
  $('#cu-status').textContent = 'vérification…';
  const res = await api.clickupSetToken(token);
  if (!res.error) $('#cu-token').value = '';
  renderClickupStatus(res);
};
$('#cu-remove').onclick = async () => renderClickupStatus(await api.clickupSetToken(''));

/* ---------- Thèmes ---------- */

function applyTheme(name) {
  state.theme = THEMES[name] ? name : 'nuit';
  const th = currentTheme();
  document.body.dataset.theme = state.theme;
  $('#prompt').placeholder = th.placeholder;
  updatePromptBar();
  api.setWindowBg(th.winBg);
  for (const t of state.tabs) if (t.term) Object.assign(t.term.options, termOptions(th));
  requestAnimationFrame(() => state.tabs.forEach(fitTab));
  renderThemePop();
}

// Onglet « Apparence » des paramètres : une grille de vignettes, puis le fond et le son
function renderThemePop() {
  const b = state.bg;
  $('#theme-pop').innerHTML = `
    <div class="tp-head">Thème</div>
    <div class="tp-grid">${Object.entries(THEMES).map(([key, th]) => `
      <button class="tp-tile${key === state.theme ? ' on' : ''}" data-theme="${key}" title="${esc(th.desc)}">
        <span class="tp-prev" style="background:${th.swatches[0]}">
          <i style="background:${th.swatches[1]}"></i><em style="background:${th.swatches[2]}"></em><u style="background:${th.swatches[3]}"></u>
        </span>
        <span class="tp-name">${th.label}</span>
      </button>`).join('')}
    </div>
    <div class="tp-head">Fond</div>
    <div class="seg tp-kind">${[['', 'Thème'], ['color', 'Couleur'], ['image', 'Image']].map(([v, l]) => `<button data-kind="${v}" class="${b.kind === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${b.kind === 'color' ? `<label class="tp-row">Couleur <input type="color" id="bg-color" value="${b.color}"></label>` : ''}
    ${b.kind === 'image' ? `<div class="tp-row"><button id="bg-pick">${b.image ? 'Changer l’image…' : 'Choisir une image…'}</button><span class="tp-file">${esc(b.imageName || '')}</span></div>` : ''}
    ${b.kind ? `
      <label class="tp-row">Opacité des panneaux <input type="range" id="bg-opacity" min="15" max="100" value="${b.opacity}"><span>${b.opacity}%</span></label>
      ${b.kind === 'image' ? `<label class="tp-row">Flou <input type="range" id="bg-blur" min="0" max="30" value="${b.blur}"><span>${b.blur}px</span></label>` : ''}` : ''}
    <div class="tp-head">Son quand Claude a fini</div>
    <div class="seg tp-sound">${[['', 'Aucun'], ...Object.entries(SOUNDS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button data-sound="${k}" class="${state.sound.name === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="tp-row">Sons du Mac <select id="snd-mac" class="${state.sound.name?.startsWith('mac:') ? 'on' : ''}">
      <option value="">—</option>
      ${Object.entries(MAC_SOUNDS).sort((a, b) => a[1].localeCompare(b[1])).map(([k, l]) => `<option value="mac:${k}"${state.sound.name === `mac:${k}` ? ' selected' : ''}>${l}</option>`).join('')}
    </select></label>
    ${state.sound.name ? `<label class="tp-row">Volume <input type="range" id="snd-vol" min="5" max="100" value="${state.sound.volume}"><span>${state.sound.volume}%</span></label>` : ''}`;
}

const bgCache = {};
async function applyBg() {
  const b = state.bg;
  const layer = $('#bg-layer');
  document.body.classList.toggle('has-bg', hasBg());
  document.body.style.setProperty('--panel-alpha', `${b.opacity}%`);
  layer.style.background = b.kind === 'color' ? b.color : '';
  if (b.kind === 'image' && b.image) {
    bgCache[b.image] ||= await api.bgRead(b.image);
    if (bgCache[b.image]) layer.style.background = `center / cover no-repeat url("${bgCache[b.image]}")`;
  }
  layer.style.filter = b.kind === 'image' && b.blur ? `blur(${b.blur}px)` : '';
  layer.style.inset = b.kind === 'image' && b.blur ? `-${b.blur * 2}px` : '0';
  const th = currentTheme();
  for (const t of state.tabs) if (t.term) Object.assign(t.term.options, termOptions(th));
}

let bgSaveTimer;
const saveBgSoon = () => { clearTimeout(bgSaveTimer); bgSaveTimer = setTimeout(persist, 300); };

$('#theme-pop').addEventListener('click', async (e) => {
  const tile = e.target.closest('.tp-tile');
  if (tile) {
    applyTheme(tile.dataset.theme);
    applyBg();
    return persist();
  }
  const kind = e.target.closest('[data-kind]');
  if (kind) {
    state.bg.kind = kind.dataset.kind;
    if (state.bg.kind === 'image' && !state.bg.image) return pickBg();
    renderThemePop();
    applyBg();
    return persist();
  }
  if (e.target.id === 'bg-pick') pickBg();
  const snd = e.target.closest('[data-sound]');
  if (snd) {
    state.sound.name = snd.dataset.sound;
    playSound(state.sound.name);
    renderThemePop();
    persist();
  }
});
async function pickBg() {
  renderThemePop();
  const res = await api.bgPick();
  if (res) Object.assign(state.bg, { kind: 'image', image: res.path, imageName: res.name });
  else if (!state.bg.image) state.bg.kind = '';
  renderThemePop();
  applyBg();
  persist();
}
$('#theme-pop').addEventListener('input', (e) => {
  const v = e.target.value;
  if (e.target.id === 'bg-color') state.bg.color = v;
  if (e.target.id === 'bg-opacity') state.bg.opacity = +v;
  if (e.target.id === 'bg-blur') state.bg.blur = +v;
  if (e.target.id === 'snd-mac') {
    if (!v) return;
    state.sound.name = v;
    playSound(v);
    renderThemePop();
    return persist();
  }
  if (e.target.id === 'snd-vol') {
    state.sound.volume = +v;
    e.target.nextElementSibling.textContent = `${v}%`;
    clearTimeout(bgSaveTimer);
    bgSaveTimer = setTimeout(() => { persist(); playSound(state.sound.name); }, 250);
    return;
  }
  const out = e.target.nextElementSibling;
  if (out?.tagName === 'SPAN') out.textContent = e.target.id === 'bg-blur' ? `${v}px` : `${v}%`;
  applyBg();
  saveBgSoon();
});

/* ---------- Barre de prompt ---------- */

function sendPrompt() {
  const ta = $('#prompt');
  const text = ta.value.replace(/\s+$/, '');
  if (!text) return;
  // Une conversation en pause se reprend toute seule au prochain message
  const alive = (t) => t && (!t.exited || t.kind === 'chat');
  const targets = $('#prompt-target').value === 'all' ? spaceTabs().filter(alive) : [activeTab()].filter(alive);
  if (!targets.length) {
    if (!activeTab()) pickProjectFor(text);
    return;
  }
  targets.forEach((t) => sendToTab(t, text));
  ta.value = '';
  closePromptBar();
  autoGrow();
  focusActive();
}

// Aucun terminal ouvert : on demande sur quel projet lancer le prompt (ou le skill)
function pickProjectFor(text) {
  if (!spacePresets().length) return openPresetModal();
  const m = text.trim().match(/^\/(\S+)\s*([\s\S]*)$/);
  const skill = m && allSkills().find((sk) => sk.invoke === m[1]);
  // « /skill » seul : la fenêtre du skill demande le projet et les infos nécessaires
  if (skill && !m[2]) {
    $('#prompt').value = '';
    autoGrow();
    closePromptBar();
    return openSkillRun(skill);
  }
  const short = text.length > 50 ? text.slice(0, 50) + '…' : text;
  openPalette({
    mode: 'pick',
    title: `Lancer « ${short} » sur quel projet ?`,
    onPick: (p) => {
      $('#prompt').value = '';
      autoGrow();
      closePromptBar();
      openSession(p, { prompt: text, title: skill ? `${p.name} · ${skill.name}` : undefined });
    },
  });
}

function sendToTab(t, text) {
  if (t.kind === 'chat') return chatSend(t, text);
  // paste() gère le bracketed paste : un prompt multi-ligne arrive en un seul bloc dans Claude Code.
  t.term.paste(text);
  if (t.cstate === 'waiting') setClaudeState(t, null);
  setTimeout(() => api.write(t.ptyId, '\r'), 120);
}

// En vue terminal, la barre de prompt est masquée pour laisser la place aux terminaux :
// ⌘L l'ouvre, Échap ou l'envoi la referme. Elle reste affichée en vue conversation.
let promptOpen = false;
function updatePromptBar() {
  const show = !!currentTheme().chat || activeTab()?.kind === 'chat' || promptOpen;
  const bar = $('#promptbar');
  if (bar.classList.contains('hidden') !== show) return;
  bar.classList.toggle('hidden', !show);
  requestAnimationFrame(() => state.tabs.forEach(fitTab));
}
function openPromptBar() {
  promptOpen = true;
  updatePromptBar();
  $('#prompt').focus();
}
function closePromptBar() {
  promptOpen = false;
  $('#snippets').classList.add('hidden');
  updatePromptBar();
}

function autoGrow() {
  const ta = $('#prompt');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight + 2, 200) + 'px';
}

$('#prompt').addEventListener('input', autoGrow);
$('#prompt').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || (currentTheme().chat && !e.shiftKey && !e.isComposing))) { e.preventDefault(); sendPrompt(); }
  if (e.key === 'Escape') { closePromptBar(); focusActive(); }
});
$('#btn-send').onclick = sendPrompt;

$('#btn-save-snippet').onclick = () => {
  const text = $('#prompt').value.trim();
  if (!text) return;
  state.prompts.unshift({ id: uid(), text });
  persist();
  renderSnippets();
};
$('#btn-snippets').onclick = (e) => { e.stopPropagation(); renderSnippets(); $('#snippets').classList.toggle('hidden'); };
document.addEventListener('click', (e) => { if (!$('#snippets').contains(e.target)) $('#snippets').classList.add('hidden'); });

function renderSnippets() {
  const el = $('#snippets');
  el.innerHTML = state.prompts.length ? '' : '<div class="empty">Aucun prompt enregistré. Écris un prompt puis clique sur l’étoile.</div>';
  for (const s of state.prompts) {
    const d = document.createElement('div');
    d.className = 'item';
    d.title = s.text;
    d.innerHTML = `<span>${esc(s.text.split('\n')[0])}</span><button title="Supprimer">${icon('x')}</button>`;
    d.onclick = () => { $('#prompt').value = s.text; autoGrow(); el.classList.add('hidden'); $('#prompt').focus(); };
    d.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      state.prompts = state.prompts.filter((x) => x.id !== s.id);
      persist();
      renderSnippets();
    };
    el.appendChild(d);
  }
}

/* ---------- Palette (⌘K) ---------- */

let paletteItems = [];
let paletteSel = 0;
let paletteCtx = {};

function openPalette(ctx = {}) {
  paletteCtx = ctx;
  paletteSel = 0;
  $('#palette').classList.remove('hidden');
  $('#palette-input').value = '';
  const p = state.presets.find((x) => x.id === ctx.presetId);
  $('#palette-input').placeholder = ctx.mode === 'pick' ? ctx.title : ctx.mode === 'skills'
    ? `Lancer un skill${p ? ' sur ' + p.name : ''}…`
    : 'Lancer un projet, un skill ou aller à un onglet…';
  renderPalette();
  $('#palette-input').focus();
}
const closePalette = () => { $('#palette').classList.add('hidden'); focusActive(); };

function fuzzy(q, s) {
  s = s.toLowerCase();
  let i = 0;
  for (const c of q) { i = s.indexOf(c, i); if (i < 0) return false; i++; }
  return true;
}

function renderPalette() {
  const q = $('#palette-input').value.trim().toLowerCase();
  const skillItems = allSkills()
    .filter((s) => !paletteCtx.presetId || !s.project || s.project === state.presets.find((p) => p.id === paletteCtx.presetId)?.cwd)
    .sort((a, b) => b.fav - a.fav)
    .map((s) => ({ kind: s.fav ? 'Skill favori' : 'Skill', label: s.name, sub: s.invoke !== s.name ? s.invoke : s.source, color: 'var(--accent)', run: () => openSkillRun(s, paletteCtx.presetId) }));
  const pickItems = spacePresets().map((p) => ({ kind: 'Lancer ici', label: p.name, sub: shortPath(p.cwd), color: p.color, run: () => paletteCtx.onPick(p) }));
  paletteItems = (paletteCtx.mode === 'pick' ? pickItems : paletteCtx.mode === 'skills' ? skillItems : [
    ...spacePresets().map((p) => ({ kind: 'Lancer', label: p.name, sub: shortPath(p.cwd), color: p.color, run: () => launchPreset(p) })),
    ...spaceTabs().map((t) => ({ kind: 'Onglet', label: t.title, sub: shortPath(t.cwd), color: t.color, run: () => activate(t.key) })),
    ...skillItems,
    ...(activeTab() ? [{ kind: 'Action', label: 'Renommer l’onglet…', sub: activeTab().title, color: 'transparent', run: () => setTimeout(() => startRename(activeTab()), 50) }] : []),
    { kind: 'Action', label: 'Nouveau projet…', sub: '', color: 'transparent', run: () => openPresetModal() },
    ...(feat('accounts') ? [{ kind: 'Action', label: 'Comptes Claude…', sub: 'pro, perso…', color: 'transparent', run: () => openAccounts() }] : []),
    ...allAccounts().filter((a) => feat('accounts') && a.id !== state.account).map((a) => ({ kind: 'Compte', label: `Passer sur ${a.name}`, sub: a.dir || '~/.claude', color: 'var(--accent)', run: () => switchSpace(a.id) })),
    ...Object.entries(THEMES).map(([key, th]) => ({ kind: 'Thème', label: `Thème : ${th.label}`, sub: th.desc, color: th.swatches[2], run: () => { applyTheme(key); persist(); } })),
  ]).filter((it) => !q || fuzzy(q, `${it.label} ${it.sub}`));
  paletteSel = Math.min(paletteSel, Math.max(paletteItems.length - 1, 0));
  const el = $('#palette-list');
  el.innerHTML = '';
  paletteItems.forEach((it, i) => {
    const li = document.createElement('li');
    if (i === paletteSel) li.className = 'sel';
    li.innerHTML = `<span class="dot" style="background:${it.color}"></span><span>${esc(it.label)}</span><span class="path">${esc(it.sub)}</span><span class="kind">${it.kind}</span>`;
    li.onclick = () => runPalette(i);
    el.appendChild(li);
  });
}

function runPalette(i) {
  const it = paletteItems[i];
  if (!it) return;
  $('#palette').classList.add('hidden');
  it.run();
}

$('#palette-input').addEventListener('input', () => { paletteSel = 0; renderPalette(); });
$('#palette-input').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { paletteSel = Math.min(paletteSel + 1, paletteItems.length - 1); renderPalette(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { paletteSel = Math.max(paletteSel - 1, 0); renderPalette(); e.preventDefault(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteSel); }
});
$('#palette').addEventListener('mousedown', (e) => { if (e.target.id === 'palette') closePalette(); });
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

/* ---------- Raccourcis ---------- */

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#palette').classList.contains('hidden')) return closePalette();
    if (!$('#modal').classList.contains('hidden')) return closeModal();
    const open = document.querySelector('#settings:not(.hidden), #skill-edit:not(.hidden), #skill-run:not(.hidden), #ticket-view:not(.hidden), #keys:not(.hidden)');
    if (open) return closeOverlay(open);
  }
  if (!e.metaKey || e.altKey || e.ctrlKey) return;
  const k = e.key.toLowerCase();
  let handled = true;
  if (k === 'k' && !e.shiftKey) openPalette();
  else if (k === 'j') openPalette({ mode: 'skills', presetId: activeTab()?.presetId });
  else if (k === '/') openKeys();
  else if (k === 'enter' && !$('#skill-run').classList.contains('hidden')) $('#skill-run-form').requestSubmit();
  else if (k === 't') openTerminal({ name: 'shell', cwd: activeTab()?.cwd || '~', command: '' });
  else if (k === 'w') { if (state.activeKey) closeTab(state.activeKey); }
  else if (k === 'l') openPromptBar();
  else if (k === 'n') openPresetModal();
  else if (k === 'g') $('#btn-layout').click();
  else if (k === 'd') toggleDiff();
  else if (k === 'b' && feat('kanban')) toggleKanban();
  else if (k === 'i' && feat('inbox')) toggleInbox();
  // e.code (touche physique) : en AZERTY, ⌘ + la touche 1 donne « & » dans e.key
  else if (/^Digit[1-9]$/.test(e.code) && !e.shiftKey) { const t = spaceTabs()[+e.code.slice(5) - 1]; if (t) activate(t.key); }
  else if (e.shiftKey && (k === ']' || k === '}' || k === '[' || k === '{')) {
    const tabs = spaceTabs();
    const i = tabs.findIndex((t) => t.key === state.activeKey);
    const d = k === ']' || k === '}' ? 1 : -1;
    const t = tabs[(i + d + tabs.length) % tabs.length];
    if (t) activate(t.key);
  } else handled = false;
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}, true);

/* ---------- Utilisation de Claude (forfait) ---------- */

const usage = { byAccount: {}, at: {}, loading: false, open: false };
const MOIS = { Jan: 'janv.', Feb: 'févr.', Mar: 'mars', Apr: 'avr.', May: 'mai', Jun: 'juin', Jul: 'juil.', Aug: 'août', Sep: 'sept.', Oct: 'oct.', Nov: 'nov.', Dec: 'déc.' };
const usageLabel = (it) => (it.kind === 'session' ? 'Session' : it.scope && it.scope !== 'all models' ? `Semaine · ${it.scope}` : 'Semaine');
const usageLevel = (p) => (p >= 90 ? ' crit' : p >= 70 ? ' warn' : '');

// « Nov 4 at 7:20pm » → « 4 nov. à 19h20 »
function frResets(t) {
  const m = t.match(/^(?:(\w{3}) (\d+)(?: at )?)?\s*(\d+)(?::(\d+))?\s*(am|pm)?$/i);
  if (!m) return t;
  let h = +m[3] % 12 + (/pm/i.test(m[5] || '') ? 12 : 0);
  if (!m[5]) h = +m[3];
  const time = `${h}h${m[4] || '00'}`;
  return m[1] ? `${m[2]} ${MOIS[m[1]] || m[1]} à ${time}` : `à ${time}`;
}

async function refreshUsage(force = false) {
  const id = state.account;
  if (usage.loading) return;
  if (!force && Date.now() - (usage.at[id] || 0) < 60000) return renderUsage();
  usage.loading = true;
  renderUsage();
  const res = await api.usage(accountFor(id).dir);
  usage.loading = false;
  usage.byAccount[id] = res;
  usage.at[id] = Date.now();
  renderUsage();
}

function renderUsage() {
  const el = $('#usage');
  const u = usage.byAccount[state.account];
  const items = u?.items || [];
  el.classList.toggle('hidden', !items.length);
  if (!items.length) return;
  const compact = items.filter((it) => it.kind === 'session' || !it.scope || it.scope === 'all models');
  const bar = (it) => `<span class="u-bar"><i style="width:${Math.min(100, it.pct)}%"></i></span>`;
  const ago = Math.round((Date.now() - usage.at[state.account]) / 60000);
  el.innerHTML = compact.map((it) => `<div class="u-item${usageLevel(it.pct)}"><span>${usageLabel(it)}</span>${bar(it)}<span class="u-pct">${it.pct}%</span></div>`).join('')
    + (usage.open ? `<div id="usage-pop" class="popover">
        <b>Utilisation de Claude · ${esc(accountFor(state.account).name)}</b>
        ${items.map((it) => `<div class="u-row u-item${usageLevel(it.pct)}">
          <div class="u-line"><span>${usageLabel(it)}</span><span class="u-pct">${it.pct}%</span></div>
          ${bar(it)}
          ${it.resets ? `<small>Réinitialisation ${esc(frResets(it.resets))}</small>` : ''}
        </div>`).join('')}
        <div class="u-foot"><span>${usage.loading ? 'Mise à jour…' : `Mis à jour ${ago < 1 ? 'à l’instant' : `il y a ${ago} min`}`}</span>
          <button id="usage-refresh" title="Rafraîchir">${icon('refresh')}</button></div>
      </div>` : '');
}

$('#usage').addEventListener('click', (e) => {
  if (e.target.closest('#usage-refresh')) return refreshUsage(true);
  if (e.target.closest('#usage-pop')) return;
  usage.open = !usage.open;
  renderUsage();
});
document.addEventListener('click', (e) => {
  if (usage.open && !e.composedPath().includes($('#usage'))) { usage.open = false; renderUsage(); }
});
window.addEventListener('focus', () => refreshUsage());
setInterval(() => refreshUsage(true), 5 * 60000);

/* ---------- Mises à jour ---------- */

// Le bouton n'apparaît que s'il y a du nouveau : commits sur le dépôt distant, ou sources locales plus récentes que l'app
let updating = false;
async function checkUpdate() {
  if (updating) return;
  const st = await api.updateStatus();
  const b = $('#btn-rebuild');
  b.classList.toggle('hidden', !st.available);
  const n = (st.remote?.length || 0) + (st.local?.length || 0);
  if (st.available) b.title = `Mise à jour disponible (${n} nouveauté${n > 1 ? 's' : ''}) :\n${[...st.remote, ...st.local].slice(0, 8).map((c) => `• ${c}`).join('\n')}`;
}
checkUpdate();
setInterval(checkUpdate, 5 * 60000);
window.addEventListener('focus', () => checkUpdate());

$('#btn-rebuild').onclick = async () => {
  const b = $('#btn-rebuild');
  if (updating) return;
  updating = true;
  b.classList.add('busy');
  const res = await api.rebuild(state.tabs.filter((t) => !t.exited).length);
  // En cas de succès l'app se ferme et se relance ; sinon on rend la main
  if (!res?.ok) {
    updating = false;
    b.classList.remove('busy');
    checkUpdate();
  }
};
api.onRebuildLog((text) => {
  const line = text.trim().split('\n').pop();
  if (line) $('#btn-rebuild').title = `Mise à jour en cours… ${line.slice(0, 120)}`;
});

/* ---------- Init ---------- */

(async () => {
  const data = await api.loadData();
  // Les scripts suivants (chat.js, kanban.js) peuvent ne pas être encore chargés quand les données arrivent
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  state.presets = data.presets || [];
  state.prompts = data.prompts || [];
  state.layout = 'tabs';
  state.skillConfigs = data.skillConfigs || {};
  state.chatMode = data.chatMode || 'acceptEdits';
  state.accounts = data.accounts || [];
  state.defaultName = data.defaultName || 'Pro';
  // Une installation d'avant ce choix garde ce qu'elle affichait ; une nouvelle commence sans rien de facultatif
  state.features = data.features || (data.presets?.length ? { kanban: true, inbox: true, times: true, accounts: !!data.accounts?.length } : {});
  state.account = feat('accounts') && state.accounts.some((a) => a.id === data.account) ? data.account : '';
  Object.assign(state.bg, data.bg || {});
  Object.assign(state.sound, data.sound || {});
  Object.assign(state.kanban, data.kanban || {});
  Object.assign(state.inbox, data.inbox || {});
  Object.assign(state.times, data.times || {});
  state.side.width = data.side?.width || state.kanban.width || state.side.width;
  state.side.last = data.side?.last;
  applyTheme(data.theme || 'nuit');
  applyBg();
  state.customSkills = data.customSkills || [];
  Object.assign(state.diff, data.diff || {});
  $('#diff-scope').value = state.diff.scope;
  $('#diff-auto').checked = state.diff.auto;
  renderPresets();
  scanSkills();
  renderTabs();
  applyLayout();
  window.addEventListener('resize', () => state.tabs.forEach(fitTab));
  refreshUsage(true);
  applyFeatures();
  initKanban();
  initInbox();
  initTimes();
})();
