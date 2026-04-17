const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
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
const DATA_DIR = path.join(__dirname, 'data');
const STORAGE_ROOT = process.env.STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.RAILWAY_ENVIRONMENT ? path.join(os.tmpdir(), 'chatinterno') : __dirname);
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const DB_PATH = process.env.DB_PATH || path.join(STORAGE_ROOT, 'chat.db');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/uploads', express.static(UPLOAD_DIR));

const db = new sqlite3.Database(DB_PATH);
const onlineUsers = new Map();
const socketUsers = new Map();
const typingTimeouts = new Map();

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function sanitizeFileName(name) {
  return String(name || 'arquivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
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

function parseJsonArray(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
    return [];
  } catch {
    return [];
  }
}

async function initDB() {
  await runAsync(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    senha TEXT NOT NULL,
    nome TEXT NOT NULL,
    admin INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    criado_em TEXT,
    atualizado_em TEXT
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS grupos (
    id INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    criado_em TEXT
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS membros_grupo (
    id INTEGER PRIMARY KEY,
    grupo_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    UNIQUE(grupo_id, usuario_id)
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS mensagens (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    grupo_id INTEGER,
    usuario_destino_id INTEGER,
    conteudo TEXT DEFAULT '',
    tipo TEXT DEFAULT 'texto',
    arquivo_nome_original TEXT,
    arquivo_nome_salvo TEXT,
    arquivo_url TEXT,
    arquivo_mimetype TEXT,
    arquivo_tamanho INTEGER,
    lido INTEGER DEFAULT 0,
    lido_em TEXT,
    criado_em TEXT
  )`);
}

async function migrateJsonDataIfNeeded() {
  const row = await getAsync('SELECT COUNT(*) as total FROM usuarios');
  if ((row?.total || 0) > 0) return;

  const usuarios = parseJsonArray('usuarios.json');
  const grupos = parseJsonArray('grupos.json');
  const membros = parseJsonArray('membros.json');
  const mensagens = parseJsonArray('mensagens.json');

  for (const usuario of usuarios) {
    await runAsync(
      `INSERT INTO usuarios (id, email, senha, nome, admin, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        Number(usuario.id),
        normalizeEmail(usuario.email),
        usuario.senha,
        usuario.nome,
        Number(usuario.admin || 0),
        Number(usuario.ativo ?? 1),
        usuario.criado_em || new Date().toISOString(),
        usuario.atualizado_em || null
      ]
    );
  }

  for (const grupo of grupos) {
    await runAsync(
      'INSERT INTO grupos (id, nome, descricao, criado_em) VALUES (?, ?, ?, ?)',
      [Number(grupo.id), grupo.nome, grupo.descricao || '', grupo.criado_em || new Date().toISOString()]
    );
  }

  for (const membro of membros) {
    await runAsync(
      'INSERT OR IGNORE INTO membros_grupo (id, grupo_id, usuario_id) VALUES (?, ?, ?)',
      [Number(membro.id || Date.now()), Number(membro.grupo_id), Number(membro.usuario_id)]
    );
  }

  for (const mensagem of mensagens) {
    await runAsync(
      `INSERT INTO mensagens (
        id, usuario_id, grupo_id, usuario_destino_id, conteudo, tipo,
        arquivo_nome_original, arquivo_nome_salvo, arquivo_url, arquivo_mimetype,
        arquivo_tamanho, lido, lido_em, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(mensagem.id),
        Number(mensagem.usuario_id),
        mensagem.grupo_id == null ? null : Number(mensagem.grupo_id),
        mensagem.usuario_destino_id == null ? null : Number(mensagem.usuario_destino_id),
        mensagem.conteudo || '',
        mensagem.tipo || 'texto',
        mensagem.arquivo_nome_original || null,
        mensagem.arquivo_nome_salvo || null,
        mensagem.arquivo_url || null,
        mensagem.arquivo_mimetype || null,
        mensagem.arquivo_tamanho == null ? null : Number(mensagem.arquivo_tamanho),
        Number(mensagem.lido || 0),
        mensagem.lido_em || null,
        mensagem.criado_em || new Date().toISOString()
      ]
    );
  }
}

async function findActiveUserById(userId) {
  return getAsync('SELECT * FROM usuarios WHERE id = ? AND ativo = 1', [Number(userId)]);
}

async function getMembrosDoGrupo(grupoId) {
  const rows = await allAsync('SELECT usuario_id FROM membros_grupo WHERE grupo_id = ?', [Number(grupoId)]);
  return rows.map((row) => Number(row.usuario_id));
}

async function grupoEhRestrito(grupoId) {
  const row = await getAsync('SELECT COUNT(*) as total FROM membros_grupo WHERE grupo_id = ?', [Number(grupoId)]);
  return (row?.total || 0) > 0;
}

async function usuarioPodeAcessarGrupo(userId, grupoId) {
  const row = await getAsync(
    `SELECT
       EXISTS(SELECT 1 FROM membros_grupo WHERE grupo_id = ?) as possui_membros,
       EXISTS(SELECT 1 FROM membros_grupo WHERE grupo_id = ? AND usuario_id = ?) as eh_membro`,
    [Number(grupoId), Number(grupoId), Number(userId)]
  );

  if (!row?.possui_membros) return true;
  return Boolean(row.eh_membro);
}

async function listarGruposVisiveisParaUsuario(userId) {
  return allAsync(
    `SELECT g.*
     FROM grupos g
     WHERE NOT EXISTS (SELECT 1 FROM membros_grupo mg WHERE mg.grupo_id = g.id)
        OR EXISTS (SELECT 1 FROM membros_grupo mg WHERE mg.grupo_id = g.id AND mg.usuario_id = ?)
     ORDER BY g.nome COLLATE NOCASE`,
    [Number(userId)]
  );
}

async function marcarComoLidas(remetenteId, destinatarioId) {
  const result = await runAsync(
    `UPDATE mensagens
     SET lido = 1, lido_em = ?
     WHERE usuario_id = ? AND usuario_destino_id = ? AND IFNULL(lido, 0) = 0`,
    [new Date().toISOString(), Number(remetenteId), Number(destinatarioId)]
  );
  return result.changes > 0;
}

function emitPresence() {
  io.emit('presenca-atualizada', {
    online: Array.from(onlineUsers.keys())
  });
}

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
      return cb(new Error('Tipo de arquivo não permitido'));
    }
    cb(null, true);
  }
});

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.id;
    req.userEmail = decoded.email;
    next();
  } catch (_err) {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

app.post('/api/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const senha = String(req.body?.senha || '');
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha' });
    }

    const usuario = await getAsync('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email]);
    if (!usuario) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, admin: usuario.admin },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({ token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, admin: usuario.admin } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/me', verificarToken, async (req, res) => {
  try {
    const usuario = await findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(getUsuarioPublico(usuario));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/me', verificarToken, async (req, res) => {
  try {
    const usuario = await findActiveUserById(req.userId);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const nome = sanitizeText(req.body?.nome);
    const email = normalizeEmail(req.body?.email);
    const senhaAtual = String(req.body?.senhaAtual || '');
    const novaSenha = String(req.body?.novaSenha || '').trim();

    if (!nome || !email) return res.status(400).json({ erro: 'Nome e email são obrigatórios' });
    if (!email.includes('@')) return res.status(400).json({ erro: 'Email inválido' });

    const emailEmUso = await getAsync('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, usuario.id]);
    if (emailEmUso) return res.status(400).json({ erro: 'Email já cadastrado por outro usuário' });

    let senhaHash = usuario.senha;
    if (novaSenha) {
      if (!senhaAtual) {
        return res.status(400).json({ erro: 'Informe a senha atual para definir uma nova senha' });
      }

      const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha);
      if (!senhaValida) return res.status(401).json({ erro: 'Senha atual inválida' });
      if (novaSenha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });

      senhaHash = await bcrypt.hash(novaSenha, 10);
    }

    await runAsync(
      'UPDATE usuarios SET nome = ?, email = ?, senha = ?, atualizado_em = ? WHERE id = ?',
      [nome, email, senhaHash, new Date().toISOString(), usuario.id]
    );

    const atualizado = await findActiveUserById(usuario.id);
    const token = jwt.sign(
      { id: atualizado.id, email: atualizado.email, admin: atualizado.admin },
      SECRET_KEY,
      { expiresIn: '30d' }
    );

    res.json({ mensagem: 'Ajustes salvos com sucesso', token, usuario: getUsuarioPublico(atualizado) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-usuario', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const email = normalizeEmail(req.body?.email);
    const nome = sanitizeText(req.body?.nome);
    const senha = String(req.body?.senha || 'Senha123!').trim() || 'Senha123!';
    if (!nome || !email) return res.status(400).json({ erro: 'Nome e email são obrigatórios' });
    if (!email.includes('@')) return res.status(400).json({ erro: 'Email inválido' });

    const existe = await getAsync('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });

    const senhaHash = await bcrypt.hash(senha, 10);
    await runAsync(
      'INSERT INTO usuarios (email, nome, senha, admin, ativo, criado_em) VALUES (?, ?, ?, 0, 1, ?)',
      [email, nome, senhaHash, new Date().toISOString()]
    );

    res.json({ mensagem: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/usuarios', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuarios = await allAsync('SELECT id, email, nome, admin, ativo FROM usuarios ORDER BY nome COLLATE NOCASE');
    res.json(usuarios.map((usuario) => ({ ...usuario, online: isUsuarioOnline(usuario.id) })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/admin/usuarios/:id', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    await runAsync('UPDATE usuarios SET ativo = 0 WHERE id = ?', [Number(req.params.id)]);
    res.json({ mensagem: 'Usuário desativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/admin/usuarios/:id/senha', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = await findActiveUserById(req.params.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    const novaSenha = String(req.body?.novaSenha || '').trim();
    if (novaSenha.length < 6) return res.status(400).json({ erro: 'A nova senha deve ter pelo menos 6 caracteres' });

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await runAsync('UPDATE usuarios SET senha = ?, atualizado_em = ? WHERE id = ?', [senhaHash, new Date().toISOString(), usuario.id]);
    res.json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-grupo', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await findActiveUserById(req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const nome = sanitizeText(req.body?.nome);
    const descricao = sanitizeText(req.body?.descricao);
    const memberIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    if (!nome) return res.status(400).json({ erro: 'Nome do grupo é obrigatório' });

    const result = await runAsync(
      'INSERT INTO grupos (nome, descricao, criado_em) VALUES (?, ?, ?)',
      [nome, descricao, new Date().toISOString()]
    );

    const grupoId = result.lastID;
    const membrosUnicos = Array.from(new Set([Number(req.userId), ...memberIds]));
    for (const usuarioId of membrosUnicos) {
      const usuario = await findActiveUserById(usuarioId);
      if (usuario) {
        await runAsync('INSERT OR IGNORE INTO membros_grupo (grupo_id, usuario_id) VALUES (?, ?)', [grupoId, usuarioId]);
      }
    }

    res.json({ id: grupoId, mensagem: 'Grupo criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/grupos', verificarToken, async (req, res) => {
  try {
    const grupos = await listarGruposVisiveisParaUsuario(req.userId);
    const gruposComMembros = [];

    for (const grupo of grupos) {
      gruposComMembros.push({
        ...grupo,
        restrito: await grupoEhRestrito(grupo.id),
        membros: await getMembrosDoGrupo(grupo.id)
      });
    }

    res.json(gruposComMembros);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const usuarios = await allAsync('SELECT id, nome, email FROM usuarios WHERE ativo = 1 AND id != ? ORDER BY nome COLLATE NOCASE', [Number(req.userId)]);
    res.json(usuarios.map((usuario) => ({ ...usuario, online: isUsuarioOnline(usuario.id) })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/grupo/:grupoId', verificarToken, async (req, res) => {
  try {
    const grupoId = Number(req.params.grupoId);
    if (!await usuarioPodeAcessarGrupo(req.userId, grupoId)) {
      return res.status(403).json({ erro: 'Acesso negado a este grupo' });
    }

    const mensagens = await allAsync(
      `SELECT m.*, u.nome as usuario_nome
       FROM mensagens m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.grupo_id = ?
       ORDER BY datetime(m.criado_em) ASC, m.id ASC`,
      [grupoId]
    );
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/privadas/:usuarioId', verificarToken, async (req, res) => {
  try {
    const outroUsuarioId = Number(req.params.usuarioId);
    await marcarComoLidas(outroUsuarioId, req.userId);

    const mensagens = await allAsync(
      `SELECT m.*, u.nome as usuario_nome
       FROM mensagens m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE (m.usuario_id = ? AND m.usuario_destino_id = ?)
          OR (m.usuario_id = ? AND m.usuario_destino_id = ?)
       ORDER BY datetime(m.criado_em) ASC, m.id ASC`,
      [Number(req.userId), outroUsuarioId, outroUsuarioId, Number(req.userId)]
    );
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/conversas/privadas/resumo', verificarToken, async (req, res) => {
  try {
    const mensagens = await allAsync(
      `SELECT * FROM mensagens
       WHERE grupo_id IS NULL AND (usuario_id = ? OR usuario_destino_id = ?)
       ORDER BY datetime(criado_em) DESC, id DESC`,
      [Number(req.userId), Number(req.userId)]
    );

    const resumo = {};
    mensagens.forEach((m) => {
      const outroId = Number(m.usuario_id) === Number(req.userId) ? Number(m.usuario_destino_id) : Number(m.usuario_id);
      if (!outroId) return;

      if (!resumo[outroId]) {
        resumo[outroId] = {
          usuarioId: outroId,
          ultimaMensagem: m.tipo === 'arquivo' ? `Arquivo: ${m.arquivo_nome_original}` : m.conteudo,
          criado_em: m.criado_em,
          naoLidas: 0
        };
      }

      if (Number(m.usuario_id) === outroId && Number(m.usuario_destino_id) === Number(req.userId) && !m.lido) {
        resumo[outroId].naoLidas += 1;
      }
    });

    res.json(Object.values(resumo));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/mensagens/:id', verificarToken, async (req, res) => {
  try {
    const messageId = Number(req.params.id);
    const mensagem = await getAsync('SELECT * FROM mensagens WHERE id = ?', [messageId]);
    if (!mensagem) return res.status(404).json({ erro: 'Mensagem não encontrada' });
    if (Number(mensagem.usuario_id) !== Number(req.userId)) {
      return res.status(403).json({ erro: 'Você só pode apagar mensagens enviadas por você' });
    }

    await runAsync('DELETE FROM mensagens WHERE id = ?', [messageId]);
    if (mensagem.tipo === 'arquivo') removeFileIfExists(mensagem.arquivo_nome_salvo);

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

app.post('/api/upload', verificarToken, upload.single('arquivo'), async (req, res) => {
  try {
    const tipoChat = sanitizeText(req.body?.tipoChat);
    const chatId = Number(req.body?.chatId);
    if (!req.file) return res.status(400).json({ erro: 'Arquivo não enviado' });
    if (!tipoChat || !chatId) return res.status(400).json({ erro: 'Destino do arquivo não informado' });
    if (!['grupo', 'privado'].includes(tipoChat)) return res.status(400).json({ erro: 'Tipo de chat inválido' });

    if (tipoChat === 'grupo') {
      const grupo = await getAsync('SELECT id FROM grupos WHERE id = ?', [chatId]);
      if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado' });
      if (!await usuarioPodeAcessarGrupo(req.userId, chatId)) {
        return res.status(403).json({ erro: 'Acesso negado a este grupo' });
      }
    }

    if (tipoChat === 'privado' && !await findActiveUserById(chatId)) {
      return res.status(404).json({ erro: 'Usuário de destino não encontrado' });
    }

    const criadoEm = new Date().toISOString();
    const result = await runAsync(
      `INSERT INTO mensagens (
        usuario_id, grupo_id, usuario_destino_id, conteudo, tipo,
        arquivo_nome_original, arquivo_nome_salvo, arquivo_url,
        arquivo_mimetype, arquivo_tamanho, lido, criado_em
      ) VALUES (?, ?, ?, '', 'arquivo', ?, ?, ?, ?, ?, 0, ?)`,
      [
        Number(req.userId),
        tipoChat === 'grupo' ? chatId : null,
        tipoChat === 'privado' ? chatId : null,
        req.file.originalname,
        req.file.filename,
        `/uploads/${req.file.filename}`,
        req.file.mimetype,
        req.file.size,
        criadoEm
      ]
    );

    const usuario = await findActiveUserById(req.userId);
    const payload = {
      id: result.lastID,
      tipo: 'arquivo',
      conteudo: '',
      arquivo_nome_original: req.file.originalname,
      arquivo_url: `/uploads/${req.file.filename}`,
      arquivo_mimetype: req.file.mimetype,
      arquivo_tamanho: req.file.size,
      criado_em: criadoEm,
      usuarioId: Number(req.userId),
      usuarioNome: usuario?.nome || 'Desconhecido'
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
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ erro: 'Arquivo excede o limite de 15 MB' });
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

  socket.on('entrar-grupo', async (data) => {
    if (await usuarioPodeAcessarGrupo(data.usuarioId, data.grupoId)) {
      socket.join(`grupo-${data.grupoId}`);
    }
  });

  socket.on('digitando', async (data) => {
    const { tipo, chatId, usuarioId, usuarioNome } = data;
    const timeoutKey = `${socket.id}-${tipo}-${chatId}`;

    if (tipo === 'grupo' && !await usuarioPodeAcessarGrupo(usuarioId, chatId)) {
      return;
    }

    clearTimeout(typingTimeouts.get(timeoutKey));

    if (tipo === 'grupo') {
      socket.to(`grupo-${chatId}`).emit('usuario-digitando', { tipo, chatId, usuarioId, usuarioNome });
    } else if (tipo === 'privado') {
      socket.to(`usuario-${chatId}`).emit('usuario-digitando', { tipo, chatId: usuarioId, usuarioId, usuarioNome });
    }

    const timeout = setTimeout(() => {
      if (tipo === 'grupo') {
        socket.to(`grupo-${chatId}`).emit('usuario-parou-digitacao', { tipo, chatId, usuarioId });
      } else if (tipo === 'privado') {
        socket.to(`usuario-${chatId}`).emit('usuario-parou-digitacao', { tipo, chatId: usuarioId, usuarioId });
      }
      typingTimeouts.delete(timeoutKey);
    }, 1200);

    typingTimeouts.set(timeoutKey, timeout);
  });

  socket.on('mensagem-grupo', async (data) => {
    try {
      if (!await usuarioPodeAcessarGrupo(data.usuarioId, data.grupoId)) return;

      const criadoEm = new Date().toISOString();
      const result = await runAsync(
        'INSERT INTO mensagens (usuario_id, grupo_id, conteudo, tipo, lido, criado_em) VALUES (?, ?, ?, ?, 0, ?)',
        [Number(data.usuarioId), Number(data.grupoId), data.conteudo, 'texto', criadoEm]
      );

      io.to(`grupo-${data.grupoId}`).emit('nova-mensagem-grupo', {
        id: result.lastID,
        conteudo: data.conteudo,
        usuarioNome: data.usuarioNome,
        usuarioId: Number(data.usuarioId),
        grupoId: Number(data.grupoId),
        criado_em: criadoEm,
        tipo: 'texto'
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem de grupo:', err);
    }
  });

  socket.on('mensagem-privada', async (data) => {
    try {
      const criadoEm = new Date().toISOString();
      const result = await runAsync(
        'INSERT INTO mensagens (usuario_id, usuario_destino_id, conteudo, tipo, lido, criado_em) VALUES (?, ?, ?, ?, 0, ?)',
        [Number(data.remetente_id), Number(data.destinatario_id), data.conteudo, 'texto', criadoEm]
      );

      io.to(`usuario-${data.destinatario_id}`).emit('nova-mensagem-privada', {
        id: result.lastID,
        conteudo: data.conteudo,
        remetenteNome: data.remetenteNome,
        remetente_id: Number(data.remetente_id),
        criado_em: criadoEm,
        lido: 0,
        tipo: 'texto'
      });

      io.to(`usuario-${data.remetente_id}`).emit('mensagem-enviada-confirmacao', {
        id: result.lastID,
        destinatario_id: Number(data.destinatario_id),
        conteudo: data.conteudo,
        criado_em: criadoEm,
        status: 'enviada'
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem privada:', err);
    }
  });

  socket.on('marcar-lidas', async (data) => {
    const alterou = await marcarComoLidas(data.remetenteId, data.destinatarioId);
    if (alterou) {
      io.to(`usuario-${data.remetenteId}`).emit('mensagens-lidas', {
        remetenteId: Number(data.remetenteId),
        destinatarioId: Number(data.destinatarioId)
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

(async () => {
  try {
    await initDB();
    await migrateJsonDataIfNeeded();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
      console.log(`Banco de dados: ${DB_PATH}`);
      console.log(`Arquivos enviados: ${UPLOAD_DIR}`);
    });
  } catch (err) {
    console.error('Erro ao iniciar servidor:', err);
    process.exit(1);
  }
})();



