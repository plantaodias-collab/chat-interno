# Chat Interno

Aplicação web de comunicação interna com Express, Socket.IO e interface em HTML, CSS e JavaScript. A interface reúne conversas individuais, grupos e canais em uma barra lateral; o histórico, os arquivos e as threads usam o mesmo armazenamento e as mesmas regras de acesso.

## Conversas

- **Canais públicos:** disponíveis aos usuários ativos. Administradores podem criá-los e editar nome, descrição e participantes.
- **Canais privados e grupos:** disponíveis somente aos participantes. Administradores podem incluir e remover participantes.
- **Mensagens:** envio em tempo real, respostas vinculadas, reações, edição e exclusão conforme as permissões atuais, anexos, busca e histórico progressivo.
- **Organização:** não lidas, favoritos, mensagens fixadas, seções recolhíveis, busca com filtros e painel de detalhes, arquivos e threads.
- **Notificações:** silêncio por conversa ou canal salvo na conta; som opcional salvo no navegador.

Grupos existentes sem campo de visibilidade mantêm a regra anterior: com participantes cadastrados são restritos; sem participantes são públicos. Nenhuma migração destrutiva é necessária.

## Execução

Requer Node.js compatível com as dependências do projeto e npm.

```bash
npm ci
npm run build
npm start
```

O servidor usa `PORT` (padrão: `3000`). Em produção, configure `SECRET_KEY` e um volume persistente em `STORAGE_ROOT` ou `RAILWAY_VOLUME_MOUNT_PATH`. O aplicativo precisa preservar o diretório `data/`, `uploads/` e os backups do volume. Não elimine arquivos de dados para tentar corrigir uma falha de inicialização.

O administrador é criado por um procedimento controlado de instalação; não existe senha padrão de usuário. O painel administrativo gera senhas temporárias individuais quando necessário.

## Testes

```bash
npm test
```

A suíte inclui testes de autenticação, backups, infraestrutura de IA e integração do chat. O teste de chat inicia um servidor com volume temporário e verifica acesso a canais, threads, arquivos, busca, silêncio e envio em tempo real por Socket.IO.

## Dados e limites atuais

Os dados operacionais são arquivos JSON no volume, não um banco SQLite. Os anexos seguem os limites de upload e retenção do servidor. A lista de arquivos no painel mostra os 200 anexos mais recentes por conversa. A busca global consulta o histórico autorizado e apresenta até 80 resultados por solicitação. Threads reutilizam o vínculo `reply_to_id`; as respostas também aparecem no histórico principal.
