# 🚨 ALERTA CRÍTICO: Sistema Multitenant - Hardcoding Detectado

## ⚠️ Problema Identificado

O sistema foi implementado com **hardcoding de nomes de empresas** (W2ISHOP e TECHYOU), mas o sistema é **MULTITENANT** e deve ser **genérico** para qualquer empresa.

---

## 🔴 Problemas Encontrados

### 1. **Model ConfiguracaoSincronizacao** ❌

**Arquivo:** `backend/src/models/ConfiguracaoSincronizacao.js`

**Problema:**
```javascript
contasBling: {
  w2ishop: { type: String },  // ❌ HARDCODED
  techyou: { type: String },  // ❌ HARDCODED
}
```

**Deveria ser:**
```javascript
contasBling: [{
  blingAccountId: String,
  accountName: String,
  depositosPrincipais: [String],  // Array de IDs de depósitos principais
  depositoCompartilhado: String,  // ID do depósito compartilhado
}]
```

**Impacto:** 
- ❌ Só funciona para empresas chamadas W2ISHOP e TECHYOU
- ❌ Não permite N contas por tenant
- ❌ Não é escalável para outros clientes

---

### 2. **Lógica de Identificação de Origem** ❌

**Arquivo:** `backend/src/services/eventProcessorService.js` (não criado ainda, mas especificado)

**Problema na especificação:**
```javascript
// ❌ HARDCODED - Compara com nomes fixos
if (blingAccountId === config.contasBling.w2ishop) return 'W2I';
if (blingAccountId === config.contasBling.techyou) return 'TechYou';
```

**Deveria ser:**
```javascript
// ✅ Genérico - Busca conta no array
const conta = config.contasBling.find(c => c.blingAccountId === blingAccountId);
return conta ? conta.accountName : null;
```

**Impacto:**
- ❌ Lógica quebrada para outras empresas
- ❌ Não funciona para múltiplas contas

---

### 3. **Depósitos Hardcoded** ❌

**Arquivo:** `backend/src/models/ConfiguracaoSincronizacao.js`

**Problema:**
```javascript
depositos: {
  principalW2I: String,      // ❌ HARDCODED
  fornecedorW2I: String,     // ❌ HARDCODED
  principalTechYou: String,  // ❌ HARDCODED
  compartilhadoW2I: String,  // ❌ HARDCODED
  compartilhadoTechYou: String // ❌ HARDCODED
}
```

**Deveria ser:**
```javascript
depositos: [{
  id: String,
  nome: String,
  tipo: 'principal' | 'compartilhado',
  contaBlingId: String,  // Relaciona com contasBling
}]
```

**Impacto:**
- ❌ Só funciona para estrutura específica de W2ISHOP/TECHYOU
- ❌ Não permite configuração flexível de depósitos

---

### 4. **Frontend - Interface Hardcoded** ❌

**Arquivo:** Especificação do AGENTE 6

**Problema na especificação:**
- Botões fixos "Conectar W2ISHOP" e "Conectar TECHYOU"
- Validação de "ambas as contas" (assume sempre 2)
- Filtro por nome "W2ISHOP" ou "TECHYOU"

**Deveria ser:**
- Interface genérica que lista todas as contas do tenant
- Permite adicionar/remover contas dinamicamente
- Validação baseada em configuração (não em nomes)

**Impacto:**
- ❌ Interface não funciona para outras empresas
- ❌ Não permite N contas

---

## ✅ Solução: Arquitetura Genérica Multitenant

### Model: ConfiguracaoSincronizacao (Corrigido)

```javascript
{
  tenantId: String,  // Único por tenant
  ativo: Boolean,
  
  // ✅ GENÉRICO: Array de contas Bling
  contasBling: [{
    blingAccountId: String,      // ID da conta no Bling
    accountName: String,         // Nome da conta (ex: "W2ISHOP", "TECHYOU", "Empresa X")
    isActive: Boolean,           // Se a conta está ativa
    depositosPrincipais: [String],  // Array de IDs de depósitos principais desta conta
    depositoCompartilhado: String,  // ID do depósito compartilhado desta conta
  }],
  
  // ✅ GENÉRICO: Array de depósitos
  depositos: [{
    id: String,                  // ID do depósito no Bling
    nome: String,                // Nome do depósito
    tipo: String,                // 'principal' | 'compartilhado'
    contaBlingId: String,        // Relaciona com contasBling[].blingAccountId
  }],
  
  // Configuração de sincronização
  regraSincronizacao: {
    tipo: 'soma',                // 'soma' | 'media' | 'max' | 'min' | 'custom'
    depositosPrincipais: [String], // IDs dos depósitos que devem ser somados
    depositosCompartilhados: [String], // IDs dos depósitos que recebem a soma
  },
  
  webhook: { ... },
  cronjob: { ... },
  estatisticas: { ... }
}
```

### Lógica de Sincronização (Corrigida)

```javascript
// ✅ GENÉRICO: Busca depósitos principais da configuração
const depositosPrincipais = config.regraSincronizacao.depositosPrincipais;

// ✅ GENÉRICO: Busca saldos de todos os depósitos principais
const saldos = await Promise.all(
  depositosPrincipais.map(depositoId => 
    buscarSaldo(produtoId, depositoId, tenantId)
  )
);

// ✅ GENÉRICO: Calcula soma
const soma = saldos.reduce((acc, saldo) => acc + saldo, 0);

// ✅ GENÉRICO: Atualiza todos os depósitos compartilhados
await Promise.all(
  config.regraSincronizacao.depositosCompartilhados.map(depositoId =>
    atualizarDeposito(produtoId, depositoId, soma, tenantId)
  )
);
```

### Identificação de Origem (Corrigida)

```javascript
// ✅ GENÉRICO: Busca conta pelo blingAccountId
function identificarOrigem(blingAccountId, config) {
  const conta = config.contasBling.find(
    c => c.blingAccountId === blingAccountId
  );
  return conta ? conta.accountName : 'desconhecida';
}
```

---

## 📋 Checklist de Correções Necessárias

### Backend - CRÍTICO

- [ ] **1. Refatorar Model ConfiguracaoSincronizacao**
  - [ ] Mudar `contasBling` de objeto fixo para array
  - [ ] Mudar `depositos` de objeto fixo para array
  - [ ] Adicionar `regraSincronizacao` genérica
  - [ ] Criar migration script para dados existentes

- [ ] **2. Refatorar sincronizadorEstoqueService.js**
  - [ ] Remover referências hardcoded a "W2I" e "TechYou"
  - [ ] Usar `regraSincronizacao.depositosPrincipais` (array)
  - [ ] Usar `regraSincronizacao.depositosCompartilhados` (array)
  - [ ] Tornar genérico para N depósitos

- [ ] **3. Refatorar eventProcessorService.js** (quando criar)
  - [ ] Remover lógica hardcoded de identificação
  - [ ] Usar busca genérica no array de contas
  - [ ] Filtrar depósitos usando array da configuração

- [ ] **4. Refatorar verificacaoEstoqueService.js**
  - [ ] Remover referências hardcoded
  - [ ] Usar configuração genérica

- [ ] **5. Atualizar Controllers**
  - [ ] Validar estrutura genérica
  - [ ] Permitir adicionar/remover contas dinamicamente
  - [ ] Validar regra de sincronização

### Frontend - CRÍTICO

- [ ] **6. Refatorar Interface de Configuração**
  - [ ] Remover botões fixos "W2ISHOP" e "TECHYOU"
  - [ ] Criar interface genérica para gerenciar contas
  - [ ] Permitir adicionar/remover contas
  - [ ] Configurar depósitos por conta

- [ ] **7. Refatorar Interface de Depósitos**
  - [ ] Remover campos fixos (principalW2I, etc)
  - [ ] Criar interface para adicionar depósitos
  - [ ] Associar depósitos a contas
  - [ ] Configurar regra de sincronização

- [ ] **8. Atualizar Validações**
  - [ ] Validar que há pelo menos 1 conta configurada
  - [ ] Validar que há depósitos principais configurados
  - [ ] Validar que há depósitos compartilhados configurados
  - [ ] Remover validação de "ambas as contas"

---

## 🎯 Exemplo: Como Deve Funcionar

### Cenário 1: W2ISHOP + TECHYOU (caso atual)
```javascript
{
  tenantId: "tenant-123",
  contasBling: [
    {
      blingAccountId: "bling-abc",
      accountName: "W2ISHOP",
      depositosPrincipais: ["14886873196", "14886879193"],
      depositoCompartilhado: "14888283087"
    },
    {
      blingAccountId: "bling-xyz",
      accountName: "TECHYOU",
      depositosPrincipais: ["14887164856"],
      depositoCompartilhado: "14888283080"
    }
  ],
  regraSincronizacao: {
    tipo: "soma",
    depositosPrincipais: ["14886873196", "14886879193", "14887164856"],
    depositosCompartilhados: ["14888283087", "14888283080"]
  }
}
```

### Cenário 2: Empresa X com 3 contas
```javascript
{
  tenantId: "tenant-456",
  contasBling: [
    {
      blingAccountId: "bling-111",
      accountName: "Loja Principal",
      depositosPrincipais: ["dep-1", "dep-2"],
      depositoCompartilhado: "dep-shared-1"
    },
    {
      blingAccountId: "bling-222",
      accountName: "Loja Filial",
      depositosPrincipais: ["dep-3"],
      depositoCompartilhado: "dep-shared-2"
    },
    {
      blingAccountId: "bling-333",
      accountName: "Loja Online",
      depositosPrincipais: ["dep-4"],
      depositoCompartilhado: "dep-shared-3"
    }
  ],
  regraSincronizacao: {
    tipo: "soma",
    depositosPrincipais: ["dep-1", "dep-2", "dep-3", "dep-4"],
    depositosCompartilhados: ["dep-shared-1", "dep-shared-2", "dep-shared-3"]
  }
}
```

---

## ⚠️ Impacto da Correção

### Arquivos Afetados

**Backend:**
- `models/ConfiguracaoSincronizacao.js` - **REFATORAR COMPLETO**
- `services/sincronizadorEstoqueService.js` - **REFATORAR**
- `services/eventProcessorService.js` - **CRIAR COM LÓGICA GENÉRICA**
- `services/verificacaoEstoqueService.js` - **VERIFICAR E CORRIGIR**
- `controllers/sincronizacaoController.js` - **ATUALIZAR VALIDAÇÕES**

**Frontend:**
- `components/SincronizacaoEstoque/ConfiguracaoDepositos.jsx` - **REFATORAR**
- `components/BlingConnector/` (quando criar) - **CRIAR GENÉRICO**
- `pages/ContasBling.jsx` - **VERIFICAR**

### Migration de Dados

Se já houver dados no banco com estrutura antiga, criar script de migration:

```javascript
// migration: converter estrutura antiga para nova
async function migrarConfiguracoes() {
  const configs = await ConfiguracaoSincronizacao.find({});
  
  for (const config of configs) {
    // Converter estrutura antiga para nova
    const novasContas = [];
    
    if (config.contasBling.w2ishop) {
      novasContas.push({
        blingAccountId: config.contasBling.w2ishop,
        accountName: "W2ISHOP",
        depositosPrincipais: [
          config.depositos.principalW2I,
          config.depositos.fornecedorW2I
        ],
        depositoCompartilhado: config.depositos.compartilhadoW2I
      });
    }
    
    if (config.contasBling.techyou) {
      novasContas.push({
        blingAccountId: config.contasBling.techyou,
        accountName: "TECHYOU",
        depositosPrincipais: [config.depositos.principalTechYou],
        depositoCompartilhado: config.depositos.compartilhadoTechYou
      });
    }
    
    // Atualizar com nova estrutura
    config.contasBling = novasContas;
    config.regraSincronizacao = {
      tipo: "soma",
      depositosPrincipais: [
        config.depositos.principalW2I,
        config.depositos.fornecedorW2I,
        config.depositos.principalTechYou
      ],
      depositosCompartilhados: [
        config.depositos.compartilhadoW2I,
        config.depositos.compartilhadoTechYou
      ]
    };
    
    await config.save();
  }
}
```

---

## 🎯 Prioridade

**🔴 CRÍTICO** - Sistema não funciona para outros clientes sem essas correções.

**Ordem de correção:**
1. Model ConfiguracaoSincronizacao (base de tudo)
2. Services que usam a configuração
3. Controllers e validações
4. Frontend
5. Migration de dados (se necessário)

---

**Última atualização:** 2025-01-XX  
**Status:** 🚨 **CRÍTICO - CORREÇÃO NECESSÁRIA ANTES DE PRODUÇÃO**





