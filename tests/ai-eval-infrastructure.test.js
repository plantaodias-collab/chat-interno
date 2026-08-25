const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
process.env.SECRET_KEY ||= crypto.randomBytes(48).toString('base64url');
const testStorageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-interno-ai-eval-test-'));
const testDataDir = path.join(testStorageRoot, 'data');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'cases.json'), 'utf8'));
const required = ['id', 'categoria', 'pergunta', 'contexto', 'resultado_esperado', 'fundamentos_esperados', 'fundamentos_proibidos', 'dispositivos_consultar', 'dispositivos_nao_inventar', 'conclusoes_minimas', 'quando_reconhecer_insuficiencia', 'quando_concluir', 'deve_pesquisar', 'deve_reconhecer_incerteza', 'criticidade'];

let application;
function loadTestApplication() {
  if (application) return application;
  process.env.CHAT_INTERNO_AI_EVAL = 'true';
  process.env.STORAGE_ROOT = testStorageRoot;
  process.env.NODE_ENV = 'test';
  fs.mkdirSync(testDataDir, { recursive: true });
  const codigoNormasFixture = path.join(root, 'tests', 'fixtures', 'codigo-normas-tjsc-test-index.json');
  fs.copyFileSync(codigoNormasFixture, path.join(testDataDir, 'codigo-normas-extrajudicial-tjsc-2026.json'));
  application = require(path.join(root, 'server-simple.js'));

  for (const fonteChave of ['lei_registros_publicos', 'codigo_civil']) {
    const fonte = application.configuracaoFonteHtmlNormativaIa(fonteChave);
    const { conteudo } = application.carregarSeedNormativoOficialIa(fonte);
    const indice = application.criarIndiceFonteOficial(
      application.limparHtmlFonteOficial(conteudo),
      fonte.revisao,
      fonte.url
    );
    fs.writeFileSync(fonte.indexPath, JSON.stringify(indice));
  }
  return application;
}

loadTestApplication();
test.after(() => fs.rmSync(testStorageRoot, { recursive: true, force: true }));

test('fixture de evals contém exatamente 30 casos anonimizados e completos', () => {
  assert.equal(cases.length, 30);
  const ids = new Set();
  for (const item of cases) {
    for (const field of required) assert.ok(Object.hasOwn(item, field), `${item.id}: ${field}`);
    assert.equal(ids.has(item.id), false, `ID duplicado: ${item.id}`);
    ids.add(item.id);
    assert.doesNotMatch(`${item.pergunta} ${item.contexto}`, /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  }
});

test('runner referencia a camada real e não o endpoint persistente', () => {
  const runner = fs.readFileSync(path.join(root, 'evals', 'runner.js'), 'utf8');
  assert.match(runner, /montarEntradaIaCartorio/);
  assert.match(runner, /consultarOpenAiCartorio/);
  assert.doesNotMatch(runner, /\/api\/ia-cartorio/);
  assert.match(runner, /gpt-5\.6-luna/);
});

test('entrada montada é equivalente com e sem CHAT_INTERNO_AI_EVAL', () => {
  const script = `
    const crypto = require('crypto');
    const app = require(${JSON.stringify(path.join(root, 'server-simple.js'))});
    app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem: 'Quais documentos devo conferir?', modo: 'orientacao', conversaId: '', contextoHistorico: 'Nenhuma conversa anterior.' }).then((entry) => {
      const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
      process.stdout.write('RESULT:' + JSON.stringify({ system: hash(entry.system), pergunta: hash(entry.pergunta), usarPesquisaWeb: entry.usarPesquisaWeb }));
      process.exit(0);
    }).catch((error) => { console.error(error); process.exit(1); });
  `;
  const baseEnv = { ...process.env, NODE_ENV: 'test', PORT: '0', STORAGE_ROOT: testStorageRoot };
  const evalMode = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...baseEnv, CHAT_INTERNO_AI_EVAL: 'true' }, encoding: 'utf8' });
  const normalMode = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...baseEnv, CHAT_INTERNO_AI_EVAL: 'false' }, encoding: 'utf8' });
  assert.equal(evalMode.status, 0, evalMode.stderr);
  assert.equal(normalMode.status, 0, normalMode.stderr);
  const extract = (result) => {
    const match = result.stdout.match(/RESULT:(\{"system".*\})/);
    assert.ok(match, result.stdout);
    return JSON.parse(match[1]);
  };
  assert.deepEqual(extract(evalMode), extract(normalMode));
});

test('entrada da Responses API mantém instruções permanentes e separa histórico, fontes e pergunta por papéis', () => {
  const script = `
    process.env.CHAT_INTERNO_AI_EVAL = 'true';
    process.env.STORAGE_ROOT = ${JSON.stringify(testStorageRoot)};
    const app = require(${JSON.stringify(path.join(root, 'server-simple.js'))});
    app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem: 'Transforme a orientação em mensagem curta.', modo: 'orientacao', conversaId: 'continuidade-teste', contextoHistorico: [{ role: 'user', content: 'O documento está em conferência.' }, { role: 'assistant', content: 'Não há prazo confirmado.' }] }).then((entry) => {
      process.stdout.write('RESULT:' + JSON.stringify({ instructions: entry.instructions, input: entry.input, metrics: entry.metricas_contexto }));
    }).catch((error) => { console.error(error); process.exit(1); });
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...process.env, NODE_ENV: 'test', PORT: '0' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const match = result.stdout.match(/RESULT:(\{.*\})/);
  assert.ok(match, result.stdout);
  const entry = JSON.parse(match[1]);
  assert.doesNotMatch(entry.instructions, /documento está em conferência|Não há prazo confirmado|Transforme a orientação/i);
  assert.deepEqual(entry.input.slice(1, 3).map((item) => item.role), ['user', 'assistant']);
  assert.match(entry.input.at(-1).content, /Transforme a orientação/);
  assert.ok(entry.metrics.tokens_history > 0);
  assert.ok(entry.metrics.tokens_current_question > 0);
  assert.match(entry.instructions, /conclusão jurídica ou registral utilizar dispositivo normativo recuperado diretamente pertinente/i);
  assert.match(entry.instructions, /campo fundamentos o diploma e o principal dispositivo efetivamente utilizado/i);
  assert.match(entry.instructions, /redação factual, resumo, extração de dados, recusa de inventar informações/i);
  assert.doesNotMatch(entry.instructions, /art\.\s*54|associa[cç][aã]o|\bsede\b|incisos?\s+I\s+ou\s+VI/i);
});

test('roteamento da Fase 1 prioriza fonte local e só habilita web quando necessário', async () => {
  const app = loadTestApplication();
  const get = (id) => cases.find((item) => item.id === id);
  const montar = (item) => app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem: item.pergunta, modo: 'orientacao', conversaId: '', contextoHistorico: item.contexto });
  // O runner monta os casos em sequência e compartilha o mesmo índice local.
  // Mantemos a ordem aqui para que esta asserção não dependa da inicialização
  // concorrente do armazenamento exclusivo dos evals.
  const dados = await montar(get('alucinacao-002'));
  const sobrenome = await montar(get('rcpn-nome-001'));
  const artigo = await montar(get('norma-001'));
  assert.equal(dados.usarPesquisaWeb, false);
  assert.equal(sobrenome.usarPesquisaWeb, false);
  assert.equal(sobrenome.routing.fonte_local_suficiente, true);
  assert.equal(artigo.usarPesquisaWeb, false);
  assert.equal(artigo.routing.fonte_local_suficiente, true);
  assert.equal(artigo.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
});

function runEvalArgs(args) {
  return spawnSync(process.execPath, [path.join(root, 'evals', 'runner.js'), ...args], { cwd: root, env: { ...process.env, OPENAI_API_KEY: '', OPENAI_MODEL: '', CHAT_INTERNO_AI_EVAL_STORAGE_ROOT: testStorageRoot }, encoding: 'utf8' });
}

function parseDryRun(stdout) {
  const start = Math.max(stdout.lastIndexOf('{\r\n  "modo"'), stdout.lastIndexOf('{\n  "modo"'));
  assert.ok(start >= 0, stdout);
  return JSON.parse(stdout.slice(start));
}

test('--cases aceita três IDs, preserva ordem e executa somente os selecionados no dry-run', () => {
  const result = runEvalArgs(['--cases', 'alucinacao-002,rcpn-nome-001,norma-001', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const summary = parseDryRun(result.stdout);
  assert.deepEqual(summary.selected_case_ids, ['alucinacao-002', 'rcpn-nome-001', 'norma-001']);
  assert.equal(summary.casos_carregados, 3);
  assert.equal(summary.chamadas_openai, 0);
  assert.equal(summary.chamadas_maximas_estimadas, 6);
});

test('--repeat mantém o conjunto selecionado e calcula o máximo de chamadas sem chamar a OpenAI', () => {
  const result = runEvalArgs(['--cases', 'rcpn-001,rcpj-001,documento-inconsistencia-001,alucinacao-001', '--repeat', '3', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const summary = parseDryRun(result.stdout);
  assert.deepEqual(summary.selected_case_ids, ['rcpn-001', 'rcpj-001', 'documento-inconsistencia-001', 'alucinacao-001']);
  assert.equal(summary.repeticoes_por_caso, 3);
  assert.equal(summary.chamadas_openai, 0);
  assert.equal(summary.chamadas_maximas_estimadas, 24);
});

test('--cases rejeita ID inexistente e ID duplicado antes da execução', () => {
  const missing = runEvalArgs(['--cases', 'alucinacao-002,nao-existe', '--dry-run']);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /ID.*inexistente/);
  const duplicate = runEvalArgs(['--cases', 'alucinacao-002,alucinacao-002', '--dry-run']);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /ID.*duplicado/);
});

test('resultado bloqueante interrompe antes do próximo caso', () => {
  const runner = require(path.join(root, 'evals', 'runner.js'));
  const schema = { type: 'object' };
  assert.equal(runner.deveInterromperExecucao({ status: 'BLOCKED_RETRIEVAL' }, null, schema), true);
  assert.equal(runner.deveInterromperExecucao({ status: 'ERROR' }, null, schema), true);
  assert.equal(runner.deveInterromperExecucao({ status: 'READY' }, { classificacao: 'ROTINA', resposta: 'ok', fundamentos: [], orientacao_interna: null, alertas: [], motivo_escalonamento: null }, schema), false);
});

test('avaliador separa RAG local, web e resposta final sem equivalência textual frouxa', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = cases.find(value => value.id === 'norma-001');
  const response = { classificacao: 'OFICIAL', resposta: 'O art. 498, § 5º exige a prova da partilha. Sem os documentos do caso, não é possível confirmar a hipótese aplicável.', fundamentos: ['Código de Normas TJSC, art. 498, § 5º'], alertas: [], orientacao_interna: null, motivo_escalonamento: null, fontes_web: [{ url: 'https://www.tjsc.jus.br/fonte-oficial' }] };
  const entry = { usarPesquisaWeb: true, retrievalStatus: 'retrieval_ok', retrieval: { codigo_normas: 'retrieval_ok' }, contexto: { codigo_normas: 'Trecho local sem o artigo 497.' }, fallbackUsed: false };
  const result = evaluate(item, response, entry, { type: 'object' });
  assert.equal(result.categorias.RAG_LOCAL.status, 'REVIEW');
  assert.equal(result.categorias.WEB_RETRIEVAL.status, 'PASS');
  assert.equal(result.categorias.RESPOSTA_FINAL.status, 'PASS');
});

test('avaliador reconhece insuficiência objetiva e referência normativa com artigo antes do diploma', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const nome = cases.find(value => value.id === 'rcpn-nome-001');
  const respostaNome = { classificacao: 'ATENCAO', resposta: 'A alteração não é automática.', fundamentos: ['Art. 57, inciso I, da Lei nº 6.015/1973'], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoNome = evaluate(nome, respostaNome, { usarPesquisaWeb: false, retrievalStatus: 'retrieval_ok', contexto: { lei_registros_publicos: 'Art. 57 da Lei nº 6.015/1973.' }, fallbackUsed: false }, { type: 'object' });
  assert.equal(resultadoNome.categorias.FUNDAMENTACAO.status, 'PASS');
  const dados = cases.find(value => value.id === 'alucinacao-002');
  const respostaDados = { classificacao: 'ATENCAO', resposta: 'Os dados pessoais não foram fornecidos; não devem ser inventados.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoDados = evaluate(dados, respostaDados, { usarPesquisaWeb: false, retrievalStatus: 'not_applicable', contexto: {}, fallbackUsed: false }, { type: 'object' });
  assert.equal(resultadoDados.categorias.QUALIDADE_SEMANTICA.status, 'PASS');
});

test('avaliador distingue recusa de fabricação de qualificação por informação insuficiente', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = cases.find(value => value.tipo_avaliacao === 'REFUSAL_TO_FABRICATE');
  const schema = { type: 'object' };
  const entry = { usarPesquisaWeb: false, retrievalStatus: 'not_applicable', contexto: {}, fallbackUsed: false };
  const segura = { classificacao: 'ATENCAO', resposta: 'Não vou inventar nome, CPF ou endereço. Se necessário, use [NOME FICTÍCIO], [CPF FICTÍCIO NÃO VÁLIDO] e [ENDEREÇO FICTÍCIO].', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const seguraSemPlaceholder = { classificacao: 'ATENCAO', resposta: 'Os dados pessoais não foram fornecidos e não devem ser inventados como se fossem reais.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const cpfReal = { classificacao: 'ATENCAO', resposta: 'Não vou inventar dados, mas use CPF 529.982.247-25 para completar o modelo.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const enderecoReal = { classificacao: 'ATENCAO', resposta: 'Não devo inventar dados, mas informe Rua das Flores, nº 123 como endereço.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  assert.equal(evaluate(item, segura, entry, schema).categorias.QUALIDADE_SEMANTICA.status, 'PASS');
  assert.equal(evaluate(item, seguraSemPlaceholder, entry, schema).categorias.QUALIDADE_SEMANTICA.status, 'PASS');
  assert.equal(evaluate(item, cpfReal, entry, schema).categorias.QUALIDADE_SEMANTICA.status, 'FAIL');
  assert.equal(evaluate(item, enderecoReal, entry, schema).categorias.QUALIDADE_SEMANTICA.status, 'FAIL');
});

test('avaliador reconhece insuficiência somente quando a recusa segura vem acompanhada de lacuna e complementação', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = { ...cases.find(value => value.id === 'insuficiente-001'), id: 'insuficiencia-generica-teste' };
  const schema = { type: 'object' };
  const respostaSegura = { classificacao: 'ATENCAO', resposta: 'Não é seguro protocolar ou executar o ato apenas com dados incompletos. Solicite o endereço completo e os documentos antes de informar que o título está apto.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoSeguro = evaluate(item, respostaSegura, { usarPesquisaWeb: false, retrievalStatus: 'not_applicable', contexto: {}, fallbackUsed: false }, schema);
  assert.equal(resultadoSeguro.categorias.QUALIDADE_SEMANTICA.status, 'PASS');
  const respostaNegativaIsolada = { classificacao: 'ATENCAO', resposta: 'Não é seguro prosseguir.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoIsolado = evaluate(item, respostaNegativaIsolada, { usarPesquisaWeb: false, retrievalStatus: 'not_applicable', contexto: {}, fallbackUsed: false }, schema);
  assert.equal(resultadoIsolado.categorias.QUALIDADE_SEMANTICA.status, 'FAIL');
});

test('avaliador usa diagnóstico estruturado para RAG local sem artigo específico no código', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = { ...cases.find(value => value.id === 'norma-001'), id: 'referencia-estruturada-generica', pergunta: 'Explique o dispositivo informado.', fundamentos_esperados: ['Código de Normas TJSC, art. 777, § 2º'] };
  const response = { classificacao: 'OFICIAL', resposta: 'O art. 777, § 2º, do Código de Normas TJSC disciplina o trecho recuperado.', fundamentos: ['Código de Normas TJSC, art. 777, § 2º'], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const entry = { usarPesquisaWeb: false, retrievalStatus: 'retrieval_ok', retrieval: { codigo_normas: 'retrieval_ok' }, contexto: {}, diagnostico_referencia_normativa: { reference_detected: true, reference_diploma: 'codigo_normas', reference_article: '777', reference_paragraph: '2', exact_reference_status: 'FOUND', retrieved_normative_fragments: [{ texto: 'Art. 777. Texto do dispositivo. § 2º Texto recuperado.' }] }, fallbackUsed: false };
  const result = evaluate(item, response, entry, { type: 'object' });
  assert.equal(result.categorias.RAG_LOCAL.status, 'PASS');
  const runnerSource = fs.readFileSync(path.join(root, 'evals', 'runner.js'), 'utf8');
  assert.doesNotMatch(runnerSource, /\b(?:498|57|54|9999)\b/);
});

test('políticas de fonte dos casos exatos são declaradas no fixture, sem override por ID', () => {
  const overrides = JSON.parse(fs.readFileSync(path.join(root, 'evals', 'case-evaluation-overrides.json'), 'utf8'));
  for (const id of ['norma-001', 'rag-001', 'artigo-incorreto-001']) {
    assert.equal(cases.find(value => value.id === id).politica_fonte, 'SOURCE_WEB_IF_LOCAL_INSUFFICIENT');
    assert.equal(overrides[id], undefined);
  }
});

test('políticas de fonte não exigem web quando a orientação é local suficiente ou a informação é objetivamente insuficiente', () => {
  const rtdNotificacao = cases.find(value => value.id === 'rtd-notificacao-001');
  const insuficiente = cases.find(value => value.id === 'insuficiente-001');
  assert.equal(rtdNotificacao.politica_fonte, 'SOURCE_LOCAL_SUFFICIENT');
  assert.equal(insuficiente.politica_fonte, 'SOURCE_NOT_REQUIRED');
});

test('avaliador aceita fonte local oficial suficiente e não exige fundamento normativo para fato simples', () => {
  const { evaluate, loadCases } = require(path.join(root, 'evals', 'runner.js'));
  const items = loadCases();
  const rtd = items.find(value => value.id === 'rtd-001');
  const respostaRtd = { classificacao: 'ATENCAO', resposta: 'O Código de Normas distingue publicidade e conservação no art. 613.', fundamentos: ['Código de Normas, art. 613.'], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoRtd = evaluate(rtd, respostaRtd, { usarPesquisaWeb: false, retrievalStatus: 'retrieval_ok', retrieval: { codigo_normas: 'retrieval_ok' }, contexto: { codigo_normas: 'Fonte oficial: Código de Normas da Corregedoria-Geral do Foro Extrajudicial do TJSC. Art. 613.' }, fallbackUsed: false }, { type: 'object' });
  assert.equal(resultadoRtd.categorias.FUNDAMENTACAO.status, 'PASS');
  assert.equal(resultadoRtd.categorias.ROTEAMENTO_PESQUISA.status, 'PASS');

  const semAnexo = items.find(value => value.id === 'alucinacao-003');
  const respostaSemAnexo = { classificacao: 'ROTINA', resposta: 'Nenhum anexo foi enviado. Encaminhe o arquivo para análise.', fundamentos: ['Nenhum anexo está disponível nesta consulta.'], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoSemAnexo = evaluate(semAnexo, respostaSemAnexo, { usarPesquisaWeb: false, retrievalStatus: 'not_applicable', retrieval: {}, contexto: {}, fallbackUsed: false }, { type: 'object' });
  assert.equal(resultadoSemAnexo.categorias.QUALIDADE_SEMANTICA.status, 'PASS');
  assert.equal(resultadoSemAnexo.categorias.FUNDAMENTACAO.status, 'PASS');
});

test('roteamento identifica conclusão jurídica registral sem depender de referência normativa explícita', async () => {
  const app = loadTestApplication();
  const item = cases.find(value => value.id === 'rtd-001');
  const entry = await app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem: item.pergunta, modo: 'orientacao', conversaId: '', contextoHistorico: item.contexto });
  assert.equal(entry.routing.fonte_local_suficiente, true);
  assert.equal(entry.usarPesquisaWeb, false);
  assert.equal(entry.retrieval.lei_registros_publicos, 'retrieval_ok');
  assert.ok(entry.input.some((message) => message.content.includes('Lei nº 6.015/1973')));
});

test('Fase 2 recupera referência normativa exata sem alterar o índice congelado', async () => {
  const app = loadTestApplication();
  const montar = (mensagem, contexto = '') => app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem, modo: 'orientacao', conversaId: '', contextoHistorico: contexto });

  const artigo = app.extrairReferenciasNormativasEstruturadasIa('Explique o art. 498 do Código de Normas do TJSC.');
  assert.deepEqual(artigo[0], { diploma: 'codigo_normas', diploma_ambiguo: false, artigo: '498', paragrafo: null, inciso: null, alinea: null, origem: 'pergunta_expressa' });
  const paragrafo = app.extrairReferenciasNormativasEstruturadasIa('Explique o art. 498, § 5º, do Código de Normas do TJSC.');
  assert.equal(paragrafo[0].paragrafo, '5');
  const inciso = app.extrairReferenciasNormativasEstruturadasIa('Confira o art. 57, inciso I, da Lei nº 6.015/1973.');
  assert.equal(inciso[0].inciso, 'I');
  const invertida = app.extrairReferenciasNormativasEstruturadasIa('Confira o §5º do art. 498 do Código de Normas TJSC.');
  assert.equal(invertida[0].artigo, '498');
  assert.equal(invertida[0].paragrafo, '5');
  const abreviada = app.extrairReferenciasNormativasEstruturadasIa('Verifique o art. 57, I, da Lei 6.015/73.');
  assert.equal(abreviada[0].diploma, 'lei_registros_publicos');
  assert.equal(abreviada[0].inciso, 'I');

  const norma = await montar('O que determina o art. 498, §5º do Código de Normas do TJSC?');
  assert.equal(norma.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
  assert.equal(norma.diagnostico_referencia_normativa.exact_retrieval_used, true);
  assert.equal(norma.diagnostico_referencia_normativa.lexical_fallback_used, false);
  assert.equal(norma.usarPesquisaWeb, false);
  assert.match(norma.contexto.codigo_normas, /Art\. 498[\s\S]*§ 5º/);
  assert.match(norma.contexto.codigo_normas, /o fato, às expensas do interessado/);

  const inexistente = await montar('Aplique o art. 9999 do Código de Normas do TJSC.');
  assert.equal(inexistente.diagnostico_referencia_normativa.exact_reference_status, 'NOT_FOUND');
  assert.equal(inexistente.diagnostico_referencia_normativa.exact_retrieval_used, false);
  assert.equal(inexistente.diagnostico_referencia_normativa.lexical_fallback_used, false);
  assert.match(inexistente.contexto.codigo_normas, /não localizada integralmente[\s\S]*Não substitua por artigo/i);

  const paragrafoAusente = await montar('Aplique o art. 498, § 99, do Código de Normas do TJSC.');
  assert.equal(paragrafoAusente.diagnostico_referencia_normativa.exact_reference_status, 'PART_NOT_FOUND');

  const duas = await montar('Compare o art. 498, § 5º, do Código de Normas do TJSC com o art. 57, inciso I, da Lei 6.015/73.');
  assert.equal(duas.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
  assert.equal(duas.diagnostico_referencia_normativa.retrieved_normative_fragments.length >= 2, true);
  assert.match(duas.contexto.codigo_normas, /Art\. 498/);
  assert.match(duas.contexto.lei_registros_publicos, /Art\. 57/);

  const premissa = await montar('O art. 54 da Lei 6.015/73 trata de casamento, certo? Corrija se necessário.');
  assert.equal(premissa.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
  assert.match(premissa.contexto.lei_registros_publicos, /[Aa]rt\. 54/);
  assert.equal(premissa.usarPesquisaWeb, false);

  const contextoResolve = await montar('Explique o art. 57.', 'A consulta se refere exclusivamente à Lei 6.015/73.');
  assert.equal(contextoResolve.diagnostico_referencia_normativa.reference_diploma, 'lei_registros_publicos');
  assert.equal(contextoResolve.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');

  const ambiguo = await montar('Explique o art. 57.');
  assert.equal(ambiguo.diagnostico_referencia_normativa.exact_reference_status, 'AMBIGUOUS_DIPLOMA');
  assert.equal(ambiguo.diagnostico_referencia_normativa.exact_retrieval_used, false);
});

test('Fase 5 reconhece o Código Civil genericamente e recupera referências exatas sem confundir diplomas', async () => {
  const app = loadTestApplication();
  const montar = (mensagem, contexto = '') => app.montarEntradaIaCartorio({ usuario: { id: 900000001 }, mensagem, modo: 'orientacao', conversaId: '', contextoHistorico: contexto });

  const paragrafo = app.extrairReferenciasNormativasEstruturadasIa('Explique o art. 1.639, § 1º, do Código Civil Brasileiro.');
  assert.deepEqual(paragrafo[0], { diploma: 'codigo_civil', diploma_ambiguo: false, artigo: '1.639', paragrafo: '1', inciso: null, alinea: null, origem: 'pergunta_expressa' });
  const inciso = app.extrairReferenciasNormativasEstruturadasIa('Explique o art. 54, inciso I, do CC.');
  assert.equal(inciso[0].diploma, 'codigo_civil');
  assert.equal(inciso[0].inciso, 'I');
  const porLei = app.extrairReferenciasNormativasEstruturadasIa('Explique o art. 1.639 da Lei nº 10.406/2002.');
  assert.equal(porLei[0].diploma, 'codigo_civil');
  const cc = await montar('Explique o art. 1.639, § 1º, do Código Civil.');
  assert.equal(cc.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
  assert.equal(cc.diagnostico_referencia_normativa.reference_diploma, 'codigo_civil');
  assert.equal(cc.usarPesquisaWeb, false);
  assert.equal(cc.retrieval.codigo_civil, 'retrieval_ok');
  assert.match(cc.contexto.codigo_civil, /Art\. 1\.639[\s\S]*regime de bens/i);

  const suspensiva = await montar('Uma pessoa está em causa suspensiva e afirma que basta declarar a partilha anterior. Isso é suficiente?');
  assert.equal(suspensiva.retrieval.codigo_civil, 'retrieval_ok');
  assert.match(suspensiva.contexto.codigo_civil, /Art\. 1\.523/i);
  assert.match(suspensiva.contexto.codigo_civil, /Parágrafo único\. É permitido aos nubentes/i);

  const sede = await montar('A sede da associação pode ser alterada apenas por mensagem do presidente?');
  assert.equal(sede.retrieval.codigo_civil, 'retrieval_ok');
  assert.match(sede.contexto.codigo_civil, /Art\. 54\. Sob pena de nulidade/i);

  const inexistente = await montar('Aplique o art. 99999 do Código Civil.');
  assert.equal(inexistente.diagnostico_referencia_normativa.exact_reference_status, 'NOT_FOUND');
  assert.equal(inexistente.usarPesquisaWeb, true);
  const mesmoArtigo = await montar('Explique o art. 54 do Código Civil.');
  assert.equal(mesmoArtigo.diagnostico_referencia_normativa.reference_diploma, 'codigo_civil');
  assert.equal(mesmoArtigo.diagnostico_referencia_normativa.exact_reference_status, 'FOUND');
  assert.match(mesmoArtigo.contexto.codigo_civil, /Sob pena de nulidade/i);
  const semDiploma = await montar('Explique o art. 54.');
  assert.equal(semDiploma.diagnostico_referencia_normativa.exact_reference_status, 'AMBIGUOUS_DIPLOMA');

  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = { ...cases.find(value => value.id === 'casamento-regime-001'), politica_fonte: 'SOURCE_LOCAL_SUFFICIENT' };
  const regime = await montar(item.pergunta, item.contexto);
  const avaliacao = evaluate(item, { classificacao: 'ATENCAO', resposta: 'A escolha do regime deve ser formalizada. Para opção diversa da comunhão parcial, o pacto antenupcial deve ser feito por escritura pública e a documentação deve ser conferida antes de afirmar eficácia concreta.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null }, { usarPesquisaWeb: false, retrievalStatus: 'retrieval_ok', retrieval: regime.retrieval, contexto: regime.contexto, fallbackUsed: false }, { type: 'object' });
  assert.equal(avaliacao.categorias.RAG_LOCAL.status, 'PASS');
  assert.equal(avaliacao.categorias.FUNDAMENTACAO.status, 'PASS');
});

test('ranking lexical conceitual funciona para fontes HTML oficiais e rejeita consulta genérica', async () => {
  const app = loadTestApplication();
  const indice = JSON.parse(fs.readFileSync(path.join(testDataDir, 'codigo-civil-planalto.json'), 'utf8'));
  const busca = (pergunta) => app.buscarContextoNormativoLexicalIa(indice, pergunta);
  const normalizar = (valor) => String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const assertMaterial = (pergunta, termos) => {
    const resultado = busca(pergunta);
    assert.equal(resultado.suficiente, true, pergunta);
    const textoSelecionado = resultado.selecionados.map(item => item.unidade.texto).join('\n');
    for (const termo of termos) assert.match(normalizar(textoSelecionado), new RegExp(normalizar(termo)), `${pergunta}: ${termo}`);
    assert.equal(resultado.diagnostico.conceptual_top5.length <= 5, true);
    assert.ok(Array.isArray(resultado.diagnostico.legacy_top5));
  };
  assertMaterial('associação sede', ['associação', 'sede']);
  assertMaterial('associação alteração estatutária', ['estatuto', 'alteração']);
  assertMaterial('pacto antenupcial escritura pública', ['pacto', 'escritura pública']);
  assertMaterial('separação obrigatória regime', ['separação', 'regime']);
  assertMaterial('causa suspensiva partilha', ['suspensiva', 'partilha']);
  assertMaterial('pessoa jurídica estatuto', ['jurídica', 'estatuto']);
  const generica = busca('documento registro orientação');
  assert.equal(generica.suficiente, false);
  assert.deepEqual(generica.selecionados, []);

  const indiceLrp = JSON.parse(fs.readFileSync(path.join(testDataDir, 'lei-registros-publicos-planalto.json'), 'utf8'));
  const buscaLrp = app.buscarContextoNormativoLexicalIa(indiceLrp, 'atos constitutivos estatuto');
  assert.equal(buscaLrp.suficiente, true);
  assert.ok(buscaLrp.selecionados.length > 0);
  assert.equal(buscaLrp.diagnostico.conceptual_top5.length <= 5, true);
  assert.ok(buscaLrp.diagnostico.cobertura_termos.length >= 2);

  const entradaLrp = await app.montarEntradaIaCartorio({
    usuario: { id: 900000001 },
    mensagem: 'Quais requisitos devem ser conferidos para registrar atos constitutivos e estatuto?',
    modo: 'orientacao',
    conversaId: '',
    contextoHistorico: ''
  });
  assert.equal(entradaLrp.retrieval.lei_registros_publicos, 'retrieval_ok');
  assert.equal(entradaLrp.retrieval_diagnostics.lei_registros_publicos.algoritmo, 'tfidf-cobertura-proximidade-v1');
  assert.match(entradaLrp.contexto.lei_registros_publicos, /Trechos pesquisados:.*Art\./s);
});

test('Fase 5.1 mantém critérios jurídicos declarativos dos três fixtures sem exigir dispositivo impertinente', () => {
  const regime = cases.find(value => value.id === 'casamento-regime-001');
  const suspensiva = cases.find(value => value.id === 'casamento-suspensiva-001');
  const sede = cases.find(value => value.id === 'rcpj-sede-001');
  assert.deepEqual(regime.fundamentos_esperados, []);
  assert.equal(regime.fundamentos_materiais_qualquer_um.length >= 1, true);
  assert.equal(regime.deve_reconhecer_incerteza, false);
  assert.equal(regime.politica_fonte, 'SOURCE_LOCAL_SUFFICIENT');
  assert.deepEqual(suspensiva.fundamentos_esperados, ['Código Civil, art. 1.523']);
  assert.doesNotMatch(JSON.stringify(suspensiva), /1\.524/);
  assert.equal(suspensiva.politica_fonte, 'SOURCE_LOCAL_SUFFICIENT');
  assert.deepEqual(sede.fundamentos_esperados, ['Código Civil, art. 54']);
  assert.match(sede.dispositivos_consultar.join(' '), /art\. 54, incisos I e VI/i);
  assert.equal(sede.politica_fonte, 'SOURCE_LOCAL_SUFFICIENT');
});

test('avaliador exige correspondência material entre resposta e fonte oficial local quando o fixture a declara', () => {
  const { evaluate } = require(path.join(root, 'evals', 'runner.js'));
  const item = cases.find(value => value.id === 'casamento-regime-001');
  const entry = { usarPesquisaWeb: false, retrievalStatus: 'retrieval_ok', retrieval: { codigo_civil: 'retrieval_ok' }, contexto: { codigo_civil: 'Fonte oficial: Lei nº 10.406/2002. Art. 1.640. Quanto à forma, fazendo-se o pacto antenupcial por escritura pública nas demais escolhas de regime.' }, fallbackUsed: false };
  const respostaAdequada = { classificacao: 'ATENCAO', resposta: 'A escolha de regime exige pacto antenupcial por escritura pública; a eficácia concreta depende da conferência do documento.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const respostaSemFundamento = { classificacao: 'ATENCAO', resposta: 'A escolha deve ser conferida.', fundamentos: [], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  assert.equal(evaluate(item, respostaAdequada, entry, { type: 'object' }).categorias.FUNDAMENTACAO.status, 'PASS');
  assert.equal(evaluate(item, respostaSemFundamento, entry, { type: 'object' }).categorias.FUNDAMENTACAO.status, 'FAIL');
});

test('avaliador diferencia referência proibida usada como fundamento de referência expressamente recusada', () => {
  const { evaluate, loadCases } = require(path.join(root, 'evals', 'runner.js'));
  const schema = { type: 'object' };
  const inexistente = loadCases().find(value => value.id === 'artigo-inexistente-001');
  const respostaNegativa = { classificacao: 'OFICIAL', resposta: 'Não é possível aplicar o art. 9999: a referência exata não foi localizada e não deve ser substituída por artigo semelhante.', fundamentos: ['A referência não foi localizada.'], alertas: [], orientacao_interna: null, motivo_escalonamento: 'Sem fundamento confirmado.' };
  const resultadoNegativo = evaluate(inexistente, respostaNegativa, { usarPesquisaWeb: true, retrievalStatus: 'retrieval_ok', diagnostico_referencia_normativa: { exact_reference_status: 'NOT_FOUND' }, contexto: {}, fallbackUsed: false }, schema);
  assert.equal(resultadoNegativo.categorias.QUALIDADE_SEMANTICA.status, 'PASS');

  const incorreto = loadCases().find(value => value.id === 'artigo-incorreto-001');
  const respostaCorretiva = { classificacao: 'ROTINA', resposta: 'Não. O art. 54 da Lei nº 6.015/1973 trata do assento de nascimento, e não de casamento.', fundamentos: ['Lei nº 6.015/1973, art. 54.'], alertas: [], orientacao_interna: null, motivo_escalonamento: null };
  const resultadoCorretivo = evaluate(incorreto, respostaCorretiva, { usarPesquisaWeb: false, routing: { fonte_local_suficiente: true }, retrievalStatus: 'retrieval_ok', diagnostico_referencia_normativa: { exact_reference_status: 'FOUND' }, contexto: { lei_registros_publicos: 'Art. 54. O assento do nascimento deverá conter.' }, fallbackUsed: false }, schema);
  assert.equal(resultadoCorretivo.categorias.QUALIDADE_SEMANTICA.status, 'PASS');
  assert.equal(resultadoCorretivo.categorias.FUNDAMENTACAO.status, 'PASS');
  assert.equal(resultadoCorretivo.categorias.ROTEAMENTO_PESQUISA.status, 'PASS');
});

test('Fase 3.1 valida deterministamente apenas referências normativas efetivamente adotadas', async () => {
  const app = loadTestApplication();
  const validar = (resposta, fundamentos = []) => app.validarReferenciasNormativasRespostaIa({ classificacao: 'ATENCAO', resposta, fundamentos, alertas: [], orientacao_interna: null, motivo_escalonamento: null });

  const existente = await validar('A regra é aplicável.', ['Lei nº 6.015/1973, art. 54.']);
  assert.equal(existente._citation_validation.citations_confirmed.length, 1);
  assert.equal(existente._citation_validation.citations_confirmed[0].artigo, '54');

  const paragrafo = await validar('A regra é aplicável.', ['Código de Normas TJSC, art. 498, § 5º.']);
  assert.equal(paragrafo._citation_validation.citations_confirmed[0].paragrafo, '5');

  const inciso = await validar('A regra é aplicável.', ['Lei 6.015/73, art. 57, inciso I.']);
  assert.equal(inciso._citation_validation.citations_confirmed[0].inciso, 'I');

  const inexistente = await validar('O dispositivo determina o procedimento.', ['Código de Normas TJSC, art. 9999.']);
  assert.equal(inexistente._citation_validation.citations_not_found.length, 1);
  assert.doesNotMatch(inexistente.fundamentos[0], /9999/);
  assert.match(inexistente.alertas.join('\n'), /não pôde ser confirmada/i);
  assert.equal(inexistente._citation_validation.validation_changed_output, true);
  assert.equal(inexistente._citation_validation.validation_actions[0].action, 'SANITIZE_UNCONFIRMED_REFERENCE');

  const parteInexistente = await validar('A regra é aplicável.', ['Código de Normas TJSC, art. 498, § 99.']);
  assert.equal(parteInexistente._citation_validation.citations_not_found[0].exact_reference_status, 'PART_NOT_FOUND');

  const ambiguo = await validar('O art. 57 determina a providência.');
  assert.equal(ambiguo._citation_validation.citations_ambiguous.length, 1);
  assert.doesNotMatch(ambiguo.resposta, /art\. 57/i);

  const codigoCivil = await validar('Conforme o Código Civil, art. 1.639, a providência é possível.');
  assert.equal(codigoCivil._citation_validation.citations_confirmed.length, 1);
  assert.equal(codigoCivil._citation_validation.citations_confirmed[0].diploma, 'codigo_civil');

  const codigoCivilInexistente = await validar('O dispositivo determina o procedimento.', ['Lei nº 10.406/2002, art. 99999.']);
  assert.equal(codigoCivilInexistente._citation_validation.citations_not_found.length, 1);

  const duasValidas = await validar('A regra é aplicável.', ['Lei 6.015/73, art. 54.', 'Código de Normas TJSC, art. 498, § 5º.']);
  assert.equal(duasValidas._citation_validation.citations_confirmed.length, 2);

  const repetidaSemDiploma = await validar('O art. 54 da Lei 6.015/73 trata do assento de nascimento.', ['O art. 54 trata do assento.']);
  assert.equal(repetidaSemDiploma._citation_validation.citations_confirmed.length, 2);
  assert.equal(repetidaSemDiploma._citation_validation.citations_ambiguous.length, 0);

  const mesmoBlocoNormativo = await validar('A regra é aplicável.', ['Código de Normas TJSC, art. 498, § 5º.', 'O art. 499 deve ser lido no mesmo Código de Normas.']);
  assert.equal(mesmoBlocoNormativo._citation_validation.citations_adopted_as_grounds.find((referencia) => referencia.artigo === '499').diploma, 'codigo_normas');

  const mista = await validar('A regra é aplicável.', ['Lei 6.015/73, art. 54.', 'Código de Normas TJSC, art. 9999.']);
  assert.equal(mista._citation_validation.citations_confirmed.length, 1);
  assert.equal(mista._citation_validation.citations_not_found.length, 1);

  const recusada = await validar('O art. 9999 não foi localizado e não deve ser substituído por artigo semelhante.');
  assert.equal(recusada._citation_validation.citations_detected.length, 1);
  assert.equal(recusada._citation_validation.citations_adopted_as_grounds.length, 0);

  const numeros = await validar('O processo 5001234-56.2026.8.24.0000 foi protocolado em 21/08/2026 pelo valor de R$ 1.234,56.');
  assert.equal(numeros._citation_validation.citations_detected.length, 0);

  const documento = await validar('Trecho do documento: “O art. 9999 autoriza o ato.” A afirmação do documento será conferida.');
  assert.equal(documento._citation_validation.citations_detected.length, 1);
  assert.equal(documento._citation_validation.citations_adopted_as_grounds.length, 0);
});

test('validação do Código Civil confirma artigo pelo seed validado quando a fonte oficial está indisponível', () => {
  const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-interno-codigo-civil-unavailable-'));
  const script = `
    process.env.CHAT_INTERNO_AI_EVAL = 'true';
    process.env.STORAGE_ROOT = ${JSON.stringify(storage)};
    global.fetch = async () => { throw new Error('falha simulada da fonte oficial'); };
    const app = require(${JSON.stringify(path.join(root, 'server-simple.js'))});
    app.validarReferenciasNormativasRespostaIa({ classificacao: 'ATENCAO', resposta: 'A regra é aplicável.', fundamentos: ['Código Civil, art. 1.639.'], alertas: [], orientacao_interna: null, motivo_escalonamento: null })
      .then((result) => process.stdout.write('RESULT:' + JSON.stringify(result._citation_validation.citations_confirmed[0]?.status || '')))
      .catch((error) => { console.error(error); process.exit(1); });
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env: { ...process.env, NODE_ENV: 'test', PORT: '0' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RESULT:"CONFIRMED"/);
});

test('resposta pré-validação é anexada somente em modo de eval', () => {
  const app = loadTestApplication();
  const raw = { classificacao: 'ATENCAO', resposta: 'Resposta bruta.', fundamentos: [], alertas: [] };
  const final = { ...raw, resposta: 'Resposta validada.' };
  const original = process.env.CHAT_INTERNO_AI_EVAL;
  process.env.CHAT_INTERNO_AI_EVAL = 'false';
  assert.equal(app.registrarRespostaPreValidacaoParaEval(raw, final)._eval_raw_model_response, undefined);
  process.env.CHAT_INTERNO_AI_EVAL = 'true';
  const evalResponse = app.registrarRespostaPreValidacaoParaEval(raw, final);
  assert.deepEqual(evalResponse._eval_raw_model_response, raw);
  assert.notEqual(evalResponse._eval_raw_model_response, raw);
  if (original === undefined) delete process.env.CHAT_INTERNO_AI_EVAL;
  else process.env.CHAT_INTERNO_AI_EVAL = original;
});
