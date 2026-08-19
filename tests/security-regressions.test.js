const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
