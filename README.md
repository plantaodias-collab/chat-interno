# Chat Interno - Aplicativo de Comunicação da Equipe

Aplicativo de chat interno para comunicação entre funcionários em rede local. Suporta grupos, mensagens privadas, notificações em tempo real e gerenciamento de usuários.

## Funcionalidades

✅ Autenticação por email e senha
✅ Salas de chat em grupos
✅ Mensagens privadas entre usuários
✅ Notificações em tempo real
✅ Painel de administração para gerenciar usuários
✅ Cadastro de usuários com senha padrão
✅ Criação de grupos
✅ Histórico de mensagens
✅ Interface web responsiva
✅ Funciona em rede local

## Deploy no Railway

O projeto agora esta pronto para deploy no Railway com persistencia em volume.

### Variaveis de ambiente

Use pelo menos estas variaveis:

```env
SECRET_KEY=sua-chave-forte
ADMIN_NOME=Administrador
ADMIN_EMAIL=admin@empresa.com
ADMIN_SENHA=TroqueEssaSenha123!
```

Observacoes:
- `PORT` e fornecida pelo Railway automaticamente.
- Se houver volume conectado, o app usa `RAILWAY_VOLUME_MOUNT_PATH` automaticamente.
- Se ainda nao existir nenhum admin ativo, o servidor cria o primeiro admin com `ADMIN_*` no boot.

### Volume

Crie um Volume no Railway e conecte ao servico.

Sugestao de mount path:

```text
/app/storage
```

Com isso, o app salva automaticamente em:
- `/app/storage/data`
- `/app/storage/uploads`

### Healthcheck

Use este endpoint para validacao:

```text
/health
```

## Requisitos

- Node.js v14 ou superior
- npm
- Conexão de rede local (pode ser na mesma máquina)

## Instalação Rápida

### 1. Extrair os arquivos
Coloque todos os arquivos em uma pasta, ex: `C:\ChatInterno`

### 2. Instalar dependências
```bash
cd C:\ChatInterno
npm install
```

### 3. Executar setup inicial
```bash
npm run setup
```

Siga as instruções para:
- Definir nome do administrador
- Definir email do administrador
- Definir senha do administrador
- (Opcional) Criar grupos de exemplo

### 4. Iniciar o servidor
```bash
npm start
```

O servidor iniciará em `http://localhost:3000`

Se quiser que outras máquinas acessem, use o IP da máquina:
`http://SEU_IP:3000`

## Uso

### Para o Administrador

1. Acesse http://localhost:3000
2. Faça login com email e senha criados no setup
3. Clique em "⚙️ Painel Admin"
4. Cadastre novos usuários (será gerada uma senha padrão)
5. Crie grupos de comunicação

### Para Funcionários

1. Receba email e senha do administrador
2. Acesse http://localhost:3000 (ou http://SEU_IP:3000)
3. Faça login com email e senha
4. Participe dos grupos
5. Envie mensagens privadas para colegas

## Estrutura de Arquivos

```
ChatInterno/
├── server.js           # Servidor backend (Express + Socket.IO)
├── index.html          # Interface web
├── package.json        # Dependências do projeto
├── setup.js            # Script de configuração inicial
├── chat.db             # Banco de dados SQLite (criado automaticamente)
└── README.md           # Este arquivo
```

## Senhas Padrão

Ao criar um usuário via painel admin, a senha padrão é: **Senha123!**

Oriente os usuários a alterar a senha no primeiro acesso (funcionalidade será adicionada).

## Acessibilidade pela Rede

### Na mesma máquina:
- http://localhost:3000

### Outra máquina na rede local:
1. Descubra o IP da máquina servidor:
   - Windows: Execute `ipconfig` no terminal
   - Procure por "IPv4 Address" na rede local (geralmente começa com 192.168 ou 10.)

2. Acesse: http://SEU_IP:3000

Exemplo: http://192.168.1.100:3000

## Solução de Problemas

### Porta 3000 já está em uso
Se a porta 3000 já está em uso, mude no server.js:
```javascript
const PORT = process.env.PORT || 3000; // Mude 3000 para outra porta
```

### Usuários não conseguem acessar de outras máquinas
- Verifique se o firewall do Windows está bloqueando
- Permita a porta 3000 no firewall
- Confirme o IP correto com `ipconfig`

### Banco de dados corrompido
Delete o arquivo `chat.db` e execute novamente:
```bash
npm run setup
npm start
```

## Funcionalidades Futuras

- Alteração de senha pelos usuários
- Upload de arquivos/imagens
- Busca de mensagens
- Perfis de usuários
- Emojis e formatação
- Salas de chamada de voz/vídeo
- Gravação de mensagens de áudio

## Suporte Técnico

Se encontrar problemas, verifique:

1. Node.js instalado corretamente: `node --version`
2. npm instalado corretamente: `npm --version`
3. Dependências instaladas: verificar pasta `node_modules`
4. Banco de dados acessível: procurar por `chat.db`
5. Porta 3000 disponível ou alterada no server.js

## Licença

Livre para uso interno.
