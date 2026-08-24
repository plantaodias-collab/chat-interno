const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checker = require(path.join(root, 'scripts', 'check-ai-version.js'));
const configPath = path.join(root, 'resources', 'ai-cartorio-version.json');
const sourcePath = path.join(root, 'server-simple.js');
const normativeManifestPath = path.join(root, 'resources', 'normative', 'manifest.json');

function withVersionFixture(initialConfig, callback) {
  const fixtureRoot = fs.mkdtempSync(path.join(root, 'tmp-ai-version-'));
  const sourceFile = path.join(fixtureRoot, 'server-simple.js');
  const manifestFile = path.join(fixtureRoot, 'manifest.json');
  const versionConfigPath = path.join(fixtureRoot, 'ai-cartorio-version.json');

  fs.copyFileSync(sourcePath, sourceFile);
  fs.copyFileSync(normativeManifestPath, manifestFile);
  fs.writeFileSync(versionConfigPath, `${JSON.stringify(initialConfig, null, 2)}\n`);

  try {
    return callback({ fixtureRoot, sourceFile, manifestFile, versionConfigPath });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function currentFingerprint() {
  return checker.computeFingerprint();
}

function readFixtureConfig(versionConfigPath) {
  return JSON.parse(fs.readFileSync(versionConfigPath, 'utf8'));
}

function syncFixture(paths) {
  return checker.syncAiVersion({
    versionConfigPath: paths.versionConfigPath,
    sourceFile: paths.sourceFile,
    normativeManifestFile: paths.manifestFile,
    logger: () => {}
  });
}

test('AI_VERSION 1.1 possui fingerprint comportamental atual', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  assert.equal(config.version, '1.1');
  assert.match(config.behavior_fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(checker.check(), config.behavior_fingerprint);
});

test('mudança comportamental da IA altera o fingerprint sem depender de evals', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const manifest = fs.readFileSync(normativeManifestPath, 'utf8');
  const changedSource = source.replace("process.env.OPENAI_MODEL || 'gpt-5.6-luna'", "process.env.OPENAI_MODEL || 'modelo-de-teste'");

  assert.notEqual(changedSource, source);
  assert.notEqual(
    checker.computeFingerprintFromContent(changedSource, manifest),
    checker.computeFingerprint()
  );
});

test('fingerprint igual não modifica a versão', () => {
  withVersionFixture({ version: '1.1', behavior_fingerprint: currentFingerprint() }, (paths) => {
    const before = fs.readFileSync(paths.versionConfigPath, 'utf8');
    const result = syncFixture(paths);

    assert.deepEqual(result, { changed: false, version: '1.1', fingerprint: currentFingerprint() });
    assert.equal(fs.readFileSync(paths.versionConfigPath, 'utf8'), before);
  });
});

test('mudanças comportamentais incrementam apenas o componente minor uma vez', () => {
  withVersionFixture({ version: '1.1', behavior_fingerprint: currentFingerprint() }, (paths) => {
    let source = fs.readFileSync(paths.sourceFile, 'utf8');
    source = source.replace("process.env.OPENAI_MODEL || 'gpt-5.6-luna'", "process.env.OPENAI_MODEL || 'modelo-de-teste-1'");
    fs.writeFileSync(paths.sourceFile, source);

    assert.equal(syncFixture(paths).version, '1.2');
    assert.equal(readFixtureConfig(paths.versionConfigPath).version, '1.2');
    assert.equal(syncFixture(paths).changed, false);
    assert.equal(readFixtureConfig(paths.versionConfigPath).version, '1.2');

    fs.writeFileSync(paths.sourceFile, source.replace('modelo-de-teste-1', 'modelo-de-teste-2'));
    assert.equal(syncFixture(paths).version, '1.3');
  });
});

test('incremento minor trata 1.9 como 1.10', () => {
  withVersionFixture({ version: '1.9', behavior_fingerprint: currentFingerprint() }, (paths) => {
    const source = fs.readFileSync(paths.sourceFile, 'utf8')
      .replace("process.env.OPENAI_MODEL || 'gpt-5.6-luna'", "process.env.OPENAI_MODEL || 'modelo-de-teste'");
    fs.writeFileSync(paths.sourceFile, source);

    assert.equal(syncFixture(paths).version, '1.10');
  });
});

test('mudança fora das regiões comportamentais não incrementa a versão', () => {
  withVersionFixture({ version: '1.1', behavior_fingerprint: currentFingerprint() }, (paths) => {
    fs.appendFileSync(paths.sourceFile, '\n// ajuste de backup sem efeito na IA\n');

    assert.equal(syncFixture(paths).changed, false);
    assert.equal(readFixtureConfig(paths.versionConfigPath).version, '1.1');
  });
});

test('arquivo de versão inválido falha sem inventar nova versão', () => {
  withVersionFixture({ version: 'invalida', behavior_fingerprint: currentFingerprint() }, (paths) => {
    const before = fs.readFileSync(paths.versionConfigPath, 'utf8');

    assert.throws(() => syncFixture(paths), /AI_VERSION inválida/);
    assert.equal(fs.readFileSync(paths.versionConfigPath, 'utf8'), before);
  });
});

test('sincronização grava versão e fingerprint atomicamente', () => {
  withVersionFixture({ version: '1.1', behavior_fingerprint: currentFingerprint() }, (paths) => {
    const source = fs.readFileSync(paths.sourceFile, 'utf8')
      .replace("process.env.OPENAI_MODEL || 'gpt-5.6-luna'", "process.env.OPENAI_MODEL || 'modelo-de-teste'");
    fs.writeFileSync(paths.sourceFile, source);

    syncFixture(paths);
    const config = readFixtureConfig(paths.versionConfigPath);

    assert.equal(config.version, '1.2');
    assert.match(config.behavior_fingerprint, /^[a-f0-9]{64}$/);
    assert.deepEqual(fs.readdirSync(paths.fixtureRoot).filter((file) => file.endsWith('.tmp')), []);
  });
});

test('configuração pública de versão não contém instruções, contexto ou segredos', () => {
  const raw = fs.readFileSync(configPath, 'utf8');

  assert.doesNotMatch(raw, /OPENAI|SECRET|api[_-]?key|Você é a IA/i);
});
