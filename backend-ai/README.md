# EstoqueUni AI Backend

Backend de IA para o sistema EstoqueUni, fornecendo assistente virtual com RAG (Retrieval-Augmented Generation) baseado na documentação do sistema.

## 🚀 Funcionalidades

- **Chat com IA**: Assistente virtual usando Gemini
- **RAG (Retrieval-Augmented Generation)**: Busca semântica na documentação
- **Embeddings**: Geração de embeddings usando Gemini
- **Vector Search**: Busca vetorial usando Qdrant
- **Hybrid Retrieval**: Combinação de busca vetorial e por palavras-chave

## 📋 Pré-requisitos

- Node.js 18+
- MongoDB
- Redis (opcional)
- Qdrant (opcional, usa mock em memória se não disponível)
- Gemini API Key

## ⚙️ Configuração

1. Configure as variáveis de ambiente no arquivo `.env` na raiz do projeto:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/estoqueuni

# Redis (opcional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Qdrant (opcional)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_api_key
QDRANT_COLLECTION_NAME=estoqueuni_docs

# Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# JWT
JWT_SECRET=your_jwt_secret

# Server
ESTOQUEUNI_AI_PORT=5001
CORS_ORIGIN=http://localhost:5174

# Documentação
DOCS_PATH=/home/claudio/semtypescript/apps/estoqueuni/docs-estoqueuni
```

2. Instale as dependências:

```bash
npm install
```

3. Inicialize o banco de dados e indexe a documentação:

```bash
npm run index-docs
```

4. Inicie o servidor:

```bash
npm run dev
```

## 📚 Documentação

A documentação deve estar na pasta configurada em `DOCS_PATH` (padrão: `/home/claudio/semtypescript/docs-estoqueuni`).

A documentação deve estar em formato Markdown com frontmatter:

```markdown
---
titulo: Título do Documento
categoria: categoria
tags: [tag1, tag2]
dificuldade: basico|intermediario|avancado
ultima_atualizacao: 2025-01-29
---

# Conteúdo do documento
```

## 🔧 Scripts

- `npm run dev`: Inicia o servidor em modo desenvolvimento
- `npm start`: Inicia o servidor em modo produção
- `npm run index-docs`: Indexa a documentação no Qdrant
- `npm test`: Executa os testes

## 📡 API

### POST /api/v1/ai/chat

Envia uma mensagem para o assistente virtual.

**Body:**
```json
{
  "message": "Como configurar webhooks?",
  "conversationId": "optional_conversation_id",
  "streaming": false,
  "tenantId": "tenant_id",
  "userId": "user_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "Resposta do assistente...",
    "conversationId": "conversation_id",
    "messageId": "message_id",
    "sources": ["fonte1", "fonte2"],
    "confidence": 0.95
  }
}
```

## 🔐 Autenticação

Todas as rotas requerem autenticação via JWT. O token deve ser enviado no header `Authorization: Bearer <token>` ou via cookie `token`.

