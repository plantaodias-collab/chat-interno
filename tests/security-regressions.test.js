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
