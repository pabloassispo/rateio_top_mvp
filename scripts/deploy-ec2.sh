#!/bin/bash
# Script de deploy para EC2
# Uso: ./scripts/deploy-ec2.sh

set -e

echo "🚀 Iniciando deploy do Rateio Top MVP..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está rodando como root ou com sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Por favor, execute com sudo${NC}"
    exit 1
fi

# 1. Atualizar sistema
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
if [ -f /etc/redhat-release ]; then
    dnf update -y
elif [ -f /etc/debian_version ]; then
    apt update && apt upgrade -y
fi

# 2. Instalar Node.js 20.x
echo -e "${YELLOW}[2/8] Instalando Node.js 20.x...${NC}"
if [ -f /etc/redhat-release ]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
elif [ -f /etc/debian_version ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# 3. Instalar dependências globais
echo -e "${YELLOW}[3/8] Instalando dependências globais...${NC}"
npm install -g pnpm pm2 tsx

# 4. Instalar Nginx
echo -e "${YELLOW}[4/8] Instalando Nginx...${NC}"
if [ -f /etc/redhat-release ]; then
    dnf install -y nginx
elif [ -f /etc/debian_version ]; then
    apt install -y nginx
fi

systemctl enable nginx
systemctl start nginx

# 5. Instalar Certbot
echo -e "${YELLOW}[5/8] Instalando Certbot...${NC}"
if [ -f /etc/redhat-release ]; then
    dnf install -y certbot python3-certbot-nginx
elif [ -f /etc/debian_version ]; then
    apt install -y certbot python3-certbot-nginx
fi

# 6. Criar diretórios
echo -e "${YELLOW}[6/8] Criando diretórios...${NC}"
mkdir -p /opt/rateio-top-mvp
mkdir -p /etc/nginx/certs/efi
mkdir -p /var/log/rateio-top-mvp

# 7. Baixar certificado Efí Pay
echo -e "${YELLOW}[7/8] Baixando certificado Efí Pay...${NC}"
curl -o /etc/nginx/certs/efi/webhook-homolog.crt \
  https://certificados.efipay.com.br/webhooks/certificate-chain-homolog.crt
curl -o /etc/nginx/certs/efi/webhook-prod.crt \
  https://certificados.efipay.com.br/webhooks/certificate-chain-prod.crt

# 8. Configurar Nginx (template básico)
echo -e "${YELLOW}[8/8] Configurando Nginx...${NC}"
cat > /etc/nginx/conf.d/rateio.conf << 'EOF'
upstream nodejs_backend {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL será configurado pelo Certbot
    # ssl_certificate /etc/letsencrypt/live/api.rateio.top/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.rateio.top/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/rateio-access.log;
    error_log /var/log/nginx/rateio-error.log;

    location /api/webhook/efipay {
        ssl_client_certificate /etc/nginx/certs/efi/webhook-homolog.crt;
        ssl_verify_client optional;
        ssl_verify_depth 3;

        if ($ssl_client_verify != SUCCESS) {
            return 403;
        }

        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Client-Verify $ssl_client_verify;
        proxy_set_header Connection "";
        proxy_buffering off;
    }

    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
    }
}
EOF

nginx -t && systemctl reload nginx

echo -e "${GREEN}✅ Deploy inicial concluído!${NC}"
echo ""
echo "Próximos passos:"
echo "1. Clone o repositório em /opt/rateio-top-mvp"
echo "2. Configure o arquivo .env"
echo "3. Execute: certbot --nginx -d seu-dominio.com"
echo "4. Inicie a aplicação com PM2"
echo ""
echo "Veja AWS_DEPLOY.md para mais detalhes."
