const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const STORAGE_ROOT = process.env.STORAGE_ROOT || process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.RAILWAY_ENVIRONMENT ? path.join(os.tmpdir(), 'chatinterno') : __dirname);
const DATA_DIR = path.join(STORAGE_ROOT, 'data');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const pergunta = (texto) => {
  return new Promise((resolve) => {
    rl.question(texto, (resposta) => {
      resolve(resposta);
    });
  });
};

const criarDiretorio = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[✓] Diretório de dados criado');
  }
};

const criarAdministrador = async () => {
  console.log('\n=== CONFIGURAÇÃO DO ADMINISTRADOR ===\n');

  const nome = await pergunta('Nome do administrador: ');
  const email = await pergunta('E-mail do administrador: ');
  const senha = await pergunta('Senha do administrador: ');

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuarios = [
    {
      id: 1,
      email: email,
      nome: nome,
      senha: senhaHash,
      admin: 1,
      ativo: 1,
      criado_em: new Date().toISOString()
    }
  ];

  fs.writeFileSync(
    path.join(DATA_DIR, 'usuarios.json'),
    JSON.stringify(usuarios, null, 2)
  );

  console.log('\n[✓] Administrador criado com sucesso!');
  console.log(`    E-mail: ${email}`);
  console.log(`    Nome: ${nome}\n`);
};

const criarGruposExemplo = async () => {
  const perguntaGrupos = await pergunta('Deseja criar grupos de exemplo? (s/n): ');

  if (perguntaGrupos.toLowerCase() === 's') {
    const grupos = [
      { id: 1, nome: 'Geral', descricao: 'Discussões gerais da equipe' },
      { id: 2, nome: 'Anúncios', descricao: 'Anúncios importantes' },
      { id: 3, nome: 'Suporte', descricao: 'Grupo de suporte técnico' }
    ];

    grupos.forEach(g => {
      g.criado_em = new Date().toISOString();
    });

    fs.writeFileSync(
      path.join(DATA_DIR, 'grupos.json'),
      JSON.stringify(grupos, null, 2)
    );

    for (const grupo of grupos) {
      console.log(`[✓] Grupo "${grupo.nome}" criado`);
    }
    console.log('');
  } else {
    fs.writeFileSync(
      path.join(DATA_DIR, 'grupos.json'),
      JSON.stringify([], null, 2)
    );
  }
};

const initFiles = () => {
  const files = {
    'membros.json': [],
    'mensagens.json': []
  };

  for (const [name, defaultValue] of Object.entries(files)) {
    const filePath = path.join(DATA_DIR, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }
};

const main = async () => {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   CONFIGURAÇÃO INICIAL - CHAT INTERNO   ║');
    console.log('╚════════════════════════════════════════╝\n');

    criarDiretorio();
    initFiles();
    await criarAdministrador();
    await criarGruposExemplo();

    console.log('╔════════════════════════════════════════╗');
    console.log('║   CONFIGURAÇÃO FINALIZADA COM SUCESSO   ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('Próximos passos:');
    console.log('1. Execute: npm install');
    console.log('2. Execute: npm start');
    console.log('3. Acesse: http://localhost:3000\n');

    rl.close();
  } catch (err) {
    console.error('[✗] Erro:', err.message);
    rl.close();
    process.exit(1);
  }
};

main();



