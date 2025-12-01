# 📋 Como Configurar Webhooks do Bling no EstoqueUni

Este guia passo a passo explica como configurar webhooks no Bling para que o EstoqueUni seja notificado automaticamente sempre que uma **venda** for realizada em qualquer uma das contas Bling conectadas.

---

## 🎯 O Que Este Webhook Faz

Quando uma venda é realizada no Bling:
1. ✅ O Bling envia uma notificação (webhook) para o EstoqueUni
2. ✅ O EstoqueUni identifica quais produtos foram vendidos
3. ✅ O EstoqueUni atualiza automaticamente os depósitos compartilhados conforme as regras de sincronização configuradas

---

## 📝 Passo 1: Obter a URL do Webhook do EstoqueUni

1. Acesse o **EstoqueUni** no seu navegador
2. Vá até a seção **"Sincronização de Estoques"**
3. Na seção **"Configuração de Webhook"**, você verá a URL do webhook
4. Clique em **"Copiar"** para copiar a URL

A URL será algo como:
```
https://seu-dominio.com/api/webhooks/bling?tenantId=SEU_TENANT_ID
```

⚠️ **IMPORTANTE:** Certifique-se de que a URL está acessível publicamente (não pode ser `localhost` ou IP local). O Bling precisa conseguir fazer requisições HTTP para essa URL.

---

## 📝 Passo 2: Acessar as Configurações de Integração no Bling

1. Acesse o **Bling** no seu navegador e faça login
2. No menu superior, clique em **"Preferências"**
3. No menu lateral esquerdo, selecione:
   - **"Integrações"** → **"Configurações de integração com lojas virtuais e marketplaces"**

---

## 📝 Passo 3: Criar uma Nova Integração API (se ainda não tiver)

1. Na página de configurações de integração, clique em **"Incluir uma nova integração"** (ou "Incluir")
2. Preencha os campos:
   - **Nome do canal de venda:** `EstoqueUni` (ou outro nome de sua preferência)
   - **Tipo de integração:** Selecione **"API"**
3. Clique em **"Salvar"**

---

## 📝 Passo 4: Configurar os Callbacks (Webhooks)

1. Após salvar a integração, no menu lateral esquerdo, clique em **"Callbacks"**

2. Configure os seguintes campos:
   - **Tipo de retorno no callback:** Selecione **"JSON (urlencoded)"**
   - **Callback de pedidos de venda:** ✅ **Ative esta opção**
   - No campo correspondente ao callback de pedidos de venda, **cole a URL do webhook** que você copiou no Passo 1

   Exemplo de URL:
   ```
   https://seu-dominio.com/api/webhooks/bling?tenantId=6929d7607acf0dd07976de2a
   ```

3. ⚠️ **OPCIONAL mas recomendado:** Ative a opção **"Enviar dados em lote"** se desejar que múltiplos eventos sejam enviados juntos (mais eficiente)

4. Clique em **"Salvar"** para finalizar a configuração

---

## 📝 Passo 5: Configurar para Cada Conta Bling

⚠️ **IMPORTANTE:** Se você tem **múltiplas contas Bling** conectadas ao EstoqueUni, você precisa configurar o webhook **em cada conta Bling separadamente**.

Para cada conta:
1. Faça login na conta Bling correspondente
2. Repita os Passos 2, 3 e 4 acima
3. Use a **mesma URL do webhook** (o EstoqueUni identifica a conta automaticamente)

---

## ✅ Passo 6: Verificar se Está Funcionando

1. No EstoqueUni, na seção **"Configuração de Webhook"**, verifique:
   - ✅ **Status da Conexão:** Deve estar como **"Ativo"** (se você ativou na configuração do EstoqueUni)
   - ✅ **Última requisição registrada:** Mostra a data/hora da última notificação recebida

2. **Faça um teste:**
   - Crie um pedido de venda no Bling com produtos que têm estoque configurado
   - Aguarde alguns segundos
   - No EstoqueUni, verifique se a **"Última requisição registrada"** foi atualizada
   - Verifique se os depósitos compartilhados foram atualizados corretamente

---

## 🔍 Como o EstoqueUni Identifica a Conta Bling?

O EstoqueUni identifica automaticamente qual conta Bling enviou o webhook através do `blingAccountId` no payload. Isso significa que:

- ✅ Você pode usar a **mesma URL de webhook** para todas as contas Bling
- ✅ O EstoqueUni identifica automaticamente qual tenant processar
- ✅ Não é necessário configurar URLs diferentes por conta

---

## ⚠️ Troubleshooting

### Webhook não está sendo recebido

1. **Verifique se a URL está acessível publicamente:**
   - Teste acessando a URL no navegador (deve retornar um erro 405 ou similar, mas não 404)
   - Use ferramentas como `curl` ou Postman para testar:
     ```bash
     curl -X POST https://seu-dominio.com/api/webhooks/bling?tenantId=SEU_TENANT_ID -H "Content-Type: application/json" -d '{"test": true}'
     ```

2. **Verifique os logs do servidor EstoqueUni:**
   - Procure por mensagens `[Webhook] 📥 Webhook recebido do Bling`
   - Se não aparecer, o Bling não está conseguindo acessar a URL

3. **Verifique o firewall/proxy:**
   - Certifique-se de que a porta 443 (HTTPS) está aberta
   - Se usar proxy reverso, verifique as configurações

### Webhook recebido mas estoque não atualiza

1. **Verifique se a configuração está completa:**
   - ✅ Pelo menos uma conta Bling configurada e ativa
   - ✅ Pelo menos um depósito principal marcado
   - ✅ Pelo menos um depósito compartilhado marcado

2. **Verifique os logs do servidor:**
   - Procure por mensagens `[EVENT-PROCESSOR]` e `[SINCRONIZADOR-ESTOQUE]`
   - Verifique se há erros de validação ou processamento

3. **Verifique se o produto é composto:**
   - Produtos compostos (formato "E" no Bling) não suportam sincronização de estoque
   - Apenas produtos simples podem ser sincronizados

### Última requisição não atualiza

- A atualização da "Última requisição" depende do `tenantId` estar presente no webhook
- Se você configurou o webhook corretamente com `?tenantId=xxx`, deve funcionar
- Caso contrário, o webhook ainda será processado, mas a última requisição pode não ser atualizada

---

## 📚 Referências

- [Documentação do Bling - Webhooks](https://developer.bling.com.br/webhooks)
- [Documentação do EstoqueUni - Sincronização](./DOCUMENTACAO_SINCRONIZACAO.md)

---

## 🆘 Precisa de Ajuda?

Se você encontrar problemas durante a configuração:

1. Verifique os logs do servidor EstoqueUni
2. Verifique os logs do Bling (se disponíveis)
3. Entre em contato com o suporte técnico fornecendo:
   - Mensagens de erro específicas
   - Screenshots da configuração
   - Exemplos de payloads recebidos (se possível)





