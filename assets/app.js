let socket = null;
let token = null;
let usuarioAtual = null;
let tipoChat = null;
let chatIdAtual = null;

let gruposCache = [];
let contatosCache = [];
let unreadState = {};
let lastPreviewState = {};
let lastTimeState = {};
let lastTimestampState = {};
let onlineState = new Set();
let userStatusState = {};
let typingUsers = new Map();
let adminUsuariosCache = [];
let adminBackupsCache = [];
let adminBackupSelecionadoId = '';
let adminBackupAgendamento = null;
let currentMessagesCache = [];
let currentMessagesHasMore = false;
let currentMessagesNextBefore = null;
let currentMessagesLoadingOlder = false;
let initialScrollLockTimers = [];
let activeReplyMessageId = null;
let editingMessageId = null;
let currentMessageSearch = '';
let conversationSearchTerm = '';
let conversationSearchRemoteMatches = new Set();
let conversationSearchTimer = null;
let conversationRenderTimer = null;
let conversationFilter = 'todos';
let favoriteChats = new Set();
let priorityChats = new Set();
let priorityMessages = new Set();
let pinnedMessagesByConversation = {};
let attendanceStatusState = {};
let forwardMessageId = null;
let globalSearchTimer = null;
let titleBlinkInterval = null;
let titleBlinkVisible = false;
const SHARED_PASSWORD_PANEL_ENABLED = false;
let painelSenhaState = {
  senhaAtual: '',
  observacao: '',
  atualizadoPor: '',
  atualizadoEm: null
};
let plantaoState = {
  escreventes: [],
  ferias: [],
  escalas: []
};
let plantaoCollapsed = false;
const REACTION_OPTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F44F}', '\u{1F525}', '\u{1F440}'];
const STORAGE_KEY = 'chatinterno.session';
const THEME_KEY = 'chatinterno.theme';
const FAVORITES_KEY = 'chatinterno.favoriteChats';
const PRIORITY_KEY = 'chatinterno.priorityChats';
const MESSAGE_PRIORITY_KEY = 'chatinterno.priorityMessages';
const ATTENDANCE_STATUS_KEY = 'chatinterno.attendanceStatus';
const SIDEBAR_KEY = 'chatinterno.sidebarCollapsed';
const DENSITY_KEY = 'chatinterno.messageDensity';
const MESSAGE_RENDER_LIMIT = 220;
const ATTENDANCE_STATUS_LABELS = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  urgente: 'Urgente'
};
const MESSAGE_PAGE_SIZE = 50;
const DAILY_MOTIVATION_MESSAGES = [
  'Cada ato que fazemos transforma vidas, vamos fazer sempre o nosso melhor.',
  'Cada atendimento carrega uma historia; que hoje a nossa entrega seja cuidadosa e humana.',
  'Nos detalhes do nosso trabalho nascem seguranca, confianca e tranquilidade para muitas pessoas.',
  'Que cada conversa de hoje seja conduzida com atencao, respeito e vontade de resolver.',
  'Fazer bem o simples tambem transforma vidas. Hoje e mais um dia para entregar o nosso melhor.',
  'Quando trabalhamos com cuidado, cada documento vira parte de uma conquista importante.',
  'Que o nosso atendimento seja claro, gentil e eficiente do primeiro contato ao ultimo retorno.',
  'Cada pessoa atendida merece sentir que seu pedido foi tratado com seriedade e respeito.',
  'Nosso trabalho ganha valor quando unimos agilidade, precisao e empatia.',
  'Hoje e um bom dia para transformar responsabilidade em confianca.',
  'Pequenas atitudes de cuidado deixam grandes marcas no atendimento.',
  'Que cada resposta enviada hoje aproxime alguem da solucao que precisa.',
  'Excelencia tambem esta na forma como acolhemos, orientamos e finalizamos cada demanda.',
  'Cada ato feito com atencao reforca a confianca que as pessoas depositam em nosso trabalho.',
  'Vamos cuidar de cada detalhe, porque por tras de cada pedido existe uma vida em movimento.',
  'Que hoje a equipe trabalhe com foco, leveza e orgulho pelo que entrega.',
  'Ser melhor a cada dia tambem e ouvir com calma, responder com clareza e agir com compromisso.',
  'Cada atendimento bem conduzido mostra que qualidade e cuidado caminham juntos.',
  'Que a nossa rotina seja feita de colaboracao, respeito e vontade de fazer bem feito.',
  'O melhor resultado nasce quando cada um faz sua parte com atencao e responsabilidade.',
  'Hoje, mais uma vez, temos a chance de facilitar caminhos e entregar seguranca.',
  'Que cada mensagem respondida leve clareza, tranquilidade e confianca.',
  'Transformar vidas tambem esta em cumprir cada etapa com carinho, criterio e dedicacao.',
  'Vamos fazer do atendimento de hoje uma experiencia mais simples, humana e eficiente.',
  'Cada detalhe importa quando o objetivo e servir bem.',
  'Nossa melhor entrega e aquela que une precisao tecnica e cuidado com as pessoas.',
  'Que a dedicacao de hoje vire tranquilidade para quem espera uma resposta.',
  'Atender bem e transformar uma necessidade em confianca.',
  'Que cada ato de hoje tenha a marca do nosso compromisso com o melhor.',
  'Trabalhar com excelencia e lembrar que cada processo tem alguem contando conosco.'
];
const EMOJI_OPTIONS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🙂',
  '🙃','😉','😊','😇','🥰','😍','🤩','😘','😗',
  '😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭',
  '🤫','🤔','🫡','🤐','🤨','😐','😑','😶','😏',
  '😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤',
  '😴','😷','🤒','🤕','🤧','🥵','🥶','🥴','😵',
  '😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮',
  '😯','😲','😳','🥺','😭','😤','😡','🤯','😱',
  '👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟',
  '🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚',
  '🖐️','🖖','👋','🤝','🙏','👏','🙌','🫶','💪',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎',
  '💔','❣️','💕','💞','💓','💗','💖','💘','💝',
  '✅','☑️','✔️','❌','❗','❓','⚠️','🚨','📌',
  '📎','📄','📑','🗂️','📅','⏰','📢','🔔','🔍',
  '💬','👀','💡','🔥','✨','⭐','🎉','🎊','🏆',
  '☕','🍕','🍰','🚗','🏠','🏢','💻','📱','🔒'
];
const DEFAULT_TITLE = 'Chat Interno - Equipe';
const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%232563eb'/%3E%3Cpath d='M18 22c0-4.4 3.6-8 8-8h12c4.4 0 8 3.6 8 8v9c0 4.4-3.6 8-8 8H31l-8 7v-7h-1c-4.4 0-8-3.6-8-8V22Z' fill='white'/%3E%3Ccircle cx='27' cy='27' r='3' fill='%232563eb'/%3E%3Ccircle cx='33' cy='27' r='3' fill='%232563eb'/%3E%3Ccircle cx='39' cy='27' r='3' fill='%232563eb'/%3E%3C/svg%3E";
const ALERT_FAVICON_A = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23ef4444'/%3E%3Ccircle cx='32' cy='32' r='23' fill='%23fef2f2'/%3E%3Cpath d='M32 18 18 44h28L32 18Z' fill='%23ef4444'/%3E%3Crect x='30' y='26' width='4' height='10' rx='2' fill='white'/%3E%3Ccircle cx='32' cy='40' r='2.2' fill='white'/%3E%3C/svg%3E";
const ALERT_FAVICON_B = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23f59e0b'/%3E%3Ccircle cx='32' cy='32' r='23' fill='%23fffbeb'/%3E%3Cpath d='M32 18 18 44h28L32 18Z' fill='%23f59e0b'/%3E%3Crect x='30' y='26' width='4' height='10' rx='2' fill='%2378360f'/%3E%3Ccircle cx='32' cy='40' r='2.2' fill='%2378360f'/%3E%3C/svg%3E";

function getDailyMotivationMessage(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return DAILY_MOTIVATION_MESSAGES[dayOfYear % DAILY_MOTIVATION_MESSAGES.length];
}

function updateDailyMotivation() {
  const motivation = document.getElementById('headerMotivation');
  if (motivation) motivation.textContent = getDailyMotivationMessage();
}

function getChatKey(tipo, id) {
  return `${tipo}-${id}`;
}

function carregarFavoritos() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    favoriteChats = new Set(Array.isArray(stored) ? stored : []);
  } catch (_err) {
    favoriteChats = new Set();
  }
}

function salvarFavoritos() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoriteChats)));
}

function carregarPrioridades() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRIORITY_KEY) || '[]');
    priorityChats = new Set(Array.isArray(stored) ? stored : []);
  } catch (_err) {
    priorityChats = new Set();
  }
}

function salvarPrioridades() {
  localStorage.setItem(PRIORITY_KEY, JSON.stringify(Array.from(priorityChats)));
}

function getMessagePriorityKey(messageId) {
  if (!messageId) return '';
  return String(Number(messageId));
}

function carregarMensagensPrioritarias() {
  try {
    const stored = JSON.parse(localStorage.getItem(MESSAGE_PRIORITY_KEY) || '[]');
    priorityMessages = new Set(Array.isArray(stored) ? stored : []);
  } catch (_err) {
    priorityMessages = new Set();
  }
}

function salvarMensagensPrioritarias() {
  localStorage.setItem(MESSAGE_PRIORITY_KEY, JSON.stringify(Array.from(priorityMessages)));
}

function isMensagemPrioritaria(messageId) {
  const key = getMessagePriorityKey(messageId);
  return Boolean(key && priorityMessages.has(key));
}

function getCurrentConversationKey() {
  return tipoChat && chatIdAtual ? getChatKey(tipoChat, chatIdAtual) : '';
}

function getPinnedMessagesForCurrentChat() {
  const key = getCurrentConversationKey();
  return key ? (pinnedMessagesByConversation[key] || []) : [];
}

function isMensagemFixada(messageId) {
  return getPinnedMessagesForCurrentChat().some((item) => Number(item.messageId) === Number(messageId));
}

function setPinnedMessageLocal(key, item, pinned) {
  if (!key || !item?.messageId) return;
  const current = Array.isArray(pinnedMessagesByConversation[key]) ? pinnedMessagesByConversation[key] : [];
  pinnedMessagesByConversation[key] = pinned
    ? [item, ...current.filter((entry) => Number(entry.messageId) !== Number(item.messageId))].slice(0, 5)
    : current.filter((entry) => Number(entry.messageId) !== Number(item.messageId));
}

async function alternarFixarMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  const key = getCurrentConversationKey();
  if (!message || !key) return;
  const pinned = !isMensagemFixada(messageId);
  const item = {
    messageId: Number(messageId),
    usuarioNome: message.usuarioNome || message.usuario_nome || 'Usuario',
    texto: getMessageSnippet(message),
    tipo: message.tipo || 'texto',
    fixadoEm: new Date().toISOString()
  };

  setPinnedMessageLocal(key, item, pinned);
  renderPinnedMessageBar();
  renderMessages();

  try {
    const response = await fetch(`/api/mensagens/${Number(messageId)}/fixar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ pinned })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao fixar mensagem');
  } catch (err) {
    setPinnedMessageLocal(key, item, !pinned);
    renderPinnedMessageBar();
    renderMessages();
    mostrarNotificacao(err.message, 'error');
  }
}

async function alternarPrioridadeMensagem(messageId) {
  const key = getMessagePriorityKey(messageId);
  if (!key) return;
  const highlighted = !priorityMessages.has(key);
  if (highlighted) priorityMessages.add(key);
  else priorityMessages.delete(key);
  salvarMensagensPrioritarias();
  renderMessages();

  try {
    const response = await fetch(`/api/mensagens/${Number(messageId)}/prioridade`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ highlighted })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao destacar mensagem');
  } catch (err) {
    if (highlighted) priorityMessages.delete(key);
    else priorityMessages.add(key);
    salvarMensagensPrioritarias();
    renderMessages();
    mostrarNotificacao(err.message, 'error');
  }
}

function carregarStatusAtendimento() {
  try {
    const stored = JSON.parse(localStorage.getItem(ATTENDANCE_STATUS_KEY) || '{}');
    attendanceStatusState = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch (_err) {
    attendanceStatusState = {};
  }
}

function salvarStatusAtendimento() {
  localStorage.setItem(ATTENDANCE_STATUS_KEY, JSON.stringify(attendanceStatusState));
}

function getAttendanceStatus(key) {
  const status = attendanceStatusState[key];
  return ATTENDANCE_STATUS_LABELS[status] ? status : '';
}

function getAttendanceLabel(status) {
  return ATTENDANCE_STATUS_LABELS[status] || '';
}

function getAttendanceChipHtml(key) {
  const status = getAttendanceStatus(key);
  if (!status) return '';
  return `<div class="attendance-chip ${escapeHtml(status)}">${escapeHtml(getAttendanceLabel(status))}</div>`;
}

async function alterarStatusAtendimentoAtual(status) {
  if (!tipoChat || !chatIdAtual) return;
  const normalized = ATTENDANCE_STATUS_LABELS[status] ? status : '';
  const key = getChatKey(tipoChat, chatIdAtual);
  const previous = attendanceStatusState[key] || '';
  if (normalized) attendanceStatusState[key] = normalized;
  else delete attendanceStatusState[key];
  salvarStatusAtendimento();
  atualizarBotaoFavorito();
  updateHeaderStatus();
  renderGrupos();
  renderContatos();
  atualizarPainelInicialSeAberto();

  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/status-atendimento`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: normalized })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao alterar status');
  } catch (err) {
    if (previous) attendanceStatusState[key] = previous;
    else delete attendanceStatusState[key];
    salvarStatusAtendimento();
    atualizarBotaoFavorito();
    updateHeaderStatus();
    renderGrupos();
    renderContatos();
    atualizarPainelInicialSeAberto();
    mostrarNotificacao(err.message, 'error');
  }
}

function uiIcon(name) {
  const icons = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    panel: '<svg viewBox="0 0 24 24"><path d="M4 5h7v14H4z"/><path d="M15 5h5v14h-5z"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>'
  };
  return icons[name] || '';
}

function atualizarBotaoFavorito() {
  const btn = document.getElementById('favoriteChatBtn');
  const priorityBtn = document.getElementById('priorityChatBtn');
  const exportBtn = document.getElementById('exportChatBtn');
  const homeBtn = document.getElementById('homeChatBtn');
  const attendanceSelect = document.getElementById('attendanceStatusSelect');
  if (!btn || !priorityBtn || !exportBtn || !homeBtn || !attendanceSelect) return;
  const hasChat = Boolean(tipoChat && chatIdAtual);
  homeBtn.classList.toggle('hidden', !hasChat);
  btn.classList.toggle('hidden', !hasChat);
  priorityBtn.classList.toggle('hidden', !hasChat);
  exportBtn.classList.toggle('hidden', !hasChat);
  attendanceSelect.classList.toggle('hidden', !hasChat);
  if (!hasChat) {
    attendanceSelect.value = '';
    return;
  }
  const key = getChatKey(tipoChat, chatIdAtual);
  const isFavorite = favoriteChats.has(key);
  const isPriority = priorityChats.has(key);
  attendanceSelect.value = getAttendanceStatus(key);
  const favoriteIcon = btn.querySelector('.action-icon');
  const favoriteText = btn.querySelector('.action-text');
  if (favoriteIcon) favoriteIcon.innerHTML = uiIcon('star');
  if (favoriteText) favoriteText.textContent = isFavorite ? 'Fixado' : 'Fixar';
  btn.classList.toggle('is-active', isFavorite);
  btn.setAttribute('aria-pressed', String(isFavorite));
  btn.setAttribute('aria-label', isFavorite ? 'Remover conversa dos favoritos' : 'Fixar conversa no topo');
  btn.title = isFavorite ? 'Remover dos favoritos' : 'Fixar conversa no topo';
  const priorityText = priorityBtn.querySelector('.action-text');
  if (priorityText) priorityText.textContent = isPriority ? 'Prioridade ativa' : 'Prioridade';
  priorityBtn.classList.toggle('is-active', isPriority);
  priorityBtn.classList.toggle('priority-active', isPriority);
  priorityBtn.setAttribute('aria-pressed', String(isPriority));
  priorityBtn.setAttribute('aria-label', isPriority ? 'Remover prioridade da conversa' : 'Marcar conversa como prioridade');
  priorityBtn.title = isPriority ? 'Remover prioridade' : 'Marcar como prioridade';
  atualizarPainelInicialSeAberto();
}

function alternarFavoritoAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const key = getChatKey(tipoChat, chatIdAtual);
  if (favoriteChats.has(key)) favoriteChats.delete(key);
  else favoriteChats.add(key);
  salvarFavoritos();
  atualizarBotaoFavorito();
  renderGrupos();
  renderContatos();
}

function alternarPrioridadeAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const key = getChatKey(tipoChat, chatIdAtual);
  if (priorityChats.has(key)) priorityChats.delete(key);
  else priorityChats.add(key);
  salvarPrioridades();
  atualizarBotaoFavorito();
  renderGrupos();
  renderContatos();
  atualizarPainelInicialSeAberto();
}

function aplicarTema(theme = localStorage.getItem(THEME_KEY) || 'light') {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('theme-dark', normalized === 'dark');
  const select = document.getElementById('ajustesTema');
  if (select) select.value = normalized;
  atualizarBotaoTema(normalized);
}

function salvarTemaPreferido(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, normalized);
  aplicarTema(normalized);
}

function atualizarBotaoTema(theme = localStorage.getItem(THEME_KEY) || 'light') {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  const btn = document.getElementById('themeToggleBtn');
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  const nextTitle = normalized === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
  if (btn) {
    btn.classList.toggle('is-active', normalized === 'dark');
    btn.setAttribute('aria-pressed', String(normalized === 'dark'));
    btn.title = nextTitle;
  }
  if (icon) icon.innerHTML = uiIcon(normalized === 'dark' ? 'sun' : 'moon');
  if (text) text.textContent = normalized === 'dark' ? 'Claro' : 'Escuro';
}

function alternarTemaRapido() {
  const atual = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  salvarTemaPreferido(atual === 'dark' ? 'light' : 'dark');
}

function aplicarEstadoSidebar(collapsed = localStorage.getItem(SIDEBAR_KEY) === 'true') {
  const isCollapsed = Boolean(collapsed);
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  const btn = document.getElementById('sidebarToggleBtn');
  const icon = document.getElementById('sidebarToggleIcon');
  const text = document.getElementById('sidebarToggleText');
  if (btn) {
    btn.classList.toggle('is-active', isCollapsed);
    btn.setAttribute('aria-pressed', String(isCollapsed));
    btn.setAttribute('aria-label', isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral');
    btn.title = isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral';
  }
  if (icon) icon.innerHTML = uiIcon(isCollapsed ? 'panel' : 'menu');
  if (text) text.textContent = isCollapsed ? 'Abrir' : 'Menu';
}

function alternarSidebar() {
  const next = !document.body.classList.contains('sidebar-collapsed');
  localStorage.setItem(SIDEBAR_KEY, String(next));
  aplicarEstadoSidebar(next);
}

function aplicarDensidadeMensagens(mode = localStorage.getItem(DENSITY_KEY) || 'comfortable') {
  const normalized = mode === 'compact' ? 'compact' : 'comfortable';
  document.body.classList.toggle('messages-compact', normalized === 'compact');
  const btn = document.getElementById('densityToggleBtn');
  const text = document.getElementById('densityToggleText');
  if (btn) {
    btn.classList.toggle('is-active', normalized === 'compact');
    btn.setAttribute('aria-pressed', String(normalized === 'compact'));
    btn.title = normalized === 'compact' ? 'Usar mensagens confortáveis' : 'Usar mensagens compactas';
  }
  if (text) text.textContent = normalized === 'compact' ? 'Conforto' : 'Compacto';
}

function alternarDensidadeMensagens() {
  const atual = document.body.classList.contains('messages-compact') ? 'compact' : 'comfortable';
  const next = atual === 'compact' ? 'comfortable' : 'compact';
  localStorage.setItem(DENSITY_KEY, next);
  aplicarDensidadeMensagens(next);
}

function usarRespostaRapida(texto) {
  const input = document.getElementById('messageInput');
  if (!input) return;
  const atual = input.value.trim();
  input.value = atual ? `${atual}\n${texto}` : texto;
  autoResizeComposer();
  input.focus();
  emitirDigitando();
}

function setModalTab(scope, tab) {
  document.querySelectorAll(`[data-${scope}-tab]`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset[`${scope}Tab`] === tab);
  });
  document.querySelectorAll(`[data-${scope}-panel]`).forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset[`${scope}Panel`] !== tab);
  });
}

function setAdminTab(tab) {
  setModalTab('admin', tab || 'usuarios');
}

function setSettingsTab(tab) {
  setModalTab('settings', tab || 'perfil');
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    'Authorization': `Bearer ${token}`
  };
}

function getPrivateChatUnreadCount(userId) {
  return Number(unreadState[getChatKey('privado', userId)] || 0);
}

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initials(nome) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/).slice(0, 2);
  return partes.map(p => p[0]?.toUpperCase() || '').join('');
}

function stringHash(value) {
  return String(value || '').split('').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0);
}

function avatarGradient(value) {
  const palettes = [
    ['#2563eb', '#06b6d4'],
    ['#7c3aed', '#db2777'],
    ['#059669', '#84cc16'],
    ['#ea580c', '#f59e0b'],
    ['#0f766e', '#14b8a6'],
    ['#4338ca', '#3b82f6'],
    ['#be123c', '#fb7185'],
    ['#155e75', '#38bdf8']
  ];
  const pair = palettes[Math.abs(stringHash(value)) % palettes.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function avatarStyle(value) {
  return `style="background:${avatarGradient(value)}"`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function atualizarBuscaConversas(value) {
  conversationSearchTerm = normalizeSearchText(value);
  conversationSearchRemoteMatches = new Set();
  clearTimeout(conversationSearchTimer);
  scheduleConversationRender();
}

function setConversationFilter(filter) {
  conversationFilter = filter || 'todos';
  document.querySelectorAll('.conversation-filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === conversationFilter);
    btn.setAttribute('aria-pressed', String(btn.dataset.filter === conversationFilter));
  });
  scheduleConversationRender();
}

function scheduleConversationRender() {
  clearTimeout(conversationRenderTimer);
  conversationRenderTimer = setTimeout(() => {
    renderGrupos();
    renderContatos();
  }, 90);
}

function conversationMatchesFilter(key, options = {}) {
  const unread = Number(options.unread || 0);
  const online = Boolean(options.online);
  const isGroup = options.tipo === 'grupo';
  const attendanceStatus = getAttendanceStatus(key);

  if (conversationFilter === 'online') return !isGroup && online;
  if (conversationFilter === 'grupos') return isGroup;
  if (conversationFilter === 'nao-lidas') return unread > 0;
  if (conversationFilter === 'pendentes') return attendanceStatus === 'pendente';
  if (conversationFilter === 'urgentes') return attendanceStatus === 'urgente';
  return true;
}

async function buscarConversasPorConteudo() {
  clearTimeout(conversationSearchTimer);
  conversationSearchRemoteMatches = new Set();

  if (conversationSearchTerm.length < 2) return;

  conversationSearchTimer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/busca-conversas?q=${encodeURIComponent(conversationSearchTerm)}`, { headers: authHeaders() });
      if (!response.ok) return;
      const data = await response.json();
      conversationSearchRemoteMatches = new Set(Array.isArray(data.matches) ? data.matches : []);
      renderGrupos();
      renderContatos();
    } catch (err) {
      console.error(err);
    }
  }, 220);
}

function chatMatchesSearch(parts, key) {
  if (!conversationSearchTerm) return true;
  return normalizeSearchText(parts.filter(Boolean).join(' ')).includes(conversationSearchTerm);
}

function getTypingName(tipo, id) {
  return typingUsers.get(getChatKey(tipo, id)) || '';
}

function getTypingPreviewHtml(tipo, id) {
  const nome = getTypingName(tipo, id);
  return nome ? `<span class="typing-preview">${escapeHtml(nome)} digitando...</span>` : '';
}

function getUserStatus(userId) {
  return userStatusState[Number(userId)] || 'disponivel';
}

function getStatusLabel(status) {
  return {
    disponivel: 'Disponível',
    ocupado: 'Ocupado',
    ausente: 'Ausente'
  }[status] || 'Disponível';
}

function formatTime(date = new Date()) {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function isSameCalendarDay(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatCalendarDayLabel(date = new Date()) {
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return '';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(target, now)) return 'Hoje';
  if (isSameCalendarDay(target, yesterday)) return 'Ontem';

  return target.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatMessageTimestamp(date = new Date()) {
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return formatTime();
  return `${formatCalendarDayLabel(target)} às ${formatTime(target)}`;
}

function formatDateOnlyBr(value) {
  const dateText = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return '';
  const [year, month, day] = dateText.split('-');
  return `${day}/${month}/${year}`;
}

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimestamp(value) {
  const ts = new Date(value || Date.now()).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeMessage(msg) {
  const normalizedId = Number(msg.id);
  if (msg.prioridade) {
    priorityMessages.add(String(normalizedId));
  }
  return {
    ...msg,
    id: normalizedId,
    usuario_id: Number(msg.usuario_id ?? msg.usuarioId ?? msg.remetente_id ?? 0),
    usuarioId: Number(msg.usuarioId ?? msg.usuario_id ?? msg.remetente_id ?? 0),
    lido: Number(msg.lido || 0),
    tipo: msg.tipo || 'texto',
    reacoes: typeof msg.reacoes === 'object' && msg.reacoes ? msg.reacoes : {},
    reacoes_nomes: typeof msg.reacoes_nomes === 'object' && msg.reacoes_nomes ? msg.reacoes_nomes : {},
    leituras_grupo: Array.isArray(msg.leituras_grupo)
      ? msg.leituras_grupo
          .map((item) => ({
            usuario_id: Number(item?.usuario_id),
            usuario_nome: item?.usuario_nome || '',
            lido_em: item?.lido_em || null
          }))
          .filter((item) => Number.isFinite(item.usuario_id))
      : [],
    reply_preview: msg.reply_preview || null,
    reply_to_id: Number(msg.reply_to_id || 0) || null,
    usuario_nome: msg.usuario_nome || msg.usuarioNome || msg.remetenteNome || '',
    usuarioNome: msg.usuarioNome || msg.usuario_nome || msg.remetenteNome || ''
  };
}

function getLeiturasGrupo(message) {
  const leituras = Array.isArray(message?.leituras_grupo) ? message.leituras_grupo : [];
  return leituras.filter((item, index, arr) => (
    Number(item?.usuario_id) !== Number(message?.usuarioId) &&
    arr.findIndex((entry) => Number(entry?.usuario_id) === Number(item?.usuario_id)) === index
  ));
}

    function getResumoLeituraGrupo(message) {
  const leituras = getLeiturasGrupo(message);
  if (!leituras.length) {
    return {
      status: '\u2713',
      detalhe: 'Ninguem do grupo leu ainda',
      tooltip: 'Ninguem do grupo leu ainda'
    };
  }

  const nomes = leituras
    .map((item) => item.usuario_nome || 'Membro')
    .filter(Boolean);

  const detalhe = nomes.length <= 2
    ? `Lido por ${nomes.join(', ')}`
    : `Lido por ${nomes[0]}, ${nomes[1]} e mais ${nomes.length - 2}`;

  return {
    status: '\u2713\u2713',
    detalhe,
    tooltip: `Lido por: ${nomes.join(', ')}`,
    total: nomes.length
  };
}

function getReactionNames(message, emoji, userIds = []) {
  const fromServer = Array.isArray(message?.reacoes_nomes?.[emoji])
    ? message.reacoes_nomes[emoji].filter(Boolean)
    : [];
  if (fromServer.length) return fromServer;

  return userIds.map((id) => {
    if (Number(id) === Number(usuarioAtual?.id)) return usuarioAtual?.nome || 'Voce';
    return contatosCache.find((usuario) => Number(usuario.id) === Number(id))?.nome || `Usuario ${id}`;
  });
}

function getMessageSnippet(message) {
  if (!message) return '';
  if (message.tipo === 'arquivo') {
    return `Arquivo: ${message.arquivo_nome_original || 'anexo'}`;
  }
  return String(message.conteudo || '').trim() || 'Mensagem';
}

function getMessageByIdFromCache(messageId) {
  return currentMessagesCache.find((msg) => Number(msg.id) === Number(messageId)) || null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
  const raw = String(text ?? '');
  if (!query) return escapeHtml(raw);
  const pattern = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  return escapeHtml(raw).replace(pattern, '<mark class=\"message-search-hit\">$1</mark>');
}

function isMessageMatch(message, query) {
  if (!query) return true;
  const needle = normalizeSearchText(query);
  return [
    message.usuarioNome,
    message.usuario_nome,
    message.conteudo,
    message.arquivo_nome_original,
    message.reply_preview?.conteudo,
    message.reply_preview?.usuario_nome
  ].some((value) => normalizeSearchText(value).includes(needle));
}

function isImageAttachment(message) {
  return message?.tipo === 'arquivo' && /\.(png|jpe?g|gif|webp)$/i.test(String(message.arquivo_nome_original || message.arquivo_url || ''));
}

function isPdfAttachment(message) {
  return message?.tipo === 'arquivo' && /\.pdf$/i.test(String(message.arquivo_nome_original || message.arquivo_url || ''));
}

function isVideoAttachment(message) {
  return message?.tipo === 'arquivo' && /\.(avi)$/i.test(String(message.arquivo_nome_original || message.arquivo_url || ''));
}

function linkifyTextHtml(text, query) {
  const highlighted = highlightText(text, query);
  return highlighted.replace(/(https?:\/\/[^\s<]+)/g, '<a class="message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function getFirstUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s]+/);
  return match ? match[0] : '';
}

function getLinkPreviewHtml(text) {
  const url = getFirstUrl(text);
  if (!url) return '';
  let host = url;
  try { host = new URL(url).hostname; } catch (_err) {}
  return `<a class="link-preview" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(host)}</strong><span>${escapeHtml(url)}</span></a>`;
}

function getMessageCopyText(message) {
  if (!message) return '';
  if (message.tipo === 'arquivo') {
    const url = message.arquivo_url ? new URL(message.arquivo_url, window.location.origin).href : '';
    return [message.arquivo_nome_original || 'Arquivo', url].filter(Boolean).join('\n');
  }
  return String(message.conteudo || '').trim();
}

async function copiarMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  const text = getMessageCopyText(message);
  if (!text) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    mostrarNotificacao('Mensagem copiada', 'success');
  } catch (err) {
    mostrarNotificacao('Nao foi possivel copiar: ' + err.message, 'error');
  }
}

function getForwardText(message) {
  const body = getMessageCopyText(message);
  return message?.tipo === 'arquivo'
    ? `Encaminhado: ${body}`
    : `Encaminhado: ${body}`;
}

function abrirEncaminharMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  if (!message) return;
  forwardMessageId = Number(messageId);
  const select = document.getElementById('forwardTargetSelect');
  select.innerHTML = '';
  gruposCache.forEach((grupo) => {
    const option = document.createElement('option');
    option.value = `grupo-${grupo.id}`;
    option.textContent = `# ${grupo.nome}`;
    select.appendChild(option);
  });
  contatosCache.forEach((usuario) => {
    const option = document.createElement('option');
    option.value = `privado-${usuario.id}`;
    option.textContent = usuario.nome;
    select.appendChild(option);
  });
  document.getElementById('forwardPreviewText').textContent = getMessageSnippet(message);
  document.getElementById('forwardModal').classList.add('active');
}

async function confirmarEncaminhamento() {
  const message = getMessageByIdFromCache(forwardMessageId);
  const target = document.getElementById('forwardTargetSelect').value;
  if (!message || !target) return;
  const [tipoDestino, idDestino] = target.split('-');
  const conteudo = getForwardText(message);

  if (tipoDestino === 'grupo') {
    socket.emit('mensagem-grupo', {
      grupoId: Number(idDestino),
      usuarioId: usuarioAtual.id,
      usuarioNome: usuarioAtual.nome,
      conteudo,
      replyToId: null
    });
  } else {
    socket.emit('mensagem-privada', {
      remetente_id: usuarioAtual.id,
      destinatario_id: Number(idDestino),
      remetenteNome: usuarioAtual.nome,
      conteudo,
      replyToId: null,
      client_temp_id: `forward-${Date.now()}`
    });
  }

  mostrarNotificacao('Mensagem encaminhada', 'success');
  fecharModal('forwardModal');
}

function atualizarBarraContexto() {
  const bar = document.getElementById('messageContextBar');
  const label = document.getElementById('messageContextLabel');
  const text = document.getElementById('messageContextText');

  if (editingMessageId) {
    const message = getMessageByIdFromCache(editingMessageId);
    label.textContent = 'Editando mensagem';
    text.textContent = getMessageSnippet(message);
    bar.classList.remove('hidden');
    return;
  }

  if (activeReplyMessageId) {
    const message = getMessageByIdFromCache(activeReplyMessageId);
    label.textContent = 'Respondendo mensagem';
    text.textContent = message ? `${message.usuarioNome || message.usuario_nome}: ${getMessageSnippet(message)}` : 'Mensagem selecionada';
    bar.classList.remove('hidden');
    return;
  }

  bar.classList.add('hidden');
}

function limparContextoMensagem() {
  activeReplyMessageId = null;
  editingMessageId = null;
  document.getElementById('messageInput').value = '';
  autoResizeComposer();
  atualizarBarraContexto();
}

function responderMensagem(messageId) {
  editingMessageId = null;
  activeReplyMessageId = Number(messageId);
  atualizarBarraContexto();
  document.getElementById('messageInput').focus();
}

function prepararEdicaoMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  if (!message || message.tipo !== 'texto' || Number(message.usuarioId) !== Number(usuarioAtual.id)) return;
  activeReplyMessageId = null;
  editingMessageId = Number(messageId);
  document.getElementById('messageInput').value = message.conteudo || '';
  autoResizeComposer();
  atualizarBarraContexto();
  document.getElementById('messageInput').focus();
}

function atualizarBuscaMensagens(value) {
  currentMessageSearch = String(value || '').trim();
  renderMessages();
}

function sortByRecent(items, tipo) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const aFav = favoriteChats.has(getChatKey(tipo, a.id)) ? 1 : 0;
    const bFav = favoriteChats.has(getChatKey(tipo, b.id)) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    const aPriority = priorityChats.has(getChatKey(tipo, a.id)) ? 1 : 0;
    const bPriority = priorityChats.has(getChatKey(tipo, b.id)) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    const aTs = lastTimestampState[getChatKey(tipo, a.id)] || 0;
    const bTs = lastTimestampState[getChatKey(tipo, b.id)] || 0;
    return bTs - aTs;
  });
}

function getTotalUnread() {
  return Object.values(unreadState).reduce((acc, cur) => acc + (Number(cur) || 0), 0);
}

function getUnreadTitle(total = getTotalUnread()) {
  return total > 0
    ? `(${total}) Chat Interno - Equipe`
    : DEFAULT_TITLE;
}

function getFaviconElement() {
  return document.getElementById('appFavicon');
}

function setFavicon(href) {
  const favicon = getFaviconElement();
  if (favicon) favicon.href = href;
}

function stopTitleBlink(resetTitle = true) {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
  }
  titleBlinkVisible = false;
  setFavicon(DEFAULT_FAVICON);
  if (resetTitle) {
    document.title = getUnreadTitle();
  }
}

function startTitleBlink(total) {
  if (document.visibilityState === 'visible' || total <= 0) {
    stopTitleBlink(true);
    return;
  }

  const unreadTitle = getUnreadTitle(total);
  const alertTitle = '*** RESPONDER MENSAGENS ***';

  if (titleBlinkInterval) {
    document.title = titleBlinkVisible ? alertTitle : unreadTitle;
    setFavicon(titleBlinkVisible ? ALERT_FAVICON_B : ALERT_FAVICON_A);
    return;
  }

  titleBlinkVisible = false;
  document.title = unreadTitle;
  setFavicon(ALERT_FAVICON_A);
  titleBlinkInterval = setInterval(() => {
    titleBlinkVisible = !titleBlinkVisible;
    document.title = titleBlinkVisible ? alertTitle : unreadTitle;
    setFavicon(titleBlinkVisible ? ALERT_FAVICON_B : ALERT_FAVICON_A);
  }, 900);
}

function updateBrowserTitle() {
  const total = getTotalUnread();
  if (total <= 0) {
    stopTitleBlink(true);
    return;
  }

  if (document.visibilityState === 'visible') {
    stopTitleBlink(false);
    document.title = getUnreadTitle(total);
    return;
  }

  startTitleBlink(total);
}

document.addEventListener('visibilitychange', () => {
  updateBrowserTitle();
});

window.addEventListener('focus', () => {
  updateBrowserTitle();
});

document.addEventListener('paste', (event) => {
  const target = event.target;
  const isComposerPaste = target?.id === 'messageInput' || target?.closest?.('.composer');
  if (!isComposerPaste) return;
  lidarColarArquivo(event);
});

document.addEventListener('dragover', (event) => {
  if (!tipoChat || !chatIdAtual) return;
  if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
  event.preventDefault();
  document.querySelector('.main-content')?.classList.add('dragging-file');
});

document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) {
    document.querySelector('.main-content')?.classList.remove('dragging-file');
  }
});

document.addEventListener('drop', async (event) => {
  document.querySelector('.main-content')?.classList.remove('dragging-file');
  const files = Array.from(event.dataTransfer?.files || []);
  if (!files.length) return;
  event.preventDefault();
  await confirmarEnvioArquivo(files[0], 'arquivo arrastado');
});

function updateHeaderIcon(tipo, nome = '') {
  const icon = document.getElementById('chatHeaderAvatar');
  icon.classList.toggle('brand-avatar', !tipo);
  icon.removeAttribute('style');
  if (tipo === 'grupo') icon.textContent = '#';
  else if (tipo === 'privado') {
    icon.textContent = initials(nome);
    icon.setAttribute('style', `background:${avatarGradient(nome)}`);
  }
  else icon.innerHTML = getMiniBrandMarkup();
}

function updateHeaderStatus() {
  const subtitle = document.getElementById('headerSubtitle');
  const motivation = document.getElementById('headerMotivation');
  updateDailyMotivation();
  if (tipoChat === 'grupo') {
    const status = getAttendanceStatus(getChatKey('grupo', chatIdAtual));
    subtitle.textContent = status ? `Conversa em grupo - ${getAttendanceLabel(status)}` : 'Conversa em grupo';
    motivation.classList.add('hidden');
  } else if (tipoChat === 'privado') {
    const contato = contatosCache.find(c => Number(c.id) === Number(chatIdAtual));
    const status = getAttendanceStatus(getChatKey('privado', chatIdAtual));
    const statusSuffix = status ? ` - ${getAttendanceLabel(status)}` : '';
    if (contato) {
      const online = onlineState.has(Number(contato.id));
      subtitle.textContent = online ? `Online agora - ${getStatusLabel(getUserStatus(contato.id))}${statusSuffix}` : `Offline${statusSuffix}`;
    } else {
      subtitle.textContent = `Conversa privada${statusSuffix}`;
    }
    motivation.classList.add('hidden');
  } else {
    subtitle.textContent = 'Selecione um grupo ou contato para iniciar';
    motivation.classList.remove('hidden');
  }
}

function renderPinnedNotice() {
  const bar = document.getElementById('pinnedNoticeBar');
  const text = document.getElementById('pinnedNoticeText');
  if (!bar || !text) return;

  const grupo = tipoChat === 'grupo'
    ? gruposCache.find((item) => Number(item.id) === Number(chatIdAtual))
    : null;
  const aviso = String(grupo?.aviso_fixado || '').trim();

  text.textContent = aviso;
  bar.classList.toggle('active', Boolean(aviso));
}

function renderPinnedMessageBar() {
  const bar = document.getElementById('pinnedMessageBar');
  const text = document.getElementById('pinnedMessageText');
  if (!bar || !text) return;

  const pinned = getPinnedMessagesForCurrentChat();
  const first = pinned[0];
  bar.classList.toggle('active', Boolean(first));
  text.textContent = first ? `${first.usuarioNome || 'Usuario'}: ${first.texto || 'Mensagem'}` : '';
  bar.dataset.messageId = first?.messageId || '';
}

function abrirMensagemFixadaAtual() {
  const messageId = Number(document.getElementById('pinnedMessageBar')?.dataset?.messageId || 0);
  if (!messageId) return;
  const row = document.querySelector(`[data-message-id="${messageId}"]`);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('highlight-target');
    setTimeout(() => row.classList.remove('highlight-target'), 1800);
    return;
  }
  mostrarNotificacao('A mensagem fixada esta em uma parte mais antiga da conversa. Use carregar mensagens anteriores.', 'info');
}

function desfixarMensagemAtual() {
  const messageId = Number(document.getElementById('pinnedMessageBar')?.dataset?.messageId || 0);
  if (messageId) alternarFixarMensagem(messageId);
}

function renderTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  const key = `${tipoChat}-${chatIdAtual}`;
  const nome = typingUsers.get(key);
  el.textContent = nome ? `${nome} está digitando...` : '';
}

function renderTypingSurfaces() {
  renderTypingIndicator();
  renderGrupos();
  renderContatos();
}

function getMiniBrandMarkup() {
  return '<span class="brand-mark"><span>D</span><small></small><span>C</span></span>';
}

function mostrarErro(mensagem) {
  const loginVisivel = !document.getElementById('loginContainer').classList.contains('hidden');
  if (loginVisivel) {
    const target = document.getElementById('loginError');
    target.textContent = mensagem;
    setTimeout(() => { target.textContent = ''; }, 5000);
  } else {
    mostrarNotificacao(mensagem, 'error');
  }
}

function mostrarNotificacao(mensagem, tipo = 'info') {
  const container = document.getElementById('notificationContainer');
  const notif = document.createElement('div');
  const kind = tipo || 'info';
  const config = {
    success: { icon: '?', title: 'Sucesso' },
    error: { icon: '!', title: 'Erro' },
    warning: { icon: '!', title: 'Aviso' },
    info: { icon: 'i', title: 'Informacao' }
  }[kind] || { icon: 'i', title: 'Informacao' };

  notif.className = `notification ${kind}`.trim();
  notif.innerHTML = `
    <div class="notification-icon">${config.icon}</div>
    <div class="notification-body">
      <div class="notification-title">${config.title}</div>
      <div class="notification-message">${escapeHtml(mensagem)}</div>
    </div>
    <button class="notification-close" type="button" aria-label="Fechar" title="Fechar">x</button>
  `;

  const close = () => {
    notif.style.animation = 'fadeOutToast .18s ease forwards';
    setTimeout(() => notif.remove(), 180);
  };

  notif.querySelector('.notification-close').addEventListener('click', close);
  container.appendChild(notif);
  setTimeout(close, 4500);
}

function setUploadStatus(texto) {
  document.getElementById('uploadStatus').textContent = texto || '';
}

function autoResizeComposer() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

function getClipboardExtension(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  return {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
  }[normalized] || '';
}

function normalizeClipboardFile(file) {
  if (!file) return null;
  if (file.name) return file;

  const extension = getClipboardExtension(file.type);
  const baseName = file.type && file.type.startsWith('image/')
    ? 'imagem-colada'
    : 'arquivo-colado';

  try {
    return new File([file], `${baseName}${extension}`, { type: file.type || 'application/octet-stream' });
  } catch (_err) {
    return file;
  }
}

function formatBoardTimestamp(value) {
  if (!value) return 'Sem atualizacao';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem atualizacao';
  return `${date.toLocaleDateString('pt-BR')} ${formatTime(date)}`;
}

function syncPainelSenhaVisibility() {
  const panel = document.getElementById('ticketBoardPanel');
  if (!panel) return;
  panel.style.display = SHARED_PASSWORD_PANEL_ENABLED ? '' : 'none';
}

function renderPainelSenha() {
  if (!SHARED_PASSWORD_PANEL_ENABLED) {
    syncPainelSenhaVisibility();
    return;
  }
  const current = document.getElementById('ticketBoardCurrent');
  const updated = document.getElementById('ticketBoardUpdated');
  const input = document.getElementById('ticketBoardInput');
  const note = document.getElementById('ticketBoardNote');
  if (!current || !updated || !input || !note) return;

  current.textContent = painelSenhaState.senhaAtual || '--';

  const metaParts = [];
  if (painelSenhaState.observacao) metaParts.push(painelSenhaState.observacao);
  if (painelSenhaState.atualizadoPor) metaParts.push(`por ${painelSenhaState.atualizadoPor}`);
  if (painelSenhaState.atualizadoEm) metaParts.push(formatBoardTimestamp(painelSenhaState.atualizadoEm));
  updated.textContent = metaParts.length ? metaParts.join(' • ') : 'Sem atualizacao';

  input.value = painelSenhaState.senhaAtual || '';
  note.value = painelSenhaState.observacao || '';
}

async function carregarPainelSenha() {
  if (!SHARED_PASSWORD_PANEL_ENABLED) {
    syncPainelSenhaVisibility();
    return;
  }
  try {
    const response = await fetch('/api/painel-senhas', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar painel de senhas');
    painelSenhaState = await response.json();
    renderPainelSenha();
  } catch (err) {
    mostrarNotificacao('Erro ao carregar painel de senha: ' + err.message, 'error');
  }
}

async function salvarPainelSenha() {
  if (!SHARED_PASSWORD_PANEL_ENABLED) return;
  const senhaAtual = document.getElementById('ticketBoardInput').value.trim().toUpperCase();
  const observacao = document.getElementById('ticketBoardNote').value.trim();

  try {
    const response = await fetch('/api/painel-senhas', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ senhaAtual, observacao })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao atualizar painel de senha', 'error');
      return;
    }

    painelSenhaState = data;
    renderPainelSenha();
    mostrarNotificacao('Painel de senha atualizado', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao atualizar painel de senha: ' + err.message, 'error');
  }
}

async function limparPainelSenha() {
  if (!SHARED_PASSWORD_PANEL_ENABLED) return;
  document.getElementById('ticketBoardInput').value = '';
  document.getElementById('ticketBoardNote').value = '';
  await salvarPainelSenha();
}

function preencherFormularioAjustes() {
  document.getElementById('ajustesNome').value = usuarioAtual?.nome || '';
  document.getElementById('ajustesEmail').value = usuarioAtual?.email || '';
  document.getElementById('ajustesSenhaAtual').value = '';
  document.getElementById('ajustesNovaSenha').value = '';
}

function renderGrupoMembrosSelector() {
  const container = document.getElementById('adminGrupoMembros');
  if (!container) return;

  const ativos = adminUsuariosCache.filter((usuario) => usuario.ativo);
  container.innerHTML = '';

  if (!ativos.length) {
    container.textContent = 'Nenhum usuário disponível.';
    return;
  }

  ativos.forEach((usuario) => {
    const item = document.createElement('label');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '10px';
    item.style.marginBottom = '8px';
    item.style.cursor = 'pointer';

    const isCurrent = Number(usuario.id) === Number(usuarioAtual?.id);
    item.innerHTML = `
      <input type="checkbox" class="admin-grupo-membro" value="${usuario.id}" ${isCurrent ? 'checked disabled' : ''} />
      <span>${escapeHtml(usuario.nome)} <small style="color:#64748b;">(${escapeHtml(usuario.email)})</small></span>
    `;
    container.appendChild(item);
  });
}

function renderAvisosGrupoAdmin() {
  const select = document.getElementById('adminAvisoGrupoSelect');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Selecione um grupo</option>';
  gruposCache.forEach((grupo) => {
    const option = document.createElement('option');
    option.value = grupo.id;
    option.textContent = grupo.nome;
    select.appendChild(option);
  });

  if (currentValue && gruposCache.some((grupo) => Number(grupo.id) === Number(currentValue))) {
    select.value = currentValue;
  }
  preencherAvisoGrupoSelecionado();
}

function preencherAvisoGrupoSelecionado() {
  const select = document.getElementById('adminAvisoGrupoSelect');
  const textarea = document.getElementById('adminAvisoGrupoTexto');
  if (!select || !textarea) return;
  const grupo = gruposCache.find((item) => Number(item.id) === Number(select.value));
  textarea.value = grupo?.aviso_fixado || '';
}

function fecharEmojiPicker() {
  document.getElementById('emojiPicker').classList.add('hidden');
  document.getElementById('emojiToggleBtn')?.setAttribute('aria-expanded', 'false');
}

function renderEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!picker || picker.dataset.rendered === 'true') return;
  picker.innerHTML = EMOJI_OPTIONS.map((emoji) => `
    <button type="button" class="emoji-option" onclick="inserirEmoji('${escapeHtml(emoji).replace(/'/g, '&#039;')}')" title="${escapeHtml(emoji)}" aria-label="Inserir emoji ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>
  `).join('');
  picker.dataset.rendered = 'true';
}

function alternarEmojis(event) {
  event.stopPropagation();
  renderEmojiPicker();
  const picker = document.getElementById('emojiPicker');
  picker.classList.toggle('hidden');
  document.getElementById('emojiToggleBtn')?.setAttribute('aria-expanded', String(!picker.classList.contains('hidden')));
}

function inserirEmoji(emoji) {
  const input = document.getElementById('messageInput');
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`;
  const novaPosicao = start + emoji.length;
  input.focus();
  input.setSelectionRange(novaPosicao, novaPosicao);
  autoResizeComposer();
  fecharEmojiPicker();
  emitirDigitando();
}

function salvarSessao() {
  if (!token || !usuarioAtual) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    token,
    usuario: usuarioAtual
  }));
}

function limparSessao() {
  localStorage.removeItem(STORAGE_KEY);
}

async function registrarServiceWorkerNotificacoes() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Service worker indisponivel', err);
    return null;
  }
}

async function mostrarNotificacaoNavegador(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const payload = {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: options.tag || 'chatinterno-message',
    renotify: true,
    ...options
  };

  try {
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.ready
      : null;
    if (registration?.showNotification) {
      await registration.showNotification(title, payload);
      return;
    }
  } catch (_err) {
    // fallback below
  }

  new Notification(title, payload);
}

async function carregarDadosIniciais() {
  await carregarWorkflow();
  await carregarGrupos();
  await carregarContatos();
  await carregarResumoConversas();
  await registrarServiceWorkerNotificacoes();
  updateBrowserTitle();
  atualizarPainelInicialSeAberto();

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function aplicarSessaoUsuario() {
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('chatContainer').classList.remove('hidden');
  document.getElementById('currentUserName').textContent = usuarioAtual.nome;
  document.getElementById('currentUserEmail').textContent = usuarioAtual.email;
  document.getElementById('currentUserAvatar').textContent = initials(usuarioAtual.nome);
  document.getElementById('currentUserAvatar').parentElement.setAttribute('style', `background:${avatarGradient(usuarioAtual.nome || usuarioAtual.email)}`);
  userStatusState[Number(usuarioAtual.id)] = usuarioAtual.status || 'disponivel';
  document.getElementById('userStatusSelect').value = usuarioAtual.status || 'disponivel';

  const isAdmin = Boolean(usuarioAtual.admin);
  document.getElementById('adminBadge').style.display = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('adminSection').classList.toggle('hidden', !isAdmin);
  document.getElementById('novoGrupoBtn').style.display = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('ajustesBtn').classList.remove('hidden');
  updateDailyMotivation();
  if (!tipoChat || !chatIdAtual) renderWelcomeState();
}

async function carregarWorkflow() {
  try {
    const response = await fetch('/api/workflow', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar fluxo de atendimento');
    const data = await response.json();
    attendanceStatusState = data.statusAtendimento && typeof data.statusAtendimento === 'object'
      ? data.statusAtendimento
      : {};
    priorityMessages = new Set((Array.isArray(data.mensagensPrioritarias) ? data.mensagensPrioritarias : []).map((id) => String(Number(id))));
    pinnedMessagesByConversation = data.mensagensFixadas && typeof data.mensagensFixadas === 'object'
      ? data.mensagensFixadas
      : {};
    salvarStatusAtendimento();
    salvarMensagensPrioritarias();
  } catch (err) {
    console.error(err);
  }
}

function getDashboardChatItems(filter, limit = 4) {
  const groupItems = gruposCache.map((grupo) => ({
    tipo: 'grupo',
    id: grupo.id,
    nome: grupo.nome,
    preview: lastPreviewState[getChatKey('grupo', grupo.id)] || grupo.descricao || 'Grupo da equipe',
    unread: Number(unreadState[getChatKey('grupo', grupo.id)] || 0),
    priority: priorityChats.has(getChatKey('grupo', grupo.id)),
    favorite: favoriteChats.has(getChatKey('grupo', grupo.id)),
    attendanceStatus: getAttendanceStatus(getChatKey('grupo', grupo.id)),
    online: false,
    time: lastTimeState[getChatKey('grupo', grupo.id)] || ''
  }));

  const contactItems = contatosCache.map((usuario) => ({
    tipo: 'privado',
    id: usuario.id,
    nome: usuario.nome,
    preview: lastPreviewState[getChatKey('privado', usuario.id)] || usuario.email || 'Conversa privada',
    unread: Number(unreadState[getChatKey('privado', usuario.id)] || 0),
    priority: priorityChats.has(getChatKey('privado', usuario.id)),
    favorite: favoriteChats.has(getChatKey('privado', usuario.id)),
    attendanceStatus: getAttendanceStatus(getChatKey('privado', usuario.id)),
    online: onlineState.has(Number(usuario.id)),
    time: lastTimeState[getChatKey('privado', usuario.id)] || ''
  }));

  let items = [...groupItems, ...contactItems];
  if (filter === 'priority') items = items.filter((item) => item.priority);
  if (filter === 'unread') items = items.filter((item) => item.unread > 0);
  if (filter === 'online') items = items.filter((item) => item.online);
  if (filter === 'pending') items = items.filter((item) => item.attendanceStatus === 'pendente');
  if (filter === 'urgent') items = items.filter((item) => item.attendanceStatus === 'urgente');

  return items
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.unread !== b.unread) return b.unread - a.unread;
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    })
    .slice(0, limit);
}

function getDashboardChatCard(item) {
  const meta = item.unread > 0 ? (item.unread > 99 ? '99+' : item.unread) : (item.time || (item.online ? 'on' : ''));
  const icon = item.tipo === 'grupo' ? '#' : initials(item.nome);
  const statusLabel = getAttendanceLabel(item.attendanceStatus);
  return `
    <button class="dashboard-chat-card" type="button" onclick="abrirAtalhoDashboard(this)" data-chat-type="${escapeHtml(item.tipo)}" data-chat-id="${escapeHtml(item.id)}" data-chat-name="${escapeHtml(item.nome)}">
      <span class="dashboard-chat-icon">${escapeHtml(icon)}</span>
      <span>
        <span class="dashboard-chat-name">${item.favorite ? '★ ' : ''}${escapeHtml(item.nome)}</span>
        <span class="dashboard-chat-preview">${statusLabel ? `${escapeHtml(statusLabel)} - ` : ''}${escapeHtml(item.preview)}</span>
      </span>
      <span class="dashboard-chat-meta">${escapeHtml(meta || 'abrir')}</span>
    </button>
  `;
}

function getDashboardListHtml(title, subtitle, items, emptyText) {
  return `
    <section class="dashboard-panel">
      <div class="dashboard-panel-title">${title}<span>${subtitle}</span></div>
      <div class="dashboard-list">
        ${items.length ? items.map(getDashboardChatCard).join('') : `<div class="dashboard-empty">${emptyText}</div>`}
      </div>
    </section>
  `;
}

function abrirAtalhoDashboard(button) {
  const tipo = button?.dataset?.chatType;
  const id = button?.dataset?.chatId;
  const nome = button?.dataset?.chatName;
  if (!tipo || !id || !nome) return;
  carregarChat(tipo, id, nome);
}

function aplicarFiltroDashboard(filter) {
  setConversationFilter(filter);
  if (window.innerWidth <= 980 && document.body.classList.contains('sidebar-collapsed')) {
    alternarSidebar();
  }
}

function getWelcomeStateHtml() {
  const totalOnline = contatosCache.filter((usuario) => onlineState.has(Number(usuario.id))).length;
  const totalGrupos = gruposCache.length;
  const totalNaoLidas = Object.values(unreadState).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalPendentes = Object.values(attendanceStatusState).filter((status) => status === 'pendente').length;
  const totalUrgentes = Object.values(attendanceStatusState).filter((status) => status === 'urgente').length;
  const nomeUsuario = String(usuarioAtual?.nome || '').trim();
  const emailUsuario = String(usuarioAtual?.email || '').trim();
  const firstNameRaw = /^\(?usu[aá]rio/i.test(nomeUsuario)
    ? (emailUsuario.split('@')[0] || 'Admin')
    : (nomeUsuario.split(/\s+/)[0] || emailUsuario.split('@')[0] || 'equipe');
  const firstName = firstNameRaw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '') || 'equipe';
  const urgentItems = getDashboardChatItems('urgent', 4);
  const unreadItems = getDashboardChatItems('unread', 4);
  return `
    <div class="empty-state welcome-state dashboard-home">
      <div class="dashboard-hero">
        <div class="welcome-logo-card" aria-label="Logo Dias de Castro">
          <svg viewBox="0 0 360 460" role="img" aria-hidden="true">
            <defs>
              <linearGradient id="logoSilverRuntime" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#f5f7fa" />
                <stop offset=".45" stop-color="#b9bec5" />
                <stop offset="1" stop-color="#eef1f4" />
              </linearGradient>
            </defs>
            <rect width="360" height="460" rx="8" fill="#050505" />
            <path d="M180 28c85 0 154 69 154 154v96c0 85-69 154-154 154S26 363 26 278v-96C26 97 95 28 180 28Z" fill="none" stroke="url(#logoSilverRuntime)" stroke-width="4" />
            <path d="M180 42c77 0 140 63 140 140v96c0 77-63 140-140 140S40 355 40 278v-96C40 105 103 42 180 42Z" fill="none" stroke="url(#logoSilverRuntime)" stroke-width="3" opacity=".95" />
            <text x="180" y="205" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="148" fill="url(#logoSilverRuntime)">D</text>
            <rect x="122" y="236" width="116" height="7" fill="url(#logoSilverRuntime)" />
            <text x="180" y="365" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="142" fill="url(#logoSilverRuntime)">C</text>
          </svg>
        </div>
        <div class="dashboard-title-group">
          <div class="welcome-eyebrow">Cartorio Dias de Castro</div>
          <div class="welcome-title">${getGreeting()}, ${escapeHtml(firstName)}</div>
          <div class="welcome-copy">Um painel rapido para abrir prioridades, acompanhar nao lidas e continuar atendimentos sem procurar demais.</div>
          <div class="dashboard-actions">
            <button class="dashboard-action-btn primary" type="button" onclick="aplicarFiltroDashboard('nao-lidas')">Ver nao lidas</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('pendentes')">Pendentes</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('urgentes')">Urgentes</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('online')">Equipe online</button>
            <button class="dashboard-action-btn" type="button" onclick="abrirBuscaGlobal()">Busca global</button>
          </div>
        </div>
      </div>
      <div class="welcome-stats dashboard-stats">
        <div class="welcome-stat-card">
          <strong>${totalOnline}</strong>
          <span>online agora</span>
        </div>
        <div class="welcome-stat-card">
          <strong>${totalNaoLidas}</strong>
          <span>nao lidas</span>
        </div>
        <div class="welcome-stat-card">
          <strong>${totalGrupos}</strong>
          <span>grupos</span>
        </div>
        <div class="welcome-stat-card priority">
          <strong>${totalPendentes}</strong>
          <span>pendentes</span>
        </div>
        <div class="welcome-stat-card urgent">
          <strong>${totalUrgentes}</strong>
          <span>urgentes</span>
        </div>
      </div>
      <div class="dashboard-grid">
        ${getDashboardListHtml('Urgentes', 'atencao agora', urgentItems, 'Nenhuma conversa urgente.')}
        ${getDashboardListHtml('Nao lidas', 'pendencias', unreadItems, 'Tudo em dia por aqui.')}
      </div>
    </div>
  `;
}

function renderWelcomeState() {
  document.getElementById('messagesContainer').innerHTML = getWelcomeStateHtml();
  atualizarBotaoTema();
}

function atualizarPainelInicialSeAberto() {
  if (!tipoChat && !chatIdAtual) renderWelcomeState();
}

function voltarTelaInicial() {
  tipoChat = null;
  chatIdAtual = null;
  currentMessageSearch = '';
  currentMessagesCache = [];
  currentMessagesHasMore = false;
  currentMessagesNextBefore = null;
  currentMessagesLoadingOlder = false;
  activeReplyMessageId = null;
  editingMessageId = null;

  document.getElementById('messageSearchInput').value = '';
  document.getElementById('messageInput').value = '';
  document.getElementById('headerTitle').textContent = 'Bem-vindo ao Chat do Cartorio Dias de Castro';
  document.getElementById('headerSubtitle').textContent = 'Selecione um grupo ou contato para iniciar';
  document.getElementById('typingIndicator').textContent = '';
  autoResizeComposer();
  atualizarBarraContexto();
  updateHeaderIcon(null);
  updateHeaderStatus();
  renderPinnedNotice();
  renderPinnedMessageBar();
  atualizarVisibilidadePlantaoPanel();
  atualizarBotaoFavorito();
  renderGrupos();
  renderContatos();
  renderWelcomeState();
  updateBrowserTitle();
}

function abrirChamadorSenha() {
  window.open('/emergencia/index.html', '_blank', 'noopener');
}

function abrirPainelSenhaPublico() {
  window.open('/emergencia/painel.html', '_blank', 'noopener');
}
async function restaurarSessao() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const session = JSON.parse(raw);
    if (!session?.token || !session?.usuario) {
      limparSessao();
      return;
    }

    token = session.token;
    usuarioAtual = session.usuario;
    aplicarSessaoUsuario();
    conectarSocket();
    await carregarPainelSenha();
    await carregarDadosIniciais();
  } catch (_err) {
    limparSessao();
  }
}

function processarMensagemGrupo(data) {
  const message = normalizeMessage({
    ...data,
    usuarioNome: data.usuarioNome,
    usuarioId: data.usuarioId
  });
  const chatKey = getChatKey('grupo', data.grupoId);
  const isCurrent = tipoChat === 'grupo' && Number(chatIdAtual) === Number(data.grupoId);
  const preview = data.tipo === 'arquivo'
    ? `${data.usuarioNome}: Arquivo: ${data.arquivo_nome_original}`
    : `${data.usuarioNome}: ${data.conteudo}`;

  lastPreviewState[chatKey] = preview;
  lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
  lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());

  if (isCurrent) {
    upsertMessageInCache(message);
    if (Number(data.usuarioId) !== Number(usuarioAtual.id)) {
      socket.emit('marcar-lidas-grupo', {
        grupoId: data.grupoId,
        usuarioId: usuarioAtual.id
      });
    }
  } else {
    unreadState[chatKey] = (unreadState[chatKey] || 0) + 1;
  }

  typingUsers.delete(`grupo-${data.grupoId}`);
  renderTypingSurfaces();
  updateBrowserTitle();
  atualizarPainelInicialSeAberto();

  if (Number(data.usuarioId) !== Number(usuarioAtual.id)) {
    mostrarNotificacao(`${data.usuarioNome} enviou ${data.tipo === 'arquivo' ? 'um arquivo' : 'uma mensagem'} no grupo`, 'success');
    mostrarNotificacaoNavegador('Nova mensagem em grupo', {
      body: data.tipo === 'arquivo'
        ? `${data.usuarioNome}: Arquivo ${data.arquivo_nome_original}`
        : `${data.usuarioNome}: ${data.conteudo}`,
      tag: `grupo-${data.grupoId}`
    });
  }
}

function processarMensagemPrivada(data) {
  const message = normalizeMessage({
    ...data,
    usuarioNome: data.remetenteNome,
    usuarioId: data.remetente_id
  });
  const chatKey = getChatKey('privado', data.remetente_id);
  const isCurrent = tipoChat === 'privado' && Number(chatIdAtual) === Number(data.remetente_id);
  const preview = data.tipo === 'arquivo'
    ? `${data.remetenteNome}: Arquivo: ${data.arquivo_nome_original}`
    : `${data.remetenteNome}: ${data.conteudo}`;

  lastPreviewState[chatKey] = preview;
  lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
  lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());

  if (isCurrent) {
    upsertMessageInCache(message);

    socket.emit('marcar-lidas', {
      remetenteId: data.remetente_id,
      destinatarioId: usuarioAtual.id
    });
  } else {
    unreadState[chatKey] = (unreadState[chatKey] || 0) + 1;
  }

  typingUsers.delete(`privado-${data.remetente_id}`);
  renderTypingSurfaces();
  updateBrowserTitle();
  atualizarPainelInicialSeAberto();

  mostrarNotificacao(`${data.remetenteNome} enviou ${data.tipo === 'arquivo' ? 'um arquivo' : 'uma mensagem privada'}`, 'success');

  mostrarNotificacaoNavegador('Nova mensagem privada', {
    body: data.tipo === 'arquivo'
      ? `${data.remetenteNome}: Arquivo ${data.arquivo_nome_original}`
      : `${data.remetenteNome}: ${data.conteudo}`,
    tag: `privado-${data.remetente_id}`
  });
}

async function fazerLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value;

  if (!email || !senha) {
    mostrarErro('Digite e-mail e senha');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.erro || 'Erro ao fazer login');
      return;
    }

    token = data.token;
    usuarioAtual = data.usuario;

    salvarSessao();
    aplicarSessaoUsuario();

    conectarSocket();
    await carregarPainelSenha();
    await carregarDadosIniciais();
  } catch (err) {
    mostrarErro('Erro na conexão: ' + err.message);
  }
}

function conectarSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('conectar-usuario', usuarioAtual.id);
  });

  socket.on('presenca-atualizada', (data) => {
    onlineState = new Set((data.online || []).map(Number));
    userStatusState = data.status || userStatusState || {};
    renderContatos();
    updateHeaderStatus();
    atualizarPainelInicialSeAberto();
  });

  socket.on('painel-senhas-atualizado', (data) => {
    painelSenhaState = data || {};
    renderPainelSenha();
  });

  socket.on('backup-restaurado', async () => {
    await carregarDadosIniciais();
    if (!document.getElementById('adminModal').classList.contains('active')) return;
    await carregarBackupsAdmin();
  });

  socket.on('backup-automatico-criado', async () => {
    if (!document.getElementById('adminModal').classList.contains('active')) return;
    await carregarBackupsAdmin();
    await carregarAgendamentoBackupAdmin();
  });

  socket.on('backup-agendamento-atualizado', async () => {
    if (!document.getElementById('adminModal').classList.contains('active')) return;
    await carregarAgendamentoBackupAdmin();
  });

  socket.on('grupo-aviso-atualizado', (data) => {
    gruposCache = gruposCache.map((grupo) => (
      Number(grupo.id) === Number(data.grupoId)
        ? { ...grupo, aviso_fixado: data.aviso || '' }
        : grupo
    ));
    renderPinnedNotice();
    renderAvisosGrupoAdmin();
    if (tipoChat === 'grupo' && Number(chatIdAtual) === Number(data.grupoId)) {
      mostrarNotificacao(data.aviso ? 'Aviso do grupo atualizado' : 'Aviso do grupo removido', 'info');
    }
  });

  socket.on('plantao-escala-atualizada', (data) => {
    normalizarPlantaoState(data);
    renderPlantaoPanel();
  });

  socket.on('usuario-digitando', (data) => {
    if (Number(data.usuarioId) === Number(usuarioAtual.id)) return;
    typingUsers.set(`${data.tipo}-${data.chatId}`, data.usuarioNome);
    renderTypingSurfaces();
  });

  socket.on('usuario-parou-digitacao', (data) => {
    typingUsers.delete(`${data.tipo}-${data.chatId}`);
    renderTypingSurfaces();
  });

  socket.on('nova-mensagem-grupo', (data) => {
    processarMensagemGrupo(data);
  });

  socket.on('nova-mensagem-privada', (data) => {
    processarMensagemPrivada(data);
  });

  socket.on('novo-arquivo-grupo', (data) => {
    processarMensagemGrupo(data);
  });

  socket.on('novo-arquivo-privado', (data) => {
    processarMensagemPrivada(data);
  });
  socket.on('mensagem-enviada-confirmacao', (data) => {
    const chatKey = getChatKey('privado', data.destinatario_id);
    lastPreviewState[chatKey] = `Voce: ${data.conteudo}`;
    lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
    lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());
    if (tipoChat === 'privado' && Number(chatIdAtual) === Number(data.destinatario_id)) {
      replaceTemporaryMessage(data.client_temp_id, {
        ...data,
        usuarioNome: usuarioAtual.nome,
        usuarioId: usuarioAtual.id
      });
    }
    renderContatos();
  });

  socket.on('arquivo-enviado-confirmacao', (data) => {
    const chatKey = getChatKey('privado', data.destinatario_id);
    lastPreviewState[chatKey] = `Voce: Arquivo: ${data.arquivo_nome_original}`;
    lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
    lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());
    renderContatos();
  });

  socket.on('mensagem-excluida', async (data) => {
    const chatCorreto = data.tipoChat === 'grupo'
      ? (tipoChat === 'grupo' && Number(chatIdAtual) === Number(data.grupoId))
      : (tipoChat === 'privado' && Number(chatIdAtual) === Number(data.remetenteId === usuarioAtual.id ? data.destinatarioId : data.remetenteId));

    if (chatCorreto) {
      await atualizarChatAposExclusao(data);
    } else if (data.tipoChat === 'grupo') {
      await carregarGrupos();
    } else {
      await carregarResumoConversas();
      await carregarContatos();
    }
  });

  socket.on('mensagens-lidas', (data) => {
    if (tipoChat === 'privado' && Number(chatIdAtual) === Number(data.destinatarioId)) {
      marcarMensagensComoLidasNaTela(Number(data.remetenteId));
    }
  });

  socket.on('mensagem-atualizada', (data) => {
    const chatCorreto = data.tipoChat === 'grupo'
      ? (tipoChat === 'grupo' && Number(chatIdAtual) === Number(data.grupoId))
      : (tipoChat === 'privado' && [Number(data.remetenteId), Number(data.destinatarioId)].includes(Number(chatIdAtual)));

    if (chatCorreto && data.message) {
      upsertMessageInCache({
        ...data.message,
        usuarioNome: data.message.usuario_nome,
        usuarioId: data.message.usuario_id,
        showReactionPicker: false
      });
    }

    if (data.tipoChat === 'grupo') {
      carregarGrupos();
    } else {
      carregarResumoConversas();
      carregarContatos();
    }
  });

  socket.on('workflow-conversa-atualizado', (data) => {
    if (!data?.key) return;
    if (data.status) attendanceStatusState[data.key] = data.status;
    else delete attendanceStatusState[data.key];
    salvarStatusAtendimento();
    atualizarBotaoFavorito();
    updateHeaderStatus();
    renderGrupos();
    renderContatos();
    atualizarPainelInicialSeAberto();
  });

  socket.on('mensagem-prioridade-atualizada', (data) => {
    const key = getMessagePriorityKey(data?.messageId);
    if (!key) return;
    if (data.highlighted) priorityMessages.add(key);
    else priorityMessages.delete(key);
    salvarMensagensPrioritarias();
    renderMessages();
  });

  socket.on('mensagem-fixada-atualizada', (data) => {
    if (!data?.key || !data?.messageId) return;
    setPinnedMessageLocal(data.key, {
      messageId: Number(data.messageId),
      usuarioNome: data.usuarioNome || 'Usuario',
      texto: data.texto || 'Mensagem',
      tipo: data.tipo || 'texto',
      fixadoEm: data.fixadoEm || null
    }, Boolean(data.pinned));
    renderPinnedMessageBar();
    renderMessages();
  });
}

function isGrupoPlantaoSelecionado() {
  if (tipoChat !== 'grupo' || !chatIdAtual) return false;
  const grupo = gruposCache.find((item) => Number(item.id) === Number(chatIdAtual));
  return String(grupo?.nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim() === 'plantao';
}

function getPlantaoEscreventeNome(escreventeId) {
  const escrevente = plantaoState.escreventes.find((item) => Number(item.id) === Number(escreventeId));
  return escrevente?.nome || 'Sem escrevente';
}

function getPlantaoColor(escreventeId) {
  const palette = [
    { bg: '#fee2e2', border: '#fca5a5', text: '#7f1d1d' },
    { bg: '#dcfce7', border: '#86efac', text: '#14532d' },
    { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a' },
    { bg: '#fef3c7', border: '#fbbf24', text: '#78350f' },
    { bg: '#ede9fe', border: '#c4b5fd', text: '#4c1d95' },
    { bg: '#cffafe', border: '#67e8f9', text: '#164e63' }
  ];
  const index = Math.max(0, plantaoState.escreventes.findIndex((item) => Number(item.id) === Number(escreventeId)));
  return palette[index % palette.length];
}

function getPlantaoColorStyle(escreventeId, conflito = false) {
  if (conflito) return '';
  const color = getPlantaoColor(escreventeId);
  return `style="--plantao-bg:${color.bg};--plantao-border:${color.border};--plantao-text:${color.text};"`;
}

function addDaysToDateInput(value, days) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getPlantaoEscalaPeriodos() {
  const ordenadas = [...plantaoState.escalas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return ordenadas.reduce((periodos, item) => {
    const anterior = periodos[periodos.length - 1];
    const mesmaPessoa = anterior && Number(anterior.escreventeId) === Number(item.escreventeId);
    const mesmoConflito = anterior && Boolean(anterior.conflito) === Boolean(item.conflito);
    const mesmaObservacao = anterior && String(anterior.observacao || '') === String(item.observacao || '');
    const diaSeguinte = anterior && addDaysToDateInput(anterior.fim, 1) === item.data;

    if (mesmaPessoa && mesmoConflito && mesmaObservacao && diaSeguinte) {
      anterior.fim = item.data;
      return periodos;
    }

    periodos.push({
      inicio: item.data,
      fim: item.data,
      escreventeId: item.escreventeId,
      conflito: Boolean(item.conflito),
      observacao: item.observacao || ''
    });
    return periodos;
  }, []);
}

function normalizarPlantaoState(data) {
  plantaoState = {
    escreventes: Array.isArray(data?.escreventes) ? data.escreventes : [],
    ferias: Array.isArray(data?.ferias) ? data.ferias : [],
    escalas: Array.isArray(data?.escalas) ? data.escalas : []
  };
}

async function carregarEscalaPlantao() {
  if (!token) return;
  try {
    const response = await fetch('/api/plantao/escala', { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Falha ao carregar escala');
    normalizarPlantaoState(data);
    renderPlantaoPanel();
  } catch (err) {
    mostrarNotificacao('Erro na escala de plantao: ' + err.message, 'error');
  }
}

function atualizarVisibilidadePlantaoPanel() {
  const panel = document.getElementById('plantaoPanel');
  if (!panel) return;
  const visible = isGrupoPlantaoSelecionado();
  const mainContent = panel.closest('.main-content');
  if (mainContent) mainContent.classList.toggle('plantao-mode', visible);
  panel.classList.toggle('hidden', !visible);
  if (visible) {
    prepararCamposPlantao();
    carregarEscalaPlantao();
  }
}

function prepararCamposPlantao() {
  const hoje = getTodayDateInput();
  const feriasInicio = document.getElementById('plantaoFeriasInicio');
  const feriasFim = document.getElementById('plantaoFeriasFim');
  const escalaInicio = document.getElementById('plantaoEscalaInicio');
  const escalaFim = document.getElementById('plantaoEscalaFim');
  const periodoInicio = document.getElementById('plantaoPeriodoInicio');
  const periodoFim = document.getElementById('plantaoPeriodoFim');
  if (feriasInicio && !feriasInicio.value) feriasInicio.value = hoje;
  if (feriasFim && !feriasFim.value) feriasFim.value = hoje;
  if (escalaInicio && !escalaInicio.value) escalaInicio.value = hoje;
  if (escalaFim && !escalaFim.value) escalaFim.value = hoje;
  if (periodoInicio && !periodoInicio.value) periodoInicio.value = hoje;
  if (periodoFim && !periodoFim.value) periodoFim.value = addDaysToDateInput(hoje, 6);
}

function alternarPlantaoPanel() {
  plantaoCollapsed = !plantaoCollapsed;
  renderPlantaoPanel();
}

function renderPlantaoPanel() {
  const panel = document.getElementById('plantaoPanel');
  if (!panel) return;
  const body = document.getElementById('plantaoBody');
  const icon = document.getElementById('plantaoToggleIcon');
  if (body) body.classList.toggle('hidden', plantaoCollapsed);
  if (icon) icon.textContent = plantaoCollapsed ? '+' : '-';

  const escreventesList = document.getElementById('plantaoEscreventesList');
  const feriasList = document.getElementById('plantaoFeriasList');
  const feriasSelect = document.getElementById('plantaoFeriasEscrevente');
  const periodoSelect = document.getElementById('plantaoPeriodoEscrevente');
  const escalaList = document.getElementById('plantaoEscalaList');
  const resumo = document.getElementById('plantaoResumo');

  const escreventeOptions = plantaoState.escreventes.length
    ? plantaoState.escreventes.map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.nome)}</option>`).join('')
    : '<option value="">Cadastre um escrevente</option>';
  if (feriasSelect) feriasSelect.innerHTML = escreventeOptions;
  if (periodoSelect) {
    const currentValue = periodoSelect.value;
    periodoSelect.innerHTML = escreventeOptions;
    if (currentValue) periodoSelect.value = currentValue;
  }

  if (escreventesList) {
    escreventesList.innerHTML = plantaoState.escreventes.length
      ? plantaoState.escreventes.map((item) => `
        <div class="plantao-row plantao-person-row" ${getPlantaoColorStyle(item.id)}>
          <span class="plantao-color-dot"></span>
          <span>${escapeHtml(item.nome)}</span>
          <button type="button" onclick="removerEscreventePlantao(${Number(item.id)})" title="Remover escrevente" aria-label="Remover escrevente">x</button>
        </div>
      `).join('')
      : '<div class="plantao-empty">Nenhum escrevente cadastrado.</div>';
  }

  if (feriasList) {
    feriasList.innerHTML = plantaoState.ferias.length
      ? [...plantaoState.ferias].sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))).map((item) => `
        <div class="plantao-row">
          <span>${escapeHtml(getPlantaoEscreventeNome(item.escreventeId))}</span>
          <small>${formatDateOnlyBr(item.inicio)} a ${formatDateOnlyBr(item.fim)}</small>
          <button type="button" onclick="removerFeriasPlantao(${Number(item.id)})" title="Remover ferias" aria-label="Remover ferias">x</button>
        </div>
      `).join('')
      : '<div class="plantao-empty">Nenhum periodo de ferias cadastrado.</div>';
  }

  const conflitos = plantaoState.escalas.filter((item) => item.conflito).length;
  if (resumo) {
    resumo.innerHTML = `
      <span>${getPlantaoEscalaPeriodos().length} periodos</span>
      <span>${plantaoState.escreventes.length} escreventes</span>
      <span class="${conflitos ? 'plantao-conflict-text' : ''}">${conflitos} conflitos</span>
    `;
  }

  if (escalaList) {
    const periodos = getPlantaoEscalaPeriodos();
    escalaList.innerHTML = periodos.length
      ? periodos.map((item) => `
        <div class="plantao-scale-row ${item.conflito ? 'conflict' : ''}" ${getPlantaoColorStyle(item.escreventeId, item.conflito)}>
          <strong>${formatDateOnlyBr(item.inicio)} a ${formatDateOnlyBr(item.fim)}</strong>
          <span>${item.conflito ? 'Conflito de ferias' : escapeHtml(getPlantaoEscreventeNome(item.escreventeId))}</span>
          ${item.observacao ? `<small>${escapeHtml(item.observacao)}</small>` : ''}
        </div>
      `).join('')
      : '<div class="plantao-empty">Gere a escala para visualizar os plantoes.</div>';
  }
}

async function salvarPlantaoViaApi(url, options, successMessage) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: authHeaders({ 'Content-Type': 'application/json', ...(options?.headers || {}) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao salvar escala');
    normalizarPlantaoState(data);
    renderPlantaoPanel();
    if (successMessage) mostrarNotificacao(successMessage, 'success');
  } catch (err) {
    mostrarNotificacao(err.message, 'error');
  }
}

async function adicionarEscreventePlantao() {
  const input = document.getElementById('plantaoNomeInput');
  const nome = input.value.trim();
  if (!nome) {
    mostrarNotificacao('Informe o nome do escrevente', 'warning');
    return;
  }
  await salvarPlantaoViaApi('/api/plantao/escreventes', {
    method: 'POST',
    body: JSON.stringify({ nome })
  }, 'Escrevente cadastrado');
  input.value = '';
}

async function removerEscreventePlantao(escreventeId) {
  if (!confirm('Remover este escrevente, suas ferias e escalas futuras?')) return;
  await salvarPlantaoViaApi(`/api/plantao/escreventes/${Number(escreventeId)}`, { method: 'DELETE' }, 'Escrevente removido');
}

async function adicionarFeriasPlantao() {
  const escreventeId = Number(document.getElementById('plantaoFeriasEscrevente').value);
  const inicio = document.getElementById('plantaoFeriasInicio').value;
  const fim = document.getElementById('plantaoFeriasFim').value;
  await salvarPlantaoViaApi('/api/plantao/ferias', {
    method: 'POST',
    body: JSON.stringify({ escreventeId, inicio, fim })
  }, 'Ferias adicionadas');
}

async function removerFeriasPlantao(feriasId) {
  await salvarPlantaoViaApi(`/api/plantao/ferias/${Number(feriasId)}`, { method: 'DELETE' }, 'Ferias removidas');
}

async function gerarEscalaPlantao() {
  const inicio = document.getElementById('plantaoEscalaInicio').value;
  const fim = document.getElementById('plantaoEscalaFim').value;
  await salvarPlantaoViaApi('/api/plantao/gerar-escala', {
    method: 'POST',
    body: JSON.stringify({ inicio, fim })
  }, 'Escala gerada');
}

async function cadastrarPeriodoPlantao() {
  const escreventeId = Number(document.getElementById('plantaoPeriodoEscrevente').value);
  const inicio = document.getElementById('plantaoPeriodoInicio').value;
  const fim = document.getElementById('plantaoPeriodoFim').value;
  await salvarPlantaoViaApi('/api/plantao/escala-periodo', {
    method: 'POST',
    body: JSON.stringify({ escreventeId, inicio, fim })
  }, 'Periodo cadastrado');
}

async function excluirEscalaPlantao() {
  if (!plantaoState.escalas.length) {
    mostrarNotificacao('Nao ha escala para excluir', 'info');
    return;
  }
  if (!confirm('Excluir toda a escala atual? Os escreventes e ferias cadastrados serao mantidos.')) return;
  await salvarPlantaoViaApi('/api/plantao/escala', { method: 'DELETE' }, 'Escala excluida');
}

async function carregarGrupos() {
  try {
    const response = await fetch('/api/grupos', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar grupos');
    gruposCache = await response.json();
    if (!Array.isArray(gruposCache)) gruposCache = [];
    renderGrupos();
    renderPinnedNotice();
    renderAvisosGrupoAdmin();
    atualizarVisibilidadePlantaoPanel();
    atualizarPainelInicialSeAberto();
  } catch (err) {
    console.error(err);
    gruposCache = [];
    renderGrupos();
    renderPinnedNotice();
    renderAvisosGrupoAdmin();
    atualizarVisibilidadePlantaoPanel();
    atualizarPainelInicialSeAberto();
  }
}

async function carregarContatos() {
  try {
    const response = await fetch('/api/usuarios', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar contatos');
    contatosCache = await response.json();
    if (!Array.isArray(contatosCache)) contatosCache = [];
    contatosCache = contatosCache.filter(u => Number(u.id) !== Number(usuarioAtual.id));
    renderContatos();
    atualizarPainelInicialSeAberto();
  } catch (err) {
    console.error(err);
    contatosCache = [];
    renderContatos();
    atualizarPainelInicialSeAberto();
  }
}

async function carregarResumoConversas() {
  try {
    const response = await fetch('/api/conversas/privadas/resumo', { headers: authHeaders() });
    if (!response.ok) return;
    const resumo = await response.json();
    if (!Array.isArray(resumo)) return;

    resumo.forEach(item => {
      const key = getChatKey('privado', item.usuarioId);
      unreadState[key] = item.naoLidas || 0;
      lastPreviewState[key] = item.ultimaMensagem || '';
      lastTimeState[key] = item.criado_em ? formatTime(item.criado_em) : '';
      lastTimestampState[key] = item.criado_em ? toTimestamp(item.criado_em) : 0;
    });

    renderContatos();
    updateBrowserTitle();
    atualizarPainelInicialSeAberto();
  } catch (err) {
    console.error(err);
  }
}

function renderGrupos() {
  const gruposList = document.getElementById('gruposList');
  gruposList.innerHTML = '';

  const gruposFiltrados = sortByRecent(gruposCache, 'grupo').filter((grupo) => {
    const key = getChatKey('grupo', grupo.id);
    const unread = unreadState[key] || 0;
    if (!conversationMatchesFilter(key, { tipo: 'grupo', unread })) return false;
    return chatMatchesSearch([grupo.nome, grupo.descricao], key);
  });

  if (!gruposFiltrados.length) {
    gruposList.innerHTML = `<div class="empty-list">Nenhum grupo encontrado</div>`;
    return;
  }

  gruposFiltrados.forEach(grupo => {
    const key = getChatKey('grupo', grupo.id);
    const unread = unreadState[key] || 0;
    const typingPreviewHtml = getTypingPreviewHtml('grupo', grupo.id);
    const isPriority = priorityChats.has(key);
    const isFavorite = favoriteChats.has(key);
    const attendanceStatus = getAttendanceStatus(key);

    const item = document.createElement('div');
    item.className = `chat-item ${tipoChat === 'grupo' && Number(chatIdAtual) === Number(grupo.id) ? 'active' : ''} ${unread > 0 ? 'unread' : ''} ${isPriority ? 'priority' : ''} ${attendanceStatus ? `attendance-${attendanceStatus}` : ''}`;
    item.innerHTML = `
      <div class="chat-icon group">#</div>
      <div class="chat-details">
        <div class="chat-top">
          <div class="chat-name">${isFavorite ? '★ ' : ''}${escapeHtml(grupo.nome)}</div>
          <div class="chat-time">${lastTimeState[key] || ''}</div>
        </div>
        <div class="chat-preview-row">
          <div class="chat-preview">${typingPreviewHtml || escapeHtml(lastPreviewState[key] || grupo.descricao || 'Sem mensagens recentes')}</div>
          ${unread > 0 ? `<span class="notification-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
        ${getAttendanceChipHtml(key)}
        ${isPriority ? '<div class="priority-chip">Prioridade</div>' : ''}
      </div>
    `;
    item.addEventListener('click', () => carregarChat('grupo', grupo.id, grupo.nome));
    gruposList.appendChild(item);
  });
}

function renderContatos() {
  const contatosList = document.getElementById('contatosList');
  contatosList.innerHTML = '';

  const onlineContainer = document.createElement('div');
  onlineContainer.className = 'contact-group-items';

  const offlineContainer = document.createElement('div');
  offlineContainer.className = 'contact-group-items';

  const gruposContatos = document.createElement('div');
  gruposContatos.className = 'contact-groups';

  const criarGrupoContatos = (titulo, quantidade, container, extraClass = '') => {
    const group = document.createElement('div');
    group.className = `contact-group ${extraClass}`.trim();
    group.innerHTML = `
      <div class="contact-group-header">
        <div class="contact-group-title">${titulo}</div>
        <span class="contact-group-count ${quantidade ? '' : 'zero'}">${quantidade}</span>
      </div>
    `;
    group.appendChild(container);
    return group;
  };

  const contatosOrdenados = sortByRecent(contatosCache, 'privado').filter((usuario) => {
    const key = getChatKey('privado', usuario.id);
    const unread = unreadState[key] || 0;
    const online = onlineState.has(Number(usuario.id));
    if (!conversationMatchesFilter(key, { tipo: 'privado', unread, online })) return false;
    return chatMatchesSearch([usuario.nome, usuario.email], key);
  });
  const contatosOnline = contatosOrdenados.filter(usuario => onlineState.has(Number(usuario.id)));
  const contatosOffline = contatosOrdenados.filter(usuario => !onlineState.has(Number(usuario.id)));

  const criarItemContato = (usuario, online) => {
    const key = getChatKey('privado', usuario.id);
    const unread = unreadState[key] || 0;
    const isPriority = priorityChats.has(key);
    const isFavorite = favoriteChats.has(key);
    const attendanceStatus = getAttendanceStatus(key);
    const senhaPainel = String(usuario.senha_painel || '').trim();
    const typingPreviewHtml = getTypingPreviewHtml('privado', usuario.id);
    const status = getUserStatus(usuario.id);
    const preview = lastPreviewState[key] || (online ? 'Online agora' : usuario.email);
    const atendimentoHtml = senhaPainel
      ? `<div class="contact-ticket-note">Senha: ${escapeHtml(senhaPainel)}</div>`
      : '';
    const statusHtml = online
      ? `<div class="status-chip ${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</div>`
      : '<div class="status-chip offline">Offline</div>';

    const item = document.createElement('div');
    item.className = `chat-item ${tipoChat === 'privado' && Number(chatIdAtual) === Number(usuario.id) ? 'active' : ''} ${unread > 0 ? 'unread' : ''} ${isPriority ? 'priority' : ''} ${attendanceStatus ? `attendance-${attendanceStatus}` : ''}`;
    item.innerHTML = `
      <div class="chat-icon private" ${avatarStyle(usuario.nome || usuario.email)}>
        ${escapeHtml(initials(usuario.nome))}
        <span class="presence-dot ${online ? 'online' : ''}"></span>
      </div>
      <div class="chat-details">
        <div class="chat-top">
          <div class="chat-name">${isFavorite ? '★ ' : ''}${escapeHtml(usuario.nome)}</div>
          <div class="chat-time">${lastTimeState[key] || ''}</div>
        </div>
        <div class="chat-preview-row">
          <div class="chat-preview">${typingPreviewHtml || escapeHtml(preview)}</div>
          ${unread > 0 ? `<span class="notification-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
        ${atendimentoHtml}
        ${getAttendanceChipHtml(key)}
        ${statusHtml}
        ${isPriority ? '<div class="priority-chip">Prioridade</div>' : ''}
      </div>
    `;
    item.addEventListener('click', () => carregarChat('privado', usuario.id, usuario.nome));
    return item;
  };

  contatosOnline.forEach(usuario => {
    onlineContainer.appendChild(criarItemContato(usuario, true));
  });

  contatosOffline.forEach(usuario => {
    offlineContainer.appendChild(criarItemContato(usuario, false));
  });

  gruposContatos.appendChild(criarGrupoContatos('Online', contatosOnline.length, onlineContainer, 'online-group'));
  gruposContatos.appendChild(criarGrupoContatos('Offline', contatosOffline.length, offlineContainer, 'offline-group'));
  contatosList.appendChild(gruposContatos);

  if (!contatosOrdenados.length) {
    contatosList.innerHTML = `<div class="empty-list">Nenhum contato encontrado</div>`;
  }
}

async function carregarChat(tipo, id, nome) {
  tipoChat = tipo;
  chatIdAtual = id;
  currentMessageSearch = '';
  currentMessagesCache = [];
  currentMessagesHasMore = false;
  currentMessagesNextBefore = null;
  currentMessagesLoadingOlder = false;
  activeReplyMessageId = null;
  editingMessageId = null;
  document.getElementById('messageSearchInput').value = '';
  document.getElementById('messageInput').value = '';
  autoResizeComposer();
  atualizarBarraContexto();

  unreadState[getChatKey(tipo, id)] = 0;
  renderGrupos();
  renderContatos();
  updateBrowserTitle();

  typingUsers.delete(`${tipo}-${id}`);
  renderTypingSurfaces();

  document.getElementById('headerTitle').textContent = (tipo === 'grupo' ? '# ' : '') + nome;
  updateHeaderIcon(tipo, nome);
  updateHeaderStatus();
  renderPinnedNotice();
  renderPinnedMessageBar();
  atualizarBotaoFavorito();
  atualizarVisibilidadePlantaoPanel();
  const messagesContainer = document.getElementById('messagesContainer');
  messagesContainer.classList.add('preparing-scroll');
  messagesContainer.innerHTML = '';

  try {
    const endpoint = tipo === 'grupo'
      ? `/api/mensagens/grupo/${id}?limit=${MESSAGE_PAGE_SIZE}`
      : `/api/mensagens/privadas/${id}?limit=${MESSAGE_PAGE_SIZE}`;

    const response = await fetch(endpoint, { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar mensagens');

    const payload = await response.json();
    const mensagens = Array.isArray(payload) ? payload : payload.mensagens;
    currentMessagesHasMore = Boolean(payload?.hasMore);
    currentMessagesNextBefore = payload?.nextBefore || (Array.isArray(mensagens) && mensagens.length ? mensagens[0].criado_em : null);
    currentMessagesCache = Array.isArray(mensagens)
      ? mensagens.map((msg) => normalizeMessage({
          ...msg,
          usuarioNome: msg.usuario_nome,
          usuarioId: msg.usuario_id,
          showReactionPicker: false
        }))
      : [];
    renderMessages({ stabilizeBottom: true });

    if (tipo === 'grupo') {
      socket.emit('entrar-grupo', { grupoId: id, usuarioId: usuarioAtual.id });
      socket.emit('marcar-lidas-grupo', { grupoId: id, usuarioId: usuarioAtual.id });
    } else {
      socket.emit('marcar-lidas', { remetenteId: id, destinatarioId: usuarioAtual.id });
    }
  } catch (err) {
    console.error(err);
    messagesContainer.classList.remove('preparing-scroll');
    mostrarNotificacao('Erro ao carregar conversa', 'error');
  }
}

function getReactionUsers(emojiMap, emoji) {
  const users = emojiMap?.[emoji];
  return Array.isArray(users) ? users.map(Number) : [];
}

function renderMessageRow(message) {
  const ehOutro = Number(message.usuarioId) !== Number(usuarioAtual.id);
  const isPriorityMessage = isMensagemPrioritaria(message.id);
  const horarioMensagem = formatMessageTimestamp(message.criado_em || new Date());
  const query = currentMessageSearch;
  const resumoLeituraGrupo = !ehOutro && tipoChat === 'grupo'
    ? getResumoLeituraGrupo(message)
    : null;
  const replyHtml = message.reply_preview
    ? `
      <div class="message-reply-preview">
        <div class="reply-quote-label">Resposta</div>
        <div class="reply-author">${escapeHtml(message.reply_preview.usuario_nome || 'Mensagem')}</div>
        <div class="reply-snippet">${highlightText(message.reply_preview.conteudo || '', query)}</div>
      </div>
    `
    : '';
  const editedHtml = message.editado_em ? `<span class="message-edited">(editada)</span>` : '';
  const filePreviewHtml = message.tipo === 'arquivo' && isImageAttachment(message)
    ? `<div class="file-preview"><img src="${escapeHtml(message.arquivo_url)}" alt="${escapeHtml(message.arquivo_nome_original || 'Imagem anexada')}" loading="lazy" /></div>`
    : message.tipo === 'arquivo' && isPdfAttachment(message)
      ? `<div class="file-preview pdf"><span>&#128196;</span><span>Previa de PDF disponivel ao abrir o arquivo</span></div>`
      : message.tipo === 'arquivo' && isVideoAttachment(message)
        ? `<div class="file-preview video"><video src="${escapeHtml(message.arquivo_url)}" controls preload="metadata"></video></div>`
      : '';
  const innerContent = message.tipo === 'arquivo'
    ? `<a class="file-card" href="${escapeHtml(message.arquivo_url)}" target="_blank" rel="noopener noreferrer">
         <strong>&#128206; ${highlightText(message.arquivo_nome_original, query)}</strong>
         <small>${escapeHtml(formatFileSize(message.arquivo_tamanho))}</small>
       </a>${filePreviewHtml}`
    : `<div class="message-text">${linkifyTextHtml(message.conteudo, query)}</div>${getLinkPreviewHtml(message.conteudo)}`;

  const reactions = Object.entries(message.reacoes || {});
  const reactionsHtml = reactions.length
    ? `<div class="message-reactions">
        ${reactions.map(([emoji, users]) => {
          const userIds = Array.isArray(users) ? users.map(Number) : [];
          const active = userIds.includes(Number(usuarioAtual.id));
          const nomes = getReactionNames(message, emoji, userIds);
          const title = nomes.length
            ? `${emoji} ${nomes.join(', ')}`
            : `${emoji} Sem reacoes`;
          const label = nomes.length === 1
            ? nomes[0]
            : `${userIds.length} pessoas`;
          return `<button class="reaction-chip ${active ? 'active' : ''}" onclick="alternarReacao(${Number(message.id)}, '${escapeHtml(emoji).replace(/'/g, '&#039;')}')" title="${escapeHtml(title)}"><span>${escapeHtml(emoji)} ${userIds.length}</span><small>${escapeHtml(label)}</small></button>`;
        }).join('')}
      </div>`
    : '';

  const actionButtons = `
    <span class="message-actions">
      <button class="message-action-btn ${isPriorityMessage ? 'active' : ''}" onclick="alternarPrioridadeMensagem(${Number(message.id)})" title="${isPriorityMessage ? 'Remover destaque da mensagem' : 'Destacar mensagem como prioridade'}" aria-label="${isPriorityMessage ? 'Remover destaque da mensagem' : 'Destacar mensagem como prioridade'}" aria-pressed="${isPriorityMessage ? 'true' : 'false'}">!</button>
      <button class="message-action-btn ${isMensagemFixada(message.id) ? 'active' : ''}" onclick="alternarFixarMensagem(${Number(message.id)})" title="${isMensagemFixada(message.id) ? 'Desfixar mensagem' : 'Fixar mensagem no topo da conversa'}" aria-label="${isMensagemFixada(message.id) ? 'Desfixar mensagem' : 'Fixar mensagem no topo da conversa'}" aria-pressed="${isMensagemFixada(message.id) ? 'true' : 'false'}">📌</button>
      <button class="message-action-btn" onclick="responderMensagem(${Number(message.id)})" title="Responder">&#8617;</button>
      <button class="message-action-btn" onclick="copiarMensagem(${Number(message.id)})" title="Copiar mensagem">&#128203;</button>
      <button class="message-action-btn" onclick="abrirEncaminharMensagem(${Number(message.id)})" title="Encaminhar">&#10150;</button>
      ${ehOutro && tipoChat === 'privado' ? `<button class="message-action-btn" onclick="marcarConversaComoNaoLida(${Number(message.id)}, ${Number(message.usuarioId)})" title="Marcar conversa como não lida">Nao lido</button>` : ''}
      ${!ehOutro && message.tipo === 'texto' ? `<button class="message-action-btn" onclick="prepararEdicaoMensagem(${Number(message.id)})" title="Editar">&#9998;</button>` : ''}
      <button class="message-action-btn" onclick="alternarReacaoRapida(${Number(message.id)})" title="Reagir">+</button>
      ${!ehOutro ? `<button class="message-delete-btn" onclick="apagarMensagem(${Number(message.id)})" title="Apagar mensagem">&#128465;</button>` : ''}
    </span>
  `;

  const pickerHtml = message.showReactionPicker
    ? `<div class="reaction-picker">
        ${REACTION_OPTIONS.map((emoji) => `<button class="reaction-picker-btn" onclick="alternarReacao(${Number(message.id)}, '${emoji}')" title="Reagir com ${emoji}">${emoji}</button>`).join('')}
      </div>`
    : '';
  const priorityBadgeHtml = isPriorityMessage
    ? '<div class="message-priority-badge">Mensagem prioritária</div>'
    : '';

  if (ehOutro) {
    const nomeMensagem = message.usuarioNome || message.usuario_nome || 'Usuario';
    return `
      <div class="message-avatar" ${avatarStyle(nomeMensagem)}>${escapeHtml(initials(nomeMensagem))}</div>
      <div class="message other">
        ${priorityBadgeHtml}
        <div class="message-sender">${escapeHtml(nomeMensagem)}</div>
        ${replyHtml}
        ${innerContent}
        ${reactionsHtml}
        ${pickerHtml}
        <div class="message-time">${actionButtons} ${editedHtml} <span class="message-timestamp">${escapeHtml(horarioMensagem)}</span></div>
      </div>
    `;
  }

  const statusClass = tipoChat === 'grupo'
    ? (getLeiturasGrupo(message).length ? 'lida' : '')
    : (message.lido ? 'lida' : '');
  const statusTitle = tipoChat === 'grupo'
    ? (resumoLeituraGrupo?.tooltip || '')
    : (message.lido ? 'Mensagem lida' : 'Mensagem enviada');
  // Checkmarks visuais: ✓ enviada, ✓✓(azul) lida
  const SVG_CHECK_SINGLE = `<svg class="check-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="3,9 7,13 13,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const SVG_CHECK_DOUBLE = `<svg class="check-icon check-double" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="1,9 5,13 11,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6,9 10,13 16,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const statusText = tipoChat === 'grupo'
    ? (getLeiturasGrupo(message).length ? SVG_CHECK_DOUBLE : SVG_CHECK_SINGLE)
    : (message.lido ? SVG_CHECK_DOUBLE : SVG_CHECK_SINGLE);
  const resumoHtml = tipoChat === 'grupo'
    ? `<div class="message-read-summary ${resumoLeituraGrupo?.total ? 'has-readers' : ''}" title="${escapeHtml(resumoLeituraGrupo?.tooltip || '')}"><strong>Leitura:</strong> ${escapeHtml(resumoLeituraGrupo?.detalhe || 'Ninguem do grupo leu ainda')}</div>`
    : '';

  return `
    <div class="message-avatar" ${avatarStyle(usuarioAtual.nome || usuarioAtual.email)}>${escapeHtml(initials(usuarioAtual.nome))}</div>
    <div class="message own">
      ${priorityBadgeHtml}
      <div class="message-sender">${escapeHtml(usuarioAtual.nome || 'Voce')}</div>
      ${replyHtml}
      ${innerContent}
      ${reactionsHtml}
      ${pickerHtml}
      <div class="message-time">${actionButtons} ${editedHtml} <span class="message-timestamp">${escapeHtml(horarioMensagem)}</span> <span class="message-status ${statusClass}" title="${escapeHtml(statusTitle)}">${statusText}</span></div>
      ${resumoHtml}
    </div>
  `;
}

function scrollMessagesToBottom({ stabilize = false } = {}) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const applyScroll = () => {
    container.scrollTop = container.scrollHeight;
    container.classList.remove('preparing-scroll');
  };

  applyScroll();
  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });

  if (!stabilize) return;

  initialScrollLockTimers.forEach(clearTimeout);
  initialScrollLockTimers = [80, 180, 420, 900].map((delay) => setTimeout(applyScroll, delay));

  container.querySelectorAll('img, video').forEach((media) => {
    if (media.complete || media.readyState >= 1) return;
    media.addEventListener('load', applyScroll, { once: true });
    media.addEventListener('loadedmetadata', applyScroll, { once: true });
  });
}

function renderMessages(options = {}) {
  const { scrollToBottom = true, stabilizeBottom = false } = options;
  const container = document.getElementById('messagesContainer');
  const allFiltered = currentMessagesCache.filter((message) => isMessageMatch(message, currentMessageSearch));
  const hasRenderLimit = !currentMessageSearch && allFiltered.length > MESSAGE_RENDER_LIMIT;
  const filtered = hasRenderLimit ? allFiltered.slice(-MESSAGE_RENDER_LIMIT) : allFiltered;

  if (!allFiltered.length) {
    container.innerHTML = currentMessageSearch
      ? `
        <div class="empty-state">
          <span class="emoji">&#128269;</span>
          <div style="font-weight:800; margin-bottom:8px; color:#e5e7eb;">Nenhum resultado</div>
          <div>Tente buscar por outro termo nesta conversa.</div>
        </div>
      `
      : `
        <div class="empty-state">
          <span class="emoji">&#128172;</span>
          <div style="font-weight:800; margin-bottom:8px; color:#e5e7eb;">Nenhuma mensagem ainda</div>
          <div>Envie a primeira mensagem desta conversa.</div>
        </div>
      `;
    container.classList.remove('preparing-scroll');
    return;
  }

  let lastRenderedDay = '';
  let previousMessage = null;
  const loadOlderHtml = currentMessagesHasMore && !currentMessageSearch
    ? `<div class="load-older-wrap"><button class="load-older-btn" onclick="carregarMensagensAnteriores()" ${currentMessagesLoadingOlder ? 'disabled' : ''}>${currentMessagesLoadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}</button></div>`
    : '';
  const renderLimitHtml = hasRenderLimit
    ? `<div class="message-render-note">Mostrando as ${MESSAGE_RENDER_LIMIT} mensagens mais recentes para manter o chat rapido.</div>`
    : '';
  container.innerHTML = loadOlderHtml + renderLimitHtml + filtered.map((message) => {
    const ehOutro = Number(message.usuarioId) !== Number(usuarioAtual.id);
    const currentDay = formatCalendarDayLabel(message.criado_em || new Date());
    const dividerHtml = currentDay && currentDay !== lastRenderedDay
      ? `<div class="message-date-divider"><span>${escapeHtml(currentDay)}</span></div>`
      : '';
    const compact = !dividerHtml &&
      previousMessage &&
      Number(previousMessage.usuarioId) === Number(message.usuarioId) &&
      Math.abs(toTimestamp(message.criado_em) - toTimestamp(previousMessage.criado_em)) < 5 * 60 * 1000;
    lastRenderedDay = currentDay || lastRenderedDay;
    previousMessage = message;
    const priorityClass = isMensagemPrioritaria(message.id) ? 'message-priority-row' : '';
    return `${dividerHtml}<div class="message-row ${ehOutro ? '' : 'own'} ${compact ? 'compact' : ''} ${priorityClass}" data-message-id="${Number(message.id)}" data-usuario-id="${Number(message.usuarioId || 0)}">${renderMessageRow(message)}</div>`;
  }).join('');
  if (scrollToBottom) scrollMessagesToBottom({ stabilize: stabilizeBottom });
  else container.classList.remove('preparing-scroll');
}

async function carregarMensagensAnteriores() {
  if (!tipoChat || !chatIdAtual || !currentMessagesHasMore || currentMessagesLoadingOlder || !currentMessagesNextBefore) return;
  const container = document.getElementById('messagesContainer');
  const previousHeight = container.scrollHeight;
  currentMessagesLoadingOlder = true;
  renderMessages({ scrollToBottom: false });

  try {
    const endpoint = tipoChat === 'grupo'
      ? `/api/mensagens/grupo/${chatIdAtual}?limit=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(currentMessagesNextBefore)}`
      : `/api/mensagens/privadas/${chatIdAtual}?limit=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(currentMessagesNextBefore)}`;
    const response = await fetch(endpoint, { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar historico');
    const payload = await response.json();
    const mensagens = Array.isArray(payload) ? payload : payload.mensagens;
    const older = Array.isArray(mensagens)
      ? mensagens.map((msg) => normalizeMessage({
          ...msg,
          usuarioNome: msg.usuario_nome,
          usuarioId: msg.usuario_id,
          showReactionPicker: false
        }))
      : [];

    const existingIds = new Set(currentMessagesCache.map((message) => Number(message.id)));
    currentMessagesCache = [
      ...older.filter((message) => !existingIds.has(Number(message.id))),
      ...currentMessagesCache
    ].sort((a, b) => toTimestamp(a.criado_em) - toTimestamp(b.criado_em));
    currentMessagesHasMore = Boolean(payload?.hasMore);
    currentMessagesNextBefore = payload?.nextBefore || (currentMessagesCache.length ? currentMessagesCache[0].criado_em : null);
  } catch (err) {
    mostrarNotificacao('Erro ao carregar historico: ' + err.message, 'error');
  } finally {
    currentMessagesLoadingOlder = false;
    renderMessages({ scrollToBottom: false });
    container.scrollTop = Math.max(0, container.scrollHeight - previousHeight);
  }
}

function abrirBuscaGlobal() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('globalSearchResults').textContent = 'Digite um termo para buscar.';
  document.getElementById('globalSearchModal').classList.add('active');
  setTimeout(() => document.getElementById('globalSearchInput').focus(), 50);
}

function executarBuscaGlobal(value) {
  clearTimeout(globalSearchTimer);
  const query = String(value || '').trim();
  const results = document.getElementById('globalSearchResults');
  if (query.length < 2) {
    results.textContent = 'Digite pelo menos 2 letras.';
    return;
  }
  results.textContent = 'Buscando...';
  globalSearchTimer = setTimeout(async () => {
    try {
      const response = await fetch(`/api/busca-global?q=${encodeURIComponent(query)}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('Falha na busca');
      const data = await response.json();
      const encontrados = Array.isArray(data.resultados) ? data.resultados : [];
      if (!encontrados.length) {
        results.textContent = 'Nenhum resultado encontrado.';
        return;
      }
      results.innerHTML = encontrados.map((item) => `
        <div class="global-search-result" onclick="abrirResultadoBusca('${escapeHtml(item.tipoChat)}', ${Number(item.chatId)}, '${escapeHtml(item.chatNome).replace(/'/g, '&#039;')}', ${Number(item.id)})">
          <strong>${escapeHtml(item.chatNome)} · ${escapeHtml(item.usuario_nome || 'Usuario')}</strong>
          <div>${highlightText(item.conteudo || '', query)}</div>
          <small>${escapeHtml(formatMessageTimestamp(item.criado_em))}</small>
        </div>
      `).join('');
    } catch (err) {
      results.textContent = 'Erro ao buscar: ' + err.message;
    }
  }, 250);
}

async function abrirResultadoBusca(tipo, id, nome, messageId) {
  fecharModal('globalSearchModal');
  await carregarChat(tipo, id, nome);
  setTimeout(() => {
    const row = document.querySelector(`[data-message-id="${Number(messageId)}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('unread');
      setTimeout(() => row.classList.remove('unread'), 1800);
    }
  }, 300);
}

function exportarConversaTxt() {
  if (!tipoChat || !chatIdAtual || !currentMessagesCache.length) {
    mostrarNotificacao('Abra uma conversa com mensagens para exportar', 'error');
    return;
  }
  const title = document.getElementById('headerTitle').textContent || 'Conversa';
  const lines = [
    `Exportacao da conversa: ${title}`,
    `Gerado em: ${formatMessageTimestamp(new Date())}`,
    ''
  ];
  currentMessagesCache.forEach((message) => {
    const author = message.usuarioNome || message.usuario_nome || 'Usuario';
    lines.push(`[${formatMessageTimestamp(message.criado_em)}] ${author}: ${getMessageCopyText(message)}`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `conversa-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function upsertMessageInCache(message) {
  const normalized = normalizeMessage(message);
  const index = currentMessagesCache.findIndex((item) => Number(item.id) === Number(normalized.id));
  if (index >= 0) currentMessagesCache[index] = { ...currentMessagesCache[index], ...normalized };
  else currentMessagesCache.push(normalized);
  currentMessagesCache.sort((a, b) => toTimestamp(a.criado_em) - toTimestamp(b.criado_em));
  renderMessages();
}

function replaceTemporaryMessage(clientTempId, message) {
  const normalized = normalizeMessage(message);
  const index = currentMessagesCache.findIndex((item) => String(item.client_temp_id || '') === String(clientTempId || ''));
  if (index >= 0) {
    currentMessagesCache[index] = { ...currentMessagesCache[index], ...normalized, client_temp_id: null };
  } else {
    currentMessagesCache.push(normalized);
  }
  currentMessagesCache.sort((a, b) => toTimestamp(a.criado_em) - toTimestamp(b.criado_em));
  renderMessages();
}

function marcarMensagensComoLidasNaTela(remetenteId) {
  currentMessagesCache = currentMessagesCache.map((message) => (
    Number(message.usuarioId) === Number(usuarioAtual.id)
      ? { ...message, lido: 1 }
      : message
  ));
  renderMessages();

  const key = getChatKey('privado', remetenteId);
  unreadState[key] = 0;
  renderContatos();
  updateBrowserTitle();
}

function removerMensagemDaTela(messageId) {
  currentMessagesCache = currentMessagesCache.filter((message) => Number(message.id) !== Number(messageId));
  if (Number(activeReplyMessageId) === Number(messageId)) activeReplyMessageId = null;
  if (Number(editingMessageId) === Number(messageId)) editingMessageId = null;
  atualizarBarraContexto();
  renderMessages();
}

async function marcarConversaComoNaoLida(messageId, contatoId) {
  try {
    if (tipoChat !== 'privado' || !contatoId) return;

    const response = await fetch(`/api/conversas/privadas/${Number(contatoId)}/marcar-nao-lida`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ messageId: Number(messageId) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao marcar conversa como não lida', 'error');
      return;
    }

    const key = getChatKey('privado', contatoId);
    unreadState[key] = Math.max(getPrivateChatUnreadCount(contatoId), Number(data.naoLidas) || 1);
    renderContatos();
    updateBrowserTitle();
    mostrarNotificacao('Conversa marcada como não lida', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao marcar conversa como não lida: ' + err.message, 'error');
  }
}

async function atualizarChatAposExclusao(data) {
  removerMensagemDaTela(data.messageId);

  if (data.tipoChat === 'grupo') {
    await carregarGrupos();
  } else {
    await carregarResumoConversas();
    await carregarContatos();
  }

  updateBrowserTitle();
}

async function apagarMensagem(messageId) {
  if (!confirm('Apagar esta mensagem?')) return;

  try {
    const response = await fetch(`/api/mensagens/${messageId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao apagar mensagem', 'error');
      return;
    }

    await atualizarChatAposExclusao(data);
    mostrarNotificacao('Mensagem apagada com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao apagar mensagem: ' + err.message, 'error');
  }
}

function alternarReacaoRapida(messageId) {
  currentMessagesCache = currentMessagesCache.map((message) => ({
    ...message,
    showReactionPicker: Number(message.id) === Number(messageId) ? !message.showReactionPicker : false
  }));
  renderMessages();
}

async function alternarReacao(messageId, emoji) {
  try {
    const response = await fetch(`/api/mensagens/${messageId}/reacoes`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ emoji })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao reagir à mensagem', 'error');
      return;
    }

    upsertMessageInCache({ ...data.message, showReactionPicker: false });
  } catch (err) {
    mostrarNotificacao('Erro ao reagir: ' + err.message, 'error');
  }
}

async function salvarEdicaoMensagem() {
  const conteudo = document.getElementById('messageInput').value.trim();
  if (!editingMessageId || !conteudo) return;

  try {
    const response = await fetch(`/api/mensagens/${editingMessageId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conteudo })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao editar mensagem', 'error');
      return;
    }

    upsertMessageInCache(data.message);
    const key = getChatKey(tipoChat, chatIdAtual);
    lastPreviewState[key] = `Voce: ${conteudo}`;
    lastTimeState[key] = formatTime(data.message.editado_em || data.message.criado_em);
    lastTimestampState[key] = toTimestamp(data.message.editado_em || data.message.criado_em);
    if (tipoChat === 'grupo') renderGrupos();
    else renderContatos();
    limparContextoMensagem();
    mostrarNotificacao('Mensagem editada com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao editar: ' + err.message, 'error');
  }
}

function emitirDigitando() {
  if (!socket || !tipoChat || !chatIdAtual) return;

  socket.emit('digitando', {
    tipo: tipoChat,
    chatId: chatIdAtual,
    usuarioId: usuarioAtual.id,
    usuarioNome: usuarioAtual.nome
  });
}

function enviarMensagem() {
  const input = document.getElementById('messageInput');
  const conteudo = input.value.trim();
  if (!tipoChat || !chatIdAtual) return;
  if (editingMessageId) {
    salvarEdicaoMensagem();
    return;
  }
  if (!conteudo) return;

  const key = getChatKey(tipoChat, chatIdAtual);
  lastPreviewState[key] = `Voce: ${conteudo}`;
  lastTimeState[key] = formatTime();
  lastTimestampState[key] = Date.now();
  const replyToId = activeReplyMessageId ? Number(activeReplyMessageId) : null;

  if (tipoChat === 'grupo') {
    socket.emit('mensagem-grupo', {
      grupoId: chatIdAtual,
      usuarioId: usuarioAtual.id,
      usuarioNome: usuarioAtual.nome,
      conteudo,
      replyToId
    });
    renderGrupos();
  } else {
    const clientTempId = `temp-${Date.now()}`;
    const replyMessage = replyToId ? getMessageByIdFromCache(replyToId) : null;
    upsertMessageInCache({
      id: Date.now(),
      client_temp_id: clientTempId,
      conteudo,
      usuarioNome: usuarioAtual.nome,
      criado_em: new Date().toISOString(),
      lido: 0,
      usuarioId: usuarioAtual.id,
      tipo: 'texto',
      reply_to_id: replyToId,
      reply_preview: replyMessage ? {
        id: replyMessage.id,
        usuario_nome: replyMessage.usuarioNome || replyMessage.usuario_nome || 'Mensagem',
        conteudo: getMessageSnippet(replyMessage)
      } : null
    });

    socket.emit('mensagem-privada', {
      remetente_id: usuarioAtual.id,
      destinatario_id: chatIdAtual,
      remetenteNome: usuarioAtual.nome,
      conteudo,
      replyToId,
      client_temp_id: clientTempId
    });

    renderContatos();
  }

  updateBrowserTitle();
  input.value = '';
  autoResizeComposer();
  input.focus();
  fecharEmojiPicker();
  activeReplyMessageId = null;
  atualizarBarraContexto();
}

async function enviarArquivoSelecionado(arquivo, options = {}) {
  const input = document.getElementById('fileInput');
  const clearInput = options.clearInput !== false;
  if (!arquivo) return;
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Selecione um grupo ou contato antes de enviar arquivo', 'error');
    if (clearInput) input.value = '';
    return;
  }

  try {
    setUploadStatus(`Enviando ${arquivo.name}...`);
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('tipoChat', tipoChat);
    formData.append('chatId', chatIdAtual);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.erro || 'Erro ao enviar arquivo');
    }

    const key = getChatKey(tipoChat, chatIdAtual);
    lastPreviewState[key] = `Voce: Arquivo: ${data.arquivo_nome_original}`;
    lastTimeState[key] = formatTime(data.criado_em || new Date());
    lastTimestampState[key] = toTimestamp(data.criado_em || new Date());

    upsertMessageInCache({
      ...data,
      usuarioNome: usuarioAtual.nome,
      usuarioId: usuarioAtual.id,
      tipo: 'arquivo',
      showReactionPicker: false
    });

    if (tipoChat === 'grupo') renderGrupos();
    else renderContatos();

    setUploadStatus(`Arquivo enviado: ${arquivo.name}`);
    setTimeout(() => setUploadStatus(''), 4000);
    activeReplyMessageId = null;
    atualizarBarraContexto();
  } catch (err) {
    setUploadStatus('');
    mostrarNotificacao(err.message, 'error');
  } finally {
    if (clearInput) input.value = '';
  }
}

async function enviarArquivo() {
  const input = document.getElementById('fileInput');
  const arquivo = input.files[0];
  await enviarArquivoSelecionado(arquivo, { clearInput: true });
}

async function confirmarEnvioArquivo(arquivo, origem = 'arquivo') {
  if (!arquivo) return;
  const tamanho = formatFileSize(arquivo.size);
  const ok = confirm(`Enviar ${origem}?\n\n${arquivo.name || 'arquivo'} (${tamanho})`);
  if (!ok) return;
  await enviarArquivoSelecionado(arquivo, { clearInput: origem !== 'imagem colada' });
}

async function lidarColarArquivo(event) {
  const items = Array.from(event.clipboardData?.items || []);
  const files = items
    .filter((item) => item.kind === 'file')
    .map((item) => normalizeClipboardFile(item.getAsFile()))
    .filter(Boolean);

  if (!files.length) return;

  event.preventDefault();
  await confirmarEnvioArquivo(files[0], files[0]?.type?.startsWith('image/') ? 'imagem colada' : 'arquivo colado');
}

function enviarSeEnter(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    enviarMensagem();
  }
}

async function carregarUsuariosAdmin() {
  try {
    const response = await fetch('/api/admin/usuarios', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar usuários');
    const usuarios = await response.json();
    adminUsuariosCache = Array.isArray(usuarios) ? usuarios : [];
    renderGrupoMembrosSelector();
    const tbody = document.getElementById('adminUsuariosTable');
    tbody.innerHTML = '';

    adminUsuariosCache.forEach(usuario => {
      const tr = document.createElement('tr');
      const online = onlineState.has(Number(usuario.id));
      tr.innerHTML = `
        <td>${escapeHtml(usuario.nome)}</td>
        <td>${escapeHtml(usuario.email)}</td>
        <td>${usuario.admin ? 'Sim' : 'Não'}</td>
        <td>${usuario.ativo ? (online ? 'Ativo / Online' : 'Ativo') : 'Inativo'}</td>
        <td class="table-actions">
          <button class="mini-btn btn-secondary" onclick="redefinirSenhaUsuario(${usuario.id}, '${escapeHtml(usuario.nome).replace(/'/g, "\\'")}')">Senha</button>
          ${Number(usuario.id) !== Number(usuarioAtual.id) ? `<button class="mini-btn btn-danger" onclick="desativarUsuario(${usuario.id})">Desativar</button>` : '-'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    mostrarNotificacao('Erro ao carregar usuários', 'error');
  }
}

function renderAgendamentoBackupAdmin() {
  const ativo = document.getElementById('adminBackupAutoAtivo');
  const horario = document.getElementById('adminBackupAutoHorario');
  const manter = document.getElementById('adminBackupAutoManter');
  const status = document.getElementById('adminBackupAutoStatus');
  if (!ativo || !horario || !manter || !status) return;

  const config = adminBackupAgendamento || {
    ativo: false,
    horario: '18:00',
    manterQuantidade: 3,
    timezone: 'America/Sao_Paulo',
    ultimaExecucaoEm: null
  };

  ativo.checked = Boolean(config.ativo);
  horario.value = config.horario || '18:00';
  manter.value = 'Manter somente os 3 últimos';

  const ultimaExecucao = config.ultimaExecucaoEm
    ? ` Ultimo backup automatico: ${formatMessageTimestamp(config.ultimaExecucaoEm)}.`
    : '';

  status.textContent = config.ativo
    ? `Ativo todos os dias as ${config.horario} (${config.timezone || 'America/Sao_Paulo'}). Mantem ${config.manterQuantidade} backups automaticos.${ultimaExecucao}`
    : 'Backup automatico desativado.';
}

async function carregarAgendamentoBackupAdmin() {
  try {
    const response = await fetch('/api/admin/backups/agendamento', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar agendamento');
    adminBackupAgendamento = await response.json();
    renderAgendamentoBackupAdmin();
  } catch (err) {
    adminBackupAgendamento = null;
    renderAgendamentoBackupAdmin();
    mostrarNotificacao('Erro ao carregar agendamento de backup: ' + err.message, 'error');
  }
}

async function salvarAgendamentoBackupAdmin() {
  const ativo = document.getElementById('adminBackupAutoAtivo').checked;
  const horario = document.getElementById('adminBackupAutoHorario').value;
  const manterQuantidade = 3;

  if (!horario) {
    mostrarNotificacao('Escolha um horário para o backup automático', 'error');
    return;
  }

  try {
    const response = await fetch('/api/admin/backups/agendamento', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ativo, horario, manterQuantidade })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Falha ao salvar agendamento');
    adminBackupAgendamento = data;
    renderAgendamentoBackupAdmin();
    mostrarNotificacao('Agendamento de backup salvo com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao salvar agendamento: ' + err.message, 'error');
  }
}

function renderBackupsAdmin() {
  const select = document.getElementById('adminBackupSelect');
  const list = document.getElementById('adminBackupList');
  if (!select || !list) return;

  select.innerHTML = '<option value="">Selecione um backup</option>';

  if (!adminBackupsCache.length) {
    adminBackupSelecionadoId = '';
    list.textContent = 'Nenhum backup encontrado.';
    return;
  }

  adminBackupsCache.forEach((backup) => {
    const option = document.createElement('option');
    option.value = backup.id;
    option.textContent = `${backup.nome} - ${formatMessageTimestamp(backup.criado_em)}`;
    select.appendChild(option);
  });

  const backupSelecionadoExiste = adminBackupsCache.some((backup) => backup.id === adminBackupSelecionadoId);
  if (!backupSelecionadoExiste) adminBackupSelecionadoId = adminBackupsCache[0].id;
  select.value = adminBackupSelecionadoId;

  list.innerHTML = adminBackupsCache.map((backup) => `
    <div class="backup-item ${backup.id === adminBackupSelecionadoId ? 'active' : ''}" onclick="selecionarBackupAdmin('${escapeHtml(backup.id).replace(/'/g, "\\'")}')">
      <strong>${escapeHtml(backup.nome || backup.id)}</strong>
      <span>${escapeHtml(formatMessageTimestamp(backup.criado_em))}</span>
      <span>${escapeHtml(backup.criado_por ? `Criado por ${backup.criado_por}` : 'Criacao manual')}</span>
      <span>${escapeHtml(Array.isArray(backup.arquivos) ? backup.arquivos.join(', ') : '')}</span>
    </div>
  `).join('');
}

function sincronizarSelecaoBackup(backupId) {
  adminBackupSelecionadoId = backupId || '';
  renderBackupsAdmin();
}

function selecionarBackupAdmin(backupId) {
  adminBackupSelecionadoId = backupId || '';
  const select = document.getElementById('adminBackupSelect');
  if (select) select.value = adminBackupSelecionadoId;
  renderBackupsAdmin();
}

async function carregarBackupsAdmin() {
  try {
    const response = await fetch('/api/admin/backups', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar backups');
    adminBackupsCache = await response.json();
    if (!Array.isArray(adminBackupsCache)) adminBackupsCache = [];
    renderBackupsAdmin();
  } catch (err) {
    adminBackupsCache = [];
    renderBackupsAdmin();
    mostrarNotificacao('Erro ao carregar backups: ' + err.message, 'error');
  }
}

async function carregarMensagensApagadasAdmin() {
  const list = document.getElementById('adminDeletedMessagesList');
  if (!list) return;
  list.textContent = 'Carregando...';
  try {
    const response = await fetch('/api/admin/mensagens-apagadas', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar mensagens apagadas');
    const mensagens = await response.json();
    if (!Array.isArray(mensagens) || !mensagens.length) {
      list.textContent = 'Nenhuma mensagem apagada registrada.';
      return;
    }
    list.innerHTML = mensagens.map((message) => `
      <div class="backup-item">
        <strong>${escapeHtml(message.conversa_nome || 'Conversa')} · ${escapeHtml(message.usuario_nome || 'Usuario')}</strong>
        <span>${escapeHtml(message.tipo === 'arquivo' ? (message.arquivo_nome_original || 'Arquivo') : (message.conteudo || ''))}</span>
        <span>Enviada: ${escapeHtml(formatMessageTimestamp(message.criado_em))}</span>
        <span>Apagada: ${escapeHtml(formatMessageTimestamp(message.apagada_em))} por ${escapeHtml(message.apagada_por_nome || '')}</span>
      </div>
    `).join('');
  } catch (err) {
    list.textContent = 'Erro ao carregar: ' + err.message;
  }
}

async function gerarBackupAdmin() {
  const nome = document.getElementById('adminBackupNome').value.trim();

  try {
    const response = await fetch('/api/admin/backups', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nome })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao gerar backup', 'error');
      return;
    }

    document.getElementById('adminBackupNome').value = '';
    await carregarBackupsAdmin();
    mostrarNotificacao('Backup gerado com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao gerar backup: ' + err.message, 'error');
  }
}

async function importarBackupAdmin() {
  const backupId = adminBackupSelecionadoId || document.getElementById('adminBackupSelect').value;
  if (!backupId) {
    mostrarNotificacao('Selecione um backup para importar', 'error');
    return;
  }

  if (!confirm('Importar este backup vai substituir os JSONs atuais. Deseja continuar?')) {
    return;
  }

  try {
    const response = await fetch('/api/admin/backups/importar', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ backupId })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao importar backup', 'error');
      return;
    }

    await carregarDadosIniciais();
    await carregarBackupsAdmin();
    mostrarNotificacao('Backup importado com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao importar backup: ' + err.message, 'error');
  }
}

function abrirPainelAdmin() {
  setAdminTab('usuarios');
  carregarUsuariosAdmin();
  carregarGrupos();
  carregarBackupsAdmin();
  carregarAgendamentoBackupAdmin();
  carregarMensagensApagadasAdmin();
  carregarTemplatesAdmin();
  document.getElementById('adminModal').classList.add('active');
}

function abrirAjustes() {
  setSettingsTab('perfil');
  preencherFormularioAjustes();
  aplicarTema();
  document.getElementById('ajustesModal').classList.add('active');
}

async function salvarAjustesConta() {
  const nome = document.getElementById('ajustesNome').value.trim();
  const email = document.getElementById('ajustesEmail').value.trim();
  const senhaAtual = document.getElementById('ajustesSenhaAtual').value;
  const novaSenha = document.getElementById('ajustesNovaSenha').value;

  if (!nome || !email) {
    mostrarNotificacao('Preencha nome e e-mail', 'error');
    return;
  }

  try {
    const response = await fetch('/api/me', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nome, email, senhaAtual, novaSenha })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao salvar ajustes', 'error');
      return;
    }

    token = data.token;
    usuarioAtual = data.usuario;
    salvarSessao();
    aplicarSessaoUsuario();
    preencherFormularioAjustes();
    renderContatos();
    mostrarNotificacao('Ajustes salvos com sucesso', 'success');
    fecharModal('ajustesModal');
  } catch (err) {
    mostrarNotificacao('Erro ao salvar ajustes: ' + err.message, 'error');
  }
}

async function alterarMeuStatus(status) {
  try {
    const response = await fetch('/api/me/status', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao alterar status', 'error');
      return;
    }
    usuarioAtual = { ...usuarioAtual, ...data };
    userStatusState[Number(usuarioAtual.id)] = usuarioAtual.status || 'disponivel';
    salvarSessao();
    renderContatos();
  } catch (err) {
    mostrarNotificacao('Erro ao alterar status: ' + err.message, 'error');
  }
}

async function cadastrarNovoUsuario() {
  const nome = document.getElementById('adminNovonome').value.trim();
  const email = document.getElementById('adminNovoEmail').value.trim();

  if (!nome || !email) {
    mostrarErro('Preencha todos os campos');
    return;
  }

  try {
    const response = await fetch('/api/admin/criar-usuario', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nome, email, senha: 'Senha123!' })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarErro(data.erro || 'Erro ao cadastrar');
      return;
    }

    mostrarNotificacao('Usuário cadastrado com sucesso. Senha padrão: Senha123!', 'success');
    document.getElementById('adminNovonome').value = '';
    document.getElementById('adminNovoEmail').value = '';
    carregarUsuariosAdmin();
    carregarContatos();
  } catch (err) {
    mostrarErro('Erro: ' + err.message);
  }
}

async function desativarUsuario(usuarioId) {
  if (!confirm('Desativar este usuário?')) return;

  try {
    const response = await fetch(`/api/admin/usuarios/${usuarioId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (response.ok) {
      mostrarNotificacao('Usuário desativado com sucesso', 'success');
      carregarUsuariosAdmin();
      carregarContatos();
    }
  } catch (err) {
    mostrarErro('Erro: ' + err.message);
  }
}

async function redefinirSenhaUsuario(usuarioId, nomeUsuario) {
  const novaSenha = prompt(`Digite a nova senha para ${nomeUsuario}:`);
  if (novaSenha === null) return;

  if (novaSenha.trim().length < 6) {
    mostrarNotificacao('A nova senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/admin/usuarios/${usuarioId}/senha`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ novaSenha: novaSenha.trim() })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao redefinir senha', 'error');
      return;
    }

    mostrarNotificacao('Senha redefinida com sucesso', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao redefinir senha: ' + err.message, 'error');
  }
}

async function criarNovoGrupo() {
  const nome = document.getElementById('adminNovoGrupoNome').value.trim();
  const descricao = document.getElementById('adminNovoGrupoDesc').value.trim();
  const memberIds = Array.from(document.querySelectorAll('.admin-grupo-membro:checked'))
    .map((checkbox) => Number(checkbox.value));

  if (!nome) {
    mostrarErro('Digite o nome do grupo');
    return;
  }

  try {
    const response = await fetch('/api/admin/criar-grupo', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nome, descricao, memberIds })
    });

    const data = await response.json();
    if (!response.ok) {
      mostrarErro(data.erro || 'Erro ao criar grupo');
      return;
    }

    mostrarNotificacao('Grupo criado com sucesso', 'success');
    document.getElementById('adminNovoGrupoNome').value = '';
    document.getElementById('adminNovoGrupoDesc').value = '';
    renderGrupoMembrosSelector();
    carregarGrupos();
  } catch (err) {
    mostrarErro('Erro: ' + err.message);
  }
}

async function salvarAvisoGrupoAdmin() {
  const grupoId = Number(document.getElementById('adminAvisoGrupoSelect').value);
  const aviso = document.getElementById('adminAvisoGrupoTexto').value.trim();
  if (!grupoId) {
    mostrarNotificacao('Selecione um grupo para fixar o aviso', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/admin/grupos/${grupoId}/aviso`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ aviso })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      mostrarNotificacao(data.erro || 'Erro ao salvar aviso', 'error');
      return;
    }

    gruposCache = gruposCache.map((grupo) => (
      Number(grupo.id) === Number(grupoId)
        ? { ...grupo, aviso_fixado: aviso }
        : grupo
    ));
    renderPinnedNotice();
    renderAvisosGrupoAdmin();
    mostrarNotificacao(aviso ? 'Aviso fixado salvo' : 'Aviso removido', 'success');
  } catch (err) {
    mostrarNotificacao('Erro ao salvar aviso: ' + err.message, 'error');
  }
}

async function limparAvisoGrupoAdmin() {
  const textarea = document.getElementById('adminAvisoGrupoTexto');
  if (textarea) textarea.value = '';
  await salvarAvisoGrupoAdmin();
}

function abrirNovoGrupo() { abrirPainelAdmin(); }
function abrirNovoContato() { mostrarNotificacao('Todos os contatos cadastrados aparecem na lista', 'success'); }

function fazerLogout() {
  limparSessao();
  token = null;
  usuarioAtual = null;
  tipoChat = null;
  chatIdAtual = null;
  gruposCache = [];
  contatosCache = [];
  unreadState = {};
  lastPreviewState = {};
  lastTimeState = {};
  lastTimestampState = {};
  onlineState = new Set();
  userStatusState = {};
  typingUsers = new Map();

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  document.getElementById('loginContainer').classList.remove('hidden');
  document.getElementById('chatContainer').classList.add('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
  document.getElementById('currentUserName').textContent = '';
  document.getElementById('currentUserEmail').textContent = '';
  document.getElementById('currentUserAvatar').textContent = 'U';
  document.getElementById('currentUserAvatar').parentElement.removeAttribute('style');
  document.getElementById('userStatusSelect').value = 'disponivel';
  document.getElementById('adminBadge').style.display = 'none';
  document.getElementById('adminSection').classList.add('hidden');
  document.getElementById('novoGrupoBtn').style.display = 'none';
  document.getElementById('ajustesBtn').classList.add('hidden');
  document.getElementById('homeChatBtn').classList.add('hidden');
  document.getElementById('favoriteChatBtn').classList.add('hidden');
  document.getElementById('priorityChatBtn').classList.add('hidden');
  document.getElementById('exportChatBtn').classList.add('hidden');
  document.getElementById('messagesContainer').innerHTML = '';
  document.getElementById('headerTitle').textContent = 'Bem-vindo ao Chat do Cartorio Dias de Castro';
  document.getElementById('headerSubtitle').textContent = 'Selecione um grupo ou contato para iniciar';
  updateDailyMotivation();
  document.getElementById('headerMotivation').classList.remove('hidden');
  document.getElementById('typingIndicator').textContent = '';
  renderPinnedNotice();
  atualizarVisibilidadePlantaoPanel();
  document.getElementById('fileInput').value = '';
  setUploadStatus('');
  updateHeaderIcon(null);
  updateBrowserTitle();
}

function fecharModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.onclick = function(event) {
  if (!event.target.closest('.composer')) {
    fecharEmojiPicker();
  }
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
};

carregarFavoritos();
carregarPrioridades();
carregarMensagensPrioritarias();
carregarStatusAtendimento();
aplicarTema();
aplicarEstadoSidebar();

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN — VISUALIZADOR DE CONVERSAS
// ═══════════════════════════════════════════════════════════════════════════
const _adminConv = {
  lista: [],          // lista completa de conversas carregadas
  listaFiltrada: [],  // lista após filtro de busca
  selecionada: null,  // { tipo, uid1, uid2 } | { tipo, grupoId, nome }
  pagina: 1,
  porPagina: 60,
  totalMsgs: 0,
  busca: ''
};

async function carregarListaConversasAdmin() {
  const el = document.getElementById('adminConvLista');
  el.innerHTML = '<p style="padding:12px;font-size:13px;color:#64748b;">Carregando...</p>';
  try {
    const r = await fetch('/api/admin/conversas', { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const { privados, grupos } = await r.json();
    _adminConv.lista = [
      ...privados.map((p) => ({ ...p, _label: `${p.usuario1_nome} ↔ ${p.usuario2_nome}` })),
      ...grupos.map((g) => ({ ...g, _label: g.nome }))
    ];
    _adminConv.listaFiltrada = _adminConv.lista;
    renderListaConversasAdmin();
  } catch (_e) {
    el.innerHTML = '<p style="padding:12px;font-size:13px;color:#ef4444;">Erro ao carregar.</p>';
  }
}

function filtrarListaConversasAdmin() {
  const q = (document.getElementById('adminConvBuscaLista')?.value || '').toLowerCase();
  _adminConv.listaFiltrada = _adminConv.lista.filter((c) => c._label.toLowerCase().includes(q));
  renderListaConversasAdmin();
}

function renderListaConversasAdmin() {
  const el = document.getElementById('adminConvLista');
  if (!_adminConv.listaFiltrada.length) {
    el.innerHTML = '<p style="padding:12px;font-size:13px;color:#64748b;">Nenhuma conversa encontrada.</p>';
    return;
  }
  el.innerHTML = _adminConv.listaFiltrada.map((c, i) => {
    const label  = c._label;
    const tipo   = c.tipo;
    const ultima = c.ultima_em ? new Date(c.ultima_em).toLocaleDateString('pt-BR') : '';
    const sel    = _adminConv.selecionada;
    const ativo  = sel && (
      (tipo === 'privado' && sel.uid1 === c.usuario1_id && sel.uid2 === c.usuario2_id) ||
      (tipo === 'grupo'   && sel.grupoId === c.grupo_id)
    );
    return `<div class="admin-conv-item ${ativo ? 'active' : ''}" onclick="selecionarConversaAdmin(${i})">
      <div class="conv-title">${escapeHtml(label)}</div>
      <div class="conv-meta"><span class="conv-badge tipo-${tipo}">${tipo}</span>${c.total} msg${c.total !== 1 ? 's' : ''} ${ultima ? '· ' + ultima : ''}</div>
    </div>`;
  }).join('');
}

async function selecionarConversaAdmin(idx) {
  const conv = _adminConv.listaFiltrada[idx];
  if (!conv) return;
  _adminConv.pagina = 1;
  _adminConv.busca  = '';
  if (document.getElementById('adminConvBuscaMsgs')) document.getElementById('adminConvBuscaMsgs').value = '';
  if (conv.tipo === 'privado') {
    _adminConv.selecionada = { tipo: 'privado', uid1: conv.usuario1_id, uid2: conv.usuario2_id, titulo: conv._label };
  } else {
    _adminConv.selecionada = { tipo: 'grupo', grupoId: conv.grupo_id, titulo: conv.nome };
  }
  renderListaConversasAdmin();
  await carregarMensagensConversaAdmin();
}

async function carregarMensagensConversaAdmin() {
  const sel = _adminConv.selecionada;
  if (!sel) return;
  const msgsEl = document.getElementById('adminConvMensagens');
  msgsEl.innerHTML = '<p style="color:#64748b;font-size:13px;">Carregando...</p>';

  const busca = encodeURIComponent(_adminConv.busca);
  let url;
  if (sel.tipo === 'privado') {
    url = `/api/admin/conversas/privadas/${sel.uid1}/${sel.uid2}?pagina=${_adminConv.pagina}&por_pagina=${_adminConv.porPagina}&busca=${busca}`;
  } else {
    url = `/api/admin/conversas/grupo/${sel.grupoId}?pagina=${_adminConv.pagina}&por_pagina=${_adminConv.porPagina}&busca=${busca}`;
  }

  try {
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const { mensagens, total } = await r.json();
    _adminConv.totalMsgs = total;

    // Header
    document.getElementById('adminConvHeader').innerHTML =
      `<span class="conv-badge tipo-${sel.tipo}">${sel.tipo}</span> ${escapeHtml(sel.titulo)}`;
    document.getElementById('adminConvTotal').textContent = `${total} mensagem${total !== 1 ? 's' : ''}`;

    // Bolhas
    if (!mensagens.length) {
      msgsEl.innerHTML = '<p style="color:#64748b;font-size:13px;">Nenhuma mensagem encontrada.</p>';
    } else {
      const primeiroUid = sel.tipo === 'privado' ? sel.uid1 : null;
      msgsEl.innerHTML = mensagens.map((m) => renderAdminMsgBubble(m, primeiroUid)).join('');
    }

    // Paginação
    renderPaginacaoAdmin();
  } catch (_e) {
    msgsEl.innerHTML = '<p style="color:#ef4444;font-size:13px;">Erro ao carregar mensagens.</p>';
  }
}

function renderAdminMsgBubble(m, refUid) {
  // "own" = primeiro usuário da conversa privada OU remetente fixo de grupo (visual apenas)
  const isOwn = refUid ? m.usuario_id === refUid : false;
  const nome  = m.usuario_nome || 'Desconhecido';
  const hora  = m.criado_em ? new Date(m.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';

  let conteudo = '';
  if (m.tipo === 'arquivo') {
    conteudo = `📎 <a href="/uploads/${escapeHtml(m.arquivo_nome_salvo)}" target="_blank" style="color:#60a5fa;">${escapeHtml(m.arquivo_nome_original || m.arquivo_nome_salvo || 'arquivo')}</a>`;
  } else {
    conteudo = escapeHtml(String(m.conteudo || ''));
    // destaque da busca
    if (_adminConv.busca) {
      const re = new RegExp(`(${_adminConv.busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      conteudo = conteudo.replace(re, '<mark style="background:#fbbf24;color:#1e293b;border-radius:3px;padding:0 2px;">$1</mark>');
    }
  }

  const grad = avatarGradient(nome);
  return `<div class="admin-msg-bubble ${isOwn ? 'own' : 'other'}">
    <div class="admin-msg-avatar" style="background:${grad};">${escapeHtml(initials(nome))}</div>
    <div class="admin-msg-body">
      <div class="admin-msg-name">${escapeHtml(nome)}</div>
      <div class="admin-msg-text">${conteudo}</div>
      <div class="admin-msg-time">${hora}</div>
    </div>
  </div>`;
}

function renderPaginacaoAdmin() {
  const el = document.getElementById('adminConvPaginacao');
  const totalPags = Math.ceil(_adminConv.totalMsgs / _adminConv.porPagina);
  if (totalPags <= 1) { el.innerHTML = ''; return; }
  const p = _adminConv.pagina;
  el.innerHTML = `
    <button class="admin-conv-pagbtn" onclick="irPaginaAdmin(1)"         ${p===1?'disabled':''}>«</button>
    <button class="admin-conv-pagbtn" onclick="irPaginaAdmin(${p-1})"    ${p===1?'disabled':''}>‹</button>
    <span style="font-size:12px;color:#94a3b8;padding:0 6px;">${p} / ${totalPags}</span>
    <button class="admin-conv-pagbtn" onclick="irPaginaAdmin(${p+1})"    ${p===totalPags?'disabled':''}>›</button>
    <button class="admin-conv-pagbtn" onclick="irPaginaAdmin(${totalPags})" ${p===totalPags?'disabled':''}>»</button>`;
}

async function irPaginaAdmin(pag) {
  _adminConv.pagina = pag;
  await carregarMensagensConversaAdmin();
  document.getElementById('adminConvMensagens')?.scrollTo({ top: 0 });
}

let _adminConvBuscaTimer = null;
function buscarMensagensAdmin() {
  clearTimeout(_adminConvBuscaTimer);
  _adminConvBuscaTimer = setTimeout(() => {
    _adminConv.busca  = document.getElementById('adminConvBuscaMsgs')?.value || '';
    _adminConv.pagina = 1;
    carregarMensagensConversaAdmin();
  }, 350);
}
aplicarDensidadeMensagens();
restaurarSessao();

// ═══════════════════════════════════════════════════════════════════════════
// BLOCO 2 — TEMPLATES DE RESPOSTA RÁPIDA
// ═══════════════════════════════════════════════════════════════════════════
let templatesCache = [];

async function carregarTemplates() {
  try {
    const r = await fetch('/api/templates', { headers: authHeaders() });
    if (r.ok) templatesCache = await r.json();
  } catch (_e) { /* silencioso */ }
}

async function carregarTemplatesAdmin() {
  await carregarTemplates();
  renderTemplatesAdmin();
}

function renderTemplatesAdmin() {
  const el = document.getElementById('adminTemplateList');
  if (!el) return;
  if (!templatesCache.length) { el.innerHTML = '<p style="color:#64748b;font-size:13px;">Nenhum template cadastrado.</p>'; return; }
  el.innerHTML = templatesCache.map((t) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:rgba(148,163,184,.08);border-radius:8px;">
      <div style="flex:1;">
        <strong style="font-size:13px;">${escapeHtml(t.nome)}</strong>
        <div style="font-size:12px;color:#64748b;margin-top:3px;">${escapeHtml(t.texto)}</div>
      </div>
      <button onclick="excluirTemplateAdmin(${t.id})" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:15px;" title="Excluir">&#10005;</button>
    </div>`).join('');
}

async function criarTemplateAdmin() {
  const nome = document.getElementById('templateNomeInput').value.trim();
  const texto = document.getElementById('templateTextoInput').value.trim();
  if (!nome || !texto) { mostrarNotificacaoToast('Preencha nome e texto.', 'erro'); return; }
  try {
    const r = await fetch('/api/templates', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ nome, texto }) });
    if (!r.ok) throw new Error();
    document.getElementById('templateNomeInput').value = '';
    document.getElementById('templateTextoInput').value = '';
    await carregarTemplatesAdmin();
    mostrarNotificacaoToast('Template criado!', 'sucesso');
  } catch (_e) { mostrarNotificacaoToast('Erro ao criar template.', 'erro'); }
}

async function excluirTemplateAdmin(id) {
  if (!confirm('Excluir este template?')) return;
  try {
    await fetch(`/api/templates/${id}`, { method: 'DELETE', headers: authHeaders() });
    await carregarTemplatesAdmin();
  } catch (_e) { mostrarNotificacaoToast('Erro ao excluir.', 'erro'); }
}

// Template picker no campo de mensagem
function alternarTemplates(event) {
  event.stopPropagation();
  const picker = document.getElementById('templatePicker');
  if (picker.classList.contains('hidden')) {
    renderTemplatePicker();
    picker.classList.remove('hidden');
    document.getElementById('emojiPicker').classList.add('hidden');
  } else {
    picker.classList.add('hidden');
  }
}

function renderTemplatePicker() {
  const picker = document.getElementById('templatePicker');
  if (!templatesCache.length) {
    picker.innerHTML = '<div style="padding:12px;font-size:13px;color:#64748b;">Nenhum template. Adicione no Painel Admin → Templates.</div>';
    return;
  }
  picker.innerHTML = templatesCache.map((t) => `
    <div class="template-item" onclick="aplicarTemplate(${t.id})">
      <strong>${escapeHtml(t.nome)}</strong>
      <span>${escapeHtml(t.texto.slice(0, 50))}${t.texto.length > 50 ? '…' : ''}</span>
    </div>`).join('');
}

function aplicarTemplate(id) {
  const t = templatesCache.find((x) => x.id === id);
  if (!t) return;
  const input = document.getElementById('messageInput');
  input.value = t.texto;
  input.focus();
  autoResizeComposer && autoResizeComposer();
  document.getElementById('templatePicker').classList.add('hidden');
}

// fechar template picker ao clicar fora
document.addEventListener('click', (e) => {
  const picker = document.getElementById('templatePicker');
  if (picker && !picker.classList.contains('hidden') && !e.target.closest('.composer')) {
    picker.classList.add('hidden');
  }
});

// Carregar templates após login
const _origAplicarSessao = typeof aplicarSessaoUsuario === 'function' ? aplicarSessaoUsuario : null;
// Carrega na inicialização quando token disponível
setTimeout(() => { if (token) carregarTemplates(); }, 2000);

// ═══════════════════════════════════════════════════════════════════════════
// BLOCO 4 — AUDITORIA DE MENSAGENS
// ═══════════════════════════════════════════════════════════════════════════
async function carregarAuditoriaAdmin() {
  const el = document.getElementById('adminAuditoriaList');
  if (!el) return;
  const acao = document.getElementById('auditoriaFiltroAcao')?.value || '';
  el.innerHTML = 'Carregando...';
  try {
    const url = `/api/admin/auditoria?limite=300${acao ? `&acao=${acao}` : ''}`;
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const registros = await r.json();
    if (!registros.length) { el.innerHTML = '<p style="color:#64748b;">Nenhum registro encontrado.</p>'; return; }
    const ACAO_CORES = { enviada: '#22c55e', apagada: '#ef4444', encaminhada: '#3b82f6', editada: '#f59e0b' };
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11.5px;">
      <thead><tr style="border-bottom:1px solid rgba(148,163,184,.2);">
        <th style="text-align:left;padding:6px 8px;">Ação</th>
        <th style="text-align:left;padding:6px 8px;">Usuário</th>
        <th style="text-align:left;padding:6px 8px;">Detalhe</th>
        <th style="text-align:left;padding:6px 8px;">IP</th>
        <th style="text-align:left;padding:6px 8px;">Data/Hora</th>
      </tr></thead>
      <tbody>${registros.map((r) => `
        <tr style="border-bottom:1px solid rgba(148,163,184,.08);">
          <td style="padding:5px 8px;"><span style="color:${ACAO_CORES[r.acao]||'#94a3b8'};font-weight:700;">${escapeHtml(r.acao||'')}</span></td>
          <td style="padding:5px 8px;">${escapeHtml(r.usuario_nome||String(r.usuario_id||''))}</td>
          <td style="padding:5px 8px;color:#94a3b8;">${escapeHtml(r.detalhe||'')}</td>
          <td style="padding:5px 8px;color:#64748b;">${escapeHtml(r.ip||'')}</td>
          <td style="padding:5px 8px;color:#64748b;">${r.em ? new Date(r.em).toLocaleString('pt-BR') : ''}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (_e) { el.innerHTML = '<p style="color:#ef4444;">Erro ao carregar auditoria.</p>'; }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCO 5 — MÉTRICAS E ANÁLISE DE USO
// ═══════════════════════════════════════════════════════════════════════════
let _chartDia = null;
let _chartUsuario = null;

async function carregarMetricasAdmin() {
  const summaryEl = document.getElementById('adminMetricasSummary');
  if (!summaryEl) return;
  summaryEl.innerHTML = 'Carregando...';
  try {
    const r = await fetch('/api/admin/metricas', { headers: authHeaders() });
    if (!r.ok) throw new Error();
    const d = await r.json();

    // Cards de resumo
    const cards = [
      { label: 'Total de mensagens', val: d.totalMsgs, cor: '#3b82f6' },
      { label: 'Urgentes',           val: d.totalUrgentes, cor: '#ef4444' },
      { label: 'Em grupos',          val: d.totalGrupo, cor: '#8b5cf6' },
      { label: 'Privadas',           val: d.totalPrivado, cor: '#06b6d4' },
      { label: 'Apagadas',           val: d.totalApagadas, cor: '#f59e0b' },
    ];
    summaryEl.innerHTML = cards.map((c) => `
      <div style="background:rgba(148,163,184,.08);border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:${c.cor};">${c.val}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">${c.label}</div>
      </div>`).join('');

    // Gráfico por dia
    const ctxDia = document.getElementById('metricasChartDia');
    if (ctxDia) {
      if (_chartDia) _chartDia.destroy();
      _chartDia = new Chart(ctxDia, {
        type: 'bar',
        data: {
          labels: Object.keys(d.porDia).map((k) => k.slice(5)), // MM-DD
          datasets: [{ label: 'Mensagens por dia', data: Object.values(d.porDia), backgroundColor: 'rgba(59,130,246,.7)', borderRadius: 4 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }

    // Gráfico por usuário
    const ctxUsr = document.getElementById('metricasChartUsuario');
    if (ctxUsr && d.topUsuarios.length) {
      if (_chartUsuario) _chartUsuario.destroy();
      _chartUsuario = new Chart(ctxUsr, {
        type: 'bar',
        data: {
          labels: d.topUsuarios.map((u) => u.nome),
          datasets: [{ label: 'Mensagens por usuário', data: d.topUsuarios.map((u) => u.total), backgroundColor: 'rgba(139,92,246,.7)', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }
  } catch (_e) { summaryEl.innerHTML = '<p style="color:#ef4444;">Erro ao carregar métricas.</p>'; }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCO 3 — WEB PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════
async function inicializarWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const kr = await fetch('/api/push/vapid-public-key');
    const { key } = await kr.json();
    if (!key) return; // VAPID não configurado no servidor

    const reg = await navigator.serviceWorker.ready;
    const existente = await reg.pushManager.getSubscription();
    if (existente) return; // já inscrito

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
    console.log('Web Push inscrito.');
  } catch (e) {
    console.warn('Web Push subscribe falhou:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Chamar após login bem-sucedido
setTimeout(() => { if (token) inicializarWebPush(); }, 3000);
