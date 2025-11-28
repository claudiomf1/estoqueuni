# 🤖 Prompts para Agentes Paralelos - Implementação EstoqueUni

Este documento contém prompts para múltiplos agentes trabalharem em paralelo na implementação do sistema de sincronização de estoques compartilhados.

**⚠️ IMPORTANTE:** Os agentes devem **CRIAR o código**, não copiar. Os prompts contêm apenas instruções, estrutura e exemplos pequenos.

---

## 📋 Agentes Disponíveis

1. **AGENTE 1: Models** - Criar models MongoDB
2. **AGENTE 2: Webhook Receiver** - Endpoint para receber webhooks do Bling
3. **AGENTE 3: Event Processor** - Processamento assíncrono de eventos
4. **AGENTE 4: Sincronizador de Estoques** - Lógica de sincronização compartilhada
5. **AGENTE 5: Cronjob de Verificação** - Job agendado de fallback
6. **AGENTE 6: Interface Bling Connector** - Adaptar do precofacilmarket para 2 contas
7. **AGENTE 7: Interface Sincronização** - Página de gerenciamento de sincronização
8. **AGENTE 8: Rotas e Controllers** - Endpoints da API

---

## 🤖 AGENTE 1: MODELS

### 🎯 Tarefa

Criar os models MongoDB necessários para o sistema de sincronização.

### 📋 Arquivos a Criar

1. `backend/src/models/EventoProcessado.js`
2. `backend/src/models/ConfiguracaoSincronizacao.js`

### 📋 Requisitos Funcionais

#### Model: EventoProcessado

- Schema com campos:
  - `tenantId` (String, required, indexado)
  - `blingAccountId` (String) - W2I ou TechYou
  - `produtoId` (String) - ID do produto no Bling
  - `eventoId` (String) - ID do evento no Bling
  - `chaveUnica` (String, unique, indexado) - produtoId-eventoId
  - `depositoOrigem` (String) - ID do depósito que originou
  - `origem` (String, enum: ['webhook', 'cronjob', 'manual'])
  - `saldos` (Object) - { principalW2I, fornecedorW2I, principalTechYou, soma }
  - `compartilhadosAtualizados` (Object) - { compartilhadoW2I, compartilhadoTechYou }
  - `processadoEm` (Date)
  - `sucesso` (Boolean)
  - `erro` (String)
  - `createdAt`, `updatedAt` (Date, automático)

- Índices:
  - `{ chaveUnica: 1 }` (único) - Anti-duplicação
  - `{ tenantId: 1, processadoEm: -1 }` - Busca por tenant e data
  - `{ origem: 1, processadoEm: -1 }` - Busca por origem

- Métodos:
  - `static criarChaveUnica(produtoId, eventoId)` - Gera chave única

#### Model: ConfiguracaoSincronizacao

- Schema com campos:
  - `tenantId` (String, required, unique, indexado)
  - `ativo` (Boolean, default: false)
  - `depositos` (Object) - IDs dos 5 depósitos
  - `contasBling` (Object) - { w2ishop, techyou } - blingAccountIds
  - `webhook` (Object) - { url, secret, ativo, ultimaRequisicao }
  - `cronjob` (Object) - { ativo, intervaloMinutos, ultimaExecucao, proximaExecucao }
  - `ultimaSincronizacao` (Date)
  - `estatisticas` (Object) - { totalWebhooks, totalCronjobs, totalManuais, eventosPerdidos }
  - `createdAt`, `updatedAt` (Date, automático)

- Índices:
  - `{ tenantId: 1 }` (único)

- Métodos:
  - `calcularProximaExecucao()` - Calcula próxima execução do cronjob
  - `incrementarEstatistica(origem)` - Incrementa contador de estatísticas

### 📦 Referência

Siga o padrão dos models existentes:
- `backend/src/models/BlingConfig.js`
- `backend/src/models/Produto.js`

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
const schema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  chaveUnica: { type: String, unique: true, index: true },
  // ... adicione outros campos aqui
});

schema.statics.criarChaveUnica = function(produtoId, eventoId) {
  return `${produtoId}-${eventoId}`;
};
```

### ✅ Critérios de Aceite

- [ ] Arquivos criados em `backend/src/models/`
- [ ] Schemas com todos os campos obrigatórios
- [ ] Índices configurados corretamente
- [ ] Métodos implementados
- [ ] Export correto dos models
- [ ] Validações apropriadas

### 🚫 NÃO FAÇA

- ❌ Não crie services, controllers ou rotas (outros agentes fazem)
- ❌ Não modifique outros arquivos

---

## 🤖 AGENTE 2: WEBHOOK RECEIVER

### 🎯 Tarefa

Criar endpoint para receber webhooks do Bling e adicionar eventos na fila de processamento.

### 📋 Arquivos a Criar

1. `backend/src/controllers/webhookController.js`
2. `backend/src/routes/webhookRoutes.js`

### 📋 Requisitos Funcionais

#### Controller: webhookController.js

- Função `receberWebhookBling(req, res)`:
  - Valida autenticação/autorização do webhook (se disponível)
  - Extrai dados do evento do body
  - Valida estrutura básica do evento
  - Responde **imediatamente** com 200 OK (< 2 segundos)
  - Adiciona evento na fila de processamento (Bull/Redis)
  - Loga recebimento do webhook
  - Trata erros graciosamente (não quebra se fila estiver indisponível)

- Função `testarWebhook(req, res)` (opcional, para testes):
  - Permite testar webhook manualmente
  - Valida estrutura antes de processar

#### Rotas: webhookRoutes.js

- `POST /api/webhooks/bling` - Recebe webhooks do Bling
- `POST /api/webhooks/bling/test` - Teste manual (opcional)

### 📦 Referência

Siga o padrão de outros controllers:
- `backend/src/controllers/blingMultiAccountController.js`
- Ver exemplos de webhooks em: `apps/precofacilmarket/frontend/src/backend/mongodb/controllers/...`

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
export const receberWebhookBling = async (req, res) => {
  // Resposta rápida (< 2s)
  res.status(200).json({ received: true });
  
  // Processamento assíncrono
  const evento = {
    produtoId: req.body.produtoId,
    eventoId: req.body.eventoId,
    depositoId: req.body.depositoId,
    // ... outros campos
  };
  
  // Adicionar na fila
  await eventQueue.add('processar-evento', evento);
};
```

### ✅ Critérios de Aceite

- [ ] Endpoint responde em menos de 2 segundos
- [ ] Validação básica do webhook
- [ ] Eventos são adicionados na fila
- [ ] Logs são gerados
- [ ] Tratamento de erros implementado
- [ ] Rotas registradas no `routes/index.js`

### 🚫 NÃO FAÇA

- ❌ Não processe o evento diretamente (usa fila)
- ❌ Não modifique models ou services de sincronização

---

## 🤖 AGENTE 3: EVENT PROCESSOR

### 🎯 Tarefa

Criar serviço para processar eventos da fila de forma assíncrona.

### 📋 Arquivos a Criar

1. `backend/src/services/eventProcessorService.js`
2. `backend/src/jobs/processarEvento.js` (worker do Bull/BullMQ)
3. `backend/src/services/queueService.js` (se não existir - configuração da fila)

### 📋 Requisitos Funcionais

#### Service: eventProcessorService.js

- Função `processarEvento(evento, tenantId)`:
  - Busca configuração (ConfiguracaoSincronizacao) pelo tenantId
  - Verifica se sincronização está ativa
  - Verifica anti-duplicação usando `EventoProcessado.verificarSeProcessado()` (método estático do model)
  - Filtra por depósito (só os 3 principais: principalW2I, fornecedorW2I, principalTechYou)
  - Identifica origem (W2I ou TechYou) comparando `evento.blingAccountId` com `config.contasBling.w2ishop` e `config.contasBling.techyou`
  - Chama `sincronizadorService.sincronizarEstoque(produtoId, tenantId, origem)` (AGENTE 4)
  - Registra resultado no EventoProcessado com todos os campos necessários
  - Atualiza estatísticas da configuração (`config.incrementarEstatistica(origem)`)
  - Loga processamento com origem identificada (W2I ou TechYou)

- Função `verificarAntiDuplicacao(chaveUnica, tenantId)`:
  - Usa método estático: `EventoProcessado.verificarSeProcessado(chaveUnica, tenantId)`
  - Retorna true se já foi processado

- Função `filtrarPorDeposito(depositoId, config)`:
  - Verifica se depósito está na lista dos 3 principais:
    - `config.depositos.principalW2I`
    - `config.depositos.fornecedorW2I`
    - `config.depositos.principalTechYou`
  - Retorna true se deve processar, false caso contrário

- Função `identificarOrigem(blingAccountId, config)`:
  - Compara `blingAccountId` com `config.contasBling.w2ishop` → retorna 'W2I'
  - Compara `blingAccountId` com `config.contasBling.techyou` → retorna 'TechYou'
  - Retorna null se não identificar

#### Job: processarEvento.js

- Worker do Bull/BullMQ que processa eventos da fila
- Configuração da fila:
  - Nome: `'processar-evento'` ou `'eventos-estoque'`
  - Retry automático: 3 tentativas
  - Backoff exponencial: 2s, 4s, 8s
  - Dead letter queue para eventos que falharam após todas as tentativas
- Chama `eventProcessorService.processarEvento(evento, tenantId)`
- Extrai `tenantId` do payload do job (`job.data.tenantId`)
- Trata erros e loga adequadamente
- Remove jobs completados após 24h (configuração da fila)

#### Queue Service: queueService.js (se não existir)

- Configura conexão Redis para Bull/BullMQ
- Cria fila `'eventos-estoque'` ou `'processar-evento'`
- Exporta função para adicionar jobs na fila
- Configura opções padrão (retry, backoff, remoção)

### 📦 Referência

Siga o padrão de services existentes:
- `backend/src/services/blingEstoqueUnificadoService.js`
- Ver exemplos de jobs em:
  - `apps/suzyon/backend/src/workers/importWorker.js`
  - `apps/claudioia/backend/src/services/queue.js`
  - `apps/suzyon/backend/src/services/queueService.js`

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
// eventProcessorService.js
export const processarEvento = async (evento, tenantId) => {
  // Buscar configuração
  const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
  if (!config || !config.ativo) {
    return { ignorado: true, motivo: 'Sincronização inativa' };
  }
  
  // Verificar anti-duplicação
  const chaveUnica = EventoProcessado.criarChaveUnica(
    evento.produtoId, 
    evento.eventoId
  );
  
  if (await EventoProcessado.verificarSeProcessado(chaveUnica, tenantId)) {
    return { ignorado: true, motivo: 'Evento já processado' };
  }
  
  // Filtrar por depósito
  if (!filtrarPorDeposito(evento.depositoId, config)) {
    return { ignorado: true, motivo: 'Depósito não monitorado' };
  }
  
  // Identificar origem
  const origem = identificarOrigem(evento.blingAccountId, config);
  
  // Processar sincronização
  const resultado = await sincronizadorService.sincronizarEstoque(
    evento.produtoId, 
    tenantId, 
    origem || 'webhook'
  );
  
  // Registrar evento processado
  await EventoProcessado.create({
    tenantId,
    blingAccountId: evento.blingAccountId,
    produtoId: evento.produtoId,
    eventoId: evento.eventoId,
    chaveUnica,
    depositoOrigem: evento.depositoId,
    origem: origem || 'webhook',
    saldos: resultado.saldos,
    compartilhadosAtualizados: resultado.compartilhadosAtualizados,
    sucesso: resultado.sucesso,
    erro: resultado.erro,
  });
  
  // Atualizar estatísticas
  config.incrementarEstatistica(origem || 'webhook');
  await config.save();
  
  return resultado;
};
```

```javascript
// processarEvento.js (worker)
import { Worker } from 'bullmq';
import { processarEvento } from '../services/eventProcessorService.js';

const worker = new Worker('eventos-estoque', async (job) => {
  const { evento, tenantId } = job.data;
  return await processarEvento(evento, tenantId);
}, {
  connection: { /* Redis config */ },
  concurrency: 5, // Processa 5 jobs simultaneamente
});
```

### ✅ Critérios de Aceite

- [ ] Anti-duplicação funciona corretamente (usa método estático do model)
- [ ] Filtro por depósito funciona (só os 3 principais)
- [ ] Identificação de origem funciona (W2I ou TechYou)
- [ ] Eventos são processados assincronamente via fila
- [ ] Retry automático implementado (3 tentativas)
- [ ] Dead letter queue configurada
- [ ] Logs com origem identificada (W2I/TechYou)
- [ ] Estatísticas são atualizadas corretamente
- [ ] Worker processa múltiplos jobs em paralelo (concurrency)

### 🚫 NÃO FAÇA

- ❌ Não implemente lógica de sincronização (AGENTE 4 faz)
- ❌ Não modifique models (já existem e têm métodos úteis)
- ❌ Não crie nova fila se já existir uma configuração de fila no projeto

---

## 🤖 AGENTE 4: SINCRONIZADOR DE ESTOQUES

### 🎯 Tarefa

Criar serviço compartilhado que sincroniza estoques (usado por webhook e cronjob).

### 📋 Arquivos a Criar

1. `backend/src/services/sincronizadorEstoqueService.js`

### 📋 Requisitos Funcionais

#### Service: sincronizadorEstoqueService.js

- Função `sincronizarEstoque(produtoId, tenantId, origem)`:
  - Busca configuração (ConfiguracaoSincronizacao)
  - Busca saldos dos 3 depósitos principais via BlingService
  - Calcula soma dos 3 depósitos
  - Atualiza depósito compartilhado W2I (operação Balanço B)
  - Atualiza depósito compartilhado TechYou (operação Balanço B)
  - Retorna resultado com saldos e soma

- Função `buscarSaldosDepositos(produtoId, tenantId, config)`:
  - Busca saldo no Principal W2I
  - Busca saldo no Fornecedor W2I
  - Busca saldo no Principal TechYou
  - Retorna objeto com os 3 saldos

- Função `atualizarDepositoCompartilhado(produtoId, depositoId, valor, tenantId, blingAccountId)`:
  - Chama API Bling para atualizar estoque
  - Usa operação tipo "B" (Balanço)
  - Trata erros e retry

- Função `calcularSoma(saldos)`:
  - Soma os 3 saldos principais
  - Valida valores numéricos

### 📦 Referência

Siga o padrão de:
- `backend/src/services/blingEstoqueUnificadoService.js`
- `backend/src/services/blingService.js` (para chamadas à API)

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
export const sincronizarEstoque = async (produtoId, tenantId, origem) => {
  const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
  
  // Buscar saldos
  const saldos = await buscarSaldosDepositos(produtoId, tenantId, config);
  
  // Calcular soma
  const soma = calcularSoma(saldos);
  
  // Atualizar compartilhados
  await atualizarDepositoCompartilhado(
    produtoId, 
    config.depositos.compartilhadoW2I, 
    soma, 
    tenantId, 
    config.contasBling.w2ishop
  );
  
  // ... atualizar TechYou também
};
```

### ✅ Critérios de Aceite

- [ ] Busca saldos dos 3 depósitos corretamente
- [ ] Calcula soma corretamente
- [ ] Atualiza os 2 compartilhados com operação Balanço (B)
- [ ] Tratamento de erros implementado
- [ ] Retry em caso de falha
- [ ] Logs detalhados

### 🚫 NÃO FAÇA

- ❌ Não modifique BlingService (já existe)
- ❌ Não crie controllers ou rotas

---

## 🤖 AGENTE 5: CRONJOB DE VERIFICAÇÃO

### 🎯 Tarefa

Criar job agendado que verifica produtos periodicamente (fallback).

### 📋 Arquivos a Criar

1. `backend/src/jobs/verificacaoEstoqueJob.js`
2. `backend/src/services/verificacaoEstoqueService.js`

### 📋 Requisitos Funcionais

#### Service: verificacaoEstoqueService.js

- Função `executarVerificacao(tenantId)`:
  - Busca configuração (ConfiguracaoSincronizacao)
  - Verifica se cronjob está ativo
  - Busca produtos que podem ter mudado (última sincronização > intervalo)
  - Para cada produto:
    - Verifica anti-duplicação recente
    - Busca saldos atuais
    - Compara com última sincronização
    - Se mudou, chama `sincronizadorService.sincronizarEstoque()` (origem: 'cronjob')
  - Atualiza estatísticas
  - Atualiza `ultimaExecucao` e `proximaExecucao`

- Função `buscarProdutosDesatualizados(tenantId, intervaloMinutos)`:
  - Busca produtos com `ultimaSincronizacao` > intervalo
  - Ou produtos sem sincronização
  - Retorna lista de produtos

#### Job: verificacaoEstoqueJob.js

- Configura job agendado (node-cron ou agenda)
- Executa a cada X minutos (configurável, padrão: 30)
- Chama `verificacaoEstoqueService.executarVerificacao()`
- Loga início e fim da execução
- Trata erros sem quebrar o job

### 📦 Referência

Ver exemplos de jobs em:
- `apps/suzyon/backend/src/jobs/renewGoogleDriveWebhooks.js`
- Outros projetos do monorepo

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
// Job agendado
import cron from 'node-cron';

export const iniciarCronjob = () => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('[CRONJOB] Executando verificação de estoque...');
    
    const tenants = await buscarTenantsAtivos();
    for (const tenantId of tenants) {
      await verificacaoEstoqueService.executarVerificacao(tenantId);
    }
  });
};
```

### ✅ Critérios de Aceite

- [ ] Job executa no intervalo configurado
- [ ] Busca produtos desatualizados corretamente
- [ ] Detecta mudanças e sincroniza
- [ ] Atualiza estatísticas
- [ ] Logs com origem 'cronjob'
- [ ] Tratamento de erros robusto

### 🚫 NÃO FAÇA

- ❌ Não implemente lógica de sincronização (usa AGENTE 4)
- ❌ Não modifique models

---

## 🤖 AGENTE 6: INTERFACE BLING CONNECTOR

### 🎯 Tarefa

Adaptar interface de conexão Bling do precofacilmarket para suportar 2 contas simultâneas (W2ISHOP e TECHYOU).

### 📋 Arquivos a Criar/Adaptar

1. `frontend/src/components/BlingConnector/BlingConnector.jsx`
2. `frontend/src/components/BlingConnector/componentes/SeccaoConectado.jsx`
3. `frontend/src/components/BlingConnector/componentes/SeccaoNaoConectado.jsx`
4. `frontend/src/components/BlingConnector/hooks/useBlingContas.js`
5. `frontend/src/components/BlingConnector/manipuladores/conexao.js`
6. `frontend/src/components/BlingConnector/BlingConnector.css`

### 📋 Requisitos Funcionais

#### Diferenças do PrecoFacilMarket:

- **Suportar 2 contas simultâneas:**
  - W2ISHOP (obrigatória) - Identificar por `accountName` contendo "W2ISHOP" ou "W2I"
  - TECHYOU (obrigatória) - Identificar por `accountName` contendo "TECHYOU" ou "TECH"
  
- **Interface deve mostrar:**
  - Status de cada conta separadamente (cards lado a lado ou em grid)
  - Botão "Conectar W2ISHOP" e "Conectar TECHYOU" (um para cada conta)
  - Indicador visual quando ambas estão conectadas (badge verde ou ícone de check)
  - Lista de contas conectadas (máximo 2 - uma W2ISHOP e uma TECHYOU)
  - Validação: ambas devem estar conectadas para ativar sincronização
  - Mostrar informações de cada conta: nome da loja, última sincronização, status do token

- **Funcionalidades:**
  - Conectar conta W2ISHOP (busca conta com nome contendo "W2ISHOP" ou "W2I")
  - Conectar conta TECHYOU (busca conta com nome contendo "TECHYOU" ou "TECH")
  - Desconectar conta individual (com validação de sincronização ativa)
  - Gerenciar contas (usar BlingMultiAccountManager existente ou adaptar)
  - Mostrar última sincronização de cada conta
  - Validação: não permitir desconectar se `ConfiguracaoSincronizacao.ativo === true`
  - Hook `useBlingContas` deve filtrar e separar contas W2ISHOP e TECHYOU

### 📦 Referência

Copie e adapte de:
- `apps/precofacilmarket/frontend/src/components/pages/Configuracoes/conteudos/BlingConnector/`
- `apps/estoqueuni/frontend/src/components/BlingMultiAccountManager.jsx` (já existe no projeto)
- Adapte para suportar 2 contas obrigatórias (W2ISHOP e TECHYOU)
- Use a estrutura de hooks e manipuladores do precofacilmarket como base

### ✅ Exemplo de Estrutura (NÃO código completo):

```jsx
// Hook useBlingContas deve retornar contas separadas
const { contaW2I, contaTechYou, ambasConectadas } = useBlingContas(tenantId, config);

// Estrutura de exibição
<div className="contas-status">
  <div className="conta-w2ishop">
    <h5>W2ISHOP</h5>
    {contaW2I?.isActive ? (
      <div>
        <span className="badge badge-success">✅ Conectado</span>
        <p>Loja: {contaW2I.storeName}</p>
        <button onClick={() => desconectarConta(contaW2I._id)}>
          Desconectar
        </button>
      </div>
    ) : (
      <button onClick={() => conectarConta(contaW2I?._id, 'w2ishop')}>
        Conectar W2ISHOP
      </button>
    )}
  </div>
  
  <div className="conta-techyou">
    <h5>TECHYOU</h5>
    {contaTechYou?.isActive ? (
      <div>
        <span className="badge badge-success">✅ Conectado</span>
        <p>Loja: {contaTechYou.storeName}</p>
        <button onClick={() => desconectarConta(contaTechYou._id)}>
          Desconectar
        </button>
      </div>
    ) : (
      <button onClick={() => conectarConta(contaTechYou?._id, 'techyou')}>
        Conectar TECHYOU
      </button>
    )}
  </div>
  
  {ambasConectadas && (
    <div className="alert alert-success">
      ✅ Ambas as contas conectadas. Sincronização pode ser ativada.
    </div>
  )}
</div>
```

**Hook useBlingContas.js deve:**
- Filtrar contas por nome (W2ISHOP/W2I e TECHYOU/TECH)
- Retornar `contaW2I`, `contaTechYou`, `ambasConectadas`
- Usar mesma estrutura do precofacilmarket, mas adaptado para 2 contas fixas

### ✅ Critérios de Aceite

- [ ] Interface mostra status de ambas as contas (W2ISHOP e TECHYOU)
- [ ] Permite conectar cada conta separadamente
- [ ] Valida que ambas estão conectadas antes de permitir ativar sincronização
- [ ] Hook `useBlingContas` filtra e separa contas corretamente
- [ ] Validação de sincronização ativa antes de desconectar (verifica `ConfiguracaoSincronizacao.ativo`)
- [ ] Estilo consistente com o sistema (usar classes CSS existentes)
- [ ] Funciona com hooks e manipuladores existentes do precofacilmarket
- [ ] Responsivo (grid ou flexbox para cards lado a lado)
- [ ] Mostra informações detalhadas de cada conta (loja, última sync, status token)

### 🚫 NÃO FAÇA

- ❌ Não modifique a lógica de OAuth (já funciona)
- ❌ Não crie novos endpoints (usa os existentes)

---

## 🤖 AGENTE 7: INTERFACE SINCRONIZAÇÃO

### 🎯 Tarefa

Criar página completa de gerenciamento de sincronização de estoques.

### 📋 Arquivos a Criar

1. `frontend/src/pages/SincronizacaoEstoque.jsx`
2. `frontend/src/components/SincronizacaoEstoque/StatusSincronizacao.jsx`
3. `frontend/src/components/SincronizacaoEstoque/ConfiguracaoDepositos.jsx`
4. `frontend/src/components/SincronizacaoEstoque/ConfiguracaoWebhook.jsx`
5. `frontend/src/components/SincronizacaoEstoque/ConfiguracaoCronjob.jsx`
6. `frontend/src/components/SincronizacaoEstoque/SincronizacaoManual.jsx`
7. `frontend/src/components/SincronizacaoEstoque/HistoricoSincronizacoes.jsx`
8. `frontend/src/components/SincronizacaoEstoque/LogsMonitoramento.jsx`
9. `frontend/src/services/sincronizacaoApi.js`

### 📋 Requisitos Funcionais

#### Página Principal: SincronizacaoEstoque.jsx

- Layout com seções:
  1. Status da Sincronização
  2. Configuração de Depósitos
  3. Configuração de Webhook
  4. Configuração de Cronjob
  5. Sincronização Manual
  6. Histórico de Sincronizações
  7. Logs e Monitoramento

#### Componentes:

1. **StatusSincronizacao.jsx:**
   - Indicador visual (ativo/inativo)
   - Status webhook e cronjob
   - Última sincronização
   - Estatísticas (cards com números)

2. **ConfiguracaoDepositos.jsx:**
   - Formulário com 5 depósitos
   - Validação de IDs
   - Salvar configuração

3. **ConfiguracaoWebhook.jsx:**
   - Mostrar URL do webhook
   - Status da conexão
   - Botão de teste
   - Histórico de requisições

4. **ConfiguracaoCronjob.jsx:**
   - Toggle ativar/desativar
   - Input de intervalo (minutos)
   - Mostrar última/próxima execução
   - Estatísticas

5. **SincronizacaoManual.jsx:**
   - Botão "Sincronizar Todos"
   - Input para SKU específico
   - Barra de progresso
   - Feedback visual

6. **HistoricoSincronizacoes.jsx:**
   - Tabela com sincronizações
   - Filtros (data, origem, produto)
   - Paginação
   - Detalhes expandíveis

7. **LogsMonitoramento.jsx:**
   - Visualização de logs em tempo real
   - Filtros de busca
   - Exportação

### 📦 Referência

Siga o padrão de outras páginas:
- `frontend/src/pages/Estoque.jsx`
- `frontend/src/pages/Produtos.jsx`
- Componentes existentes do sistema

### ✅ Exemplo de Estrutura (NÃO código completo):

```jsx
export default function SincronizacaoEstoque() {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  
  return (
    <div className="sincronizacao-estoque">
      <h2>Sincronização de Estoques</h2>
      
      <StatusSincronizacao status={status} />
      <ConfiguracaoDepositos config={config} />
      {/* ... outros componentes */}
    </div>
  );
}
```

### ✅ Critérios de Aceite

- [ ] Todas as seções implementadas
- [ ] Interface responsiva e intuitiva
- [ ] Integração com API funcionando
- [ ] Feedback visual adequado
- [ ] Tratamento de erros
- [ ] Estilo consistente

### 🚫 NÃO FAÇA

- ❌ Não crie endpoints (AGENTE 8 faz)
- ❌ Não modifique models ou services

---

## 🤖 AGENTE 8: ROTAS E CONTROLLERS

### 🎯 Tarefa

Criar rotas e controllers para a API de sincronização.

### 📋 Arquivos a Criar

1. `backend/src/controllers/sincronizacaoController.js`
2. `backend/src/routes/sincronizacaoRoutes.js`

### 📋 Requisitos Funcionais

#### Controller: sincronizacaoController.js

- `obterConfiguracao(req, res)` - GET /api/sincronizacao/config
- `salvarConfiguracao(req, res)` - POST /api/sincronizacao/config
- `obterStatus(req, res)` - GET /api/sincronizacao/status
- `sincronizarManual(req, res)` - POST /api/sincronizacao/manual
- `obterHistorico(req, res)` - GET /api/sincronizacao/historico
- `obterLogs(req, res)` - GET /api/sincronizacao/logs
- `atualizarWebhook(req, res)` - PUT /api/sincronizacao/webhook
- `atualizarCronjob(req, res)` - PUT /api/sincronizacao/cronjob

#### Rotas: sincronizacaoRoutes.js

- Registrar todas as rotas acima
- Middleware de validação de tenantId
- Middleware de autenticação (se necessário)

### 📦 Referência

Siga o padrão de:
- `backend/src/controllers/blingMultiAccountController.js`
- `backend/src/routes/blingRoutes.js`

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
export const obterConfiguracao = async (req, res) => {
  const { tenantId } = req.query;
  
  const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
  
  if (!config) {
    return res.status(404).json({ 
      success: false, 
      message: 'Configuração não encontrada' 
    });
  }
  
  res.json({ success: true, data: config });
};
```

### ✅ Critérios de Aceite

- [ ] Todas as rotas implementadas
- [ ] Validação de tenantId
- [ ] Tratamento de erros
- [ ] Respostas padronizadas
- [ ] Rotas registradas no `routes/index.js`
- [ ] Logs apropriados

### 🚫 NÃO FAÇA

- ❌ Não modifique models ou services
- ❌ Não crie lógica de negócio (usa services existentes)

---

## 🤖 AGENTE 9: REFATORAÇÃO MULTITENANT - MODEL

### 🎯 Tarefa

**CRÍTICO:** Refatorar o model `ConfiguracaoSincronizacao` para remover hardcoding e tornar genérico para qualquer tenant.

### 📋 Arquivo a Modificar

1. `backend/src/models/ConfiguracaoSincronizacao.js`

### 📋 Problema Atual

O model tem estrutura hardcoded:
- `contasBling.w2ishop` e `contasBling.techyou` (objeto fixo)
- `depositos.principalW2I`, `depositos.fornecedorW2I`, etc. (objeto fixo)

### 📋 Requisitos Funcionais

#### Nova Estrutura Genérica

**Substituir:**
```javascript
contasBling: {
  w2ishop: String,
  techyou: String
}
```

**Por:**
```javascript
contasBling: [{
  blingAccountId: String,        // ID da conta no Bling
  accountName: String,           // Nome da conta (ex: "W2ISHOP", "TECHYOU", "Loja X")
  isActive: Boolean,             // Se a conta está ativa
  depositosPrincipais: [String], // Array de IDs de depósitos principais desta conta
  depositoCompartilhado: String, // ID do depósito compartilhado desta conta
}]
```

**Substituir:**
```javascript
depositos: {
  principalW2I: String,
  fornecedorW2I: String,
  principalTechYou: String,
  compartilhadoW2I: String,
  compartilhadoTechYou: String
}
```

**Por:**
```javascript
depositos: [{
  id: String,                    // ID do depósito no Bling
  nome: String,                  // Nome do depósito
  tipo: String,                  // 'principal' | 'compartilhado'
  contaBlingId: String,          // Relaciona com contasBling[].blingAccountId
}]
```

**Adicionar:**
```javascript
regraSincronizacao: {
  tipo: {
    type: String,
    enum: ['soma', 'media', 'max', 'min'],
    default: 'soma'
  },
  depositosPrincipais: [String], // IDs dos depósitos que devem ser somados
  depositosCompartilhados: [String], // IDs dos depósitos que recebem a soma
}
```

#### Métodos a Atualizar

- `isConfigurationComplete()` - Validar estrutura genérica
- `contasBlingConfiguradas()` - Verificar se há contas configuradas (não hardcoded)
- Adicionar método `buscarContaPorBlingAccountId(blingAccountId)`
- Adicionar método `buscarDepositosPorTipo(tipo)` - 'principal' ou 'compartilhado'

### 📦 Referência

Ver documento: `ALERTA_CRITICO_MULTITENANT.md` para estrutura completa

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
// Nova estrutura
contasBling: [{
  blingAccountId: { type: String, required: true },
  accountName: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  depositosPrincipais: [{ type: String }],
  depositoCompartilhado: { type: String }
}],

regraSincronizacao: {
  tipo: { type: String, enum: ['soma'], default: 'soma' },
  depositosPrincipais: [{ type: String }],
  depositosCompartilhados: [{ type: String }]
}
```

### ✅ Critérios de Aceite

- [ ] Estrutura genérica implementada (arrays ao invés de objetos fixos)
- [ ] Métodos atualizados para trabalhar com arrays
- [ ] Validações genéricas (não hardcoded)
- [ ] Backward compatibility: método de migration (opcional, mas recomendado)
- [ ] Testes básicos funcionando

### 🚫 NÃO FAÇA

- ❌ Não mantenha campos hardcoded
- ❌ Não modifique outros models
- ❌ Não crie migration automática (pode ser script separado)

---

## 🤖 AGENTE 10: REFATORAÇÃO MULTITENANT - SERVICES

### 🎯 Tarefa

**CRÍTICO:** Refatorar services existentes para remover hardcoding e usar estrutura genérica.

### 📋 Arquivos a Modificar

1. `backend/src/services/sincronizadorEstoqueService.js`
2. `backend/src/services/verificacaoEstoqueService.js`
3. `backend/src/services/eventProcessorService.js` (quando criar - AGENTE 11)

### 📋 Requisitos Funcionais

#### sincronizadorEstoqueService.js

**Remover:**
- Referências hardcoded a `config.depositos.principalW2I`
- Referências hardcoded a `config.contasBling.w2ishop`
- Lógica que assume sempre 2 contas

**Implementar:**
- Usar `config.regraSincronizacao.depositosPrincipais` (array)
- Usar `config.regraSincronizacao.depositosCompartilhados` (array)
- Buscar saldos de todos os depósitos principais (loop genérico)
- Atualizar todos os depósitos compartilhados (loop genérico)
- Identificar conta pelo `blingAccountId` usando método do model

**Função `buscarSaldosDepositos()`:**
```javascript
// ANTES (hardcoded):
const saldoPrincipalW2I = await buscarSaldo(produtoId, config.depositos.principalW2I, ...);
const saldoFornecedorW2I = await buscarSaldo(produtoId, config.depositos.fornecedorW2I, ...);
const saldoPrincipalTechYou = await buscarSaldo(produtoId, config.depositos.principalTechYou, ...);

// DEPOIS (genérico):
const depositosPrincipais = config.regraSincronizacao.depositosPrincipais;
const saldos = await Promise.all(
  depositosPrincipais.map(depositoId => 
    buscarSaldo(produtoId, depositoId, tenantId, config)
  )
);
```

**Função `atualizarDepositosCompartilhados()`:**
```javascript
// ANTES (hardcoded):
await atualizarDeposito(produtoId, config.depositos.compartilhadoW2I, soma, ...);
await atualizarDeposito(produtoId, config.depositos.compartilhadoTechYou, soma, ...);

// DEPOIS (genérico):
const depositosCompartilhados = config.regraSincronizacao.depositosCompartilhados;
await Promise.all(
  depositosCompartilhados.map(async (depositoId) => {
    // Buscar conta relacionada ao depósito
    const deposito = config.depositos.find(d => d.id === depositoId);
    const conta = config.contasBling.find(c => c.blingAccountId === deposito.contaBlingId);
    await atualizarDeposito(produtoId, depositoId, soma, tenantId, conta.blingAccountId);
  })
);
```

#### verificacaoEstoqueService.js

**Remover:**
- Referências hardcoded a contas específicas
- Lógica que assume estrutura fixa

**Implementar:**
- Usar estrutura genérica do model
- Buscar produtos desatualizados de forma genérica
- Processar usando `sincronizadorEstoqueService` (já refatorado)

### 📦 Referência

Ver documento: `ALERTA_CRITICO_MULTITENANT.md` para exemplos completos

### ✅ Critérios de Aceite

- [ ] Nenhuma referência hardcoded a "W2I", "TechYou", "w2ishop", "techyou"
- [ ] Usa arrays da configuração genérica
- [ ] Funciona com N contas e N depósitos
- [ ] Testes básicos funcionando
- [ ] Logs genéricos (não mencionam nomes específicos)

### 🚫 NÃO FAÇA

- ❌ Não modifique models (AGENTE 9 faz)
- ❌ Não modifique controllers
- ❌ Não crie nova lógica, apenas refatore existente

---

## 🤖 AGENTE 11: EVENT PROCESSOR SERVICE (GENÉRICO)

### 🎯 Tarefa

Criar serviço para processar eventos da fila de forma genérica (sem hardcoding).

### 📋 Arquivos a Criar

1. `backend/src/services/eventProcessorService.js`

### 📋 Requisitos Funcionais

#### Service: eventProcessorService.js

- Função `processarEvento(evento, tenantId)`:
  - Busca configuração (ConfiguracaoSincronizacao) pelo tenantId
  - Verifica se sincronização está ativa
  - Verifica anti-duplicação usando `EventoProcessado.verificarSeProcessado()` (método estático)
  - Filtra por depósito usando `config.regraSincronizacao.depositosPrincipais` (array genérico)
  - Identifica origem usando `config.buscarContaPorBlingAccountId()` (método do model)
  - Chama `sincronizadorEstoqueService.sincronizarEstoque(produtoId, tenantId, origem)`
  - Registra resultado no EventoProcessado
  - Atualiza estatísticas da configuração (`config.incrementarEstatistica(origem)`)

- Função `filtrarPorDeposito(depositoId, config)`:
  - Verifica se `depositoId` está em `config.regraSincronizacao.depositosPrincipais` (array)
  - Retorna true se deve processar, false caso contrário

- Função `identificarOrigem(blingAccountId, config)`:
  - Usa `config.buscarContaPorBlingAccountId(blingAccountId)` (método do model)
  - Retorna `accountName` da conta encontrada
  - Retorna 'desconhecida' se não encontrar

### 📦 Referência

Siga o padrão de:
- `backend/src/services/sincronizadorEstoqueService.js` (já refatorado pelo AGENTE 10)
- Ver AGENTE 3 (versão original, mas adaptar para genérico)

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
export const processarEvento = async (evento, tenantId) => {
  // Buscar configuração
  const config = await ConfiguracaoSincronizacao.findOne({ tenantId });
  if (!config || !config.ativo) {
    return { ignorado: true, motivo: 'Sincronização inativa' };
  }
  
  // Verificar anti-duplicação
  const chaveUnica = EventoProcessado.criarChaveUnica(
    evento.produtoId, 
    evento.eventoId
  );
  
  if (await EventoProcessado.verificarSeProcessado(chaveUnica, tenantId)) {
    return { ignorado: true, motivo: 'Evento já processado' };
  }
  
  // Filtrar por depósito (genérico)
  if (!filtrarPorDeposito(evento.depositoId, config)) {
    return { ignorado: true, motivo: 'Depósito não monitorado' };
  }
  
  // Identificar origem (genérico)
  const origem = identificarOrigem(evento.blingAccountId, config);
  
  // Processar sincronização
  const resultado = await sincronizadorEstoqueService.sincronizarEstoque(
    evento.produtoId, 
    tenantId, 
    origem || 'webhook'
  );
  
  // Registrar evento processado
  await EventoProcessado.create({ ... });
  
  // Atualizar estatísticas
  config.incrementarEstatistica(origem || 'webhook');
  await config.save();
  
  return resultado;
};
```

### ✅ Critérios de Aceite

- [ ] Anti-duplicação funciona corretamente
- [ ] Filtro por depósito funciona (usando array genérico)
- [ ] Identificação de origem funciona (genérico, não hardcoded)
- [ ] Eventos são processados assincronamente
- [ ] Logs genéricos (não mencionam nomes específicos)
- [ ] Estatísticas são atualizadas corretamente

### 🚫 NÃO FAÇA

- ❌ Não use hardcoding de nomes de empresas
- ❌ Não assuma sempre 2 contas
- ❌ Não modifique models (AGENTE 9 faz)

---

## 🤖 AGENTE 12: WORKER PROCESSAR EVENTO

### 🎯 Tarefa

Criar worker do BullMQ para processar eventos da fila.

### 📋 Arquivos a Criar

1. `backend/src/jobs/processarEvento.js`

### 📋 Requisitos Funcionais

#### Worker: processarEvento.js

- Worker do BullMQ que processa eventos da fila
- Configuração da fila:
  - Nome: `'eventos-estoque'` ou `'processar-evento'`
  - Retry automático: 3 tentativas
  - Backoff exponencial: 2s, 4s, 8s
  - Dead letter queue para eventos que falharam após todas as tentativas
- Chama `eventProcessorService.processarEvento(evento, tenantId)`
- Extrai `tenantId` do payload do job (`job.data.tenantId`)
- Trata erros e loga adequadamente
- Remove jobs completados após 24h (configuração da fila)
- Função `iniciarWorker()` - Inicia o worker e retorna instância

### 📦 Referência

Ver exemplos de workers em:
- `apps/suzyon/backend/src/workers/importWorker.js`
- `apps/claudioia/backend/src/services/queue.js`
- `backend/src/services/queueService.js` (já existe)

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
import { Worker } from 'bullmq';
import { processarEvento } from '../services/eventProcessorService.js';
import { getQueueConnection } from '../services/queueService.js';

let worker = null;

export const iniciarWorker = async () => {
  if (worker) {
    console.log('[Worker] Worker já está rodando');
    return worker;
  }
  
  const connection = await getQueueConnection();
  
  worker = new Worker('eventos-estoque', async (job) => {
    const { evento, tenantId } = job.data;
    return await processarEvento(evento, tenantId);
  }, {
    connection,
    concurrency: 5, // Processa 5 jobs simultaneamente
    removeOnComplete: { count: 100, age: 24 * 3600 }, // Remove após 24h
    removeOnFail: { count: 1000 },
  });
  
  // Event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completado`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} falhou:`, err.message);
  });
  
  return worker;
};
```

### ✅ Critérios de Aceite

- [ ] Worker processa eventos da fila
- [ ] Retry automático configurado (3 tentativas)
- [ ] Dead letter queue configurada
- [ ] Logs adequados
- [ ] Função `iniciarWorker()` exportada
- [ ] Tratamento de erros robusto

### 🚫 NÃO FAÇA

- ❌ Não modifique queueService.js
- ❌ Não crie nova fila (usa a existente)

---

## 🤖 AGENTE 13: INICIALIZAÇÃO NO SERVER.JS

### 🎯 Tarefa

Adicionar inicialização do worker e cronjob no servidor.

### 📋 Arquivo a Modificar

1. `backend/src/server.js`

### 📋 Requisitos Funcionais

#### Modificações no server.js

- Importar `iniciarWorker` de `./jobs/processarEvento.js`
- Importar `iniciarCronjob` de `./jobs/verificacaoEstoqueJob.js`
- Após conectar MongoDB, iniciar worker e cronjob
- Tratar erros de inicialização (não quebrar servidor se Redis não estiver disponível)
- Logs informativos

### 📦 Referência

Ver estrutura atual:
- `backend/src/server.js`

### ✅ Exemplo de Estrutura (NÃO código completo):

```javascript
async function iniciarServidor() {
  try {
    // Conectar MongoDB
    await conectarMongoDB();
    
    // Iniciar Worker (opcional - não quebra se Redis não estiver)
    try {
      const { iniciarWorker } = await import('./jobs/processarEvento.js');
      await iniciarWorker();
      console.log('✅ Worker de eventos iniciado');
    } catch (error) {
      console.warn('⚠️ Worker não iniciado (Redis pode não estar disponível):', error.message);
    }
    
    // Iniciar Cronjob
    try {
      const { iniciarCronjob } = await import('./jobs/verificacaoEstoqueJob.js');
      iniciarCronjob();
      console.log('✅ Cronjob de verificação iniciado');
    } catch (error) {
      console.error('❌ Erro ao iniciar cronjob:', error);
    }
    
    // Iniciar servidor Express
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}
```

### ✅ Critérios de Aceite

- [ ] Worker é iniciado após MongoDB
- [ ] Cronjob é iniciado após MongoDB
- [ ] Erros não quebram o servidor (try/catch)
- [ ] Logs informativos
- [ ] Servidor inicia mesmo se Redis não estiver disponível (worker opcional)

### 🚫 NÃO FAÇA

- ❌ Não modifique outros arquivos
- ❌ Não remova código existente (apenas adicione)

---

## 🤖 AGENTE 14: REFATORAÇÃO FRONTEND - INTERFACE GENÉRICA

### 🎯 Tarefa

**CRÍTICO:** Refatorar interface do frontend para remover hardcoding e tornar genérica.

### 📋 Arquivos a Modificar/Criar

1. `frontend/src/components/SincronizacaoEstoque/ConfiguracaoDepositos.jsx`
2. `frontend/src/components/BlingConnector/` (criar estrutura genérica)
3. `frontend/src/pages/ContasBling.jsx` (verificar e adaptar)

### 📋 Requisitos Funcionais

#### ConfiguracaoDepositos.jsx

**Remover:**
- Campos fixos: "Principal W2I", "Fornecedor W2I", "Principal TechYou", etc.
- Validação hardcoded de nomes específicos

**Implementar:**
- Interface genérica para adicionar/remover depósitos
- Lista de depósitos com tipo (principal/compartilhado)
- Associar depósito a conta Bling (dropdown)
- Configurar regra de sincronização:
  - Selecionar quais depósitos são principais (checkboxes)
  - Selecionar quais depósitos são compartilhados (checkboxes)
- Validação genérica (pelo menos 1 depósito principal, pelo menos 1 compartilhado)

#### BlingConnector (criar estrutura genérica)

**Estrutura:**
- `BlingConnector/BlingConnector.jsx` - Componente principal
- `BlingConnector/componentes/ListaContas.jsx` - Lista todas as contas (genérico)
- `BlingConnector/componentes/CardConta.jsx` - Card de uma conta (genérico)
- `BlingConnector/hooks/useBlingContas.js` - Hook genérico (não filtra por nome)
- `BlingConnector/manipuladores/conexao.js` - Manipuladores genéricos

**Funcionalidades:**
- Listar todas as contas Bling do tenant
- Permitir adicionar nova conta
- Permitir conectar/desconectar qualquer conta
- Mostrar status de cada conta
- Validação: pelo menos 1 conta deve estar conectada (não hardcoded para 2)

**Remover:**
- Botões fixos "Conectar W2ISHOP" e "Conectar TECHYOU"
- Filtro por nome "W2ISHOP" ou "TECHYOU"
- Validação de "ambas as contas"

### 📦 Referência

Copiar estrutura de:
- `apps/precofacilmarket/frontend/src/components/pages/Configuracoes/conteudos/BlingConnector/`
- Adaptar para ser genérico (não filtrar por nomes)

### ✅ Exemplo de Estrutura (NÃO código completo):

```jsx
// ListaContas.jsx - Genérico
{contas.map(conta => (
  <CardConta
    key={conta._id}
    conta={conta}
    onConectar={() => conectarConta(conta._id)}
    onDesconectar={() => desconectarConta(conta._id)}
  />
))}

// ConfiguracaoDepositos.jsx - Genérico
<div>
  <h4>Depósitos Principais</h4>
  {depositos.filter(d => d.tipo === 'principal').map(deposito => (
    <div key={deposito.id}>
      <input 
        type="checkbox" 
        checked={regraSincronizacao.depositosPrincipais.includes(deposito.id)}
        onChange={() => toggleDepositoPrincipal(deposito.id)}
      />
      <label>{deposito.nome}</label>
    </div>
  ))}
  
  <h4>Depósitos Compartilhados</h4>
  {depositos.filter(d => d.tipo === 'compartilhado').map(deposito => (
    <div key={deposito.id}>
      <input 
        type="checkbox" 
        checked={regraSincronizacao.depositosCompartilhados.includes(deposito.id)}
        onChange={() => toggleDepositoCompartilhado(deposito.id)}
      />
      <label>{deposito.nome}</label>
    </div>
  ))}
</div>
```

### ✅ Critérios de Aceite

- [ ] Interface genérica (não menciona W2ISHOP/TECHYOU)
- [ ] Permite adicionar/remover contas dinamicamente
- [ ] Permite configurar N depósitos
- [ ] Validação genérica (não hardcoded)
- [ ] Estilo consistente
- [ ] Funciona com qualquer número de contas

### 🚫 NÃO FAÇA

- ❌ Não use hardcoding de nomes
- ❌ Não assuma sempre 2 contas
- ❌ Não modifique lógica de OAuth (já funciona)

---

## 📋 Ordem de Execução Recomendada (ATUALIZADA)

### Fase 1: Refatoração Multitenant (CRÍTICO - Fazer primeiro)

1. **AGENTE 9** (Refatoração Model) - Base genérica
2. **AGENTE 10** (Refatoração Services) - Depende de AGENTE 9
3. **AGENTE 14** (Refatoração Frontend) - Depende de AGENTE 9

### Fase 2: Implementação Faltante

4. **AGENTE 11** (Event Processor Service) - Depende de AGENTE 9 e 10
5. **AGENTE 12** (Worker) - Depende de AGENTE 11
6. **AGENTE 13** (Inicialização Server) - Depende de AGENTE 12

### Fase 3: Completar Implementação Original

7. **AGENTE 1** (Models) - Já feito, mas verificar se precisa ajustes
8. **AGENTE 8** (Rotas/Controllers) - Já feito, verificar se precisa ajustes
9. **AGENTE 4** (Sincronizador) - Já feito, mas refatorado pelo AGENTE 10
10. **AGENTE 2** (Webhook Receiver) - Já feito, verificar se precisa ajustes
11. **AGENTE 3** (Event Processor) - Substituído pelo AGENTE 11 (genérico)
12. **AGENTE 5** (Cronjob) - Já feito, mas refatorado pelo AGENTE 10
13. **AGENTE 6** (Interface Bling) - Substituído pelo AGENTE 14 (genérico)
14. **AGENTE 7** (Interface Sincronização) - Já feito, mas precisa refatoração pelo AGENTE 14

---

## ✅ Checklist Final

Após todos os agentes terminarem:

### Backend
- [ ] Model ConfiguracaoSincronizacao refatorado (genérico)
- [ ] Services refatorados (sem hardcoding)
- [ ] eventProcessorService.js criado (genérico)
- [ ] processarEvento.js (worker) criado
- [ ] Worker e cronjob inicializados no server.js
- [ ] Todos os arquivos criados
- [ ] Imports e exports corretos
- [ ] Rotas registradas
- [ ] Testes básicos funcionando
- [ ] Logs implementados (genéricos, sem nomes hardcoded)
- [ ] Tratamento de erros
- [ ] Documentação inline (comentários)

### Frontend
- [ ] Interface genérica (sem hardcoding)
- [ ] Permite N contas e N depósitos
- [ ] Validações genéricas
- [ ] Estilo consistente
- [ ] Funciona com qualquer tenant

### Validação Multitenant
- [ ] Nenhuma referência hardcoded a "W2ISHOP", "TECHYOU", "W2I", "TechYou"
- [ ] Sistema funciona para qualquer tenant
- [ ] Permite configurar N contas Bling
- [ ] Permite configurar N depósitos
- [ ] Regra de sincronização configurável

---

---

## 🚨 Notas Importantes

### Sobre Hardcoding

**⚠️ CRÍTICO:** O sistema é **MULTITENANT** e deve ser **genérico**. 

- ❌ **NÃO** use hardcoding de nomes de empresas (W2ISHOP, TECHYOU, etc.)
- ❌ **NÃO** assuma sempre 2 contas
- ❌ **NÃO** use campos fixos no model
- ✅ **USE** arrays genéricos
- ✅ **USE** configuração flexível
- ✅ **USE** lógica que funciona para N contas e N depósitos

### Referências

- Ver `ALERTA_CRITICO_MULTITENANT.md` para detalhes do problema
- Ver `ANALISE_IMPLEMENTACAO_FALTANTE.md` para lista completa do que falta

---

**Última atualização:** 2025-01-XX  
**Versão:** 2.0 (Adicionados prompts de refatoração multitenant)

