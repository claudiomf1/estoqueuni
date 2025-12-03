#!/bin/bash

# Script para fazer deploy APENAS do frontend do EstoqueUni
# Build local da imagem e envio para produção

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
REMOTE_HOST="Linode_dallas"
APP_PATH="/home/claudio/semtypescript/apps/estoqueuni"
IMAGES_FILE="/tmp/estoqueuni-frontend-image.tar"
SERVICE_NAME="estoqueuni-frontend"

echo -e "${BLUE}🚀 Deploy do Frontend EstoqueUni (Build Local)${NC}"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.base.yml" ]; then
    echo -e "${RED}❌ Erro: Execute este script a partir do diretório apps/estoqueuni${NC}"
    exit 1
fi

echo -e "${BLUE}🔨 Passo 1: Buildando imagem do frontend localmente...${NC}"
if ! docker compose -f docker-compose.base.yml build ${SERVICE_NAME}; then
    echo -e "${RED}❌ Erro ao buildar imagem do frontend${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Imagem do frontend buildada com sucesso!${NC}"
echo ""

echo -e "${BLUE}💾 Passo 2: Salvando imagem do frontend...${NC}"
if ! docker save estoqueuni-${SERVICE_NAME}:latest -o "${IMAGES_FILE}"; then
    echo -e "${RED}❌ Erro ao salvar imagem do frontend${NC}"
    exit 1
fi

if [ ! -f "${IMAGES_FILE}" ]; then
    echo -e "${RED}❌ Erro: Falha ao salvar imagem Docker${NC}"
    exit 1
fi

FILE_SIZE=$(du -h "${IMAGES_FILE}" | cut -f1)
echo -e "${GREEN}✅ Imagem salva em: ${IMAGES_FILE} (${FILE_SIZE})${NC}"
echo ""

echo -e "${BLUE}📤 Passo 3: Enviando imagem para o servidor...${NC}"
echo -e "${YELLOW}   Isso pode demorar dependendo do tamanho da imagem...${NC}"

if ! scp "${IMAGES_FILE}" ${REMOTE_HOST}:/tmp/estoqueuni-frontend-image.tar; then
    echo -e "${RED}❌ Erro ao enviar imagem para o servidor${NC}"
    exit 1
fi

if ! ssh ${REMOTE_HOST} "test -f /tmp/estoqueuni-frontend-image.tar"; then
    echo -e "${RED}❌ Erro: Arquivo não foi encontrado no servidor após upload${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Imagem enviada e verificada no servidor!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 4: Enviando arquivos de configuração do frontend...${NC}"
ssh ${REMOTE_HOST} "mkdir -p ${APP_PATH}/frontend"

rsync -avz --progress \
  --include='frontend/Dockerfile' \
  --include='frontend/.dockerignore' \
  --include='frontend/package.json' \
  --include='frontend/package-lock.json' \
  --include='docker-compose*.yml' \
  --exclude='*' \
  ./ ${REMOTE_HOST}:${APP_PATH}/

echo -e "${GREEN}✅ Arquivos de configuração enviados!${NC}"
echo ""

echo -e "${BLUE}🔧 Passo 5: Carregando imagem e reiniciando container do frontend no servidor...${NC}"
ssh ${REMOTE_HOST} << ENDSSH
set -e

cd ${APP_PATH}

echo "📥 Verificando arquivo de imagem..."
if [ ! -f /tmp/estoqueuni-frontend-image.tar ]; then
    echo "❌ Erro: Arquivo de imagem não encontrado em /tmp/estoqueuni-frontend-image.tar"
    exit 1
fi

FILE_SIZE=\$(ls -lh /tmp/estoqueuni-frontend-image.tar | awk '{print \$5}')
echo "✅ Arquivo encontrado: \${FILE_SIZE}"

DOCKER_CMD="docker"
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
fi

cd /tmp
if ! \${DOCKER_CMD} load < estoqueuni-frontend-image.tar; then
    echo "❌ Erro ao carregar imagem. Tentando método alternativo..."
    if ! \${DOCKER_CMD} load -i /tmp/estoqueuni-frontend-image.tar; then
        echo "❌ Erro ao carregar imagem Docker"
        exit 1
    fi
fi
cd ${APP_PATH}

echo ""
echo "🔄 Reiniciando container do frontend..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d --force-recreate ${SERVICE_NAME}

echo ""
echo "🧹 Limpando arquivo temporário..."
rm -f /tmp/estoqueuni-frontend-image.tar

echo ""
echo "⏳ Aguardando container iniciar..."
sleep 5

echo ""
echo "📊 Status do container:"
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps ${SERVICE_NAME}

echo ""
echo "✅ Deploy do frontend concluído!"

ENDSSH

rm -f "${IMAGES_FILE}"

echo ""
echo -e "${GREEN}✅ Deploy do frontend concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "  1. Verificar logs: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f ${SERVICE_NAME}'"
echo "  2. Verificar status: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps ${SERVICE_NAME}'"
