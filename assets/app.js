// Captura erros que antes falhavam em silencio (tela "travada" sem nenhuma
// pista visivel, so descobrivel abrindo o console). Mostra um aviso com a
// mensagem do erro pra quem estiver usando o chat conseguir repassar o texto
// exato, em vez de so "travou". Throttle pra nao empilhar toasts se o mesmo
// erro repetir varias vezes seguidas.
let ultimoErroCapturadoEm = 0;
function avisarErroInesperado(origem, detalhe) {
  const agora = Date.now();
  console.error(`[erro-${origem}]`, detalhe);
  if (agora - ultimoErroCapturadoEm < 8000) return;
  ultimoErroCapturadoEm = agora;
  const mensagem = detalhe?.message || String(detalhe || 'erro desconhecido');
  try {
    mostrarNotificacao(`Erro inesperado (${origem}): ${mensagem}. Recarregue a pagina; se continuar, avise o suporte com essa mensagem.`, 'error');
  } catch (_e) {
    // mostrarNotificacao pode nao estar disponivel ainda no boot inicial.
  }
}
window.addEventListener('error', (event) => {
  avisarErroInesperado('script', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  avisarErroInesperado('promise', event.reason);
});

let socket = null;
let token = null;
let usuarioAtual = null;
let tipoChat = null;
let chatIdAtual = null;
let nomeChatAtual = '';
let jaConectouSocket = false;
let lastLocalActivityAt = Date.now();
let lastActivitySignalAt = 0;
let activityHeartbeatInterval = null;
let presenceRefreshInterval = null;

let gruposCache = [];
let contatosCache = [];
let unreadState = {};
let lastPreviewState = {};
let lastTimeState = {};
let lastTimestampState = {};
let onlineState = new Set();
let userStatusState = {};
let lastSeenState = {};
let typingUsers = new Map();
let adminUsuariosCache = [];
let adminBackupsCache = [];
let adminBackupSelecionadoId = '';
let adminBackupAgendamento = null;
let currentMessagesCache = [];
let currentMessagesHasMore = false;
let currentMessagesNextBefore = null;
let currentMessagesLoadingOlder = false;
let currentChatLoadSeq = 0;
let initialScrollLockTimers = [];
let activeReplyMessageId = null;
let editingMessageId = null;
let currentMessageSearch = '';
let conversationSearchTerm = '';
let conversationSearchRemoteMatches = new Set();
let conversationSearchTimer = null;
let conversationRenderTimer = null;
let sidebarRenderFrame = null;
let pendingSidebarGroupsRender = false;
let pendingSidebarContactsRender = false;
let conversationFilter = 'todos';
let favoriteChats = new Set();
let priorityChats = new Set();
let priorityMessages = new Set();
let savedStickers = [];
let pinnedMessagesByConversation = {};
let attendanceStatusState = {};
let conversationTagsState = {};
let conversationNotesCountState = {};
let conversationNotesCache = {};
let conversationAssigneeState = {};
let mentionsInbox = [];
let mentionSuggestionsState = {
  active: false,
  query: '',
  start: -1,
  end: -1,
  selected: 0,
  items: []
};
let forwardMessageId = null;
let globalSearchTimer = null;
let titleBlinkInterval = null;
let titleBlinkVisible = false;
const secureAttachmentBlobUrls = new Map();
const secureAttachmentBlobCache = new Map();
const secureAttachmentPending = new Map();
let currentAttachmentViewerMessageId = null;
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
let plantaoEditingPeriodoKey = '';
const REACTION_OPTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F44F}', '\u{1F525}', '\u{1F440}'];
const STORAGE_KEY = 'chatinterno.session';
const THEME_KEY = 'chatinterno.theme';
const FAVORITES_KEY = 'chatinterno.favoriteChats';
const PRIORITY_KEY = 'chatinterno.priorityChats';
const MESSAGE_PRIORITY_KEY = 'chatinterno.priorityMessages';
const STICKERS_KEY = 'chatinterno.savedStickers';
const ATTENDANCE_STATUS_KEY = 'chatinterno.attendanceStatus';
const DRAFTS_KEY = 'chatinterno.messageDrafts';
const MENTIONS_KEY = 'chatinterno.mentionsInbox';
const SIDEBAR_KEY = 'chatinterno.sidebarCollapsed';
const DENSITY_KEY = 'chatinterno.messageDensity';
const MESSAGE_RENDER_LIMIT = 220;
const ATTACHMENT_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const NOTIFICATION_PROMPT_KEY = 'chatinterno.notificationPromptDismissed';
const ATTENDANCE_STATUS_LABELS = {
  pendente: 'Pendente',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  urgente: 'Urgente'
};
const SLA_ALERT_HOURS = 4;
const ONLINE_ACTIVITY_TIMEOUT_MS = 60 * 1000;
const ACTIVITY_SIGNAL_INTERVAL_MS = 15 * 1000;
const MESSAGE_PAGE_SIZE = 50;
const DAILY_MOTIVATION_MESSAGES = [
  'Cada ato que fazemos transforma vidas, vamos fazer sempre o nosso melhor.',
  'Cada atendimento carrega uma história; que hoje a nossa entrega seja cuidadosa e humana.',
  'Nos detalhes do nosso trabalho nascem segurança, confiança e tranquilidade para muitas pessoas.',
  'Que cada conversa de hoje seja conduzida com atenção, respeito e vontade de resolver.',
  'Fazer bem o simples também transforma vidas. Hoje é mais um dia para entregar o nosso melhor.',
  'Quando trabalhamos com cuidado, cada documento vira parte de uma conquista importante.',
  'Que o nosso atendimento seja claro, gentil e eficiente do primeiro contato ao último retorno.',
  'Cada pessoa atendida merece sentir que seu pedido foi tratado com seriedade e respeito.',
  'Nosso trabalho ganha valor quando unimos agilidade, precisão e empatia.',
  'Hoje é um bom dia para transformar responsabilidade em confiança.',
  'Pequenas atitudes de cuidado deixam grandes marcas no atendimento.',
  'Que cada resposta enviada hoje aproxime alguém da solução que precisa.',
  'Excelência também está na forma como acolhemos, orientamos e finalizamos cada demanda.',
  'Cada ato feito com atenção reforça a confiança que as pessoas depositam em nosso trabalho.',
  'Vamos cuidar de cada detalhe, porque por trás de cada pedido existe uma vida em movimento.',
  'Que hoje a equipe trabalhe com foco, leveza e orgulho pelo que entrega.',
  'Ser melhor a cada dia também é ouvir com calma, responder com clareza e agir com compromisso.',
  'Cada atendimento bem conduzido mostra que qualidade e cuidado caminham juntos.',
  'Que a nossa rotina seja feita de colaboração, respeito e vontade de fazer bem feito.',
  'O melhor resultado nasce quando cada um faz sua parte com atenção e responsabilidade.',
  'Hoje, mais uma vez, temos a chance de facilitar caminhos e entregar segurança.',
  'Que cada mensagem respondida leve clareza, tranquilidade e confiança.',
  'Transformar vidas também está em cumprir cada etapa com carinho, critério e dedicação.',
  'Vamos fazer do atendimento de hoje uma experiência mais simples, humana e eficiente.',
  'Cada detalhe importa quando o objetivo é servir bem.',
  'Nossa melhor entrega é aquela que une precisão técnica e cuidado com as pessoas.',
  'Que a dedicação de hoje vire tranquilidade para quem espera uma resposta.',
  'Atender bem é transformar uma necessidade em confiança.',
  'Que cada ato de hoje tenha a marca do nosso compromisso com o melhor.',
  'Trabalhar com excelência é lembrar que cada processo tem alguém contando conosco.'
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
const DEFAULT_STICKERS = [
  ['1F600', 'sorriso'],
  ['1F602', 'risada'],
  ['1F60D', 'apaixonado'],
  ['1F914', 'pensando'],
  ['1F642', 'simpatia'],
  ['1F44D', 'positivo'],
  ['1F44F', 'aplausos'],
  ['1F64F', 'agradecimento'],
  ['1F91D', 'combinado'],
  ['1F525', 'urgente'],
  ['1F440', 'olhando'],
  ['2728', 'brilho'],
  ['1F389', 'comemoracao'],
  ['1F3C6', 'trofeu'],
  ['2615', 'cafe'],
  ['1F355', 'pizza'],
  ['1F382', 'aniversario'],
  ['1F680', 'foguete'],
  ['1F4A1', 'ideia'],
  ['1F4CC', 'fixado'],
  ['2705', 'concluido'],
  ['26A0', 'atencao'],
  ['1F4AC', 'mensagem'],
  ['1F4C4', 'documento'],
  ['1F4DE', 'telefone']
].map(([code, label]) => ({
  url: `/assets/stickers/openmoji/${code}.png`,
  name: `openmoji-${label}.png`,
  mimetype: 'image/png',
  size: 0,
  bundled: true,
  savedAt: 'bundled'
}));

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

function atualizarModoTelaInicial() {
  const main = document.querySelector('.main-content');
  if (!main) return;
  main.classList.toggle('home-mode', !(tipoChat && chatIdAtual));
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

function getCurrentChatKey() {
  return tipoChat && chatIdAtual ? getChatKey(tipoChat, chatIdAtual) : '';
}

function getConversationTags(key = getCurrentChatKey()) {
  return Array.isArray(conversationTagsState[key]) ? conversationTagsState[key] : [];
}

function getConversationAssignee(key = getCurrentChatKey()) {
  const value = conversationAssigneeState[key];
  return value && Number(value.usuario_id) ? value : null;
}

function getAssignableUsersForCurrentChat() {
  if (!tipoChat || !chatIdAtual) return [];
  if (tipoChat === 'privado') {
    const ids = [usuarioAtual, contatosCache.find((u) => Number(u.id) === Number(chatIdAtual))]
      .filter(Boolean)
      .map((u) => ({ id: Number(u.id), nome: u.nome || u.email || `#${u.id}` }));
    return ids.filter((u, index, arr) => arr.findIndex((item) => item.id === u.id) === index);
  }
  const grupo = gruposCache.find((item) => Number(item.id) === Number(chatIdAtual));
  const membros = Array.isArray(grupo?.membros) ? grupo.membros.map(Number) : [];
  return contatosCache
    .filter((u) => !membros.length || membros.includes(Number(u.id)) || Number(u.id) === Number(usuarioAtual?.id))
    .concat(usuarioAtual ? [{ id: Number(usuarioAtual.id), nome: usuarioAtual.nome || usuarioAtual.email }] : [])
    .filter((u, index, arr) => arr.findIndex((item) => Number(item.id) === Number(u.id)) === index)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

function formatDurationFromNow(iso) {
  const ts = toTimestamp(iso);
  if (!ts) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function getCurrentSlaInfo(key = getCurrentChatKey()) {
  const status = getAttendanceStatus(key);
  if (!['pendente', 'aguardando', 'urgente'].includes(status)) return null;
  const lastTs = Number(lastTimestampState[key] || 0);
  if (!lastTs) return null;
  const ageHours = (Date.now() - lastTs) / 36e5;
  if (ageHours < SLA_ALERT_HOURS && status !== 'urgente') return null;
  return {
    status,
    overdue: ageHours >= SLA_ALERT_HOURS,
    label: ageHours >= SLA_ALERT_HOURS
      ? `Sem resposta ha ${formatDurationFromNow(new Date(lastTs).toISOString())}`
      : 'Acompanhar'
  };
}

function carregarMencoesInbox() {
  try {
    const stored = JSON.parse(localStorage.getItem(MENTIONS_KEY) || '[]');
    mentionsInbox = Array.isArray(stored) ? stored.slice(0, 40) : [];
  } catch (_err) {
    mentionsInbox = [];
  }
}

function salvarMencoesInbox() {
  localStorage.setItem(MENTIONS_KEY, JSON.stringify(mentionsInbox.slice(0, 40)));
}

function registrarMencaoInbox(data = {}) {
  if (!data?.tipoChat || !data?.chatId) return;
  const id = `${data.tipoChat}-${data.chatId}-${data.messageId || Date.now()}`;
  mentionsInbox = [
    {
      id,
      tipoChat: data.tipoChat,
      chatId: Number(data.chatId),
      messageId: Number(data.messageId || 0),
      title: data.title || 'Voce foi mencionado',
      body: data.body || '',
      usuarioNome: data.usuarioNome || '',
      criadoEm: new Date().toISOString(),
      visto: false
    },
    ...mentionsInbox.filter((item) => item.id !== id)
  ].slice(0, 40);
  salvarMencoesInbox();
  atualizarBadgeOperacional();
}

function getChatNameByKey(key) {
  const [tipo, id] = String(key || '').split('-');
  if (tipo === 'grupo') return gruposCache.find((grupo) => Number(grupo.id) === Number(id))?.nome || 'Grupo';
  if (tipo === 'privado') return contatosCache.find((contato) => Number(contato.id) === Number(id))?.nome || 'Contato';
  return 'Conversa';
}

function getOperationalChatItems() {
  const items = [
    ...gruposCache.map((grupo) => ({ tipo: 'grupo', id: Number(grupo.id), key: getChatKey('grupo', grupo.id), nome: grupo.nome })),
    ...contatosCache.map((contato) => ({ tipo: 'privado', id: Number(contato.id), key: getChatKey('privado', contato.id), nome: contato.nome }))
  ];
  return items.map((item) => {
    const status = getAttendanceStatus(item.key);
    const assignee = getConversationAssignee(item.key);
    const sla = getCurrentSlaInfo(item.key);
    return {
      ...item,
      status,
      assignee,
      sla,
      unread: Number(unreadState[item.key] || 0),
      preview: lastPreviewState[item.key] || '',
      time: lastTimeState[item.key] || ''
    };
  });
}

function getOperationsCount() {
  const items = getOperationalChatItems();
  const mentions = mentionsInbox.filter((item) => !item.visto).length;
  const unread = items.reduce((sum, item) => sum + (Number(item.unread) || 0), 0);
  return mentions + unread;
}

function atualizarBadgeOperacional() {
  const badge = document.getElementById('operationsBadge');
  if (!badge) return;
  const total = getOperationsCount();
  badge.textContent = total > 99 ? '99+' : String(total);
  badge.classList.toggle('hidden', total <= 0);
}

function getOperationItemHtml(item, label, tone = '') {
  return `
    <button class="operation-item ${tone}" type="button" onclick="abrirItemOperacional('${escapeHtml(item.tipo)}', ${Number(item.id)})">
      <span class="operation-dot"></span>
      <span class="operation-main">
        <strong>${escapeHtml(item.nome)}</strong>
        <small>${escapeHtml(label)}</small>
      </span>
      <span class="operation-meta">${escapeHtml(item.time || 'abrir')}</span>
    </button>
  `;
}

function renderCentralOperacional() {
  const body = document.getElementById('operationsPanelBody');
  if (!body) return;
  const items = getOperationalChatItems();
  const naoLidas = items.filter((item) => item.unread > 0).slice(0, 8);
  const mencoes = mentionsInbox.slice(0, 8);

  const mentionsHtml = mencoes.length
    ? mencoes.map((item) => `
      <button class="operation-item mention ${item.visto ? 'seen' : ''}" type="button" onclick="abrirMencaoOperacional('${escapeHtml(item.id)}')">
        <span class="operation-dot"></span>
        <span class="operation-main">
          <strong>${escapeHtml(getChatNameByKey(getChatKey(item.tipoChat, item.chatId)))}</strong>
          <small>${escapeHtml(item.body || item.title || 'Mencao recebida')}</small>
        </span>
        <span class="operation-meta">${escapeHtml(formatMessageTimestamp(item.criadoEm))}</span>
      </button>
    `).join('')
    : '<div class="operation-empty">Nenhuma mencao recente.</div>';

  body.innerHTML = `
    <section class="operation-section">
      <div class="operation-section-title">Menções</div>
      ${mentionsHtml}
    </section>
    <section class="operation-section">
      <div class="operation-section-title">Não lidas</div>
      ${naoLidas.length ? naoLidas.map((item) => getOperationItemHtml(item, `${item.unread} nao lida(s) - ${item.preview}`, 'unread')).join('') : '<div class="operation-empty">Sem mensagens nao lidas.</div>'}
    </section>
  `;
  atualizarBadgeOperacional();
}

function abrirCentralOperacional() {
  renderCentralOperacional();
  document.getElementById('operationsPanel')?.classList.remove('hidden');
}

function fecharCentralOperacional() {
  document.getElementById('operationsPanel')?.classList.add('hidden');
}

function abrirItemOperacional(tipo, id) {
  const nome = getChatNameByKey(getChatKey(tipo, id));
  fecharCentralOperacional();
  carregarChat(tipo, id, nome);
}

function abrirMencaoOperacional(id) {
  const mention = mentionsInbox.find((item) => item.id === id);
  if (!mention) return;
  mention.visto = true;
  salvarMencoesInbox();
  abrirItemOperacional(mention.tipoChat, mention.chatId);
}

function parseTagsInput(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((item) => item.trim().slice(0, 40))
    .filter(Boolean))]
    .slice(0, 8);
}

function renderWorkflowPanel() {
  const panel = document.getElementById('conversationWorkflowPanel');
  if (!panel) return;
  const hasChat = Boolean(tipoChat && chatIdAtual);
  panel.classList.toggle('hidden', !hasChat);
  if (!hasChat) {
    document.getElementById('conversationNotesPanel')?.classList.add('hidden');
    return;
  }

  const key = getCurrentChatKey();
  const tags = getConversationTags(key);
  const tagsList = document.getElementById('conversationTagsList');
  const tagsInput = document.getElementById('conversationTagsInput');
  const notesCount = document.getElementById('conversationNotesCount');
  const responsibleSelect = document.getElementById('conversationResponsibleSelect');
  const slaRow = document.getElementById('conversationSlaRow');

  if (tagsList) {
    tagsList.innerHTML = tags.length
      ? tags.map((tag) => `<span class="workflow-tag">${escapeHtml(tag)}</span>`).join('')
      : '<span class="workflow-empty">Sem etiquetas</span>';
  }
  if (tagsInput && document.activeElement !== tagsInput) tagsInput.value = tags.join(', ');
  if (notesCount) {
    const count = Number(conversationNotesCountState[key] || 0);
    notesCount.textContent = count ? `(${count})` : '';
  }
  if (responsibleSelect) {
    const assignee = getConversationAssignee(key);
    const users = getAssignableUsersForCurrentChat();
    if (assignee && !users.some((user) => Number(user.id) === Number(assignee.usuario_id))) {
      users.push({ id: Number(assignee.usuario_id), nome: assignee.usuario_nome || `#${assignee.usuario_id}` });
    }
    const currentValue = assignee ? String(assignee.usuario_id) : '';
    responsibleSelect.innerHTML = '<option value="">Sem responsável</option>' + users
      .map((user) => `<option value="${Number(user.id)}">${escapeHtml(user.nome)}</option>`)
      .join('');
    responsibleSelect.value = currentValue;
  }
  if (slaRow) {
    const assignee = getConversationAssignee(key);
    const sla = getCurrentSlaInfo(key);
    const parts = [];
    if (assignee) parts.push(`Responsável: ${escapeHtml(assignee.usuario_nome || 'Equipe')}`);
    if (sla) parts.push(`<span class="${sla.overdue ? 'sla-overdue' : 'sla-watch'}">${escapeHtml(sla.label)}</span>`);
    slaRow.innerHTML = parts.length ? parts.join(' · ') : '';
    slaRow.classList.toggle('hidden', !parts.length);
  }
}

async function salvarEtiquetasAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const input = document.getElementById('conversationTagsInput');
  const key = getCurrentChatKey();
  const previous = getConversationTags(key);
  const etiquetas = parseTagsInput(input?.value || '');
  conversationTagsState[key] = etiquetas;
  renderWorkflowPanel();
  scheduleSidebarRender({ groups: true, contacts: true });

  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/etiquetas`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ etiquetas })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao salvar etiquetas');
    mostrarNotificacao('Etiquetas salvas', 'success');
  } catch (err) {
    conversationTagsState[key] = previous;
    renderWorkflowPanel();
    mostrarNotificacao(err.message, 'error');
  }
}

async function salvarResponsavelAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const select = document.getElementById('conversationResponsibleSelect');
  const key = getCurrentChatKey();
  const previous = getConversationAssignee(key);
  const usuarioId = Number(select?.value || 0);
  if (usuarioId) {
    const user = getAssignableUsersForCurrentChat().find((item) => Number(item.id) === usuarioId);
    conversationAssigneeState[key] = {
      usuario_id: usuarioId,
      usuario_nome: user?.nome || `#${usuarioId}`,
      atribuido_em: new Date().toISOString()
    };
  } else {
    delete conversationAssigneeState[key];
  }
  renderWorkflowPanel();
  scheduleSidebarRender({ groups: true, contacts: true });

  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/responsavel`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ usuarioId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao salvar responsável');
    if (data.responsavel) conversationAssigneeState[key] = data.responsavel;
    else delete conversationAssigneeState[key];
    renderWorkflowPanel();
    mostrarNotificacao(usuarioId ? 'Responsável atribuído' : 'Responsável removido', 'success');
  } catch (err) {
    if (previous) conversationAssigneeState[key] = previous;
    else delete conversationAssigneeState[key];
    renderWorkflowPanel();
    mostrarNotificacao(err.message, 'error');
  }
}

function renderNotasConversa(notas = null) {
  const key = getCurrentChatKey();
  const list = document.getElementById('conversationNotesList');
  if (!list) return;
  const items = Array.isArray(notas) ? notas : (conversationNotesCache[key] || []);
  conversationNotesCache[key] = items;
  conversationNotesCountState[key] = items.length;

  if (!items.length) {
    list.innerHTML = '<div class="workflow-empty note-empty">Nenhuma nota interna.</div>';
    renderWorkflowPanel();
    return;
  }

  list.innerHTML = items
    .slice()
    .reverse()
    .map((nota) => {
      const canDelete = Number(nota.autor_id) === Number(usuarioAtual?.id) || Boolean(usuarioAtual?.admin);
      return `
        <div class="note-item">
          <div class="note-meta">
            <strong>${escapeHtml(nota.autor_nome || 'Equipe')}</strong>
            <span>${escapeHtml(formatMessageTimestamp(nota.criado_em))}</span>
          </div>
          <div class="note-text">${escapeHtml(nota.texto || '')}</div>
          ${canDelete ? `<button class="note-delete" type="button" onclick="excluirNotaAtual(${Number(nota.id)})">Remover</button>` : ''}
        </div>
      `;
    })
    .join('');
  renderWorkflowPanel();
}

async function carregarNotasAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const key = getCurrentChatKey();
  const list = document.getElementById('conversationNotesList');
  if (list) list.innerHTML = '<div class="workflow-empty note-empty">Carregando notas...</div>';
  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/notas`, { headers: authHeaders() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao carregar notas');
    conversationNotesCache[key] = Array.isArray(data.notas) ? data.notas : [];
    renderNotasConversa(conversationNotesCache[key]);
  } catch (err) {
    if (list) list.innerHTML = `<div class="workflow-empty note-empty">${escapeHtml(err.message)}</div>`;
  }
}

async function alternarNotasConversa() {
  if (!tipoChat || !chatIdAtual) return;
  const panel = document.getElementById('conversationNotesPanel');
  if (!panel) return;
  const willOpen = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !willOpen);
  if (willOpen) await carregarNotasAtual();
}

async function adicionarNotaAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const input = document.getElementById('conversationNoteInput');
  const texto = String(input?.value || '').trim();
  if (!texto) {
    mostrarNotificacao('Escreva a nota antes de adicionar', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/notas`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ texto })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao salvar nota');
    const key = getCurrentChatKey();
    conversationNotesCache[key] = [...(conversationNotesCache[key] || []), data.nota].slice(-200);
    if (input) input.value = '';
    renderNotasConversa(conversationNotesCache[key]);
    mostrarNotificacao('Nota interna adicionada', 'success');
  } catch (err) {
    mostrarNotificacao(err.message, 'error');
  }
}

async function excluirNotaAtual(notaId) {
  if (!tipoChat || !chatIdAtual || !notaId) return;
  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/notas/${Number(notaId)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao remover nota');
    const key = getCurrentChatKey();
    conversationNotesCache[key] = (conversationNotesCache[key] || []).filter((nota) => Number(nota.id) !== Number(notaId));
    renderNotasConversa(conversationNotesCache[key]);
    mostrarNotificacao('Nota removida', 'success');
  } catch (err) {
    mostrarNotificacao(err.message, 'error');
  }
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
  const galleryBtn = document.getElementById('galleryChatBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (galleryBtn) galleryBtn.classList.toggle('hidden', !hasChat);
  if (exportPdfBtn) exportPdfBtn.classList.toggle('hidden', !hasChat);
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

function mostrarStatusConexao(desconectado) {
  const el = document.getElementById('connectionStatusBanner');
  if (el) el.classList.toggle('hidden', !desconectado);
}

const RESPOSTA_RAPIDA_ATALHOS = {
  '1': 'Bom dia! Já estou verificando e retorno em instantes.',
  '2': 'Pode me enviar mais detalhes, por favor?',
  '3': 'Resolvido. Qualquer coisa fico à disposição.',
  '4': 'Vou encaminhar para o setor responsável e acompanho por aqui.'
};

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

function scheduleSidebarRender({ groups = false, contacts = false } = {}) {
  pendingSidebarGroupsRender = pendingSidebarGroupsRender || groups;
  pendingSidebarContactsRender = pendingSidebarContactsRender || contacts;
  if (sidebarRenderFrame) return;

  sidebarRenderFrame = requestAnimationFrame(() => {
    sidebarRenderFrame = null;
    const shouldRenderGroups = pendingSidebarGroupsRender;
    const shouldRenderContacts = pendingSidebarContactsRender;
    pendingSidebarGroupsRender = false;
    pendingSidebarContactsRender = false;

    if (shouldRenderGroups) renderGrupos();
    if (shouldRenderContacts) renderContatos();
  });
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

function formatLastSeen(value) {
  if (!value) return 'Offline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Offline';

  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) return `Visto por último às ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();
  if (wasYesterday) return `Visto por último ontem às ${time}`;

  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `Visto por último em ${day} às ${time}`;
}

function isRecentlyActive(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < ONLINE_ACTIVITY_TIMEOUT_MS;
}

function signalUserActivity(force = false, recordLocalActivity = true) {
  if (recordLocalActivity) lastLocalActivityAt = Date.now();
  if (!socket?.connected) return;
  if (!force && Date.now() - lastActivitySignalAt < ACTIVITY_SIGNAL_INTERVAL_MS) return;
  lastActivitySignalAt = Date.now();
  socket.emit('atividade-usuario');
}

function startActivityTracking() {
  if (activityHeartbeatInterval) return;

  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, () => signalUserActivity(), { passive: true });
  });
  window.addEventListener('focus', () => signalUserActivity(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) signalUserActivity(true);
  });

  activityHeartbeatInterval = setInterval(() => {
    if (document.hidden || !document.hasFocus()) return;
    if (Date.now() - lastLocalActivityAt >= ONLINE_ACTIVITY_TIMEOUT_MS) return;
    signalUserActivity(true, false);
  }, ACTIVITY_SIGNAL_INTERVAL_MS);

  presenceRefreshInterval = setInterval(() => {
    if (tipoChat === 'privado') updateHeaderStatus();
  }, 10 * 1000);
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

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const target = new Date(Number(timestamp));
  if (Number.isNaN(target.getTime())) return '';
  const diffMs = Date.now() - target.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const now = new Date();
  if (isSameCalendarDay(target, now)) return `há ${Math.floor(diffMin / 60)}h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(target, yesterday)) return 'ontem';
  return target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
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
    entregue: Number(msg.entregue || 0),
    tipo: msg.tipo || 'texto',
    reacoes: typeof msg.reacoes === 'object' && msg.reacoes ? msg.reacoes : {},
    reacoes_nomes: typeof msg.reacoes_nomes === 'object' && msg.reacoes_nomes ? msg.reacoes_nomes : {},
    mencoes_usuario_ids: Array.isArray(msg.mencoes_usuario_ids)
      ? msg.mencoes_usuario_ids.map(Number).filter(Boolean)
      : [],
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

function isMessageMentioningMe(message) {
  return Array.isArray(message?.mencoes_usuario_ids)
    && message.mencoes_usuario_ids.some((id) => Number(id) === Number(usuarioAtual?.id));
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
      detalhe: 'Ninguém do grupo viu ainda',
      tooltip: 'Ninguém do grupo viu ainda'
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
    return `${getAttachmentKindLabel(message)}: ${message.arquivo_nome_original || 'anexo'}`;
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

function isStickerAttachment(message) {
  if (!isImageAttachment(message)) return false;
  const name = String(message.arquivo_nome_original || message.arquivo_url || '');
  const mimetype = String(message.arquivo_mimetype || '').toLowerCase();
  const extSticker = /\.(gif|webp)$/i.test(name);
  const smallImage = Number(message.arquivo_tamanho || 0) > 0 && Number(message.arquivo_tamanho || 0) <= 512 * 1024;
  return extSticker || (mimetype.startsWith('image/') && smallImage);
}

function getAttachmentKindLabel(message) {
  if (!message || message.tipo !== 'arquivo') return '';
  if (message.arquivo_expirado_em) return 'Arquivo removido';
  if (isStickerAttachment(message)) return 'Figurinha';
  if (isImageAttachment(message)) return 'Imagem';
  if (isVideoAttachment(message)) return 'Video';
  if (isPdfAttachment(message)) return 'PDF';
  return 'Arquivo';
}

function getAttachmentExtension(message) {
  const name = String(message?.arquivo_nome_original || message?.arquivo_url || '');
  const match = name.match(/\.([a-z0-9]{2,6})(?:$|\?)/i);
  return match ? match[1].toUpperCase() : '';
}

function getAttachmentTags(message) {
  if (!message || message.tipo !== 'arquivo') return [];
  const tags = [getAttachmentKindLabel(message)].filter(Boolean);
  const extension = getAttachmentExtension(message);
  if (extension && !tags.some((tag) => tag.toUpperCase() === extension)) tags.push(extension);
  if (Number(message.arquivo_tamanho || 0) > 0) tags.push(formatFileSize(message.arquivo_tamanho));
  if (message.arquivo_expirado_em || !message.arquivo_url) tags.push('Indisponivel');
  else tags.push('Anexo seguro');
  return tags.slice(0, 4);
}

function getAttachmentTagsHtml(message) {
  const tags = getAttachmentTags(message);
  if (!tags.length) return '';
  return `<div class="attachment-tags">${tags.map((tag) => `<span class="attachment-tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
}

function isOfficeAttachment(message) {
  return message?.tipo === 'arquivo' && /\.(docx?|xlsx?)$/i.test(String(message.arquivo_nome_original || message.arquivo_url || ''));
}

function getAttachmentFileName(rawUrl = '') {
  const value = String(rawUrl || '');
  if (!value) return '';
  try {
    const pathname = new URL(value, window.location.origin).pathname;
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || '');
  } catch (_err) {
    return decodeURIComponent(value.split('/').filter(Boolean).pop() || '');
  }
}

function getProtectedAttachmentUrl(rawUrl = '', variant = '') {
  const fileName = getAttachmentFileName(rawUrl);
  if (!fileName) return '';
  return variant ? `/api/uploads/${encodeURIComponent(fileName)}/${variant}` : `/api/uploads/${encodeURIComponent(fileName)}`;
}

function isBundledSticker(sticker) {
  return Boolean(sticker?.bundled || String(sticker?.url || '').startsWith('/assets/stickers/'));
}

function getCachedAttachmentObjectUrl(rawUrl = '', variant = '') {
  const protectedUrl = getProtectedAttachmentUrl(rawUrl, variant);
  return protectedUrl ? (secureAttachmentBlobUrls.get(protectedUrl) || '') : '';
}

async function fetchProtectedAttachmentBlob(rawUrl = '', variant = '') {
  const protectedUrl = getProtectedAttachmentUrl(rawUrl, variant);
  if (!protectedUrl) throw new Error('Arquivo inválido');
  if (secureAttachmentBlobCache.has(protectedUrl)) return secureAttachmentBlobCache.get(protectedUrl);
  if (secureAttachmentPending.has(protectedUrl)) return secureAttachmentPending.get(protectedUrl);

  const pending = fetch(protectedUrl, { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error('Arquivo indisponível ou sem permissão');
      return response.blob();
    })
    .then((blob) => {
      secureAttachmentBlobCache.set(protectedUrl, blob);
      if (!secureAttachmentBlobUrls.has(protectedUrl)) {
        secureAttachmentBlobUrls.set(protectedUrl, URL.createObjectURL(blob));
      }
      return blob;
    })
    .finally(() => secureAttachmentPending.delete(protectedUrl));

  secureAttachmentPending.set(protectedUrl, pending);
  return pending;
}

async function getProtectedAttachmentObjectUrl(rawUrl = '', variant = '') {
  const protectedUrl = getProtectedAttachmentUrl(rawUrl, variant);
  const cached = protectedUrl ? secureAttachmentBlobUrls.get(protectedUrl) : '';
  if (cached) return cached;
  await fetchProtectedAttachmentBlob(rawUrl, variant);
  return secureAttachmentBlobUrls.get(protectedUrl) || '';
}

function hydrateSecureAttachments(root = document) {
  root.querySelectorAll('[data-secure-attachment]').forEach(async (element) => {
    const rawUrl = element.getAttribute('data-secure-attachment');
    if (!rawUrl || element.dataset.secureLoaded === 'true') return;
    try {
      const objectUrl = await getProtectedAttachmentObjectUrl(rawUrl);
      if (!objectUrl) return;
      if (element.tagName === 'IMG' || element.tagName === 'VIDEO' || element.tagName === 'IFRAME') {
        element.src = objectUrl;
        element.dataset.secureLoaded = 'true';
      }
    } catch (_err) {
      element.classList.add('attachment-load-error');
    }
  });

  // Miniatura leve (gerada no servidor) para grids como a Galeria de midia;
  // cai para o arquivo original no proprio endpoint se nao houver thumb.
  root.querySelectorAll('[data-secure-thumb]').forEach(async (element) => {
    const rawUrl = element.getAttribute('data-secure-thumb');
    if (!rawUrl || element.dataset.secureLoaded === 'true') return;
    try {
      const objectUrl = await getProtectedAttachmentObjectUrl(rawUrl, 'thumb');
      if (!objectUrl) return;
      if (element.tagName === 'IMG') {
        element.src = objectUrl;
        element.dataset.secureLoaded = 'true';
      }
    } catch (_err) {
      element.classList.add('attachment-load-error');
    }
  });

  root.querySelectorAll('[data-secure-pdf-placeholder]').forEach(async (element) => {
    const rawUrl = element.getAttribute('data-secure-pdf-placeholder');
    if (!rawUrl || element.dataset.secureLoaded === 'true') return;
    try {
      const objectUrl = await getProtectedAttachmentObjectUrl(rawUrl);
      if (!objectUrl) return;
      const iframe = document.createElement('iframe');
      iframe.src = `${objectUrl}#toolbar=0&navpanes=0`;
      iframe.title = 'Previa do PDF anexado';
      iframe.loading = 'lazy';
      element.replaceWith(iframe);
    } catch (_err) {
      element.classList.add('attachment-load-error');
      element.innerHTML = '<span>PDF</span><small>Abra para visualizar</small>';
    }
  });
}

async function baixarArquivoMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  if (!message?.arquivo_url) return;
  try {
    await fetchProtectedAttachmentBlob(message.arquivo_url);
    const objectUrl = await getProtectedAttachmentObjectUrl(message.arquivo_url);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = message.arquivo_nome_original || 'arquivo';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    mostrarNotificacao(err.message || 'Erro ao baixar arquivo', 'error');
  }
}

function getAttachmentViewerMode(message) {
  if (isImageAttachment(message)) return 'image';
  if (isPdfAttachment(message)) return 'pdf';
  if (isVideoAttachment(message)) return 'video';
  if (isOfficeAttachment(message)) return 'office';
  return 'file';
}

function setAttachmentViewerLoading(message) {
  const title = document.getElementById('attachmentViewerTitle');
  const meta = document.getElementById('attachmentViewerMeta');
  const body = document.getElementById('attachmentViewerBody');
  const printBtn = document.getElementById('attachmentPrintBtn');
  if (title) title.textContent = message?.arquivo_nome_original || 'Arquivo';
  if (meta) meta.textContent = `${getAttachmentKindLabel(message)} · ${formatFileSize(message?.arquivo_tamanho)}`;
  if (body) body.innerHTML = '<div class="attachment-viewer-fallback"><strong>Carregando arquivo...</strong><p>Preparando a visualizacao segura.</p></div>';
  if (printBtn) printBtn.disabled = true;
}

async function abrirVisualizadorArquivo(messageId) {
  const message = getMessageByIdFromCache(messageId);
  if (!message?.arquivo_url) {
    mostrarNotificacao('Arquivo indisponível', 'error');
    return;
  }

  currentAttachmentViewerMessageId = Number(messageId);
  setAttachmentViewerLoading(message);
  document.getElementById('attachmentViewerModal')?.classList.add('active');

  try {
    const objectUrl = await getProtectedAttachmentObjectUrl(message.arquivo_url);
    const mode = getAttachmentViewerMode(message);
    const body = document.getElementById('attachmentViewerBody');
    const printBtn = document.getElementById('attachmentPrintBtn');
    const canPrint = mode === 'image' || mode === 'pdf';
    if (printBtn) printBtn.disabled = !canPrint;

    if (mode === 'image') {
      body.innerHTML = `<img src="${escapeHtml(objectUrl)}" alt="${escapeHtml(message.arquivo_nome_original || 'Imagem anexada')}" />`;
    } else if (mode === 'pdf') {
      body.innerHTML = `<iframe id="attachmentViewerFrame" src="${escapeHtml(objectUrl)}" title="${escapeHtml(message.arquivo_nome_original || 'PDF')}"></iframe>`;
    } else if (mode === 'video') {
      body.innerHTML = `<video src="${escapeHtml(objectUrl)}" controls autoplay></video>`;
    } else if (mode === 'office') {
      body.innerHTML = `
        <div class="attachment-viewer-fallback">
          <strong>Documento pronto para baixar</strong>
          <p>Arquivos do Word e Excel nao sao exibidos diretamente pelo navegador de forma segura dentro do chat. Use Baixar para abrir no aplicativo correspondente.</p>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="attachment-viewer-fallback">
          <strong>Previa nao disponivel</strong>
          <p>Este tipo de arquivo nao possui visualizacao interna. Voce ainda pode baixar o anexo.</p>
        </div>
      `;
    }
  } catch (err) {
    document.getElementById('attachmentViewerBody').innerHTML = `
      <div class="attachment-viewer-fallback">
        <strong>Nao foi possivel abrir</strong>
        <p>${escapeHtml(err.message || 'Erro ao carregar arquivo')}</p>
      </div>
    `;
  }
}

function fecharVisualizadorArquivo() {
  document.getElementById('attachmentViewerModal')?.classList.remove('active');
  const body = document.getElementById('attachmentViewerBody');
  if (body) body.innerHTML = '';
  currentAttachmentViewerMessageId = null;
}

function baixarArquivoVisualizado() {
  if (!currentAttachmentViewerMessageId) return;
  baixarArquivoMensagem(currentAttachmentViewerMessageId);
}

async function imprimirArquivoVisualizado() {
  const message = getMessageByIdFromCache(currentAttachmentViewerMessageId);
  if (!message?.arquivo_url) return;

  try {
    const objectUrl = await getProtectedAttachmentObjectUrl(message.arquivo_url);
    if (isPdfAttachment(message)) {
      const frame = document.getElementById('attachmentViewerFrame');
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    }

    if (isImageAttachment(message)) {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);
      const doc = printFrame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html><head><title>${escapeHtml(message.arquivo_nome_original || 'Imagem')}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:100vh}</style></head><body><img src="${escapeHtml(objectUrl)}" onload="window.focus();window.print();"></body></html>`);
      doc.close();
      setTimeout(() => printFrame.remove(), 3000);
      return;
    }

    mostrarNotificacao('Impressão disponível para PDF e imagens', 'info');
  } catch (err) {
    mostrarNotificacao(err.message || 'Erro ao imprimir arquivo', 'error');
  }
}

function getStickerFromMessage(message) {
  if (!isStickerAttachment(message) || !message.arquivo_url) return null;
  return {
    url: message.arquivo_url,
    name: message.arquivo_nome_original || 'figurinha.webp',
    mimetype: message.arquivo_mimetype || 'image/webp',
    size: Number(message.arquivo_tamanho || 0),
    savedAt: new Date().toISOString()
  };
}

function carregarFigurinhasSalvas() {
  try {
    const stored = JSON.parse(localStorage.getItem(STICKERS_KEY) || '[]');
    const customStickers = Array.isArray(stored)
      ? stored.filter((item) => item?.url && item?.name && !isBundledSticker(item))
      : [];
    const merged = [...DEFAULT_STICKERS, ...customStickers];
    const seen = new Set();
    savedStickers = merged
      .filter((item) => {
        const key = String(item.url || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 80);
  } catch (_err) {
    savedStickers = [...DEFAULT_STICKERS];
  }
}

function salvarFigurinhasSalvas() {
  localStorage.setItem(STICKERS_KEY, JSON.stringify(savedStickers.filter((item) => !isBundledSticker(item)).slice(0, 80)));
}

function adicionarFigurinhaSalva(message, { notify = false } = {}) {
  const sticker = getStickerFromMessage(message);
  if (!sticker) return false;
  const exists = savedStickers.some((item) => item.url === sticker.url);
  if (exists) return false;
  savedStickers = [sticker, ...savedStickers].slice(0, 80);
  salvarFigurinhasSalvas();
  renderStickerPicker();
  if (notify) mostrarNotificacao('Figurinha salva', 'success');
  return true;
}

function adicionarFigurinhasSalvasEmLote(messages = []) {
  const currentUrls = new Set(savedStickers.map((item) => item.url));
  const newStickers = [];

  messages.forEach((message) => {
    const sticker = getStickerFromMessage(message);
    if (!sticker || currentUrls.has(sticker.url)) return;
    currentUrls.add(sticker.url);
    newStickers.push(sticker);
  });

  if (!newStickers.length) return false;
  savedStickers = [...newStickers, ...savedStickers].slice(0, 80);
  salvarFigurinhasSalvas();
  return true;
}

function salvarFigurinhaMensagem(messageId) {
  const message = getMessageByIdFromCache(messageId);
  if (!message) return;
  const added = adicionarFigurinhaSalva(message, { notify: true });
  if (!added) mostrarNotificacao('Essa figurinha ja esta salva', 'info');
}

function fecharStickerPicker() {
  document.getElementById('stickerPicker')?.classList.add('hidden');
  document.getElementById('stickerToggleBtn')?.setAttribute('aria-expanded', 'false');
}

function renderStickerPicker() {
  const picker = document.getElementById('stickerPicker');
  if (!picker) return;
  const headerHtml = `
    <div class="sticker-picker-header">
      <span>Figurinhas</span>
      <button type="button" class="sticker-picker-close" onclick="fecharStickerPicker()" aria-label="Fechar figurinhas" title="Fechar figurinhas">Fechar</button>
    </div>
  `;
  if (!savedStickers.length) {
    picker.innerHTML = `${headerHtml}<div class="sticker-empty">Nenhuma figurinha salva</div>`;
    return;
  }
  picker.innerHTML = headerHtml + savedStickers.map((sticker, index) => `
    <button type="button" class="sticker-option" data-sticker-index="${index}" title="${escapeHtml(sticker.name)}" aria-label="Enviar figurinha ${escapeHtml(sticker.name)}">
      <img src="${escapeHtml(isBundledSticker(sticker) ? sticker.url : (getCachedAttachmentObjectUrl(sticker.url) || ATTACHMENT_PLACEHOLDER_SRC))}" ${isBundledSticker(sticker) ? '' : `data-secure-attachment="${escapeHtml(sticker.url)}"`} alt="${escapeHtml(sticker.name)}" loading="lazy" />
    </button>
  `).join('');
  picker.querySelectorAll('[data-sticker-index]').forEach((button) => {
    button.addEventListener('click', () => enviarFigurinhaSalva(Number(button.dataset.stickerIndex)));
  });
  hydrateSecureAttachments(picker);
}

async function fetchStickerBlob(sticker) {
  if (isBundledSticker(sticker)) {
    const response = await fetch(sticker.url);
    if (!response.ok) throw new Error('Figurinha indisponível');
    return response.blob();
  }
  return fetchProtectedAttachmentBlob(sticker.url);
}

function alternarFigurinhas(event) {
  event.stopPropagation();
  const picker = document.getElementById('stickerPicker');
  if (!picker) return;
  renderStickerPicker();
  picker.classList.toggle('hidden');
  document.getElementById('stickerToggleBtn')?.setAttribute('aria-expanded', String(!picker.classList.contains('hidden')));
  fecharEmojiPicker();
  document.getElementById('templatePicker')?.classList.add('hidden');
}

async function enviarFigurinhaSalva(index) {
  const sticker = savedStickers[index];
  if (!sticker) return;
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Selecione uma conversa antes de enviar figurinha', 'error');
    return;
  }
  try {
    const blob = await fetchStickerBlob(sticker);
    const extension = getClipboardExtension(blob.type || sticker.mimetype) || '.webp';
    const cleanName = String(sticker.name || 'figurinha.webp').replace(/\.[^.]+$/, '') || 'figurinha';
    const file = new File([blob], `${cleanName}${extension}`, { type: blob.type || sticker.mimetype || 'image/webp' });
    fecharStickerPicker();
    await enviarArquivoSelecionado(file, { clearInput: false });
  } catch (err) {
    mostrarNotificacao(err.message || 'Erro ao enviar figurinha', 'error');
  }
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
    if (message.arquivo_expirado_em) {
      return [message.arquivo_nome_original || 'PDF', 'Arquivo removido automaticamente apos 30 dias'].join('\n');
    }
    const url = message.arquivo_url ? new URL(getProtectedAttachmentUrl(message.arquivo_url), window.location.origin).href : '';
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

function getUnreadBadgeTitle(total) {
  const count = Number(total) || 0;
  return `${count} ${count === 1 ? 'mensagem nao lida' : 'mensagens nao lidas'}`;
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
  marcarConversaAtualComoLidaSeVisivel();
});

window.addEventListener('focus', () => {
  updateBrowserTitle();
  marcarConversaAtualComoLidaSeVisivel();
});

function isAppVisibleAndFocused() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function marcarConversaAtualComoLidaSeVisivel() {
  if (!socket || !tipoChat || !chatIdAtual || !usuarioAtual || !isAppVisibleAndFocused()) return false;
  const key = getChatKey(tipoChat, chatIdAtual);

  if (tipoChat === 'grupo') {
    socket.emit('marcar-lidas-grupo', {
      grupoId: chatIdAtual,
      usuarioId: usuarioAtual.id
    });
    unreadState[key] = 0;
    scheduleSidebarRender({ groups: true });
  } else {
    socket.emit('marcar-lidas', {
      remetenteId: chatIdAtual,
      destinatarioId: usuarioAtual.id
    });
    unreadState[key] = 0;
    scheduleSidebarRender({ contacts: true });
  }

  updateBrowserTitle();
  return true;
}

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
  icon.classList.toggle('header-avatar-private', tipo === 'privado');
  icon.classList.toggle('header-avatar-group', tipo === 'grupo');
  icon.removeAttribute('style');
  if (tipo === 'grupo') icon.textContent = '#';
  else if (tipo === 'privado') {
    const online = onlineState.has(Number(chatIdAtual));
    const status = getUserStatus(chatIdAtual);
    icon.innerHTML = `${escapeHtml(initials(nome))}<span class="presence-dot ${online ? 'online' : ''} status-${escapeHtml(status)}" title="${escapeHtml(online ? getStatusLabel(status) : 'Offline')}"></span>`;
    icon.setAttribute('style', `background:${avatarGradient(nome)}`);
  }
  else icon.innerHTML = getMiniBrandMarkup();
}

function updateHeaderStatus() {
  const subtitle = document.getElementById('headerSubtitle');
  const motivation = document.getElementById('headerMotivation');
  if (!subtitle || !motivation) return;
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
      const lastSeen = lastSeenState[Number(contato.id)] || contato.ultimo_visto_em;
      if (online && isRecentlyActive(lastSeen)) {
        subtitle.textContent = `Online agora - ${getStatusLabel(getUserStatus(contato.id))}${statusSuffix}`;
      } else if (online) {
        subtitle.textContent = `Online, ${formatLastSeen(lastSeen).replace(/^Visto/, 'visto')}${statusSuffix}`;
      } else {
        subtitle.textContent = `${formatLastSeen(lastSeen)}${statusSuffix}`;
      }
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
  scheduleSidebarRender({ groups: true, contacts: true });
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
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
  }[normalized] || '';
}

function hasAllowedUploadExtension(fileName = '') {
  return /\.(pdf|docx?|xlsx?|jpe?g|png|gif|webp|avi)$/i.test(String(fileName || ''));
}

async function hasWebpSignature(file) {
  if (!file?.slice || !file?.arrayBuffer) return false;
  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const text = Array.from(bytes).map((byte) => String.fromCharCode(byte)).join('');
    return text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP';
  } catch (_err) {
    return false;
  }
}

async function normalizeUploadFile(file) {
  if (!file) return null;
  if (hasAllowedUploadExtension(file.name)) return file;

  const isWebp = String(file.type || '').toLowerCase() === 'image/webp' || await hasWebpSignature(file);
  if (!isWebp) return file;

  const cleanBase = String(file.name || 'figurinha-whatsapp')
    .replace(/\.[^.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim() || 'figurinha-whatsapp';

  try {
    return new File([file], `${cleanBase}.webp`, { type: 'image/webp' });
  } catch (_err) {
    return file;
  }
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

// Troca os emojis nativos (que no Windows/Chrome sem GPU costumam renderizar
// "craquelados", pixelizados) por imagens SVG nitidas do Twemoji. Se o CDN
// falhar (sem internet), o emoji nativo continua visivel normalmente.
function aplicarTwemoji(el) {
  if (window.twemoji && el) {
    try { twemoji.parse(el, { folder: 'svg', ext: '.svg' }); } catch (_e) {}
  }
}

function renderEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  if (!picker || picker.dataset.rendered === 'true') return;
  picker.innerHTML = EMOJI_OPTIONS.map((emoji) => `
    <button type="button" class="emoji-option" onclick="inserirEmoji('${escapeHtml(emoji).replace(/'/g, '&#039;')}')" title="${escapeHtml(emoji)}" aria-label="Inserir emoji ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>
  `).join('');
  aplicarTwemoji(picker);
  picker.dataset.rendered = 'true';
}

function alternarEmojis(event) {
  event.stopPropagation();
  renderEmojiPicker();
  const picker = document.getElementById('emojiPicker');
  picker.classList.toggle('hidden');
  document.getElementById('emojiToggleBtn')?.setAttribute('aria-expanded', String(!picker.classList.contains('hidden')));
  fecharStickerPicker();
  document.getElementById('templatePicker')?.classList.add('hidden');
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
    console.warn('Service worker indisponível', err);
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

function atualizarBotaoNotificacoes() {
  const button = document.getElementById('notificationPermissionBtn');
  if (!button) return;

  if (!('Notification' in window)) {
    button.classList.add('hidden');
    return;
  }

  const permission = Notification.permission;
  button.classList.toggle('hidden', permission === 'denied');
  button.classList.toggle('is-enabled', permission === 'granted');
  button.disabled = permission === 'granted';
  button.textContent = permission === 'granted' ? 'Notificacoes ativas' : 'Ativar notificacoes';
  button.title = permission === 'granted'
    ? 'Este navegador ja avisa quando chegam mensagens'
    : 'Receber avisos mesmo quando o chat estiver em segundo plano';
}

async function ativarNotificacoesNavegador() {
  if (!('Notification' in window)) {
    mostrarNotificacao('Este navegador nao oferece notificacoes.', 'warning');
    return;
  }

  try {
    await registrarServiceWorkerNotificacoes();
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    atualizarBotaoNotificacoes();

    if (permission === 'granted') {
      await inicializarWebPush();
      localStorage.removeItem(NOTIFICATION_PROMPT_KEY);
      mostrarNotificacao('Notificacoes do navegador ativadas', 'success');
      return;
    }

    localStorage.setItem(NOTIFICATION_PROMPT_KEY, '1');
    mostrarNotificacao('Notificacoes nao foram ativadas neste navegador.', 'warning');
  } catch (err) {
    mostrarNotificacao('Nao foi possivel ativar notificacoes: ' + err.message, 'error');
  }
}

async function carregarDadosIniciais() {
  await carregarWorkflow();
  await carregarGrupos();
  await carregarContatos();
  await carregarResumoConversas();
  await registrarServiceWorkerNotificacoes();
  updateBrowserTitle();
  atualizarBotaoNotificacoes();
  atualizarPainelInicialSeAberto();
  if ('Notification' in window && Notification.permission === 'granted') inicializarWebPush();
}

function aplicarSessaoUsuario() {
  document.getElementById('loginContainer').classList.add('hidden');
  document.getElementById('chatContainer').classList.remove('hidden');
  document.getElementById('currentUserName').textContent = usuarioAtual.nome;
  document.getElementById('currentUserEmail').textContent = usuarioAtual.email;
  document.getElementById('currentUserAvatar').textContent = initials(usuarioAtual.nome);
  document.getElementById('currentUserAvatar').parentElement.setAttribute('style', `background:${avatarGradient(usuarioAtual.nome || usuarioAtual.email)}`);
  userStatusState[Number(usuarioAtual.id)] = usuarioAtual.status || 'disponivel';
  startActivityTracking();
  document.getElementById('userStatusSelect').value = usuarioAtual.status || 'disponivel';

  const isAdmin = Boolean(usuarioAtual.admin);
  document.getElementById('adminBadge').style.display = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('adminSection').classList.toggle('hidden', !isAdmin);
  document.getElementById('novoGrupoBtn').style.display = isAdmin ? 'inline-flex' : 'none';
  document.getElementById('ajustesBtn').classList.remove('hidden');
  carregarMencoesInbox();
  atualizarBadgeOperacional();
  atualizarBotaoNotificacoes();
  updateDailyMotivation();
  if (!tipoChat || !chatIdAtual) renderWelcomeState();
}

const ASSISTENTE_JURIDICO_ATIVO = false;

function avisarAssistenteEmBreve() {
  mostrarNotificacao('Assistente Jurídico em breve. Ele será liberado quando a IA estiver ativada pelo administrador.', 'info');
}

function abrirAssistenteJuridico() {
  if (!ASSISTENTE_JURIDICO_ATIVO) {
    avisarAssistenteEmBreve();
    return;
  }
  if (!usuarioAtual) return;
  const panel = document.getElementById('assistantNativePanel');
  const firstName = String(usuarioAtual.nome || usuarioAtual.email || 'colaborador').trim().split(/\s+/)[0];
  document.getElementById('assistantNativeUser').textContent = usuarioAtual.nome || usuarioAtual.email;
  document.getElementById('assistantFirstName').textContent = firstName;
  document.getElementById('assistantNativeEmail').textContent = usuarioAtual.email || 'Sessão do Chat Interno';
  panel?.classList.remove('hidden');
  document.body.classList.add('assistant-native-open');
  definirModoAssistente(modoAssistente);
  setTimeout(() => document.getElementById('assistantQuestion')?.focus(), 80);
}

function fecharAssistenteJuridico() {
  document.getElementById('assistantNativePanel')?.classList.add('hidden');
  document.body.classList.remove('assistant-native-open');
}

let modoAssistente = 'orientacao';

function normalizarAssistente(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getRespostaAssistente(question, mode = modoAssistente) {
  const normalized = normalizarAssistente(question);
  const isPersonal = /\b(receita|namorad|casament[o|a] pessoal|relacionamento|horoscopo|filme|serie|jogo|viagem|dieta|academia|fofoca|conselho pessoal|vida pessoal)\b/.test(normalized);
  const isCartorio = /cartorio|registro|registral|certidao|casamento|nascimento|obito|averbacao|emancipacao|pacto|protesto|rtd|rcpn|rcpj|estatuto|associacao|ata|documento|reconhecimento de firma|autenticacao|nota devolutiva|exigencia|oficial|habilitacao|protocolo|pessoa juridica|atendimento|email|e-mail/.test(normalized);
  if (isPersonal || !isCartorio) {
    return {
      level: 'ESCOPO INTERNO',
      title: 'Assunto fora do escopo do Assistente',
      text: 'Essa pergunta é pessoal ou não está ligada à rotina do cartório e, por isso, não pode ser atendida pelo Assistente.',
      basis: 'Regra de uso interno: assuntos pessoais e gerais não são processados nem enviados para a IA.',
      nextStep: 'A tentativa foi registrada para ciência do administrador. Reformule a dúvida informando o ato do cartório ou o documento que precisa conferir.'
    };
  }
  const isSensitive = /recusa|falso|falsidade|competencia|suscitacao|estado civil|filiacao|incapacidade|divergencia relevante|fraude|documento adulterado/.test(normalized);
  if (isSensitive) {
    return {
      level: 'OFICIAL',
      title: 'Encaminhamento obrigatório ao Oficial',
      text: 'Esta situação deve ser submetida ao Oficial. Ela pode envolver interpretação jurídica relevante, competência, responsabilidade da serventia ou reflexos no direito de terceiros. Reúna os documentos e descreva objetivamente a divergência antes do encaminhamento.',
      basis: 'Encaminhamento preventivo conforme o protocolo interno de segurança registral.',
      nextStep: 'Não envie resposta definitiva ao usuário antes da validação do Oficial.'
    };
  }
  if (mode === 'email') {
    if (/certidao/.test(normalized)) {
      return {
        level: 'ROTINA',
        title: 'Minuta de resposta para e-mail ou WhatsApp',
        text: 'Olá, [Nome].\n\nA solicitação de certidão pode ser realizada pelo portal oficial de forma rápida e segura. Caso prefira atendimento presencial, pedimos que informe qual certidão necessita e os dados disponíveis para localizarmos o registro.\n\nFicamos à disposição.\n\nCartório Dias de Castro',
        basis: 'Minuta de atendimento: não confirme a localização do registro sem a consulta correspondente.',
        nextStep: 'Substitua [Nome] e envie o link oficial de solicitação quando for adequado.',
        link: { href: 'https://serp.registros.org.br/', label: 'Abrir solicitação oficial de certidão (SERP)' }
      };
    }
    if (/casamento|habilitacao/.test(normalized)) {
      return {
        level: 'ROTINA',
        title: 'Minuta de resposta por e-mail',
        text: 'Olá, [Nome].\n\nAgradecemos o seu contato. Para iniciarmos a orientação sobre a habilitação de casamento, pedimos que nos informe o estado civil de ambos os nubentes e apresente os documentos de identificação, as certidões atualizadas compatíveis com o estado civil e o comprovante de residência.\n\nApós a conferência dos documentos, informaremos os próximos passos e eventual necessidade de documentação complementar.\n\nAtenciosamente,\nCartório Dias de Castro',
        basis: 'Minuta de atendimento: conferir dados, documentos e normas internas antes do envio.',
        nextStep: 'Substitua [Nome], ajuste os documentos ao caso concreto e revise antes de enviar.'
      };
    }
    if (/estatuto|rcpj|associacao|ata/.test(normalized)) {
      return {
        level: 'ATENÇÃO',
        title: 'Minuta de resposta por e-mail',
        text: 'Olá, [Nome].\n\nPara a análise do pedido de registro, pedimos o envio da versão consolidada do estatuto, da ata correspondente, da convocação, da lista de presença e dos demais documentos que comprovem as deliberações e assinaturas exigidas.\n\nA documentação será qualificada após o protocolo. Caso seja identificada alguma necessidade complementar, será emitida orientação específica.\n\nAtenciosamente,\nCartório Dias de Castro',
        basis: 'Minuta de atendimento para RCPJ: a qualificação definitiva depende dos documentos protocolados.',
        nextStep: 'Não antecipe deferimento por e-mail; confirme a situação somente após a qualificação.'
      };
    }
    return {
      level: 'ROTINA',
      title: 'Minuta de resposta por e-mail',
      text: 'Olá, [Nome].\n\nAgradecemos o seu contato. Para que possamos orientar corretamente, pedimos que nos informe o ato pretendido e encaminhe os documentos disponíveis para conferência.\n\nApós essa análise inicial, retornaremos com os próximos passos e eventuais documentos complementares.\n\nAtenciosamente,\nCartório Dias de Castro',
      basis: 'Minuta de atendimento: revisar o conteúdo e adequar ao caso antes do envio.',
      nextStep: 'Cole a mensagem recebida ou explique o caso com mais detalhes para uma minuta mais específica.'
    };
  }
  if (mode === 'nota') {
    return {
      level: 'ATENÇÃO',
      title: 'Estrutura segura para nota devolutiva',
      text: '1. Descreva objetivamente o documento ou ato apresentado.\n2. Aponte a inconsistência encontrada, sem linguagem conclusiva além do necessário.\n3. Indique a providência que permitirá o prosseguimento.\n4. Inclua a base legal ou normativa somente depois de confirmada.\n5. Revise clareza, prazo e identificação do protocolo antes da emissão.\n\nModelo inicial:\n“Verificou-se a necessidade de [providência]. Para o prosseguimento do pedido, solicita-se [documento/retificação], observada a norma aplicável ao caso.”',
      basis: 'Nunca emita exigência sem fundamento confirmado na legislação, no Código de Normas e nos procedimentos internos.',
      nextStep: 'Se houver dúvida de competência, interpretação ou impacto a terceiros, encaminhe ao Oficial.'
    };
  }
  if (/casamento|habilita/.test(normalized)) {
    return {
      level: 'ROTINA',
      title: 'Habilitação de casamento — triagem inicial',
      text: 'Para iniciar a habilitação, confira a identificação dos nubentes, as certidões de nascimento ou de casamento com as averbações cabíveis e o comprovante de residência. A conferência final depende do estado civil e da documentação apresentada.',
      basis: 'Lei nº 6.015/1973 e Código de Normas da CGJ/SC: confirmar a redação vigente na base normativa interna.',
      nextStep: 'Identifique o estado civil de cada nubente antes de informar a relação final de documentos.'
    };
  }
  if (/certidao|segunda via|2a via/.test(normalized)) {
    return {
      level: 'ROTINA',
      title: 'Certidões — orientação ao atendimento',
      text: 'Identifique qual certidão é necessária e solicite os dados disponíveis para localização do registro. Quando o usuário preferir o serviço online, indique o portal oficial de solicitações. Não confirme prazo, valor ou existência do registro antes da consulta apropriada.',
      basis: 'Orientação de atendimento do cartório e canal oficial de solicitação eletrônica.',
      nextStep: 'Informe ao usuário o canal adequado e confira se a certidão pretendida exige dado complementar.',
      link: { href: 'https://serp.registros.org.br/', label: 'Abrir solicitações de certidões (SERP)' }
    };
  }
  if (/nascimento|recem nascido|recem-nascido/.test(normalized)) {
    return {
      level: 'ROTINA',
      title: 'Registro de nascimento — triagem inicial',
      text: 'Para a triagem, confira a declaração de nascido vivo quando aplicável, a identificação dos responsáveis e os elementos necessários para o assento. Situações com ausência de documentação, reconhecimento de paternidade, declaração especial ou divergência de dados devem ser apresentadas ao Oficial antes da orientação definitiva.',
      basis: 'Lei nº 6.015/1973 e Código de Normas da CGJ/SC: conferir a regra vigente e os documentos do caso.',
      nextStep: 'Registre quais documentos foram apresentados e identifique qualquer divergência de nome, filiação ou data.'
    };
  }
  if (/obito|plantao/.test(normalized)) {
    return {
      level: 'ATENÇÃO',
      title: 'Registro de óbito — atendimento e plantão',
      text: 'Confirme a urgência, a declaração de óbito e a identificação de quem fará a declaração. No plantão, concentre a orientação no registro de óbito e encaminhe situações incomuns ou inconsistências documentais ao responsável pelo serviço.',
      basis: 'Rotina de atendimento do cartório e legislação aplicável ao Registro Civil das Pessoas Naturais.',
      nextStep: 'Confirme o horário e canal de plantão vigente antes de orientar o usuário.',
      link: { href: 'https://registrocivilchapeco.com.br/', label: 'Consultar canais e plantão no site do cartório' }
    };
  }
  if (/averb|anotacao/.test(normalized)) {
    return {
      level: 'ATENÇÃO',
      title: 'Anotações e averbações — conferência inicial',
      text: 'Identifique o assento que será alterado e o título que fundamenta o pedido. Confira se o documento é compatível com o ato pretendido, se os dados coincidem com o registro e se há averbações anteriores relevantes. Não antecipe o resultado da qualificação.',
      basis: 'Lei nº 6.015/1973, Código de Normas da CGJ/SC e título apresentado.',
      nextStep: 'Separe o assento, o título base e as divergências encontradas para a qualificação.'
    };
  }
  if (/titulo|rtd|notificacao extrajudicial/.test(normalized)) {
    return {
      level: 'ATENÇÃO',
      title: 'Títulos e Documentos — triagem inicial',
      text: 'Confirme a natureza do instrumento, a finalidade do registro, a integridade do documento e a identificação das partes. Verifique se há anexos, assinaturas e elementos indispensáveis para a publicidade pretendida. Casos de competência duvidosa ou eficácia perante terceiros devem ser submetidos ao Oficial.',
      basis: 'Lei nº 6.015/1973 e procedimento interno para Registro de Títulos e Documentos.',
      nextStep: 'Descreva o tipo de documento e a finalidade informada pelo apresentante antes de orientar os próximos passos.'
    };
  }
  if (/estatuto|rcpj|associa/.test(normalized)) {
    return {
      level: 'ATENÇÃO',
      title: 'RCPJ — conferência inicial',
      text: 'Confira a versão consolidada do estatuto, convocação, quórum, lista de presença, assinaturas e a compatibilidade da ata com as regras estatutárias. Se houver divergência entre o estatuto e a deliberação, encaminhe ao Oficial antes de concluir a qualificação.',
      basis: 'Código Civil, Lei nº 6.015/1973 e normas aplicáveis ao RCPJ; verificar a base interna antes da resposta definitiva.',
      nextStep: 'Monte uma lista objetiva das pendências e confronte cada uma com o estatuto apresentado.'
    };
  }
  if (/nota devolutiva|exig[êe]ncia/.test(normalized)) {
    return {
      level: 'ATENÇÃO',
      title: 'Nota devolutiva — orientação',
      text: 'A nota devolutiva deve apontar o problema encontrado, indicar de forma clara a providência necessária e mencionar a base normativa quando ela estiver localizada. Não formule exigência sem suporte legal ou normativo.',
      basis: 'Protocolo interno de qualificação e legislação aplicável ao ato solicitado.',
      nextStep: 'Use o modo “Nota devolutiva” para receber uma estrutura de redação segura.'
    };
  }
  return {
    level: 'ATENÇÃO',
    title: 'Orientação inicial',
    text: 'A orientação inicial é conferir os documentos apresentados, o procedimento correspondente na base normativa interna e os modelos aprovados pela serventia. Se houver situação excepcional, ausência de regra clara ou risco registral, submeta ao Oficial.',
    basis: 'Consultar a legislação aplicável, o Código de Normas da CGJ/SC e as orientações internas vigentes.',
    nextStep: 'Informe o tipo de ato e o que já foi apresentado para receber uma orientação mais direcionada.'
  };
}

function definirModoAssistente(mode) {
  modoAssistente = ['orientacao', 'email', 'nota'].includes(mode) ? mode : 'orientacao';
  const config = {
    orientacao: { label: 'Orientação', placeholder: 'Ex.: quais documentos preciso para habilitação de casamento?' },
    email: { label: 'Resposta para e-mail / WhatsApp', placeholder: 'Ex.: preciso responder sobre documentos de casamento' },
    nota: { label: 'Nota devolutiva', placeholder: 'Descreva a pendência encontrada no documento...' }
  }[modoAssistente];
  document.querySelectorAll('[data-assistant-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.assistantMode === modoAssistente);
  });
  ['assistantQuestion', 'dashboardAssistantQuestion'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.placeholder = config.placeholder;
  });
  document.querySelectorAll('[data-assistant-mode-label]').forEach((element) => {
    element.textContent = config.label;
  });
}

function consultarServicoAssistente(question) {
  definirModoAssistente('orientacao');
  usarAtalhoAssistente(question);
}

async function registrarUsoAssistenteBloqueado() {
  try {
    await fetch('/api/assistente/uso-bloqueado', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ motivo: 'assunto fora do escopo interno' })
    });
  } catch (_err) {
    // O bloqueio continua válido mesmo se a auditoria estiver temporariamente indisponível.
  }
}

function responderPerguntaAssistente() {
  if (!ASSISTENTE_JURIDICO_ATIVO) {
    avisarAssistenteEmBreve();
    return;
  }
  const input = document.getElementById('assistantQuestion');
  const question = String(input?.value || '').trim();
  if (!question) {
    input?.focus();
    mostrarNotificacao('Escreva uma pergunta para o Assistente.', 'warning');
    return;
  }
  const response = getRespostaAssistente(question);
  if (response.level === 'ESCOPO INTERNO') registrarUsoAssistenteBloqueado();
  const answer = document.getElementById('assistantAnswer');
  const level = document.getElementById('assistantAnswerLevel');
  level.textContent = response.level;
  level.className = `assistant-answer-level ${response.level.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
  document.getElementById('assistantAnswerQuestion').textContent = response.title || question;
  document.getElementById('assistantAnswerText').textContent = response.text;
  document.getElementById('assistantAnswerBasis').textContent = response.basis;
  document.getElementById('assistantAnswerNext').textContent = response.nextStep || '';
  const answerLink = document.getElementById('assistantAnswerLink');
  if (response.link?.href) {
    answerLink.href = response.link.href;
    answerLink.textContent = `↗ ${response.link.label}`;
    answerLink.classList.remove('hidden');
  } else {
    answerLink.removeAttribute('href');
    answerLink.classList.add('hidden');
  }
  answer?.classList.remove('hidden');
  answer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function enviarPerguntaAssistente(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    responderPerguntaAssistente();
  }
}

function usarAtalhoAssistente(question) {
  const input = document.getElementById('assistantQuestion');
  input.value = question;
  responderPerguntaAssistente();
}

async function copiarRespostaAssistente() {
  const text = [
    document.getElementById('assistantAnswerQuestion')?.textContent,
    document.getElementById('assistantAnswerText')?.textContent,
    document.getElementById('assistantAnswerBasis')?.textContent,
    document.getElementById('assistantAnswerNext')?.textContent
  ].filter(Boolean).join('\n\n');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    mostrarNotificacao('Resposta copiada.', 'success');
  } catch (_err) {
    mostrarNotificacao('Não foi possível copiar a resposta.', 'warning');
  }
}

function responderPerguntaDashboard() {
  if (!ASSISTENTE_JURIDICO_ATIVO) {
    avisarAssistenteEmBreve();
    return;
  }
  const input = document.getElementById('dashboardAssistantQuestion');
  const question = String(input?.value || '').trim();
  if (!question) {
    input?.focus();
    return;
  }
  const response = getRespostaAssistente(question);
  if (response.level === 'ESCOPO INTERNO') registrarUsoAssistenteBloqueado();
  const answer = document.getElementById('dashboardAssistantAnswer');
  const level = document.getElementById('dashboardAssistantLevel');
  level.textContent = response.level;
  level.className = `dashboard-assistant-level ${response.level.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
  document.getElementById('dashboardAssistantTitle').textContent = response.title || 'Orientação';
  document.getElementById('dashboardAssistantText').textContent = response.text;
  document.getElementById('dashboardAssistantBasis').textContent = response.basis;
  document.getElementById('dashboardAssistantNext').textContent = response.nextStep || '';
  const dashboardLink = document.getElementById('dashboardAssistantLink');
  if (response.link?.href) {
    dashboardLink.href = response.link.href;
    dashboardLink.textContent = `↗ ${response.link.label}`;
    dashboardLink.classList.remove('hidden');
  } else {
    dashboardLink.removeAttribute('href');
    dashboardLink.classList.add('hidden');
  }
  answer?.classList.remove('hidden');
}

function enviarPerguntaDashboard(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    responderPerguntaDashboard();
  }
}

function usarAtalhoDashboard(question) {
  const input = document.getElementById('dashboardAssistantQuestion');
  input.value = question;
  responderPerguntaDashboard();
}

function consultarServicoDashboard(question) {
  definirModoAssistente('orientacao');
  usarAtalhoDashboard(question);
}

// Os botões do index.html usam onclick inline; exponha explicitamente as ações
// para funcionar também quando o bundle é servido em modo estrito/cacheado.
window.abrirAssistenteJuridico = abrirAssistenteJuridico;
window.fecharAssistenteJuridico = fecharAssistenteJuridico;
window.enviarPerguntaAssistente = enviarPerguntaAssistente;
window.responderPerguntaAssistente = responderPerguntaAssistente;
window.usarAtalhoAssistente = usarAtalhoAssistente;
window.copiarRespostaAssistente = copiarRespostaAssistente;
window.definirModoAssistente = definirModoAssistente;
window.consultarServicoAssistente = consultarServicoAssistente;
window.enviarPerguntaDashboard = enviarPerguntaDashboard;
window.responderPerguntaDashboard = responderPerguntaDashboard;
window.usarAtalhoDashboard = usarAtalhoDashboard;
window.consultarServicoDashboard = consultarServicoDashboard;

async function carregarWorkflow() {
  try {
    const response = await fetch('/api/workflow', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar fluxo de atendimento');
    const data = await response.json();
    attendanceStatusState = data.statusAtendimento && typeof data.statusAtendimento === 'object'
      ? data.statusAtendimento
      : {};
    conversationTagsState = data.etiquetas && typeof data.etiquetas === 'object'
      ? data.etiquetas
      : {};
    conversationNotesCountState = data.notasCount && typeof data.notasCount === 'object'
      ? data.notasCount
      : {};
    conversationAssigneeState = data.responsaveis && typeof data.responsaveis === 'object'
      ? data.responsaveis
      : {};
    priorityMessages = new Set((Array.isArray(data.mensagensPrioritarias) ? data.mensagensPrioritarias : []).map((id) => String(Number(id))));
    pinnedMessagesByConversation = data.mensagensFixadas && typeof data.mensagensFixadas === 'object'
      ? data.mensagensFixadas
      : {};
    salvarStatusAtendimento();
    renderWorkflowPanel();
    salvarMensagensPrioritarias();
    atualizarBadgeOperacional();
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
    time: lastTimeState[getChatKey('grupo', grupo.id)] || '',
    timestamp: lastTimestampState[getChatKey('grupo', grupo.id)] || 0
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
    time: lastTimeState[getChatKey('privado', usuario.id)] || '',
    timestamp: lastTimestampState[getChatKey('privado', usuario.id)] || 0
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
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    })
    .slice(0, limit);
}

function getDashboardChatCard(item) {
  const meta = item.unread > 0 ? (item.unread > 99 ? '99+' : item.unread) : (formatRelativeTime(item.timestamp) || item.time || (item.online ? 'on' : ''));
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

function getDashboardStatCard(label, value, filter, extraClass = '') {
  return `
    <button class="welcome-stat-card ${extraClass}" type="button" onclick="aplicarFiltroDashboard('${escapeHtml(filter)}')">
      <strong>${escapeHtml(value)}</strong>
      <span>${label}</span>
    </button>
  `;
}

const DASHBOARD_EMPTY_ICONS = {
  check: '<svg class="dashboard-empty-icon dashboard-empty-icon-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>',
  chat: '<svg class="dashboard-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-4.7 7.6 8.5 8.5 0 0 1-9.8-1.6L3 21l1.6-4.7A8.38 8.38 0 0 1 3 11.5a8.5 8.5 0 0 1 8-8.48V3h.5a8.5 8.5 0 0 1 8.5 8.5Z"/></svg>'
};

function getDashboardListHtml(title, subtitle, items, emptyText, emptyIcon = 'check') {
  const iconSvg = DASHBOARD_EMPTY_ICONS[emptyIcon] || DASHBOARD_EMPTY_ICONS.check;
  return `
    <section class="dashboard-panel">
      <div class="dashboard-panel-title">${title}<span>${subtitle}</span></div>
      <div class="dashboard-list">
        ${items.length ? items.map(getDashboardChatCard).join('') : `<div class="dashboard-empty">${iconSvg}<span>${emptyText}</span></div>`}
      </div>
    </section>
  `;
}

// Quando urgentes e pendentes estao zerados, os dois cards grandes de "nada
// por aqui" so ocupam espaco sem informar nada de novo. Substitui os dois por
// uma faixa unica e compacta, sobrando mais espaco pra lista de Recentes.
function getDashboardQuietBannerHtml() {
  return `
    <div class="dashboard-quiet-banner">
      ${DASHBOARD_EMPTY_ICONS.check}
      <span>Tudo em dia - sem urgentes ou pendentes.</span>
    </div>
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

function isBrazilCheerDay() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    return today === '2026-06-24';
  } catch (_err) {
    return new Date().toISOString().slice(0, 10) === '2026-06-24';
  }
}

function getBrazilCheerCardHtml() {
  if (!isBrazilCheerDay()) return '';
  return `
    <section class="brazil-cheer-card" aria-label="Torcida pela selecao brasileira">
      <div class="brazil-cheer-visual" aria-hidden="true">
        <div class="brazil-flag">
          <span class="flag-diamond"></span>
          <span class="flag-orb"></span>
          <span class="flag-stripe"></span>
        </div>
        <svg class="soccer-ball" viewBox="0 0 80 80" role="img" aria-hidden="true">
          <circle cx="40" cy="40" r="35" />
          <path d="M40 19l14 10-5 16H31l-5-16 14-10Z" />
          <path d="M26 29l-13 5M54 29l13 5M31 45l-9 13M49 45l9 13M40 19V8M22 58l-8 7M58 58l8 7" />
        </svg>
      </div>
      <div class="brazil-cheer-copy">
        <span class="brazil-cheer-kicker">Hoje &eacute; dia de torcida</span>
        <strong>Estamos na torcida pela Sele&ccedil;&atilde;o Brasileira hoje.</strong>
        <span>Que venha a classifica&ccedil;&atilde;o. Vai, Brasil!</span>
      </div>
    </section>
  `;
}

function getLegacyWelcomeStateHtml() {
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
          <div class="welcome-eyebrow">Painel inicial</div>
          <div class="welcome-title">${getGreeting()}, ${escapeHtml(firstName)}</div>
          <div class="welcome-copy">Um painel rápido para abrir prioridades, acompanhar não lidas e continuar conversas sem procurar demais.</div>
          <div class="dashboard-actions">
            <button class="dashboard-action-btn primary" type="button" onclick="aplicarFiltroDashboard('nao-lidas')">Ver não lidas</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('pendentes')">Pendentes</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('urgentes')">Urgentes</button>
            <button class="dashboard-action-btn" type="button" onclick="aplicarFiltroDashboard('online')">Equipe online</button>
            <button class="dashboard-action-btn" type="button" onclick="abrirBuscaGlobal()">Busca global</button>
          </div>
        </div>
      </div>
      ${getBrazilCheerCardHtml()}
      <section class="assistant-promo" aria-label="Assistente Jurídico em breve">
        <div class="assistant-promo-icon">✦</div>
        <div class="assistant-promo-copy">
          <div class="assistant-promo-title"><span class="assistant-promo-badge">EM BREVE</span> Assistente Jurídico</div>
          <div class="assistant-promo-text">A área está preparada e será liberada quando a IA for ativada pelo administrador.</div>
        </div>
        <button class="assistant-promo-btn" type="button" onclick="abrirAssistenteJuridico()">Em breve <span>◷</span></button>
      </section>
      <div class="welcome-stats dashboard-stats">
        <div class="welcome-stat-card ${totalOnline > 0 ? 'is-active' : 'is-zero'}">
          <strong>${totalOnline}</strong>
          <span>online agora</span>
        </div>
        <div class="welcome-stat-card ${totalNaoLidas > 0 ? 'is-active' : 'is-zero'}">
          <strong>${totalNaoLidas}</strong>
          <span>não lidas</span>
        </div>
        <div class="welcome-stat-card">
          <strong>${totalGrupos}</strong>
          <span>grupos</span>
        </div>
        <div class="welcome-stat-card priority ${totalPendentes > 0 ? 'is-active' : 'is-zero'}">
          <strong>${totalPendentes}</strong>
          <span>pendentes</span>
        </div>
        <div class="welcome-stat-card urgent ${totalUrgentes > 0 ? 'is-active' : 'is-zero'}">
          <strong>${totalUrgentes}</strong>
          <span>urgentes</span>
        </div>
      </div>
      <div class="dashboard-grid">
        ${getDashboardListHtml('Urgentes', 'atenção agora', urgentItems, 'Nenhuma conversa urgente.')}
        ${getDashboardListHtml('Não lidas', 'pendências', unreadItems, 'Tudo em dia por aqui.')}
      </div>
    </div>
  `;
}

function getWelcomeStateHtml() {
  const totalOnline = contatosCache.filter((usuario) => onlineState.has(Number(usuario.id))).length;
  const totalGrupos = gruposCache.length;
  const totalNaoLidas = Object.values(unreadState).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalPendentes = Object.values(attendanceStatusState).filter((status) => status === 'pendente').length;
  const totalUrgentes = Object.values(attendanceStatusState).filter((status) => status === 'urgente').length;
  const nomeUsuario = String(usuarioAtual?.nome || '').trim();
  const emailUsuario = String(usuarioAtual?.email || '').trim();
  const firstNameRaw = /^\(?usu[aÃ¡]rio/i.test(nomeUsuario)
    ? (emailUsuario.split('@')[0] || 'Admin')
    : (nomeUsuario.split(/\s+/)[0] || emailUsuario.split('@')[0] || 'equipe');
  const firstName = firstNameRaw.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '') || 'equipe';
  const urgentItems = getDashboardChatItems('urgent', 4);
  const unreadItems = getDashboardChatItems('unread', 4);
  const pendingItems = getDashboardChatItems('pending', 4);
  const recentItems = getDashboardChatItems('all', 4);

  return `
    <div class="empty-state welcome-state dashboard-home">
      <div class="dashboard-split">
        <section class="dashboard-conversations-card">
          <div class="dashboard-hero compact">
            <div class="dashboard-title-group">
              <div class="welcome-eyebrow">CENTRAL DE CONVERSAS</div>
              <div class="welcome-title">${getGreeting()}, ${escapeHtml(firstName)}</div>
              <div class="welcome-copy">Acompanhe as prioridades e continue as conversas recentes.</div>
              <div class="dashboard-actions"><button class="dashboard-action-btn primary" type="button" onclick="abrirBuscaGlobal()">Busca global</button></div>
            </div>
          </div>
          <div class="welcome-stats dashboard-stats">
            ${getDashboardStatCard('online agora', totalOnline, 'online', totalOnline > 0 ? 'is-active' : 'is-zero')}
            ${getDashboardStatCard('n&atilde;o lidas', totalNaoLidas, 'nao-lidas', totalNaoLidas > 0 ? 'is-active' : 'is-zero')}
            ${getDashboardStatCard('grupos', totalGrupos, 'grupos', '')}
            ${getDashboardStatCard('pendentes', totalPendentes, 'pendentes', `priority ${totalPendentes > 0 ? 'is-active' : 'is-zero'}`)}
            ${getDashboardStatCard('urgentes', totalUrgentes, 'urgentes', `urgent ${totalUrgentes > 0 ? 'is-active' : 'is-zero'}`)}
          </div>
          <div class="dashboard-grid">
            ${urgentItems.length === 0 && pendingItems.length === 0
              ? getDashboardQuietBannerHtml()
              : `${getDashboardListHtml('Urgentes', 'aten&ccedil;&atilde;o agora', urgentItems, 'Nenhuma conversa urgente.')}
                 ${getDashboardListHtml('Pendentes', 'acompanhar andamento', pendingItems, 'Nenhuma conversa pendente.')}`
            }
            ${getDashboardListHtml('N&atilde;o lidas', 'responder primeiro', unreadItems, 'Tudo em dia por aqui.')}
            ${getDashboardListHtml('Recentes', 'continuar atendimento', recentItems, 'As conversas recentes aparecer&atilde;o aqui.', 'chat')}
          </div>
        </section>
        <aside class="dashboard-assistant-card is-coming-soon" aria-label="Assistente Jurídico em breve">
          <div class="dashboard-assistant-head"><span class="dashboard-assistant-icon">✦</span><div><span class="dashboard-assistant-badge coming-soon">EM BREVE</span><h2>Assistente Jurídico</h2><p>Preparado para atender a rotina do cartório assim que for liberado.</p></div></div>
          <div class="dashboard-assistant-user"><span>✓</span> Você está identificado como <strong>${escapeHtml(nomeUsuario || emailUsuario || 'colaborador')}</strong>.</div>
          <div class="dashboard-assistant-coming-notice"><span>◷</span><div><strong>Em breve</strong><small>As consultas serão liberadas após a ativação da IA pelo administrador.</small></div></div>
          <label for="dashboardAssistantQuestion"><span data-assistant-mode-label>Orientação</span> do cartório</label>
          <div class="assistant-mode-switch dashboard-mode-switch" role="group" aria-label="Tipo de ajuda"><button class="${modoAssistente === 'orientacao' ? 'active' : ''}" type="button" disabled>Orientação</button><button class="${modoAssistente === 'email' ? 'active' : ''}" type="button" disabled>E-mail / WhatsApp</button><button class="${modoAssistente === 'nota' ? 'active' : ''}" type="button" disabled>Nota</button></div>
          <div class="dashboard-assistant-input"><input id="dashboardAssistantQuestion" type="text" placeholder="Consultas disponíveis em breve" disabled /><button type="button" disabled aria-label="Assistente indisponível">→</button></div>
          <div class="dashboard-assistant-shortcuts"><button type="button" disabled>Casamento</button><button type="button" disabled>Certidões</button><button type="button" disabled>Pessoas Jurídicas</button><button type="button" disabled>Responder e-mail</button></div>
          <div class="dashboard-assistant-answer hidden" id="dashboardAssistantAnswer"><div><span id="dashboardAssistantLevel" class="dashboard-assistant-level">ROTINA</span><strong id="dashboardAssistantTitle" class="dashboard-assistant-answer-title"></strong><p id="dashboardAssistantText"></p></div><div class="dashboard-assistant-basis"><strong>Base e segurança</strong><span id="dashboardAssistantBasis"></span></div><div class="dashboard-assistant-next"><strong>Próximo passo</strong><span id="dashboardAssistantNext"></span></div><a class="assistant-response-link hidden" id="dashboardAssistantLink" target="_blank" rel="noopener noreferrer"></a></div>
          <button class="dashboard-assistant-expand" type="button" onclick="abrirAssistenteJuridico()">Disponível em breve <span>◷</span></button>
        </aside>
      </div>
    </div>
  `;
}

function renderWelcomeState() {
  atualizarModoTelaInicial();
  document.getElementById('messagesContainer').innerHTML = getWelcomeStateHtml();
  atualizarBotaoTema();
}

function atualizarPainelInicialSeAberto() {
  if (!tipoChat && !chatIdAtual) renderWelcomeState();
}

function voltarTelaInicial() {
  fecharSugestoesMencao();
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
  document.getElementById('headerTitle').textContent = 'Central de conversas';
  document.getElementById('headerSubtitle').textContent = 'Selecione um grupo ou contato para iniciar';
  document.getElementById('typingIndicator').textContent = '';
  autoResizeComposer();
  atualizarBarraContexto();
  updateHeaderIcon(null);
  updateHeaderStatus();
  renderWorkflowPanel();
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
    const response = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    if (!response.ok) {
      limparSessao();
      return;
    }

    usuarioAtual = await response.json();
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
  adicionarFigurinhaSalva(message);
  const chatKey = getChatKey('grupo', data.grupoId);
  const isCurrent = tipoChat === 'grupo' && Number(chatIdAtual) === Number(data.grupoId);
  const preview = data.tipo === 'arquivo'
    ? `${data.usuarioNome}: ${getAttachmentKindLabel(data)}: ${data.arquivo_nome_original}`
    : `${data.usuarioNome}: ${data.conteudo}`;

  lastPreviewState[chatKey] = preview;
  lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
  lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());

  if (isCurrent) {
    upsertMessageInCache(message);
    if (Number(data.usuarioId) !== Number(usuarioAtual.id)) {
      if (isAppVisibleAndFocused()) {
        marcarConversaAtualComoLidaSeVisivel();
      } else {
        unreadState[chatKey] = (unreadState[chatKey] || 0) + 1;
      }
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
    if (!isAppVisibleAndFocused()) mostrarNotificacaoNavegador('Nova mensagem em grupo', {
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
  adicionarFigurinhaSalva(message);
  const chatKey = getChatKey('privado', data.remetente_id);
  const isCurrent = tipoChat === 'privado' && Number(chatIdAtual) === Number(data.remetente_id);
  const preview = data.tipo === 'arquivo'
    ? `${data.remetenteNome}: ${getAttachmentKindLabel(data)}: ${data.arquivo_nome_original}`
    : `${data.remetenteNome}: ${data.conteudo}`;

  lastPreviewState[chatKey] = preview;
  lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
  lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());

  if (isCurrent) {
    upsertMessageInCache(message);

    if (isAppVisibleAndFocused()) {
      marcarConversaAtualComoLidaSeVisivel();
    } else {
      unreadState[chatKey] = (unreadState[chatKey] || 0) + 1;
    }
  } else {
    unreadState[chatKey] = (unreadState[chatKey] || 0) + 1;
  }

  typingUsers.delete(`privado-${data.remetente_id}`);
  renderTypingSurfaces();
  updateBrowserTitle();
  atualizarPainelInicialSeAberto();

  mostrarNotificacao(`${data.remetenteNome} enviou ${data.tipo === 'arquivo' ? 'um arquivo' : 'uma mensagem privada'}`, 'success');

  if (!isAppVisibleAndFocused()) mostrarNotificacaoNavegador('Nova mensagem privada', {
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
  socket = io({ auth: { token } });

  socket.on('connect', () => {
    mostrarStatusConexao(false);
    socket.emit('conectar-usuario', usuarioAtual.id);
    signalUserActivity(true);

    // Em reconexoes (queda de rede, proxy do Railway derrubando conexao ociosa),
    // recarrega contatos/grupos/presenca e a conversa aberta para trazer o que
    // chegou durante a queda. So recarregar a conversa aberta nao bastava: a
    // lista lateral (quem esta online, quem da pra chamar) ficava presa no
    // estado de antes da queda e so se atualizava com F5 na pagina.
    if (jaConectouSocket) {
      carregarDadosIniciais();
      if (chatIdAtual != null && tipoChat) {
        carregarChat(tipoChat, chatIdAtual, nomeChatAtual);
      }
    }
    jaConectouSocket = true;
  });

  socket.on('disconnect', () => {
    mostrarStatusConexao(true);
  });

  socket.on('presenca-atualizada', (data) => {
    onlineState = new Set((data.online || []).map(Number));
    userStatusState = data.status || userStatusState || {};
    lastSeenState = data.ultimoVisto || lastSeenState || {};
    contatosCache = contatosCache.map((contato) => ({
      ...contato,
      ultimo_visto_em: lastSeenState[Number(contato.id)] || contato.ultimo_visto_em || null
    }));
    scheduleSidebarRender({ contacts: true });
    updateHeaderIcon(tipoChat, nomeChatAtual);
    updateHeaderStatus();
    atualizarPainelInicialSeAberto();
  });

  socket.on('atividade-usuario-atualizada', (data) => {
    const usuarioId = Number(data?.usuarioId);
    if (!usuarioId || !data?.ultimoVistoEm) return;
    lastSeenState[usuarioId] = data.ultimoVistoEm;
    contatosCache = contatosCache.map((contato) => (
      Number(contato.id) === usuarioId
        ? { ...contato, ultimo_visto_em: data.ultimoVistoEm }
        : contato
    ));
    if (tipoChat === 'privado' && Number(chatIdAtual) === usuarioId) updateHeaderStatus();
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

  socket.on('mencao-recebida', (data) => {
    registrarMencaoInbox(data);
    mostrarNotificacao(data?.title || 'Você foi mencionado', 'info');
    mostrarNotificacaoNavegador(data?.title || 'Você foi mencionado', {
      body: data?.body || 'Abra o chat para ver a mensagem.',
      tag: `mencao-${data?.tipoChat || 'chat'}-${data?.chatId || 'atual'}`
    });
    if (data?.tipoChat === 'grupo') {
      unreadState[getChatKey('grupo', data.chatId)] = Math.max(Number(unreadState[getChatKey('grupo', data.chatId)] || 0), 1);
      scheduleSidebarRender({ groups: true });
      updateBrowserTitle();
    }
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
    scheduleSidebarRender({ contacts: true });
  });

  socket.on('arquivo-enviado-confirmacao', (data) => {
    const chatKey = getChatKey('privado', data.destinatario_id);
    lastPreviewState[chatKey] = `Voce: ${getAttachmentKindLabel(data)}: ${data.arquivo_nome_original}`;
    lastTimeState[chatKey] = formatTime(data.criado_em || new Date());
    lastTimestampState[chatKey] = toTimestamp(data.criado_em || new Date());
    scheduleSidebarRender({ contacts: true });
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

  socket.on('mensagens-entregues', (data) => {
    if (tipoChat === 'privado' && Number(chatIdAtual) === Number(data.destinatarioId)) {
      marcarMensagensComoEntreguesNaTela();
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
    if (data.tipoEvento === 'etiquetas') {
      conversationTagsState[data.key] = Array.isArray(data.etiquetas) ? data.etiquetas : [];
    } else if (data.tipoEvento === 'notas') {
      conversationNotesCountState[data.key] = Number(data.notasCount || 0);
      delete conversationNotesCache[data.key];
      if (data.key === getCurrentChatKey() && !document.getElementById('conversationNotesPanel')?.classList.contains('hidden')) {
        carregarNotasAtual();
      }
    } else if (data.tipoEvento === 'responsavel') {
      if (data.responsavel) conversationAssigneeState[data.key] = data.responsavel;
      else delete conversationAssigneeState[data.key];
    } else {
      if (data.status) attendanceStatusState[data.key] = data.status;
      else delete attendanceStatusState[data.key];
      salvarStatusAtendimento();
    }
    atualizarBotaoFavorito();
    updateHeaderStatus();
    renderWorkflowPanel();
    scheduleSidebarRender({ groups: true, contacts: true });
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

function getPlantaoPeriodoKey(inicio, fim) {
  return `${String(inicio || '')}|${String(fim || '')}`;
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
      ? periodos.map((item) => {
        const periodoKey = getPlantaoPeriodoKey(item.inicio, item.fim);
        const isEditing = plantaoEditingPeriodoKey === periodoKey;
        const editOptions = plantaoState.escreventes.length
          ? plantaoState.escreventes.map((escrevente) => `
            <option value="${Number(escrevente.id)}" ${Number(escrevente.id) === Number(item.escreventeId) ? 'selected' : ''}>${escapeHtml(escrevente.nome)}</option>
          `).join('')
          : '<option value="">Cadastre um escrevente</option>';
        return `
        <div class="plantao-scale-row ${item.conflito ? 'conflict' : ''}" ${getPlantaoColorStyle(item.escreventeId, item.conflito)}>
          <div class="plantao-scale-main">
            <strong>${formatDateOnlyBr(item.inicio)} a ${formatDateOnlyBr(item.fim)}</strong>
            <span>${item.conflito ? 'Conflito de ferias' : escapeHtml(getPlantaoEscreventeNome(item.escreventeId))}</span>
          </div>
          <div class="plantao-scale-actions">
            <button class="plantao-scale-edit" type="button" onclick="editarPeriodoEscalaPlantao('${escapeHtml(item.inicio)}','${escapeHtml(item.fim)}')" title="Editar periodo e escrevente" aria-label="Editar periodo e escrevente">Editar</button>
            <button class="plantao-scale-delete" type="button" onclick="excluirPeriodoEscalaPlantao('${escapeHtml(item.inicio)}','${escapeHtml(item.fim)}')" title="Excluir este periodo" aria-label="Excluir este periodo">x</button>
          </div>
          ${isEditing ? `
            <div class="plantao-period-edit">
              <select class="field" id="plantaoEditPeriodoSelect">
                ${editOptions}
              </select>
              <label class="plantao-date-edit">
                <span>Inicio</span>
                <input class="field" id="plantaoEditPeriodoInicio" type="date" value="${escapeHtml(item.inicio)}" />
              </label>
              <label class="plantao-date-edit">
                <span>Fim</span>
                <input class="field" id="plantaoEditPeriodoFim" type="date" value="${escapeHtml(item.fim)}" />
              </label>
              <button class="btn btn-primary plantao-edit-save" type="button" onclick="salvarEdicaoPeriodoEscalaPlantao('${escapeHtml(item.inicio)}','${escapeHtml(item.fim)}')">Salvar</button>
              <button class="btn btn-secondary plantao-edit-cancel" type="button" onclick="cancelarEdicaoPeriodoEscalaPlantao()">Cancelar</button>
            </div>
          ` : ''}
          ${item.observacao ? `<small>${escapeHtml(item.observacao)}</small>` : ''}
        </div>
      `;
      }).join('')
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

function editarPeriodoEscalaPlantao(inicio, fim) {
  plantaoEditingPeriodoKey = getPlantaoPeriodoKey(inicio, fim);
  renderPlantaoPanel();
}

function cancelarEdicaoPeriodoEscalaPlantao() {
  plantaoEditingPeriodoKey = '';
  renderPlantaoPanel();
}

async function salvarEdicaoPeriodoEscalaPlantao(inicio, fim) {
  const select = document.getElementById('plantaoEditPeriodoSelect');
  const escreventeId = Number(select?.value);
  const novoInicio = document.getElementById('plantaoEditPeriodoInicio')?.value;
  const novoFim = document.getElementById('plantaoEditPeriodoFim')?.value;
  if (!escreventeId) {
    mostrarNotificacao('Selecione um escrevente para este periodo', 'warning');
    return;
  }
  if (!novoInicio || !novoFim || novoInicio > novoFim) {
    mostrarNotificacao('Informe um periodo valido', 'warning');
    return;
  }
  plantaoEditingPeriodoKey = '';
  await salvarPlantaoViaApi('/api/plantao/escala-periodo', {
    method: 'POST',
    body: JSON.stringify({ escreventeId, originalInicio: inicio, originalFim: fim, inicio: novoInicio, fim: novoFim })
  }, 'Periodo atualizado');
}

async function excluirEscalaPlantao() {
  if (!plantaoState.escalas.length) {
    mostrarNotificacao('Nao ha escala para excluir', 'info');
    return;
  }
  if (!confirm('Excluir toda a escala atual? Os escreventes e ferias cadastrados serao mantidos.')) return;
  await salvarPlantaoViaApi('/api/plantao/escala', { method: 'DELETE' }, 'Escala excluida');
}

async function excluirPeriodoEscalaPlantao(inicio, fim) {
  if (!confirm(`Excluir a escala de ${formatDateOnlyBr(inicio)} a ${formatDateOnlyBr(fim)}?`)) return;
  await salvarPlantaoViaApi('/api/plantao/escala-periodo', {
    method: 'DELETE',
    body: JSON.stringify({ inicio, fim })
  }, 'Periodo excluido');
}

async function carregarGrupos() {
  try {
    const response = await fetch('/api/grupos', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar grupos');
    gruposCache = await response.json();
    if (!Array.isArray(gruposCache)) gruposCache = [];
    gruposCache.forEach((grupo) => {
      const key = getChatKey('grupo', grupo.id);
      unreadState[key] = Number(grupo.naoLidas || 0);
      lastPreviewState[key] = grupo.ultimaMensagem || '';
      lastTimeState[key] = grupo.criado_em ? formatTime(grupo.criado_em) : '';
      lastTimestampState[key] = grupo.criado_em ? toTimestamp(grupo.criado_em) : 0;
    });
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
  atualizarBadgeOperacional();
}
}

async function carregarContatos() {
  try {
    const response = await fetch('/api/usuarios', { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar contatos');
    contatosCache = await response.json();
    if (!Array.isArray(contatosCache)) contatosCache = [];
    contatosCache = contatosCache.filter(u => Number(u.id) !== Number(usuarioAtual.id));
    contatosCache.forEach((contato) => {
      lastSeenState[Number(contato.id)] = contato.ultimo_visto_em || null;
    });
    renderContatos();
    atualizarPainelInicialSeAberto();
  } catch (err) {
    console.error(err);
    contatosCache = [];
    renderContatos();
  atualizarPainelInicialSeAberto();
  atualizarBadgeOperacional();
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
    gruposList.innerHTML = conversationSearchTerm
      ? `<div class="empty-list"><strong>Nenhum grupo encontrado</strong><span>Tente outro nome ou limpe a busca.</span></div>`
      : `<div class="empty-list"><strong>Sem grupos para mostrar</strong><span>Quando houver grupos ativos, eles aparecem aqui.</span></div>`;
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
          ${unread > 0 ? `<span class="notification-badge" title="${escapeHtml(getUnreadBadgeTitle(unread))}">${unread > 99 ? '99+' : unread}</span>` : ''}
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
        <span class="presence-dot ${online ? 'online' : ''} status-${escapeHtml(status)}" title="${escapeHtml(online ? getStatusLabel(status) : 'Offline')}"></span>
      </div>
      <div class="chat-details">
        <div class="chat-top">
          <div class="chat-name">${isFavorite ? '★ ' : ''}${escapeHtml(usuario.nome)}</div>
          <div class="chat-time">${lastTimeState[key] || ''}</div>
        </div>
        <div class="chat-preview-row">
          <div class="chat-preview">${typingPreviewHtml || escapeHtml(preview)}</div>
          ${unread > 0 ? `<span class="notification-badge" title="${escapeHtml(getUnreadBadgeTitle(unread))}">${unread > 99 ? '99+' : unread}</span>` : ''}
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
    contatosList.innerHTML = conversationSearchTerm
      ? `<div class="empty-list"><strong>Nenhum contato encontrado</strong><span>Confira o nome digitado ou veja todos os contatos.</span></div>`
      : `<div class="empty-list"><strong>Sem contatos neste filtro</strong><span>Altere o filtro para ver mais pessoas da equipe.</span></div>`;
  }
}

async function carregarChat(tipo, id, nome) {
  const loadSeq = ++currentChatLoadSeq;
  fecharSugestoesMencao();
  tipoChat = tipo;
  chatIdAtual = id;
  nomeChatAtual = nome;
  atualizarModoTelaInicial();
  currentMessageSearch = '';
  currentMessagesCache = [];
  currentMessagesHasMore = false;
  currentMessagesNextBefore = null;
  currentMessagesLoadingOlder = false;
  activeReplyMessageId = null;
  editingMessageId = null;
  document.getElementById('messageSearchInput').value = '';
  document.getElementById('messageInput').value = '';
  document.getElementById('schedulePanel')?.classList.add('hidden');
  restaurarRascunhoAtual();
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
  renderWorkflowPanel();
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
    if (loadSeq !== currentChatLoadSeq || tipoChat !== tipo || Number(chatIdAtual) !== Number(id)) return;

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
    adicionarFigurinhasSalvasEmLote(currentMessagesCache);
    renderMessages({ stabilizeBottom: true });

    if (tipo === 'grupo') {
      socket.emit('entrar-grupo', { grupoId: id, usuarioId: usuarioAtual.id });
    }
    marcarConversaAtualComoLidaSeVisivel();
  } catch (err) {
    if (loadSeq !== currentChatLoadSeq || tipoChat !== tipo || Number(chatIdAtual) !== Number(id)) return;
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
  const stickerAttachment = isStickerAttachment(message);
  const attachmentLabel = getAttachmentKindLabel(message);
  const attachmentTagsHtml = getAttachmentTagsHtml(message);
  const attachmentExpired = message.tipo === 'arquivo' && Boolean(message.arquivo_expirado_em || !message.arquivo_url);
  const secureAttachmentSrc = getCachedAttachmentObjectUrl(message.arquivo_url);
  const filePreviewHtml = attachmentExpired
    ? `<div class="file-preview pdf expired"><span>&#128196;</span><span>Anexo removido automaticamente apos 30 dias</span></div>`
    : message.tipo === 'arquivo' && isImageAttachment(message)
    ? `<div class="file-preview image ${stickerAttachment ? 'sticker' : ''}"><img src="${escapeHtml(secureAttachmentSrc || ATTACHMENT_PLACEHOLDER_SRC)}" data-secure-attachment="${escapeHtml(message.arquivo_url)}" alt="${escapeHtml(message.arquivo_nome_original || 'Imagem anexada')}" loading="lazy" /></div>`
    : message.tipo === 'arquivo' && isPdfAttachment(message)
      ? `<div class="file-preview pdf inline-pdf">
          ${secureAttachmentSrc
            ? `<iframe src="${escapeHtml(secureAttachmentSrc)}#toolbar=0&navpanes=0" title="${escapeHtml(message.arquivo_nome_original || 'PDF anexado')}" loading="lazy"></iframe>`
            : `<div class="pdf-loading-preview" data-secure-pdf-placeholder="${escapeHtml(message.arquivo_url)}"><span>PDF</span><small>Preparando previa...</small></div>`}
        </div>`
      : message.tipo === 'arquivo' && isVideoAttachment(message)
        ? `<div class="file-preview video"><video src="${escapeHtml(secureAttachmentSrc)}" data-secure-attachment="${escapeHtml(message.arquivo_url)}" controls preload="metadata"></video></div>`
      : '';
  const innerContent = message.tipo === 'arquivo'
    ? attachmentExpired
      ? `<div class="file-card expired-file ${stickerAttachment ? 'sticker-card' : ''}">
         <strong>&#128196; ${escapeHtml(attachmentLabel)}: ${highlightText(message.arquivo_nome_original || 'arquivo', query)}</strong>
         ${attachmentTagsHtml}
         <small>Removido automaticamente apos 30 dias</small>
       </div>${filePreviewHtml}`
      : `<a class="file-card ${stickerAttachment ? 'sticker-card' : ''}" href="#" onclick="abrirVisualizadorArquivo(${Number(message.id)}); return false;">
         <strong>${stickerAttachment ? '&#128444;' : '&#128206;'} ${escapeHtml(attachmentLabel)}: ${highlightText(message.arquivo_nome_original, query)}</strong>
         ${attachmentTagsHtml}
         <small>${escapeHtml(formatFileSize(message.arquivo_tamanho))}</small>
         <div class="file-card-actions">
           <span class="file-inline-action">Visualizar</span>
           <span class="file-inline-action" role="button" tabindex="0" onclick="event.preventDefault(); event.stopPropagation(); baixarArquivoMensagem(${Number(message.id)});">Baixar</span>
         </div>
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
      ${stickerAttachment ? `<button class="message-action-btn" onclick="salvarFigurinhaMensagem(${Number(message.id)})" title="Salvar figurinha">Salvar</button>` : ''}
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
  const mentionBadgeHtml = isMessageMentioningMe(message)
    ? '<div class="message-mention-badge">Voce foi mencionado</div>'
    : '';

  if (ehOutro) {
    const nomeMensagem = message.usuarioNome || message.usuario_nome || 'Usuario';
    return `
      <div class="message-avatar" ${avatarStyle(nomeMensagem)}>${escapeHtml(initials(nomeMensagem))}</div>
      <div class="message other ${stickerAttachment ? 'sticker-message' : ''}">
        ${priorityBadgeHtml}
        ${mentionBadgeHtml}
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
    : (message.lido ? 'Mensagem lida' : (message.entregue ? 'Mensagem entregue' : 'Mensagem enviada'));
  // Checkmarks visuais: ✓ enviada (cinza), ✓✓ entregue (cinza), ✓✓ lida (azul)
  const SVG_CHECK_SINGLE = `<svg class="check-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="3,9 7,13 13,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const SVG_CHECK_DOUBLE = `<svg class="check-icon check-double" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="1,9 5,13 11,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6,9 10,13 16,5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const statusText = tipoChat === 'grupo'
    ? (getLeiturasGrupo(message).length ? SVG_CHECK_DOUBLE : SVG_CHECK_SINGLE)
    : ((message.lido || message.entregue) ? SVG_CHECK_DOUBLE : SVG_CHECK_SINGLE);
  const resumoHtml = tipoChat === 'grupo'
    ? `<div class="message-read-summary ${resumoLeituraGrupo?.total ? 'has-readers' : ''}" title="${escapeHtml(resumoLeituraGrupo?.tooltip || '')}"><strong>Visto por:</strong> ${escapeHtml(resumoLeituraGrupo?.detalhe || 'Ninguém do grupo viu ainda')}</div>`
    : '';

  return `
    <div class="message-avatar" ${avatarStyle(usuarioAtual.nome || usuarioAtual.email)}>${escapeHtml(initials(usuarioAtual.nome))}</div>
    <div class="message own ${stickerAttachment ? 'sticker-message' : ''}">
      ${priorityBadgeHtml}
      ${mentionBadgeHtml}
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
    const previousScrollBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = 'auto';
    container.scrollTop = container.scrollHeight;
    container.style.scrollBehavior = previousScrollBehavior;
    container.classList.remove('preparing-scroll');
  };

  applyScroll();
  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });

  if (!stabilize) return;

  initialScrollLockTimers.forEach(clearTimeout);
  initialScrollLockTimers = [80, 180, 420, 900, 1400].map((delay) => setTimeout(applyScroll, delay));

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
          <div style="font-weight:800; margin-bottom:8px; color:#e5e7eb;">Nada encontrado nesta conversa</div>
          <div>Revise o termo ou busque por nome de arquivo, pessoa ou trecho da mensagem.</div>
        </div>
      `
      : `
        <div class="empty-state">
          <span class="emoji">&#128172;</span>
          <div style="font-weight:800; margin-bottom:8px; color:#e5e7eb;">Conversa pronta para comecar</div>
          <div>Envie uma mensagem, cole uma imagem ou arraste um arquivo para registrar o atendimento.</div>
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
    const mentionClass = isMessageMentioningMe(message) ? 'message-mention-row' : '';
    return `${dividerHtml}<div class="message-row ${ehOutro ? '' : 'own'} ${compact ? 'compact' : ''} ${priorityClass} ${mentionClass}" data-message-id="${Number(message.id)}" data-usuario-id="${Number(message.usuarioId || 0)}">${renderMessageRow(message)}</div>`;
  }).join('');
  hydrateSecureAttachments(container);
  aplicarTwemoji(container);
  if (scrollToBottom) scrollMessagesToBottom({ stabilize: stabilizeBottom });
  else container.classList.remove('preparing-scroll');
}

async function carregarMensagensAnteriores() {
  if (!tipoChat || !chatIdAtual || !currentMessagesHasMore || currentMessagesLoadingOlder || !currentMessagesNextBefore) return;
  const loadSeq = currentChatLoadSeq;
  const requestTipo = tipoChat;
  const requestChatId = chatIdAtual;
  const container = document.getElementById('messagesContainer');
  const previousHeight = container.scrollHeight;
  currentMessagesLoadingOlder = true;
  renderMessages({ scrollToBottom: false });

  try {
    const endpoint = requestTipo === 'grupo'
      ? `/api/mensagens/grupo/${requestChatId}?limit=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(currentMessagesNextBefore)}`
      : `/api/mensagens/privadas/${requestChatId}?limit=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(currentMessagesNextBefore)}`;
    const response = await fetch(endpoint, { headers: authHeaders() });
    if (!response.ok) throw new Error('Falha ao carregar historico');
    const payload = await response.json();
    if (loadSeq !== currentChatLoadSeq || tipoChat !== requestTipo || Number(chatIdAtual) !== Number(requestChatId)) return;

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
    if (loadSeq !== currentChatLoadSeq || tipoChat !== requestTipo || Number(chatIdAtual) !== Number(requestChatId)) return;
    mostrarNotificacao('Erro ao carregar historico: ' + err.message, 'error');
  } finally {
    if (loadSeq !== currentChatLoadSeq || tipoChat !== requestTipo || Number(chatIdAtual) !== Number(requestChatId)) return;
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

// Busca TODAS as mensagens da conversa aberta (sem paginacao). Usado pela
// galeria de midia e pela exportacao em PDF, que precisam do historico completo.
async function fetchTodasMensagensConversa() {
  const endpoint = tipoChat === 'grupo'
    ? `/api/mensagens/grupo/${chatIdAtual}`
    : `/api/mensagens/privadas/${chatIdAtual}`;
  const resp = await fetch(endpoint, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Falha ao carregar mensagens');
  const payload = await resp.json();
  const arr = Array.isArray(payload) ? payload : (payload.mensagens || []);
  return arr.map((m) => normalizeMessage({ ...m, usuarioNome: m.usuario_nome, usuarioId: m.usuario_id }));
}

// Exporta a conversa aberta em PDF usando a impressao do navegador (sem
// dependencias): abre uma janela com o conteudo formatado e dispara o print,
// onde o usuario escolhe "Salvar como PDF".
async function exportarConversaPdf() {
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Abra uma conversa para exportar', 'error');
    return;
  }
  const title = document.getElementById('headerTitle').textContent || 'Conversa';
  let mensagens;
  try {
    mensagens = await fetchTodasMensagensConversa();
  } catch (_e) {
    mostrarNotificacao('Não foi possível carregar a conversa', 'error');
    return;
  }
  if (!mensagens.length) {
    mostrarNotificacao('Conversa sem mensagens para exportar', 'error');
    return;
  }
  const linhas = mensagens.map((m) => {
    const autor = escapeHtml(m.usuarioNome || m.usuario_nome || 'Usuário');
    const hora = escapeHtml(formatMessageTimestamp(m.criado_em));
    const texto = escapeHtml(getMessageCopyText(m) || '').replace(/\n/g, '<br>');
    return `<div class="msg"><div class="meta"><span class="autor">${autor}</span><span class="hora">${hora}</span></div><div class="texto">${texto}</div></div>`;
  }).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#142033;margin:32px;}
      h1{font-size:18px;margin:0 0 4px;}
      .sub{color:#64748b;font-size:12px;margin-bottom:20px;}
      .msg{padding:8px 0;border-bottom:1px solid #eef1f4;}
      .meta{font-size:11px;margin-bottom:2px;}
      .autor{font-weight:700;color:#1668ff;}
      .hora{color:#94a3b8;margin-left:8px;}
      .texto{font-size:13px;white-space:pre-wrap;}
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="sub">Cartório Dias de Castro — exportado em ${escapeHtml(formatMessageTimestamp(new Date()))} · ${mensagens.length} mensagens</div>
    ${linhas}
    <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (!win) {
    mostrarNotificacao('Permita pop-ups para exportar em PDF', 'error');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function fecharGaleriaConversa() {
  const overlay = document.getElementById('mediaGalleryOverlay');
  if (overlay) overlay.remove();
}

// Galeria de midia: reune imagens, videos e PDFs da conversa aberta num grid.
async function abrirGaleriaConversa() {
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Abra uma conversa para ver a galeria', 'error');
    return;
  }
  fecharGaleriaConversa();
  const title = document.getElementById('headerTitle').textContent || 'Conversa';
  let mensagens;
  try {
    mensagens = await fetchTodasMensagensConversa();
  } catch (_e) {
    mostrarNotificacao('Não foi possível carregar a galeria', 'error');
    return;
  }
  const midias = mensagens.filter((m) => m.tipo === 'arquivo' && !m.arquivo_expirado_em
    && (isImageAttachment(m) || isVideoAttachment(m) || isPdfAttachment(m)));
  const itensHtml = midias.length
    ? midias.map((m) => {
        const url = escapeHtml(m.arquivo_url || '');
        const nome = escapeHtml(m.arquivo_nome_original || 'arquivo');
        let thumb;
        // Imagens usam a miniatura protegida (menor e mais rapida); video/PDF usam
        // o arquivo original protegido. Ambos exigem o token de autenticacao, por
        // isso passam por data-secure-* + hydrateSecureAttachments em vez de um
        // src direto (que resultaria em 404, pois /uploads nao e publico).
        if (isImageAttachment(m)) thumb = `<img src="${ATTACHMENT_PLACEHOLDER_SRC}" data-secure-thumb="${url}" alt="${nome}" loading="lazy">`;
        else if (isVideoAttachment(m)) thumb = `<video data-secure-attachment="${url}" muted preload="metadata"></video><span class="media-badge">Vídeo</span>`;
        else thumb = `<span class="media-pdf">PDF</span>`;
        return `<button type="button" class="media-item" onclick="abrirVisualizadorArquivo(${Number(m.id)})" title="${nome}">${thumb}<span class="media-name">${nome}</span></button>`;
      }).join('')
    : '<div class="media-empty">Nenhuma mídia nesta conversa.</div>';
  const overlay = document.createElement('div');
  overlay.id = 'mediaGalleryOverlay';
  overlay.className = 'media-gallery-overlay';
  overlay.innerHTML = `
    <div class="media-gallery">
      <div class="media-gallery-head">
        <strong>Galeria — ${escapeHtml(title)}</strong>
        <button type="button" class="media-close" aria-label="Fechar galeria">&times;</button>
      </div>
      <div class="media-grid">${itensHtml}</div>
    </div>`;
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) fecharGaleriaConversa(); });
  overlay.querySelector('.media-close').addEventListener('click', fecharGaleriaConversa);
  document.body.appendChild(overlay);
  hydrateSecureAttachments(overlay);
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

function marcarMensagensComoEntreguesNaTela() {
  currentMessagesCache = currentMessagesCache.map((message) => (
    Number(message.usuarioId) === Number(usuarioAtual.id) && !message.entregue
      ? { ...message, entregue: 1 }
      : message
  ));
  renderMessages();
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

function getDraftsStore() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {};
  } catch (_err) {
    return {};
  }
}

function setDraftForKey(key, value) {
  if (!key) return;
  const drafts = getDraftsStore();
  const text = String(value || '');
  if (text.trim()) drafts[key] = text;
  else delete drafts[key];
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function salvarRascunhoAtual() {
  const key = getCurrentChatKey();
  if (!key || editingMessageId) return;
  setDraftForKey(key, document.getElementById('messageInput')?.value || '');
}

function restaurarRascunhoAtual() {
  const key = getCurrentChatKey();
  const input = document.getElementById('messageInput');
  if (!key || !input) return;
  input.value = getDraftsStore()[key] || '';
  autoResizeComposer();
}

function limparRascunhoAtual() {
  setDraftForKey(getCurrentChatKey(), '');
}

function getMentionableUsersForCurrentChat() {
  if (tipoChat !== 'grupo' || !chatIdAtual) return [];
  const grupo = gruposCache.find((item) => Number(item.id) === Number(chatIdAtual));
  const membros = new Set(Array.isArray(grupo?.membros) ? grupo.membros.map(Number) : []);
  return contatosCache
    .filter((user) => !membros.size || membros.has(Number(user.id)))
    .filter((user) => Number(user.id) !== Number(usuarioAtual?.id))
    .map((user) => ({
      id: Number(user.id),
      nome: user.nome || user.email || `#${user.id}`,
      email: user.email || ''
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
}

function getMentionTrigger(input) {
  if (!input || tipoChat !== 'grupo') return null;
  const cursor = Number(input.selectionStart || 0);
  const before = input.value.slice(0, cursor);
  const match = /(^|\s)@([^\s@]{0,32})$/.exec(before);
  if (!match) return null;
  const query = match[2] || '';
  return {
    query,
    start: cursor - query.length - 1,
    end: cursor
  };
}

function fecharSugestoesMencao() {
  mentionSuggestionsState = { active: false, query: '', start: -1, end: -1, selected: 0, items: [] };
  const box = document.getElementById('mentionSuggestions');
  if (box) box.classList.add('hidden');
}

function renderSugestoesMencao() {
  const box = document.getElementById('mentionSuggestions');
  if (!box) return;
  const { items, selected } = mentionSuggestionsState;
  if (!items.length) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.innerHTML = items.map((user, index) => `
    <button class="mention-suggestion ${index === selected ? 'active' : ''}" type="button" role="option" aria-selected="${index === selected ? 'true' : 'false'}" onclick="selecionarSugestaoMencao(${index})">
      <span class="mention-avatar">${escapeHtml(initials(user.nome))}</span>
      <span class="mention-text">
        <strong>${escapeHtml(user.nome)}</strong>
        <small>${escapeHtml(user.email)}</small>
      </span>
    </button>
  `).join('');
  box.classList.remove('hidden');
}

function atualizarSugestoesMencao() {
  const input = document.getElementById('messageInput');
  const trigger = getMentionTrigger(input);
  if (!trigger) {
    fecharSugestoesMencao();
    return;
  }
  const query = normalizeSearchText(trigger.query);
  const items = getMentionableUsersForCurrentChat()
    .filter((user) => {
      const nome = normalizeSearchText(user.nome);
      const email = normalizeSearchText(user.email);
      return !query || nome.includes(query) || email.includes(query);
    })
    .slice(0, 8);
  mentionSuggestionsState = {
    active: items.length > 0,
    query,
    start: trigger.start,
    end: trigger.end,
    selected: 0,
    items
  };
  renderSugestoesMencao();
}

function selecionarSugestaoMencao(index = mentionSuggestionsState.selected) {
  const input = document.getElementById('messageInput');
  const user = mentionSuggestionsState.items[index];
  if (!input || !user) return false;
  const before = input.value.slice(0, mentionSuggestionsState.start);
  const after = input.value.slice(mentionSuggestionsState.end);
  const mentionText = `@${user.nome} `;
  input.value = `${before}${mentionText}${after}`;
  const cursor = before.length + mentionText.length;
  input.selectionStart = cursor;
  input.selectionEnd = cursor;
  fecharSugestoesMencao();
  autoResizeComposer();
  salvarRascunhoAtual();
  input.focus();
  return true;
}

function navegarSugestoesMencao(delta) {
  if (!mentionSuggestionsState.items.length) return false;
  const total = mentionSuggestionsState.items.length;
  mentionSuggestionsState.selected = (mentionSuggestionsState.selected + delta + total) % total;
  renderSugestoesMencao();
  return true;
}

function alternarAgendamentoMensagem(event) {
  event?.stopPropagation?.();
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Abra uma conversa para agendar mensagem', 'error');
    return;
  }
  const panel = document.getElementById('schedulePanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  const input = document.getElementById('scheduleDateTimeInput');
  if (input && !input.value) {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    input.value = date.toISOString().slice(0, 16);
  }
}

async function agendarMensagemAtual() {
  if (!tipoChat || !chatIdAtual) return;
  const messageInput = document.getElementById('messageInput');
  const dateInput = document.getElementById('scheduleDateTimeInput');
  const conteudo = String(messageInput?.value || '').trim();
  const enviarEm = dateInput?.value ? new Date(dateInput.value).toISOString() : '';
  if (!conteudo) {
    mostrarNotificacao('Escreva a mensagem antes de agendar', 'error');
    return;
  }
  if (!enviarEm || Number.isNaN(new Date(enviarEm).getTime()) || new Date(enviarEm).getTime() <= Date.now() + 30000) {
    mostrarNotificacao('Escolha uma data e hora futura', 'error');
    return;
  }
  try {
    const response = await fetch(`/api/conversas/${tipoChat}/${chatIdAtual}/agendar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ conteudo, enviarEm })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || 'Erro ao agendar mensagem');
    if (messageInput) messageInput.value = '';
    limparRascunhoAtual();
    autoResizeComposer();
    document.getElementById('schedulePanel')?.classList.add('hidden');
    mostrarNotificacao('Mensagem agendada', 'success');
  } catch (err) {
    mostrarNotificacao(err.message, 'error');
  }
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
  limparRascunhoAtual();
  autoResizeComposer();
  input.focus();
  fecharEmojiPicker();
  fecharStickerPicker();
  activeReplyMessageId = null;
  atualizarBarraContexto();
}

async function enviarArquivoSelecionado(arquivo, options = {}) {
  const input = document.getElementById('fileInput');
  const clearInput = options.clearInput !== false;
  if (!arquivo) return;
  const uploadFile = await normalizeUploadFile(arquivo);
  if (!tipoChat || !chatIdAtual) {
    mostrarNotificacao('Selecione um grupo ou contato antes de enviar arquivo', 'error');
    if (clearInput) input.value = '';
    return;
  }

  try {
    setUploadStatus(`Enviando ${uploadFile.name}...`);
    const formData = new FormData();
    formData.append('arquivo', uploadFile);
    formData.append('tipoChat', tipoChat);
    formData.append('chatId', chatIdAtual);
    if (activeReplyMessageId) formData.append('replyToId', activeReplyMessageId);

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
    lastPreviewState[key] = `Voce: ${getAttachmentKindLabel(data)}: ${data.arquivo_nome_original}`;
    lastTimeState[key] = formatTime(data.criado_em || new Date());
    lastTimestampState[key] = toTimestamp(data.criado_em || new Date());

    upsertMessageInCache({
      ...data,
      usuarioNome: usuarioAtual.nome,
      usuarioId: usuarioAtual.id,
      tipo: 'arquivo',
      showReactionPicker: false
    });
    adicionarFigurinhaSalva(normalizeMessage({
      ...data,
      usuarioNome: usuarioAtual.nome,
      usuarioId: usuarioAtual.id,
      tipo: 'arquivo'
    }));

    if (tipoChat === 'grupo') renderGrupos();
    else renderContatos();

    setUploadStatus(`Arquivo enviado: ${uploadFile.name}`);
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
  if (mentionSuggestionsState.active) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      navegarSugestoesMencao(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navegarSugestoesMencao(-1);
      return;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      selecionarSugestaoMencao();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      fecharSugestoesMencao();
      return;
    }
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    fecharSugestoesMencao();
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
  document.getElementById('galleryChatBtn')?.classList.add('hidden');
  document.getElementById('exportPdfBtn')?.classList.add('hidden');
  fecharGaleriaConversa();
  document.getElementById('messagesContainer').innerHTML = '';
  document.getElementById('headerTitle').textContent = 'Central de conversas';
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
  if (modalId === 'attachmentViewerModal') {
    fecharVisualizadorArquivo();
    return;
  }
  document.getElementById(modalId).classList.remove('active');
}

window.onclick = function(event) {
  if (!event.target.closest('.composer')) {
    fecharEmojiPicker();
    fecharStickerPicker();
  }
  if (event.target.classList.contains('modal')) {
    if (event.target.id === 'attachmentViewerModal') fecharVisualizadorArquivo();
    else event.target.classList.remove('active');
  }
};

document.addEventListener('keydown', (event) => {
  if (event.altKey && !event.ctrlKey && !event.metaKey && RESPOSTA_RAPIDA_ATALHOS[event.key] && tipoChat && chatIdAtual != null) {
    event.preventDefault();
    usarRespostaRapida(RESPOSTA_RAPIDA_ATALHOS[event.key]);
    return;
  }
  if (event.key !== 'Escape') return;
  fecharEmojiPicker();
  fecharStickerPicker();
  fecharVisualizadorArquivo();
  document.getElementById('templatePicker')?.classList.add('hidden');
});

Object.assign(window, {
  abrirVisualizadorArquivo,
  fecharVisualizadorArquivo,
  baixarArquivoMensagem,
  baixarArquivoVisualizado,
  imprimirArquivoVisualizado,
  abrirGaleriaConversa,
  fecharGaleriaConversa,
  exportarConversaPdf
});

carregarFavoritos();
carregarPrioridades();
carregarMensagensPrioritarias();
carregarFigurinhasSalvas();
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
    conteudo = `📎 <button type="button" onclick="baixarArquivoAdminProtegido('${escapeHtml(m.arquivo_nome_salvo || '').replace(/'/g, '&#039;')}', '${escapeHtml(m.arquivo_nome_original || m.arquivo_nome_salvo || 'arquivo').replace(/'/g, '&#039;')}')" style="border:0;background:transparent;padding:0;color:#60a5fa;cursor:pointer;text-decoration:underline;">${escapeHtml(m.arquivo_nome_original || m.arquivo_nome_salvo || 'arquivo')}</button>`;
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

async function baixarArquivoAdminProtegido(fileName, originalName = 'arquivo') {
  if (!fileName) return;
  try {
    const response = await fetch(`/api/uploads/${encodeURIComponent(fileName)}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Arquivo indisponivel');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = originalName || fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    mostrarNotificacao(err.message || 'Erro ao baixar arquivo', 'error');
  }
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
    fecharStickerPicker();
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
    document.getElementById('adminMetricasExtra')?.remove();

    // Cards de resumo
    const cards = [
      { label: 'Total de mensagens', val: d.totalMsgs, cor: '#3b82f6' },
      { label: 'Urgentes',           val: d.totalUrgentes, cor: '#ef4444' },
      { label: 'Em grupos',          val: d.totalGrupo, cor: '#8b5cf6' },
      { label: 'Privadas',           val: d.totalPrivado, cor: '#06b6d4' },
      { label: 'Apagadas',           val: d.totalApagadas, cor: '#f59e0b' },
      { label: 'Tempo médio resposta', val: d.tempoMedioRespostaMin ? `${d.tempoMedioRespostaMin} min` : '-', cor: '#16a34a' },
      { label: 'Agendadas pendentes', val: d.totalAgendadasPendentes || 0, cor: '#0f766e' },
      { label: 'Pendentes/SLA', val: (d.statusConversas?.pendente || 0) + (d.statusConversas?.urgente || 0), cor: '#dc2626' },
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
    const etiquetas = Array.isArray(d.topEtiquetas) && d.topEtiquetas.length
      ? `<div style="margin-top:12px;font-size:12px;color:#64748b;"><strong>Etiquetas mais usadas:</strong> ${d.topEtiquetas.map((t) => `${escapeHtml(t.nome)} (${t.total})`).join(', ')}</div>`
      : '';
    summaryEl.insertAdjacentHTML('afterend', `<div id="adminMetricasExtra">${etiquetas}</div>`);
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
