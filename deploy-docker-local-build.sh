#!/bin/bash

# Script de Deploy do EstoqueUni com Docker
# Versão: Build local + envio de imagens para servidor
# Mais rápido e permite testar antes de enviar

set -e  # Para em caso de erro

echo "🚀 Deploy do EstoqueUni em Produção (Build Local)"
echo "=================================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações
REMOTE_HOST="Linode_dallas"
APP_PATH="/home/claudio/semtypescript/apps/estoqueuni"
IMAGES_FILE="/tmp/estoqueuni-images-$(date +%Y%m%d-%H%M%S).tar"

echo -e "${BLUE}📦 Passo 1: Verificando arquivos necessários...${NC}"

# Verificar se está no diretório correto
if [ ! -f "docker-compose.base.yml" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto estoqueuni${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Verificações concluídas!${NC}"
echo ""

echo -e "${BLUE}🔨 Passo 2: Build das imagens Docker (local)...${NC}"
echo -e "${YELLOW}   Isso pode demorar alguns minutos na primeira vez...${NC}"

# Build das imagens localmente
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build

echo -e "${GREEN}✅ Build concluído!${NC}"
echo ""

echo -e "${BLUE}💾 Passo 3: Salvando imagens em arquivo...${NC}"

# Obter nomes das imagens
BACKEND_IMAGE=$(docker compose -f docker-compose.base.yml -f docker-compose.prod.yml config | grep -A 5 "estoqueuni-backend:" | grep "image:" | awk '{print $2}' || echo "estoqueuni-estoqueuni-backend")
BACKEND_AI_IMAGE=$(docker compose -f docker-compose.base.yml -f docker-compose.prod.yml config | grep -A 5 "estoqueuni-backend-ai:" | grep "image:" | awk '{print $2}' || echo "estoqueuni-estoqueuni-backend-ai")
FRONTEND_IMAGE=$(docker compose -f docker-compose.base.yml -f docker-compose.prod.yml config | grep -A 5 "estoqueuni-frontend:" | grep "image:" | awk '{print $2}' || echo "estoqueuni-estoqueuni-frontend")

# Se não encontrou pelos nomes, usar padrão do docker compose
if [ -z "$BACKEND_IMAGE" ] || [ "$BACKEND_IMAGE" = "null" ]; then
    BACKEND_IMAGE="estoqueuni-estoqueuni-backend"
    BACKEND_AI_IMAGE="estoqueuni-estoqueuni-backend-ai"
    FRONTEND_IMAGE="estoqueuni-estoqueuni-frontend"
fi

echo -e "${BLUE}  → Imagens encontradas:${NC}"
echo -e "     - ${BACKEND_IMAGE}"
echo -e "     - ${BACKEND_AI_IMAGE}"
echo -e "     - ${FRONTEND_IMAGE}"

# Salvar imagens
echo -e "${BLUE}  → Salvando imagens em arquivo...${NC}"
if ! docker save -o "${IMAGES_FILE}" \
  "${BACKEND_IMAGE}" \
  "${BACKEND_AI_IMAGE}" \
  "${FRONTEND_IMAGE}" 2>&1; then
    echo -e "${YELLOW}⚠️  Tentando com nomes alternativos...${NC}"
    # Tentar com nomes diretos
    if ! docker save -o "${IMAGES_FILE}" \
      estoqueuni-estoqueuni-backend \
      estoqueuni-estoqueuni-backend-ai \
      estoqueuni-estoqueuni-frontend 2>&1; then
        echo -e "${RED}❌ Erro: Não foi possível salvar as imagens Docker${NC}"
        echo -e "${RED}   Verifique se as imagens foram buildadas corretamente${NC}"
        exit 1
    fi
fi

# Verificar se o arquivo foi criado
if [ ! -f "${IMAGES_FILE}" ]; then
    echo -e "${RED}❌ Erro: Falha ao salvar imagens Docker${NC}"
    echo -e "${RED}   Arquivo ${IMAGES_FILE} não foi criado${NC}"
    exit 1
fi

# Verificar tamanho do arquivo
FILE_SIZE=$(du -h "${IMAGES_FILE}" | cut -f1)
echo -e "${GREEN}✅ Imagens salvas em: ${IMAGES_FILE} (${FILE_SIZE})${NC}"
echo ""

echo -e "${BLUE}📤 Passo 4: Enviando imagens para o servidor...${NC}"
echo -e "${YELLOW}   Isso pode demorar dependendo do tamanho das imagens...${NC}"

if ! scp "${IMAGES_FILE}" ${REMOTE_HOST}:/tmp/estoqueuni-images.tar; then
    echo -e "${RED}❌ Erro ao enviar imagens para o servidor${NC}"
    echo -e "${RED}   Verifique a conexão SSH e o espaço em disco no servidor${NC}"
    exit 1
fi

# Verificar se o arquivo foi enviado corretamente
if ! ssh ${REMOTE_HOST} "test -f /tmp/estoqueuni-images.tar"; then
    echo -e "${RED}❌ Erro: Arquivo não foi encontrado no servidor após upload${NC}"
    exit 1
fi

# Ajustar permissões do arquivo no servidor (garantir que seja legível)
ssh ${REMOTE_HOST} "chmod 644 /tmp/estoqueuni-images.tar 2>/dev/null || sudo chmod 644 /tmp/estoqueuni-images.tar 2>/dev/null || true"

echo -e "${GREEN}✅ Imagens enviadas e verificadas no servidor!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 5: Enviando apenas arquivos de configuração...${NC}"

# Criar diretórios no servidor
ssh ${REMOTE_HOST} "mkdir -p ${APP_PATH}"

# Enviar APENAS arquivos de configuração necessários (não código fonte)
# Estrutura: incluir apenas o que precisa, excluir todo o resto
rsync -avz --progress \
  --include='/' \
  --include='docker-compose*.yml' \
  --include='Dockerfile' \
  --include='.dockerignore' \
  --include='nginx/' \
  --include='nginx/***' \
  --include='deploy*.sh' \
  --include='*.md' \
  --include='backend/' \
  --include='backend/Dockerfile' \
  --include='backend/.dockerignore' \
  --include='backend/package.json' \
  --include='frontend/' \
  --include='frontend/Dockerfile' \
  --include='frontend/.dockerignore' \
  --include='frontend/package.json' \
  --include='frontend/nginx.conf' \
  --include='backend-ai/' \
  --include='backend-ai/Dockerfile' \
  --include='backend-ai/.dockerignore' \
  --include='backend-ai/package.json' \
  --include='backend-ai/config/' \
  --include='backend-ai/config/***' \
  --exclude='*' \
  ./ ${REMOTE_HOST}:${APP_PATH}/

echo -e "${GREEN}✅ Arquivos de configuração enviados!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 6: Enviando arquivo .env (se existir)...${NC}"
if [ -f ".env" ]; then
    scp .env ${REMOTE_HOST}:${APP_PATH}/.env
    echo -e "${GREEN}✅ Arquivo .env enviado!${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado localmente${NC}"
    echo -e "${YELLOW}   Certifique-se de que o .env existe no servidor${NC}"
fi
echo ""

echo -e "${BLUE}🔧 Passo 7: Carregando imagens e iniciando containers no servidor...${NC}"

# Verificar novamente se o arquivo existe antes de executar o SSH (pode ter sido deletado)
if ! ssh ${REMOTE_HOST} "test -f /tmp/estoqueuni-images.tar"; then
    echo -e "${YELLOW}⚠️  Arquivo não encontrado, reenviando...${NC}"
    if ! scp "${IMAGES_FILE}" ${REMOTE_HOST}:/tmp/estoqueuni-images.tar; then
        echo -e "${RED}❌ Erro ao reenviar arquivo${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Arquivo reenviado com sucesso!${NC}"
fi

ssh ${REMOTE_HOST} << ENDSSH
set -e

cd ${APP_PATH} || exit 1

echo "🛑 Parando sistema antigo (PM2)..."
pm2 stop estoqueuni 2>/dev/null || pm2 stop estoqueuni-dev 2>/dev/null || echo "   Nenhum processo PM2 encontrado (ok)"
pm2 delete estoqueuni 2>/dev/null || pm2 delete estoqueuni-dev 2>/dev/null || echo "   Nenhum processo PM2 para deletar (ok)"

echo ""
echo "🛑 Parando Nginx do sistema (se estiver rodando na porta 80)..."
systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || echo "   Nginx do sistema não está rodando (ok)"

echo ""
echo "📥 Verificando arquivo de imagens..."
if [ ! -f /tmp/estoqueuni-images.tar ]; then
    echo "❌ Erro: Arquivo de imagens não encontrado em /tmp/estoqueuni-images.tar"
    echo "   Verificando arquivos em /tmp/..."
    ls -lh /tmp/estoqueuni-images*.tar 2>/dev/null || echo "   Nenhum arquivo encontrado"
    echo "   Verifique se o upload foi concluído com sucesso"
    exit 1
fi

FILE_SIZE=\$(ls -lh /tmp/estoqueuni-images.tar | awk '{print \$5}')
echo "✅ Arquivo encontrado: \${FILE_SIZE}"

# Corrigir permissões do arquivo (pode ter sido criado como root)
echo "📥 Ajustando permissões do arquivo..."
sudo chmod 644 /tmp/estoqueuni-images.tar 2>/dev/null || chmod 644 /tmp/estoqueuni-images.tar 2>/dev/null || true

# Verificar se o arquivo realmente existe e é acessível
if [ ! -r /tmp/estoqueuni-images.tar ]; then
    echo "❌ Arquivo não é legível. Ajustando permissões..."
    sudo chmod 644 /tmp/estoqueuni-images.tar
fi

echo "📥 Carregando imagens Docker..."
# Usar caminho absoluto e verificar se docker está acessível
DOCKER_CMD="docker"
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
fi

# Tentar carregar usando redirecionamento (mais confiável)
cd /tmp
if ! \${DOCKER_CMD} load < estoqueuni-images.tar; then
    echo "❌ Erro ao carregar imagens. Tentando método alternativo..."
    if ! \${DOCKER_CMD} load -i /tmp/estoqueuni-images.tar; then
        echo "❌ Erro ao carregar imagens Docker"
        echo "   Docker command: \${DOCKER_CMD}"
        echo "   PWD: \$(pwd)"
        echo "   Arquivo existe: \$(test -f /tmp/estoqueuni-images.tar && echo 'sim' || echo 'não')"
        echo "   Arquivo legível: \$(test -r /tmp/estoqueuni-images.tar && echo 'sim' || echo 'não')"
        echo "   Permissões: \$(ls -la /tmp/estoqueuni-images.tar)"
        exit 1
    fi
fi
cd ${APP_PATH}

echo ""
echo "🛑 Parando containers Docker antigos (se existirem)..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down || true

echo ""
echo "🚀 Iniciando containers em produção..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d

echo ""
echo "🧹 Limpando arquivo temporário..."
rm -f /tmp/estoqueuni-images.tar

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 5

echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps

echo ""
echo "✅ Deploy concluído!"

ENDSSH

# Limpar arquivo local
rm -f "${IMAGES_FILE}"

echo ""
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo -e "  1. Verificar logs: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f'"
echo -e "  2. Verificar status: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps'"
echo -e "  3. Acessar o sistema: http://seu-dominio.com.br"
echo ""

