const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');

process.env.SECRET_KEY ||= crypto.randomBytes(48).toString('base64url');
process.env.CHAT_INTERNO_AI_EVAL = 'true';
process.env.STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-external-backup-test-'));
fs.mkdirSync(path.join(process.env.STORAGE_ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(process.env.STORAGE_ROOT, 'data', 'codigo-normas-extrajudicial-tjsc-2026.json'), JSON.stringify({ titulo: 'teste', url: 'https://www.tjsc.jus.br/', trechos: [{ id: 1, texto: 'teste' }] }));
const app = require(path.join(__dirname, '..', 'server-simple.js'));

class LocalS3CompatibleStore {
  constructor(root) {
    this.root = root;
    this.metadata = new Map();
    this.puts = 0;
    this.maxChunkBytes = 0;
    this.failPutAt = 0;
    this.afterPut = null;
  }

  pathFor(key) {
    const target = path.resolve(this.root, ...String(key).split('/'));
    assert.ok(target.startsWith(path.resolve(this.root)));
    return target;
  }

  async headObject(key) {
    const file = this.pathFor(key);
    if (!fs.existsSync(file)) return null;
    return { size: fs.statSync(file).size, sha256: this.metadata.get(key)?.sha256 || '' };
  }

  async putObject(key, { body, contentLength, sha256 }) {
    this.puts += 1;
    if (this.failPutAt && this.puts === this.failPutAt) throw new Error('falha simulada no upload');
    const file = this.pathFor(key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const guarded = async function* () {
      for await (const chunk of body) {
        this.maxChunkBytes = Math.max(this.maxChunkBytes, chunk.length);
        yield chunk;
      }
    }.bind(this);
    await pipeline(guarded(), fs.createWriteStream(file, { flags: 'w' }));
    assert.equal(fs.statSync(file).size, contentLength);
    this.metadata.set(key, { sha256 });
    if (this.afterPut) await this.afterPut(key);
  }

  async getObject(key) {
    const file = this.pathFor(key);
    if (!fs.existsSync(file)) return null;
    return { body: fs.createReadStream(file), size: fs.statSync(file).size, sha256: this.metadata.get(key)?.sha256 || '' };
  }

  remove(key) {
    fs.rmSync(this.pathFor(key), { force: true });
    this.metadata.delete(key);
  }
}

const objectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-s3-simulado-'));

function resetStorage() {
  for (const directory of [app.BACKUP_DIR, app.DATA_DIR, app.UPLOAD_DIR]) fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(app.DATA_DIR, { recursive: true });
  fs.mkdirSync(app.UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(app.BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(app.DATA_DIR, 'codigo-normas-extrajudicial-tjsc-2026.json'), JSON.stringify({ titulo: 'teste', url: 'https://www.tjsc.jus.br/', trechos: [{ id: 1, texto: 'teste' }] }));
  app.db.reload();
}

function createFixture({ large = false } = {}) {
  app.db.mensagens = [{ id: 1, conteudo: 'mensagem de teste', arquivo_nome_salvo: 'arquivo-teste.bin' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  fs.mkdirSync(path.join(app.UPLOAD_DIR, 'thumbs'), { recursive: true });
  fs.writeFileSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.bin'), large ? Buffer.alloc(2 * 1024 * 1024, 7) : 'anexo de teste');
  fs.writeFileSync(path.join(app.UPLOAD_DIR, 'thumbs', 'arquivo-teste.bin'), 'miniatura de teste');
}

function client() {
  return new LocalS3CompatibleStore(fs.mkdtempSync(path.join(objectRoot, 'store-')));
}

function externalConfig() {
  return { prefix: 'chatinterno-test' };
}

test.beforeEach(() => resetStorage());
test.after(() => {
  fs.rmSync(process.env.STORAGE_ROOT, { recursive: true, force: true });
  fs.rmSync(objectRoot, { recursive: true, force: true });
});

test('backup externo envia JSONs, anexos e miniaturas por streaming e publica manifesto por ultimo', async () => {
  createFixture({ large: true });
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-stream', client: store, config: externalConfig(), criadoPor: 'teste' });
  assert.equal(manifest.formato, app.EXTERNAL_BACKUP_FORMAT);
  assert.equal(manifest.status, 'complete');
  assert.ok(manifest.files.some((file) => file.caminho === 'data/mensagens.json'));
  assert.ok(manifest.files.some((file) => file.caminho === 'uploads/arquivo-teste.bin'));
  assert.ok(manifest.files.some((file) => file.caminho === 'uploads/thumbs/arquivo-teste.bin'));
  assert.ok(fs.existsSync(store.pathFor(manifest.manifest_objeto)));
  assert.equal(fs.readdirSync(app.BACKUP_DIR).length, 0);
  assert.ok(store.maxChunkBytes < 1024 * 1024);
});

test('falha no meio do envio nao publica manifesto e retry reutiliza objetos validados', async () => {
  createFixture();
  const store = client();
  store.failPutAt = 2;
  await assert.rejects(app.criarBackupExterno({ backupId: 'backup-retry', client: store, config: externalConfig() }), /falha simulada/i);
  assert.equal(fs.existsSync(store.pathFor('chatinterno-test/backup-retry/manifest.json')), false);
  store.failPutAt = 0;
  const putsBeforeRetry = store.puts;
  const manifest = await app.criarBackupExterno({ backupId: 'backup-retry', client: store, config: externalConfig() });
  assert.ok(store.puts - putsBeforeRetry < manifest.files.length + 1);
  assert.ok(fs.existsSync(store.pathFor(manifest.manifest_objeto)));
});

test('JSON alterado depois da captura permanece no backup com os bytes do snapshot', async () => {
  createFixture();
  const store = client();
  const original = fs.readFileSync(path.join(app.DATA_DIR, 'codigo-normas-extrajudicial-tjsc-2026.json'));
  store.afterPut = async (key) => {
    if (key.endsWith('/data/codigo-normas-extrajudicial-tjsc-2026.json')) {
      fs.writeFileSync(path.join(app.DATA_DIR, 'codigo-normas-extrajudicial-tjsc-2026.json'), '{"titulo":"versao posterior"}');
      store.afterPut = null;
    }
  };
  const manifest = await app.criarBackupExterno({ backupId: 'backup-json-capturado', client: store, config: externalConfig() });
  const arquivo = manifest.files.find((file) => file.caminho === 'data/codigo-normas-extrajudicial-tjsc-2026.json');
  assert.equal(fs.readFileSync(store.pathFor(arquivo.objeto)).equals(original), true);
  assert.notEqual(fs.readFileSync(path.join(app.DATA_DIR, 'codigo-normas-extrajudicial-tjsc-2026.json')).toString(), original.toString());
});

test('novos dados e uploads durante o envio pertencem ao proximo snapshot sem prolongar a trava', async () => {
  createFixture();
  const store = client();
  let alterou = false;
  store.afterPut = async () => {
    if (alterou) return;
    alterou = true;
    assert.equal(app.db._externalSnapshotInProgress, false);
    app.db.mensagens.push({ id: 2, conteudo: 'mensagem posterior' });
    app.db.saveFile('mensagens.json', app.db.mensagens);
    fs.writeFileSync(path.join(app.UPLOAD_DIR, 'novo-depois-do-snapshot.bin'), 'novo upload');
  };
  const manifest = await app.criarBackupExterno({ backupId: 'backup-ponto-no-tempo', client: store, config: externalConfig() });
  const mensagens = manifest.files.find((file) => file.caminho === 'data/mensagens.json');
  assert.equal(fs.readFileSync(store.pathFor(mensagens.objeto), 'utf8').includes('mensagem posterior'), false);
  assert.equal(manifest.files.some((file) => file.caminho === 'uploads/novo-depois-do-snapshot.bin'), false);
});

test('upload pertencente ao snapshot removido antes do envio falha sem publicar manifesto', async () => {
  createFixture();
  const store = client();
  store.afterPut = async (key) => {
    if (!key.endsWith('/data/mensagens.json')) return;
    store.afterPut = null;
    fs.rmSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.bin'));
  };
  await assert.rejects(app.criarBackupExterno({ backupId: 'backup-upload-removido', client: store, config: externalConfig() }), /upload do snapshot foi alterado ou removido/i);
  assert.equal(fs.existsSync(store.pathFor('chatinterno-test/backup-upload-removido/manifest.json')), false);
});

test('limite de memoria impede capturar JSONs acima do maximo configurado', () => {
  createFixture();
  assert.throws(() => app.capturarSnapshotBackupExterno({ maxJsonBytes: 1 }), /excede o limite seguro de memoria/i);
});

test('objeto ausente ou hash divergente impede restauracao sem alterar dados atuais', async () => {
  createFixture();
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-restore', client: store, config: externalConfig() });
  app.db.mensagens = [{ id: 2, conteudo: 'dados atuais preservados' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  store.remove(manifest.files.find((file) => file.caminho === 'uploads/arquivo-teste.bin').objeto);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-external-stage-'));
  await assert.rejects(app.restaurarBackupExterno({ backupId: manifest.id, client: store, config: externalConfig(), stagingRoot: staging }), /objeto remoto obrigatorio ausente/i);
  assert.equal(app.db.mensagens[0].conteudo, 'dados atuais preservados');
  fs.rmSync(staging, { recursive: true, force: true });
});

test('conteudo remoto divergente do hash do manifesto aborta antes de substituir os dados atuais', async () => {
  createFixture();
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-hash-divergente', client: store, config: externalConfig() });
  const target = manifest.files.find((file) => file.caminho === 'data/mensagens.json');
  fs.writeFileSync(store.pathFor(target.objeto), '[]');
  app.db.mensagens = [{ id: 4, conteudo: 'dados atuais preservados' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-external-stage-'));
  await assert.rejects(app.restaurarBackupExterno({ backupId: manifest.id, client: store, config: externalConfig(), stagingRoot: staging }), /integridade invalida/i);
  assert.equal(app.db.mensagens[0].conteudo, 'dados atuais preservados');
  fs.rmSync(staging, { recursive: true, force: true });
});

test('restauracao externa valida JSONs, anexos e hashes antes da troca controlada', async () => {
  createFixture();
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-restauracao-ok', client: store, config: externalConfig() });
  app.db.mensagens = [{ id: 3, conteudo: 'estado alterado' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  fs.rmSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.bin'));
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-external-stage-'));
  await app.restaurarBackupExterno({ backupId: manifest.id, client: store, config: externalConfig(), stagingRoot: staging });
  assert.equal(app.db.mensagens[0].conteudo, 'mensagem de teste');
  assert.ok(fs.existsSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.bin')));
  fs.rmSync(staging, { recursive: true, force: true });
});

test('configuracao ausente falha sem incluir segredo na mensagem', () => {
  assert.throws(() => app.obterConfiguracaoS3Externo({ S3_SECRET_ACCESS_KEY: 'nao-exibir' }), /configure endpoint, bucket e credenciais/i);
  try {
    app.obterConfiguracaoS3Externo({ S3_SECRET_ACCESS_KEY: 'nao-exibir' });
  } catch (error) {
    assert.equal(error.message.includes('nao-exibir'), false);
  }
  assert.equal(app.backupExternoFoiConfigurado({}), false);
  assert.equal(app.backupExternoFoiConfigurado({ S3_ENDPOINT: 'https://storage.exemplo.test' }), true);
});

test('staging dentro do volume e caminhos inseguros falham com seguranca', async () => {
  createFixture();
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-seguro', client: store, config: externalConfig() });
  await assert.rejects(app.restaurarBackupExterno({ backupId: manifest.id, client: store, config: externalConfig(), stagingRoot: app.BACKUP_DIR }), /staging.*nao pode ficar dentro/i);
  assert.equal(app.caminhoRelativoBackupSeguro('evals/resultado.json'), false);
});

test('backup externo funciona quando nao ha uploads', async () => {
  fs.rmSync(app.UPLOAD_DIR, { recursive: true, force: true });
  const store = client();
  const manifest = await app.criarBackupExterno({ backupId: 'backup-sem-uploads', client: store, config: externalConfig() });
  assert.equal(manifest.files.some((file) => file.caminho.startsWith('uploads/')), false);
  assert.ok(manifest.files.some((file) => file.caminho.startsWith('data/')));
});
