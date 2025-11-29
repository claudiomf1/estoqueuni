# Logs Estruturados para Depuração da API do Bling

## Configuração

Para ativar os logs detalhados de integração com o Bling, defina a variável de ambiente:

```bash
ESTOQUEUNI_BLING_DEBUG=true
```

**Importante:** Quando `ESTOQUEUNI_BLING_DEBUG=false` ou não estiver definida, os logs estruturados são desativados automaticamente para não poluir os logs em produção.

## Como Usar

1. **Ativar modo debug:**
   ```bash
   export ESTOQUEUNI_BLING_DEBUG=true
   # ou no .env:
   ESTOQUEUNI_BLING_DEBUG=true
   ```

2. **Rodar o backend:**
   ```bash
   npm run dev
   ```

3. **Executar uma operação de sincronização de estoque** (via interface ou API)

4. **Filtrar os logs:**
   ```bash
   # Filtrar apenas logs HTTP do Bling (camada HTTP real)
   npm run dev | grep -E "BLING_HTTP|ESTOQUEUNI_STOCK"
   
   # Ou salvar em arquivo para análise
   npm run dev 2>&1 | tee logs.txt
   grep "BLING_HTTP\|ESTOQUEUNI_STOCK" logs.txt > bling-logs.jsonl
   ```

## Formato dos Logs

### Tags Disponíveis

- `BLING_HTTP_REQUEST` - Requisições HTTP reais enviadas ao Bling (camada HTTP)
- `BLING_HTTP_RESPONSE` - Respostas HTTP reais recebidas do Bling (camada HTTP)
- `ESTOQUEUNI_STOCK_FLOW` - Fluxo de negócio interno do EstoqueUni

### Exemplo de Execução Completa

#### 1. Verificação de Saldo (ANTES da atualização)

```json
{"tag":"BLING_HTTP_REQUEST","httpMethod":"GET","url":"https://www.bling.com.br/Api/v3/estoques/saldos/14888682021?idsProdutos[]=16569813558","authorizationMasked":"Bearer ABCD...WXYZ","headers":{"Content-Type":"application/json"},"body":null,"produtoId":16569813558,"depositoId":14888682021,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

```json
{"tag":"BLING_HTTP_RESPONSE","httpMethod":"GET","url":"https://www.bling.com.br/Api/v3/estoques/saldos/14888682021?idsProdutos[]=16569813558","status":200,"statusText":"OK","body":"{\"data\":[{\"produto\":{\"id\":16569813558},\"saldoFisicoTotal\":0,\"saldoVirtualTotal\":0}]}","produtoId":16569813558,"depositoId":14888682021,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

#### 2. Log de Fluxo de Negócio (ANTES da atualização)

```json
{"tag":"ESTOQUEUNI_STOCK_FLOW","timestamp":"2025-01-15T10:30:00.500Z","step":"ANTES_UPDATE","produtoId":16569813558,"sku":"KIT2K68","depositoId":14888682021,"saldoAtualDetectado":0,"quantidadeDesejada":510,"tipoOperacaoEscolhida":"E","correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

#### 3. Atualização de Estoque (POST)

```json
{"tag":"BLING_HTTP_REQUEST","httpMethod":"POST","url":"https://www.bling.com.br/Api/v3/estoques","authorizationMasked":"Bearer ABCD...WXYZ","headers":{"Content-Type":"application/json"},"body":"{\"produto\":{\"id\":16569813558},\"deposito\":{\"id\":14888682021},\"tipoOperacao\":\"E\",\"quantidade\":510}","produtoId":16569813558,"depositoId":14888682021,"tipoOperacao":"E","quantidade":510,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

```json
{"tag":"BLING_HTTP_RESPONSE","httpMethod":"POST","url":"https://www.bling.com.br/Api/v3/estoques","status":201,"statusText":"Created","body":"{\"data\":{\"id\":21957012345}}","produtoId":16569813558,"depositoId":14888682021,"tipoOperacao":"E","quantidade":510,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

#### 4. Verificação de Saldo (APÓS a atualização)

```json
{"tag":"BLING_HTTP_REQUEST","httpMethod":"GET","url":"https://www.bling.com.br/Api/v3/estoques/saldos/14888682021?idsProdutos[]=16569813558","authorizationMasked":"Bearer ABCD...WXYZ","headers":{"Content-Type":"application/json"},"body":null,"produtoId":16569813558,"depositoId":14888682021,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

```json
{"tag":"BLING_HTTP_RESPONSE","httpMethod":"GET","url":"https://www.bling.com.br/Api/v3/estoques/saldos/14888682021?idsProdutos[]=16569813558","status":200,"statusText":"OK","body":"{\"data\":[{\"produto\":{\"id\":16569813558},\"saldoFisicoTotal\":0,\"saldoVirtualTotal\":0}]}","produtoId":16569813558,"depositoId":14888682021,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

#### 5. Log de Fluxo de Negócio (APÓS a atualização)

```json
{"tag":"ESTOQUEUNI_STOCK_FLOW","timestamp":"2025-01-15T10:30:01.600Z","step":"APOS_UPDATE","produtoId":16569813558,"sku":"KIT2K68","depositoId":14888682021,"saldoLidoNaAPI":0,"saldoEsperado":510,"correlationId":"550e8400-e29b-41d4-a716-446655440000"}
```

## Rastreamento por Correlation ID

Todos os logs relacionados à mesma operação de atualização de estoque compartilham o mesmo `correlationId`. Isso permite rastrear todo o fluxo:

1. Verificação de saldo inicial (GET)
2. Decisão de tipo de operação (fluxo interno)
3. Atualização de estoque (POST)
4. Verificação de saldo final (GET)
5. Resultado da verificação (fluxo interno)

**Exemplo de filtro por correlationId:**
```bash
grep "550e8400-e29b-41d4-a716-446655440000" logs.txt
```

## Análise dos Logs

Com esses logs, você pode verificar:

1. **O que está sendo enviado ao Bling:**
   - URL exata
   - Payload completo (requestBodyRaw)
   - Headers (token mascarado)

2. **O que o Bling está retornando:**
   - Status code
   - Corpo da resposta completo (responseBodyRaw)

3. **O fluxo de negócio:**
   - Saldo detectado antes da atualização
   - Tipo de operação escolhida (B ou E)
   - Saldo lido após a atualização
   - Comparação com o esperado

4. **Problemas potenciais:**
   - Discrepância entre o enviado e o recebido
   - Saldo que não muda após atualização
   - Erros HTTP específicos

## Segurança

- **Token mascarado:** O token de autorização é sempre mascarado, mostrando apenas os primeiros 4 e últimos 4 caracteres
- **Dados sensíveis:** IDs de produtos e depósitos são logados completos (não são dados sensíveis)

