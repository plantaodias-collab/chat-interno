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

const SECRET_KEY = 'sua-chave-secreta-aqui-mude-isso';
const SEED_DATA_DIR = path.join(__dirname, 'data');
const STORAGE_ROOT = process.env.STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.RAILWAY_ENVIRONMENT ? path.join(os.tmpdir(), 'chatinterno') : __dirname);
const DATA_DIR = path.join(STORAGE_ROOT, 'data');
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(UPLOAD_DIR));

class SimpleDB {
  constructor() {
    this.usuarios = this.loadFile('usuarios.json', []);
    this.grupos = this.loadFile('grupos.json', []);
    this.membros_grupo = this.loadFile('membros.json', []);
    this.mensagens = this.loadFile('mensagens.json', []);
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
  }
}

const db = new SimpleDB();
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

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'arquivo', ext);
    const safeBase = sanitizeFileName(base);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
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
    ativo: usuario.ativo
  };
}

function isUsuarioOnline(usuarioId) {
  return onlineUsers.has(Number(usuarioId)) && onlineUsers.get(Number(usuarioId)).size > 0;
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
    online: Array.from(onlineUsers.keys())
  });
}

function enrichMessage(m) {
  return {
    ...m,
    usuario_nome: db.usuarios.find((u) => u.id === m.usuario_id)?.nome || 'Desconhecido'
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function findActiveUserById(userId) {
  return db.usuarios.find((u) => u.id === Number(userId) && u.ativo);
}

function getMembrosDoGrupo(grupoId) {
  return db.membros_grupo
    .filter((m) => Number(m.grupo_id) === Number(grupoId))
    .map((m) => Number(m.usuario_id));
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
        admin: usuario.admin
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

app.post('/api/admin/criar-usuario', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find((u) => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const email = normalizeEmail(req.body?.email);
    const nome = sanitizeText(req.body?.nome);
    const senha = String(req.body?.senha || 'Senha123!').trim() || 'Senha123!';
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

    res.json({ mensagem: 'Usu�rio criado com sucesso' });
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

app.get('/api/grupos', verificarToken, (req, res) => {
  try {
    res.json(
      listarGruposVisiveisParaUsuario(req.userId).map((grupo) => ({
        ...grupo,
        restrito: grupoEhRestrito(grupo.id),
        membros: getMembrosDoGrupo(grupo.id)
      }))
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
        online: isUsuarioOnline(u.id)
      }));

    res.json(usuarios);
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

    const mensagens = db.mensagens
      .filter((m) => m.grupo_id === grupoId)
      .map(enrichMessage);

    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/privadas/:usuarioId', verificarToken, (req, res) => {
  try {
    const outroUsuarioId = parseInt(req.params.usuarioId, 10);
    marcarComoLidas(outroUsuarioId, req.userId);

    const mensagens = db.mensagens
      .filter(
        (m) =>
          (m.usuario_id === req.userId && m.usuario_destino_id === outroUsuarioId) ||
          (m.usuario_id === outroUsuarioId && m.usuario_destino_id === req.userId)
      )
      .map(enrichMessage);

    res.json(mensagens);
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
            ultimaMensagem: m.tipo === 'arquivo' ? `Arquivo: ${m.arquivo_nome_original}` : m.conteudo,
            criado_em: m.criado_em,
            naoLidas: 0
          };
        }

        if (m.usuario_id === outroId && m.usuario_destino_id === req.userId && !m.lido) {
          resumo[outroId].naoLidas = (resumo[outroId].naoLidas || 0) + 1;
        }
      });

    res.json(Object.values(resumo));
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

    db.mensagens.splice(index, 1);
    db.save();
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

app.post('/api/upload', verificarToken, upload.single('arquivo'), (req, res) => {
  try {
    const tipoChat = sanitizeText(req.body?.tipoChat);
    const chatId = Number(req.body?.chatId);
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

    const msg = {
      id: Date.now(),
      usuario_id: Number(req.userId),
      grupo_id: tipoChat === 'grupo' ? chatId : null,
      usuario_destino_id: tipoChat === 'privado' ? chatId : null,
      conteudo: '',
      tipo: 'arquivo',
      arquivo_nome_original: req.file.originalname,
      arquivo_nome_salvo: req.file.filename,
      arquivo_url: `/uploads/${req.file.filename}`,
      arquivo_mimetype: req.file.mimetype,
      arquivo_tamanho: req.file.size,
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    const payload = {
      id: msg.id,
      tipo: 'arquivo',
      conteudo: '',
      arquivo_nome_original: msg.arquivo_nome_original,
      arquivo_url: msg.arquivo_url,
      arquivo_mimetype: msg.arquivo_mimetype,
      arquivo_tamanho: msg.arquivo_tamanho,
      criado_em: msg.criado_em,
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

    const msg = {
      id: Date.now(),
      usuario_id: Number(data.usuarioId),
      grupo_id: Number(data.grupoId),
      usuario_destino_id: null,
      conteudo: data.conteudo,
      tipo: 'texto',
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    io.to(`grupo-${data.grupoId}`).emit('nova-mensagem-grupo', {
      id: msg.id,
      conteudo: data.conteudo,
      usuarioNome: data.usuarioNome,
      usuarioId: Number(data.usuarioId),
      grupoId: Number(data.grupoId),
      criado_em: msg.criado_em,
      tipo: 'texto'
    });
  });

  socket.on('mensagem-privada', (data) => {
    const msg = {
      id: Date.now(),
      usuario_id: Number(data.remetente_id),
      grupo_id: null,
      usuario_destino_id: Number(data.destinatario_id),
      conteudo: data.conteudo,
      tipo: 'texto',
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    io.to(`usuario-${data.destinatario_id}`).emit('nova-mensagem-privada', {
      id: msg.id,
      conteudo: data.conteudo,
      remetenteNome: data.remetenteNome,
      remetente_id: Number(data.remetente_id),
      criado_em: msg.criado_em,
      lido: 0,
      tipo: 'texto'
    });

    io.to(`usuario-${data.remetente_id}`).emit('mensagem-enviada-confirmacao', {
      id: msg.id,
      destinatario_id: Number(data.destinatario_id),
      conteudo: data.conteudo,
      criado_em: msg.criado_em,
      status: 'enviada'
    });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Arquivos de dados: ${DATA_DIR}`);
  console.log(`Arquivos enviados: ${UPLOAD_DIR}`);
});

