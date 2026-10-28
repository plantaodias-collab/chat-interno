const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Servidor encerrou com código ${child.exitCode}`);
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch (_error) { /* Ainda inicializando. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Servidor de teste não iniciou');
}

async function connectSocket(base, userId, secret) {
  const token = jwt.sign({ id: userId, auth_version: 0 }, secret, { expiresIn: '5m' });
  const socket = new WebSocket(`${base.replace(/^http/, 'ws')}/socket.io/?EIO=4&transport=websocket`);
  const packets = [];
  const waiters = [];
  socket.addEventListener('message', (event) => {
    const packet = String(event.data);
    if (packet === '2') { socket.send('3'); return; }
    const match = waiters.find((item) => item.predicate(packet));
    if (match) {
      waiters.splice(waiters.indexOf(match), 1);
      clearTimeout(match.timer);
      match.resolve(packet);
    } else packets.push(packet);
  });
  const wait = (predicate, timeoutMs = 3000) => {
    const queuedIndex = packets.findIndex(predicate);
    if (queuedIndex >= 0) return Promise.resolve(packets.splice(queuedIndex, 1)[0]);
    return new Promise((resolve, reject) => {
      const item = { predicate, resolve, timer: null };
      item.timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(item), 1);
        reject(new Error(`Socket.IO não recebeu pacote esperado: ${JSON.stringify(packets.slice(-5))}`));
      }, timeoutMs);
      waiters.push(item);
    });
  };
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await wait((packet) => packet.startsWith('0{'));
  socket.send(`40${JSON.stringify({ token })}`);
  await wait((packet) => packet.startsWith('40{'));
  socket.send('42["conectar-usuario"]');
  await wait((packet) => packet.startsWith('42["presenca-atualizada"'));
  return { socket, wait, emit: (name, payload) => socket.send(`42${JSON.stringify([name, payload])}`) };
}

test('canais, threads, arquivos, busca e silêncio respeitam acesso real', async (t) => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-remodel-'));
  const dataDir = path.join(storage, 'data');
  const uploadDir = path.join(storage, 'uploads');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(uploadDir);
  const write = (name, value) => fs.writeFileSync(path.join(dataDir, name), JSON.stringify(value));
  const users = [
    { id: 1, nome: 'Admin', email: 'admin@example.test', ativo: 1, admin: 1, auth_version: 0 },
    { id: 2, nome: 'Membro', email: 'membro@example.test', ativo: 1, admin: 0, auth_version: 0 },
    { id: 3, nome: 'Visitante', email: 'visitante@example.test', ativo: 1, admin: 0, auth_version: 0 }
  ];
  write('usuarios.json', users);
  write('grupos.json', [
    { id: 100, nome: 'Geral', descricao: 'Canal público', tipo: 'canal', visibilidade: 'publico' },
    { id: 101, nome: 'Reservado', descricao: 'Canal privado', tipo: 'canal', visibilidade: 'privado' }
  ]);
  write('membros.json', [{ id: 1, grupo_id: 101, usuario_id: 1 }, { id: 2, grupo_id: 101, usuario_id: 2 }]);
  const created = new Date().toISOString();
  write('mensagens.json', [
    { id: 1000, usuario_id: 1, grupo_id: 100, conteudo: 'Aviso público', tipo: 'texto', criado_em: created, reacoes: {}, leituras_grupo: [] },
    { id: 1001, usuario_id: 1, grupo_id: 101, conteudo: 'Segredo interno', tipo: 'texto', criado_em: created, reacoes: {}, leituras_grupo: [] },
    { id: 1002, usuario_id: 2, grupo_id: 101, conteudo: 'Resposta interna', tipo: 'texto', reply_to_id: 1001, criado_em: created, reacoes: {}, leituras_grupo: [] },
    { id: 1003, usuario_id: 2, grupo_id: 101, conteudo: '', tipo: 'arquivo', arquivo_nome_original: 'documento.pdf', arquivo_nome_salvo: 'documento.pdf', arquivo_url: '/api/uploads/documento.pdf', arquivo_tamanho: 12, criado_em: created, reacoes: {}, leituras_grupo: [] }
  ]);
  fs.writeFileSync(path.join(uploadDir, 'documento.pdf'), '%PDF-1.4\n');

  const secret = crypto.randomBytes(48).toString('base64url');
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server-simple.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STORAGE_ROOT: storage, SECRET_KEY: secret, CHAT_INTERNO_AI_EVAL: 'false' },
    stdio: 'ignore'
  });
  t.after(async () => {
    child.kill();
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    fs.rmSync(storage, { recursive: true, force: true });
  });
  await waitForServer(base, child);

  const request = async (userId, endpoint, options = {}) => {
    const token = jwt.sign({ id: userId, auth_version: 0 }, secret, { expiresIn: '5m' });
    const response = await fetch(`${base}${endpoint}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
    const body = await response.json();
    return { status: response.status, body };
  };

  const visible = await request(3, '/api/grupos');
  assert.equal(visible.status, 200);
  assert.ok(visible.body.some((group) => group.id === 100 && group.tipo === 'canal'));
  assert.ok(!visible.body.some((group) => group.id === 101));
  assert.equal((await request(3, '/api/mensagens/grupo/101')).status, 403);
  assert.equal((await request(3, '/api/mensagens/1001/thread')).status, 404);
  assert.equal((await request(3, '/api/conversas/grupo/101/arquivos')).status, 403);
  assert.equal((await request(3, '/api/admin/grupos')).status, 403);

  const thread = await request(2, '/api/mensagens/1001/thread');
  assert.equal(thread.status, 200);
  assert.deepEqual(thread.body.replies.map((reply) => reply.id), [1002]);
  const files = await request(2, '/api/conversas/grupo/101/arquivos');
  assert.equal(files.status, 200);
  assert.equal(files.body.arquivos[0].nome, 'documento.pdf');
  const found = await request(2, '/api/busca-global?q=interno&senderId=1');
  assert.deepEqual(found.body.resultados.map((item) => item.id), [1001]);
  const hiddenSearch = await request(3, '/api/busca-global?q=interno');
  assert.equal(hiddenSearch.body.resultados.length, 0);
  const fileSearch = await request(2, '/api/busca-global?q=&filesOnly=true');
  assert.ok(fileSearch.body.resultados.some((item) => item.id === 1003));
  const uploadBody = () => {
    const body = new FormData();
    body.append('tipoChat', 'grupo');
    body.append('chatId', '101');
    body.append('arquivo', new Blob(['%PDF-1.4\nTeste'], { type: 'application/pdf' }), 'novo.pdf');
    return body;
  };
  const unauthorizedUpload = await request(3, '/api/upload', { method: 'POST', body: uploadBody() });
  assert.equal(unauthorizedUpload.status, 403);
  assert.deepEqual(fs.readdirSync(uploadDir).filter((name) => fs.statSync(path.join(uploadDir, name)).isFile()), ['documento.pdf']);
  const authorizedUpload = await request(2, '/api/upload', { method: 'POST', body: uploadBody() });
  assert.equal(authorizedUpload.status, 200);
  assert.equal(authorizedUpload.body.arquivo_nome_original, 'novo.pdf');
  const protectedFile = authorizedUpload.body.arquivo_nome_salvo;
  assert.ok(fs.existsSync(path.join(uploadDir, protectedFile)));
  const memberToken = jwt.sign({ id: 2, auth_version: 0 }, secret, { expiresIn: '5m' });
  const downloaded = await fetch(`${base}/api/uploads/${encodeURIComponent(protectedFile)}`, { headers: { Authorization: `Bearer ${memberToken}` } });
  assert.equal(downloaded.status, 200);
  assert.match(await downloaded.text(), /%PDF-1\.4/);
  assert.equal((await request(3, `/api/uploads/${encodeURIComponent(protectedFile)}`)).status, 404);

  const clients = await Promise.all([1, 2, 3].map((id) => connectSocket(base, id, secret)));
  t.after(() => clients.forEach((client) => client.socket.close()));
  clients[0].emit('mensagem-grupo', { grupoId: 101, conteudo: 'Fluxo reservado' });
  const privateGroupPacket = await clients[1].wait((packet) => packet.startsWith('42["nova-mensagem-grupo"'));
  assert.equal(JSON.parse(privateGroupPacket.slice(2))[1].grupoId, 101);
  clients[0].emit('mensagem-grupo', { grupoId: 100, conteudo: 'Fluxo público' });
  const publicPacket = await clients[2].wait((packet) => packet.startsWith('42["nova-mensagem-grupo"'));
  assert.equal(JSON.parse(publicPacket.slice(2))[1].grupoId, 100);
  await clients[1].wait((packet) => packet.startsWith('42["nova-mensagem-grupo"'));
  clients[0].emit('mensagem-privada', { destinatario_id: 2, conteudo: 'Mensagem direta' });
  const directPacket = await clients[1].wait((packet) => packet.startsWith('42["nova-mensagem-privada"'));
  assert.equal(JSON.parse(directPacket.slice(2))[1].conteudo, 'Mensagem direta');
  let persisted = false;
  for (let attempt = 0; attempt < 80 && !persisted; attempt += 1) {
    persisted = JSON.parse(fs.readFileSync(path.join(dataDir, 'mensagens.json'), 'utf8')).some((message) => message.conteudo === 'Mensagem direta');
    if (!persisted) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(persisted, 'A mensagem privada deve ser gravada no volume');

  const mute = await request(2, '/api/conversas/grupo/101/silenciar', { method: 'PUT', body: JSON.stringify({ silenciado: true }) });
  assert.equal(mute.status, 200);
  assert.equal(mute.body.silenciado, true);
  assert.deepEqual((await request(2, '/api/conversas/silenciadas')).body.conversas, ['grupo-101']);

  const edited = await request(1, '/api/admin/grupos/101', {
    method: 'PUT', body: JSON.stringify({ nome: 'Reservado', descricao: 'Atualizado', visibilidade: 'privado', memberIds: [1] })
  });
  assert.equal(edited.status, 200);
  assert.equal((await request(2, '/api/mensagens/grupo/101')).status, 403);
  assert.equal((await request(2, '/api/mensagens/1001/thread')).status, 404);
  assert.equal((await request(2, '/api/conversas/grupo/101/arquivos')).status, 403);
  clients[0].emit('mensagem-grupo', { grupoId: 101, conteudo: 'Após revogação' });
  clients[0].emit('mensagem-grupo', { grupoId: 100, conteudo: 'Após revogação pública' });
  const afterRevokePacket = await clients[1].wait((packet) => packet.startsWith('42["nova-mensagem-grupo"'));
  assert.equal(JSON.parse(afterRevokePacket.slice(2))[1].grupoId, 100);
  const createdPublic = await request(1, '/api/admin/criar-grupo', {
    method: 'POST', body: JSON.stringify({ nome: 'Operação', descricao: 'Avisos da equipe', tipo: 'canal', visibilidade: 'publico', memberIds: [] })
  });
  assert.equal(createdPublic.status, 200);
  assert.ok((await request(3, '/api/grupos')).body.some((group) => group.id === createdPublic.body.id && group.visibilidade === 'publico'));
  const createdPrivate = await request(1, '/api/admin/criar-grupo', {
    method: 'POST', body: JSON.stringify({ nome: 'Diretoria', descricao: 'Assuntos reservados', tipo: 'canal', visibilidade: 'privado', memberIds: [2] })
  });
  assert.equal(createdPrivate.status, 200);
  assert.ok((await request(2, '/api/grupos')).body.some((group) => group.id === createdPrivate.body.id));
  assert.ok(!(await request(3, '/api/grupos')).body.some((group) => group.id === createdPrivate.body.id));
  assert.ok(!fs.readFileSync(path.join(dataDir, 'grupos.json'), 'utf8').includes('Segredo interno'));
});
