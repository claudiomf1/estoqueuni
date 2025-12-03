# Documentação: Sistema de Sincronização de Estoques - EstoqueUni

## 📋 Visão Geral

O EstoqueUni permite sincronizar estoques entre múltiplos depósitos do Bling, somando estoques de depósitos principais e atualizando depósitos compartilhados automaticamente.

## 🎯 Como Funciona

### Fluxo de Sincronização

1. **Configuração de Depósitos Principais**
   - Você seleciona quais depósitos do Bling contêm o estoque "fonte"
   - Exemplo: Depósito A1 (W2I), Depósito A2 (Techyou), Depósito A4 (Fornecedor)

2. **Configuração de Depósitos Compartilhados**
   - Você seleciona quais depósitos devem receber a soma dos estoques principais
   - Exemplo: Depósito A3 (COMPARTILHADO)

3. **Processo de Sincronização**
   - O sistema busca o estoque de cada depósito principal
   - Soma todos os valores encontrados
   - Atualiza cada depósito compartilhado com o valor total

### Exemplo Prático

**Cenário:**
- **W2I** (empresa 1) tem depósito A1 com 100 unidades
- **Techyou** (empresa 2) tem depósito A2 com 50 unidades  
- **Fornecedor** tem depósito A4 com 200 unidades
- **COMPARTILHADO** (depósito compartilhado) deve ter a soma: 350 unidades

**Configuração:**
- **Depósitos Principais:** A1, A2, A4
- **Depósitos Compartilhados:** A3 (COMPARTILHADO)

**Resultado:**
- Sistema busca: A1=100, A2=50, A4=200
- Calcula soma: 350 unidades
- Atualiza A3 (COMPARTILHADO) com 350 unidades

## ⚙️ Configuração

### 1. Adicionar Contas Bling

Antes de configurar depósitos, você precisa ter contas Bling configuradas:
- Acesse **Contas Bling** no menu
- Adicione as contas Bling que você usa
- Cada conta pode ter múltiplos depósitos

### 2. Configurar Depósitos

1. Acesse **Sincronização de Estoques**
2. Na seção **Configuração de Depósitos**:
   - Clique em **Depósitos Disponíveis no Bling** para ver a lista
   - Clique em um depósito para adicioná-lo à configuração
   - O depósito aparecerá em **Depósitos Cadastrados na Configuração**

### 3. Definir Regra de Sincronização

1. **Depósitos Principais:**
   - Marque os depósitos que contêm o estoque "fonte"
   - Estes são os depósitos que serão somados

2. **Depósitos Compartilhados:**
   - Marque os depósitos que devem receber a soma
   - Estes depósitos serão atualizados automaticamente

3. Clique em **Salvar Configuração**

## 🔄 Tipos de Sincronização

### Sincronização Manual

- **Por Produto:** Informe o SKU ou ID do produto e clique em sincronizar
- **Todos os Produtos:** (Em breve) Sincroniza todos os produtos de uma vez

### Sincronização Automática via Cronjob

- Configure um intervalo (em minutos)
- O sistema sincronizará automaticamente no intervalo configurado
- Última execução e próxima execução são exibidas no status

### Sincronização via Webhook

- Configure a URL do webhook no Bling
- O Bling enviará notificações quando houver mudanças de estoque
- O sistema processará automaticamente

## ⚠️ Limitações e Restrições

### Produtos Compostos

**IMPORTANTE:** Produtos compostos (formato "E" no Bling) **NÃO suportam** sincronização de estoque via API.

**Como identificar:**
- Produtos compostos têm formato "E" (Estoque) no Bling
- São produtos que possuem composição (ex: kits, combos)

**O que acontece:**
- Se você tentar sincronizar um produto composto, o sistema retornará um erro claro
- A mensagem explicará que apenas produtos simples podem ser sincronizados

**Solução:**
- Use apenas produtos simples (formato "S" ou outros) para sincronização
- Produtos compostos devem ser gerenciados manualmente no Bling

### Depósitos Criados via API

- Depósitos criados via API do Bling funcionam normalmente
- A sincronização funciona da mesma forma que depósitos criados manualmente
- ✅ **Confirmado:** Funciona perfeitamente após testes

## 📊 Monitoramento

### Status da Sincronização

O painel mostra:
- **Status Ativo/Inativo:** Se a sincronização está habilitada
- **Última Sincronização:** Data/hora da última sincronização bem-sucedida
- **Estatísticas:** Total de sincronizações por tipo (webhook, cronjob, manual)
- **Configuração Completa:** Se todos os requisitos estão configurados

### Histórico

- Visualize todas as sincronizações realizadas
- Filtre por origem (webhook, cronjob, manual)
- Filtre por data
- Veja detalhes de cada sincronização

### Logs

- Logs detalhados de todas as operações
- Filtre por nível (info, warning, error)
- Busque por texto específico

## 🔧 Troubleshooting

### "Configuração incompleta"

Verifique se:
- ✅ Pelo menos uma conta Bling está configurada e ativa
- ✅ Pelo menos um depósito está cadastrado
- ✅ Pelo menos um depósito principal está marcado
- ✅ Pelo menos um depósito compartilhado está marcado

### "Produto composto não suportado"

- Use apenas produtos simples
- Verifique o formato do produto no Bling
- Produtos compostos devem ser gerenciados manualmente

### "Saldo não atualizado"

Se o movimento foi criado no Bling mas o saldo não mudou:
1. Verifique se o produto é composto (não suportado)
2. Verifique se o depósito está ativo no Bling
3. Verifique os logs do servidor para mais detalhes
4. Aguarde alguns segundos - pode haver delay no processamento do Bling

### "Erro 429 - Too Many Requests"

- O sistema já implementa delays automáticos entre requisições
- Se ainda ocorrer, aguarde alguns minutos e tente novamente
- O limite do Bling é 3 requisições por segundo

## 📝 API Endpoints

### Backend

- `GET /api/sincronizacao/status?tenantId=xxx` - Status da sincronização
- `GET /api/sincronizacao/config?tenantId=xxx` - Obter configuração
- `POST /api/sincronizacao/config` - Salvar configuração
- `POST /api/sincronizacao/manual` - Sincronização manual
- `GET /api/sincronizacao/historico?tenantId=xxx` - Histórico
- `GET /api/sincronizacao/logs?tenantId=xxx` - Logs

### Exemplo de Sincronização Manual

```javascript
POST /api/sincronizacao/manual
{
  "tenantId": "xxx",
  "sku": "PRODUTO123"
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Produto PRODUTO123 sincronizado com sucesso!",
  "data": {
    "produtoId": "PRODUTO123",
    "soma": 350,
    "saldosArray": [
      { "depositoId": "A1", "valor": 100 },
      { "depositoId": "A2", "valor": 50 },
      { "depositoId": "A4", "valor": 200 }
    ],
    "compartilhadosAtualizados": {
      "A3": {
        "depositoId": "A3",
        "nomeDeposito": "COMPARTILHADO",
        "valor": 350,
        "sucesso": true
      }
    }
  }
}
```

**Resposta de Erro (Produto Composto):**
```json
{
  "success": false,
  "error": "PRODUTO_COMPOSTO",
  "codigoErro": "PRODUTO_COMPOSTO_NAO_SUPORTADO",
  "message": "Produto 'KIT2K68' é um produto composto (formato: E). Produtos compostos não suportam sincronização de estoque via API do Bling."
}
```

## 🚀 Próximos Passos

- [ ] Sincronização de todos os produtos em lote
- [ ] Relatórios de sincronização
- [ ] Notificações de falhas
- [ ] Dashboard de métricas








