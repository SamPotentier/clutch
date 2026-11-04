/* ---------- Onglets « conversation » : Claude Code en stream-json, affiché comme une discussion ---------- */

const byChat = new Map(); // chatId -> tab
const PERMISSION_MODES = [
  ['acceptEdits', 'Modifs auto, demande le reste'],
  ['default', 'Demander avant d’agir'],
  ['bypassPermissions', 'Tout autoriser'],
  ['plan', 'Plan (lecture seule)'],
];
const SUGGESTIONS = ['Explique-moi ce projet', 'Quels sont les derniers changements ?', 'Lance les tests et corrige ce qui casse'];

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Markdown minimal : titres, listes, citations, tableaux, blocs de code, `code`, **gras**, *italique*, liens */

function mdInline(s) {
  // Le code inline est mis de côté pour que « **gras avec `code`** » fonctionne
  const codes = [];
  return esc(s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

function md(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) out.push(`<p>${para.map(mdInline).join('<br>')}</p>`); para = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^```(\S*)/))) {
      flush();
      const code = [];
      while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]);
      out.push(`<pre class="code">${m[1] ? `<span class="lang">${esc(m[1])}</span>` : ''}<code>${esc(code.join('\n'))}</code></pre>`);
    } else if ((m = line.match(/^(#{1,4})\s+(.*)/))) {
      flush();
      out.push(`<h4>${mdInline(m[2])}</h4>`);
    } else if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      i--;
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((it) => `<li>${mdInline(it)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else if (/^>\s?/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      i--;
      out.push(`<blockquote>${quote.map(mdInline).join('<br>')}</blockquote>`);
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().slice(1, -1).split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
      out.push(`<table class="md-table">${body.map((r, n) => `<tr>${cells(r).map((c) => `<${n ? 'td' : 'th'}>${mdInline(c)}</${n ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</table>`);
    } else if (!line.trim()) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return out.join('');
}

/* Ouverture et cycle de vie d'une session */

async function openChat({ name, cwd, color, presetId, accountId = state.account, extraArgs, prompt, group }) {
  const sameName = state.tabs.filter((t) => t.baseName === name).length;
  const tab = {
    kind: 'chat', key: uid(), presetId, baseName: name, title: sameName ? `${name} (${sameName + 1})` : name,
    cwd, command: 'claude', color: color || '#737aa2', extraArgs: extraArgs || '', accountId, configDir: accountFor(accountId).dir, mode: state.chatMode || 'acceptEdits',
    group, exited: false, busy: false, sessionId: null, model: '', tools: new Map(), blocks: [], stderr: '',
  };
  tab.wrap = el('div', 'term-wrap chat-wrap', `
    <div class="term-head"><span class="dot" style="background:${tab.color}"></span><span>${esc(tab.title)}</span><span>${esc(shortPath(cwd))}</span></div>
    <div class="chat-bar">
      <span class="chat-status"></span>
      <select class="chat-mode" title="Ce que Claude peut faire sans demander">${PERMISSION_MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <button class="chat-stop hidden" title="Interrompre Claude">${icon('stop')} Stop</button>
      <button class="chat-resume" title="Reprendre une conversation précédente (/resume)">${icon('history')} Reprendre</button>
      <button class="chat-term" title="Continuer cette session dans un terminal classique">${icon('terminal')} Terminal</button>
    </div>
    <div class="chat-scroll"><div class="chat-log"></div></div>`);
  tab.log = tab.wrap.querySelector('.chat-log');
  tab.scroller = tab.wrap.querySelector('.chat-scroll');
  tab.wrap.querySelector('.term-head').onclick = () => activate(tab.key);
  tab.wrap.querySelector('.chat-mode').value = tab.mode;
  tab.wrap.querySelector('.chat-mode').onchange = (e) => changeMode(tab, e.target.value);
  tab.wrap.querySelector('.chat-stop').onclick = () => interruptChat(tab);
  tab.wrap.querySelector('.chat-term').onclick = () => continueInTerminal(tab);
  tab.wrap.querySelector('.chat-resume').onclick = () => openSessionPicker(tab);
  tab.wrap.addEventListener('mousedown', () => state.activeKey !== tab.key && activate(tab.key));
  $('#terms').appendChild(tab.wrap);

  renderWelcome(tab);
  state.tabs.push(tab);
  tab.wrap.classList.toggle('away', !inSpace(tab));
  applyLayout();
  activate(tab.key);
  api.gitTrack(cwd).then((g) => {
    tab.git = g;
    if (tab.key === state.activeKey) refreshDiff();
  });
  await startChatProcess(tab);
  if (prompt) chatSend(tab, prompt);
  return tab;
}

async function startChatProcess(tab, resume) {
  tab.exited = false;
  tab.stderr = '';
  tab.chatId = await api.chatStart({ cwd: tab.cwd, mode: tab.mode, resume, extraArgs: tab.extraArgs, configDir: tab.configDir });
  byChat.set(tab.chatId, tab);
  renderChatBar(tab);
  renderTabs();
  renderPresets();
}

function stopChatProcess(tab) {
  if (tab.chatId == null) return;
  byChat.delete(tab.chatId);
  api.chatKill(tab.chatId);
  tab.chatId = null;
}

async function chatSend(tab, text) {
  // /resume n'existe pas en mode stream-json : l'app s'en charge
  const resume = text.trim().match(/^\/resume(?:\s+(\S+))?$/);
  if (resume) return resume[1] ? resumeSession(tab, resume[1]) : openSessionPicker(tab);
  if (/^\/model\s*$/.test(text.trim())) return openModelPicker(tab);
  tab.log.querySelector('.chat-welcome')?.remove();
  tab.lastSent = text.trim();
  addUser(tab, text);
  if (tab.exited) await startChatProcess(tab, tab.sessionId);
  api.chatSend(tab.chatId, text);
  setBusy(tab, true, 'Claude réfléchit…');
}

async function changeMode(tab, mode) {
  tab.mode = mode;
  state.chatMode = mode;
  persist();
  // Le mode se choisit au lancement : on relance la session en la reprenant là où elle en était
  if (!tab.sessionId) return;
  stopChatProcess(tab);
  await startChatProcess(tab, tab.sessionId);
  addNotice(tab, `Mode « ${PERMISSION_MODES.find(([v]) => v === mode)[1]} » activé.`);
}

function interruptChat(tab) {
  api.chatInterrupt(tab.chatId);
  setBusy(tab, true, 'Interruption…');
  // Si Claude ne s'arrête pas, on coupe le processus ; la session reste reprenable
  clearTimeout(tab.interruptTimer);
  tab.interruptTimer = setTimeout(() => {
    if (!tab.busy) return;
    stopChatProcess(tab);
    tab.exited = true;
    setBusy(tab, false);
    addNotice(tab, 'Interrompu. Envoie un message pour reprendre.');
  }, 4000);
}

function continueInTerminal(tab) {
  if (!tab.sessionId) return addNotice(tab, 'Envoie d’abord un message : la session n’existe pas encore.');
  const { baseName, cwd, color, presetId, sessionId, extraArgs, accountId, group } = tab;
  closeTab(tab.key);
  openTerminal({ name: baseName, cwd, color, presetId, accountId, group, command: `claude ${extraArgs ? extraArgs + ' ' : ''}--resume ${sessionId}` });
}

/* Événements du processus */

api.onChatEvent((id, ev) => {
  const tab = byChat.get(id);
  if (!tab || ev.parent_tool_use_id) return; // les sous-agents restent résumés dans leur carte
  if (ev.type === 'system' && ev.subtype === 'init') {
    tab.sessionId = ev.session_id;
    tab.model = ev.model || '';
    tab.slashCommands = ev.slash_commands || tab.slashCommands || [];
    renderChatBar(tab);
  } else if (ev.type === 'system' && ev.subtype === 'compact_boundary') {
    const m = ev.compact_metadata || {};
    const k = (n) => `${Math.round(n / 1000)}k`;
    addNotice(tab, `${icon('shrink')} Conversation compactée${m.pre_tokens ? ` (${k(m.pre_tokens)} → ${k(m.post_tokens)} tokens)` : ''}.`);
  } else if (ev.type === 'user' && typeof ev.message?.content === 'string') {
    onLocalCommandOutput(tab, ev.message.content);
  } else if (ev.type === 'stream_event') onStream(tab, ev.event);
  else if (ev.type === 'assistant') onAssistant(tab, ev.message);
  else if (ev.type === 'user') onToolResults(tab, ev.message);
  else if (ev.type === 'result') onResult(tab, ev);
  else if (ev.type === 'control_request') onControlRequest(tab, ev);
  if (tab.key !== state.activeKey && !tab.activity) { tab.activity = true; renderTabs(); }
});

api.onChatStderr((id, text) => {
  const tab = byChat.get(id);
  if (tab) tab.stderr = (tab.stderr + text).slice(-2000);
});

api.onChatExit((id, code) => {
  const tab = byChat.get(id);
  if (!tab) return;
  byChat.delete(id);
  tab.chatId = null;
  tab.exited = true;
  setBusy(tab, false);
  if (code) addNotice(tab, `Claude s’est arrêté (code ${code}).${tab.stderr ? `<pre>${esc(tab.stderr.trim())}</pre>` : ''}`, 'error');
  renderTabs();
});

function onStream(tab, e) {
  if (e.type === 'message_start') {
    tab.msgId = e.message.id;
  } else if (e.type === 'content_block_start') {
    const b = e.content_block;
    if (b.type === 'text') tab.blocks.push({ msgId: tab.msgId, node: addAssistantText(tab), text: '', final: false });
    else if (b.type === 'thinking') setBusy(tab, true, 'Claude réfléchit…');
    else if (b.type === 'tool_use') setBusy(tab, true, `${toolSummary(tab, b.name, {})[1]}…`);
  } else if (e.type === 'content_block_delta' && e.delta.type === 'text_delta') {
    const blk = tab.blocks.findLast((b) => b.msgId === tab.msgId && !b.final);
    if (!blk) return;
    blk.text += e.delta.text;
    setBusy(tab, true, 'Claude écrit…');
    scheduleText(tab, blk);
  }
}

function onAssistant(tab, msg) {
  for (const c of msg.content || []) {
    if (c.type === 'text') {
      let blk = tab.blocks.find((b) => b.msgId === msg.id && !b.final);
      if (!blk) {
        blk = { msgId: msg.id, node: addAssistantText(tab), text: '' };
        tab.blocks.push(blk);
      }
      blk.text = c.text;
      blk.final = true;
      // Réponse de /model : on met à jour le modèle affiché sans attendre le prochain message
      const switched = c.text.match(/^Set model to `?([^`\n]+?)`?(?: for| \(|$)/);
      if (switched) { tab.model = switched[1]; renderChatBar(tab); }
      blk.node.innerHTML = md(blk.text);
      stick(tab);
    } else if (c.type === 'tool_use' && !tab.tools.has(c.id)) {
      addToolCard(tab, c);
    }
  }
}

function onToolResults(tab, msg) {
  if (!Array.isArray(msg.content)) return;
  for (const r of msg.content) {
    if (r.type !== 'tool_result') continue;
    const card = tab.tools.get(r.tool_use_id);
    if (!card) continue;
    const text = Array.isArray(r.content) ? r.content.map((c) => c.text || '').join('\n') : String(r.content ?? '');
    card.classList.add(r.is_error ? 'err' : 'ok');
    card.querySelector('.tool-state').innerHTML = icon(r.is_error ? 'x' : 'check', r.is_error ? 'bad' : 'good');
    if (text.trim() && card.dataset.showOutput) {
      const out = text.length > 4000 ? text.slice(0, 4000) + '\n…' : text;
      card.querySelector('.tool-body').insertAdjacentHTML('beforeend', `<pre class="tool-out">${esc(out)}</pre>`);
    }
    if (r.is_error) card.querySelector('.tool-body').insertAdjacentHTML('beforeend', `<div class="tool-err">${esc(text.slice(0, 600))}</div>`);
  }
  stick(tab);
}

// Sortie des commandes locales (/compact, /model opus…) renvoyée sous forme de message utilisateur
function onLocalCommandOutput(tab, content) {
  const m = content.match(/<local-command-(stdout|stderr)>([\s\S]*?)<\/local-command-\1>/);
  if (m && m[2].trim()) addNotice(tab, md(m[2].trim()), m[1] === 'stderr' ? 'error' : '');
}

function onResult(tab, ev) {
  clearTimeout(tab.interruptTimer);
  setBusy(tab, false);
  refreshUsage();
  if (tab.lastSent === '/clear') {
    tab.log.innerHTML = '';
    tab.tools.clear();
    tab.blocks = [];
    addNotice(tab, `${icon('eraser')} Conversation effacée : Claude repart de zéro.`);
  }
  tab.lastSent = '';
  // On ne signale que les refus automatiques, pas ceux que l'utilisateur a choisis
  const denied = (ev.permission_denials || []).slice(tab.userDenials || 0);
  tab.userDenials = 0;
  if (denied.length) {
    const names = [...new Set(denied.map((d) => d.tool_name))].join(', ');
    addNotice(tab, `Claude n’a pas eu le droit d’utiliser : <b>${esc(names)}</b>. Passe le mode sur « Tout autoriser » en haut pour le laisser faire, puis redemande.`, 'warn');
  }
  if (ev.is_error && ev.result) addNotice(tab, esc(ev.result), 'error');
  if (ev.duration_ms > 500) tab.log.insertAdjacentHTML('beforeend', `<div class="chat-meta">Terminé en ${(ev.duration_ms / 1000).toFixed(1).replace('.', ',')} s</div>`);
  if (tab.key !== state.activeKey) { tab.bell = true; renderTabs(); }
  stick(tab);
}

/* Demandes d'autorisation */

function onControlRequest(tab, ev) {
  const req = ev.request || {};
  if (req.subtype !== 'can_use_tool') {
    api.chatRespond(tab.chatId, ev.request_id, { error: `Requête « ${req.subtype} » non prise en charge` });
    return;
  }
  const input = req.input || {};
  if (req.tool_name === 'AskUserQuestion') return askUser(tab, ev.request_id, input);
  const [ico, verb, target] = toolSummary(tab, req.tool_name, input);
  let detail = '';
  if (req.tool_name === 'Bash') detail = `<pre class="tool-cmd">$ ${esc(input.command || '')}</pre>`;
  else if (req.tool_name === 'Edit') detail = miniDiff(input.old_string, input.new_string);
  else if (req.tool_name === 'Write') detail = miniDiff('', String(input.content || '').split('\n').slice(0, 40).join('\n')).replace(/<div class="d-del">- <\/div>/, '');
  else if (req.tool_name === 'WebFetch') detail = `<div class="tool-prompt">${esc(input.url || '')}</div>`;
  const always = (req.permission_suggestions || []).length > 0;
  const card = el('div', 'perm', `
    <div class="perm-head"><span class="tool-icon">${ico}</span><b>Claude demande l’autorisation</b> · ${esc(verb)} <span class="tool-target">${esc(target)}</span></div>
    ${detail}
    <div class="perm-actions">
      <button class="primary" data-a="allow">Autoriser</button>
      ${always ? '<button data-a="always" title="Ajoute une règle dans .claude/settings.local.json du projet">Toujours autoriser ici</button>' : ''}
      <button data-a="deny">Refuser</button>
    </div>`);
  card.querySelector('.perm-actions').onclick = (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'deny') {
      tab.userDenials = (tab.userDenials || 0) + 1;
      api.chatRespond(tab.chatId, ev.request_id, { behavior: 'deny', message: 'Refusé par l’utilisateur.' });
    } else {
      api.chatRespond(tab.chatId, ev.request_id, {
        behavior: 'allow', updatedInput: input,
        ...(a === 'always' ? { updatedPermissions: req.permission_suggestions } : {}),
      });
    }
    card.classList.add('answered', a === 'deny' ? 'denied' : 'allowed');
    card.querySelector('.perm-actions').innerHTML = `<span>${a === 'deny' ? icon('x', 'bad') + ' Refusé' : icon('check', 'good') + (a === 'always' ? ' Toujours autorisé dans ce projet' : ' Autorisé')}</span>`;
    setBusy(tab, true, 'Claude travaille…');
    if (state.activeKey === tab.key) $('#prompt').focus();
  };
  tab.log.appendChild(card);
  setBusy(tab, true, 'En attente de ta réponse');
  if (tab.key !== state.activeKey) { tab.bell = true; renderTabs(); }
  stick(tab);
  card.querySelector('[data-a="allow"]').focus();
}

/* Cartes de choix : questions de Claude (AskUserQuestion) et sélecteurs de l'app (/model) */

function askUser(tab, requestId, input) {
  const questions = input.questions || [];
  setBusy(tab, true, 'Claude te pose une question');
  if (tab.key !== state.activeKey) { tab.bell = true; renderTabs(); }
  addChoiceCard(tab, {
    title: questions.length > 1 ? 'Claude a quelques questions' : 'Claude te pose une question',
    questions,
    onSubmit: (answers) => {
      api.chatRespond(tab.chatId, requestId, {
        behavior: 'allow',
        updatedInput: { ...input, answers: Object.fromEntries(questions.map((q, i) => [q.question, answers[i]])) },
      });
      setBusy(tab, true, 'Claude travaille…');
    },
    onCancel: () => {
      tab.userDenials = (tab.userDenials || 0) + 1;
      api.chatRespond(tab.chatId, requestId, { behavior: 'deny', message: 'L’utilisateur a préféré ne pas répondre.' });
    },
  });
}

const MODELS = [
  ['opus', 'Opus', 'Le plus capable, pour les tâches complexes'],
  ['sonnet', 'Sonnet', 'Équilibré : rapide et très capable'],
  ['haiku', 'Haiku', 'Le plus rapide et le plus économique'],
  ['fable', 'Fable', 'Modèle Fable'],
  ['opusplan', 'Opus Plan', 'Opus pour planifier, Sonnet pour exécuter'],
  ['opus[1m]', 'Opus 1M', 'Opus avec un contexte d’un million de tokens'],
  ['sonnet[1m]', 'Sonnet 1M', 'Sonnet avec un contexte d’un million de tokens'],
  ['default', 'Par défaut', 'Le modèle recommandé pour ton compte'],
];

function openModelPicker(tab) {
  if (tab.log.querySelector('.choice.model-picker:not(.answered)')) return;
  tab.log.querySelector('.chat-welcome')?.remove();
  const current = (tab.model || '').replace(/^claude-/, '').split('-')[0];
  addChoiceCard(tab, {
    title: 'Choisir le modèle',
    cls: 'model-picker',
    other: 'Autre identifiant de modèle…',
    questions: [{
      question: tab.model ? `Modèle actuel : ${tab.model.replace(/^claude-/, '')}` : 'Quel modèle utiliser pour cette conversation ?',
      options: MODELS.map(([alias, label, description]) => ({ label, description, value: alias, current: alias === current })),
    }],
    onSubmit: ([answer]) => chatSend(tab, `/model ${MODELS.find(([, label]) => label === answer)?.[0] || answer}`),
  });
}

function addChoiceCard(tab, { title, questions, cls = '', other = 'Autre réponse…', onSubmit, onCancel }) {
  const card = el('div', `choice ${cls}`, `<div class="choice-title">${esc(title)}</div>`);
  card.tabIndex = -1;
  const picks = questions.map(() => ({ set: new Set(), other: '' }));
  const single = questions.length === 1 && !questions[0].multiSelect;

  const answerOf = (qi) => picks[qi].other.trim() || [...picks[qi].set].sort((a, b) => a - b).map((i) => questions[qi].options[i].label).join(', ');
  const refresh = () => {
    card.querySelectorAll('.choice-q').forEach((block, qi) => {
      block.querySelectorAll('.opt').forEach((b, oi) => b.classList.toggle('picked', picks[qi].set.has(oi)));
      block.classList.toggle('done', !!answerOf(qi));
    });
    const submit = card.querySelector('.choice-submit');
    if (submit) submit.disabled = questions.some((_, qi) => !answerOf(qi));
  };
  const finish = () => {
    const answers = questions.map((_, qi) => answerOf(qi));
    card.classList.add('answered');
    card.innerHTML = `<div class="choice-title">${esc(title)}</div>${questions.map((q, i) => `<div class="choice-answer">${icon('check', 'good')} ${q.header ? `<b>${esc(q.header)}</b> : ` : ''}${esc(answers[i])}</div>`).join('')}`;
    focusActive();
    onSubmit(answers);
  };
  const cancel = () => {
    card.classList.add('answered', 'cancelled');
    card.innerHTML = `<div class="choice-title">${esc(title)}</div><div class="choice-answer">Ignoré</div>`;
    focusActive();
    onCancel?.();
  };
  const choose = (qi, oi) => {
    const q = questions[qi];
    picks[qi].other = '';
    card.querySelectorAll('.choice-other')[qi] && (card.querySelectorAll('.choice-other')[qi].value = '');
    if (q.multiSelect) picks[qi].set.has(oi) ? picks[qi].set.delete(oi) : picks[qi].set.add(oi);
    else picks[qi].set = new Set([oi]);
    refresh();
    if (single) return finish();
    // Question à choix unique : on passe à la suivante
    if (!q.multiSelect) card.querySelectorAll('.choice-q')[qi + 1]?.querySelector('.opt')?.focus();
  };

  questions.forEach((q, qi) => {
    const block = el('div', 'choice-q', `
      <div class="q">${q.header ? `<span class="chip-h">${esc(q.header)}</span>` : ''}${esc(q.question)}${q.multiSelect ? ' <small>(plusieurs choix possibles)</small>' : ''}</div>
      <div class="opts"></div>`);
    q.options.forEach((o, oi) => {
      const b = el('button', 'opt', `<span class="num">${oi + 1}</span><span class="lbl">${esc(o.label)}</span>${o.current ? '<span class="cur">actuel</span>' : ''}${o.description && o.description !== o.label ? `<span class="desc">${esc(o.description)}</span>` : ''}`);
      b.onclick = () => choose(qi, oi);
      block.querySelector('.opts').appendChild(b);
    });
    if (other) {
      const input = el('input', 'choice-other');
      input.placeholder = other;
      input.spellcheck = false;
      input.oninput = () => { picks[qi].other = input.value; if (input.value) picks[qi].set.clear(); refresh(); };
      input.onkeydown = (e) => {
        if (e.key !== 'Enter' || !input.value.trim()) return;
        e.preventDefault();
        if (single || !questions.some((_, i) => !answerOf(i))) finish();
      };
      block.appendChild(input);
    }
    card.appendChild(block);
  });
  const actions = el('div', 'choice-actions', `${single ? '' : '<button class="primary choice-submit" disabled>Répondre</button>'}<button class="choice-cancel">${onCancel ? 'Ignorer' : 'Annuler'}</button><span class="choice-hint">↑↓ pour choisir · Entrée pour valider · 1-9 · Échap</span>`);
  actions.querySelector('.choice-submit')?.addEventListener('click', finish);
  actions.querySelector('.choice-cancel').onclick = cancel;
  card.appendChild(actions);

  // Navigation clavier : flèches entre les options, chiffres pour choisir, Échap pour ignorer
  card.addEventListener('keydown', (e) => {
    if (card.classList.contains('answered')) return;
    const opts = [...card.querySelectorAll('.opt')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
      e.preventDefault();
      opts[i].click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (/^[1-9]$/.test(e.key) && e.target.tagName !== 'INPUT') {
      const block = (document.activeElement.closest('.choice-q') || card.querySelector('.choice-q'));
      const qi = [...card.querySelectorAll('.choice-q')].indexOf(block);
      if (questions[qi]?.options[+e.key - 1]) { e.preventDefault(); choose(qi, +e.key - 1); }
    }
  });

  tab.log.appendChild(card);
  stick(tab);
  tab.scroller.scrollTop = tab.scroller.scrollHeight;
  (card.querySelector('.opt.picked, .opt') || card).focus();
  return card;
}

/* Rendu */

function renderWelcome(tab) {
  const w = el('div', 'chat-welcome', `
    <div class="chat-hello">✻</div>
    <h2>Que veux-tu faire dans <b>${esc(tab.baseName)}</b> ?</h2>
    <p>${esc(shortPath(tab.cwd))}</p>
    <div class="chat-sugg">${SUGGESTIONS.map((s) => `<button>${esc(s)}</button>`).join('')}</div>`);
  w.querySelectorAll('.chat-sugg button').forEach((b) => { b.onclick = () => chatSend(tab, b.textContent); });
  tab.log.appendChild(w);
  api.chatSessions(tab.cwd, tab.configDir).then((sessions) => {
    if (!sessions.length || !w.isConnected) return;
    const recent = el('div', 'chat-recent', `<div class="chat-recent-head"><span>Reprendre une conversation</span>${sessions.length > 4 ? '<button class="link">Tout voir</button>' : ''}</div>`);
    for (const ses of sessions.slice(0, 4)) recent.appendChild(sessionItem(tab, ses));
    recent.querySelector('.link')?.addEventListener('click', () => openSessionPicker(tab));
    w.appendChild(recent);
  });
}

/* Reprise de conversations (/resume) */

function timeAgo(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : d < 7 ? `il y a ${d} jours` : new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function sessionItem(tab, ses, onPick) {
  const item = el('button', 'session-item', `
    <span class="session-title">${esc(ses.title)}</span>
    <span class="session-when">${timeAgo(ses.mtime)}</span>
    ${ses.lastPrompt && ses.lastPrompt !== ses.title ? `<span class="session-last">Dernier message : ${esc(ses.lastPrompt)}</span>` : ''}`);
  item.onclick = () => { onPick?.(); resumeSession(tab, ses.id); };
  return item;
}

async function openSessionPicker(tab) {
  const sessions = await api.chatSessions(tab.cwd, tab.configDir);
  const overlay = el('div', 'overlay', `
    <div class="dialog wide sessions">
      <h3>Reprendre une conversation · ${esc(tab.baseName)}</h3>
      <input placeholder="Filtrer…" spellcheck="false">
      <div class="session-list"></div>
    </div>`);
  const list = overlay.querySelector('.session-list');
  const close = () => { overlay.remove(); focusActive(); };
  const render = (q = '') => {
    list.innerHTML = '';
    const found = sessions.filter((ses) => !q || `${ses.title} ${ses.lastPrompt}`.toLowerCase().includes(q.toLowerCase()));
    for (const ses of found) list.appendChild(sessionItem(tab, ses, close));
    if (!found.length) list.innerHTML = '<div class="diff-empty">Aucune conversation trouvée pour ce dossier.</div>';
  };
  render();
  overlay.querySelector('input').oninput = (e) => render(e.target.value);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  document.body.appendChild(overlay);
  overlay.querySelector('input').focus();
}

async function resumeSession(tab, id) {
  stopChatProcess(tab);
  tab.log.innerHTML = '';
  tab.tools.clear();
  tab.blocks = [];
  tab.sessionId = id;
  addNotice(tab, 'Chargement de la conversation…');
  const history = await api.chatHistory(tab.cwd, id, tab.configDir);
  tab.log.innerHTML = '';
  if (history.length >= 400) addNotice(tab, 'Seuls les derniers échanges sont affichés.');
  for (const e of history) {
    if (e.type === 'assistant') onAssistant(tab, e.message);
    else if (typeof e.message?.content === 'string') {
      const cmd = e.message.content.match(/<command-name>([^<]*)<\/command-name>[\s\S]*?(?:<command-args>([^<]*)<\/command-args>)?/);
      if (cmd) addUser(tab, `${cmd[1]} ${cmd[2] || ''}`.trim());
      else if (e.message.content.startsWith('<')) onLocalCommandOutput(tab, e.message.content);
      else addUser(tab, e.message.content);
    } else {
      const text = (e.message?.content || []).filter((c) => c.type === 'text' && !c.text.startsWith('<')).map((c) => c.text).join('\n');
      if (text) addUser(tab, text);
      onToolResults(tab, e.message);
    }
  }
  // Les outils sans résultat dans l'historique ne doivent pas tourner indéfiniment
  tab.log.querySelectorAll('.tool-state .spin').forEach((n) => { n.parentElement.textContent = '·'; });
  addNotice(tab, `${icon('history')} Conversation reprise. Écris la suite ci-dessous.`);
  await startChatProcess(tab, id);
  tab.scroller.scrollTop = tab.scroller.scrollHeight;
}

function renderChatBar(tab) {
  const status = tab.wrap.querySelector('.chat-status');
  status.innerHTML = tab.busy
    ? `<span class="pulse"></span>${esc(tab.busyLabel || 'Claude travaille…')}`
    : `<span class="ready"></span>${tab.exited ? 'Session en pause' : 'Prêt'}${tab.model ? ` · <button class="link model-link" title="Changer de modèle">${esc(tab.model.replace(/^claude-/, ''))} ${icon('chevron-down')}</button>` : ''}`;
  status.querySelector('.model-link')?.addEventListener('click', () => openModelPicker(tab));
  tab.wrap.querySelector('.chat-stop').classList.toggle('hidden', !tab.busy);
}

function setBusy(tab, busy, label) {
  tab.busy = busy;
  if (label) tab.busyLabel = label;
  renderChatBar(tab);
}

// Colle en bas si l'utilisateur n'est pas remonté lire plus haut
function stick(tab) {
  const s = tab.scroller;
  if (s.scrollHeight - s.scrollTop - s.clientHeight < 160) s.scrollTop = s.scrollHeight;
}

function scheduleText(tab, blk) {
  if (blk.raf) return;
  blk.raf = requestAnimationFrame(() => {
    blk.raf = null;
    if (!blk.final) blk.node.innerHTML = md(blk.text) + '<span class="caret-blink"></span>';
    stick(tab);
  });
}

function addUser(tab, text) {
  tab.log.appendChild(el('div', 'msg user', `<div class="bubble">${esc(text).replace(/\n/g, '<br>')}</div>`));
  tab.scroller.scrollTop = tab.scroller.scrollHeight;
}

function addAssistantText(tab) {
  const m = el('div', 'msg assistant', '<div class="avatar">✻</div><div class="md"></div>');
  tab.log.appendChild(m);
  stick(tab);
  return m.querySelector('.md');
}

function addNotice(tab, html, kind = '') {
  tab.log.appendChild(el('div', `chat-notice ${kind}`, html));
  stick(tab);
}

function relPath(tab, p) {
  if (!p) return '';
  const base = shortPath(tab.cwd).replace(/\/$/, '') + '/';
  const sp = shortPath(p);
  return sp.startsWith(base) ? sp.slice(base.length) : sp;
}

// [icône, verbe, cible] pour chaque outil
function toolSummary(tab, name, input) {
  const f = relPath(tab, input.file_path || input.notebook_path);
  switch (name) {
    case 'Read': return [icon('read'), 'Lecture', f];
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': return [icon('edit'), 'Modification', f];
    case 'Write': return [icon('write'), 'Écriture', f];
    case 'Bash': return [icon('terminal'), 'Commande', input.description || input.command || ''];
    case 'Grep': return [icon('search'), 'Recherche', input.pattern ? `« ${input.pattern} »` : ''];
    case 'Glob': return [icon('files'), 'Fichiers', input.pattern || ''];
    case 'WebFetch': return [icon('globe'), 'Page web', input.url || ''];
    case 'WebSearch': return [icon('globe'), 'Recherche web', input.query || ''];
    case 'Task': case 'Agent': return [icon('bot'), 'Sous-agent', input.description || ''];
    case 'TodoWrite': return [icon('todos'), 'Plan de travail', ''];
    case 'Skill': return [icon('zap'), 'Skill', input.skill || input.command || ''];
    default: return [icon('wrench'), name.replace(/^mcp__[^_]+__/, ''), ''];
  }
}

function miniDiff(oldS, newS) {
  const lines = [
    ...String(oldS || '').split('\n').map((l) => `<div class="d-del">- ${esc(l)}</div>`),
    ...String(newS || '').split('\n').map((l) => `<div class="d-add">+ ${esc(l)}</div>`),
  ];
  return `<div class="mini-diff">${lines.slice(0, 120).join('')}${lines.length > 120 ? '<div>…</div>' : ''}</div>`;
}

function addToolCard(tab, c) {
  if (c.name === 'AskUserQuestion') return; // affiché comme carte de choix interactive
  const input = c.input || {};
  const [ico, verb, target] = toolSummary(tab, c.name, input);
  const card = el('details', 'tool', `
    <summary><span class="tool-icon">${ico}</span><span class="tool-verb">${esc(verb)}</span><span class="tool-target">${esc(target)}</span><span class="tool-state"><span class="spin"></span></span></summary>
    <div class="tool-body"></div>`);
  const body = card.querySelector('.tool-body');
  if (c.name === 'Edit') body.innerHTML = miniDiff(input.old_string, input.new_string);
  else if (c.name === 'MultiEdit') body.innerHTML = (input.edits || []).map((e) => miniDiff(e.old_string, e.new_string)).join('');
  else if (c.name === 'Write') body.innerHTML = miniDiff('', String(input.content || '').split('\n').slice(0, 60).join('\n')).replace(/<div class="d-del">- <\/div>/, '');
  else if (c.name === 'Bash') {
    body.innerHTML = `<pre class="tool-cmd">$ ${esc(input.command || '')}</pre>`;
    card.dataset.showOutput = '1';
  } else if (c.name === 'TodoWrite') {
    const mark = { completed: icon('box-done'), in_progress: icon('box-doing'), pending: icon('box-todo') };
    body.innerHTML = `<ul class="todos">${(input.todos || []).map((t) => `<li class="${t.status}">${mark[t.status] || mark.pending} ${esc(t.content)}</li>`).join('')}</ul>`;
    card.open = true;
  } else if (c.name === 'Task' || c.name === 'Agent') {
    body.innerHTML = `<div class="tool-prompt">${esc(input.prompt || '').slice(0, 1500)}</div>`;
  } else if (!['Read', 'Grep', 'Glob'].includes(c.name)) {
    card.dataset.showOutput = '1';
  }
  if (!body.innerHTML && !card.dataset.showOutput) card.classList.add('no-body');
  tab.tools.set(c.id, card);
  tab.log.appendChild(card);
  stick(tab);
}

/* Suggestions de commandes quand on tape « / » dans une conversation */

const COMMAND_HELP = {
  resume: 'Reprendre une conversation précédente',
  clear: 'Repartir d’une conversation vide',
  compact: 'Résumer la conversation pour libérer du contexte',
  context: 'Voir l’utilisation du contexte',
  model: 'Changer de modèle (ex. /model opus)',
  usage: 'Voir ta consommation',
  init: 'Créer un CLAUDE.md pour ce projet',
  'code-review': 'Relire les changements en cours',
  'security-review': 'Revue de sécurité des changements',
  effort: 'Régler l’effort de réflexion',
  fast: 'Activer / couper le mode rapide',
  mcp: 'Voir les serveurs MCP',
  rename: 'Renommer la conversation',
};
let slashItems = [];
let slashSel = 0;

function slashDescription(name) {
  if (COMMAND_HELP[name]) return COMMAND_HELP[name];
  const skill = state.skills.find((sk) => sk.invoke === name);
  return skill ? skill.description.split(/(?<=\.)\s/)[0] : '';
}

function renderSlash() {
  const pop = $('#slash-pop');
  const tab = activeTab();
  const m = $('#prompt').value.match(/^\/([\w:.-]*)$/);
  // Dans une conversation : commandes et skills. Sans terminal ouvert : les skills, lancés sur un projet au choix
  if (!m || (tab && tab.kind !== 'chat')) { pop.classList.add('hidden'); slashItems = []; return; }
  const q = m[1].toLowerCase();
  // Claude n'envoie sa liste de commandes qu'au premier message : les courantes sont connues d'avance
  const commands = tab ? [...Object.keys(COMMAND_HELP), ...(tab.slashCommands || [])] : [];
  const all = [...new Set([...commands, ...allSkills().map((sk) => sk.invoke)])].filter((c) => !c.startsWith('__'));
  slashItems = all
    .filter((c) => c.toLowerCase().includes(q))
    .sort((a, b) => (b.toLowerCase().startsWith(q) - a.toLowerCase().startsWith(q)) || (!!COMMAND_HELP[b] - !!COMMAND_HELP[a]) || a.localeCompare(b))
    .slice(0, 12);
  slashSel = Math.min(slashSel, Math.max(slashItems.length - 1, 0));
  pop.innerHTML = slashItems.map((c, i) => `<div class="item${i === slashSel ? ' sel' : ''}" data-i="${i}"><b>/${esc(c)}</b><span>${esc(slashDescription(c))}</span></div>`).join('');
  pop.classList.toggle('hidden', !slashItems.length);
}

function pickSlash(i) {
  const c = slashItems[i];
  if (!c) return;
  if (!activeTab()) {
    $('#prompt').value = '';
    $('#slash-pop').classList.add('hidden');
    slashItems = [];
    return openSkillRun(allSkills().find((sk) => sk.invoke === c));
  }
  if (c === 'model' || c === 'resume') {
    $('#prompt').value = '';
    $('#slash-pop').classList.add('hidden');
    slashItems = [];
    return chatSend(activeTab(), `/${c}`);
  }
  $('#prompt').value = `/${c} `;
  $('#slash-pop').classList.add('hidden');
  slashItems = [];
  $('#prompt').focus();
}

$('#prompt').addEventListener('input', () => { slashSel = 0; renderSlash(); });
// Phase de capture : passe avant l'envoi sur Entrée
$('#prompt').addEventListener('keydown', (e) => {
  if (!slashItems.length || $('#slash-pop').classList.contains('hidden')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    slashSel = (slashSel + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length;
    renderSlash();
  } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.metaKey && !e.shiftKey)) {
    pickSlash(slashSel);
  } else if (e.key === 'Escape') {
    $('#slash-pop').classList.add('hidden');
    slashItems = [];
  } else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
$('#slash-pop').addEventListener('mousedown', (e) => {
  const item = e.target.closest('.item');
  if (item) { e.preventDefault(); pickSlash(+item.dataset.i); }
});
