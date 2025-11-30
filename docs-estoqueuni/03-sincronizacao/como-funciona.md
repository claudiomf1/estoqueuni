---
titulo: Como Funciona a Sincronização
categoria: sincronizacao
tags: [sincronizacao, estoque, bling, automacao]
dificuldade: intermediario
ultima_atualizacao: 2025-01-29
---

# Como Funciona a Sincronização

A sincronização de estoques no EstoqueUni funciona de três formas principais: webhooks em tempo real, verificação periódica automática e sincronização manual.

## 🔄 Tipos de Sincronização

### 1. Sincronização via Webhooks (Tempo Real)

Quando configurados, os webhooks permitem sincronização instantânea:

1. **Evento no Bling**: Uma venda é realizada ou estoque é alterado
2. **Notificação**: O Bling envia uma notificação para o EstoqueUni
3. **Processamento**: O EstoqueUni processa a notificação imediatamente
4. **Atualização**: Os estoques são atualizados em tempo real

**Vantagens:**
- Sincronização instantânea
- Menor carga no servidor
- Mais eficiente

### 2. Sincronização Automática (Cronjob)

A verificação periódica funciona como backup:

1. **Agendamento**: O sistema verifica estoques periodicamente (configurável)
2. **Verificação**: Compara estoques entre contas Bling
3. **Sincronização**: Atualiza diferenças encontradas
4. **Registro**: Registra no histórico

**Vantagens:**
- Garante que nada seja perdido
- Funciona mesmo se webhooks falharem
- Verificação completa do sistema

### 3. Sincronização Manual

Permite sincronização sob demanda:

1. **Solicitação**: Usuário clica em "Sincronizar Agora"
2. **Processamento**: Sistema processa imediatamente
3. **Resultado**: Exibe resultado da sincronização

**Vantagens:**
- Controle total do usuário
- Útil para testes
- Resolve problemas pontuais

## 📊 Fluxo de Dados

```
Bling ERP → Webhook/Cronjob → EstoqueUni → Processamento → Atualização → Histórico
```

## ⚙️ Configuração

Para funcionar corretamente, você precisa:

1. **Contas Bling Conectadas**: Pelo menos uma conta conectada
2. **Depósitos Configurados**: Depósitos mapeados entre contas
3. **Webhooks Ativos** (opcional mas recomendado): Para sincronização em tempo real
4. **Cronjob Ativo** (opcional): Para verificação periódica

## 📈 Monitoramento

O sistema monitora:
- Status de cada tipo de sincronização
- Última sincronização realizada
- Histórico completo de operações
- Erros e sucessos

## 🔍 Histórico

Todas as sincronizações são registradas com:
- Data e hora
- Tipo de sincronização (webhook, cronjob, manual)
- Conta Bling de origem
- Produtos processados
- Status (sucesso/erro)

