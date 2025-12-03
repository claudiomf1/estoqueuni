# Dockerfile para Backend AI (Chat Inteligente) do EstoqueUni
# Multi-stage build para reduzir tamanho da imagem final

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./

# Instalar dependências
# Usa npm ci se package-lock.json existir, senão usa npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copiar código fonte
COPY . .

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Copiar apenas arquivos necessários do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config

# Criar diretório de logs
RUN mkdir -p logs

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000
ENV ESTOQUEUNI_AI_PORT=3000
ENV ESTOQUEUNI_AI_HOST=0.0.0.0

# Expor porta interna
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Comando de inicialização
CMD ["npm", "start"]

