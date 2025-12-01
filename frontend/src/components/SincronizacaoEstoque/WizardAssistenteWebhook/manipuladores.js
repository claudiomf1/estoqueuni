/**
 * Funções de manipulação do Wizard Assistente Webhook
 */

/**
 * Copia a URL do webhook para a área de transferência
 */
export function copiarUrl(urlWebhook, setUrlCopiada) {
  navigator.clipboard.writeText(urlWebhook);
  setUrlCopiada(true);
  setTimeout(() => setUrlCopiada(false), 3000);
}

/**
 * Abre a página do Bling em nova aba
 */
export function abrirBling(urlBlingWebhooks, setUrlBlingAberta) {
  window.open(urlBlingWebhooks, '_blank');
  setUrlBlingAberta(true);
}

/**
 * Volta para o passo anterior
 */
export function voltarPasso(passoAtual, setPassoAtual) {
  if (passoAtual > 1) {
    setPassoAtual(passoAtual - 1);
  }
}

/**
 * Avança para o próximo passo
 */
export function proximoPasso(passoAtual, totalPassos, setPassoAtual) {
  if (passoAtual < totalPassos) {
    setPassoAtual(passoAtual + 1);
  }
}

/**
 * Finaliza o wizard e reseta os estados
 */
export function finalizarWizard(
  onFechar,
  setPassoAtual,
  setUrlCopiada,
  setUrlBlingAberta,
  setServidorConfigurado,
  setPedidosVendasAtivado,
  setProdutosAtivado,
  setEstoquesAtivado
) {
  onFechar();
  setPassoAtual(1);
  setUrlCopiada(false);
  setUrlBlingAberta(false);
  setServidorConfigurado(false);
  setPedidosVendasAtivado(false);
  setProdutosAtivado(false);
  setEstoquesAtivado(false);
}

/**
 * Verifica se o webhook está funcionando localmente
 */
export function verificarWebhookFuncionandoLocal(ultimaRequisicao, tempoVerificacao) {
  if (!ultimaRequisicao) return false;
  const tempoAtras = new Date(Date.now() - tempoVerificacao);
  const ultimaReq = new Date(ultimaRequisicao);
  return ultimaReq > tempoAtras;
}

/**
 * Obtém o status final do webhook
 */
export function obterStatusWebhookFinal(webhookFuncionando, ultimaRequisicao, tempoVerificacao) {
  if (webhookFuncionando !== undefined) {
    return webhookFuncionando;
  }
  return verificarWebhookFuncionandoLocal(ultimaRequisicao, tempoVerificacao);
}

/**
 * Filtra contas Bling ativas
 */
export function filtrarContasBlingAtivas(contasBling) {
  return contasBling.filter(conta => conta.isActive !== false);
}





