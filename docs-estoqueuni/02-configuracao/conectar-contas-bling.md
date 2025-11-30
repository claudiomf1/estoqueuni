---
titulo: Conectar Contas Bling
categoria: configuracao
tags: [bling, oauth, autenticacao, contas]
dificuldade: intermediario
ultima_atualizacao: 2025-01-29
---

# Como Conectar Contas Bling

O EstoqueUni permite conectar múltiplas contas Bling para sincronização centralizada de estoques.

## 📋 Pré-requisitos

- Conta ativa no Bling ERP
- Acesso de administrador ao Bling
- Permissões para criar aplicações OAuth

## 🔗 Passo a Passo

### 1. Acessar a Página de Contas

1. Faça login no EstoqueUni
2. Navegue até **Contas Bling** no menu
3. Clique em **Adicionar Nova Conta**

### 2. Autorizar no Bling

1. Clique no botão **Conectar com Bling**
2. Você será redirecionado para a página de autorização do Bling
3. Faça login na sua conta Bling
4. Autorize o EstoqueUni a acessar seus dados

### 3. Configuração Automática

Após a autorização:
- O sistema receberá automaticamente os tokens OAuth
- A conta será adicionada à lista de contas conectadas
- Você poderá começar a configurar depósitos e sincronização

## 🔄 Múltiplas Contas

Você pode conectar quantas contas Bling precisar:

- Cada conta é gerenciada independentemente
- Configurações de depósitos são por conta
- Webhooks são configurados por conta
- Histórico de sincronizações mostra a conta de origem

## ⚠️ Importante

- Mantenha os tokens OAuth seguros
- Se os tokens expirarem, será necessário reconectar
- Cada conta precisa ser configurada separadamente

## 🐛 Problemas Comuns

### Token Expirado
Se receber erro de token expirado:
1. Vá até a página de Contas Bling
2. Clique em **Reconectar** na conta desejada
3. Autorize novamente no Bling

### Erro de Permissão
Certifique-se de que:
- Você tem permissões de administrador no Bling
- A aplicação OAuth foi criada corretamente
- Os escopos necessários estão habilitados

