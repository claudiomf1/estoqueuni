# 📚 O que é BullMQ e Redis?

## 🎯 Resumo Rápido

**Redis** = Banco de dados em memória (super rápido)  
**BullMQ** = Sistema de filas para processar tarefas em background

Juntos, eles permitem que o EstoqueUni processe webhooks do Bling de forma **assíncrona e confiável**.

---

## 🔴 Redis - O que é?

### Definição
**Redis** (Remote Dictionary Server) é um banco de dados em memória, extremamente rápido, usado para:
- Cache
- Filas de mensagens
- Sessões
- Dados temporários

### Analogia Simples
Imagine uma **mesa de trabalho**:
- **MongoDB** = Arquivo permanente (gaveta) - guarda dados para sempre
- **Redis** = Mesa de trabalho - dados temporários, acesso super rápido

### Características
- ⚡ **Muito rápido**: Tudo fica na memória RAM
- 🔄 **Temporário**: Dados podem expirar
- 📦 **Estruturas de dados**: Listas, filas, sets, etc.

### No EstoqueUni
O Redis armazena:
- **Filas de eventos** (webhooks do Bling aguardando processamento)
- **Status de processamento**
- **Cache temporário**

---

## 🟢 BullMQ - O que é?

### Definição
**BullMQ** é uma biblioteca Node.js para criar e gerenciar **filas de tarefas** usando Redis.

### Analogia Simples
Imagine uma **fila de banco**:
1. Você chega e pega uma senha (evento entra na fila)
2. Aguarda sua vez (evento aguarda processamento)
3. Atendente chama você (worker processa o evento)
4. Você é atendido (evento processado com sucesso)

### Características
- ✅ **Processamento assíncrono**: Não trava o servidor
- 🔄 **Retry automático**: Se falhar, tenta novamente
- 📊 **Monitoramento**: Você pode ver quantos eventos estão na fila
- 🎯 **Prioridades**: Processar eventos importantes primeiro
- ⏰ **Agendamento**: Processar eventos em horários específicos

### No EstoqueUni
O BullMQ processa:
- **Webhooks do Bling** (quando produto é vendido/deletado)
- **Sincronização de estoque**
- **Eventos de atualização**

---

## 🔄 Como Funciona Juntos?

### Fluxo Completo

```
1. Bling envia webhook
   ↓
2. Backend recebe webhook (responde rápido: 200 OK)
   ↓
3. Evento é adicionado na FILA (Redis via BullMQ)
   ↓
4. Worker (processo em background) pega evento da fila
   ↓
5. Worker processa evento (atualiza estoque no MongoDB)
   ↓
6. Evento é marcado como processado
```

### Por que isso é importante?

**Sem BullMQ (modo fallback):**
- ❌ Webhook pode demorar muito (Bling desiste se > 2 segundos)
- ❌ Se der erro, evento é perdido
- ❌ Não há retry automático
- ❌ Servidor pode travar se muitos webhooks chegarem

**Com BullMQ:**
- ✅ Webhook responde rápido (< 200ms)
- ✅ Eventos são processados em background
- ✅ Se der erro, tenta novamente automaticamente
- ✅ Servidor não trava (processamento assíncrono)
- ✅ Você pode ver quantos eventos estão na fila

---

## 📊 Exemplo Prático

### Cenário: Produto deletado no Bling

**Sem BullMQ:**
```
1. Bling: "Produto X foi deletado" (webhook)
2. Backend: "Ok, vou processar agora..." (2 segundos)
3. Backend: Processa atualização
4. Bling: "Demorou muito, vou cancelar" ❌
```

**Com BullMQ:**
```
1. Bling: "Produto X foi deletado" (webhook)
2. Backend: "Ok, recebi! Já está na fila" (200ms) ✅
3. Backend: Responde 200 OK para Bling
4. Worker (background): Processa evento quando tiver tempo
5. Worker: Atualiza estoque no MongoDB
6. Worker: Marca como processado ✅
```

---

## 🛠️ Configuração no EstoqueUni

### Arquivos Envolvidos

1. **`docker-compose.base.yml`**
   - Configura o container Redis
   - Define variáveis de ambiente

2. **`backend/src/services/queueService.js`**
   - Gerencia conexão com Redis
   - Adiciona eventos na fila

3. **`backend/src/jobs/processarEvento.js`**
   - Worker que processa eventos da fila
   - Retry automático em caso de erro

4. **`backend/src/services/eventProcessorService.js`**
   - Lógica de processamento de eventos
   - Atualiza estoque no MongoDB

### Variáveis de Ambiente

```env
REDIS_HOST=redis          # Nome do container Redis
REDIS_PORT=6379           # Porta padrão do Redis
REDIS_PASSWORD=           # Senha (opcional)
REDIS_DB=0                # Banco de dados (0-15)
```

---

## 🎯 Benefícios para o EstoqueUni

1. **Confiabilidade**
   - Eventos não são perdidos
   - Retry automático em caso de erro

2. **Performance**
   - Webhooks respondem rápido
   - Processamento não trava o servidor

3. **Escalabilidade**
   - Pode processar muitos eventos simultaneamente
   - Pode adicionar mais workers se necessário

4. **Monitoramento**
   - Você pode ver quantos eventos estão na fila
   - Logs detalhados de processamento

---

## 📝 Resumo Final

- **Redis** = Banco de dados rápido em memória (armazena filas)
- **BullMQ** = Sistema de filas (gerencia processamento assíncrono)
- **Juntos** = Webhooks são processados de forma confiável e rápida

**Antes (sem BullMQ):**
- Webhook → Processa imediatamente → Pode demorar → Bling cancela ❌

**Agora (com BullMQ):**
- Webhook → Adiciona na fila → Responde rápido → Processa em background ✅

---

## 🔍 Como Verificar se Está Funcionando

### Logs do Backend
```bash
npm run logs-prod-estoqueuni
```

Procure por:
- `✅ Conectado ao Redis`
- `✅ BullMQ disponível`
- `✅ Worker de eventos iniciado`
- `🚀 Processando evento`

### Se não estiver funcionando
- Verifique se o container Redis está rodando
- Verifique se as variáveis de ambiente estão corretas
- Verifique os logs do backend

---

**Última atualização:** 02/12/2025

