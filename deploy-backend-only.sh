#!/bin/bash

# Script para fazer deploy APENAS do backend do EstoqueUni
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
IMAGES_FILE="/tmp/estoqueuni-backend-image.tar"
SERVICE_NAME="estoqueuni-backend"

echo -e "${BLUE}🚀 Deploy do Backend EstoqueUni (Build Local)${NC}"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "docker-compose.base.yml" ]; then
    echo -e "${RED}❌ Erro: Execute este script a partir do diretório apps/estoqueuni${NC}"
    exit 1
fi

echo -e "${BLUE}🔨 Passo 1: Buildando imagem do backend localmente...${NC}"
if ! docker compose -f docker-compose.base.yml build ${SERVICE_NAME}; then
    echo -e "${RED}❌ Erro ao buildar imagem do backend${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Imagem do backend buildada com sucesso!${NC}"
echo ""

echo -e "${BLUE}💾 Passo 2: Salvando imagem do backend...${NC}"
if ! docker save estoqueuni-${SERVICE_NAME}:latest -o "${IMAGES_FILE}"; then
    echo -e "${RED}❌ Erro ao salvar imagem do backend${NC}"
    exit 1
fi

# Verificar se o arquivo foi criado
if [ ! -f "${IMAGES_FILE}" ]; then
    echo -e "${RED}❌ Erro: Falha ao salvar imagem Docker${NC}"
    echo -e "${RED}   Arquivo ${IMAGES_FILE} não foi criado${NC}"
    exit 1
fi

# Verificar tamanho do arquivo
FILE_SIZE=$(du -h "${IMAGES_FILE}" | cut -f1)
echo -e "${GREEN}✅ Imagem salva em: ${IMAGES_FILE} (${FILE_SIZE})${NC}"
echo ""

echo -e "${BLUE}📤 Passo 3: Enviando imagem para o servidor...${NC}"
echo -e "${YELLOW}   Isso pode demorar dependendo do tamanho da imagem...${NC}"

if ! scp "${IMAGES_FILE}" ${REMOTE_HOST}:/tmp/estoqueuni-backend-image.tar; then
    echo -e "${RED}❌ Erro ao enviar imagem para o servidor${NC}"
    echo -e "${RED}   Verifique a conexão SSH e o espaço em disco no servidor${NC}"
    exit 1
fi

# Verificar se o arquivo foi enviado corretamente
if ! ssh ${REMOTE_HOST} "test -f /tmp/estoqueuni-backend-image.tar"; then
    echo -e "${RED}❌ Erro: Arquivo não foi encontrado no servidor após upload${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Imagem enviada e verificada no servidor!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 4: Enviando apenas arquivos de configuração do backend...${NC}"

# Criar diretórios no servidor
ssh ${REMOTE_HOST} "mkdir -p ${APP_PATH}/backend"

# Enviar APENAS arquivos de configuração necessários do backend
rsync -avz --progress \
  --include='backend/Dockerfile' \
  --include='backend/.dockerignore' \
  --include='backend/package.json' \
  --include='docker-compose*.yml' \
  --exclude='*' \
  ./ ${REMOTE_HOST}:${APP_PATH}/

echo -e "${GREEN}✅ Arquivos de configuração enviados!${NC}"
echo ""

echo -e "${BLUE}🔧 Passo 5: Carregando imagem e reiniciando container do backend no servidor...${NC}"
ssh ${REMOTE_HOST} << ENDSSH
set -e

cd ${APP_PATH}

echo "📥 Verificando arquivo de imagem..."
if [ ! -f /tmp/estoqueuni-backend-image.tar ]; then
    echo "❌ Erro: Arquivo de imagem não encontrado em /tmp/estoqueuni-backend-image.tar"
    exit 1
fi

FILE_SIZE=\$(ls -lh /tmp/estoqueuni-backend-image.tar | awk '{print \$5}')
echo "✅ Arquivo encontrado: \${FILE_SIZE}"

# Corrigir permissões do arquivo
echo "📥 Ajustando permissões do arquivo..."
sudo chmod 644 /tmp/estoqueuni-backend-image.tar 2>/dev/null || chmod 644 /tmp/estoqueuni-backend-image.tar 2>/dev/null || true

# Verificar se o arquivo realmente existe e é acessível
if [ ! -r /tmp/estoqueuni-backend-image.tar ]; then
    echo "❌ Arquivo não é legível. Ajustando permissões..."
    sudo chmod 644 /tmp/estoqueuni-backend-image.tar
fi

echo "📥 Carregando imagem Docker..."
# Usar caminho absoluto e verificar se docker está acessível
DOCKER_CMD="docker"
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
fi

# Tentar carregar usando redirecionamento (mais confiável)
cd /tmp
if ! \${DOCKER_CMD} load < estoqueuni-backend-image.tar; then
    echo "❌ Erro ao carregar imagem. Tentando método alternativo..."
    if ! \${DOCKER_CMD} load -i /tmp/estoqueuni-backend-image.tar; then
        echo "❌ Erro ao carregar imagem Docker"
        exit 1
    fi
fi
cd ${APP_PATH}

echo ""
echo "🔄 Reiniciando container do backend..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d --force-recreate ${SERVICE_NAME}

echo ""
echo "🧹 Limpando arquivo temporário..."
rm -f /tmp/estoqueuni-backend-image.tar

echo ""
echo "⏳ Aguardando container iniciar..."
sleep 5

echo ""
echo "📊 Status do container:"
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps ${SERVICE_NAME}

echo ""
echo "✅ Deploy do backend concluído!"

ENDSSH

# Limpar arquivo local
rm -f "${IMAGES_FILE}"

echo ""
echo -e "${GREEN}✅ Deploy do backend concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "  1. Verificar logs: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f ${SERVICE_NAME}'"
echo "  2. Verificar status: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps ${SERVICE_NAME}'"

