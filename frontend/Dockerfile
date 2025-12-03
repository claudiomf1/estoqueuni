# Dockerfile para Frontend do EstoqueUni
# Multi-stage build: primeiro builda, depois serve com Nginx
# Contexto: raiz do projeto (apps/estoqueuni/)

# Stage 1: Build
FROM node:20-alpine AS builder

# Criar diretório de trabalho na raiz do projeto
WORKDIR /workspace

# Criar diretório build (onde o Vite vai gerar os arquivos)
RUN mkdir -p build

# Copiar arquivos de dependências do frontend
COPY frontend/package.json frontend/package-lock.json* ./frontend/

# Instalar dependências
WORKDIR /workspace/frontend
# Usa npm ci se package-lock.json existir e estiver sincronizado, senão usa npm install
RUN if [ -f package-lock.json ]; then npm ci || npm install; else npm install; fi

# Instalar terser (necessário para minificação em produção com Vite)
RUN npm install --save-dev terser || true

# Copiar código fonte do frontend
COPY frontend/ ./

# Build da aplicação
# O build será gerado em ../build/www (conforme vite.config.estoqueuni.js)
# Como estamos em /workspace/frontend, o build vai para /workspace/build/www
ENV NODE_ENV=production
# Build usando Vite diretamente
RUN npx vite build --config vite.config.estoqueuni.js --mode production

# Stage 2: Runtime com Nginx
FROM nginx:alpine

# Copiar build do stage anterior
# O build está em /workspace/build/www
COPY --from=builder /workspace/build/www /usr/share/nginx/html

# Limpar scripts padrão do entrypoint (evita avisos e tentativas de sobrescrever default.conf)
RUN rm -rf /docker-entrypoint.d/*

# Copiar configuração customizada do Nginx
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80 interna
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Nginx já inicia automaticamente, mas podemos garantir
CMD ["nginx", "-g", "daemon off;"]
