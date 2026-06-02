const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const DEFAULT_SECRET_KEY = 'sua-chave-secreta-aqui-mude-isso';
const SECRET_KEY = process.env.SECRET_KEY || DEFAULT_SECRET_KEY;
const SEED_DATA_DIR = path.join(__dirname, 'data');
const STORAGE_ROOT = process.env.STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.RAILWAY_ENVIRONMENT ? path.join(os.tmpdir(), 'chatinterno') : __dirname);
const IS_EPHEMERAL_STORAGE = !process.env.STORAGE_ROOT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && Boolean(process.env.RAILWAY_ENVIRONMENT);
const DATA_DIR = path.join(STORAGE_ROOT, 'data');
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const BACKUP_DIR = path.join(STORAGE_ROOT, 'backups');
const APP_TIMEZONE = 'America/Sao_Paulo';
const AUTOMATIC_BACKUP_RETENTION = 3;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avi']);
const ALLOWED_MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/x-msvideo': '.avi',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
};
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const DATA_FILE_NAMES = ['usuarios.json', 'grupos.json', 'membros.json', 'mensagens.json', 'mensagens-apagadas.json', 'painel-senhas.json', 'backup-agendamento.json', 'conversas-pendentes.json', 'status-atendimento.json', 'mensagens-prioritarias.json', 'mensagens-fixadas.json', 'templates.json', 'auditoria.json', 'push-subscriptions.json', 'escala-plantao.json'];

function getDefaultBackupSchedule() {
  return {
    ativo: false,
    horario: '18:00',
    timezone: APP_TIMEZONE,
    manterQuantidade: AUTOMATIC_BACKUP_RETENTION,
    ultimaExecucaoChave: '',
    ultimaExecucaoEm: null
  };
}

if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.startsWith('/assets/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/emergencia', express.static(path.join(__dirname, 'emergencia')));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/manifest.json', (_req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (_req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/signal_cartography.png', (_req, res) => res.sendFile(path.join(__dirname, 'signal_cartography.png')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, storageRoot: STORAGE_ROOT, persistentStorage: !IS_EPHEMERAL_STORAGE });
});

class SimpleDB {
  constructor() {
    this.reload();
  }

  reload() {
    this.usuarios = this.loadFile('usuarios.json', []);
    this.grupos = this.loadFile('grupos.json', []);
    this.membros_grupo = this.loadFile('membros.json', []);
    this.mensagens = this.loadFile('mensagens.json', []);
    this.mensagens_apagadas = this.loadFile('mensagens-apagadas.json', []);
    this.conversas_pendentes = this.loadFile('conversas-pendentes.json', []);
    this.status_atendimento = this.loadFile('status-atendimento.json', {});
    this.mensagens_prioritarias = this.loadFile('mensagens-prioritarias.json', []);
    this.mensagens_fixadas = this.loadFile('mensagens-fixadas.json', []);
    this.templates = this.loadFile('templates.json', []);
    this.auditoria = this.loadFile('auditoria.json', []);
    this.push_subscriptions = this.loadFile('push-subscriptions.json', []);
    this.escala_plantao = this.loadFile('escala-plantao.json', {
      escreventes: [],
      ferias: [],
      escalas: []
    });
    this.painel_senhas = this.loadFile('painel-senhas.json', {
      senhaAtual: '',
      observacao: '',
      atualizadoPor: '',
      atualizadoEm: null
    });
    this.backup_agendamento = this.loadFile('backup-agendamento.json', getDefaultBackupSchedule());
  }

  loadFile(name, defaultValue) {
    const filePath = path.join(DATA_DIR, name);
    const seedPath = path.join(SEED_DATA_DIR, name);

    if (!fs.existsSync(filePath) && fs.existsSync(seedPath)) {
      fs.copyFileSync(seedPath, filePath);
    }

    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  saveFile(name, data) {
    const filePath = path.join(DATA_DIR, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  save() {
    this.saveFile('usuarios.json', this.usuarios);
    this.saveFile('grupos.json', this.grupos);
    this.saveFile('membros.json', this.membros_grupo);
    this.saveFile('mensagens.json', this.mensagens);
    this.saveFile('mensagens-apagadas.json', this.mensagens_apagadas);
    this.saveFile('conversas-pendentes.json', this.conversas_pendentes);
    this.saveFile('status-atendimento.json', this.status_atendimento);
    this.saveFile('mensagens-prioritarias.json', this.mensagens_prioritarias);
    this.saveFile('mensagens-fixadas.json', this.mensagens_fixadas);
    this.saveFile('painel-senhas.json', this.painel_senhas);
    this.saveFile('backup-agendamento.json', this.backup_agendamento);
    this.saveFile('templates.json', this.templates);
    this.saveFile('push-subscriptions.json', this.push_subscriptions);
    this.saveFile('escala-plantao.json', this.escala_plantao);
    // auditoria is saved immediately on each append for safety
  }
}

const db = new SimpleDB();
ensurePlantaoGroup();
ensureDefaultPlantaoJuneSchedule();
const onlineUsers = new Map();
const socketUsers = new Map();
const typingTimeouts = new Map();

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token n�o fornecido' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    res.status(401).json({ erro: 'Token inv�lido' });
  }
}

function sanitizeFileName(name) {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getUploadExtension(file) {
  const ext = path.extname(file?.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  return ALLOWED_MIME_EXTENSIONS[String(file?.mimetype || '').toLowerCase()] || ext;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = getUploadExtension(file);
    const base = path.basename(file.originalname || 'arquivo', ext);
    const safeBase = sanitizeFileName(base);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = getUploadExtension(file);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Tipo de arquivo n�o permitido'));
    }
    cb(null, true);
  }
});

function getUsuarioPublico(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    admin: usuario.admin,
    ativo: usuario.ativo,
    status: usuario.status || 'disponivel',
    senha_painel: String(usuario.senha_painel || '')
  };
}

function isUsuarioOnline(usuarioId) {
  return onlineUsers.has(Number(usuarioId)) && onlineUsers.get(Number(usuarioId)).size > 0;
}

function isAdminUser(userId) {
  return Boolean(db.usuarios.find((u) => u.id === Number(userId) && u.ativo && u.admin));
}

function sanitizeUserStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['disponivel', 'ocupado', 'ausente'].includes(normalized) ? normalized : 'disponivel';
}

function formatBackupStamp(date = new Date()) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  const second = String(value.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function sanitizeBackupName(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function parseBackupTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return { hour: match[1], minute: match[2] };
}

function normalizeBackupScheduleConfig(input = {}, current = getDefaultBackupSchedule()) {
  const currentSchedule = {
    ...getDefaultBackupSchedule(),
    ...(current || {})
  };
  const parsedTime = parseBackupTime(input.horario ?? currentSchedule.horario);
  const manterQuantidade = Number.parseInt(input.manterQuantidade ?? currentSchedule.manterQuantidade, 10);

  return {
    ...currentSchedule,
    ativo: Boolean(input.ativo ?? currentSchedule.ativo),
    horario: parsedTime ? `${parsedTime.hour}:${parsedTime.minute}` : currentSchedule.horario,
    timezone: APP_TIMEZONE,
    manterQuantidade: AUTOMATIC_BACKUP_RETENTION
  };
}

function getTimeZoneParts(timeZone = APP_TIMEZONE, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute
  };
}

function getScheduleRunKey(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getBackupScheduleStatus() {
  const schedule = normalizeBackupScheduleConfig(db.backup_agendamento);
  return {
    ...schedule,
    descricao: schedule.ativo
      ? `Todos os dias as ${schedule.horario} (${schedule.timezone})`
      : 'Backup automatico desativado'
  };
}

function resolveBackupPath(backupId) {
  const targetPath = path.join(BACKUP_DIR, String(backupId || ''));
  const resolvedBackupRoot = path.resolve(BACKUP_DIR);
  const resolvedTarget = path.resolve(targetPath);
  if (!resolvedTarget.startsWith(resolvedBackupRoot)) {
    throw new Error('Backup invalido');
  }
  return resolvedTarget;
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const backupPath = path.join(BACKUP_DIR, entry.name);
      const metadataPath = path.join(backupPath, 'metadata.json');
      let metadata = null;

      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch {
          metadata = null;
        }
      }

      const stat = fs.statSync(backupPath);
      return {
        id: entry.name,
        nome: metadata?.nome || entry.name,
        criado_em: metadata?.criado_em || stat.mtime.toISOString(),
        criado_por: metadata?.criado_por || '',
        arquivos: Array.isArray(metadata?.arquivos) ? metadata.arquivos : [],
        tipo: metadata?.tipo || 'manual'
      };
    })
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
}

function createBackup({ nome = '', criadoPor = '', tipo = 'manual' } = {}) {
  const stamp = formatBackupStamp();
  const safeName = sanitizeBackupName(nome);
  const backupId = safeName ? `${stamp}-${safeName}` : stamp;
  const backupPath = path.join(BACKUP_DIR, backupId);
  fs.mkdirSync(backupPath, { recursive: true });

  const copiedFiles = [];
  DATA_FILE_NAMES.forEach((fileName) => {
    const sourcePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(sourcePath)) return;
    fs.copyFileSync(sourcePath, path.join(backupPath, fileName));
    copiedFiles.push(fileName);
  });

  const metadata = {
    id: backupId,
    nome: safeName || `backup-${stamp}`,
    criado_em: new Date().toISOString(),
    criado_por: criadoPor,
    arquivos: copiedFiles,
    tipo
  };

  fs.writeFileSync(path.join(backupPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
  return metadata;
}

function pruneAutomaticBackups(manterQuantidade) {
  const limite = Number.isFinite(Number(manterQuantidade)) ? Number(manterQuantidade) : AUTOMATIC_BACKUP_RETENTION;
  const automaticos = listBackups().filter((backup) => backup.tipo === 'automatico');
  automaticos.slice(limite).forEach((backup) => {
    const backupPath = resolveBackupPath(backup.id);
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  });
}

function restoreBackup(backupId) {
  const backupPath = resolveBackupPath(backupId);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup nao encontrado');
  }

  DATA_FILE_NAMES.forEach((fileName) => {
    const sourcePath = path.join(backupPath, fileName);
    if (!fs.existsSync(sourcePath)) return;
    fs.copyFileSync(sourcePath, path.join(DATA_DIR, fileName));
  });

  db.reload();
}

let lastAutomaticBackupCheckKey = '';

function runAutomaticBackupIfDue() {
  const schedule = normalizeBackupScheduleConfig(db.backup_agendamento);
  if (!schedule.ativo) return null;

  const nowParts = getTimeZoneParts(schedule.timezone);
  const nowTime = `${nowParts.hour}:${nowParts.minute}`;
  const runKey = getScheduleRunKey(nowParts);
  const minuteKey = `${runKey}-${nowTime}`;

  if (nowTime !== schedule.horario) return null;
  if (schedule.ultimaExecucaoChave === runKey) return null;
  if (lastAutomaticBackupCheckKey === minuteKey) return null;

  const metadata = createBackup({
    nome: `auto-${runKey}-${nowParts.hour}${nowParts.minute}`,
    criadoPor: 'Sistema',
    tipo: 'automatico'
  });

  db.backup_agendamento = {
    ...schedule,
    ultimaExecucaoChave: runKey,
    ultimaExecucaoEm: new Date().toISOString()
  };
  db.saveFile('backup-agendamento.json', db.backup_agendamento);
  pruneAutomaticBackups(schedule.manterQuantidade);

  lastAutomaticBackupCheckKey = minuteKey;
  io.emit('backup-automatico-criado', {
    backup: metadata,
    agendamento: getBackupScheduleStatus()
  });

  return metadata;
}

function marcarComoLidas(remetenteId, destinatarioId) {
  let alterou = false;
  db.mensagens.forEach((m) => {
    if (
      m.usuario_id === Number(remetenteId) &&
      m.usuario_destino_id === Number(destinatarioId) &&
      !m.lido
    ) {
      m.lido = 1;
      m.lido_em = new Date().toISOString();
      alterou = true;
    }
  });
  if (alterou) db.save();
  return alterou;
}

function emitPresence() {
  io.emit('presenca-atualizada', {
    online: Array.from(onlineUsers.keys()),
    status: Object.fromEntries(db.usuarios.map((usuario) => [usuario.id, usuario.status || 'disponivel']))
  });
}

function enrichMessage(m) {
  const replyTarget = m.reply_to_id
    ? db.mensagens.find((item) => Number(item.id) === Number(m.reply_to_id))
    : null;
  const reacoes = typeof m.reacoes === 'object' && m.reacoes ? m.reacoes : {};
  const reacoesNomes = Object.fromEntries(Object.entries(reacoes).map(([emoji, userIds]) => {
    const nomes = (Array.isArray(userIds) ? userIds : [])
      .map((id) => db.usuarios.find((u) => Number(u.id) === Number(id))?.nome || 'Desconhecido');
    return [emoji, nomes];
  }));
  const leiturasGrupo = Array.isArray(m.leituras_grupo)
    ? m.leituras_grupo
        .map((item) => ({
          usuario_id: Number(item?.usuario_id),
          lido_em: item?.lido_em || null
        }))
        .filter((item) => Number.isFinite(item.usuario_id))
    : [];

  return {
    ...m,
    usuario_nome: db.usuarios.find((u) => u.id === m.usuario_id)?.nome || 'Desconhecido',
    leituras_grupo: leiturasGrupo.map((item) => ({
      ...item,
      usuario_nome: db.usuarios.find((u) => u.id === item.usuario_id)?.nome || 'Desconhecido'
    })),
    reacoes,
    reacoes_nomes: reacoesNomes,
    prioridade: isPriorityMessage(m.id),
    reply_preview: replyTarget ? {
      id: replyTarget.id,
      usuario_nome: db.usuarios.find((u) => u.id === replyTarget.usuario_id)?.nome || 'Desconhecido',
      tipo: replyTarget.tipo || 'texto',
      conteudo: replyTarget.tipo === 'arquivo'
        ? (replyTarget.arquivo_nome_original || 'Arquivo')
        : String(replyTarget.conteudo || '').slice(0, 120)
    } : null
  };
}

function enrichAdminMessage(m) {
  const message = enrichMessage(m);
  if (!m.apagada_em) return message;
  const apagadaPor = db.usuarios.find((u) => Number(u.id) === Number(m.apagada_por));
  return {
    ...message,
    apagada: true,
    apagada_em: m.apagada_em,
    apagada_por: m.apagada_por || null,
    apagada_por_nome: apagadaPor?.nome || 'Desconhecido'
  };
}

function getAdminConversationMessages() {
  return [
    ...db.mensagens,
    ...db.mensagens_apagadas.map((message) => ({ ...message, apagada: true }))
  ].sort((a, b) => new Date(a.criado_em || 0) - new Date(b.criado_em || 0));
}

function getMessageById(messageId) {
  return db.mensagens.find((m) => Number(m.id) === Number(messageId));
}

function normalizeConversationType(tipo) {
  const normalized = String(tipo || '').trim().toLowerCase();
  return ['grupo', 'privado'].includes(normalized) ? normalized : '';
}

function getConversationKey(tipo, id) {
  const normalized = normalizeConversationType(tipo);
  const numericId = Number(id);
  if (!normalized || !numericId) return '';
  return `${normalized}-${numericId}`;
}

function getStoredConversationKey(tipo, id, userId) {
  const normalized = normalizeConversationType(tipo);
  const numericId = Number(id);
  const numericUserId = Number(userId);
  if (!normalized || !numericId) return '';
  if (normalized === 'grupo') return `grupo-${numericId}`;
  if (!numericUserId || numericUserId === numericId) return '';
  return `privado-${[numericUserId, numericId].sort((a, b) => a - b).join('-')}`;
}

function getClientConversationKey(tipo, id) {
  return getConversationKey(tipo, id);
}

function isValidAttendanceStatus(status) {
  return ['pendente', 'aguardando', 'resolvido', 'urgente'].includes(String(status || '').trim().toLowerCase());
}

function canUserAccessConversation(userId, tipo, id) {
  const normalized = normalizeConversationType(tipo);
  const numericId = Number(id);
  if (!normalized || !numericId) return false;
  if (normalized === 'grupo') return usuarioPodeAcessarGrupo(userId, numericId);
  return Boolean(findActiveUserById(numericId)) && Number(userId) !== numericId;
}

function emitConversationWorkflow(tipo, id, payload) {
  const normalized = normalizeConversationType(tipo);
  const numericId = Number(id);
  if (normalized === 'grupo') {
    io.to(`grupo-${numericId}`).emit('workflow-conversa-atualizado', payload);
    return;
  }

  const actorId = Number(payload.usuarioId);
  io.to(`usuario-${numericId}`).emit('workflow-conversa-atualizado', {
    ...payload,
    key: getClientConversationKey('privado', actorId),
    chatId: actorId
  });
  if (actorId) {
    io.to(`usuario-${actorId}`).emit('workflow-conversa-atualizado', {
      ...payload,
      key: getClientConversationKey('privado', numericId),
      chatId: numericId
    });
  }
}

function isPriorityMessage(messageId) {
  return db.mensagens_prioritarias.some((item) => Number(item?.message_id) === Number(messageId));
}

function getStoredKeyForMessage(message) {
  if (!message) return '';
  if (message.grupo_id) return `grupo-${Number(message.grupo_id)}`;
  const ids = [Number(message.usuario_id), Number(message.usuario_destino_id)].filter(Boolean).sort((a, b) => a - b);
  return ids.length === 2 ? `privado-${ids.join('-')}` : '';
}

function getClientKeyForMessage(message, userId) {
  if (!message) return '';
  if (message.grupo_id) return `grupo-${Number(message.grupo_id)}`;
  const otherId = Number(message.usuario_id) === Number(userId)
    ? Number(message.usuario_destino_id)
    : Number(message.usuario_id);
  return otherId ? `privado-${otherId}` : '';
}

function setPriorityMessage(messageId, userId, highlighted) {
  const numericId = Number(messageId);
  const index = db.mensagens_prioritarias.findIndex((item) => Number(item?.message_id) === numericId);

  if (highlighted) {
    const entry = {
      message_id: numericId,
      atualizado_por: Number(userId),
      atualizado_em: new Date().toISOString()
    };
    if (index >= 0) db.mensagens_prioritarias[index] = entry;
    else db.mensagens_prioritarias.push(entry);
    return entry;
  }

  if (index >= 0) db.mensagens_prioritarias.splice(index, 1);
  return null;
}

function emitMessagePriority(message, highlighted, userId) {
  const payload = {
    messageId: Number(message.id),
    highlighted: Boolean(highlighted),
    tipoChat: message.grupo_id ? 'grupo' : 'privado',
    grupoId: message.grupo_id || null,
    remetenteId: Number(message.usuario_id),
    destinatarioId: message.usuario_destino_id || null,
    atualizadoPor: Number(userId)
  };

  if (message.grupo_id) {
    io.to(`grupo-${message.grupo_id}`).emit('mensagem-prioridade-atualizada', payload);
  } else {
    io.to(`usuario-${message.usuario_id}`).emit('mensagem-prioridade-atualizada', payload);
    if (message.usuario_destino_id) {
      io.to(`usuario-${message.usuario_destino_id}`).emit('mensagem-prioridade-atualizada', payload);
    }
  }
}

function getPinnedMessageEntry(messageId) {
  return db.mensagens_fixadas.find((item) => Number(item?.message_id) === Number(messageId));
}

function setPinnedMessage(message, userId, pinned) {
  const conversationKey = getStoredKeyForMessage(message);
  const messageId = Number(message.id);
  db.mensagens_fixadas = db.mensagens_fixadas.filter((item) => Number(item?.message_id) !== messageId);

  if (!pinned) return null;

  const entry = {
    conversation_key: conversationKey,
    message_id: messageId,
    fixado_por: Number(userId),
    fixado_em: new Date().toISOString()
  };
  db.mensagens_fixadas.push(entry);
  return entry;
}

function getPinnedMessagesForUser(userId) {
  const result = {};
  db.mensagens_fixadas.forEach((item) => {
    const message = getMessageById(item?.message_id);
    if (!canUserAccessMessage(userId, message)) return;
    const key = getClientKeyForMessage(message, userId);
    if (!key) return;
    if (!result[key]) result[key] = [];
    result[key].push({
      messageId: Number(message.id),
      usuarioNome: db.usuarios.find((u) => Number(u.id) === Number(message.usuario_id))?.nome || 'Usuario',
      texto: message.tipo === 'arquivo' ? (message.arquivo_nome_original || 'Arquivo') : String(message.conteudo || '').slice(0, 160),
      tipo: message.tipo || 'texto',
      fixadoEm: item.fixado_em || null
    });
  });
  return result;
}

function emitPinnedMessage(message, pinned, userId) {
  const payloadBase = {
    messageId: Number(message.id),
    pinned: Boolean(pinned),
    texto: message.tipo === 'arquivo' ? (message.arquivo_nome_original || 'Arquivo') : String(message.conteudo || '').slice(0, 160),
    usuarioNome: db.usuarios.find((u) => Number(u.id) === Number(message.usuario_id))?.nome || 'Usuario',
    tipo: message.tipo || 'texto',
    fixadoEm: new Date().toISOString(),
    atualizadoPor: Number(userId),
    tipoChat: message.grupo_id ? 'grupo' : 'privado',
    grupoId: message.grupo_id || null,
    remetenteId: Number(message.usuario_id),
    destinatarioId: message.usuario_destino_id || null
  };

  if (message.grupo_id) {
    io.to(`grupo-${message.grupo_id}`).emit('mensagem-fixada-atualizada', {
      ...payloadBase,
      key: getClientKeyForMessage(message, userId)
    });
  } else {
    [Number(message.usuario_id), Number(message.usuario_destino_id)].filter(Boolean).forEach((recipientId) => {
      io.to(`usuario-${recipientId}`).emit('mensagem-fixada-atualizada', {
        ...payloadBase,
        key: getClientKeyForMessage(message, recipientId)
      });
    });
  }
}

function isSamePrivateConversation(message, userA, userB) {
  const ids = [Number(userA), Number(userB)];
  return !message.grupo_id &&
    ids.includes(Number(message.usuario_id)) &&
    ids.includes(Number(message.usuario_destino_id));
}

function canUserAccessMessage(userId, message) {
  if (!message) return false;
  if (message.grupo_id) return usuarioPodeAcessarGrupo(userId, message.grupo_id);
  return Number(message.usuario_id) === Number(userId) || Number(message.usuario_destino_id) === Number(userId);
}

function isValidReplyTarget({ replyToId, tipoChat, chatId, userId }) {
  if (!replyToId) return true;
  const target = getMessageById(replyToId);
  if (!target) return false;
  if (!canUserAccessMessage(userId, target)) return false;

  if (tipoChat === 'grupo') {
    return Number(target.grupo_id) === Number(chatId);
  }

  return isSamePrivateConversation(target, userId, chatId);
}

function emitMessageUpdated(message, extra = {}) {
  const payload = {
    message: enrichMessage(message),
    tipoChat: message.grupo_id ? 'grupo' : 'privado',
    grupoId: message.grupo_id || null,
    remetenteId: Number(message.usuario_id),
    destinatarioId: message.usuario_destino_id || null,
    ...extra
  };

  if (message.grupo_id) {
    io.to(`grupo-${message.grupo_id}`).emit('mensagem-atualizada', payload);
  } else {
    io.to(`usuario-${message.usuario_id}`).emit('mensagem-atualizada', payload);
    if (message.usuario_destino_id) {
      io.to(`usuario-${message.usuario_destino_id}`).emit('mensagem-atualizada', payload);
    }
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function ensurePlantaoGroup() {
  const exists = db.grupos.some((grupo) => normalizeKey(grupo.nome) === 'plantao');
  if (exists) return;

  db.grupos.push({
    id: Date.now(),
    nome: 'Plantão',
    descricao: 'Escala de plantao dos escreventes do Registro Civil de Chapeco SC',
    criado_em: new Date().toISOString()
  });
  db.saveFile('grupos.json', db.grupos);
}

function ensureDefaultPlantaoJuneSchedule() {
  const state = getEscalaPlantaoState();
  if (state.escalas.length || state.escreventes.length) return;

  const nomes = ['Duda', 'Daniela', 'Régis', 'Sté'];
  const escreventes = nomes.map((nome, index) => ({
    id: 2026060100 + index + 1,
    nome,
    ativo: true
  }));
  const byName = new Map(escreventes.map((item) => [normalizeKey(item.nome), item.id]));
  const periodos = [
    { inicio: '2026-05-29', fim: '2026-06-04', nome: 'Duda' },
    { inicio: '2026-06-05', fim: '2026-06-11', nome: 'Daniela' },
    { inicio: '2026-06-12', fim: '2026-06-18', nome: 'Régis' },
    { inicio: '2026-06-19', fim: '2026-06-25', nome: 'Sté' }
  ];
  const escalas = [];

  periodos.forEach((periodo) => {
    const cursor = parseDateOnly(periodo.inicio);
    const end = parseDateOnly(periodo.fim);
    while (cursor && end && cursor <= end) {
      escalas.push({
        data: toDateOnly(cursor),
        escreventeId: byName.get(normalizeKey(periodo.nome)),
        conflito: false,
        observacao: 'Escala inicial de junho/2026'
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  saveEscalaPlantaoState({
    escreventes,
    ferias: [],
    escalas
  });
}

function getEscalaPlantaoState() {
  const state = db.escala_plantao || {};
  return {
    escreventes: Array.isArray(state.escreventes) ? state.escreventes : [],
    ferias: Array.isArray(state.ferias) ? state.ferias : [],
    escalas: Array.isArray(state.escalas) ? state.escalas : []
  };
}

function saveEscalaPlantaoState(state) {
  db.escala_plantao = {
    escreventes: Array.isArray(state.escreventes) ? state.escreventes : [],
    ferias: Array.isArray(state.ferias) ? state.ferias : [],
    escalas: Array.isArray(state.escalas) ? state.escalas : []
  };
  db.saveFile('escala-plantao.json', db.escala_plantao);
}

function parseDateOnly(value) {
  const dateText = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const date = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnly(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeEscalaPlantaoPayload() {
  const state = getEscalaPlantaoState();
  const validEscreventeIds = new Set(state.escreventes.map((item) => Number(item.id)));

  state.escreventes = state.escreventes
    .map((item) => ({
      id: Number(item.id),
      nome: sanitizeText(item.nome).slice(0, 80),
      ativo: item.ativo !== false
    }))
    .filter((item) => Number.isFinite(item.id) && item.nome);

  state.ferias = state.ferias
    .map((item) => ({
      id: Number(item.id),
      escreventeId: Number(item.escreventeId),
      inicio: toDateOnly(parseDateOnly(item.inicio) || new Date()),
      fim: toDateOnly(parseDateOnly(item.fim) || parseDateOnly(item.inicio) || new Date())
    }))
    .filter((item) => Number.isFinite(item.id) && validEscreventeIds.has(item.escreventeId) && item.inicio <= item.fim);

  state.escalas = state.escalas
    .map((item) => ({
      data: toDateOnly(parseDateOnly(item.data) || new Date()),
      escreventeId: Number(item.escreventeId),
      conflito: Boolean(item.conflito),
      observacao: sanitizeText(item.observacao).slice(0, 120)
    }))
    .filter((item) => validEscreventeIds.has(item.escreventeId) || item.conflito);

  saveEscalaPlantaoState(state);
  return state;
}

function escreventeEstaDeFerias(escreventeId, data, ferias) {
  return ferias.some((item) => (
    Number(item.escreventeId) === Number(escreventeId) &&
    item.inicio <= data &&
    item.fim >= data
  ));
}

function getDateRange(start, end) {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function escreventeDisponivelNoPeriodo(escreventeId, datas, ferias) {
  return datas.every((data) => !escreventeEstaDeFerias(escreventeId, data, ferias));
}

function gerarEscalaPlantao(inicio, fim) {
  const state = sanitizeEscalaPlantaoPayload();
  const escreventes = state.escreventes.filter((item) => item.ativo !== false);
  const start = parseDateOnly(inicio);
  const end = parseDateOnly(fim);
  if (!start || !end || start > end) {
    const error = new Error('Informe um periodo valido para gerar a escala');
    error.statusCode = 400;
    throw error;
  }
  if (!escreventes.length) {
    const error = new Error('Cadastre ao menos um escrevente');
    error.statusCode = 400;
    throw error;
  }

  const counts = new Map(escreventes.map((item) => [Number(item.id), 0]));
  const lastAssigned = new Map(escreventes.map((item) => [Number(item.id), -1]));
  state.escalas.forEach((item, index) => {
    if (counts.has(Number(item.escreventeId))) counts.set(Number(item.escreventeId), counts.get(Number(item.escreventeId)) + 1);
    if (lastAssigned.has(Number(item.escreventeId))) lastAssigned.set(Number(item.escreventeId), index);
  });

  const novasEscalas = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const blocoInicio = new Date(cursor);
    const blocoFim = new Date(cursor);
    blocoFim.setDate(blocoFim.getDate() + 6);
    if (blocoFim > end) blocoFim.setTime(end.getTime());
    const datasDoBloco = getDateRange(blocoInicio, blocoFim);
    const disponiveis = escreventes
      .filter((item) => escreventeDisponivelNoPeriodo(item.id, datasDoBloco, state.ferias))
      .sort((a, b) => (
        (counts.get(Number(a.id)) - counts.get(Number(b.id))) ||
        (lastAssigned.get(Number(a.id)) - lastAssigned.get(Number(b.id))) ||
        a.nome.localeCompare(b.nome, 'pt-BR')
      ));

    if (disponiveis.length) {
      const escolhido = disponiveis[0];
      datasDoBloco.forEach((data) => {
        novasEscalas.push({ data, escreventeId: Number(escolhido.id), conflito: false, observacao: 'Escala semanal automatica' });
      });
      counts.set(Number(escolhido.id), counts.get(Number(escolhido.id)) + datasDoBloco.length);
      lastAssigned.set(Number(escolhido.id), novasEscalas.length + state.escalas.length);
    } else {
      datasDoBloco.forEach((data) => {
        novasEscalas.push({ data, escreventeId: null, conflito: true, observacao: 'Nenhum escrevente disponivel durante toda esta semana' });
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  const datasGeradas = new Set(novasEscalas.map((item) => item.data));
  state.escalas = [
    ...state.escalas.filter((item) => !datasGeradas.has(item.data)),
    ...novasEscalas
  ].sort((a, b) => a.data.localeCompare(b.data));
  saveEscalaPlantaoState(state);
  return state;
}

function cadastrarPlantaoPeriodo(escreventeId, inicio, fim) {
  const state = sanitizeEscalaPlantaoPayload();
  const selectedId = Number(escreventeId);
  const start = parseDateOnly(inicio);
  const end = parseDateOnly(fim);
  if (!selectedId || !start || !end || start > end) {
    const error = new Error('Informe escrevente e periodo validos');
    error.statusCode = 400;
    throw error;
  }
  if (!state.escreventes.some((item) => Number(item.id) === selectedId)) {
    const error = new Error('Escrevente nao encontrado');
    error.statusCode = 404;
    throw error;
  }

  const datasPeriodo = new Set(getDateRange(start, end));
  const novasEscalas = Array.from(datasPeriodo).map((data) => ({
    data,
    escreventeId: selectedId,
    conflito: false,
    observacao: 'Plantao cadastrado manualmente'
  }));

  state.escalas = [
    ...state.escalas.filter((item) => !datasPeriodo.has(item.data)),
    ...novasEscalas
  ].sort((a, b) => a.data.localeCompare(b.data));
  saveEscalaPlantaoState(state);
  return state;
}

function excluirPlantaoPeriodo(inicio, fim) {
  const state = sanitizeEscalaPlantaoPayload();
  const start = parseDateOnly(inicio);
  const end = parseDateOnly(fim);
  if (!start || !end || start > end) {
    const error = new Error('Informe um periodo valido para excluir');
    error.statusCode = 400;
    throw error;
  }

  const datasPeriodo = new Set(getDateRange(start, end));
  state.escalas = state.escalas.filter((item) => !datasPeriodo.has(item.data));
  saveEscalaPlantaoState(state);
  return state;
}

function gerarSenhaTemporaria() {
  return `Senha${Math.floor(100000 + Math.random() * 900000)}!`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function paginateMessages(messages, req) {
  const hasPagination = req.query?.limit || req.query?.before;
  const sorted = [...messages].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  if (!hasPagination) return sorted;

  const limit = clampNumber(req.query.limit, 20, 100, 50);
  const before = req.query.before ? new Date(req.query.before).getTime() : null;
  const filtered = Number.isFinite(before)
    ? sorted.filter((message) => new Date(message.criado_em).getTime() < before)
    : sorted;
  const slice = filtered.slice(Math.max(0, filtered.length - limit));

  return {
    mensagens: slice,
    hasMore: filtered.length > slice.length,
    nextBefore: slice.length ? slice[0].criado_em : null,
    totalLoaded: slice.length
  };
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function findActiveUserById(userId) {
  return db.usuarios.find((u) => u.id === Number(userId) && u.ativo);
}

function getMembrosDoGrupo(grupoId) {
  return db.membros_grupo
    .filter((m) => Number(m.grupo_id) === Number(grupoId))
    .map((m) => Number(m.usuario_id));
}

function ensureGroupReadTracking(message) {
  if (!message?.grupo_id) return message;
  if (!Array.isArray(message.leituras_grupo)) {
    message.leituras_grupo = [];
  }
  message.leituras_grupo = message.leituras_grupo
    .map((item) => ({
      usuario_id: Number(item?.usuario_id),
      lido_em: item?.lido_em || null
    }))
    .filter((item) => Number.isFinite(item.usuario_id) && Number(item.usuario_id) !== Number(message.usuario_id))
    .filter((item, index, arr) => arr.findIndex((entry) => entry.usuario_id === item.usuario_id) === index);
  return message;
}

function marcarMensagensGrupoComoLidas(grupoId, usuarioId) {
  let alterou = false;
  const usuarioIdNumber = Number(usuarioId);
  const grupoIdNumber = Number(grupoId);

  db.mensagens.forEach((message) => {
    if (Number(message.grupo_id) !== grupoIdNumber) return;
    if (Number(message.usuario_id) === usuarioIdNumber) return;

    ensureGroupReadTracking(message);

    const jaLeu = message.leituras_grupo.some((item) => Number(item.usuario_id) === usuarioIdNumber);
    if (jaLeu) return;

    message.leituras_grupo.push({
      usuario_id: usuarioIdNumber,
      lido_em: new Date().toISOString()
    });
    alterou = true;

    emitMessageUpdated(message, {
      acao: 'leitura-grupo',
      leitorId: usuarioIdNumber,
      grupoId: grupoIdNumber
    });
  });

  if (alterou) db.save();
  return alterou;
}

function getPendingConversationIndex(usuarioId, contatoId) {
  return db.conversas_pendentes.findIndex((item) =>
    Number(item?.usuario_id) === Number(usuarioId) &&
    Number(item?.contato_id) === Number(contatoId)
  );
}

function marcarConversaPrivadaComoPendente(usuarioId, contatoId, messageId = null) {
  const usuarioIdNumber = Number(usuarioId);
  const contatoIdNumber = Number(contatoId);

  if (!usuarioIdNumber || !contatoIdNumber || usuarioIdNumber === contatoIdNumber) {
    return false;
  }

  const agora = new Date().toISOString();
  const index = getPendingConversationIndex(usuarioIdNumber, contatoIdNumber);
  const registro = {
    id: Date.now(),
    usuario_id: usuarioIdNumber,
    contato_id: contatoIdNumber,
    message_id: Number(messageId) || null,
    criado_em: agora,
    atualizado_em: agora
  };

  if (index >= 0) {
    db.conversas_pendentes[index] = {
      ...db.conversas_pendentes[index],
      message_id: registro.message_id,
      atualizado_em: agora
    };
  } else {
    db.conversas_pendentes.push(registro);
  }

  db.save();
  return true;
}

function limparConversaPrivadaPendente(usuarioId, contatoId) {
  const index = getPendingConversationIndex(usuarioId, contatoId);
  if (index === -1) return false;
  db.conversas_pendentes.splice(index, 1);
  db.save();
  return true;
}

function grupoEhRestrito(grupoId) {
  return getMembrosDoGrupo(grupoId).length > 0;
}

function usuarioPodeAcessarGrupo(userId, grupoId) {
  const membros = getMembrosDoGrupo(grupoId);
  if (!membros.length) return true;
  return membros.includes(Number(userId));
}

function listarGruposVisiveisParaUsuario(userId) {
  return db.grupos.filter((grupo) => usuarioPodeAcessarGrupo(userId, grupo.id));
}

function getArquivoPreviewLabel(message) {
  const ext = path.extname(message?.arquivo_nome_original || message?.arquivo_url || '').toLowerCase();
  if (['.gif', '.webp'].includes(ext)) return 'Figurinha';
  if (['.jpg', '.jpeg', '.png'].includes(ext)) return 'Imagem';
  if (ext === '.avi') return 'Video';
  return 'Arquivo';
}

function getMessagePreviewText(message) {
  if (!message) return '';
  if (message.tipo === 'arquivo') {
    return `${getArquivoPreviewLabel(message)}: ${message.arquivo_nome_original || 'anexo'}`;
  }
  return String(message.conteudo || '').trim();
}

function compareByCreatedDesc(a, b) {
  return new Date(b?.criado_em || 0).getTime() - new Date(a?.criado_em || 0).getTime();
}

function getGroupConversationSummary(grupoId, userId) {
  const messages = db.mensagens
    .filter((message) => Number(message.grupo_id) === Number(grupoId))
    .sort(compareByCreatedDesc);
  const latest = messages[0] || null;
  const unread = messages.filter((message) => {
    if (Number(message.usuario_id) === Number(userId)) return false;
    ensureGroupReadTracking(message);
    return !message.leituras_grupo.some((item) => Number(item.usuario_id) === Number(userId));
  }).length;

  return {
    ultimaMensagem: latest ? getMessagePreviewText(latest) : '',
    criado_em: latest?.criado_em || null,
    naoLidas: unread
  };
}

function removeFileIfExists(fileName) {
  if (!fileName) return;
  const filePath = path.join(UPLOAD_DIR, fileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_err) {
      // Ignore file deletion failures to avoid blocking message removal.
    }
  }
}

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha' });
    }

    const usuario = db.usuarios.find((u) => normalizeEmail(u.email) === email && u.ativo);

    if (!usuario) return res.status(401).json({ erro: 'Usu�rio ou senha inv�lidos' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Usu�rio ou senha inv�lidos' });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, admin: usuario.admin },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        admin: usuario.admin,
        senha_painel: String(usuario.senha_painel || '')
      }
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/me', verificarToken, (req, res) => {
  try {
    const usuario = findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(getUsuarioPublico(usuario));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/me', verificarToken, async (req, res) => {
  try {
    const usuario = findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const nome = sanitizeText(req.body?.nome);
    const email = normalizeEmail(req.body?.email);
    const senhaPainel = sanitizeText(req.body?.senhaPainel);
    const senhaAtual = String(req.body?.senhaAtual || '');
    const novaSenha = String(req.body?.novaSenha || '').trim();

    if (!nome || !email) {
      return res.status(400).json({ erro: 'Nome e email são obrigatórios' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ erro: 'Email inválido' });
    }

    const emailEmUso = db.usuarios.find((u) => normalizeEmail(u.email) === email && u.id !== usuario.id);
    if (emailEmUso) {
      return res.status(400).json({ erro: 'Email já cadastrado por outro usuário' });
    }

    if (novaSenha) {
      if (!senhaAtual) {
        return res.status(400).json({ erro: 'Informe a senha atual para definir uma nova senha' });
      }

      const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
      if (!senhaValida) {
        return res.status(401).json({ erro: 'Senha atual inválida' });
      }

      if (novaSenha.length < 6) {
        return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });
      }

      usuario.senha = await bcrypt.hash(novaSenha, 10);
    }

    usuario.nome = nome;
    usuario.email = email;
    usuario.senha_painel = senhaPainel;
    db.save();

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, admin: usuario.admin },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({
      mensagem: 'Ajustes salvos com sucesso',
      token,
      usuario: getUsuarioPublico(usuario)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/me/status', verificarToken, (req, res) => {
  try {
    const usuario = findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    usuario.status = sanitizeUserStatus(req.body?.status);
    db.save();
    emitPresence();
    res.json(getUsuarioPublico(usuario));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-usuario', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const email = normalizeEmail(req.body?.email);
    const nome = sanitizeText(req.body?.nome);
    const senha = String(req.body?.senha || gerarSenhaTemporaria()).trim() || gerarSenhaTemporaria();
    if (!nome || !email) {
      return res.status(400).json({ erro: 'Nome e email são obrigatórios' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ erro: 'Email inválido' });
    }

    if (db.usuarios.find((u) => normalizeEmail(u.email) === email)) {
      return res.status(400).json({ erro: 'Email j� cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const novoUsuario = {
      id: Date.now(),
      email,
      nome,
      senha: senhaHash,
      admin: 0,
      ativo: 1,
      criado_em: new Date().toISOString()
    };

    db.usuarios.push(novoUsuario);
    db.save();
    return res.json({ mensagem: 'Usuario criado com sucesso', senha_temporaria: senha });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/usuarios', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuarios = db.usuarios.map((u) => ({
      ...getUsuarioPublico(u),
      online: isUsuarioOnline(u.id)
    }));
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/mensagens-apagadas', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const mensagens = [...db.mensagens_apagadas]
      .sort((a, b) => new Date(b.apagada_em || b.criado_em) - new Date(a.apagada_em || a.criado_em))
      .slice(0, 200)
      .map((message) => {
        const sender = db.usuarios.find((u) => Number(u.id) === Number(message.usuario_id));
        const grupo = message.grupo_id ? db.grupos.find((g) => Number(g.id) === Number(message.grupo_id)) : null;
        const destino = message.usuario_destino_id ? db.usuarios.find((u) => Number(u.id) === Number(message.usuario_destino_id)) : null;
        const apagadaPor = db.usuarios.find((u) => Number(u.id) === Number(message.apagada_por));
        return {
          ...message,
          usuario_nome: sender?.nome || 'Desconhecido',
          conversa_nome: grupo?.nome || destino?.nome || 'Conversa',
          apagada_por_nome: apagadaPor?.nome || 'Desconhecido'
        };
      });

    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/admin/usuarios/:id', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id, 10));
    if (usuario) {
      usuario.ativo = 0;
      db.save();
    }
    res.json({ mensagem: 'Usu�rio desativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/admin/usuarios/:id/senha', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id, 10) && u.ativo);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const novaSenha = String(req.body?.novaSenha || '').trim();
    if (novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    usuario.senha = await bcrypt.hash(novaSenha, 10);
    db.save();

    res.json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/usuarios/:id/redefinir-senha', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id, 10) && u.ativo);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    const senhaTemporaria = gerarSenhaTemporaria();
    usuario.senha = await bcrypt.hash(senhaTemporaria, 10);
    db.save();

    res.json({ mensagem: 'Senha redefinida com sucesso', senha_temporaria: senhaTemporaria });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/usuarios/:id/desativar', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id, 10));
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });
    if (usuario.admin) return res.status(400).json({ erro: 'Nao e possivel desativar administrador' });

    usuario.ativo = 0;
    db.save();
    res.json({ mensagem: 'Usuario desativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/usuarios/:id/ativar', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find((u) => u.id === parseInt(req.params.id, 10));
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    usuario.ativo = 1;
    db.save();
    res.json({ mensagem: 'Usuario ativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/backups', verificarToken, (req, res) => {
  try {
    if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
    res.json(listBackups());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/backups/agendamento', verificarToken, (req, res) => {
  try {
    if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
    res.json(getBackupScheduleStatus());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/backups', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const nome = sanitizeText(req.body?.nome);
    const backup = createBackup({ nome, criadoPor: usuarioAdmin.nome });
    res.json({ mensagem: 'Backup criado com sucesso', backup });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/admin/backups/agendamento', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    db.backup_agendamento = normalizeBackupScheduleConfig(req.body, db.backup_agendamento);
    db.saveFile('backup-agendamento.json', db.backup_agendamento);
    pruneAutomaticBackups(AUTOMATIC_BACKUP_RETENTION);

    io.emit('backup-agendamento-atualizado', {
      configuradoPor: usuarioAdmin.nome,
      configuradoEm: new Date().toISOString(),
      agendamento: getBackupScheduleStatus()
    });

    res.json(getBackupScheduleStatus());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/backups/importar', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const backupId = sanitizeText(req.body?.backupId);
    if (!backupId) {
      return res.status(400).json({ erro: 'Backup nao informado' });
    }

    restoreBackup(backupId);
    io.emit('backup-restaurado', {
      backupId,
      restauradoPor: usuarioAdmin.nome,
      restauradoEm: new Date().toISOString()
    });

    res.json({ mensagem: 'Backup restaurado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-grupo', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const nome = sanitizeText(req.body?.nome);
    const descricao = sanitizeText(req.body?.descricao);
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (!nome) {
      return res.status(400).json({ erro: 'Nome do grupo é obrigatório' });
    }

    const novoGrupo = {
      id: Date.now(),
      nome,
      descricao,
      criado_em: new Date().toISOString()
    };

    db.grupos.push(novoGrupo);
    const membrosUnicos = Array.from(new Set([Number(req.userId), ...memberIds]));
    membrosUnicos.forEach((usuarioId) => {
      if (findActiveUserById(usuarioId)) {
        db.membros_grupo.push({
          id: Date.now() + usuarioId,
          grupo_id: novoGrupo.id,
          usuario_id: usuarioId
        });
      }
    });
    db.save();

    res.json({ id: novoGrupo.id, mensagem: 'Grupo criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/admin/grupos/:id/aviso', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const grupoId = Number(req.params.id);
    const grupo = db.grupos.find((item) => Number(item.id) === grupoId);
    if (!grupo) return res.status(404).json({ erro: 'Grupo nao encontrado' });

    const aviso = sanitizeText(req.body?.aviso).slice(0, 500);
    grupo.aviso_fixado = aviso;
    grupo.aviso_atualizado_em = aviso ? new Date().toISOString() : null;
    grupo.aviso_atualizado_por = aviso ? Number(req.userId) : null;
    db.save();

    io.to(`grupo-${grupoId}`).emit('grupo-aviso-atualizado', {
      grupoId,
      aviso,
      atualizadoEm: grupo.aviso_atualizado_em
    });

    res.json({ grupo });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/grupos', verificarToken, (req, res) => {
  try {
    res.json(
      listarGruposVisiveisParaUsuario(req.userId)
        .map((grupo) => ({
          ...grupo,
          ...getGroupConversationSummary(grupo.id, req.userId),
          restrito: grupoEhRestrito(grupo.id),
          membros: getMembrosDoGrupo(grupo.id)
        }))
        .sort((a, b) => compareByCreatedDesc(a, b))
    );
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/usuarios', verificarToken, (req, res) => {
  try {
    const usuarios = db.usuarios
      .filter((u) => u.ativo && u.id !== req.userId)
      .map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        online: isUsuarioOnline(u.id),
        senha_painel: String(u.senha_painel || '')
      }));

    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/plantao/escala', verificarToken, (_req, res) => {
  try {
    res.json(sanitizeEscalaPlantaoPayload());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/plantao/escreventes', verificarToken, (req, res) => {
  try {
    const nome = sanitizeText(req.body?.nome).slice(0, 80);
    if (!nome) return res.status(400).json({ erro: 'Informe o nome do escrevente' });

    const state = sanitizeEscalaPlantaoPayload();
    const exists = state.escreventes.some((item) => normalizeKey(item.nome) === normalizeKey(nome));
    if (exists) return res.status(409).json({ erro: 'Este escrevente ja esta cadastrado' });

    state.escreventes.push({ id: Date.now(), nome, ativo: true });
    saveEscalaPlantaoState(state);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/plantao/escreventes/:id', verificarToken, (req, res) => {
  try {
    const escreventeId = Number(req.params.id);
    const state = sanitizeEscalaPlantaoPayload();
    state.escreventes = state.escreventes.filter((item) => Number(item.id) !== escreventeId);
    state.ferias = state.ferias.filter((item) => Number(item.escreventeId) !== escreventeId);
    state.escalas = state.escalas.filter((item) => Number(item.escreventeId) !== escreventeId);
    saveEscalaPlantaoState(state);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/plantao/ferias', verificarToken, (req, res) => {
  try {
    const escreventeId = Number(req.body?.escreventeId);
    const inicio = parseDateOnly(req.body?.inicio);
    const fim = parseDateOnly(req.body?.fim);
    if (!escreventeId || !inicio || !fim || inicio > fim) {
      return res.status(400).json({ erro: 'Informe escrevente e periodo de ferias validos' });
    }

    const state = sanitizeEscalaPlantaoPayload();
    if (!state.escreventes.some((item) => Number(item.id) === escreventeId)) {
      return res.status(404).json({ erro: 'Escrevente nao encontrado' });
    }

    state.ferias.push({
      id: Date.now(),
      escreventeId,
      inicio: toDateOnly(inicio),
      fim: toDateOnly(fim)
    });
    saveEscalaPlantaoState(state);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/plantao/ferias/:id', verificarToken, (req, res) => {
  try {
    const feriasId = Number(req.params.id);
    const state = sanitizeEscalaPlantaoPayload();
    state.ferias = state.ferias.filter((item) => Number(item.id) !== feriasId);
    saveEscalaPlantaoState(state);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/plantao/gerar-escala', verificarToken, (req, res) => {
  try {
    const state = gerarEscalaPlantao(req.body?.inicio, req.body?.fim);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(err.statusCode || 500).json({ erro: err.message });
  }
});

app.post('/api/plantao/escala-periodo', verificarToken, (req, res) => {
  try {
    const state = cadastrarPlantaoPeriodo(req.body?.escreventeId, req.body?.inicio, req.body?.fim);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(err.statusCode || 500).json({ erro: err.message });
  }
});

app.delete('/api/plantao/escala', verificarToken, (_req, res) => {
  try {
    const state = sanitizeEscalaPlantaoPayload();
    state.escalas = [];
    saveEscalaPlantaoState(state);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/plantao/escala-periodo', verificarToken, (req, res) => {
  try {
    const state = excluirPlantaoPeriodo(req.body?.inicio, req.body?.fim);
    io.emit('plantao-escala-atualizada', state);
    res.json(state);
  } catch (err) {
    res.status(err.statusCode || 500).json({ erro: err.message });
  }
});

app.get('/api/painel-senhas', verificarToken, (_req, res) => {
  try {
    res.json({
      senhaAtual: String(db.painel_senhas?.senhaAtual || ''),
      observacao: String(db.painel_senhas?.observacao || ''),
      atualizadoPor: String(db.painel_senhas?.atualizadoPor || ''),
      atualizadoEm: db.painel_senhas?.atualizadoEm || null
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/painel-senhas', verificarToken, (req, res) => {
  try {
    const usuario = findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    const senhaAtual = sanitizeText(req.body?.senhaAtual);
    const observacao = sanitizeText(req.body?.observacao);

    db.painel_senhas = {
      senhaAtual,
      observacao,
      atualizadoPor: usuario.nome,
      atualizadoEm: new Date().toISOString()
    };

    db.save();
    io.emit('painel-senhas-atualizado', db.painel_senhas);
    res.json(db.painel_senhas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/grupo/:grupoId', verificarToken, (req, res) => {
  try {
    const grupoId = parseInt(req.params.grupoId, 10);
    if (!usuarioPodeAcessarGrupo(req.userId, grupoId)) {
      return res.status(403).json({ erro: 'Acesso negado a este grupo' });
    }

    marcarMensagensGrupoComoLidas(grupoId, req.userId);

    const mensagens = db.mensagens
      .filter((m) => m.grupo_id === grupoId)
      .map((m) => ensureGroupReadTracking(m))
      .map(enrichMessage);

    res.json(paginateMessages(mensagens, req));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/privadas/:usuarioId', verificarToken, (req, res) => {
  try {
    const outroUsuarioId = parseInt(req.params.usuarioId, 10);
    const alterouLeitura = marcarComoLidas(outroUsuarioId, req.userId);
    if (alterouLeitura) {
      io.to(`usuario-${outroUsuarioId}`).emit('mensagens-lidas', {
        remetenteId: Number(outroUsuarioId),
        destinatarioId: Number(req.userId)
      });
    }
    limparConversaPrivadaPendente(req.userId, outroUsuarioId);

    const mensagens = db.mensagens
      .filter(
        (m) =>
          (m.usuario_id === req.userId && m.usuario_destino_id === outroUsuarioId) ||
          (m.usuario_id === outroUsuarioId && m.usuario_destino_id === req.userId)
      )
      .map(enrichMessage);

    res.json(paginateMessages(mensagens, req));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/conversas/privadas/resumo', verificarToken, (req, res) => {
  try {
    const resumo = {};

    db.mensagens
      .filter((m) => !m.grupo_id && (m.usuario_id === req.userId || m.usuario_destino_id === req.userId))
      .forEach((m) => {
        const outroId = m.usuario_id === req.userId ? m.usuario_destino_id : m.usuario_id;
        if (!outroId) return;

        if (!resumo[outroId] || new Date(m.criado_em) > new Date(resumo[outroId].criado_em)) {
          resumo[outroId] = {
            usuarioId: outroId,
            ultimaMensagem: getMessagePreviewText(m),
            criado_em: m.criado_em,
            naoLidas: 0
          };
        }

        if (m.usuario_id === outroId && m.usuario_destino_id === req.userId && !m.lido) {
          resumo[outroId].naoLidas = (resumo[outroId].naoLidas || 0) + 1;
        }
      });

    db.conversas_pendentes
      .filter((item) => Number(item?.usuario_id) === Number(req.userId))
      .forEach((item) => {
        const outroId = Number(item.contato_id);
        if (!outroId) return;

        if (!resumo[outroId]) {
          resumo[outroId] = {
            usuarioId: outroId,
            ultimaMensagem: '',
            criado_em: item.atualizado_em || item.criado_em || new Date().toISOString(),
            naoLidas: 0
          };
        }

        resumo[outroId].pendenteManual = true;
        resumo[outroId].naoLidas = Math.max(Number(resumo[outroId].naoLidas) || 0, 1);
      });

    res.json(Object.values(resumo).sort((a, b) => compareByCreatedDesc(a, b)));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/workflow', verificarToken, (req, res) => {
  try {
    const statusAtendimento = {};
    Object.entries(db.status_atendimento || {}).forEach(([key, value]) => {
      const [tipo, id] = String(key).split('-');
      if (!isValidAttendanceStatus(value)) return;
      if (tipo === 'grupo') {
        if (!canUserAccessConversation(req.userId, tipo, id)) return;
        statusAtendimento[key] = value;
        return;
      }

      if (tipo === 'privado') {
        const ids = String(key).split('-').slice(1).map(Number).filter(Boolean);
        if (ids.length !== 2 || !ids.includes(Number(req.userId))) return;
        const otherId = ids.find((item) => Number(item) !== Number(req.userId));
        if (!otherId || !canUserAccessConversation(req.userId, 'privado', otherId)) return;
        statusAtendimento[getClientConversationKey('privado', otherId)] = value;
      }
    });

    const mensagensPrioritarias = db.mensagens_prioritarias
      .map((item) => Number(item?.message_id))
      .filter((messageId) => {
        const message = getMessageById(messageId);
        return canUserAccessMessage(req.userId, message);
      });

    res.json({
      statusAtendimento,
      mensagensPrioritarias,
      mensagensFixadas: getPinnedMessagesForUser(req.userId)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/conversas/:tipo/:id/status-atendimento', verificarToken, (req, res) => {
  try {
    const tipo = normalizeConversationType(req.params.tipo);
    const chatId = Number(req.params.id);
    const key = getStoredConversationKey(tipo, chatId, req.userId);
    const clientKey = getClientConversationKey(tipo, chatId);
    const status = String(req.body?.status || '').trim().toLowerCase();

    if (!key) return res.status(400).json({ erro: 'Conversa invalida' });
    if (!canUserAccessConversation(req.userId, tipo, chatId)) {
      return res.status(403).json({ erro: 'Acesso negado a esta conversa' });
    }

    if (status) {
      if (!isValidAttendanceStatus(status)) {
        return res.status(400).json({ erro: 'Status invalido' });
      }
      db.status_atendimento[key] = status;
    } else {
      delete db.status_atendimento[key];
    }

    db.save();

    const payload = {
      tipoChat: tipo,
      chatId,
      key: clientKey,
      status: db.status_atendimento[key] || '',
      usuarioId: Number(req.userId),
      atualizadoEm: new Date().toISOString()
    };

    emitConversationWorkflow(tipo, chatId, payload);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/busca-conversas', verificarToken, (req, res) => {
  try {
    const query = normalizeSearchText(req.query?.q);
    if (query.length < 2) {
      return res.json({ matches: [] });
    }

    const matches = new Set();

    db.mensagens.forEach((message) => {
      if (!canUserAccessMessage(req.userId, message)) return;

      const sender = db.usuarios.find((u) => Number(u.id) === Number(message.usuario_id));
      const content = [
        sender?.nome,
        message.conteudo,
        message.arquivo_nome_original,
        message.tipo === 'arquivo' ? 'arquivo anexo pdf imagem documento' : ''
      ].map(normalizeSearchText).join(' ');

      if (!content.includes(query)) return;

      if (message.grupo_id) {
        matches.add(`grupo-${Number(message.grupo_id)}`);
      } else {
        const otherId = Number(message.usuario_id) === Number(req.userId)
          ? Number(message.usuario_destino_id)
          : Number(message.usuario_id);
        if (otherId) matches.add(`privado-${otherId}`);
      }
    });

    res.json({ matches: Array.from(matches) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/busca-global', verificarToken, (req, res) => {
  try {
    const query = normalizeSearchText(req.query?.q);
    if (query.length < 2) return res.json({ resultados: [] });

    const resultados = db.mensagens
      .filter((message) => canUserAccessMessage(req.userId, message))
      .map(enrichMessage)
      .filter((message) => {
        const haystack = [
          message.usuario_nome,
          message.conteudo,
          message.arquivo_nome_original,
          message.reply_preview?.conteudo,
          message.reply_preview?.usuario_nome,
          message.tipo === 'arquivo' ? 'arquivo anexo pdf imagem documento' : ''
        ].map(normalizeSearchText).join(' ');
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .slice(0, 80)
      .map((message) => {
        const tipoChat = message.grupo_id ? 'grupo' : 'privado';
        const chatId = message.grupo_id
          ? Number(message.grupo_id)
          : (Number(message.usuario_id) === Number(req.userId) ? Number(message.usuario_destino_id) : Number(message.usuario_id));
        const grupo = message.grupo_id ? db.grupos.find((item) => Number(item.id) === Number(message.grupo_id)) : null;
        const contato = !message.grupo_id ? db.usuarios.find((item) => Number(item.id) === Number(chatId)) : null;
        return {
          id: message.id,
          tipoChat,
          chatId,
          chatNome: grupo?.nome || contato?.nome || 'Conversa',
          usuario_nome: message.usuario_nome,
          conteudo: message.tipo === 'arquivo' ? (message.arquivo_nome_original || 'Arquivo') : message.conteudo,
          tipo: message.tipo || 'texto',
          criado_em: message.criado_em
        };
      });

    res.json({ resultados });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/conversas/privadas/:usuarioId/marcar-nao-lida', verificarToken, (req, res) => {
  try {
    const outroUsuarioId = parseInt(req.params.usuarioId, 10);
    const messageId = Number(req.body?.messageId) || null;

    if (!outroUsuarioId || Number(outroUsuarioId) === Number(req.userId)) {
      return res.status(400).json({ erro: 'Conversa privada inválida' });
    }

    const outroUsuario = findActiveUserById(outroUsuarioId);
    if (!outroUsuario) {
      return res.status(404).json({ erro: 'Contato não encontrado' });
    }

    if (messageId) {
      const mensagem = getMessageById(messageId);
      if (!mensagem) return res.status(404).json({ erro: 'Mensagem não encontrada' });
      if (mensagem.grupo_id) return res.status(400).json({ erro: 'Ação disponível apenas em conversa privada' });
      if (!isSamePrivateConversation(mensagem, req.userId, outroUsuarioId)) {
        return res.status(403).json({ erro: 'Mensagem não pertence a esta conversa' });
      }
    }

    marcarConversaPrivadaComoPendente(req.userId, outroUsuarioId, messageId);
    res.json({
      mensagem: 'Conversa marcada como não lida',
      usuarioId: outroUsuarioId,
      naoLidas: 1,
      pendenteManual: true
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/mensagens/:id', verificarToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const index = db.mensagens.findIndex((m) => m.id === messageId);
    if (index === -1) return res.status(404).json({ erro: 'Mensagem não encontrada' });

    const mensagem = db.mensagens[index];
    if (Number(mensagem.usuario_id) !== Number(req.userId)) {
      return res.status(403).json({ erro: 'Você só pode apagar mensagens enviadas por você' });
    }

    db.mensagens_apagadas.push({
      ...mensagem,
      apagada_em: new Date().toISOString(),
      apagada_por: Number(req.userId)
    });
    db.mensagens.splice(index, 1);
    db.save();
    registrarAuditoria({ acao: 'apagada', usuarioId: req.userId, mensagemId: messageId, req });
    if (mensagem.tipo === 'arquivo') {
      removeFileIfExists(mensagem.arquivo_nome_salvo);
    }

    const payload = {
      messageId,
      tipoChat: mensagem.grupo_id ? 'grupo' : 'privado',
      grupoId: mensagem.grupo_id || null,
      remetenteId: Number(mensagem.usuario_id),
      destinatarioId: mensagem.usuario_destino_id || null
    };

    if (mensagem.grupo_id) {
      io.to(`grupo-${mensagem.grupo_id}`).emit('mensagem-excluida', payload);
    } else {
      io.to(`usuario-${mensagem.usuario_id}`).emit('mensagem-excluida', payload);
      if (mensagem.usuario_destino_id) {
        io.to(`usuario-${mensagem.usuario_destino_id}`).emit('mensagem-excluida', payload);
      }
    }

    res.json({ mensagem: 'Mensagem apagada com sucesso', ...payload });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/mensagens/:id', verificarToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const mensagem = getMessageById(messageId);
    if (!mensagem) return res.status(404).json({ erro: 'Mensagem n�o encontrada' });
    if (Number(mensagem.usuario_id) !== Number(req.userId)) {
      return res.status(403).json({ erro: 'Voc� s� pode editar mensagens enviadas por voc�' });
    }
    if (mensagem.tipo && mensagem.tipo !== 'texto') {
      return res.status(400).json({ erro: 'Somente mensagens de texto podem ser editadas' });
    }

    const conteudo = sanitizeText(req.body?.conteudo);
    if (!conteudo) return res.status(400).json({ erro: 'Digite uma mensagem para salvar' });

    mensagem.conteudo = conteudo;
    mensagem.editado_em = new Date().toISOString();
    db.save();

    emitMessageUpdated(mensagem, { acao: 'editada' });
    res.json({ mensagem: 'Mensagem editada com sucesso', message: enrichMessage(mensagem) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/mensagens/:id/reacoes', verificarToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const emoji = String(req.body?.emoji || '').trim();
    const mensagem = getMessageById(messageId);

    if (!mensagem) return res.status(404).json({ erro: 'Mensagem n�o encontrada' });
    if (!canUserAccessMessage(req.userId, mensagem)) {
      return res.status(403).json({ erro: 'Acesso negado a esta mensagem' });
    }
    if (!emoji || emoji.length > 8) {
      return res.status(400).json({ erro: 'Emoji inv�lido' });
    }

    if (!mensagem.reacoes || typeof mensagem.reacoes !== 'object') {
      mensagem.reacoes = {};
    }

    const atuais = Array.isArray(mensagem.reacoes[emoji])
      ? mensagem.reacoes[emoji].map(Number)
      : [];

    const jaTem = atuais.includes(Number(req.userId));
    mensagem.reacoes[emoji] = jaTem
      ? atuais.filter((id) => Number(id) !== Number(req.userId))
      : [...atuais, Number(req.userId)];

    if (!mensagem.reacoes[emoji].length) {
      delete mensagem.reacoes[emoji];
    }

    db.save();
    emitMessageUpdated(mensagem, { acao: 'reacao' });
    res.json({ mensagem: 'Rea��o atualizada com sucesso', message: enrichMessage(mensagem) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/mensagens/:id/prioridade', verificarToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const mensagem = getMessageById(messageId);
    if (!mensagem) return res.status(404).json({ erro: 'Mensagem nao encontrada' });
    if (!canUserAccessMessage(req.userId, mensagem)) {
      return res.status(403).json({ erro: 'Acesso negado a esta mensagem' });
    }

    const highlighted = Boolean(req.body?.highlighted);
    setPriorityMessage(messageId, req.userId, highlighted);
    db.save();
    emitMessagePriority(mensagem, highlighted, req.userId);

    res.json({
      messageId,
      highlighted,
      message: enrichMessage(mensagem)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/mensagens/:id/fixar', verificarToken, (req, res) => {
  try {
    const messageId = parseInt(req.params.id, 10);
    const mensagem = getMessageById(messageId);
    if (!mensagem) return res.status(404).json({ erro: 'Mensagem nao encontrada' });
    if (!canUserAccessMessage(req.userId, mensagem)) {
      return res.status(403).json({ erro: 'Acesso negado a esta mensagem' });
    }

    const pinned = Boolean(req.body?.pinned);
    const entry = setPinnedMessage(mensagem, req.userId, pinned);
    db.save();
    emitPinnedMessage(mensagem, pinned, req.userId);

    res.json({
      messageId,
      pinned,
      entry
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/upload', verificarToken, upload.single('arquivo'), (req, res) => {
  try {
    const tipoChat = sanitizeText(req.body?.tipoChat);
    const chatId = Number(req.body?.chatId);
    const replyToId = Number(req.body?.replyToId || 0);
    if (!req.file) return res.status(400).json({ erro: 'Arquivo n�o enviado' });
    if (!tipoChat || !chatId) return res.status(400).json({ erro: 'Destino do arquivo n�o informado' });

    if (!['grupo', 'privado'].includes(tipoChat)) {
      return res.status(400).json({ erro: 'Tipo de chat inválido' });
    }
    if (tipoChat === 'grupo' && !db.grupos.some((g) => g.id === chatId)) {
      return res.status(404).json({ erro: 'Grupo não encontrado' });
    }
    if (tipoChat === 'grupo' && !usuarioPodeAcessarGrupo(req.userId, chatId)) {
      return res.status(403).json({ erro: 'Acesso negado a este grupo' });
    }
    if (tipoChat === 'privado' && !findActiveUserById(chatId)) {
      return res.status(404).json({ erro: 'Usuário de destino não encontrado' });
    }
    if (!isValidReplyTarget({ replyToId, tipoChat, chatId, userId: req.userId })) {
      return res.status(400).json({ erro: 'Mensagem respondida inválida para esta conversa' });
    }

    const msg = {
      id: Date.now(),
      usuario_id: Number(req.userId),
      grupo_id: tipoChat === 'grupo' ? chatId : null,
      usuario_destino_id: tipoChat === 'privado' ? chatId : null,
      conteudo: '',
      tipo: 'arquivo',
      reply_to_id: replyToId || null,
      reacoes: {},
      arquivo_nome_original: req.file.originalname,
      arquivo_nome_salvo: req.file.filename,
      arquivo_url: `/uploads/${req.file.filename}`,
      arquivo_mimetype: req.file.mimetype,
      arquivo_tamanho: req.file.size,
      lido: 0,
      leituras_grupo: tipoChat === 'grupo' ? [] : null,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    const payload = {
      ...enrichMessage(msg),
      usuarioId: msg.usuario_id,
      usuarioNome: db.usuarios.find((u) => u.id === msg.usuario_id)?.nome || 'Desconhecido'
    };

    if (tipoChat === 'grupo') {
      payload.grupoId = chatId;
      io.to(`grupo-${chatId}`).emit('novo-arquivo-grupo', payload);
    } else {
      payload.remetente_id = Number(req.userId);
      payload.remetenteNome = payload.usuarioNome;
      io.to(`usuario-${chatId}`).emit('novo-arquivo-privado', payload);
      io.to(`usuario-${req.userId}`).emit('arquivo-enviado-confirmacao', {
        ...payload,
        destinatario_id: chatId,
        status: 'enviado'
      });
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ erro: 'Arquivo excede o limite de 15 MB' });
    }
  }
  if (err) return res.status(400).json({ erro: err.message || 'Erro ao processar arquivo' });
  return res.status(500).json({ erro: 'Erro interno' });
});

io.on('connection', (socket) => {
  socket.on('conectar-usuario', (usuarioId) => {
    const id = Number(usuarioId);
    socket.join(`usuario-${id}`);
    socketUsers.set(socket.id, id);

    if (!onlineUsers.has(id)) onlineUsers.set(id, new Set());
    onlineUsers.get(id).add(socket.id);
    emitPresence();
  });

  socket.on('entrar-grupo', (data) => {
    if (usuarioPodeAcessarGrupo(data.usuarioId, data.grupoId)) {
      socket.join(`grupo-${data.grupoId}`);
    }
  });

  socket.on('digitando', (data) => {
    const { tipo, chatId, usuarioId, usuarioNome } = data;
    const timeoutKey = `${socket.id}-${tipo}-${chatId}`;

    if (tipo === 'grupo' && !usuarioPodeAcessarGrupo(usuarioId, chatId)) {
      return;
    }

    clearTimeout(typingTimeouts.get(timeoutKey));

    if (tipo === 'grupo') {
      socket.to(`grupo-${chatId}`).emit('usuario-digitando', { tipo, chatId, usuarioId, usuarioNome });
    } else if (tipo === 'privado') {
      socket.to(`usuario-${chatId}`).emit('usuario-digitando', {
        tipo,
        chatId: usuarioId,
        usuarioId,
        usuarioNome
      });
    }

    const timeout = setTimeout(() => {
      if (tipo === 'grupo') {
        socket.to(`grupo-${chatId}`).emit('usuario-parou-digitacao', { tipo, chatId, usuarioId });
      } else if (tipo === 'privado') {
        socket.to(`usuario-${chatId}`).emit('usuario-parou-digitacao', {
          tipo,
          chatId: usuarioId,
          usuarioId
        });
      }
      typingTimeouts.delete(timeoutKey);
    }, 1200);

    typingTimeouts.set(timeoutKey, timeout);
  });

  socket.on('mensagem-grupo', (data) => {
    if (!usuarioPodeAcessarGrupo(data.usuarioId, data.grupoId)) {
      return;
    }
    if (!isValidReplyTarget({ replyToId: Number(data.replyToId || 0), tipoChat: 'grupo', chatId: data.grupoId, userId: data.usuarioId })) {
      return;
    }

    const msg = {
      id: Date.now(),
      usuario_id: Number(data.usuarioId),
      grupo_id: Number(data.grupoId),
      usuario_destino_id: null,
      conteudo: data.conteudo,
      tipo: 'texto',
      reply_to_id: Number(data.replyToId || 0) || null,
      reacoes: {},
      lido: 0,
      leituras_grupo: [],
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    registrarAuditoria({ acao: 'enviada', usuarioId: data.usuarioId, usuarioNome: data.usuarioNome, mensagemId: msg.id, detalhe: `grupo:${data.grupoId}` });

    const msgEnriquecida = { ...enrichMessage(msg), usuarioNome: data.usuarioNome, usuarioId: Number(data.usuarioId), grupoId: Number(data.grupoId) };
    io.to(`grupo-${data.grupoId}`).emit('nova-mensagem-grupo', msgEnriquecida);

    // Push para membros do grupo que estão offline
    const membrosGrupo = (db.membros_grupo || []).filter((m) => Number(m.grupo_id) === Number(data.grupoId) && Number(m.usuario_id) !== Number(data.usuarioId));
    membrosGrupo.forEach((m) => {
      if (!isUsuarioOnline(m.usuario_id)) {
        enviarPushParaUsuario(m.usuario_id, { title: data.usuarioNome || 'Nova mensagem', body: String(data.conteudo || '').slice(0, 80), tag: `grupo-${data.grupoId}` });
      }
    });
  });

  socket.on('mensagem-privada', (data) => {
    if (!isValidReplyTarget({ replyToId: Number(data.replyToId || 0), tipoChat: 'privado', chatId: data.destinatario_id, userId: data.remetente_id })) {
      return;
    }

    const msg = {
      id: Date.now(),
      usuario_id: Number(data.remetente_id),
      grupo_id: null,
      usuario_destino_id: Number(data.destinatario_id),
      conteudo: data.conteudo,
      tipo: 'texto',
      reply_to_id: Number(data.replyToId || 0) || null,
      reacoes: {},
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    registrarAuditoria({ acao: 'enviada', usuarioId: data.remetente_id, usuarioNome: data.remetenteNome, mensagemId: msg.id, detalhe: `privado:${data.destinatario_id}` });

    const payload = {
      ...enrichMessage(msg),
      remetenteNome: data.remetenteNome,
      remetente_id: Number(data.remetente_id)
    };

    io.to(`usuario-${data.destinatario_id}`).emit('nova-mensagem-privada', payload);

    io.to(`usuario-${data.remetente_id}`).emit('mensagem-enviada-confirmacao', {
      ...payload,
      client_temp_id: data.client_temp_id || null,
      destinatario_id: Number(data.destinatario_id),
      status: 'enviada'
    });

    // Push se destinatário offline
    if (!isUsuarioOnline(data.destinatario_id)) {
      enviarPushParaUsuario(data.destinatario_id, { title: data.remetenteNome || 'Nova mensagem', body: String(data.conteudo || '').slice(0, 80), tag: `privado-${data.remetente_id}` });
    }
  });

  socket.on('marcar-lidas', (data) => {
    const { remetenteId, destinatarioId } = data;
    const alterou = marcarComoLidas(remetenteId, destinatarioId);

    if (alterou) {
      io.to(`usuario-${remetenteId}`).emit('mensagens-lidas', {
        remetenteId: Number(remetenteId),
        destinatarioId: Number(destinatarioId)
      });
    }
  });

  socket.on('marcar-lidas-grupo', (data) => {
    const grupoId = Number(data?.grupoId);
    const usuarioId = Number(data?.usuarioId);
    if (!grupoId || !usuarioId) return;
    if (!usuarioPodeAcessarGrupo(usuarioId, grupoId)) return;
    marcarMensagensGrupoComoLidas(grupoId, usuarioId);
  });

  socket.on('disconnect', () => {
    const usuarioId = socketUsers.get(socket.id);
    if (usuarioId) {
      const set = onlineUsers.get(usuarioId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) onlineUsers.delete(usuarioId);
      }
    }
    socketUsers.delete(socket.id);
    emitPresence();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — VISUALIZADOR DE CONVERSAS
// ─────────────────────────────────────────────────────────────────────────────

// Lista todas as conversas (pares privados + grupos) com contagem
app.get('/api/admin/conversas', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });

  // Pares privados únicos
  const pares = new Map();
  getAdminConversationMessages().forEach((m) => {
    if (!m.usuario_destino_id) return;
    const ids = [Number(m.usuario_id), Number(m.usuario_destino_id)].sort((a, b) => a - b);
    const key = `${ids[0]}-${ids[1]}`;
    if (!pares.has(key)) {
      const u1 = db.usuarios.find((u) => u.id === ids[0]);
      const u2 = db.usuarios.find((u) => u.id === ids[1]);
      pares.set(key, { tipo: 'privado', usuario1_id: ids[0], usuario1_nome: u1?.nome || `#${ids[0]}`, usuario2_id: ids[1], usuario2_nome: u2?.nome || `#${ids[1]}`, total: 0, apagadas: 0, ultima_em: null });
    }
    const par = pares.get(key);
    par.total++;
    if (m.apagada) par.apagadas++;
    if (!par.ultima_em || m.criado_em > par.ultima_em) par.ultima_em = m.criado_em;
  });

  // Grupos
  const grupos = db.grupos.map((g) => {
    const msgs = getAdminConversationMessages().filter((m) => m.grupo_id === g.id);
    return { tipo: 'grupo', grupo_id: g.id, nome: g.nome, total: msgs.length, apagadas: msgs.filter((m) => m.apagada).length, ultima_em: msgs.length ? msgs[msgs.length - 1].criado_em : null };
  });

  const privados = Array.from(pares.values()).sort((a, b) => (b.ultima_em || '') > (a.ultima_em || '') ? 1 : -1);
  const gruposOrdenados = grupos.sort((a, b) => (b.ultima_em || '') > (a.ultima_em || '') ? 1 : -1);

  res.json({ privados, grupos: gruposOrdenados });
});

// Mensagens de uma conversa privada (admin bypass — sem marcar como lida)
app.get('/api/admin/conversas/privadas/:uid1/:uid2', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
  const uid1 = parseInt(req.params.uid1, 10);
  const uid2 = parseInt(req.params.uid2, 10);
  const { busca = '', pagina = 1, por_pagina = 100 } = req.query;
  let msgs = getAdminConversationMessages().filter(
    (m) => (m.usuario_id === uid1 && m.usuario_destino_id === uid2) ||
            (m.usuario_id === uid2 && m.usuario_destino_id === uid1)
  ).map(enrichAdminMessage);
  if (busca) {
    const q = String(busca).toLowerCase();
    msgs = msgs.filter((m) => String(m.conteudo || '').toLowerCase().includes(q));
  }
  const total = msgs.length;
  const offset = (parseInt(pagina, 10) - 1) * parseInt(por_pagina, 10);
  res.json({ mensagens: msgs.slice(offset, offset + parseInt(por_pagina, 10)), total, pagina: parseInt(pagina, 10) });
});

// Mensagens de um grupo (admin bypass)
app.get('/api/admin/conversas/grupo/:grupoId', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
  const grupoId = parseInt(req.params.grupoId, 10);
  const { busca = '', pagina = 1, por_pagina = 100 } = req.query;
  let msgs = getAdminConversationMessages().filter((m) => m.grupo_id === grupoId).map(enrichAdminMessage);
  if (busca) {
    const q = String(busca).toLowerCase();
    msgs = msgs.filter((m) => String(m.conteudo || '').toLowerCase().includes(q));
  }
  const total = msgs.length;
  const offset = (parseInt(pagina, 10) - 1) * parseInt(por_pagina, 10);
  res.json({ mensagens: msgs.slice(offset, offset + parseInt(por_pagina, 10)), total, pagina: parseInt(pagina, 10) });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORIA — helper
// ─────────────────────────────────────────────────────────────────────────────
function registrarAuditoria({ acao, usuarioId, usuarioNome, mensagemId, detalhe, req }) {
  try {
    const entry = {
      id: Date.now() + Math.random(),
      acao,
      usuario_id: usuarioId || null,
      usuario_nome: usuarioNome || null,
      mensagem_id: mensagemId || null,
      detalhe: detalhe || null,
      ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || null,
      em: new Date().toISOString()
    };
    db.auditoria.push(entry);
    // Limitar a 5000 registros para não crescer indefinidamente
    if (db.auditoria.length > 5000) db.auditoria = db.auditoria.slice(-5000);
    db.saveFile('auditoria.json', db.auditoria);
  } catch (_e) { /* nunca quebrar o fluxo */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES — CRUD
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/templates', verificarToken, (_req, res) => {
  res.json(db.templates || []);
});

app.post('/api/templates', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
  const { nome, texto } = req.body || {};
  if (!nome || !texto) return res.status(400).json({ erro: 'Nome e texto são obrigatórios' });
  const template = { id: Date.now(), nome: String(nome).trim(), texto: String(texto).trim(), criado_em: new Date().toISOString(), criado_por: req.userId };
  db.templates.push(template);
  db.saveFile('templates.json', db.templates);
  res.json(template);
});

app.delete('/api/templates/:id', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
  const id = Number(req.params.id);
  db.templates = db.templates.filter((t) => t.id !== id);
  db.saveFile('templates.json', db.templates);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDITORIA — endpoint admin
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/auditoria', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });
  const { acao, limite = 200 } = req.query;
  let registros = [...(db.auditoria || [])].reverse();
  if (acao) registros = registros.filter((r) => r.acao === acao);
  res.json(registros.slice(0, Number(limite)));
});

// ─────────────────────────────────────────────────────────────────────────────
// MÉTRICAS — endpoint admin
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/admin/metricas', verificarToken, (req, res) => {
  if (!isAdminUser(req.userId)) return res.status(403).json({ erro: 'Acesso negado' });

  const msgs = db.mensagens || [];
  const usuarios = db.usuarios || [];

  // Mensagens por dia (últimos 14 dias)
  const hoje = new Date();
  const porDia = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    porDia[key] = 0;
  }
  msgs.forEach((m) => {
    const key = (m.criado_em || '').slice(0, 10);
    if (porDia[key] !== undefined) porDia[key]++;
  });

  // Mensagens por usuário (top 10)
  const porUsuario = {};
  msgs.forEach((m) => {
    const uid = m.usuario_id;
    if (!uid) return;
    const u = usuarios.find((u) => u.id === Number(uid));
    const nome = u?.nome || `#${uid}`;
    porUsuario[nome] = (porUsuario[nome] || 0) + 1;
  });
  const topUsuarios = Object.entries(porUsuario)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nome, total]) => ({ nome, total }));

  // Horários de pico (por hora do dia)
  const porHora = Array(24).fill(0);
  msgs.forEach((m) => {
    if (m.criado_em) {
      const h = new Date(m.criado_em).getHours();
      porHora[h]++;
    }
  });

  // Totais
  const totalMsgs = msgs.length;
  const totalUrgentes = msgs.filter((m) => m.prioridade === 'urgente').length;
  const totalGrupo = msgs.filter((m) => m.tipo === 'grupo').length;
  const totalPrivado = msgs.filter((m) => m.tipo === 'privado').length;
  const totalApagadas = (db.mensagens_apagadas || []).length;

  res.json({ porDia, topUsuarios, porHora, totalMsgs, totalUrgentes, totalGrupo, totalPrivado, totalApagadas });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEB PUSH — subscribe / unsubscribe
// ─────────────────────────────────────────────────────────────────────────────
let webpush = null;
try {
  webpush = require('web-push');
  const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || '';
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@chatinterno.app';
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log('Web Push VAPID configurado.');
  } else {
    console.warn('Web Push: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não definidas. Push desativado.');
    webpush = null;
  }
} catch (_e) {
  console.warn('web-push não instalado — push notifications desativadas. Execute: npm install web-push');
  webpush = null;
}

app.get('/api/push/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  res.json({ key });
});

app.post('/api/push/subscribe', verificarToken, (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription?.endpoint) return res.status(400).json({ erro: 'Subscription inválida' });
  // Remover registros antigos do mesmo endpoint
  db.push_subscriptions = db.push_subscriptions.filter((s) => s.endpoint !== subscription.endpoint);
  db.push_subscriptions.push({ usuario_id: req.userId, endpoint: subscription.endpoint, keys: subscription.keys, criado_em: new Date().toISOString() });
  db.saveFile('push-subscriptions.json', db.push_subscriptions);
  res.json({ ok: true });
});

app.delete('/api/push/subscribe', verificarToken, (req, res) => {
  const { endpoint } = req.body || {};
  db.push_subscriptions = db.push_subscriptions.filter((s) => s.endpoint !== endpoint);
  db.saveFile('push-subscriptions.json', db.push_subscriptions);
  res.json({ ok: true });
});

async function enviarPushParaUsuario(usuarioId, payload) {
  if (!webpush) return;
  const subs = db.push_subscriptions.filter((s) => Number(s.usuario_id) === Number(usuarioId));
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expirada — remover
        db.push_subscriptions = db.push_subscriptions.filter((s) => s.endpoint !== sub.endpoint);
        db.saveFile('push-subscriptions.json', db.push_subscriptions);
      }
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Storage root: ${STORAGE_ROOT}`);
  console.log(`Arquivos de dados: ${DATA_DIR}`);
  console.log(`Arquivos enviados: ${UPLOAD_DIR}`);
  console.log(`Backups: ${BACKUP_DIR}`);
  console.log(`Backup automatico: ${db.backup_agendamento?.ativo ? `ativo as ${db.backup_agendamento.horario}` : 'desativado'}`);

  if (SECRET_KEY === DEFAULT_SECRET_KEY) {
    console.warn('AVISO: SECRET_KEY nao configurada. Configure uma SECRET_KEY no ambiente para producao.');
  }

  if (IS_EPHEMERAL_STORAGE) {
    console.warn('AVISO: storage efemero em uso. Configure STORAGE_ROOT ou RAILWAY_VOLUME_MOUNT_PATH com um volume persistente no Railway.');
  }
});

setInterval(() => {
  try {
    const metadata = runAutomaticBackupIfDue();
    if (metadata) {
      console.log(`Backup automatico criado: ${metadata.id}`);
    }
  } catch (err) {
    console.error('Erro ao executar backup automatico:', err);
  }
}, 30000);

pruneAutomaticBackups(AUTOMATIC_BACKUP_RETENTION);
