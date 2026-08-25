const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.SECRET_KEY ||= crypto.randomBytes(48).toString('base64url');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-normative-bootstrap-'));
fs.mkdirSync(path.join(runtime, 'data'), { recursive: true });
fs.writeFileSync(path.join(runtime, 'data', 'codigo-normas-extrajudicial-tjsc-2026.json'), JSON.stringify({
  titulo: 'índice mínimo de teste',
  url: 'https://www.tjsc.jus.br/',
  trechos: [{ id: 1, texto: 'Índice local mínimo para impedir bootstrap externo durante o teste.' }]
}));
process.env.CHAT_INTERNO_AI_EVAL = 'true';
process.env.STORAGE_ROOT = runtime;
const app = require(path.join(__dirname, '..', 'server-simple.js'));

const source = {
  fonteChave: 'lei_registros_publicos',
  url: 'https://www.planalto.gov.br/ccivil_03/leis/l6015compilada.htm',
  revisao: 'Lei nº 6.015/1973 — teste de bootstrap'
};

function htmlOficial() {
  return '<html><body><h1>Lei de Registros Públicos</h1><p>Art. 1º. Texto oficial de teste para indexação normativa.</p></body></html>';
}

function respostaHtml(html = htmlOficial()) {
  return { ok: true, status: 200, arrayBuffer: async () => Buffer.from(html) };
}

function fonteComIndice(root) {
  return { ...source, indexPath: path.join(root, 'data', 'lei-registros-publicos-planalto.json') };
}

function criarSeed(root, { hashValido = true, presente = true } = {}) {
  const resourceDir = path.join(root, 'resources', 'normative');
  const manifestPath = path.join(resourceDir, 'manifest.json');
  fs.mkdirSync(resourceDir, { recursive: true });
  const arquivo = 'lei-registros-publicos-seed.html';
  const conteudo = Buffer.from(htmlOficial());
  if (presente) fs.writeFileSync(path.join(resourceDir, arquivo), conteudo);
  const sha256 = crypto.createHash('sha256').update(conteudo).digest('hex');
  fs.writeFileSync(manifestPath, JSON.stringify({
    schema_version: 1,
    fontes: {
      lei_registros_publicos: {
        diploma: 'Lei nº 6.015/1973 — Lei de Registros Públicos',
        fonte_oficial: source.url,
        data_obtencao: '2026-08-21',
        versao: 'seed de teste',
        arquivo,
        sha256: hashValido ? sha256 : '0'.repeat(64)
      }
    }
  }));
  return { resourceDir, manifestPath };
}

function criarCenario() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-normative-case-'));
  return { root, fonte: fonteComIndice(root) };
}

test('bootstrap usa índice persistente válido sem consultar a fonte oficial', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(fonte.indexPath), { recursive: true });
  const indice = app.criarIndiceFonteOficial('Art. 1º. Texto oficial.', fonte.revisao, fonte.url);
  fs.writeFileSync(fonte.indexPath, JSON.stringify(indice));

  const resultado = await app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, {
    fetchImpl: async () => { throw new Error('fetch não deveria ser chamado'); }
  });
  assert.equal(resultado.origem, 'existing_index');
  assert.equal(resultado.fonte_remota_tentada, false);
});

test('bootstrap registra internamente a origem do índice persistido', async () => {
  const fonte = app.configuracaoFonteHtmlNormativaIa('lei_registros_publicos');
  fs.mkdirSync(path.dirname(fonte.indexPath), { recursive: true });
  const indice = app.criarIndiceFonteOficial('Art. 1º. Texto oficial.', fonte.revisao, fonte.url);
  fs.writeFileSync(fonte.indexPath, JSON.stringify(indice));
  await app.assegurarLeiRegistrosPublicosIndexada();
  const status = app.obterStatusBootstrapNormativoIa('lei_registros_publicos');
  assert.equal(status.origin, 'existing_index');
  assert.equal(status.fonte_remota_tentada, false);
});

test('bootstrap cria e persiste índice após obter a fonte oficial em volume vazio', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const resultado = await app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, { fetchImpl: async () => respostaHtml() });
  assert.equal(resultado.origem, 'official_fetch');
  assert.equal(resultado.fonte_remota_tentada, true);
  assert.ok(app.indiceFonteHtmlNormativaValidoIa(JSON.parse(fs.readFileSync(fonte.indexPath, 'utf8')), fonte));
});

test('bootstrap usa seed oficial validado quando a fonte oficial está indisponível', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const seed = criarSeed(root);
  const resultado = await app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, {
    ...seed,
    fetchImpl: async () => { throw new TypeError('fetch failed'); }
  });
  assert.equal(resultado.origem, 'bundled_seed');
  assert.equal(resultado.fonte_remota_indisponivel, true);
  assert.ok(app.indiceFonteHtmlNormativaValidoIa(JSON.parse(fs.readFileSync(fonte.indexPath, 'utf8')), fonte));
});

test('bootstrap descarta índice corrompido e o reconstrói pela fonte oficial', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.dirname(fonte.indexPath), { recursive: true });
  fs.writeFileSync(fonte.indexPath, '{corrompido');
  const resultado = await app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, { fetchImpl: async () => respostaHtml() });
  assert.equal(resultado.origem, 'official_fetch');
  assert.ok(app.indiceFonteHtmlNormativaValidoIa(JSON.parse(fs.readFileSync(fonte.indexPath, 'utf8')), fonte));
});

test('bootstrap falha claramente quando o seed disponível tem hash divergente', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const seed = criarSeed(root, { hashValido: false });
  await assert.rejects(
    app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, { ...seed, fetchImpl: async () => { throw new Error('indisponível'); } }),
    /seed normativo validado não está disponível/i
  );
});

test('bootstrap falha claramente quando não há fonte remota nem seed disponível', async (t) => {
  const { root, fonte } = criarCenario();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const seed = criarSeed(root, { presente: false });
  await assert.rejects(
    app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, { ...seed, fetchImpl: async () => { throw new Error('indisponível'); } }),
    /seed normativo validado não está disponível/i
  );
});

test('bootstrap produtivo não referencia arquivos ou runtime de eval', () => {
  assert.doesNotMatch(app.NORMATIVE_RESOURCE_DIR, /[\\/]evals(?:[\\/]|$)/i);
  assert.doesNotMatch(app.NORMATIVE_SEED_MANIFEST_PATH, /[\\/]evals(?:[\\/]|$)/i);
  assert.ok(fs.existsSync(app.NORMATIVE_SEED_MANIFEST_PATH));
});

test('seeds produtivos de LRP e Código Civil correspondem ao manifesto versionado', () => {
  const lrp = app.carregarSeedNormativoOficialIa({ ...source, fonteChave: 'lei_registros_publicos' });
  const codigoCivil = app.configuracaoFonteHtmlNormativaIa('codigo_civil');
  const cc = app.carregarSeedNormativoOficialIa(codigoCivil);
  assert.equal(crypto.createHash('sha256').update(lrp.conteudo).digest('hex'), lrp.seed.sha256);
  assert.equal(crypto.createHash('sha256').update(cc.conteudo).digest('hex'), cc.seed.sha256);
  assert.doesNotMatch(path.resolve(app.NORMATIVE_RESOURCE_DIR), /[\\/]data(?:[\\/]|$)/i);
});

test('seeds produtivos reais permitem reconstruir LRP e Código Civil sem rede', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-normative-real-seeds-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const fonteChave of ['lei_registros_publicos', 'codigo_civil']) {
    const configurada = app.configuracaoFonteHtmlNormativaIa(fonteChave);
    const fonte = { ...configurada, indexPath: path.join(root, `${fonteChave}.json`) };
    const resultado = await app.carregarOuCriarIndiceFonteHtmlNormativaIa(fonte, {
      fetchImpl: async () => { throw new Error('fonte oficial temporariamente indisponível'); }
    });
    assert.equal(resultado.origem, 'bundled_seed');
    assert.ok(app.indiceFonteHtmlNormativaValidoIa(resultado.indice, fonte));
  }
});

test.after(() => fs.rmSync(runtime, { recursive: true, force: true }));
