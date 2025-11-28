import cron from 'node-cron';
import verificacaoEstoqueService from '../services/verificacaoEstoqueService.js';

/**
 * Job agendado para verificação periódica de estoque
 * 
 * Funcionalidades:
 * - Executa a cada X minutos (configurável por tenant, padrão: 30)
 * - Busca produtos desatualizados
 * - Detecta mudanças e sincroniza estoques
 * - Atualiza estatísticas
 * 
 * @module jobs/verificacaoEstoqueJob
 */

// Estado do job
let cronJob = null;
let isRunning = false;

/**
 * Processa verificação de estoque para todos os tenants ativos
 */
async function processarVerificacao() {
  // Evitar execuções simultâneas
  if (isRunning) {
    console.log(
      '[VERIFICACAO-ESTOQUE-JOB] ⚠️ Execução anterior ainda em andamento, pulando...'
    );
    return;
  }

  isRunning = true;

  try {
    console.log(
      '\n🔄 [VERIFICACAO-ESTOQUE-JOB] Iniciando verificação de estoque...'
    );

    // Buscar todos os tenants com cronjob ativo
    const tenantsAtivos = await verificacaoEstoqueService.buscarTenantsAtivos();

    if (!tenantsAtivos || tenantsAtivos.length === 0) {
      console.log(
        'ℹ️  [VERIFICACAO-ESTOQUE-JOB] Nenhum tenant com cronjob ativo encontrado.'
      );
      return;
    }

    console.log(
      `📋 [VERIFICACAO-ESTOQUE-JOB] Verificando ${tenantsAtivos.length} tenant(s) ativo(s)...`
    );

    let totalSincronizados = 0;
    let totalIgnorados = 0;
    let totalErros = 0;
    let tenantsComErro = [];

    // Processar cada tenant
    for (const tenantId of tenantsAtivos) {
      try {
        const resultado = await verificacaoEstoqueService.executarVerificacao(
          tenantId
        );

        if (resultado.success) {
          totalSincronizados += resultado.produtosSincronizados || 0;
          totalIgnorados += resultado.produtosIgnorados || 0;
          totalErros += resultado.erros || 0;
        } else {
          console.log(
            `⚠️  [VERIFICACAO-ESTOQUE-JOB] Tenant ${tenantId}: ${resultado.message}`
          );
        }
      } catch (error) {
        totalErros++;
        tenantsComErro.push(tenantId);
        console.error(
          `❌ [VERIFICACAO-ESTOQUE-JOB] Erro ao processar tenant ${tenantId}:`,
          error.message
        );
      }
    }

    // Resumo da execução
    console.log('\n📊 [VERIFICACAO-ESTOQUE-JOB] Resumo da execução:');
    console.log(`   ✅ Produtos sincronizados: ${totalSincronizados}`);
    console.log(`   ℹ️  Produtos ignorados: ${totalIgnorados}`);
    console.log(`   ❌ Erros: ${totalErros}`);
    console.log(`   📋 Tenants processados: ${tenantsAtivos.length}`);
    if (tenantsComErro.length > 0) {
      console.log(
        `   ⚠️  Tenants com erro: ${tenantsComErro.join(', ')}`
      );
    }
    console.log(
      '✅ [VERIFICACAO-ESTOQUE-JOB] Verificação concluída.\n'
    );
  } catch (error) {
    console.error(
      '❌ [VERIFICACAO-ESTOQUE-JOB] Erro crítico na execução do job:',
      error
    );
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o job de verificação de estoque
 * 
 * O job executa a cada minuto e verifica quais tenants precisam ser processados
 * baseado no intervalo configurado de cada um
 * 
 * @returns {Object} Referência ao cron job
 */
export function iniciarCronjob() {
  if (cronJob) {
    console.log(
      '⚠️  [VERIFICACAO-ESTOQUE-JOB] Job já está em execução. Parando antes de reiniciar...'
    );
    pararCronjob();
  }

  console.log('\n🚀 [VERIFICACAO-ESTOQUE-JOB] Iniciando job de verificação de estoque...');
  console.log('   Intervalo: A cada minuto (verifica tenants baseado em configuração individual)');
  console.log(
    `   Próxima execução: ${new Date(Date.now() + 60000).toLocaleString()}\n`
  );

  // Executar a cada minuto
  // O service interno verifica o intervalo configurado de cada tenant
  cronJob = cron.schedule('* * * * *', async () => {
    await processarVerificacao();
  });

  // Executar imediatamente na primeira vez (após 5 segundos para dar tempo do servidor inicializar)
  setTimeout(() => {
    processarVerificacao();
  }, 5000);

  // Adicionar handlers para limpar ao desligar
  process.on('SIGTERM', () => {
    console.log(
      '\n⚠️  [VERIFICACAO-ESTOQUE-JOB] Recebido SIGTERM, parando job...'
    );
    pararCronjob();
  });

  process.on('SIGINT', () => {
    console.log(
      '\n⚠️  [VERIFICACAO-ESTOQUE-JOB] Recebido SIGINT, parando job...'
    );
    pararCronjob();
  });

  return cronJob;
}

/**
 * Para o job de verificação de estoque
 */
export function pararCronjob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('✅ [VERIFICACAO-ESTOQUE-JOB] Job parado com sucesso.');
  }
}

/**
 * Executa o job uma única vez (útil para testes)
 */
export async function executarUmaVez() {
  console.log('\n🔧 [VERIFICACAO-ESTOQUE-JOB] Executando manualmente...\n');
  await processarVerificacao();
}

// Exportar para uso no app principal
export default {
  iniciarCronjob,
  pararCronjob,
  executarUmaVez,
};


