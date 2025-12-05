#!/bin/bash

# Script para renovar certificados SSL do EstoqueUni
# Este script renova certificados auto-assinados ou migra para Let's Encrypt

set -e

CERT_DIR="/etc/letsencrypt/live/estoqueuni.com.br"
DOMAIN="estoqueuni.com.br"
EMAIL="claudio@claudioia.com.br"
DAYS_BEFORE_EXPIRY=30

# Função para verificar se o certificado está próximo do vencimento
check_cert_expiry() {
    if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
        return 1
    fi
    
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_DIR/fullchain.pem" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
    
    if [ $DAYS_UNTIL_EXPIRY -lt $DAYS_BEFORE_EXPIRY ]; then
        return 0  # Precisa renovar
    else
        return 1  # Não precisa renovar
    fi
}

# Função para renovar certificado auto-assinado
renew_self_signed() {
    echo "🔄 Renovando certificado auto-assinado para $DOMAIN..."
    
    # Backup do certificado antigo
    if [ -f "$CERT_DIR/fullchain.pem" ]; then
        BACKUP_DIR="/etc/letsencrypt/live/estoqueuni.com.br.backup.$(date +%Y%m%d_%H%M%S)"
        sudo mkdir -p "$BACKUP_DIR"
        sudo cp "$CERT_DIR"/*.pem "$BACKUP_DIR/" 2>/dev/null || true
        echo "✅ Backup criado em $BACKUP_DIR"
    fi
    
    # Gerar novo certificado (válido por 1 ano = 365 dias)
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN" 2>&1 | grep -v "^Generating"
    
    sudo chmod 644 "$CERT_DIR"/*.pem
    sudo chmod 755 "$CERT_DIR"
    
    echo "✅ Certificado auto-assinado renovado (válido por 365 dias)"
}

# Função para tentar migrar para Let's Encrypt
migrate_to_letsencrypt() {
    echo "🔒 Tentando migrar para certificados Let's Encrypt..."
    
    # Verificar se o plugin DNS do Cloudflare está disponível
    if command -v certbot &> /dev/null; then
        # Tentar usar webroot (funciona se Cloudflare estiver configurado corretamente)
        if sudo certbot certonly --webroot -w /var/www/certbot \
            -d "$DOMAIN" -d "www.$DOMAIN" \
            --non-interactive --agree-tos --email "$EMAIL" \
            --force-renewal 2>&1 | grep -q "Congratulations"; then
            echo "✅ Migrado para Let's Encrypt com sucesso!"
            return 0
        fi
    fi
    
    echo "⚠️  Não foi possível migrar para Let's Encrypt. Usando certificado auto-assinado."
    return 1
}

# Função para recarregar nginx
reload_nginx() {
    echo "🔄 Recarregando nginx..."
    cd /home/claudio/semtypescript/apps/estoqueuni
    docker exec estoqueuni-nginx nginx -s reload 2>&1 | grep -v "^$" || true
    echo "✅ Nginx recarregado"
}

# Main
echo "🔐 Verificando certificados SSL para $DOMAIN..."
echo ""

# Verificar se precisa renovar
if check_cert_expiry; then
    echo "⚠️  Certificado próximo do vencimento. Renovando..."
    echo ""
    
    # Tentar migrar para Let's Encrypt primeiro
    if ! migrate_to_letsencrypt; then
        # Se falhar, renovar auto-assinado
        renew_self_signed
    fi
    
    # Recarregar nginx
    reload_nginx
    
    echo ""
    echo "✅ Renovação concluída!"
else
    DAYS_LEFT=$(openssl x509 -enddate -noout -in "$CERT_DIR/fullchain.pem" | cut -d= -f2 | xargs -I {} date -d {} +%s | awk -v now=$(date +%s) '{print int(($1-now)/86400)}')
    echo "✅ Certificado válido por mais $DAYS_LEFT dias. Não é necessário renovar."
fi

echo ""

