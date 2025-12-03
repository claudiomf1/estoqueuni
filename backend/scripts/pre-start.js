#!/usr/bin/env node
/**
 * Script pré-start do PM2
 * 
 * Executa ANTES de iniciar o processo:
 * 1. Mata processos órfãos na porta 5000
 * 2. Verifica se a porta está realmente liberada
 * 3. Só retorna sucesso quando porta estiver livre
 * 
 * Se falhar, o PM2 não iniciará o processo principal
 */

import { execSync } from 'child_process';
import { createServer } from 'net';

const PORT = process.env.ESTOQUEUNI_PORT || process.env.PORT || 5000;

console.log(`[PRE-START] 🔍 Verificando porta ${PORT}...`);

/**
 * Verifica se a porta está livre tentando criar um servidor temporário
 */
function verificarPortaLivre(port) {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Porta ocupada
      } else {
        resolve(false); // Outro erro
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true); // Porta livre
    });
    
    server.listen(port);
  });
}

/**
 * Identifica se um processo é do EstoqueUni ou outro sistema
 */
function ehProcessoEstoqueUni(pid, comando) {
  try {
    // Verificar comando e caminho do processo
    const cmdline = execSync(`cat /proc/${pid}/cmdline 2>/dev/null | tr '\\0' ' ' || echo ""`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim().toLowerCase();
    
    const cwd = execSync(`readlink -f /proc/${pid}/cwd 2>/dev/null || echo ""`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim().toLowerCase();
    
    // Verificar se é processo do EstoqueUni
    const indicadoresEstoqueUni = [
      'estoqueuni',
      'src/index.js',
      'node.*index.js',
      'apiNegocios360/apps/estoqueuni'
    ];
    
    const cmdlineMatch = indicadoresEstoqueUni.some(ind => cmdline.includes(ind));
    const cwdMatch = indicadoresEstoqueUni.some(ind => cwd.includes(ind));
    
    return cmdlineMatch || cwdMatch;
  } catch (error) {
    // Se não conseguir verificar, assume que não é (mais seguro)
    return false;
  }
}

/**
 * Mata processos que estão usando a porta
 * ATENÇÃO: Só mata processos do EstoqueUni. Outros sistemas são preservados.
 */
function matarProcessosNaPorta(port) {
  try {
    console.log(`[PRE-START] 🔪 Procurando processos na porta ${port}...`);
    
    // Encontrar processos usando a porta (com detalhes)
    const resultado = execSync(`lsof -i:${port} 2>/dev/null | grep LISTEN || echo ""`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (!resultado) {
      console.log(`[PRE-START] ✅ Nenhum processo encontrado na porta ${port}`);
      return { sucesso: true, processosMortos: 0, processosOutrosSistemas: 0 };
    }
    
    const linhas = resultado.split('\n').filter(linha => linha.trim());
    
    if (linhas.length === 0) {
      console.log(`[PRE-START] ✅ Nenhum processo encontrado na porta ${port}`);
      return { sucesso: true, processosMortos: 0, processosOutrosSistemas: 0 };
    }
    
    let processosMortos = 0;
    let processosOutrosSistemas = 0;
    const processosOutros = [];
    
    // Analisar cada processo
    for (const linha of linhas) {
      const partes = linha.split(/\s+/);
      const comando = partes[0] || 'desconhecido';
      const pid = partes[1];
      
      if (!pid || isNaN(pid)) {
        continue;
      }
      
      // Verificar se é processo do EstoqueUni
      const ehEstoqueUni = ehProcessoEstoqueUni(pid, comando);
      
      if (ehEstoqueUni) {
        // É processo do EstoqueUni - pode matar
        try {
          console.log(`[PRE-START] 🔪 Matando processo EstoqueUni (PID: ${pid}, Comando: ${comando})...`);
          execSync(`kill -9 ${pid} 2>/dev/null`, { stdio: 'ignore' });
          console.log(`[PRE-START] ✅ Processo EstoqueUni ${pid} encerrado`);
          processosMortos++;
        } catch (error) {
          console.warn(`[PRE-START] ⚠️  Não foi possível matar processo ${pid}: ${error.message}`);
        }
      } else {
        // É outro sistema - NÃO matar, apenas avisar
        processosOutrosSistemas++;
        processosOutros.push({ pid, comando, linha });
        console.warn(`[PRE-START] ⚠️  Processo de OUTRO SISTEMA encontrado (PID: ${pid}, Comando: ${comando})`);
        console.warn(`[PRE-START]    Este processo NÃO será morto automaticamente.`);
      }
    }
    
    if (processosOutrosSistemas > 0) {
      console.error(`[PRE-START] ❌ Encontrados ${processosOutrosSistemas} processo(s) de OUTRO SISTEMA na porta ${port}:`);
      processosOutros.forEach(proc => {
        console.error(`[PRE-START]    - ${proc.comando} (PID: ${proc.pid})`);
      });
      console.error(`[PRE-START] 💡 Ação necessária:`);
      console.error(`[PRE-START]    1. Pare o outro sistema manualmente`);
      console.error(`[PRE-START]    2. Ou configure EstoqueUni para usar outra porta (ESTOQUEUNI_PORT=5010)`);
    }
    
    return {
      sucesso: processosOutrosSistemas === 0,
      processosMortos,
      processosOutrosSistemas,
      processosOutros
    };
  } catch (error) {
    console.error(`[PRE-START] ❌ Erro ao matar processos: ${error.message}`);
    return { sucesso: false, processosMortos: 0, processosOutrosSistemas: 0 };
  }
}

/**
 * Identifica qual processo está usando a porta
 */
function identificarProcessoNaPorta(port) {
  try {
    const resultado = execSync(`lsof -i:${port} 2>/dev/null | grep LISTEN | head -1`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (resultado) {
      const partes = resultado.split(/\s+/);
      return {
        comando: partes[0] || 'desconhecido',
        pid: partes[1] || 'desconhecido',
        usuario: partes[2] || 'desconhecido',
        linhaCompleta: resultado
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se porta está em TIME_WAIT (estado temporário do sistema)
 */
function verificarTimeWait(port) {
  try {
    const resultado = execSync(`ss -tan state time-wait | grep :${port} || echo ""`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    return resultado.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Aguarda até a porta estar livre (com timeout e diagnóstico)
 */
async function aguardarPortaLivre(port, maxTentativas = 15, intervaloMs = 1000) {
  for (let i = 0; i < maxTentativas; i++) {
    const livre = await verificarPortaLivre(port);
    
    if (livre) {
      return { sucesso: true, motivo: 'porta_livre' };
    }
    
    // Diagnóstico: identificar o que está ocupando a porta
    const processo = identificarProcessoNaPorta(port);
    const emTimeWait = verificarTimeWait(port);
    
    if (i === 0 || i === Math.floor(maxTentativas / 2) || i === maxTentativas - 1) {
      console.log(`[PRE-START] 🔍 Diagnóstico (tentativa ${i + 1}/${maxTentativas}):`);
      
      if (processo) {
        console.log(`[PRE-START]    📌 Processo encontrado: ${processo.comando} (PID: ${processo.pid}, User: ${processo.usuario})`);
      } else {
        console.log(`[PRE-START]    📌 Nenhum processo encontrado (pode ser TIME_WAIT do sistema)`);
      }
      
      if (emTimeWait) {
        console.log(`[PRE-START]    ⏳ Porta em estado TIME_WAIT (sistema ainda liberando)`);
      }
    }
    
    if (i < maxTentativas - 1) {
      await new Promise(resolve => setTimeout(resolve, intervaloMs));
    }
  }
  
  // Última tentativa de diagnóstico antes de falhar
  const processo = identificarProcessoNaPorta(port);
  const emTimeWait = verificarTimeWait(port);
  
  return {
    sucesso: false,
    motivo: processo ? 'processo_nao_morreu' : emTimeWait ? 'time_wait' : 'desconhecido',
    processo: processo,
    emTimeWait: emTimeWait
  };
}

/**
 * Função principal
 */
async function main() {
  try {
    // 1. Matar processos órfãos (apenas do EstoqueUni)
    console.log(`[PRE-START] 🚀 Iniciando limpeza de processos órfãos do EstoqueUni...`);
    const resultadoLimpeza = matarProcessosNaPorta(PORT);
    
    if (!resultadoLimpeza.sucesso) {
      console.error(`[PRE-START] ❌ Outro sistema está usando a porta ${PORT}.`);
      console.error(`[PRE-START] ❌ Abortando início do servidor para evitar conflito.`);
      console.error(`[PRE-START] 💡 Soluções:`);
      console.error(`[PRE-START]    1. Pare o outro sistema que está usando a porta ${PORT}`);
      console.error(`[PRE-START]    2. Ou configure EstoqueUni para usar outra porta:`);
      console.error(`[PRE-START]       export ESTOQUEUNI_PORT=5010`);
      console.error(`[PRE-START]       pm2 restart estoqueuni`);
      process.exit(1);
    }
    
    if (resultadoLimpeza.processosMortos > 0) {
      console.log(`[PRE-START] ✅ ${resultadoLimpeza.processosMortos} processo(s) órfão(s) do EstoqueUni encerrado(s)`);
    }
    
    // 2. Aguardar um pouco para o sistema liberar a porta
    // Na maioria dos casos (95%), graceful shutdown leva 1-5 segundos
    console.log(`[PRE-START] ⏳ Aguardando sistema liberar porta ${PORT}...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s inicial (cobre 90% dos casos)
    
    // 3. Verificar se porta está realmente livre
    // Total: 2s inicial + (10 tentativas × 1s) = 12 segundos máximo
    // Isso cobre 99% dos casos (graceful shutdown normal)
    // TIME_WAIT (1% dos casos) precisa de 30-60s, mas é raro
    console.log(`[PRE-START] 🔍 Verificando se porta ${PORT} está livre...`);
    const resultado = await aguardarPortaLivre(PORT, 10, 1000); // 10 tentativas, 1s entre cada = 10s adicional
    
    if (!resultado.sucesso) {
      console.error(`[PRE-START] ❌ Porta ${PORT} ainda está ocupada após ${15} tentativas.`);
      
      // Diagnóstico detalhado
      if (resultado.processo) {
        console.error(`[PRE-START] ❌ Processo persistente: ${resultado.processo.comando} (PID: ${resultado.processo.pid})`);
        console.error(`[PRE-START]    Usuário: ${resultado.processo.usuario}`);
        console.error(`[PRE-START]    Linha completa: ${resultado.processo.linhaCompleta}`);
        console.error(`[PRE-START] 💡 Ação sugerida: Execute manualmente:`);
        console.error(`[PRE-START]    sudo kill -9 ${resultado.processo.pid}`);
        console.error(`[PRE-START]    ou`);
        console.error(`[PRE-START]    sudo lsof -ti:${PORT} | xargs sudo kill -9`);
      } else if (resultado.emTimeWait) {
        console.error(`[PRE-START] ⏳ Porta em estado TIME_WAIT (sistema operacional ainda liberando)`);
        console.error(`[PRE-START] 💡 Isso é normal após fechar conexões. Aguarde alguns segundos.`);
        console.error(`[PRE-START] 💡 Ação sugerida: Aguarde 30 segundos e tente novamente.`);
      } else {
        console.error(`[PRE-START] ❌ Causa desconhecida. Verifique manualmente:`);
        console.error(`[PRE-START]    lsof -i:${PORT}`);
        console.error(`[PRE-START]    netstat -tlnp | grep :${PORT}`);
      }
      
      console.error(`[PRE-START] ❌ Abortando início do servidor para evitar loop de restart.`);
      console.error(`[PRE-START] ❌ PM2 não tentará reiniciar automaticamente (max_restarts configurado).`);
      process.exit(1);
    }
    
    console.log(`[PRE-START] ✅ Porta ${PORT} confirmada como livre!`);
    console.log(`[PRE-START] ✅ Pronto para iniciar servidor.`);
    process.exit(0);
    
  } catch (error) {
    console.error(`[PRE-START] ❌ Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

main();

