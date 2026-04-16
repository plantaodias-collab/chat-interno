const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const SECRET_KEY = 'sua-chave-secreta-aqui-mude-isso';
const DATA_DIR = path.join(__dirname, 'data');

// Criar diretório de dados se não existir
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Simulação de banco de dados com arquivos JSON
class SimpleDB {
  constructor() {
    this.usuarios = this.loadFile('usuarios.json', []);
    this.grupos = this.loadFile('grupos.json', []);
    this.membros_grupo = this.loadFile('membros.json', []);
    this.mensagens = this.loadFile('mensagens.json', []);
  }

  loadFile(name, defaultValue) {
    const path = `${DATA_DIR}/${name}`;
    if (fs.existsSync(path)) {
      try {
        return JSON.parse(fs.readFileSync(path, 'utf8'));
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  saveFile(name, data) {
    const path = `${DATA_DIR}/${name}`;
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
  }

  save() {
    this.saveFile('usuarios.json', this.usuarios);
    this.saveFile('grupos.json', this.grupos);
    this.saveFile('membros.json', this.membros_grupo);
    this.saveFile('mensagens.json', this.mensagens);
  }
}

const db = new SimpleDB();

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuario = db.usuarios.find(u => u.email === email && u.ativo);

    if (!usuario) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });

    const token = jwt.sign({ id: usuario.id, email: usuario.email, admin: usuario.admin }, SECRET_KEY, { expiresIn: '30d' });
    res.json({ token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome, admin: usuario.admin } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-usuario', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find(u => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const { email, nome, senha = 'Senha123!' } = req.body;
    if (db.usuarios.find(u => u.email === email)) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
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

    res.json({ mensagem: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/usuarios', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find(u => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuarios = db.usuarios.map(u => ({
      id: u.id,
      email: u.email,
      nome: u.nome,
      admin: u.admin,
      ativo: u.ativo
    }));
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/admin/usuarios/:id', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find(u => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuario = db.usuarios.find(u => u.id === parseInt(req.params.id));
    if (usuario) {
      usuario.ativo = 0;
      db.save();
    }
    res.json({ mensagem: 'Usuário desativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-grupo', verificarToken, (req, res) => {
  try {
    const usuarioAdmin = db.usuarios.find(u => u.id === req.userId);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const { nome, descricao } = req.body;
    const novoGrupo = {
      id: Date.now(),
      nome,
      descricao,
      criado_em: new Date().toISOString()
    };

    db.grupos.push(novoGrupo);
    db.save();

    res.json({ id: novoGrupo.id, mensagem: 'Grupo criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/grupos', verificarToken, (req, res) => {
  try {
    const grupos = db.grupos;
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/usuarios', verificarToken, (req, res) => {
  try {
    const usuarios = db.usuarios
      .filter(u => u.ativo && u.id !== req.userId)
      .map(u => ({ id: u.id, nome: u.nome, email: u.email }));
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/grupo/:grupoId', verificarToken, (req, res) => {
  try {
    const mensagens = db.mensagens
      .filter(m => m.grupo_id === parseInt(req.params.grupoId))
      .map(m => ({
        ...m,
        usuario_nome: db.usuarios.find(u => u.id === m.usuario_id)?.nome || 'Desconhecido'
      }));
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/privadas/:usuarioId', verificarToken, (req, res) => {
  try {
    const mensagens = db.mensagens
      .filter(m =>
        (m.usuario_id === req.userId && m.usuario_destino_id === parseInt(req.params.usuarioId)) ||
        (m.usuario_id === parseInt(req.params.usuarioId) && m.usuario_destino_id === req.userId)
      )
      .map(m => ({
        ...m,
        usuario_nome: db.usuarios.find(u => u.id === m.usuario_id)?.nome || 'Desconhecido'
      }));
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
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
  } catch (err) {
    res.status(401).json({ erro: 'Token inválido' });
  }
}

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  socket.on('entrar-grupo', (data) => {
    socket.join(`grupo-${data.grupoId}`);
  });

  socket.on('mensagem-grupo', (data) => {
    const msg = {
      id: Date.now(),
      usuario_id: data.usuarioId,
      grupo_id: data.grupoId,
      usuario_destino_id: null,
      conteudo: data.conteudo,
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    io.to(`grupo-${data.grupoId}`).emit('nova-mensagem-grupo', {
      conteudo: data.conteudo,
      usuarioNome: data.usuarioNome,
      usuarioId: data.usuarioId,
      grupoId: data.grupoId,
      criado_em: msg.criado_em
    });
  });

  socket.on('mensagem-privada', (data) => {
    const msg = {
      id: Date.now(),
      usuario_id: data.remetente_id,
      grupo_id: null,
      usuario_destino_id: data.destinatario_id,
      conteudo: data.conteudo,
      lido: 0,
      criado_em: new Date().toISOString()
    };

    db.mensagens.push(msg);
    db.save();

    io.to(`usuario-${data.destinatario_id}`).emit('nova-mensagem-privada', {
      conteudo: data.conteudo,
      remetenteNome: data.remetenteNome,
      remetente_id: data.remetente_id,
      criado_em: msg.criado_em
    });
  });

  socket.on('conectar-usuario', (usuarioId) => {
    socket.join(`usuario-${usuarioId}`);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Arquivos de dados: ${DATA_DIR}`);
});
