const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const SECRET_KEY = 'seu-chave-secreta-aqui-mude-isso';
const DB_PATH = path.join(__dirname, 'chat.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('Erro ao conectar no banco:', err);
  else console.log('Banco de dados conectado');
});

const initDB = () => {
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        nome TEXT NOT NULL,
        admin INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) console.log('Tabela usuarios já existe');
      });

      db.run(`CREATE TABLE IF NOT EXISTS grupos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) console.log('Tabela grupos já existe');
      });

      db.run(`CREATE TABLE IF NOT EXISTS membros_grupo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,
        FOREIGN KEY(grupo_id) REFERENCES grupos(id),
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        UNIQUE(grupo_id, usuario_id)
      )`, (err) => {
        if (err) console.log('Tabela membros_grupo já existe');
      });

      db.run(`CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        grupo_id INTEGER,
        usuario_destino_id INTEGER,
        conteudo TEXT NOT NULL,
        lido INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(grupo_id) REFERENCES grupos(id),
        FOREIGN KEY(usuario_destino_id) REFERENCES usuarios(id)
      )`, (err) => {
        if (err) console.log('Tabela mensagens já existe');
        resolve();
      });
    });
  });
};

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const verificarToken = (req, res, next) => {
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
};

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const usuario = await getAsync('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email]);

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
    const usuarioAdmin = await getAsync('SELECT admin FROM usuarios WHERE id = ?', [req.userId]);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const { email, nome, senha = 'Senha123!' } = req.body;
    const senhaHash = await bcrypt.hash(senha, 10);

    await runAsync('INSERT INTO usuarios (email, nome, senha) VALUES (?, ?, ?)', [email, nome, senhaHash]);
    res.json({ mensagem: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/admin/usuarios', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await getAsync('SELECT admin FROM usuarios WHERE id = ?', [req.userId]);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const usuarios = await allAsync('SELECT id, email, nome, admin, ativo FROM usuarios');
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/admin/usuarios/:id', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await getAsync('SELECT admin FROM usuarios WHERE id = ?', [req.userId]);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    await runAsync('UPDATE usuarios SET ativo = 0 WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Usuário desativado' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/admin/criar-grupo', verificarToken, async (req, res) => {
  try {
    const usuarioAdmin = await getAsync('SELECT admin FROM usuarios WHERE id = ?', [req.userId]);
    if (!usuarioAdmin?.admin) return res.status(403).json({ erro: 'Acesso negado' });

    const { nome, descricao } = req.body;
    const result = await runAsync('INSERT INTO grupos (nome, descricao) VALUES (?, ?)', [nome, descricao]);
    res.json({ id: result.lastID, mensagem: 'Grupo criado com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/grupos', verificarToken, async (req, res) => {
  try {
    const grupos = await allAsync(`
      SELECT DISTINCT g.* FROM grupos g
      JOIN membros_grupo mg ON g.id = mg.grupo_id
      WHERE mg.usuario_id = ?
    `, [req.userId]);
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const usuarios = await allAsync('SELECT id, nome, email FROM usuarios WHERE ativo = 1 AND id != ?', [req.userId]);
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/grupo/:grupoId', verificarToken, async (req, res) => {
  try {
    const mensagens = await allAsync(`
      SELECT m.*, u.nome as usuario_nome FROM mensagens m
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.grupo_id = ?
      ORDER BY m.criado_em ASC
      LIMIT 100
    `, [req.params.grupoId]);
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/mensagens/privadas/:usuarioId', verificarToken, async (req, res) => {
  try {
    const mensagens = await allAsync(`
      SELECT m.*, u.nome as usuario_nome FROM mensagens m
      JOIN usuarios u ON m.usuario_id = u.id
      WHERE (m.usuario_id = ? AND m.usuario_destino_id = ?)
         OR (m.usuario_id = ? AND m.usuario_destino_id = ?)
      ORDER BY m.criado_em ASC
      LIMIT 100
    `, [req.userId, req.params.usuarioId, req.params.usuarioId, req.userId]);
    res.json(mensagens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Usuário conectado:', socket.id);

  socket.on('entrar-grupo', async (data) => {
    const { grupoId, usuarioId } = data;
    socket.join(`grupo-${grupoId}`);
  });

  socket.on('mensagem-grupo', async (data) => {
    try {
      const { grupoId, usuarioId, conteudo, usuarioNome } = data;
      await runAsync('INSERT INTO mensagens (usuario_id, grupo_id, conteudo) VALUES (?, ?, ?)',
        [usuarioId, grupoId, conteudo]);

      io.to(`grupo-${grupoId}`).emit('nova-mensagem-grupo', {
        conteudo,
        usuarioNome,
        usuarioId,
        grupoId,
        criado_em: new Date()
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  });

  socket.on('mensagem-privada', async (data) => {
    try {
      const { remetente_id, destinatario_id, conteudo, remetenteNome } = data;
      await runAsync('INSERT INTO mensagens (usuario_id, usuario_destino_id, conteudo) VALUES (?, ?, ?)',
        [remetente_id, destinatario_id, conteudo]);

      io.to(`usuario-${destinatario_id}`).emit('nova-mensagem-privada', {
        conteudo,
        remetenteNome,
        remetente_id,
        criado_em: new Date()
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem privada:', err);
    }
  });

  socket.on('notificar-usuario', (data) => {
    const { usuarioId, tipo, mensagem } = data;
    io.to(`usuario-${usuarioId}`).emit('notificacao', { tipo, mensagem });
  });

  socket.on('conectar-usuario', (usuarioId) => {
    socket.join(`usuario-${usuarioId}`);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
