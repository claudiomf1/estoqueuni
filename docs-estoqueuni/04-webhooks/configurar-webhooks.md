---
titulo: Configurar Webhooks
categoria: webhooks
tags: [webhooks, notificacoes, automacao, bling]
dificuldade: intermediario
ultima_atualizacao: 2025-01-29
---

# Como Configurar Webhooks no EstoqueUni

Os webhooks permitem que o EstoqueUni receba notificações em tempo real do Bling quando houver mudanças nos estoques.

## 🎯 O que são Webhooks?

Webhooks são notificações automáticas enviadas pelo Bling para o EstoqueUni sempre que:
- Um produto é vendido
- O estoque de um produto é alterado
- Um depósito é modificado
- Outros eventos relevantes ocorrem

## 📋 Pré-requisitos

- Conta Bling conectada ao EstoqueUni
- Acesso ao servidor onde o EstoqueUni está hospedado
- URL pública acessível (não localhost)

## 🔧 Passo a Passo

### 1. Acessar o Assistente de Configuração

1. Vá até a página de **Sincronização**
2. Na seção **Configuração de Notificações Automáticas (Webhook)**
3. Clique no botão **Configurar Notificações**

### 2. Selecionar a Conta Bling

1. Selecione a conta Bling que deseja configurar
2. Clique em **Próximo**

### 3. Copiar a URL do Webhook

1. O sistema exibirá a URL do webhook
2. Clique em **Copiar URL**
3. Guarde esta URL, você precisará dela no Bling

### 4. Abrir o Bling

1. Clique em **Abrir Bling**
2. Faça login na sua conta Bling
3. Navegue até **Configurações > Webhooks**

### 5. Configurar no Bling

1. No Bling, clique em **Adicionar Webhook**
2. Cole a URL copiada anteriormente
3. Selecione os eventos que deseja monitorar:
   - **Produto vendido** (obrigatório)
   - **Estoque alterado** (obrigatório)
   - **Depósito modificado** (opcional)

### 6. Ativar Webhooks

1. No assistente do EstoqueUni, marque os webhooks como configurados
2. Clique em **Finalizar**
3. O sistema verificará se os webhooks estão funcionando

## ✅ Verificação

Após configurar, o sistema:
- Verifica automaticamente se os webhooks estão ativos
- Exibe o status de cada webhook por conta
- Mostra quando cada webhook foi configurado

## 🔄 Múltiplas Contas

Para cada conta Bling conectada:
- Configure os webhooks separadamente
- Cada conta tem sua própria URL de webhook
- O status é exibido individualmente por conta

## ⚠️ Importante

- A URL do webhook deve ser pública e acessível
- O Bling precisa conseguir fazer requisições HTTPS para o servidor
- Mantenha os webhooks ativos para sincronização em tempo real

## 🐛 Troubleshooting

### Webhook não está funcionando
1. Verifique se a URL está correta no Bling
2. Confirme que o servidor está acessível publicamente
3. Verifique os logs do sistema para erros

### Erro de SSL
- Certifique-se de que o servidor tem certificado SSL válido
- O Bling requer HTTPS para webhooks

### Webhook não recebe notificações
- Verifique se os eventos estão selecionados no Bling
- Confirme que os produtos estão sendo vendidos/alterados
- Verifique os logs do sistema

