/**
 * Manipuladores de eventos para configuração de depósitos
 */

/**
 * Manipula mudança em um campo de depósito
 */
export function manipularMudancaDeposito(depositos, index, field, value, setDepositos, setErro) {
  const novosDepositos = [...depositos];
  novosDepositos[index] = {
    ...novosDepositos[index],
    [field]: value
  };
  setDepositos(novosDepositos);
  setErro(null);
}

/**
 * Adiciona um novo depósito vazio
 */
export function adicionarDeposito(depositos, setDepositos) {
  setDepositos([
    ...depositos,
    {
      id: '',
      nome: '',
      tipo: 'principal',
      contaBlingId: ''
    }
  ]);
}

/**
 * Remove um depósito da lista
 */
export function removerDeposito(depositos, index, regraSincronizacao, setDepositos, setRegraSincronizacao, setErro) {
  const depositoRemovido = depositos[index];
  const novosDepositos = depositos.filter((_, i) => i !== index);
  setDepositos(novosDepositos);

  // Remover da regra de sincronização se estiver lá
  setRegraSincronizacao({
    ...regraSincronizacao,
    depositosPrincipais: regraSincronizacao.depositosPrincipais.filter(
      id => id !== depositoRemovido.id
    ),
    depositosCompartilhados: regraSincronizacao.depositosCompartilhados.filter(
      id => id !== depositoRemovido.id
    )
  });
  setErro(null);
}

/**
 * Toggle de depósito principal na regra
 */
export function alternarDepositoPrincipal(depositoId, regraSincronizacao, setRegraSincronizacao, setErro) {
  const novosPrincipais = regraSincronizacao.depositosPrincipais.includes(depositoId)
    ? regraSincronizacao.depositosPrincipais.filter(id => id !== depositoId)
    : [...regraSincronizacao.depositosPrincipais, depositoId];

  setRegraSincronizacao({
    ...regraSincronizacao,
    depositosPrincipais: novosPrincipais
  });
  setErro(null);
}

/**
 * Toggle de depósito compartilhado na regra
 */
export function alternarDepositoCompartilhado(depositoId, regraSincronizacao, setRegraSincronizacao, setErro) {
  const novosCompartilhados = regraSincronizacao.depositosCompartilhados.includes(depositoId)
    ? regraSincronizacao.depositosCompartilhados.filter(id => id !== depositoId)
    : [...regraSincronizacao.depositosCompartilhados, depositoId];

  setRegraSincronizacao({
    ...regraSincronizacao,
    depositosCompartilhados: novosCompartilhados
  });
  setErro(null);
}

/**
 * Adiciona depósito da lista do Bling
 */
export function adicionarDepositoDaLista(depositoBling, depositos, contaSelecionada, setDepositos, setErro, setMensagem) {
  // Verificar se já não está na lista
  if (depositos.some(d => d.id === depositoBling.id.toString())) {
    setErro('Este depósito já está na lista.');
    setTimeout(() => setErro(null), 3000);
    return;
  }

  // Adicionar depósito da lista do Bling
  setDepositos([
    ...depositos,
    {
      id: depositoBling.id.toString(),
      nome: depositoBling.descricao || `Depósito ${depositoBling.id}`,
      tipo: 'principal',
      contaBlingId: contaSelecionada
    }
  ]);
  setMensagem(`Depósito "${depositoBling.descricao}" adicionado com sucesso!`);
  setTimeout(() => setMensagem(null), 3000);
}

/**
 * Salva a configuração de depósitos
 */
export async function salvarConfiguracao(
  tenantId,
  depositos,
  regraSincronizacao,
  sincronizacaoGeralAtiva,
  setSalvando,
  setErro,
  setMensagem,
  sincronizacaoApi,
  onConfigUpdate
) {
  setErro(null);
  setMensagem(null);
  setSalvando(true);

  try {
    const responseSave = await sincronizacaoApi.salvarConfiguracao(tenantId, {
      depositos,
      regraSincronizacao,
      ...(typeof sincronizacaoGeralAtiva === 'boolean' ? { ativo: sincronizacaoGeralAtiva } : {})
    });

    if (responseSave.data?.success !== false) {
      setMensagem('Configuração de depósitos salva com sucesso!');
      if (onConfigUpdate) {
        onConfigUpdate(responseSave.data?.data);
      }
      setTimeout(() => setMensagem(null), 5000);
    } else {
      throw new Error(responseSave.data?.message || 'Erro ao salvar configuração');
    }
  } catch (err) {
    setErro(err.mensagem || err.message || 'Erro ao salvar configuração de depósitos');
    setTimeout(() => setErro(null), 7000);
  } finally {
    setSalvando(false);
  }
}







