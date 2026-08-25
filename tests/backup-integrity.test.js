const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.SECRET_KEY ||= crypto.randomBytes(48).toString('base64url');
process.env.CHAT_INTERNO_AI_EVAL = 'true';
process.env.STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-backup-test-'));
fs.mkdirSync(path.join(process.env.STORAGE_ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(process.env.STORAGE_ROOT, 'data', 'codigo-normas-extrajudicial-tjsc-2026.json'), JSON.stringify({ titulo: 'teste', url: 'https://www.tjsc.jus.br/', trechos: [{ id: 1, texto: 'teste' }] }));
const app = require(path.join(__dirname, '..', 'server-simple.js'));

function resetStorage() {
  for (const directory of [app.BACKUP_DIR, app.DATA_DIR, app.UPLOAD_DIR]) fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(app.DATA_DIR, { recursive: true });
  fs.mkdirSync(app.UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(app.BACKUP_DIR, { recursive: true });
  fs.writeFileSync(path.join(app.DATA_DIR, 'codigo-normas-extrajudicial-tjsc-2026.json'), JSON.stringify({ titulo: 'teste', url: 'https://www.tjsc.jus.br/', trechos: [{ id: 1, texto: 'teste' }] }));
  app.db.reload();
}

function createFixture() {
  app.db.mensagens = [{ id: 1, conteudo: 'mensagem de teste', arquivo_nome_salvo: 'arquivo-teste.txt' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  fs.mkdirSync(path.join(app.UPLOAD_DIR, 'thumbs'), { recursive: true });
  fs.writeFileSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.txt'), 'anexo de teste');
  fs.writeFileSync(path.join(app.UPLOAD_DIR, 'thumbs', 'arquivo-teste.txt'), 'miniatura de teste');
}

function backup(nome = 'teste', tipo = 'manual') {
  return app.createBackup({ nome, tipo, criadoPor: 'teste', espaco: { disponivel: true, livre_bytes: 1024 * 1024 * 1024 } });
}

test.beforeEach(() => resetStorage());
test.after(() => fs.rmSync(process.env.STORAGE_ROOT, { recursive: true, force: true }));

test('backup completo inclui JSONs, uploads, miniaturas e manifesto com hashes', () => {
  createFixture();
  const manifest = backup();
  assert.equal(manifest.formato, 'chatinterno-backup');
  assert.equal(manifest.versao_formato, app.BACKUP_FORMAT_VERSION);
  assert.ok(manifest.files.some((file) => file.caminho === 'data/mensagens.json'));
  assert.ok(manifest.files.some((file) => file.caminho === 'uploads/arquivo-teste.txt'));
  assert.ok(manifest.files.some((file) => file.caminho === 'uploads/thumbs/arquivo-teste.txt'));
  assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
  assert.deepEqual(app.validarManifestoBackup(path.join(app.BACKUP_DIR, manifest.id)).id, manifest.id);
});

test('restauracao validada recupera JSONs e anexos conjuntamente', () => {
  createFixture();
  const manifest = backup('restore');
  app.db.mensagens = [{ id: 2, conteudo: 'estado alterado' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  fs.rmSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.txt'));
  app.restoreBackup(manifest.id);
  assert.equal(app.db.mensagens[0].conteudo, 'mensagem de teste');
  assert.ok(fs.existsSync(path.join(app.UPLOAD_DIR, 'arquivo-teste.txt')));
  assert.ok(fs.existsSync(path.join(app.UPLOAD_DIR, 'thumbs', 'arquivo-teste.txt')));
});

test('arquivo corrompido ou ausente aborta sem alterar dados atuais', () => {
  createFixture();
  const manifest = backup('corrupt');
  const backupPath = path.join(app.BACKUP_DIR, manifest.id);
  fs.writeFileSync(path.join(backupPath, 'data', 'mensagens.json'), '[]');
  app.db.mensagens = [{ id: 9, conteudo: 'dados atuais preservados' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  assert.throws(() => app.restoreBackup(manifest.id), /integridade invalida/i);
  assert.equal(app.db.mensagens[0].conteudo, 'dados atuais preservados');
});

test('arquivo ausente no manifesto impede restauração antes de alterar dados atuais', () => {
  createFixture();
  const manifest = backup('ausente');
  const backupPath = path.join(app.BACKUP_DIR, manifest.id);
  fs.rmSync(path.join(backupPath, 'uploads', 'arquivo-teste.txt'));
  app.db.mensagens = [{ id: 8, conteudo: 'dados atuais preservados' }];
  app.db.saveFile('mensagens.json', app.db.mensagens);
  assert.throws(() => app.restoreBackup(manifest.id), /arquivo obrigatorio ausente/i);
  assert.equal(app.db.mensagens[0].conteudo, 'dados atuais preservados');
});

test('bloqueia backup quando não há margem de espaço segura', () => {
  createFixture();
  assert.throws(() => app.createBackup({ nome: 'sem-espaco', espaco: { disponivel: true, livre_bytes: 0 } }), /espaco insuficiente/i);
  assert.equal(app.listBackups().length, 0);
});

test('retenção preserva somente três automáticos e limita manuais sem apagar existentes', () => {
  createFixture();
  for (let index = 0; index < 4; index += 1) backup(`auto-${index}`, 'automatico');
  app.pruneAutomaticBackups(3);
  assert.equal(app.listBackups().filter((item) => item.tipo === 'automatico').length, 3);
  for (let index = 0; index < 5; index += 1) backup(`manual-${index}`);
  assert.throws(() => backup('manual-limite'), /limite de 5 backups manuais/i);
});

test('backup sem uploads e caminhos inseguros são tratados com segurança', () => {
  fs.rmSync(app.UPLOAD_DIR, { recursive: true, force: true });
  const manifest = backup('sem-uploads');
  assert.equal(manifest.files.some((file) => file.caminho.startsWith('uploads/')), false);
  assert.equal(manifest.files.some((file) => file.caminho.startsWith('evals/')), false);
  assert.equal(app.caminhoRelativoBackupSeguro('../usuarios.json'), false);
  assert.equal(app.caminhoRelativoBackupSeguro('data/usuarios.json'), true);
  assert.equal(app.caminhoRelativoBackupSeguro('uploads/thumbs/a.png'), true);
});
