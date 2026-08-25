const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const assets = [
  { file: 'assets/app.min.css', pattern: /(href="\/assets\/app\.min\.css\?v=)[^"]+("\s*\/?>)/ },
  { file: 'assets/app.min.js', pattern: /(src="\/assets\/app\.min\.js\?v=)[^"]+("\s*><\/script>)/ }
];

function revisionFor(file) {
  const content = fs.readFileSync(path.join(root, file));
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function atualizarRevisoes() {
  const original = fs.readFileSync(indexPath, 'utf8');
  let updated = original;
  const revisions = {};

  for (const asset of assets) {
    const revision = revisionFor(asset.file);
    revisions[asset.file] = revision;
    if (!asset.pattern.test(updated)) {
      throw new Error(`Referência versionada não encontrada no index.html: ${asset.file}`);
    }
    updated = updated.replace(asset.pattern, `$1${revision}$2`);
  }

  if (process.argv.includes('--check')) {
    if (updated !== original) throw new Error('As revisões dos assets estão desatualizadas. Execute npm run build.');
    return revisions;
  }

  if (updated !== original) fs.writeFileSync(indexPath, updated, 'utf8');
  return revisions;
}

try {
  const revisions = atualizarRevisoes();
  console.log(`Assets revisionados: css=${revisions['assets/app.min.css']} js=${revisions['assets/app.min.js']}`);
} catch (error) {
  console.error(`Falha ao revisar assets: ${error.message}`);
  process.exitCode = 1;
}
