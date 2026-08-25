const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server-simple.js');

test('um volume vazio cria estruturas neutras sem copiar seeds operacionais do repositório', (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-empty-storage-'));
  t.after(() => fs.rmSync(runtime, { recursive: true, force: true }));

  const script = [
    "const fs = require('fs');",
    "const path = require('path');",
    `const app = require(${JSON.stringify(serverPath)});`,
    "const files = fs.readdirSync(path.join(process.env.STORAGE_ROOT, 'data')).sort();",
    "process.stdout.write(JSON.stringify({",
    "  usuarios: app.db.usuarios,",
    "  grupos: app.db.grupos,",
    "  membros: app.db.membros_grupo,",
    "  mensagens: app.db.mensagens,",
    "  escala: app.db.escala_plantao,",
    "  files",
    "}));",
    "process.exit(0);"
  ].join('');
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    env: {
      ...process.env,
      CHAT_INTERNO_AI_EVAL: 'true',
      SECRET_KEY: crypto.randomBytes(48).toString('base64url'),
      STORAGE_ROOT: runtime
    },
    encoding: 'utf8',
    timeout: 15000
  });

  assert.equal(result.status, 0, result.stderr);
  const snapshot = JSON.parse(result.stdout);
  assert.deepEqual(snapshot.usuarios, []);
  assert.deepEqual(snapshot.membros, []);
  assert.deepEqual(snapshot.mensagens, []);
  assert.deepEqual(snapshot.escala, { escreventes: [], ferias: [], escalas: [] });
  assert.ok(snapshot.grupos.every((grupo) => !grupo.criado_por));
  assert.ok(snapshot.files.includes('usuarios.json'));
  assert.ok(snapshot.files.includes('mensagens.json'));
  assert.ok(snapshot.files.includes('lei-registros-publicos-planalto.json') === false);
});

test('o runtime não possui mais caminho de seed para data ou backups versionados', () => {
  const source = fs.readFileSync(serverPath, 'utf8');
  assert.doesNotMatch(source, /SEED_DATA_DIR/);
  assert.doesNotMatch(source, /copyFileSync\(seedPath/);
  assert.doesNotMatch(source, /Escala inicial de junho\/2026/);
  assert.match(source, /path\.join\(__dirname, 'resources', 'normative'\)/);
  assert.doesNotMatch(source, /evals[\\/]\.runtime/);
});

test('o servidor inicia em armazenamento vazio sem criar administrador ou senha padrão', async (t) => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-empty-server-'));
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: {
      ...process.env,
      CHAT_INTERNO_AI_EVAL: 'false',
      PORT: '0',
      SECRET_KEY: crypto.randomBytes(48).toString('base64url'),
      STORAGE_ROOT: runtime
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => {
    if (!child.killed) child.kill('SIGTERM');
    fs.rmSync(runtime, { recursive: true, force: true });
  });

  const output = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('servidor não iniciou em volume vazio')), 10000);
    child.once('error', reject);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Servidor rodando')) {
        clearTimeout(timeout);
        resolve(String(chunk));
      }
    });
    child.stderr.on('data', () => {});
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`servidor encerrou antes da inicialização (código ${code})`));
    });
  });
  assert.match(output, /Servidor rodando/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime, 'data', 'usuarios.json'), 'utf8')), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(runtime, 'data', 'painel-senhas.json'), 'utf8')), {
    senhaAtual: '', observacao: '', atualizadoPor: '', atualizadoEm: null
  });
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
});
