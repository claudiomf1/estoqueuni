# 🎯 Projeto: Sincronização Automática de Estoques Compartilhados

## 📋 Visão Geral

Este documento descreve o projeto de **substituição do Make.com pelo sistema EstoqueUni** para gerenciar a sincronização automática de estoques compartilhados entre as empresas **W2ISHOP** e **TECHYOU**.

---

## 🏢 Contexto: As Empresas

### W2ISHOP
- Empresa com conta Bling própria
- Possui 2 depósitos principais:
  - **Principal W2I** (ID: `14886873196`)
  - **Fornecedor W2I** (ID: `14886879193`)
- Possui 1 depósito compartilhado:
  - **Compartilhado W2I** (ID: `14888283087`)

### TECHYOU
- Empresa com conta Bling separada
- Possui 1 depósito principal:
  - **Principal TechYou** (ID: `14887164856`)
- Possui 1 depósito compartilhado:
  - **Compartilhado TechYou** (ID: `14888283080`)

---

## 🔄 Situação Atual (Make.com)

### Como Funciona Hoje

O **Make.com** executa um cenário chamado **"v10 REAL"** que:

1. **Recebe webhooks** do Bling quando há movimentações de estoque
2. **Processa eventos** dos 3 depósitos principais
3. **Calcula a soma** dos 3 depósitos
4. **Atualiza os 2 compartilhados** com essa soma

### Limitações do Make.com

- Dependência de serviço externo (Make.com)
- Custo mensal do Make.com
- Menor controle sobre a lógica de negócio
- Dificuldade de debug e monitoramento
- Limitações de customização

---

## 🎯 Objetivo do Projeto

**Substituir completamente o Make.com** implementando toda a lógica de sincronização diretamente no **EstoqueUni**, oferecendo:

- ✅ Controle total sobre a sincronização
- ✅ Melhor monitoramento e logs
- ✅ Interface própria para gerenciamento
- ✅ Sem custos de serviços externos
- ✅ Facilidade de manutenção e evolução

---

## 📐 Regras de Negócio

### Regra 1: Soma dos 3 Depósitos Principais

```
Estoque Compartilhado = Principal W2I + Fornecedor W2I + Principal TechYou
```

**Sempre** que há alteração em qualquer um dos 3 depósitos principais, os 2 depósitos compartilhados devem ser atualizados com essa soma.

### Regra 2: Operação de Balanço (B)

A atualização dos compartilhados deve usar **operação "B" (Balanço)** do Bling, que define o **valor absoluto** do estoque, não incremento ou decremento.

### Regra 3: Filtro por Depósito

O sistema **só processa eventos** dos 3 depósitos principais:
- ✅ Principal W2I (14886873196)
- ✅ Fornecedor W2I (14886879193)
- ✅ Principal TechYou (14887164856)

**Ignora eventos** de outros depósitos (Full Magalu, Full Mercado Livre, Full Amazon, etc.)

### Regra 4: Anti-Duplicação

Cada evento deve ser identificado por uma chave única:
```
chave = {idProduto}-{idEvento}
```

Se o evento já foi processado, o sistema **não processa novamente**.

### Regra 5: Atualização Dupla

**Sempre** atualiza os **2 depósitos compartilhados** com o mesmo valor (a soma):
- Compartilhado W2I (14888283087)
- Compartilhado TechYou (14888283080)

### Regra 6: Roteamento por Origem

O sistema deve ter lógica diferenciada baseada na origem do evento:
- **Eventos W2I**: Quando vem dos depósitos 14886873196 ou 14886879193
- **Eventos TechYou**: Quando vem do depósito 14887164856

---

## 🏗️ Arquitetura do Sistema

### Visão Geral

O EstoqueUni é um sistema de controle de estoque unificado que permite sincronizar automaticamente estoques compartilhados entre múltiplas contas Bling (W2ISHOP e TECHYOU), substituindo o Make.com.

### Camadas da Aplicação

```
┌─────────────────────────────────────┐
│         Frontend (React)            │
│  - Componentes React                │
│  - Serviços de API (Axios)          │
│  - Roteamento (React Router)        │
└──────────────┬──────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────┐
│      Backend (Express)              │
│  ┌──────────────────────────────┐   │
│  │      Routes                  │   │
│  │  - /api/webhooks/bling       │   │
│  │  - /api/sincronizacao/...    │   │
│  └──────────┬───────────────────┘   │
│  ┌──────────▼───────────────────┐   │
│  │    Controllers               │   │
│  │  - WebhookController         │   │
│  │  - SincronizacaoController   │   │
│  └──────────┬───────────────────┘   │
│  ┌──────────▼───────────────────┐   │
│  │    Services                  │   │
│  │  - BlingService              │   │
│  │  - SincronizacaoService      │   │
│  │  - EventProcessorService     │   │
│  └──────────┬───────────────────┘   │
│  ┌──────────▼───────────────────┐   │
│  │    Models (Mongoose)         │   │
│  │  - BlingConfig               │   │
│  │  - EventoProcessado          │   │
│  │  - ConfiguracaoSincronizacao │   │
│  │  - Produto                   │   │
│  └──────────┬───────────────────┘   │
└─────────────┼───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│         MongoDB                     │
│  - Collection: blingconfigs         │
│  - Collection: eventos_processados  │
│  - Collection: configuracao_sync    │
│  - Collection: produtos             │
└─────────────────────────────────────┘
              │
┌─────────────▼───────────────────────┐
│      Bling API (Externa)            │
│  - OAuth 2.0                        │
│  - REST API v3                      │
│  - Webhooks                         │
└─────────────────────────────────────┘
```

---

## 🏗️ Arquitetura Proposta

### 🎯 Estratégia Híbrida: Webhook + Cronjob de Fallback

O sistema utilizará uma **abordagem híbrida** que combina o melhor dos dois mundos:

#### **Webhook (Principal - 90% do tempo)**
- ✅ **Tempo real**: Sincronização imediata quando há eventos
- ✅ **Eficiente**: Processa apenas quando há mudanças
- ✅ **Menos carga**: Não fica consultando a API constantemente
- ✅ **Escalável**: Funciona bem mesmo com muitos eventos

#### **Cronjob de Segurança (Fallback - 10% do tempo)**
- ✅ **Confiabilidade**: Garante que nada seja perdido
- ✅ **Backup**: Funciona mesmo se webhook falhar
- ✅ **Verificação periódica**: Detecta eventos perdidos
- ✅ **Segurança**: Não depende 100% do webhook

**Frequência do Cronjob**: A cada 30 minutos (configurável)

---

### Componentes Principais

#### 1. **Webhook Receiver** (Backend)
- Endpoint para receber webhooks do Bling
- Validação de autenticação/autorização
- Parse e normalização dos eventos
- Resposta rápida (< 2 segundos) para não bloquear o Bling

#### 2. **Cronjob de Verificação** (Backend)
- Job agendado que roda periodicamente (30 minutos)
- Verifica produtos que podem ter mudado
- Detecta eventos perdidos ou não processados
- Funciona como rede de segurança

#### 3. **Event Queue** (Backend)
- Fila de processamento (Bull/Redis ou similar)
- Armazena eventos recebidos via webhook
- Permite processamento assíncrono
- Retry automático em caso de falha

#### 4. **Event Processor** (Backend)
- Processamento assíncrono de eventos (da fila)
- Verificação de anti-duplicação
- Filtro por depósito
- Roteamento por origem

#### 5. **Estoque Calculator** (Backend)
- Busca saldos dos 3 depósitos principais
- Cálculo da soma
- Validação de dados
- Usado tanto por webhook quanto por cronjob

#### 6. **Sincronizador de Compartilhados** (Backend)
- Atualização dos 2 depósitos compartilhados
- Operação de Balanço (B) no Bling
- Tratamento de erros e retry
- Rate limiting para não sobrecarregar API

#### 7. **DataStore/Anti-Duplicação** (Backend)
- Armazenamento de eventos processados
- Verificação de duplicatas
- Limpeza de registros antigos
- Evita processar o mesmo evento duas vezes

#### 8. **Monitoramento e Logs** (Backend + Frontend)
- Logs detalhados de cada sincronização
- Identificação da origem (webhook vs cronjob)
- Dashboard de monitoramento
- Alertas de erros

#### 9. **Interface de Gerenciamento** (Frontend)
- Configuração de depósitos
- Visualização de sincronizações
- Histórico de eventos (com origem: webhook/cronjob/manual)
- Controles manuais (forçar sincronização, etc.)
- Configuração de frequência do cronjob

---

## 🔄 Fluxo de Funcionamento

### Fluxo 1: Automático via Webhook (Principal)

```
1. Bling → Webhook → EstoqueUni
   ↓
2. Validação do Webhook (assinatura, autenticação)
   ↓
3. Resposta Rápida (200 OK) para não bloquear Bling
   ↓
4. Adiciona Evento na Fila (Event Queue)
   ↓
5. Processamento Assíncrono:
   ├─ Verificação Anti-Duplicação
   ├─ Filtro por Depósito (só os 3 principais)
   ├─ Identificação da Origem (W2I ou TechYou)
   ├─ Busca Saldos dos 3 Depósitos Principais
   ├─ Cálculo da Soma
   ├─ Atualização do Compartilhado W2I (Balanço)
   ├─ Atualização do Compartilhado TechYou (Balanço)
   ├─ Registro no DataStore (anti-duplicação)
   └─ Log da Sincronização (origem: webhook)
```

**Vantagens:**
- ⚡ Tempo real (processamento imediato)
- 🎯 Processa apenas quando há mudanças
- 💪 Alta eficiência

---

### Fluxo 2: Cronjob de Verificação (Fallback)

```
1. Cronjob Dispara (a cada 30 minutos)
   ↓
2. Busca Produtos que Podem Ter Mudado
   (última sincronização > 30 min OU produtos com eventos recentes)
   ↓
3. Para Cada Produto:
   ├─ Verifica se já foi sincronizado recentemente (anti-duplicação)
   ├─ Busca Saldos Atuais dos 3 Depósitos Principais
   ├─ Compara com Última Sincronização
   ├─ Se Houve Mudança:
   │  ├─ Calcula a Soma
   │  ├─ Atualiza Compartilhado W2I (Balanço)
   │  ├─ Atualiza Compartilhado TechYou (Balanço)
   │  ├─ Registro no DataStore
   │  └─ Log da Sincronização (origem: cronjob)
   └─ Se Não Houve Mudança: Pula para próximo produto
   ↓
4. Relatório de Verificação
   (quantos produtos verificados, quantos atualizados, erros)
```

**Vantagens:**
- 🛡️ Garante que nada seja perdido
- 🔍 Detecta eventos que o webhook não recebeu
- 🔄 Funciona como backup automático

---

### Fluxo 3: Manual (via Interface)

```
1. Usuário clica em "Sincronizar Agora"
   ↓
2. Seleção de Produto (opcional) ou "Todos"
   ↓
3. Busca Saldos dos 3 Depósitos Principais
   ↓
4. Cálculo da Soma
   ↓
5. Atualização dos 2 Compartilhados
   ↓
6. Feedback visual para o usuário
```

---

## 📊 Estrutura de Dados

### Model: EventoProcessado

```javascript
{
  tenantId: String,
  blingAccountId: String,  // W2I ou TechYou
  produtoId: String,       // ID do produto no Bling
  eventoId: String,        // ID do evento no Bling
  chaveUnica: String,      // produtoId-eventoId (único, indexado)
  depositoOrigem: String,  // ID do depósito que originou
  origem: String,          // 'webhook' | 'cronjob' | 'manual'
  saldos: {
    principalW2I: Number,
    fornecedorW2I: Number,
    principalTechYou: Number,
    soma: Number
  },
  compartilhadosAtualizados: {
    compartilhadoW2I: Number,
    compartilhadoTechYou: Number
  },
  processadoEm: Date,
  sucesso: Boolean,
  erro: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Índices:**
- `{ chaveUnica: 1 }` (único) - Garante anti-duplicação
- `{ tenantId: 1, processadoEm: -1 }` - Busca rápida por tenant e data
- `{ origem: 1, processadoEm: -1 }` - Busca por origem

### Model: ConfiguracaoSincronizacao

```javascript
{
  tenantId: String,        // (único, indexado)
  ativo: Boolean,
  depositos: {
    principalW2I: String,      // 14886873196
    fornecedorW2I: String,     // 14886879193
    principalTechYou: String,  // 14887164856
    compartilhadoW2I: String,  // 14888283087
    compartilhadoTechYou: String // 14888283080
  },
  contasBling: {
    w2ishop: String,  // blingAccountId da W2ISHOP
    techyou: String   // blingAccountId da TECHYOU
  },
  webhook: {
    url: String,
    secret: String,
    ativo: Boolean,
    ultimaRequisicao: Date
  },
  cronjob: {
    ativo: Boolean,
    intervaloMinutos: Number,  // Padrão: 30
    ultimaExecucao: Date,
    proximaExecucao: Date
  },
  ultimaSincronizacao: Date,
  estatisticas: {
    totalWebhooks: Number,
    totalCronjobs: Number,
    totalManuais: Number,
    eventosPerdidos: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Índices:**
- `{ tenantId: 1 }` (único) - Garante uma configuração por tenant

### Model: BlingConfig (Já Existente)

Armazena configurações e tokens OAuth de cada conta Bling.

```javascript
{
  blingAccountId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
    // NÃO unique - permite múltiplas contas por tenant
  },
  accountName: {
    type: String,
    default: "Conta Bling"
  },
  access_token: String,
  refresh_token: String,
  expires_in: Number,        // Segundos até expiração
  expiry_date: Number,       // Timestamp de expiração
  store_id: String,          // ID da loja no Bling
  store_name: String,        // Nome da loja
  is_active: {
    type: Boolean,
    default: true
  },
  last_sync: Date,
  last_error: String,
  createdAt: Date,
  updatedAt: Date
}
```

**Índices:**
- `{ tenantId: 1, blingAccountId: 1 }` (único) - Garante unicidade por tenant
- `{ tenantId: 1 }` - Busca rápida por tenant
- `{ blingAccountId: 1 }` - Busca rápida por conta

**Métodos:**
- `isTokenExpired()` - Verifica se token expirou
- `isConfigurationComplete()` - Verifica se config está completa
- `needsReauthorization()` - Verifica se precisa re-autorizar

### Model: Produto (Já Existente)

Armazena produtos com estoque unificado.

```javascript
{
  sku: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  nome: String,
  descricao: String,
  estoque: {
    type: Number,
    default: 0
    // Calculado automaticamente a partir de estoquePorConta
  },
  estoquePorConta: {
    type: Map,
    of: Number,
    default: {}
    // Estrutura: { blingAccountId: quantidade }
  },
  ultimaSincronizacao: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Índices:**
- `{ tenantId: 1, sku: 1 }` (único) - Garante unicidade por tenant
- `{ tenantId: 1 }` - Busca rápida por tenant
- `{ sku: 1 }` - Busca rápida por SKU
- `{ ultimaSincronizacao: 1 }` - Usado pelo cronjob para encontrar produtos desatualizados

**Métodos:**
- `atualizarEstoqueUnificado(estoquePorConta)` - Atualiza estoque e calcula total
- `getEstoqueTotal()` - Retorna estoque total

**Middlewares:**
- `pre('save')` - Calcula `estoque` automaticamente a partir de `estoquePorConta`
- `pre('findOneAndUpdate')` - Recalcula `estoque` em atualizações

---

## 🔌 Integração com Bling

### Estratégia de Integração

#### 1. **Webhook do Bling (Principal)**
- Configurar webhook no Bling para enviar eventos ao EstoqueUni
- URL: `https://estoqueuni.dominio.com/api/webhooks/bling`
- Eventos: Movimentações de estoque nos depósitos principais
- **Vantagem**: Tempo real, eficiente

#### 2. **API do Bling - Buscar Estoque (Usado por ambos)**
- `GET /produtos/{id}/depositos/{idDeposito}`
- Buscar saldo atual de um produto em um depósito específico
- Usado tanto pelo webhook quanto pelo cronjob

#### 3. **API do Bling - Listar Produtos (Cronjob)**
- `GET /produtos` (com filtros)
- Usado pelo cronjob para verificar produtos que podem ter mudado
- Permite buscar produtos modificados recentemente

#### 4. **API do Bling - Atualizar Estoque (Balanço)**
- `POST /produtos/{id}/depositos/{idDeposito}`
- Operação tipo "B" (Balanço) para definir valor absoluto
- Usado para atualizar os 2 depósitos compartilhados

### Autenticação OAuth 2.0

O sistema utiliza OAuth 2.0 do Bling para autenticação. O fluxo funciona da seguinte forma:

#### Fluxo de Autorização

1. **Início da Autorização**
   - Usuário solicita conexão de conta Bling
   - Sistema gera `blingAccountId` único
   - Cria registro `BlingConfig` (sem tokens ainda)
   - Gera URL de autorização OAuth com `state` contendo `tenantId` e `blingAccountId`
   - Retorna URL para o frontend abrir em popup

2. **Autorização no Bling**
   - Popup redireciona para Bling
   - Usuário autoriza aplicação
   - Bling redireciona para callback: `/api/bling/auth/callback?code=XXX&state=YYY`

3. **Callback e Troca de Tokens**
   - Backend recebe `code` e `state`
   - Decodifica `state` (contém `tenantId` e `blingAccountId`)
   - Troca `code` por tokens via `POST /oauth/token`
   - Salva tokens no `BlingConfig`:
     - `access_token`
     - `refresh_token`
     - `expires_in` (segundos até expiração)
     - `expiry_date` (timestamp de expiração)

4. **Renovação Automática de Tokens**
   - Sistema verifica se token expirou (`isTokenExpired()`)
   - Se expirado:
     - Usa `refresh_token` para obter novo `access_token`
     - Atualiza `BlingConfig`
   - Se `refresh_token` inválido:
     - Marca conta como necessitando re-autorização
     - Lança erro `REAUTH_REQUIRED`

#### Endpoints OAuth Utilizados

- `POST https://www.bling.com.br/Api/v3/oauth/token` - Troca code por tokens
- `POST https://www.bling.com.br/Api/v3/oauth/token` - Renova token (refresh_token)

#### Autenticação em Requisições

Todas as requisições à API Bling requerem header:
```
Authorization: Bearer {access_token}
```

### Estrutura de Resposta - Produto

```javascript
{
  data: [{
    id: Number,
    codigo: String,           // SKU
    nome: String,
    estoque: {
      saldoVirtualTotal: Number  // Estoque disponível
    },
    // ... outros campos
  }]
}
```

### Tratamento de Erros da API Bling

- **401/403**: Token inválido ou expirado → Renovar token ou re-autorizar
- **404**: Produto não encontrado → Retornar 0 para estoque
- **429**: Rate limit → Aguardar e tentar novamente (com backoff exponencial)
- **500+**: Erro do servidor Bling → Logar erro e continuar com outras contas

### Normalização de SKU

Para garantir que produtos com SKUs similares sejam tratados como o mesmo produto, o sistema normaliza SKUs antes de buscar:

```javascript
function normalizeSku(sku) {
  if (!sku) return '';
  return sku
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^0+/, ''); // Remove zeros à esquerda
}
```

**Exemplos:**
- `"ABC123"` → `"ABC123"`
- `"abc123"` → `"ABC123"`
- `"  ABC123  "` → `"ABC123"`
- `"000123"` → `"123"`

### Rate Limiting

- **Webhook**: Processamento assíncrono evita bloqueios
- **Cronjob**: Rate limiting para não sobrecarregar API
  - Máximo de 10 requisições/segundo
  - Delay entre requisições quando necessário
  - Backoff exponencial em caso de rate limit (429)

### Timeout de Requisições

Configurar timeout adequado para requisições à API Bling:

```javascript
axios.get(url, {
  timeout: 30000  // 30 segundos
});
```

### Retry Logic

Implementar retry para requisições que falham:

```javascript
async function getEstoqueComRetry(sku, tenantId, blingAccountId, tentativas = 3) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await getEstoqueProduto(sku, tenantId, blingAccountId);
    } catch (error) {
      if (i === tentativas - 1) throw error;
      await delay(1000 * (i + 1)); // Backoff exponencial
    }
  }
}
```

---

## 🎨 Interface do Usuário (Frontend)

### Página: Sincronização de Estoques

#### Seção 1: Status da Sincronização
- Indicador visual (ativo/inativo)
- Status do Webhook (ativo/inativo, última requisição)
- Status do Cronjob (ativo/inativo, última execução, próxima execução)
- Última sincronização realizada (com origem: webhook/cronjob/manual)
- Estatísticas:
  - Total de sincronizações hoje (por origem)
  - Eventos processados via webhook
  - Eventos processados via cronjob
  - Eventos perdidos/detectados pelo cronjob
  - Taxa de sucesso/erro

#### Seção 2: Configuração de Depósitos
- Lista dos 5 depósitos configurados
- Possibilidade de editar IDs dos depósitos
- Validação de configuração

#### Seção 2.1: Configuração de Webhook
- URL do webhook configurada no Bling
- Status da conexão
- Teste de webhook (enviar evento de teste)
- Histórico de requisições recebidas

#### Seção 2.2: Configuração de Cronjob
- Ativar/desativar cronjob
- Configurar intervalo (padrão: 30 minutos)
- Última execução e próxima execução
- Estatísticas de execuções

#### Seção 3: Sincronização Manual
- Botão "Sincronizar Todos os Produtos"
- Campo para sincronizar produto específico (por SKU)
- Progresso da sincronização em tempo real

#### Seção 4: Histórico de Sincronizações
- Tabela com últimas sincronizações
- Coluna "Origem" (webhook/cronjob/manual)
- Filtros (data, produto, depósito, status, origem)
- Detalhes de cada sincronização (saldos, soma, etc.)
- Gráficos de sincronizações por origem

#### Seção 5: Logs e Monitoramento
- Visualização de logs em tempo real
- Filtros de busca
- Exportação de logs

---

## 🚀 Fases de Implementação

### Fase 1: Estrutura Base
- [ ] Criar models (EventoProcessado, ConfiguracaoSincronizacao)
- [ ] Criar serviços base (BlingService para estoque)
- [ ] Criar endpoint de webhook (receber eventos)
- [ ] Implementar anti-duplicação básica
- [ ] Configurar estrutura de fila (Bull/Redis ou similar)

### Fase 2: Lógica de Sincronização
- [ ] Implementar filtro por depósito
- [ ] Implementar busca de saldos dos 3 depósitos
- [ ] Implementar cálculo da soma
- [ ] Implementar atualização dos compartilhados (Balanço)
- [ ] Criar serviço compartilhado (usado por webhook e cronjob)

### Fase 3: Processamento Assíncrono (Webhook)
- [ ] Implementar fila de processamento (Bull/Redis)
- [ ] Processamento assíncrono de eventos do webhook
- [ ] Retry automático em caso de falha
- [ ] Rate limiting para API do Bling
- [ ] Logs com identificação de origem (webhook)

### Fase 3.1: Cronjob de Verificação (Fallback)
- [ ] Implementar job agendado (node-cron ou similar)
- [ ] Lógica de verificação de produtos modificados
- [ ] Integração com serviço de sincronização compartilhado
- [ ] Logs com identificação de origem (cronjob)
- [ ] Configuração de intervalo (padrão: 30 minutos)
- [ ] Estatísticas de execução do cronjob

### Fase 4: Interface do Usuário
- [ ] Página de configuração
  - [ ] Configuração de depósitos
  - [ ] Configuração de webhook (URL, status, teste)
  - [ ] Configuração de cronjob (intervalo, ativar/desativar)
- [ ] Página de sincronização manual
- [ ] Página de histórico (com filtro por origem)
- [ ] Dashboard de monitoramento
  - [ ] Estatísticas por origem (webhook/cronjob/manual)
  - [ ] Gráficos de sincronizações
  - [ ] Alertas de eventos perdidos

### Fase 5: Testes e Ajustes
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes end-to-end
- [ ] Testes manuais recomendados:
  - [ ] Autenticação OAuth (adicionar contas W2I e TechYou)
  - [ ] Webhook recebendo eventos corretamente
  - [ ] Cronjob executando no intervalo configurado
  - [ ] Sincronização de produto individual
  - [ ] Sincronização em lote
  - [ ] Verificar se estoque é somado corretamente
  - [ ] Múltiplas contas (produto existe em ambas, apenas uma, nenhuma)
  - [ ] Renovação automática de tokens
  - [ ] Re-autorização quando refresh_token inválido
  - [ ] Anti-duplicação funcionando
  - [ ] Cronjob detectando eventos perdidos
- [ ] Ajustes baseados em uso real

### Fase 6: Migração do Make.com
- [ ] Configurar webhook no Bling apontando para EstoqueUni
- [ ] Ativar cronjob de fallback (30 minutos)
- [ ] Testar em paralelo com Make.com (ambos processando)
- [ ] Comparar resultados (webhook vs Make.com)
- [ ] Validar cronjob detectando eventos corretamente
- [ ] Desativar cenário no Make.com
- [ ] Monitoramento pós-migração (7 dias)
  - [ ] Verificar se webhook está funcionando
  - [ ] Verificar se cronjob está capturando eventos perdidos
  - [ ] Ajustar intervalo do cronjob se necessário

---

## 🔒 Segurança

### Webhook do Bling
- Validação de assinatura do webhook (se disponível)
- Rate limiting no endpoint
- Logs de todas as requisições recebidas

### Autenticação
- JWT para acesso à API
- Validação de tenantId em todas as operações
- Permissões por usuário (se necessário)

### Validação de TenantId

Todas as rotas requerem `tenantId` validado via middleware:

```javascript
// Middleware: validarTenantId.js
// Busca tenantId em:
// 1. req.query.tenantId
// 2. req.body.tenantId
// 3. req.headers['x-tenant-id']
```

### Isolamento Multitenant

- Dados são isolados por `tenantId`
- Um tenant não pode acessar dados de outro tenant
- Índices compostos garantem isolamento: `{ tenantId: 1, ... }`

### Dados Sensíveis
- Tokens do Bling armazenados criptografados
- Secrets de webhook em variáveis de ambiente
- Logs não devem expor tokens ou senhas

---

## 📝 Considerações Técnicas

### Performance
- **Webhook**: Processamento assíncrono para não bloquear (resposta < 2s)
- **Cronjob**: Processamento em lote para múltiplos produtos
- Cache de saldos quando apropriado (evitar consultas desnecessárias)
- Rate limiting para não sobrecarregar API do Bling

### Confiabilidade
- **Webhook**: Retry automático em caso de falha na API do Bling
- **Cronjob**: Detecta e processa eventos perdidos pelo webhook
- Dead letter queue para eventos que falharam múltiplas vezes
- Alertas para erros críticos
- **Estratégia Híbrida**: Se webhook falhar, cronjob garante sincronização

### Escalabilidade
- Fila de processamento para lidar com picos
- Rate limiting para não sobrecarregar API do Bling
- Processamento em paralelo quando possível

### Monitoramento
- Logs estruturados (JSON)
- Métricas de performance
- Alertas proativos

### Formato de Log

```
[YYYY-MM-DD HH:mm:ss] [CONTEXTO] Mensagem
```

**Exemplos:**
```
[2025-01-27 10:30:15] [WEBHOOK] Evento recebido: produtoId=123, eventoId=456
[2025-01-27 10:30:16] [ESTOQUE-SYNC] Sincronizando produto SKU: ABC123 (origem: webhook)
[2025-01-27 10:30:17] [BLING-SERVICE] Token renovado para conta: bling_123456
[2025-01-27 10:30:18] [ESTOQUE-SYNC] Saldos: Principal W2I=10, Fornecedor W2I=5, Principal TechYou=3, Soma=18
[2025-01-27 10:30:19] [ESTOQUE-SYNC] Compartilhados atualizados: W2I=18, TechYou=18
[2025-01-27 10:30:20] [CRONJOB] Execução iniciada: verificando produtos desatualizados
[2025-01-27 10:30:21] [ESTOQUE-SYNC] Erro ao buscar estoque da conta bling_123456: Produto não encontrado
```

### Processamento em Paralelo

A sincronização de estoque processa múltiplas contas em paralelo usando `Promise.all()`:

```javascript
const promises = contasAtivas.map(conta => 
  getEstoqueProduto(sku, tenantId, conta.blingAccountId)
);
const resultados = await Promise.all(promises);
```

### Tratamento Gracioso de Erros

Se uma conta falhar durante sincronização, o sistema:
1. Registra o erro
2. Usa 0 para essa conta
3. Continua processando outras contas
4. Retorna resultado parcial com lista de erros

### Bulk Operations

Para sincronização em lote (cronjob), usa `bulkWrite()` do MongoDB para atualizar múltiplos produtos de uma vez:

```javascript
const operations = produtos.map(produto => ({
  updateOne: {
    filter: { tenantId, sku: produto.sku },
    update: { $set: { estoque, estoquePorConta, ultimaSincronizacao } },
    upsert: true
  }
}));
await Produto.bulkWrite(operations);
```

---

## ✅ Critérios de Aceite

### Funcionalidade
- [ ] Webhook recebe eventos do Bling corretamente
- [ ] Cronjob executa no intervalo configurado (padrão: 30 min)
- [ ] Anti-duplicação funciona (não processa eventos duplicados)
- [ ] Filtro por depósito funciona (só processa os 3 principais)
- [ ] Soma dos 3 depósitos é calculada corretamente
- [ ] Os 2 compartilhados são atualizados com a soma
- [ ] Operação de Balanço (B) é usada corretamente
- [ ] Interface permite sincronização manual
- [ ] Histórico de sincronizações exibe origem (webhook/cronjob/manual)
- [ ] Cronjob detecta eventos perdidos pelo webhook

### Performance
- [ ] Webhook responde em menos de 2 segundos
- [ ] Processamento completo (webhook) em menos de 10 segundos
- [ ] Cronjob processa lote de produtos em tempo razoável
- [ ] Sistema suporta pelo menos 100 eventos/minuto (webhook)
- [ ] Rate limiting funciona corretamente

### Confiabilidade
- [ ] Retry automático funciona em caso de falha
- [ ] Eventos não são perdidos (cronjob detecta eventos perdidos)
- [ ] Logs são gerados corretamente (com origem identificada)
- [ ] Cronjob funciona como fallback quando webhook falha
- [ ] Estatísticas de eventos perdidos são rastreadas

---

## 📚 Referências

### Documentação do Bling
- API de Produtos: https://developer.bling.com.br/
- Webhooks: https://developer.bling.com.br/webhooks
- API v3: https://developer.bling.com.br/api/v3

### Sistema Atual (Make.com)
- Cenário: v10 REAL
- Regras documentadas neste arquivo
- Abordagem: Webhook apenas (sem cronjob de fallback)

### Tecnologias Utilizadas
- **Fila de Processamento**: Bull (Redis) ou similar
- **Agendamento de Jobs**: node-cron ou agenda
- **API**: Express.js (já implementado)
- **Banco de Dados**: MongoDB (já implementado)

---

## 🎯 Próximos Passos

1. **Revisar e aprovar** este documento
2. **Criar issues/tasks** para cada fase de implementação
3. **Iniciar Fase 1**: Estrutura base
4. **Testar** cada fase antes de avançar
5. **Migrar** do Make.com quando tudo estiver funcionando

---

---

## 📊 Diagrama de Arquitetura Híbrida

```
┌─────────────────────────────────────────────────────────────┐
│                        BLING API                             │
│  ┌──────────────┐              ┌──────────────┐            │
│  │  W2ISHOP     │              │  TECHYOU     │            │
│  │  Account     │              │  Account     │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                              │                    │
│         └──────────┬───────────────────┘                    │
│                    │ Webhook (Eventos)                      │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    ESTOQUEUNI                                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Webhook Receiver (Principal)                        │  │
│  │  - Recebe eventos em tempo real                      │  │
│  │  - Responde < 2s                                     │  │
│  │  - Adiciona na fila                                  │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  Event Queue (Bull/Redis)                            │  │
│  │  - Fila de processamento                             │  │
│  │  - Retry automático                                  │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  Event Processor                                     │  │
│  │  - Anti-duplicação                                   │  │
│  │  - Filtro por depósito                               │  │
│  │  - Roteamento por origem                             │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                           │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │  Sincronizador de Estoques (Compartilhado)          │  │
│  │  - Busca saldos dos 3 depósitos                     │  │
│  │  - Calcula soma                                     │  │
│  │  - Atualiza compartilhados (Balanço)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cronjob de Verificação (Fallback)                  │  │
│  │  - Executa a cada 30 minutos                        │  │
│  │  - Verifica produtos modificados                    │  │
│  │  - Detecta eventos perdidos                         │  │
│  │  - Usa mesmo Sincronizador de Estoques              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DataStore / Anti-Duplicação                        │  │
│  │  - MongoDB (EventoProcessado)                       │  │
│  │  - Evita processar eventos duplicados               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Monitoramento e Logs                               │  │
│  │  - Logs com origem (webhook/cronjob/manual)         │  │
│  │  - Estatísticas e métricas                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

**Última atualização:** 2025-01-XX  
**Versão:** 2.0 (Estratégia Híbrida)  
**Autor:** Sistema EstoqueUni

