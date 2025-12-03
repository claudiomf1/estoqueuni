# 🐳 Docker - EstoqueUni

Documentação para containerização do sistema EstoqueUni usando Docker e Docker Compose.

## 📋 Estrutura

```
apps/estoqueuni/
├── backend/
│   ├── Dockerfile
│   └── .dockerignore
├── backend-ai/
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── nginx/
│   └── nginx.conf          # Configuração do proxy reverso
├── docker-compose.base.yml # Configuração base (comum)
├── docker-compose.dev.yml  # Override para desenvolvimento
└── docker-compose.prod.yml # Override para produção
```

## 🏗️ Arquitetura

### Containers

1. **estoqueuni-backend** (porta interna: 3000)
   - Backend principal da API
   - Escuta na porta 3000 internamente
   - Acessível via Nginx em `/api/*`

2. **estoqueuni-backend-ai** (porta interna: 3000)
   - Backend do chat inteligente
   - Escuta na porta 3000 internamente
   - Acessível via Nginx em `/api/v1/*`

3. **estoqueuni-frontend** (porta interna: 80)
   - Frontend buildado servido por Nginx
   - Escuta na porta 80 internamente
   - Acessível via Nginx em `/` (raiz)

4. **nginx-proxy** (porta externa: 80/443)
   - Proxy reverso principal
   - Recebe todo o tráfego HTTP/HTTPS
   - Encaminha requisições para os serviços internos

5. **redis** (porta interna: 6379)
   - Cache e filas (BullMQ)
   - Persistência via volume

### Rede

Todos os containers estão na rede interna `estoqueuni-net` e se comunicam via nomes de serviço.

### Roteamento Nginx

- `GET /api/v1/*` → `estoqueuni-backend-ai:3000`
- `GET /api/*` → `estoqueuni-backend:3000`
- `GET /` e demais rotas → `estoqueuni-frontend:80`

## 🚀 Como Usar

### Desenvolvimento

```bash
# Na raiz do projeto estoqueuni
cd /home/claudio/semtypescript/apps/estoqueuni

# Criar arquivo .env com variáveis necessárias (veja seção Variáveis de Ambiente)

# Iniciar em modo desenvolvimento
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d

# Ver logs
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml logs -f

# Parar
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml down
```

**Portas expostas em dev:**
- `80` → Nginx proxy
- `3001` → Backend principal (debug)
- `3002` → Backend AI (debug)
- `8080` → Frontend (debug)

### Produção

```bash
# Na raiz do projeto estoqueuni
cd /home/claudio/semtypescript/apps/estoqueuni

# Criar arquivo .env com variáveis de produção

# Build das imagens
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build

# Iniciar em modo produção
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f

# Parar
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down
```

**Portas expostas em prod:**
- `80` → Nginx proxy (HTTP)
- `443` → Nginx proxy (HTTPS) - descomente no docker-compose.prod.yml quando configurar SSL

## 📝 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto `apps/estoqueuni/` com as seguintes variáveis:

```env
# Ambiente
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://localhost:27017/estoqueuni
MONGODB_URI_LOCAL=mongodb://localhost:27017/estoqueuni
MONGODB_URI_REMOTE=mongodb://usuario:senha@servidor:27017/estoqueuni
ESTOQUEUNI_DB_TIPO=2  # 1=remoto, 2=local

# JWT
JWT_SECRET=seu-secret-jwt-super-seguro-aqui
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=https://estoqueuni.com.br
CORS_ORIGIN_PROD=https://estoqueuni.com.br

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Qdrant (para backend-ai)
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_NAME=estoqueuni_docs

# Gemini (para backend-ai)
GEMINI_API_KEY=sua-chave-gemini
GEMINI_MODEL=gemini-1.5-flash
ESTOQUEUNI_GEMINI_EMBEDDING_MODEL=embedding-001

# API Prefix (backend-ai)
API_PREFIX=/api/v1
```

## 🔧 Comandos Úteis

### Rebuild de um serviço específico

```bash
# Rebuild apenas do backend
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml build estoqueuni-backend

# Rebuild e reiniciar
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml up -d --build estoqueuni-backend
```

### Ver logs de um serviço específico

```bash
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml logs -f estoqueuni-backend
```

### Entrar no container

```bash
docker exec -it estoqueuni-backend sh
```

### Limpar tudo (cuidado!)

```bash
# Parar e remover containers, redes e volumes
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml down -v

# Remover imagens também
docker compose -f docker-compose.base.yml -f docker-compose.dev.yml down -v --rmi all
```

## 🔒 SSL/HTTPS

Para configurar HTTPS em produção:

1. Obtenha certificados SSL (Let's Encrypt, Cloudflare, etc.)
2. Coloque os certificados em `nginx/ssl/`:
   - `cert.pem`
   - `key.pem`
3. Descomente a seção SSL no arquivo `nginx/nginx.conf`
4. Descomente as portas 443 no `docker-compose.prod.yml`

## ⚠️ Notas Importantes

1. **Portas Internas**: Todos os backends escutam na porta 3000 internamente. O Nginx faz o roteamento correto.

2. **Variáveis de Ambiente**: O backend principal usa `ESTOQUEUNI_PORT` e o backend-ai usa `ESTOQUEUNI_AI_PORT`, mas ambos são configurados para 3000 nos containers.

3. **Build do Frontend**: O build é gerado em `../build/www` relativo ao diretório frontend. O Dockerfile copia corretamente esse diretório.

4. **Redis**: O Redis é necessário para o BullMQ (filas de eventos). Se não tiver Redis externo, o container `redis` será usado.

5. **MongoDB**: O MongoDB não está containerizado aqui. Você precisa ter um MongoDB rodando (local ou remoto) e configurar a URI corretamente.

6. **Qdrant**: O Qdrant (vector database) também não está containerizado. Se necessário, adicione um serviço Qdrant no docker-compose ou use um serviço externo.

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker compose logs nome-do-container

# Verificar se a porta está livre
lsof -i :80
```

### Build falha

```bash
# Limpar cache do Docker
docker builder prune

# Rebuild sem cache
docker compose build --no-cache
```

### Porta já em uso

```bash
# Verificar qual processo está usando a porta
lsof -i :80

# Parar containers antigos
docker compose down
```

## 📚 Próximos Passos

- [ ] Adicionar Qdrant como container (se necessário)
- [ ] Configurar SSL/HTTPS
- [ ] Adicionar monitoramento (Prometheus, Grafana)
- [ ] Configurar backup automático do Redis
- [ ] Adicionar health checks mais robustos

