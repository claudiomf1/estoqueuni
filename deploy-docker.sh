#!/bin/bash

# Script de Deploy do EstoqueUni com Docker
# Automatiza o processo de build e deploy para produção

set -e  # Para em caso de erro

echo "🚀 Deploy do EstoqueUni em Produção (Docker)"
echo "============================================="
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
REMOTE_USER="root"

echo -e "${BLUE}📦 Passo 1: Verificando arquivos necessários...${NC}"

# Verificar se está no diretório correto
if [ ! -f "docker-compose.base.yml" ]; then
    echo -e "${RED}❌ Erro: Execute este script na raiz do projeto estoqueuni${NC}"
    exit 1
fi

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Aviso: Arquivo .env não encontrado${NC}"
    echo -e "${YELLOW}   Certifique-se de criar o .env antes de fazer deploy${NC}"
    read -p "Continuar mesmo assim? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Verificações concluídas!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 2: Enviando código para o servidor...${NC}"

# Criar diretórios no servidor
ssh ${REMOTE_HOST} "mkdir -p ${APP_PATH}"

# Enviar código (excluindo node_modules, build, etc)
echo -e "${BLUE}  → Enviando arquivos do projeto...${NC}"
rsync -avz --progress \
  --exclude='node_modules' \
  --exclude='build' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.env' \
  ./ ${REMOTE_HOST}:${APP_PATH}/

echo -e "${GREEN}✅ Código enviado!${NC}"
echo ""

echo -e "${BLUE}📤 Passo 3: Enviando arquivo .env (se existir)...${NC}"
if [ -f ".env" ]; then
    scp .env ${REMOTE_HOST}:${APP_PATH}/.env
    echo -e "${GREEN}✅ Arquivo .env enviado!${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado localmente${NC}"
    echo -e "${YELLOW}   Certifique-se de que o .env existe no servidor${NC}"
fi
echo ""

echo -e "${BLUE}🔧 Passo 4: Build e deploy no servidor...${NC}"
ssh ${REMOTE_HOST} << ENDSSH
set -e

cd ${APP_PATH}

echo "📦 Fazendo build das imagens Docker..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml build

echo ""
echo "🛑 Parando containers antigos (se existirem)..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml down || true

echo ""
echo "🚀 Iniciando containers em produção..."
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Aguardando containers iniciarem..."
sleep 5

echo ""
echo "📊 Status dos containers:"
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps

echo ""
echo "✅ Deploy concluído!"

ENDSSH

echo ""
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo -e "  1. Verificar logs: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml logs -f'"
echo -e "  2. Verificar status: ssh ${REMOTE_HOST} 'cd ${APP_PATH} && docker compose -f docker-compose.base.yml -f docker-compose.prod.yml ps'"
echo -e "  3. Acessar o sistema: http://seu-dominio.com.br"
echo ""












