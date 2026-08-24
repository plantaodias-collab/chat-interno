const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'resources', 'ai-cartorio-version.json');
const sourcePath = path.join(root, 'server-simple.js');
const normativeManifestPath = path.join(root, 'resources', 'normative', 'manifest.json');
const regions = [
  ['base_inicial', 'const DEFAULT_BASE_IA =', 'function getDefaultBackupSchedule'],
  ['pre_cadastro', 'const PRE_CADASTRO_IA_FONTES =', 'function aplicarPreCadastroIaFontes'],
  ['rag_e_validacao', 'function normalizarTextoIa', 'const DOMINIOS_PESQUISA_IA_OFICIAL ='],
  ['roteamento', 'const DOMINIOS_PESQUISA_IA_OFICIAL =', 'function salvarHistoricoIa'],
  ['historico', 'function montarHistoricoMensagensIa', 'const RESPOSTA_IA_SCHEMA ='],
  ['responses_schema_fallback', 'const RESPOSTA_IA_SCHEMA =', 'async function montarEntradaIaCartorio'],
  ['prompt_contexto', 'async function montarEntradaIaCartorio', "app.post('/api/ia-cartorio'"],
  ['resposta_final', "app.post('/api/ia-cartorio'", "app.get('/api/ia-cartorio/historico'"],
  ['base_interna', 'function normalizarItemBaseIa', "app.get('/api/base-ia'"]
];

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Não foi possível localizar o componente comportamental da IA: ${start}`);
  return source.slice(from, to);
}

function computeFingerprintFromContent(source, normativeManifest) {
  const payload = {
    regions: regions.map(([name, start, end]) => [name, normalizarConteudoFingerprint(between(source, start, end))]),
    normative_manifest: normalizarConteudoFingerprint(normativeManifest)
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizarConteudoFingerprint(content) {
  return String(content || '').replace(/\r\n/g, '\n');
}

function computeFingerprint({ sourceFile = sourcePath, normativeManifestFile = normativeManifestPath } = {}) {
  return computeFingerprintFromContent(
    fs.readFileSync(sourceFile, 'utf8'),
    fs.readFileSync(normativeManifestFile, 'utf8')
  );
}

function loadConfig(versionConfigPath = configPath) {
  const config = JSON.parse(fs.readFileSync(versionConfigPath, 'utf8'));
  if (!/^\d+\.\d+$/.test(String(config.version || ''))) throw new Error('AI_VERSION inválida em resources/ai-cartorio-version.json');
  if (!/^[a-f0-9]{64}$/.test(String(config.behavior_fingerprint || ''))) {
    throw new Error('Fingerprint da IA inválido em resources/ai-cartorio-version.json');
  }
  return config;
}

function incrementMinor(version) {
  const match = String(version || '').match(/^(\d+)\.(\d+)$/);
  if (!match) throw new Error('AI_VERSION inválida em resources/ai-cartorio-version.json');
  return `${match[1]}.${Number(match[2]) + 1}`;
}

function writeConfigAtomically(versionConfigPath, config, fileSystem = fs) {
  const directory = path.dirname(versionConfigPath);
  const temporaryPath = path.join(directory, `.${path.basename(versionConfigPath)}.${process.pid}.${Date.now()}.tmp`);
  const body = `${JSON.stringify(config, null, 2)}\n`;

  try {
    fileSystem.writeFileSync(temporaryPath, body, { encoding: 'utf8', flag: 'wx' });
    fileSystem.renameSync(temporaryPath, versionConfigPath);
  } catch (error) {
    try { fileSystem.rmSync(temporaryPath, { force: true }); } catch {}
    throw error;
  }
}

function syncAiVersion({
  versionConfigPath = configPath,
  sourceFile = sourcePath,
  normativeManifestFile = normativeManifestPath,
  logger = console.log
} = {}) {
  const config = loadConfig(versionConfigPath);
  const fingerprint = computeFingerprint({ sourceFile, normativeManifestFile });

  if (config.behavior_fingerprint === fingerprint) {
    return { changed: false, version: config.version, fingerprint };
  }

  const nextVersion = incrementMinor(config.version);
  const nextConfig = { ...config, version: nextVersion, behavior_fingerprint: fingerprint };
  writeConfigAtomically(versionConfigPath, nextConfig);
  logger(`IA alterada: versão ${config.version} → ${nextVersion}`);
  return { changed: true, previousVersion: config.version, version: nextVersion, fingerprint };
}

function check(options = {}) {
  const config = loadConfig(options.versionConfigPath);
  const fingerprint = computeFingerprint(options);
  if (config.behavior_fingerprint !== fingerprint) throw new Error('A IA foi alterada. Atualize AI_VERSION.');
  return fingerprint;
}

if (require.main === module) {
  try {
    const args = new Set(process.argv.slice(2));
    if (args.has('--sync')) syncAiVersion();
    else check();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  check,
  computeFingerprint,
  computeFingerprintFromContent,
  incrementMinor,
  loadConfig,
  normalizarConteudoFingerprint,
  syncAiVersion,
  writeConfigAtomically
};
