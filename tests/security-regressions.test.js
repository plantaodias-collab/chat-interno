const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server-simple.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'assets', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function executarBootstrapProducao({ secretKey } = {}) {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-secret-key-'));
  const script = `require(${JSON.stringify(path.join(root, 'server-simple.js'))}); process.stdout.write('BOOT_OK'); process.exit(0);`;
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    RAILWAY_ENVIRONMENT: 'production',
    CHAT_INTERNO_AI_EVAL: 'true',
    STORAGE_ROOT: runtime
  };
  if (secretKey !== undefined) env.SECRET_KEY = secretKey;
  else delete env.SECRET_KEY;

  const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env, encoding: 'utf8' });
  fs.rmSync(runtime, { recursive: true, force: true });
  return result;
}

test('autenticação rejeita usuário ausente ou desativado', () => {
  assert.match(server, /const usuario = findActiveUserById\(decoded\.id\)/);
  assert.match(server, /Sessão inválida ou usuário desativado/);
});

test('rotas administrativas possuem barreira central de perfil', () => {
  assert.match(server, /app\.use\('\/api\/admin', verificarToken, verificarAdministrador\)/);
  assert.match(server, /function verificarAdministrador\(req, res, next\)/);
});

test('auditoria não devolve IP completo', () => {
  assert.match(server, /function mascararIp\(ip\)/);
  assert.match(server, /ip: mascararIp\(registro\.ip\)/);
});

test('upload protegido continua exigindo token e autorização da conversa', () => {
  assert.match(server, /app\.get\('\/api\/uploads\/:fileName', verificarToken/);
  assert.match(server, /!canUserAccessMessage\(req\.userId, message\)/);
});

test('notificações não reportam sucesso quando o Web Push não está configurado', () => {
  assert.match(server, /res\.json\(\{ key, configured: Boolean\(key\) \}\)/);
  assert.match(client, /motivo: 'not-configured'/);
  assert.match(client, /O envio em segundo plano ainda não está configurado no servidor/);
  assert.match(index, /id="notificationPermissionBtn"/);
});

test('política básica de segurança permanece configurada', () => {
  assert.match(server, /Content-Security-Policy/);
  assert.match(server, /X-Content-Type-Options/);
  assert.match(server, /Strict-Transport-Security/);
});

test('produção inicia somente com SECRET_KEY configurada e nunca usa fallback fixo', () => {
  const secretKey = crypto.randomBytes(48).toString('base64url');
  const result = executarBootstrapProducao({ secretKey });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /BOOT_OK/);
  assert.doesNotMatch(server, /DEFAULT_SECRET_KEY|chatinterno-local-fallback/);
});

test('produção sem SECRET_KEY falha sem registrar segredo', () => {
  const result = executarBootstrapProducao();
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}${result.stdout}`, /SECRET_KEY é obrigatória/);
  assert.doesNotMatch(`${result.stderr}${result.stdout}`, /chatinterno-local-fallback/);
});

test('JWT válido e Socket.IO continuam usar a chave ativa; token legado é rejeitado após rotação', () => {
  const jwt = require('jsonwebtoken');
  const activeSecret = crypto.randomBytes(48).toString('base64url');
  const legacySecret = crypto.randomBytes(48).toString('base64url');
  const validToken = jwt.sign({ id: 42, email: 'teste@exemplo.invalid', admin: false }, activeSecret, { expiresIn: '30d' });
  assert.equal(jwt.verify(validToken, activeSecret).id, 42);

  // A propriedade relevante é criptográfica: qualquer token emitido pela
  // chave anterior — inclusive o fallback removido — falha com a nova chave.
  const legacyToken = jwt.sign({ id: 42 }, legacySecret, { expiresIn: '30d' });
  assert.throws(() => jwt.verify(legacyToken, activeSecret));

  assert.match(server, /function verificarToken[\s\S]*?jwt\.verify\(token, SECRET_KEY\)[\s\S]*?findActiveUserById\(decoded\.id\)/);
  assert.match(server, /io\.use\([\s\S]*?jwt\.verify\(token, SECRET_KEY\)[\s\S]*?findActiveUserById\(decoded\.id\)/);
});

test('painel de senhas desativado não expõe nem grava credenciais em claro', () => {
  assert.doesNotMatch(server, /senha_painel:\s*String\(u\.senha_painel/);
  assert.doesNotMatch(server, /req\.body\?\.senhaPainel/);
  assert.doesNotMatch(server, /usuario\.senha_painel\s*=/);
  assert.doesNotMatch(server, /app\.(?:get|put)\('\/api\/painel-senhas'/);
  assert.doesNotMatch(client, /contact-ticket-note">Senha:/);
  assert.match(client, /const SHARED_PASSWORD_PANEL_ENABLED = false/);
  assert.match(client, /async function carregarPainelSenha\(\) \{\s*if \(!SHARED_PASSWORD_PANEL_ENABLED\)/);
});

test('criação de usuário usa senha temporária aleatória, persistida somente como bcrypt', () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-temporary-password-'));
  const secretKey = crypto.randomBytes(48).toString('base64url');
  const script = `
    const { gerarSenhaTemporaria } = require(${JSON.stringify(path.join(root, 'server-simple.js'))});
    const bcrypt = require('bcryptjs');
    (async () => {
      const first = gerarSenhaTemporaria();
      const second = gerarSenhaTemporaria();
      const hash = await bcrypt.hash(first, 10);
      process.stdout.write('TEMP_PASSWORD_RESULT=' + JSON.stringify({
        distinct: first !== second,
        firstLength: first.length,
        secondLength: second.length,
        base64url: /^[A-Za-z0-9_-]+$/.test(first) && /^[A-Za-z0-9_-]+$/.test(second),
        bcryptMatches: await bcrypt.compare(first, hash),
        plaintextPersisted: hash.includes(first)
      }) + '\\n');
    })();
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SECRET_KEY: secretKey, CHAT_INTERNO_AI_EVAL: 'true', STORAGE_ROOT: runtime }
  });
  fs.rmSync(runtime, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  const line = `${result.stdout}`.split(/\r?\n/).find((item) => item.startsWith('TEMP_PASSWORD_RESULT='));
  assert.ok(line, result.stdout);
  const generated = JSON.parse(line.slice('TEMP_PASSWORD_RESULT='.length));
  assert.deepEqual(generated, {
    distinct: true,
    firstLength: 32,
    secondLength: 32,
    base64url: true,
    bcryptMatches: true,
    plaintextPersisted: false
  });
  // A senha histórica é mantida somente para detectar contas que ainda a aceitam;
  // ela não pode voltar a fazer parte do fluxo de criação de usuários.
  assert.match(server, /const LEGACY_DEFAULT_PASSWORD = 'Senha123!';/);
  assert.doesNotMatch(server, /const senha = String\(req\.body\?\.senha \|\| gerarSenhaTemporaria\(\)\)/);
  assert.doesNotMatch(client, /Senha123/);
  assert.match(server, /app\.post\('\/api\/admin\/criar-usuario', verificarToken, async \(req, res\) => \{[\s\S]*?usuarioAdmin\?\.admin/);
  assert.match(server, /const senha = gerarSenhaTemporaria\(\);[\s\S]*?const senhaHash = await bcrypt\.hash\(senha, 10\);[\s\S]*?senha: senhaHash/);
  assert.match(server, /res\.json\(\{ mensagem: 'Usuario criado com sucesso', senha_temporaria: senha \}\)/);
  assert.doesNotMatch(server, /senha_temporaria[\s\S]{0,250}db\.save/);
  assert.doesNotMatch(server, /senha_painel:\s*String\(u\.senha_painel/);
});

test('redefinição administrativa é individual, sinaliza somente a senha legada e invalida sessões anteriores', () => {
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'chatinterno-session-version-'));
  const secretKey = crypto.randomBytes(48).toString('base64url');
  const script = `
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');
    const { criarTokenUsuario, gerarSenhaTemporaria, versaoSessaoUsuario } = require(${JSON.stringify(path.join(root, 'server-simple.js'))});
    (async () => {
      const user = { id: 17, email: 'usuario@exemplo.invalid', admin: 0, auth_version: 0 };
      const previous = criarTokenUsuario(user);
      user.auth_version += 1;
      const current = criarTokenUsuario(user);
      const temporary = gerarSenhaTemporaria();
      const hash = await bcrypt.hash(temporary, 10);
      process.stdout.write('SESSION_VERSION_RESULT=' + JSON.stringify({
        previousVersion: jwt.verify(previous, process.env.SECRET_KEY).auth_version,
        currentVersion: jwt.verify(current, process.env.SECRET_KEY).auth_version,
        currentUserVersion: versaoSessaoUsuario(user),
        previousRejectedByVersion: Number(jwt.verify(previous, process.env.SECRET_KEY).auth_version) !== versaoSessaoUsuario(user),
        temporaryMatches: await bcrypt.compare(temporary, hash),
        legacyRejected: !(await bcrypt.compare('Senha123!', hash))
      }) + '\\n');
    })();
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SECRET_KEY: secretKey, CHAT_INTERNO_AI_EVAL: 'true', STORAGE_ROOT: runtime }
  });
  fs.rmSync(runtime, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  const line = `${result.stdout}`.split(/\r?\n/).find((item) => item.startsWith('SESSION_VERSION_RESULT='));
  assert.ok(line, result.stdout);
  assert.deepEqual(JSON.parse(line.slice('SESSION_VERSION_RESULT='.length)), {
    previousVersion: 0,
    currentVersion: 1,
    currentUserVersion: 1,
    previousRejectedByVersion: true,
    temporaryMatches: true,
    legacyRejected: true
  });
  assert.match(server, /app\.post\('\/api\/admin\/usuarios\/:id\/redefinir-senha', verificarToken, async \(req, res\) => \{[\s\S]*?usuarioAdmin\?\.admin[\s\S]*?invalidarSessoesUsuario\(usuario\)[\s\S]*?senha_temporaria/);
  assert.match(server, /senha_antiga_precisa_redefinir: await senhaLegadaPrecisaRedefinir\(u\)/);
  assert.match(server, /Number\(decoded\.auth_version \|\| 0\) !== versaoSessaoUsuario\(usuario\)/);
  assert.match(server, /io\.sockets\.sockets\.get\(socketId\)\?\.disconnect\(true\)/);
  assert.match(client, /exibirSenhaTemporariaAdministrador[\s\S]*?passwordValue\.textContent = ''[\s\S]*?senha = ''[\s\S]*?modal\.remove\(\)/);
  assert.match(client, /navigator\.clipboard\.writeText\(senha\)/);
  assert.doesNotMatch(client, /senha_temporaria[\s\S]{0,300}(?:localStorage|sessionStorage)/);
});
