/**
 * Utilitários para configuração de depósitos
 */

/**
 * Extrai lista de contas Bling de diferentes formatos de resposta
 */
export function extrairListaContas(response) {
  if (!response || !response.data) {
    return [];
  }

  const candidatos = [
    response.data.contas,
    response.data.data?.contas,
    response.data.data,
  ];

  for (const candidato of candidatos) {
    if (Array.isArray(candidato)) {
      return candidato;
    }
  }

  return [];
}

/**
 * Valida a configuração de depósitos
 */
export function validarConfiguracao(depositos, regraSincronizacao) {
  const erros = [];

  // Validar que todos os depósitos têm id e nome
  const depositosInvalidos = depositos.filter(
    d => !d.id || !d.id.trim() || !d.nome || !d.nome.trim()
  );
  if (depositosInvalidos.length > 0) {
    erros.push('Todos os depósitos devem ter um ID e nome válidos.');
  }

  // Validar IDs únicos
  const idsDuplicados = depositos.filter(
    (d, index) => depositos.findIndex(dep => dep.id === d.id) !== index
  );
  if (idsDuplicados.length > 0) {
    erros.push('Não é permitido ter IDs de depósito duplicados.');
  }

  // Validar que há pelo menos 1 depósito principal na regra
  if (regraSincronizacao.depositosPrincipais.length === 0) {
    erros.push('É necessário selecionar pelo menos um depósito principal na regra de sincronização.');
  }

  // Validar que há pelo menos 1 depósito compartilhado na regra
  if (regraSincronizacao.depositosCompartilhados.length === 0) {
    erros.push('É necessário selecionar pelo menos um depósito compartilhado na regra de sincronização.');
  }

  // Validar que os IDs da regra existem nos depósitos
  const idsDepositos = depositos.map(d => d.id);
  const idsInvalidosPrincipais = regraSincronizacao.depositosPrincipais.filter(
    id => !idsDepositos.includes(id)
  );
  const idsInvalidosCompartilhados = regraSincronizacao.depositosCompartilhados.filter(
    id => !idsDepositos.includes(id)
  );

  if (idsInvalidosPrincipais.length > 0 || idsInvalidosCompartilhados.length > 0) {
    erros.push('A regra de sincronização referencia depósitos que não existem.');
  }

  return {
    valido: erros.length === 0,
    erros
  };
}

