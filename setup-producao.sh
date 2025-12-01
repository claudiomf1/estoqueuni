#!/bin/bash

# Script para configurar EstoqueUni em produção
# Executar: bash setup-producao.sh

set -e

echo "🚀 Configurando EstoqueUni em Produção"
echo "========================================"
echo ""

# Executar tudo no servidor remoto
ssh Linode_dallas << 'ENDSSH'

echo "📁 Verificando estrutura de pastas..."

# Criar pastas se não existirem
mkdir -p /home/claudio/apiNegocios360/apps/estoqueuni/build/www
mkdir -p /home/claudio/apiNegocios360/apps/estoqueuni/backend

echo "✅ Pastas criadas/verificadas!"
echo ""

echo "📝 Criando configuração do Nginx para estoqueuni.com.br..."

# Criar configuração do Nginx
cat > /etc/nginx/sites-available/estoqueuni.com.br << 'EOF'
server {
    listen 80;
    server_name estoqueuni.com.br www.estoqueuni.com.br;

    # Frontend (React)
    location / {
        root /home/claudio/apiNegocios360/apps/estoqueuni/build/www;
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
EOF

echo "✅ Configuração do Nginx criada!"
echo ""

# Ativar o site
echo "🔗 Ativando site no Nginx..."
ln -sf /etc/nginx/sites-available/estoqueuni.com.br /etc/nginx/sites-enabled/

# Testar configuração
echo "🧪 Testando configuração do Nginx..."
nginx -t

# Recarregar Nginx
echo "🔄 Recarregando Nginx..."
systemctl reload nginx

echo "✅ Nginx configurado!"
echo ""

# Verificar se o backend tem .env
if [ ! -f "/home/claudio/apiNegocios360/apps/estoqueuni/backend/.env" ]; then
    echo "⚠️  Arquivo .env não encontrado no backend!"
    echo "📝 Criando .env básico (você precisará configurar as variáveis)..."
    cat > /home/claudio/apiNegocios360/apps/estoqueuni/backend/.env << 'ENVEOF'
# Configuração EstoqueUni - Produção
# ATENÇÃO: Configure as variáveis abaixo antes de iniciar o servidor

PORT=5000
NODE_ENV=production

# MongoDB - Configure com suas credenciais
MONGODB_URI_REMOTE=mongodb://usuario:senha@host:porta/meumongodb?authSource=meumongodb
ESTOQUEUNI_DB_TIPO=1

# CORS
CORS_ORIGIN=https://estoqueuni.com.br

# JWT
JWT_SECRET=altere-este-secret-em-producao
JWT_EXPIRES_IN=24h

# Bling OAuth
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
BLING_REDIRECT_URI=https://estoqueuni.com.br/bling/callback
ENVEOF
    echo "✅ Arquivo .env criado! Configure as variáveis antes de iniciar."
else
    echo "✅ Arquivo .env já existe!"
fi

echo ""
echo "🔒 Instalando certificado SSL..."

# Verificar se certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando certbot..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-nginx
fi

# Obter certificado SSL (não interativo)
echo "📜 Obtendo certificado SSL..."
certbot --nginx -d estoqueuni.com.br -d www.estoqueuni.com.br --non-interactive --agree-tos --email claudio@claudioia.com.br --redirect || echo "⚠️  Erro ao obter certificado SSL. Configure manualmente depois."

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o arquivo .env em /home/claudio/apiNegocios360/apps/estoqueuni/backend/.env"
echo "2. Execute: npm run deploy-estoqueuni (do seu computador local)"
echo "3. No servidor, inicie o PM2: pm2 start npm --name estoqueuni --cwd /home/claudio/apiNegocios360/apps/estoqueuni/backend -- start"
echo "4. Salve o PM2: pm2 save"

ENDSSH

echo ""
echo "✅ Configuração do servidor concluída!"
echo ""
echo "📋 Agora você pode:"
echo "1. Configurar o .env no servidor (via SSH)"
echo "2. Executar: npm run deploy-estoqueuni"
echo "3. Iniciar o backend no servidor via PM2"













