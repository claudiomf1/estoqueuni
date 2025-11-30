import React, { useState, useEffect } from 'react';
import { Modal, Button, ProgressBar, Form, Alert, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { CheckCircle, ArrowRight, Link45deg } from 'react-bootstrap-icons';
import { sincronizacaoApi } from '../../../services/sincronizacaoApi';

import { TOTAL_PASSOS, URL_BLING_WEBHOOKS, TEMPO_VERIFICACAO_WEBHOOK } from './constantes';
import {
  copiarUrl,
  abrirBling,
  voltarPasso,
  proximoPasso,
  obterStatusWebhookFinal,
  filtrarContasBlingAtivas
} from './manipuladores';

import Passo1Introducao from './componentes/Passo1Introducao';
import Passo2CopiarUrl from './componentes/Passo2CopiarUrl';
import Passo3AbrirBling from './componentes/Passo3AbrirBling';
import Passo4ConfigurarServidor from './componentes/Passo4ConfigurarServidor';
import Passo5AtivarWebhooks from './componentes/Passo5AtivarWebhooks';
import Passo6Verificacao from './componentes/Passo6Verificacao';

/**
 * Wizard Assistente para Configurar Webhooks do Bling
 * 
 * Guia o usuário passo a passo na configuração manual dos webhooks,
 * já que o Bling não oferece API para isso.
 */
export default function WizardAssistenteWebhook({ 
  mostrar, 
  onFechar, 
  urlWebhook, 
  tenantId,
  ultimaRequisicao,
  contasBling = [],
  webhookFuncionando = false,
  onContaConfigurada
}) {
  const [passoAtual, setPassoAtual] = useState(1);
  const [contaSelecionada, setContaSelecionada] = useState('');
  const [urlCopiada, setUrlCopiada] = useState(false);
  const [urlBlingAberta, setUrlBlingAberta] = useState(false);
  const [servidorConfigurado, setServidorConfigurado] = useState(false);
  const [pedidosVendasAtivado, setPedidosVendasAtivado] = useState(false);
  const [produtosAtivado, setProdutosAtivado] = useState(false);
  const [estoquesAtivado, setEstoquesAtivado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Calcular progresso
  const progresso = (passoAtual / TOTAL_PASSOS) * 100;

  // Contar contas Bling ativas
  const contasBlingAtivas = filtrarContasBlingAtivas(contasBling);
  
  // Encontrar conta selecionada
  const contaAtual = contasBlingAtivas.find(
    conta => (conta.blingAccountId || conta._id || conta.id) === contaSelecionada
  );

  // Handlers
  const handleCopiarUrl = () => {
    copiarUrl(urlWebhook, setUrlCopiada);
  };

  const handleAbrirBling = () => {
    abrirBling(URL_BLING_WEBHOOKS, setUrlBlingAberta);
  };

  const handleVoltar = () => {
    voltarPasso(passoAtual, setPassoAtual);
  };

  // Verificar se pode avançar do passo atual
  const podeAvancar = () => {
    if (!contaSelecionada) {
      return { pode: false, motivo: 'Selecione uma conta Bling para continuar' };
    }

    // Passo 2: Precisa ter copiado a URL
    if (passoAtual === 2 && !urlCopiada) {
      return { pode: false, motivo: 'Você precisa clicar em "Copiar URL" antes de avançar' };
    }

    // Passo 3: Precisa ter aberto o Bling
    if (passoAtual === 3 && !urlBlingAberta) {
      return { pode: false, motivo: 'Você precisa clicar em "Abrir Bling em Nova Aba" antes de avançar' };
    }

    // Passo 4: Precisa ter configurado o servidor
    if (passoAtual === 4 && !servidorConfigurado) {
      return { pode: false, motivo: 'Você precisa clicar em "Já configurei o servidor" antes de avançar' };
    }

    // Passo 5: Precisa ter ativado todos os 3 webhooks
    if (passoAtual === 5) {
      if (!pedidosVendasAtivado) {
        return { pode: false, motivo: 'Você precisa marcar "Pedidos de Vendas" como ativado antes de avançar' };
      }
      if (!produtosAtivado) {
        return { pode: false, motivo: 'Você precisa marcar "Produtos" como ativado antes de avançar' };
      }
      if (!estoquesAtivado) {
        return { pode: false, motivo: 'Você precisa marcar "Estoques" como ativado antes de avançar' };
      }
    }

    return { pode: true, motivo: '' };
  };

  const handleProximo = () => {
    const validacao = podeAvancar();
    if (!validacao.pode) {
      return;
    }
    proximoPasso(passoAtual, TOTAL_PASSOS, setPassoAtual);
  };

  // Verificar se todas as etapas estão concluídas e salvar automaticamente
  const [jaSalvou, setJaSalvou] = useState(false);
  
  useEffect(() => {
    const salvarSeTodasConcluidas = async () => {
      if (!contaSelecionada || salvando || jaSalvou) return;
      
      const todasConcluidas = servidorConfigurado && 
                              pedidosVendasAtivado && 
                              produtosAtivado && 
                              estoquesAtivado;
      
      if (todasConcluidas) {
        try {
          setSalvando(true);
          await sincronizacaoApi.marcarContaWebhookConfigurada(tenantId, contaSelecionada);
          
          // Chamar callback se fornecido
          if (onContaConfigurada) {
            onContaConfigurada(contaSelecionada);
          }
          
          setJaSalvou(true);
          setSalvando(false);
        } catch (error) {
          console.error('Erro ao salvar progresso:', error);
          setSalvando(false);
        }
      }
    };

    salvarSeTodasConcluidas();
  }, [servidorConfigurado, pedidosVendasAtivado, produtosAtivado, estoquesAtivado, contaSelecionada, tenantId, onContaConfigurada, salvando, jaSalvou]);
  
  // Resetar flag quando conta selecionada mudar
  useEffect(() => {
    setJaSalvou(false);
  }, [contaSelecionada]);

  const handleServidorConfigurado = () => {
    setServidorConfigurado(true);
  };

  const handlePedidosVendasAtivado = () => {
    setPedidosVendasAtivado(true);
  };

  const handleProdutosAtivado = () => {
    setProdutosAtivado(true);
  };

  const handleEstoquesAtivado = () => {
    setEstoquesAtivado(true);
  };

  // Resetar estado quando modal abrir
  useEffect(() => {
    if (mostrar) {
      setPassoAtual(1);
      setContaSelecionada('');
      setUrlCopiada(false);
      setUrlBlingAberta(false);
      setServidorConfigurado(false);
      setPedidosVendasAtivado(false);
      setProdutosAtivado(false);
      setEstoquesAtivado(false);
      setSalvando(false);
      setJaSalvou(false);
    }
  }, [mostrar]);

  const handleFinalizar = async () => {
    if (!contaSelecionada) {
      return;
    }

    setSalvando(true);
    try {
      const blingAccountId = contaSelecionada;
      await sincronizacaoApi.marcarContaWebhookConfigurada(tenantId, blingAccountId);
      
      // Chamar callback se fornecido
      if (onContaConfigurada) {
        onContaConfigurada(blingAccountId);
      }
      
      // Resetar estados
      setPassoAtual(1);
      setUrlCopiada(false);
      setUrlBlingAberta(false);
      setServidorConfigurado(false);
      setPedidosVendasAtivado(false);
      setProdutosAtivado(false);
      setEstoquesAtivado(false);
      setSalvando(false);
      
      onFechar();
    } catch (error) {
      console.error('Erro ao marcar conta como configurada:', error);
      setSalvando(false);
      // Ainda fecha o modal mesmo com erro
      onFechar();
    }
  };

  // Verificar se webhook está funcionando
  const webhookFuncionandoFinal = obterStatusWebhookFinal(
    webhookFuncionando,
    ultimaRequisicao,
    TEMPO_VERIFICACAO_WEBHOOK
  );

  return (
    <Modal show={mostrar} onHide={onFechar} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <Link45deg className="me-2" />
          Assistente de Configuração de Notificações Automáticas (Webhook)
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Barra de Progresso */}
        <div className="mb-4">
          <div className="d-flex justify-content-between mb-2">
            <small className="text-muted">Passo {passoAtual} de {TOTAL_PASSOS}</small>
            <small className="text-muted">{Math.round(progresso)}% concluído</small>
          </div>
          <ProgressBar now={progresso} variant="success" />
        </div>

        {/* Seleção de conta - sempre visível no topo */}
        <div className="mb-4">
          <Form.Group>
            <Form.Label>
              <strong>Selecione a Conta Bling para Configurar:</strong>
            </Form.Label>
            <Form.Select
              value={contaSelecionada}
              onChange={(e) => setContaSelecionada(e.target.value)}
              disabled={salvando}
            >
              <option value="">-- Selecione uma conta --</option>
              {contasBlingAtivas.map((conta) => {
                const contaId = conta.blingAccountId || conta._id || conta.id;
                const contaNome = conta.accountName || conta.store_name || 'Conta sem nome';
                return (
                  <option key={contaId} value={contaId}>
                    {contaNome} {conta.webhookConfigurado ? '(✓ Já configurada)' : ''}
                  </option>
                );
              })}
            </Form.Select>
            {contaSelecionada && contaAtual && (
              <Alert variant="success" className="mt-2 mb-0">
                <strong>✓ Conta selecionada:</strong> {contaAtual.accountName || contaAtual.store_name || 'Conta sem nome'}
                {contaAtual.webhookConfigurado && (
                  <span className="ms-2">(Já configurada anteriormente)</span>
                )}
              </Alert>
            )}
            {!contaSelecionada && (
              <Alert variant="warning" className="mt-2 mb-0">
                ⚠️ Selecione uma conta Bling para continuar com a configuração.
              </Alert>
            )}
          </Form.Group>
        </div>

        {/* Bloquear passos se não tiver conta selecionada */}
        {!contaSelecionada ? (
          <Alert variant="info" className="mb-0">
            <strong>📌 Selecione uma conta Bling acima para começar a configuração.</strong>
          </Alert>
        ) : (
          <>
            {/* Mostrar conta selecionada em todos os passos */}
            {contaAtual && (
              <Alert variant="primary" className="mb-3">
                <strong>📌 Configurando para:</strong> {contaAtual.accountName || contaAtual.store_name || 'Conta sem nome'}
              </Alert>
            )}

            {/* Renderizar passo atual */}
            {passoAtual === 1 && (
              <Passo1Introducao 
                contasBlingAtivas={contasBlingAtivas}
                contaSelecionada={contaSelecionada}
                contaAtual={contaAtual}
              />
            )}

            {passoAtual === 2 && (
              <Passo2CopiarUrl 
                urlWebhook={urlWebhook}
                urlCopiada={urlCopiada}
                onCopiarUrl={handleCopiarUrl}
              />
            )}

            {passoAtual === 3 && (
              <Passo3AbrirBling
                urlBlingWebhooks={URL_BLING_WEBHOOKS}
                urlBlingAberta={urlBlingAberta}
                onAbrirBling={handleAbrirBling}
                contasBlingAtivas={contasBlingAtivas}
                contaAtual={contaAtual}
              />
            )}

            {passoAtual === 4 && (
              <Passo4ConfigurarServidor
                urlWebhook={urlWebhook}
                servidorConfigurado={servidorConfigurado}
                onServidorConfigurado={handleServidorConfigurado}
                contaAtual={contaAtual}
              />
            )}

            {passoAtual === 5 && (
              <Passo5AtivarWebhooks
                contasBlingAtivas={contasBlingAtivas}
                pedidosVendasAtivado={pedidosVendasAtivado}
                produtosAtivado={produtosAtivado}
                estoquesAtivado={estoquesAtivado}
                onPedidosVendasAtivado={handlePedidosVendasAtivado}
                onProdutosAtivado={handleProdutosAtivado}
                onEstoquesAtivado={handleEstoquesAtivado}
                contaAtual={contaAtual}
              />
            )}

            {passoAtual === 6 && (
              <Passo6Verificacao
                webhookFuncionandoFinal={webhookFuncionandoFinal}
                ultimaRequisicao={ultimaRequisicao}
                contasBlingAtivas={contasBlingAtivas}
                contaAtual={contaAtual}
              />
            )}
          </>
        )}

      </Modal.Body>
      <Modal.Footer>
        <div className="w-100 d-flex justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={handleVoltar}
            disabled={passoAtual === 1}
          >
            ← Voltar
          </Button>
          
          <div>
            {passoAtual < TOTAL_PASSOS ? (() => {
              const validacao = podeAvancar();
              
              const botao = (
                <Button
                  variant="primary"
                  onClick={handleProximo}
                  disabled={!validacao.pode}
                  style={!validacao.pode ? { pointerEvents: 'none' } : {}}
                >
                  Próximo <ArrowRight className="ms-2" />
                </Button>
              );

              if (!validacao.pode && validacao.motivo) {
                return (
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id="tooltip-proximo-bloqueado">
                        {validacao.motivo}
                      </Tooltip>
                    }
                  >
                    <span className="d-inline-block" style={{ cursor: 'not-allowed' }}>
                      {botao}
                    </span>
                  </OverlayTrigger>
                );
              }

              return botao;
            })() : (
              <Button
                variant="success"
                onClick={handleFinalizar}
                disabled={salvando || !contaSelecionada}
              >
                {salvando ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="me-2" />
                    Finalizar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

