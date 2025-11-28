// commit-estoqueuni.js
// Script para commit automático do EstoqueUni
import { execSync } from 'child_process';

const projectName = 'estoqueuni';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

try {
  // Verificar se há mudanças
  const status = execSync('git status --porcelain', { encoding: 'utf-8' });
  
  if (!status.trim()) {
    console.log('✅ Nenhuma mudança para commitar');
    process.exit(0);
  }

  // Criar mensagem de commit
  const commitMessage = `feat(${projectName}): atualização automática - ${timestamp}`;

  // Adicionar arquivos
  execSync('git add .', { stdio: 'inherit' });

  // Commit
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

  console.log(`✅ Commit criado: ${commitMessage}`);
} catch (error) {
  console.error('❌ Erro ao criar commit:', error.message);
  process.exit(1);
}

