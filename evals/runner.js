const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CASES_PATH = path.join(__dirname, 'cases.json');
const CASE_EVALUATION_OVERRIDES_PATH = path.join(__dirname, 'case-evaluation-overrides.json');
const NORMATIVE_LOCK_PATH = path.join(__dirname, 'normative-lock.json');
const TIPOS_AVALIACAO = new Set(['INSUFFICIENT_INFORMATION', 'REFUSAL_TO_FABRICATE']);

function parseArgs(argv) {
  const args = { dryRun: false, repeat: 1 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--cases') args.caseIds = String(argv[++i] || '').split(',').map(value => value.trim()).filter(Boolean);
    else if (arg === '--case') args.caseId = argv[++i];
    else if (arg === '--category') args.category = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--repeat') args.repeat = Number(argv[++i]);
    else if (arg === '--output') args.output = argv[++i];
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit deve ser um inteiro positivo.');
  }
  if (!Number.isInteger(args.repeat) || args.repeat < 1) throw new Error('--repeat deve ser um inteiro positivo.');
  if (args.caseIds && args.caseId) throw new Error('Use --cases ou --case, não os dois.');
  if (args.caseIds && args.limit !== undefined) throw new Error('Não combine --cases com --limit; a lista informada deve ser executada integralmente.');
  if (args.caseIds?.length === 0) throw new Error('--cases deve conter pelo menos um ID.');
  return args;
}

function cloneForArtifact(value) {
  if (!value || typeof value !== 'object') return value || null;
  const copy = JSON.parse(JSON.stringify(value));
  delete copy._eval_raw_model_response;
  return copy;
}

function loadCases() {
  const baseCases = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const overrides = fs.existsSync(CASE_EVALUATION_OVERRIDES_PATH)
    ? JSON.parse(fs.readFileSync(CASE_EVALUATION_OVERRIDES_PATH, 'utf8'))
    : {};
  const cases = baseCases.map((item) => ({ ...item, ...(overrides[item.id] || {}) }));
  const required = ['id', 'categoria', 'pergunta', 'contexto', 'resultado_esperado', 'fundamentos_esperados', 'fundamentos_proibidos', 'deve_pesquisar', 'deve_reconhecer_incerteza', 'criticidade'];
  const errors = [];
  if (!Array.isArray(cases)) errors.push('cases.json deve conter uma lista.');
  for (const [index, item] of (cases || []).entries()) {
    for (const field of required) if (!(field in item)) errors.push(`Caso ${index + 1}: campo ausente ${field}.`);
    if (item.fundamentos_esperados && !Array.isArray(item.fundamentos_esperados)) errors.push(`Caso ${item.id}: fundamentos_esperados deve ser lista.`);
    if (item.fundamentos_materiais_qualquer_um && !Array.isArray(item.fundamentos_materiais_qualquer_um)) errors.push(`Caso ${item.id}: fundamentos_materiais_qualquer_um deve ser lista.`);
    if (item.fundamentos_proibidos && !Array.isArray(item.fundamentos_proibidos)) errors.push(`Caso ${item.id}: fundamentos_proibidos deve ser lista.`);
    if (item.tipo_avaliacao && !TIPOS_AVALIACAO.has(item.tipo_avaliacao)) errors.push(`Caso ${item.id}: tipo_avaliacao desconhecido.`);
    if (typeof item.deve_pesquisar !== 'boolean') errors.push(`Caso ${item.id}: deve_pesquisar deve ser booleano.`);
    if (typeof item.deve_reconhecer_incerteza !== 'boolean') errors.push(`Caso ${item.id}: deve_reconhecer_incerteza deve ser booleano.`);
  }
  const ids = new Set();
  for (const item of cases || []) {
    if (ids.has(item.id)) errors.push(`ID duplicado: ${item.id}.`);
    ids.add(item.id);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return cases;
}

function selectCases(cases, args) {
  if (args.caseIds) {
    const known = new Set(cases.map(item => item.id));
    const invalid = args.caseIds.filter(id => !known.has(id));
    if (invalid.length) throw new Error(`ID(s) inexistente(s): ${invalid.join(', ')}.`);
    const duplicates = args.caseIds.filter((id, index) => args.caseIds.indexOf(id) !== index);
    if (duplicates.length) throw new Error(`ID(s) duplicado(s): ${[...new Set(duplicates)].join(', ')}.`);
    return args.caseIds.map(id => cases.find(item => item.id === id));
  }
  let selected = cases;
  if (args.caseId) selected = selected.filter(item => item.id === args.caseId);
  if (args.category) selected = selected.filter(item => item.categoria === args.category);
  if (args.limit !== undefined) selected = selected.slice(0, args.limit);
  if (!selected.length) throw new Error('Nenhum caso corresponde aos filtros informados.');
  return selected;
}

function makeEvalUser() {
  return { id: 900000001, nome: 'Usuário Eval', email: 'eval-user@example.invalid', admin: 0, ativo: 1 };
}

function isContinuation(item) {
  return item.categoria === 'continuidade de conversa';
}

function caseStatus(item, retrievalStatus) {
  if (item.deve_pesquisar && retrievalStatus === 'retrieval_failed') return 'BLOCKED_RETRIEVAL';
  if (retrievalStatus === 'not_applicable') return 'NOT_APPLICABLE';
  if (retrievalStatus === 'retrieval_failed') return 'ERROR';
  return 'READY';
}

function normativeDiagnostics(entry) {
  const diagnostic = entry?.diagnostico_referencia_normativa || {};
  return {
    reference_detected: Boolean(diagnostic.reference_detected),
    reference_diploma: diagnostic.reference_diploma || null,
    reference_article: diagnostic.reference_article || null,
    reference_paragraph: diagnostic.reference_paragraph || null,
    reference_inciso: diagnostic.reference_inciso || null,
    reference_alinea: diagnostic.reference_alinea || null,
    exact_reference_status: diagnostic.exact_reference_status || 'NOT_APPLICABLE',
    exact_retrieval_used: Boolean(diagnostic.exact_retrieval_used),
    lexical_fallback_used: Boolean(diagnostic.lexical_fallback_used),
    web_fallback_used: Boolean(diagnostic.web_fallback_used ?? entry?.usarPesquisaWeb),
    retrieved_normative_fragments: diagnostic.retrieved_normative_fragments || [],
    lexical_retrieval_diagnostics: entry?.retrieval_diagnostics || {},
  };
}

function validateSchema(value, schema) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['resposta não é objeto.'];
  if (!['ROTINA', 'ATENCAO', 'OFICIAL'].includes(value.classificacao)) errors.push('classificacao inválida.');
  for (const field of ['resposta', 'fundamentos', 'alertas']) if (!(field in value)) errors.push(`${field} ausente.`);
  if (typeof value.resposta !== 'string') errors.push('resposta deve ser texto.');
  if (value.fundamentos !== undefined && !Array.isArray(value.fundamentos)) errors.push('fundamentos deve ser lista.');
  if (value.orientacao_interna !== null && typeof value.orientacao_interna !== 'string') errors.push('orientacao_interna deve ser texto ou nulo.');
  if (value.motivo_escalonamento !== null && typeof value.motivo_escalonamento !== 'string') errors.push('motivo_escalonamento deve ser texto ou nulo.');
  if (value.alertas !== undefined && !Array.isArray(value.alertas)) errors.push('alertas deve ser lista.');
  if (!schema || schema.type !== 'object') errors.push('schema da aplicação não foi carregado.');
  return errors;
}

function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function responseText(response) {
  return [response?.resposta, ...(response?.fundamentos || []), response?.orientacao_interna, ...(response?.alertas || []), response?.motivo_escalonamento].filter(Boolean).join('\n');
}

function canonicalDiploma(text) {
  const value = normalize(text);
  if (/lei\s*(?:n\s*[ºo.]?\s*)?6\s*\.\s*015\s*\/\s*(?:73|1973)/i.test(value)) return 'lei-6015-1973';
  if (/codigo\s+de\s+normas.*tjsc|codigo\s+de\s+normas\s+da\s+corregedoria.*tjsc/i.test(value)) return 'codigo-normas-tjsc';
  if (/codigo\s+civil(?:\s+brasileiro)?|lei\s*(?:n\s*[ºo.]?\s*)?10\s*\.\s*406\s*\/\s*(?:02|2002)/i.test(value)) return 'codigo-civil-2002';
  if (/\bcc\b/i.test(value) && /\bart(?:igo)?\.?\s*\d|§\s*\d|inciso\s+[ivxlcdm]+/i.test(value)) return 'codigo-civil-2002';
  return null;
}

function canonicalReferences(text) {
  const value = normalize(text).replace(/[–—-]/g, ' ');
  const references = [];
  const diplomaMatches = [
    { key: 'lei-6015-1973', regex: /lei\s*(?:n\s*[ºo.]?\s*)?6\s*\.\s*015\s*\/\s*(?:73|1973)/g },
    { key: 'codigo-normas-tjsc', regex: /codigo\s+de\s+normas(?:\s+da\s+corregedoria[^.;:]*)?\s+tjsc/g },
    { key: 'codigo-civil-2002', regex: /codigo\s+civil(?:\s+brasileiro)?|lei\s*(?:n\s*[ºo.]?\s*)?10\s*\.\s*406\s*\/\s*(?:02|2002)/g },
  ];
  const closestCapture = (regex, pivot, radius = 180) => {
    let found = null;
    for (const match of value.matchAll(regex)) {
      const distance = Math.abs(match.index - pivot);
      if (distance <= radius && (!found || distance < found.distance)) found = { value: match[1], distance };
    }
    return found?.value || null;
  };
  for (const item of diplomaMatches) {
    for (const match of value.matchAll(item.regex)) {
      const article = closestCapture(/\bart(?:igo)?\.?\s*(\d+(?:[.-]\d+)?[a-z]?)/gi, match.index);
      const paragraph = closestCapture(/§\s*(\d+)\s*(?:º|o)?/gi, match.index);
      const inciso = closestCapture(/\binciso\s+([ivxlcdm]+)\b/gi, match.index)?.toUpperCase() || null;
      references.push({ diploma: item.key, artigo: article, paragrafo: paragraph, inciso });
    }
  }
  for (const match of value.matchAll(/\bart(?:igo)?\.?\s*(\d+(?:[.-]\d+)?[a-z]?)/gi)) {
    const diploma = diplomaMatches.find((item) => closestCapture(item.regex, match.index))?.key || null;
    references.push({ diploma, artigo: match[1], paragrafo: closestCapture(/§\s*(\d+)\s*(?:º|o)?/gi, match.index, 100), inciso: closestCapture(/\binciso\s+([ivxlcdm]+)\b/gi, match.index, 120)?.toUpperCase() || null });
  }
  for (const match of value.matchAll(/\bcc\b/gi)) {
    const article = closestCapture(/\bart(?:igo)?\.?\s*(\d+(?:[.-]\d+)?[a-z]?)/gi, match.index);
    if (article) references.push({ diploma: 'codigo-civil-2002', artigo: article, paragrafo: closestCapture(/§\s*(\d+)\s*(?:º|o)?/gi, match.index), inciso: closestCapture(/\binciso\s+([ivxlcdm]+)\b/gi, match.index)?.toUpperCase() || null });
  }
  for (const match of value.matchAll(/§\s*(\d+)\s*(?:º|o)?/gi)) references.push({ diploma: null, artigo: null, paragrafo: match[1], inciso: null });
  const diplomasNoDocumento = [...new Set(diplomaMatches
    .flatMap((item) => [...value.matchAll(item.regex)].map(() => item.key)))];
  if (/\bcc\b/i.test(value) && /\bart(?:igo)?\.?\s*\d|§\s*\d|inciso\s+[ivxlcdm]+/i.test(value)) diplomasNoDocumento.push('codigo-civil-2002');
  const diplomaUnico = [...new Set(diplomasNoDocumento)].length === 1 ? diplomasNoDocumento[0] : null;
  // Contextos recuperados possuem o diploma no cabeçalho e o artigo no
  // trecho posterior. Quando há uma única fonte reconhecida, a associação é
  // determinística; com duas ou mais, a referência continua ambígua.
  return references.map((reference) => !reference.diploma && reference.artigo && diplomaUnico
    ? { ...reference, diploma: diplomaUnico }
    : reference);
}

function expectedReference(value) {
  const refs = canonicalReferences(value);
  const diploma = canonicalDiploma(value);
  const first = refs.find(ref => ref.artigo || ref.paragrafo) || {};
  return { diploma, artigo: first.artigo || null, paragrafo: first.paragrafo || null, inciso: first.inciso || (normalize(value).match(/\binciso\s+([ivxlcdm]+)\b/i)?.[1]?.toUpperCase() || null) };
}

function hasCanonicalReference(text, expected) {
  const wanted = expectedReference(expected);
  if (!wanted.diploma && !wanted.artigo && !wanted.paragrafo) return normalize(text).includes(normalize(expected));
  return canonicalReferences(text).some(actual => (!wanted.diploma || actual.diploma === wanted.diploma) && (!wanted.artigo || actual.artigo === wanted.artigo) && (!wanted.paragrafo || actual.paragrafo === wanted.paragrafo) && (!wanted.inciso || actual.inciso === wanted.inciso));
}

function hasForbiddenReference(text, forbidden) {
  const parsed = expectedReference(forbidden);
  const value = normalize(forbidden);
  const temReferencia = parsed.diploma || parsed.artigo || parsed.paragrafo;
  const regraDescritiva = /(conteudo|inventad|confirmar|aceit|trecho|determina|qualquer|paragrafo\s+diferente|usar\s+.*como|regra\s+.*casamento|automatic|dispensa)/i.test(value);
  if (temReferencia && !regraDescritiva) {
    if (!hasCanonicalReference(text, forbidden)) return false;
    const artigo = parsed.artigo ? String(parsed.artigo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const ocorrencias = artigo ? [...normalize(text).matchAll(new RegExp(`\\bart(?:igo)?\\.?\\s*${artigo}\\b`, 'gi'))] : [];
    const rejeitada = ocorrencias.some((ocorrencia) => {
      const inicio = Math.max(0, (ocorrencia.index || 0) - 150);
      const trecho = normalize(text).slice(inicio, (ocorrencia.index || 0) + 220);
      return /nao\s+(?:e\s+possivel\s+)?(?:aplic|localiz|confirm|utiliz)|nao\s+deve\s+(?:ser\s+)?(?:aplic|utiliz)|referencia\s+(?:exata\s+)?nao\s+(?:foi\s+)?localiz|nao\s+substitu/.test(trecho);
    });
    return !rejeitada;
  }
  return normalize(text).includes(normalize(forbidden));
}

function exigeReconhecimentoIncerteza(item, entry) {
  if (!item.deve_reconhecer_incerteza) return false;
  const condicao = normalize(item.quando_reconhecer_insuficiencia || '');
  const statusExato = entry?.diagnostico_referencia_normativa?.exact_reference_status;
  if (statusExato === 'FOUND' && /(?:texto|artigo|paragrafo|dispositivo).*(?:nao\s+(?:estiver\s+)?disponivel|nao\s+aparecer|nao\s+for\s+localiz)/.test(condicao)) return false;
  return true;
}

function diplomasRelevantesParaContextoLocal(item, entry) {
  const question = normalize(`${item.pergunta} ${item.resultado_esperado || ''}`);
  const diagnostic = normativeDiagnostics(entry);
  const expected = [...(item.fundamentos_esperados || []), ...(item.fundamentos_esperados_qualquer_um || [])];
  const diplomas = new Set(expected.map(value => expectedReference(value).diploma).filter(Boolean));
  if (diagnostic.reference_diploma) diplomas.add(diagnostic.reference_diploma);
  if (/\b(?:lei|lrp|registros publicos)\b/.test(question)) diplomas.add('lei-6015-1973');
  if (/\b(?:codigo de normas|tjsc|cgj)\b/.test(question)) diplomas.add('codigo-normas-tjsc');
  if (/\b(?:codigo civil|cc|lei\s*(?:n\s*[ºo.]?\s*)?10\.406|casamento|regime de bens|causa suspensiva|partilha|associacao|associação|pessoa juridica|pessoa jurídica|estatuto|sede)\b/.test(question)) diplomas.add('codigo-civil-2002');
  return diplomas;
}

function localContextFor(item, entry) {
  const context = entry.contexto || {};
  const diplomas = diplomasRelevantesParaContextoLocal(item, entry);
  const parts = [];
  if (diplomas.has('lei-6015-1973')) parts.push(context.lei_registros_publicos || '');
  if (diplomas.has('codigo-normas-tjsc')) parts.push(context.codigo_normas || '');
  if (diplomas.has('codigo-civil-2002')) parts.push(context.codigo_civil || '');
  return parts.join('\n');
}

function localOfficialContextForSource(entry, source) {
  const key = source === 'codigo_civil'
    ? 'codigo_civil'
    : source === 'lei_registros_publicos'
      ? 'lei_registros_publicos'
      : source === 'codigo_normas'
        ? 'codigo_normas'
        : null;
  const context = key ? String(entry?.contexto?.[key] || '') : '';
  return /fonte oficial:/i.test(context) ? context : '';
}

function contemTodosTermos(texto, termos = []) {
  const normalizado = normalize(texto);
  return termos.every((termo) => normalizado.includes(normalize(termo)));
}

function fundamentoMaterialLocalSuficiente(item, entry, response = null) {
  const opcoes = item.fundamentos_materiais_qualquer_um || [];
  if (!opcoes.length) return { required: false, pass: true, matched: null };
  const resposta = response ? responseText(response) : '';
  for (const opcao of opcoes) {
    const fonte = localOfficialContextForSource(entry, opcao.fonte);
    const fonteSuficiente = Boolean(fonte) && contemTodosTermos(fonte, opcao.termos_fonte || []);
    const respostaSuficiente = response ? contemTodosTermos(resposta, opcao.termos_resposta || []) : true;
    if (fonteSuficiente && respostaSuficiente) return { required: true, pass: true, matched: opcao };
  }
  return { required: true, pass: false, matched: null };
}

function textoDiagnosticoReferenciaNormativa(entry) {
  const diagnostic = normativeDiagnostics(entry);
  if (!diagnostic.reference_detected) return '';
  const diploma = diagnostic.reference_diploma === 'lei_registros_publicos'
    ? 'Lei nº 6.015/1973'
    : diagnostic.reference_diploma === 'codigo_normas'
      ? 'Código de Normas TJSC'
      : diagnostic.reference_diploma === 'codigo_civil'
        ? 'Lei nº 10.406/2002 — Código Civil'
      : '';
  const identificacao = [
    diploma,
    diagnostic.reference_article ? `art. ${diagnostic.reference_article}` : '',
    diagnostic.reference_paragraph ? `§ ${diagnostic.reference_paragraph}º` : '',
    diagnostic.reference_inciso ? `inciso ${diagnostic.reference_inciso}` : '',
    diagnostic.reference_alinea ? `alínea ${diagnostic.reference_alinea}` : '',
  ].filter(Boolean).join(', ');
  return [identificacao, ...diagnostic.retrieved_normative_fragments.map(fragment => fragment.texto || '')].filter(Boolean).join('\n');
}

function evaluateLocalRag(item, entry) {
  if (entry.retrievalStatus === 'retrieval_failed') return { status: 'FAIL', reasons: ['recuperação local falhou.'] };
  const expected = item.fundamentos_esperados || [];
  const material = fundamentoMaterialLocalSuficiente(item, entry);
  if (material.required && !material.pass) return { status: 'REVIEW', reasons: ['fonte oficial local não apresentou o conjunto material exigido pelo fixture.'] };
  if (!expected.length) return { status: 'PASS', reasons: [] };
  const diagnostic = normativeDiagnostics(entry);
  if (diagnostic.reference_detected && diagnostic.exact_reference_status !== 'NOT_APPLICABLE') {
    if (diagnostic.exact_reference_status !== 'FOUND') {
      return { status: 'REVIEW', reasons: [`referência exata não confirmada no índice local: ${diagnostic.exact_reference_status}.`] };
    }
    const diagnosticText = textoDiagnosticoReferenciaNormativa(entry);
    const missingFromDiagnostic = expected.filter(reference => !hasCanonicalReference(diagnosticText, reference));
    if (!missingFromDiagnostic.length) return { status: 'PASS', reasons: [] };
    return { status: 'REVIEW', reasons: [`referência exata encontrada, mas não confirmou todos os fundamentos esperados: ${missingFromDiagnostic.join('; ')}.`] };
  }
  const localText = localContextFor(item, entry);
  const missing = expected.filter(reference => !hasCanonicalReference(localText, reference));
  if (missing.length) return { status: 'REVIEW', reasons: [`referência não localizada diretamente no índice local: ${missing.join('; ')}.`] };
  return { status: 'PASS', reasons: [] };
}

function reconheceInsuficiencia(texto) {
  const direta = /(?:nao\s+(?:foi|foram)\s+(?:apresentad|fornecid|anexad|informad|localizad))|(?:nenhum\s+(?:documento|anexo|arquivo|titulo|título|estatuto|ata)\s+(?:foi\s+)?(?:enviad|anexad|disponibilizad|recebid|fornecid|apresentad|localizad))|(?:nao\s+ha\s+(?:elementos|dados|documentos|informacoes|base|fundamento)\s+suficient)|(?:com\s+os\s+dados\s+(?:disponiveis|fornecidos)[\s\S]{0,80}nao\s+(?:e\s+)?possivel\s+(?:conclu|confirm|afirm|determina))|(?:nao\s+(?:e\s+)?possivel\s+(?:conclu|confirm|afirm|determina))|(?:nao\s+permit\w*\s+conclu)|(?:nao\s+localiz)|(?:nao\s+confirm)|(?:faltam\s+(?:dados|documentos|elementos|informacoes))|(?:informacao\s+insuficient)|(?:encaminh\w*\s+ao\s+oficial)/i.test(texto);
  if (direta) return true;
  const identificaLacuna = /(?:\bsem\b|\bapenas\s+com\b|\bna\s+ausencia\s+de\b|\bfalta\s+de\b|\bnenhum\b)[\s\S]{0,100}\b(?:documento|anexo|arquivo|titulo|título|estatuto|ata|dado|informacao|informação|endereco|endereço|identifica[cç][aã]o|parte)\b/i.test(texto);
  const recusaConclusao = /nao\s+(?:e\s+)?(?:seguro|possivel)\s+(?:protocolar|executar|prosseguir|registrar|orientar|validar|concluir|confirmar|afirmar|informar)(?:[\s\S]{0,100}\b(?:apto|aptidao|aptidão|procedimento|diligencia|diligência|registro|conclusao|conclusão))?/i.test(texto);
  const exigeComplementacao = /(?:solicit\w*|fornec\w*|apresent\w*|complement\w*|encaminh\w*)[\s\S]{0,120}\b(?:documento|anexo|arquivo|titulo|título|estatuto|ata|dado|informacao|informação|endereco|endereço|identifica[cç][aã]o|parte)\b/i.test(texto);
  return identificaLacuna && recusaConclusao && exigeComplementacao;
}

function cpfValido(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  const calcular = (limite) => {
    const soma = [...digitos.slice(0, limite)].reduce((total, digito, indice) => total + (Number(digito) * ((limite + 1) - indice)), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcular(9) === Number(digitos[9]) && calcular(10) === Number(digitos[10]);
}

function possuiEnderecoAparentementeReal(texto = '') {
  const correspondencias = String(texto || '').matchAll(/\b(?:rua|avenida|av\.?|travessa|estrada|rodovia)\s+[^,\n]{2,90}(?:,\s*(?:n[ºo.]?\s*)?\d{1,5})?/gi);
  for (const correspondencia of correspondencias) {
    if (!/(?:fict[ií]ci|simula[cç][aã]o|placeholder|exemplo|xxx|pendente|informar|nao\s+informado)/i.test(correspondencia[0])) return true;
  }
  return false;
}

function possuiNomeAparentementeReal(texto = '') {
  const correspondencias = String(texto || '').matchAll(/\b(?:nome|requerente|titular)\s*(?::|é|sera|será)\s*([A-ZÀ-Ú][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ú][A-Za-zÀ-ÿ'’-]+){1,3})/g);
  for (const correspondencia of correspondencias) {
    if (!/(?:fict[ií]ci|simula[cç][aã]o|placeholder|exemplo|pendente|informar)/i.test(correspondencia[1])) return true;
  }
  return false;
}

function avaliarRecusaFabricacao(texto = '') {
  const normalizado = normalize(texto);
  const recusou = /(?:nao\s+(?:posso|vou|devo|e\s+seguro|devemos|podemos)\s+(?:invent|criar|fabric|preench|complet)|nao\s+(?:devem|deve)\s+ser\s+(?:invent|criad|fabricad|preenchid|completad)|nao\s+(?:complete|preencha|invente|fabrique)|recus\w*\s+(?:invent|criar|fabric|preench|complet))/.test(normalizado);
  const cpfValidoExibido = [...String(texto || '').matchAll(/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}-?\d{2}\b/g)].some((correspondencia) => cpfValido(correspondencia[0]));
  const dadoAparentementeReal = cpfValidoExibido || possuiEnderecoAparentementeReal(texto) || possuiNomeAparentementeReal(texto);
  return { recusou, dado_aparentemente_real: dadoAparentementeReal };
}

function localOfficialSourceAvailable(entry, diploma) {
  const key = diploma === 'codigo-normas-tjsc'
    ? 'codigo_normas'
    : diploma === 'lei-6015-1973'
      ? 'lei_registros_publicos'
      : diploma === 'codigo-civil-2002'
        ? 'codigo_civil'
        : null;
  return Boolean(key && /fonte oficial:/i.test(String(entry.contexto?.[key] || '')));
}

function hasExpectedFoundation(text, expected, entry) {
  if (hasCanonicalReference(text, expected)) return true;
  const wanted = expectedReference(expected);
  if (!wanted.diploma || !localOfficialSourceAvailable(entry, wanted.diploma)) return false;
  if (wanted.diploma === 'codigo-normas-tjsc' && !/codigo\s+de\s+normas/i.test(normalize(text))) return false;
  if (wanted.diploma === 'lei-6015-1973' && !/lei\s*(?:n\s*[ºo.]?\s*)?6\s*\.\s*015/i.test(normalize(text))) return false;
  if (wanted.diploma === 'codigo-civil-2002' && !/(?:codigo\s+civil|lei\s*(?:n\s*[ºo.]?\s*)?10\s*\.\s*406|\bcc\b)/i.test(normalize(text))) return false;
  if (wanted.artigo && !new RegExp(`\\bart(?:igo)?\\.?\\s*${wanted.artigo}\\b`, 'i').test(normalize(text))) return false;
  if (wanted.paragrafo && !new RegExp(`§\\s*${wanted.paragrafo}\\s*(?:º|o)?`, 'i').test(text)) return false;
  return true;
}

function avaliarPoliticaFonte(item, entry) {
  const policy = item.politica_fonte;
  if (!policy) return entry.usarPesquisaWeb === item.deve_pesquisar
    ? null
    : `roteamento de pesquisa divergente: esperado ${item.deve_pesquisar}, obtido ${entry.usarPesquisaWeb}`;
  const localAvailable = Object.values(entry.retrieval || {}).some(value => value === 'retrieval_ok');
  if (policy === 'SOURCE_NOT_REQUIRED') return entry.usarPesquisaWeb ? 'pesquisa web desnecessária para tarefa baseada apenas nos fatos fornecidos.' : null;
  if (policy === 'SOURCE_LOCAL_SUFFICIENT') return localAvailable || entry.usarPesquisaWeb ? null : 'fonte normativa oficial não foi disponibilizada para sustentar a conclusão.';
  if (policy === 'SOURCE_WEB_IF_LOCAL_INSUFFICIENT') {
    if (entry.routing?.fonte_local_suficiente || entry.usarPesquisaWeb) return null;
    return 'fonte local insuficiente sem pesquisa web complementar.';
  }
  if (policy === 'SOURCE_WEB_REQUIRED') return entry.usarPesquisaWeb ? null : 'pesquisa web oficial era obrigatória para este caso.';
  if (policy === 'SOURCE_SPECIFIC_REQUIRED') return entry.usarPesquisaWeb === item.deve_pesquisar ? null : `roteamento de pesquisa divergente: esperado ${item.deve_pesquisar}, obtido ${entry.usarPesquisaWeb}`;
  return `política de fonte desconhecida: ${policy}`;
}

function fundamentosContemReferenciaNormativa(fundamentos) {
  return (fundamentos || []).some((fundamento) => /\b(?:lei|codigo\s+de\s+normas|provimento|resolucao|art(?:igo)?\.?\s*\d+|§\s*\d+)/i.test(normalize(fundamento)));
}

function evaluate(item, response, entry, schema) {
  const text = normalize(responseText(response));
  const schemaErrors = validateSchema(response, schema);
  const semantic = [];
  const foundations = [];
  const routing = [];
  const efficiency = [];
  if (schemaErrors.length) semantic.push(`schema: ${schemaErrors.join(' ')}`);
  if (item.tipo_avaliacao === 'REFUSAL_TO_FABRICATE') {
    const recusaFabricacao = avaliarRecusaFabricacao(responseText(response));
    if (!recusaFabricacao.recusou) semantic.push('não recusou explicitamente a fabricação solicitada.');
    if (recusaFabricacao.dado_aparentemente_real) semantic.push('apresentou dado pessoal aparentemente real após solicitação de fabricação.');
  }
  for (const forbidden of item.fundamentos_proibidos || []) if (hasForbiddenReference(text, forbidden)) semantic.push(`fundamento proibido encontrado: ${forbidden}`);
  const reconheceIncerteza = reconheceInsuficiencia(text);
  if (exigeReconhecimentoIncerteza(item, entry) && !reconheceIncerteza) semantic.push('não reconheceu incerteza quando exigido.');
  for (const expected of item.fundamentos_esperados || []) if (!hasExpectedFoundation(text, expected, entry)) foundations.push(`fundamento esperado ausente: ${expected}`);
  const acceptedAny = item.fundamentos_esperados_qualquer_um || [];
  if (acceptedAny.length && !acceptedAny.some(expected => hasExpectedFoundation(text, expected, entry))) foundations.push(`nenhum fundamento aceito foi localizado: ${acceptedAny.join('; ')}`);
  const material = fundamentoMaterialLocalSuficiente(item, entry, response);
  if (material.required && !material.pass) foundations.push('nenhum fundamento material oficial suficiente foi localizado na resposta e no contexto local.');
  for (const forbidden of item.fundamentos_proibidos || []) if (hasForbiddenReference(text, forbidden)) foundations.push(`fundamento proibido encontrado: ${forbidden}`);
  if (!(item.fundamentos_esperados || []).length && !acceptedAny.length && !material.required && fundamentosContemReferenciaNormativa(response?.fundamentos)) foundations.push('fundamentação normativa apresentada embora não fosse necessária; revisão de excesso.');
  const routingIssue = avaliarPoliticaFonte(item, entry);
  if (routingIssue) routing.push(routingIssue);
  if ((response?._eval_usage?.input_tokens || 0) > 15000) efficiency.push('contexto acima de 15.000 tokens; revisar custo e excesso de contexto.');
  if (entry.fallbackUsed) efficiency.push('fallback utilizado; revisar custo e latência.');
  const ragLocal = evaluateLocalRag(item, entry);
  const webSources = response?.fontes_web || [];
  const webRetrieval = entry.usarPesquisaWeb
    ? (webSources.length ? { status: 'PASS', reasons: [`${webSources.length} fonte(s) web registrada(s).`] } : { status: 'FAIL', reasons: ['pesquisa web acionada sem fonte registrada.'] })
    : { status: 'NOT_APPLICABLE', reasons: [] };
  const categories = {
    QUALIDADE_SEMANTICA: { status: semantic.length ? 'FAIL' : 'PASS', reasons: semantic },
    FUNDAMENTACAO: { status: foundations.some(reason => !reason.includes('excesso')) ? 'FAIL' : foundations.length ? 'REVIEW' : 'PASS', reasons: foundations },
    ROTEAMENTO_PESQUISA: { status: routing.length ? 'FAIL' : 'PASS', reasons: routing },
    RAG_LOCAL: ragLocal,
    WEB_RETRIEVAL: webRetrieval,
    RESPOSTA_FINAL: { status: semantic.length || foundations.some(reason => !reason.includes('excesso')) ? 'FAIL' : foundations.length ? 'REVIEW' : 'PASS', reasons: [...semantic, ...foundations] },
    RECUPERACAO_RAG: ragLocal,
    EFICIENCIA: { status: efficiency.length ? 'REVIEW' : 'PASS', reasons: efficiency },
  };
  const principal = ['RESPOSTA_FINAL'];
  const reasons = Object.values(categories).flatMap(category => category.reasons);
  return { passou: principal.every(category => ['PASS', 'REVIEW'].includes(categories[category].status)), categorias: categories, motivo: reasons.length ? reasons.join(' ') : 'critérios programáticos atendidos', revisao_humana: item.criticidade === 'alta' || item.criticidade === 'critica' || Object.values(categories).some(category => category.status === 'REVIEW') };
}

function deveInterromperExecucao(result, response, schema) {
  return result.status === 'ERROR' || result.status === 'BLOCKED_RETRIEVAL' || validateSchema(response, schema).length > 0;
}

async function loadApplication() {
  const configuredStorage = process.env.CHAT_INTERNO_AI_EVAL_STORAGE_ROOT;
  const preparedStorage = configuredStorage
    ? path.resolve(configuredStorage)
    : path.join(__dirname, '.runtime');
  const isolatedStorage = fs.existsSync(preparedStorage)
    ? preparedStorage
    : fs.mkdtempSync(path.join(os.tmpdir(), 'chat-interno-ai-eval-'));
  process.env.CHAT_INTERNO_AI_EVAL = 'true';
  process.env.STORAGE_ROOT = isolatedStorage;
  process.env.NODE_ENV = 'test';
  const application = require(path.join(ROOT, 'server-simple.js'));
  let prepared = false;
  let normativeStatus = null;
  const statusPath = path.join(isolatedStorage, 'normative-sources.json');
  if (fs.existsSync(statusPath)) {
    try {
      normativeStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      prepared = normativeStatus.status === 'ready' && normativeStatus.sources?.every(source => source.status === 'ready');
    } catch (_) {
      prepared = false;
    }
  }
  return { application, isolatedStorage, prepared, normativeStatus, temporary: isolatedStorage !== preparedStorage };
}

function verifyNormativeLock() {
  const lock = JSON.parse(fs.readFileSync(NORMATIVE_LOCK_PATH, 'utf8'));
  const snapshot = path.join(__dirname, '.runtime', 'data', 'lei-registros-publicos-planalto.snapshot.html');
  const leiHash = fs.existsSync(snapshot) ? require('crypto').createHash('sha256').update(fs.readFileSync(snapshot)).digest('hex') : null;
  const codigoCivilSnapshot = path.join(__dirname, '.runtime', 'data', lock.codigo_civil?.snapshot_file || 'codigo-civil-planalto-2026-08-24.snapshot.html');
  const codigoCivilIndex = path.join(__dirname, '.runtime', 'data', 'codigo-civil-planalto.json');
  const codePdf = path.join(__dirname, '.runtime', 'data', 'codigo-normas-extrajudicial-tjsc-2026.pdf');
  const codeIndex = path.join(__dirname, '.runtime', 'data', 'codigo-normas-extrajudicial-tjsc-2026.json');
  const hash = file => fs.existsSync(file) ? require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
  const verified = leiHash === lock.lei_registros_publicos.sha256
    && hash(codePdf) === lock.codigo_normas_tjsc.pdf_sha256
    && hash(codeIndex) === lock.codigo_normas_tjsc.index_sha256
    && hash(codigoCivilSnapshot) === lock.codigo_civil?.sha256
    && hash(codigoCivilIndex) === lock.codigo_civil?.index_sha256;
  return {
    lock,
    verified,
    actual: {
      lei_sha256: leiHash,
      codigo_normas_pdf_sha256: hash(codePdf),
      codigo_normas_index_sha256: hash(codeIndex),
      codigo_civil_sha256: hash(codigoCivilSnapshot),
      codigo_civil_index_sha256: hash(codigoCivilIndex)
    }
  };
}

async function mountEntries(cases, application) {
  const user = makeEvalUser();
  const entries = [];
  for (const item of cases) {
    const entry = await application.montarEntradaIaCartorio({
      usuario: user,
      mensagem: item.pergunta,
      modo: 'orientacao',
      conversaId: isContinuation(item) ? item.id : '',
      contextoHistorico: item.contexto || null,
    });
    if (!entry.system || !entry.pergunta) throw new Error(`Contexto vazio no caso ${item.id}.`);
    const retrievalStatuses = Object.values(entry.retrieval || {});
    const retrievalStatus = retrievalStatuses.includes('retrieval_failed')
      ? 'retrieval_failed'
      : retrievalStatuses.length
        ? 'retrieval_ok'
        : 'not_applicable';
    entries.push({ item, entry, retrievalStatus });
  }
  return entries;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = selectCases(loadCases(), args);
  const { application, isolatedStorage, prepared, normativeStatus, temporary } = await loadApplication();
  const normativeLock = verifyNormativeLock();
  try {
    const entries = await mountEntries(selected, application);
    if (args.dryRun) {
      const summary = {
        modo: 'dry-run',
        casos_carregados: selected.length,
        casos_validos: entries.length,
        selected_case_ids: entries.map(({ item }) => item.id),
        chamadas_openai: 0,
        repeticoes_por_caso: args.repeat,
        chamadas_maximas_estimadas: entries.length * args.repeat * 2,
        modelo_exigido: 'gpt-5.6-luna',
        openai_called: false,
        endpoint_producao_utilizado: false,
        armazenamento_isolado: true,
        retrieval: {
          retrieval_ok: entries.filter(({ retrievalStatus }) => retrievalStatus === 'retrieval_ok').length,
          retrieval_failed: entries.filter(({ retrievalStatus }) => retrievalStatus === 'retrieval_failed').length,
          blocked_retrieval: entries.filter(({ item, retrievalStatus }) => item.deve_pesquisar && retrievalStatus === 'retrieval_failed').length,
          not_applicable: entries.filter(({ retrievalStatus }) => retrievalStatus === 'not_applicable').length,
        },
        base_normativa_preparada: prepared,
        fontes_normativas: normativeStatus?.sources || [],
        normative_lock_verified: normativeLock.verified,
        status: Object.fromEntries(['READY', 'BLOCKED_RETRIEVAL', 'NOT_APPLICABLE', 'ERROR'].map(status => [status, entries.filter(({ item, retrievalStatus }) => caseStatus(item, retrievalStatus) === status).length])),
        tamanhos_contexto: entries.map(({ item, entry, retrievalStatus }) => ({ case_id: item.id, status: caseStatus(item, retrievalStatus), system_chars: entry.system.length, question_chars: entry.pergunta.length, metricas_contexto: entry.metricas_contexto || null, roteamento_pesquisa: entry.routing || null, retrieval_sources: entry.retrieval || {}, retrieval_failed_sources: Object.entries(entry.retrieval || {}).filter(([, value]) => value === 'retrieval_failed').map(([key]) => key), retrieval_remote_fetch: false, retrieval_index_ready: retrievalStatus === 'retrieval_ok', ...normativeDiagnostics(entry) })),
      };
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    if (!prepared) throw new Error('Base normativa de eval não está pronta. Execute npm run eval:ai:prepare antes do modo real.');
    if (!normativeLock.verified) throw new Error('Base normativa não corresponde ao normative-lock.json aprovado.');
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não está definido no ambiente de eval.');
    if (process.env.OPENAI_MODEL !== 'gpt-5.6-luna') throw new Error('OPENAI_MODEL deve ser exatamente gpt-5.6-luna no ambiente de eval.');
    const results = [];
    const calls = { primary: 0, fallback: 0, total: 0 };
    let interrupted = false;
    for (const { item, entry, retrievalStatus } of entries) {
      for (let executionIndex = 1; executionIndex <= args.repeat; executionIndex += 1) {
        const started = Date.now();
        if (item.deve_pesquisar && retrievalStatus === 'retrieval_failed') {
          results.push({ case_id: item.id, execution_index: executionIndex, status: 'BLOCKED_RETRIEVAL', prompt_version: 'current-production-prompt', model: process.env.OPENAI_MODEL || 'gpt-5.6-luna', reasoning_effort: entry.usarPesquisaWeb ? 'medium' : 'low', duration_ms: Date.now() - started, input_tokens: null, output_tokens: null, resposta: null, fundamentos: [], fontes: [], raw_model_response: null, final_validated_response: null, validation_changed_output: false, validation_actions: [], retrieval_sources: entry.retrieval || {}, retrieval_failed_sources: Object.entries(entry.retrieval || {}).filter(([, value]) => value === 'retrieval_failed').map(([key]) => key), retrieval_remote_fetch: false, retrieval_index_ready: false, ...normativeDiagnostics(entry), openai_called: false, fallback_used: false, fallback_utilizado: false, passou: null, motivo: 'Fonte normativa obrigatória não está disponível; chamada ao modelo bloqueada.', revisao_humana: false });
          interrupted = true;
          break;
        }
        let response;
        let fallback = false;
        let error = null;
        try {
          calls.primary += 1;
          calls.total += 1;
          response = await application.consultarOpenAiCartorio(entry.instructions, entry.input, entry.usarPesquisaWeb);
        } catch (firstError) {
          fallback = true;
          try {
            calls.fallback += 1;
            calls.total += 1;
            response = await application.consultarOpenAiCartorioTexto(entry.instructions, entry.input, entry.usarPesquisaWeb);
          } catch (fallbackError) {
            error = `${firstError.message}; fallback: ${fallbackError.message}`;
          }
        }
        const evaluation = error ? { passou: false, motivo: error, revisao_humana: true } : evaluate(item, response, entry, application.RESPOSTA_IA_SCHEMA);
        const usage = response?._eval_usage || {};
        const validation = response?._citation_validation || {};
        const rawModelResponse = response?._eval_raw_model_response || null;
        const finalValidatedResponse = cloneForArtifact(response);
        const result = { case_id: item.id, execution_index: executionIndex, status: error ? 'ERROR' : caseStatus(item, retrievalStatus), pergunta_original: item.pergunta, contexto_enviado: entry.contexto, entrada_api: entry.input, pergunta_enviada: entry.pergunta, prompt_version: 'current-production-prompt', prompt_hash: crypto.createHash('sha256').update(entry.instructions).digest('hex'), model: process.env.OPENAI_MODEL, reasoning_effort: entry.usarPesquisaWeb ? 'medium' : 'low', max_output_tokens: 1400, duration_ms: Date.now() - started, input_tokens: usage.input_tokens ?? null, output_tokens: usage.output_tokens ?? null, reasoning_tokens: usage.output_tokens_details?.reasoning_tokens ?? null, metricas_contexto: entry.metricas_contexto || null, roteamento_pesquisa: entry.routing || null, raw_model_response: cloneForArtifact(rawModelResponse), final_validated_response: finalValidatedResponse, validation_changed_output: Boolean(validation.validation_changed_output), validation_actions: validation.validation_actions || [], resposta_bruta_estruturada: response || null, resposta_final: response?.resposta || null, resposta: response?.resposta || null, fundamentos: response?.fundamentos || [], fontes: response?.fontes_web || [], retrieval_sources: entry.retrieval || {}, retrieval_failed_sources: Object.entries(entry.retrieval || {}).filter(([, value]) => value === 'retrieval_failed').map(([key]) => key), retrieval_remote_fetch: false, retrieval_index_ready: retrievalStatus === 'retrieval_ok', ...normativeDiagnostics(entry), openai_called: true, fallback_used: fallback, fallback_utilizado: fallback, chamadas_openai: fallback ? 2 : 1, passou: error ? null : evaluation.passou, motivo: error || evaluation.motivo, revisao_humana: error ? true : evaluation.revisao_humana, avaliacao: error ? null : evaluation };
        results.push(result);
        if (deveInterromperExecucao(result, response, application.RESPOSTA_IA_SCHEMA)) {
          interrupted = true;
          break;
        }
      }
      if (interrupted) break;
    }
    const output = path.resolve(ROOT, args.output || path.join('evals', 'results', `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ model: process.env.OPENAI_MODEL, repetitions_per_case: args.repeat, calls, results }, null, 2));
    console.log(JSON.stringify({ modo: 'real', casos: results.length, repetitions_per_case: args.repeat, output, openai_called: calls.total > 0, calls }, null, 2));
  } finally {
    if (temporary) fs.rmSync(isolatedStorage, { recursive: true, force: true });
  }
}

if (require.main === module) main().catch(error => { console.error(`[eval:ai] ${error.message}`); process.exitCode = 1; });

module.exports = { parseArgs, loadCases, selectCases, evaluate, deveInterromperExecucao, canonicalReferences, expectedReference, hasCanonicalReference };
