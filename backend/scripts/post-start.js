#!/usr/bin/env node
/**
 * Script pós-start do PM2
 * 
 * Executa DEPOIS que o processo iniciou:
 * Verifica se o servidor está respondendo corretamente
 */

import { execSync } from 'child_process';

const PORT = process.env.ESTOQUEUNI_PORT || process.env.PORT || 5000;
const HEALTH_URL = `http://localhost:${PORT}/health`;
const MAX_TENTATIVAS = 10;
const INTERVALO_MS = 1000;

console.log(`[POST-START] 🔍 Verificando saúde do servidor...`);

/**
 * Verifica se o servidor está respondendo
 */
async function verificarSaude() {
  for (let i = 0; i < MAX_TENTATIVAS; i++) {
    try {
      const resultado = execSync(`curl -s -f ${HEALTH_URL} 2>/dev/null || echo "FAIL"`, {
        encoding: 'utf-8',
        timeout: 2000
      }).trim();
      
      if (resultado && resultado !== 'FAIL' && resultado.includes('"status"')) {
        console.log(`[POST-START] ✅ Servidor está saudável!`);
        console.log(`[POST-START] 📊 Resposta: ${resultado}`);
        return true;
      }
      
      if (i < MAX_TENTATIVAS - 1) {
        console.log(`[POST-START] ⏳ Servidor ainda não respondeu, aguardando... (tentativa ${i + 1}/${MAX_TENTATIVAS})`);
        await new Promise(resolve => setTimeout(resolve, INTERVALO_MS));
      }
    } catch (error) {
      if (i < MAX_TENTATIVAS - 1) {
        console.log(`[POST-START] ⏳ Servidor ainda não respondeu, aguardando... (tentativa ${i + 1}/${MAX_TENTATIVAS})`);
        await new Promise(resolve => setTimeout(resolve, INTERVALO_MS));
      }
    }
  }
  
  return false;
}

/**
 * Função principal
 */
async function main() {
  const saudavel = await verificarSaude();
  
  if (!saudavel) {
    console.warn(`[POST-START] ⚠️  Servidor não respondeu após ${MAX_TENTATIVAS} tentativas.`);
    console.warn(`[POST-START] ⚠️  Isso pode ser normal se o servidor ainda está iniciando.`);
    // Não falha o processo, apenas avisa
  }
  
  process.exit(0);
}

main();













