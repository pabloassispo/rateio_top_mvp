# 🚀 Deploy na AWS - Guia Completo

Este guia detalha como fazer deploy do Rateio Top MVP na AWS, com foco especial em **disponibilizar o webhook da Efí Pay via URL pública**.

---

## 📋 Índice

1. [Arquitetura Recomendada](#arquitetura-recomendada)
2. [Pré-requisitos](#pré-requisitos)
3. [Opção 1: EC2 + Nginx (Recomendado)](#opção-1-ec2--nginx-recomendado)
4. [Opção 2: ECS Fargate](#opção-2-ecs-fargate)
5. [Opção 3: Elastic Beanstalk](#opção-3-elastic-beanstalk)
6. [Configuração de Domínio e SSL](#configuração-de-domínio-e-ssl)
7. [Configuração de Webhook (mTLS)](#configuração-de-webhook-mtls)
8. [Custos Estimados](#custos-estimados)
9. [Monitoramento e Logs](#monitoramento-e-logs)
10. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitetura Recomendada

### Opção 1: EC2 + Nginx (Mais Simples e Barata)

```
┌─────────────────────────────────────────┐
│         Route 53 (DNS)                  │
│         api.rateio.top                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         CloudFront (CDN)                │
│         (Opcional, para cache)          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Application Load Balancer       │
│         (HTTPS Termination)            │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         EC2 Instance (t3.small)        │
│  ┌──────────────────────────────────┐  │
│  │  Nginx (Reverse Proxy + mTLS)   │  │
│  │  Port: 443                       │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │  Node.js App (PM2)              │  │
│  │  Port: 3000                     │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         RDS MySQL (db.t3.micro)        │
└─────────────────────────────────────────┘
```

### Opção 2: ECS Fargate (Serverless, Escalável)

```
┌─────────────────────────────────────────┐
│         Route 53                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         ALB (HTTPS)                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         ECS Fargate Service             │
│  ┌──────────────────────────────────┐  │
│  │  Nginx Container (mTLS)         │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │  Node.js Container              │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         RDS MySQL                       │
└─────────────────────────────────────────┘
```

---

## ✅ Pré-requisitos

### 1. Conta AWS
- Conta AWS ativa
- Acesso ao AWS Console
- AWS CLI instalado e configurado (`aws configure`)

### 2. Domínio (Opcional mas Recomendado)
- Domínio registrado (ex: `rateio.top`)
- Acesso ao painel do registrador (para DNS)

### 3. Certificados
- **Certificado SSL do seu domínio** (via AWS Certificate Manager ou Let's Encrypt)
- **Certificado público da Efí Pay** (baixar de https://certificados.efipay.com.br/webhooks/)

### 4. Credenciais Efí Pay
- `EFI_CLIENT_ID` e `EFI_CLIENT_SECRET`
- `EFI_CERTIFICATE_PATH` (certificado .p12)
- `EFI_PIX_KEY` (chave Pix para receber pagamentos)

---

## 🖥️ Opção 1: EC2 + Nginx (Recomendado)

### **Por que esta opção?**
- ✅ Mais simples de configurar
- ✅ Mais barata para começar
- ✅ Controle total sobre o servidor
- ✅ Fácil de configurar mTLS no Nginx
- ✅ Ideal para webhooks (IP estático)

### **Custo Estimado:** ~$15-30/mês

---

### Passo 1: Criar Instância EC2

#### 1.1. Launch Instance

1. Acesse **EC2 Console** → **Launch Instance**
2. **Nome:** `rateio-top-mvp`
3. **AMI:** `Amazon Linux 2023` (ou Ubuntu 22.04 LTS)
4. **Instance Type:** `t3.small` (2 vCPU, 2 GB RAM)
   - Para produção, considere `t3.medium` (2 vCPU, 4 GB RAM)
5. **Key Pair:** Crie ou selecione uma chave SSH
6. **Network Settings:**
   - ✅ Auto-assign Public IP: **Enable**
   - **Security Group:** Crie novo com regras:
     ```
     SSH (22):     Seu IP
     HTTP (80):    Anywhere (0.0.0.0/0)
     HTTPS (443):  Anywhere (0.0.0.0/0)
     ```
7. **Storage:** 20 GB gp3 (suficiente para começar)
8. **Launch Instance**

#### 1.2. Configurar Elastic IP (Importante para Webhook)

1. **EC2 Console** → **Elastic IPs** → **Allocate Elastic IP address**
2. **Allocate**
3. **Actions** → **Associate Elastic IP address**
4. Selecione sua instância EC2
5. **Associate**

**Por que Elastic IP?**
- IP estático para webhook
- Não muda ao reiniciar a instância
- Efí Pay precisa de URL/IP estável

---

### Passo 2: Conectar e Configurar Servidor

#### 2.1. Conectar via SSH

```bash
# Linux/Mac
ssh -i sua-chave.pem ec2-user@SEU-ELASTIC-IP

# Windows (PowerShell)
ssh -i C:\caminho\para\sua-chave.pem ec2-user@SEU-ELASTIC-IP
```

#### 2.2. Atualizar Sistema

```bash
# Amazon Linux 2023
sudo dnf update -y

# Ubuntu
sudo apt update && sudo apt upgrade -y
```

#### 2.3. Instalar Node.js 20.x

```bash
# Amazon Linux 2023
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version  # Deve mostrar v20.x.x
npm --version
```

#### 2.4. Instalar PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

#### 2.5. Instalar Nginx

```bash
# Amazon Linux 2023
sudo dnf install -y nginx

# Ubuntu
sudo apt install -y nginx

# Iniciar e habilitar
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 2.6. Instalar Certbot (Let's Encrypt)

```bash
# Amazon Linux 2023
sudo dnf install -y certbot python3-certbot-nginx

# Ubuntu
sudo apt install -y certbot python3-certbot-nginx
```

---

### Passo 3: Configurar Domínio e SSL

#### 3.1. Configurar DNS no Route 53 (ou seu registrador)

**Se usar Route 53:**
1. **Route 53** → **Hosted Zones** → Seu domínio
2. **Create Record:**
   - **Name:** `api` (ou `webhook`)
   - **Type:** A
   - **Value:** Seu Elastic IP
   - **TTL:** 300

**Se usar outro registrador:**
- Adicione registro A: `api.rateio.top` → Seu Elastic IP

#### 3.2. Obter Certificado SSL

**Opção A: Let's Encrypt (Gratuito)**

```bash
# Gerar certificado
sudo certbot --nginx -d api.rateio.top

# Renovar automaticamente (já configurado pelo certbot)
sudo certbot renew --dry-run
```

**Opção B: AWS Certificate Manager (Gratuito)**

1. **ACM** → **Request Certificate**
2. **Domain name:** `api.rateio.top`
3. **Validation:** DNS
4. **Add CNAME** no Route 53 (botão "Create record")
5. Aguardar validação (~5 minutos)  

---

### Passo 4: Configurar Nginx com mTLS

#### 4.1. Baixar Certificado da Efí Pay

```bash
# Criar diretório para certificados
sudo mkdir -p /etc/nginx/certs/efi

# Baixar certificado público da Efí Pay (Homologação)
sudo curl -o /etc/nginx/certs/efi/webhook-homolog.crt \
  https://certificados.efipay.com.br/webhooks/certificate-chain-homolog.crt

# Baixar certificado público da Efí Pay (Produção)
sudo curl -o /etc/nginx/certs/efi/webhook-prod.crt \
  https://certificados.efipay.com.br/webhooks/certificate-chain-prod.crt
```

#### 4.2. Configurar Nginx

```bash
sudo nano /etc/nginx/conf.d/rateio.conf
```

**Conteúdo:**

```nginx
# Rateio Top MVP - Nginx Configuration
# Webhook endpoint com mTLS para Efí Pay

# Upstream para Node.js
upstream nodejs_backend {
    server localhost:3000;
    keepalive 64;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name api.rateio.top;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name api.rateio.top;

    # SSL Certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.rateio.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rateio.top/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Logs
    access_log /var/log/nginx/rateio-access.log;
    error_log /var/log/nginx/rateio-error.log;

    # Webhook endpoint com mTLS (Efí Pay)
    location /api/webhook/efipay {
        # Certificado público da Efí Pay (mTLS)
        ssl_client_certificate /etc/nginx/certs/efi/webhook-homolog.crt;  # Mude para webhook-prod.crt em produção
        ssl_verify_client optional;
        ssl_verify_depth 3;

        # Rejeitar se certificado não for válido
        if ($ssl_client_verify != SUCCESS) {
            return 403;
        }

        # Proxy para Node.js
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

    # Outras rotas (sem mTLS)
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
```

**Testar configuração:**

```bash
sudo nginx -t
```

**Recarregar Nginx:**

```bash
sudo systemctl reload nginx
```

---

### Passo 5: Deploy da Aplicação

#### 5.1. Clonar Repositório

```bash
# Instalar Git
sudo dnf install -y git  # Amazon Linux
# ou
sudo apt install -y git  # Ubuntu

# Clonar repositório
cd /opt
sudo git clone https://github.com/seu-usuario/rateio-top-mvp.git
sudo chown -R ec2-user:ec2-user rateio-top-mvp
cd rateio-top-mvp
```

#### 5.2. Instalar Dependências

```bash
# Instalar pnpm
npm install -g pnpm

# Instalar dependências
pnpm install
```

#### 5.3. Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
nano .env
```

**Conteúdo:**

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=mysql://user:password@rds-endpoint:3306/rateio_top_mvp

# Authentication
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
VITE_APP_ID=rateio_top

# Efí Pay
EFI_CLIENT_ID=Client_Id_f2e509df4b960bbee4c20c626814b8cf854020a7
EFI_CLIENT_SECRET=EFI_CLIENT_SECRET=Client_Secret_686ca65c5641b5d8bc997938a7dec44cd92c0aac
EFI_CERTIFICATE_PATH=/opt/rateio-top-mvp/certs/certificado.p12
EFI_CERTIFICATE_PASSPHRASE=
EFI_SANDBOX=true  # true para homologação, false para produção
EFI_PIX_KEY=7e6efb1f-69eb-4919-a9de-64f46589cf6c

# SSL/HTTPS (não necessário com Nginx)
ENABLE_HTTPS=false
```

#### 5.4. Upload do Certificado Efí Pay (.p12)

```bash
# Criar diretório
mkdir -p certs

# Upload via SCP (do seu computador local)
# scp -i sua-chave.pem certificado.p12 ec2-user@SEU-IP:/opt/rateio-top-mvp/certs/

# Ou via AWS Systems Manager Session Manager
```

#### 5.5. Build da Aplicação

```bash
# Build frontend
pnpm build

# Build não é necessário para backend (TypeScript é executado diretamente)
```

#### 5.6. Configurar PM2

```bash
# Criar arquivo de configuração PM2
nano ecosystem.config.cjs
```

**Conteúdo:**

```javascript
module.exports = {
  apps: [{ 
    name: 'rateio-top-mvp',
    script: './server/_core/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader ts-node/esm',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '500M',
  }]
};
```

**OU usar diretamente com tsx:**

```bash
# Instalar tsx globalmente
sudo npm install -g tsx

# Criar script de start
nano start.sh
```

**Conteúdo:**

```bash
#!/bin/bash
cd /opt/rateio-top-mvp
export NODE_ENV=production
export PORT=3000
tsx server/_core/index.ts
```

```bash
chmod +x start.sh
```

#### 5.7. Iniciar com PM2

```bash
# Criar diretório de logs
mkdir -p logs

# Iniciar aplicação
pm2 start ecosystem.config.cjs

# OU iniciar diretamente
pm2 start tsx --name rateio-top-mvp -- server/_core/index.ts

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
# Execute o comando que aparecer (sudo ...)
```

---

### Passo 6: Configurar Banco de Dados (RDS)

#### 6.1. Criar Instância RDS MySQL

1. **RDS Console** → **Create Database**
2. **Engine:** MySQL 8.0
3. **Template:** Free tier (ou Production)
4. **DB Instance Identifier:** `rateio-db`
5. **Master Username:** `admin`
6. **Master Password:** Senha forte
7. **DB Instance Class:** `db.t3.micro` (Free tier) ou `db.t3.small`
8. **Storage:** 20 GB gp3
9. **VPC:** Default VPC
10. **Public Access:** ✅ Yes (ou configure VPC Security Group)
11. **Security Group:** Crie novo:
        - **Inbound:** MySQL (3306) do Security Group da EC2
12. **Create Database**

#### 6.2. Obter Endpoint RDS

1. **RDS Console** → Seu banco → **Connectivity & security**
2. Copie o **Endpoint** (ex: `rateio-db.xxxxx.us-east-1.rds.amazonaws.com`)

#### 6.3. Atualizar DATABASE_URL

```bash
nano .env
```

```env
DATABASE_URL=mysql://admin:test@rateio-db.cpmgmuo6mkz7.us-east-2.rds.amazonaws.com:3306/rateio_top_mvp
```

#### 6.4. Executar Migrações

```bash
cd /opt/rateio-top-mvp
pnpm db:push
```

---

### Passo 7: Configurar Webhook na Efí Pay

#### 7.1. Via API (Recomendad o)

```bash
# No servidor EC2
curl -X PUT "https://pix.api.efipay.com.br/v2/webhook/SUA_CHAVE_PIX" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  --cert /opt/rateio-top-mvp/certs/certificado.p12 \
  -d '{
    "webhookUrl": "https://api.rateio.top/api/webhook/efipay"
  }'
```

#### 7.2. Via Painel Efí

1. Acesse **Conta Efí** → **API** → **Webhooks**
2. Clique em **Configurar Webhook Pix**
3. **URL:** `https://api.rateio.top/api/webhook/efipay`
4. Clique em **Testar**
   - Efí fará 2 requisições:
     - **1ª sem certificado:** Deve retornar 403 ✅
     - **2ª com certificado:** Deve retornar 200 ✅
5. Se ambos passarem, clique em **Salvar**

---

## 🐳 Opção 2: ECS Fargate (Serverless)

### **Por que esta opção?**
- ✅ Escalável automaticamente
- ✅ Sem gerenciar servidores
- ✅ Paga apenas pelo uso
- ⚠️ Mais complexo de configurar mTLS

### **Custo Estimado:** ~$20-50/mês (dependendo do tráfego)

### Passo 1: Criar ECR Repository

```bash
aws ecr create-repository --repository-name rateio-top-mvp --region us-east-1
```

### Passo 2: Criar Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalar dependências
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar código
COPY . .

# Build frontend
RUN pnpm build

# Expor porta
EXPOSE 3000

# Comando de start
CMD ["tsx", "server/_core/index.ts"]
```

### Passo 3: Build e Push da Imagem

```bash
# Login no ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t rateio-top-mvp .

# Tag
docker tag rateio-top-mvp:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rateio-top-mvp:latest

# Push
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rateio-top-mvp:latest
```

### Passo 4: Criar Task Definition

```json
{
  "family": "rateio-top-mvp",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "rateio-top-mvp",
    "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/rateio-top-mvp:latest",
    "portMappings": [{
      "containerPort": 3000,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3000"}
    ],
    "secrets": [
      {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
      {"name": "EFI_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:..."}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rateio-top-mvp",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

### Passo 5: Criar Service

1. **ECS Console** → **Clusters** → **Create Cluster**
2. **Cluster name:** `rateio-cluster`
3. **Infrastructure:** AWS Fargate
4. **Create**

5. **Services** → **Create**
6. **Task Definition:** `rateio-top-mvp`
7. **Service name:** `rateio-service`
8. **Desired tasks:** 1
9. **VPC:** Default
10. **Subnets:** Selecione 2+
11. **Security Group:** Crie novo (porta 3000)
12. **Load Balancer:** Application Load Balancer
13. **Create**

**Nota:** Para mTLS no ALB, você precisará usar **Network Load Balancer** com **TLS termination** ou configurar **Nginx como sidecar**.

---

## 🌱 Opção 3: Elastic Beanstalk (Mais Simples)

### **Por que esta opção?**
- ✅ Mais fácil de começar
- ✅ Gerenciamento automático
- ⚠️ Menos controle sobre configuração
- ⚠️ mTLS pode ser complicado

### **Custo Estimado:** ~$15-25/mês

### Passo 1: Criar Aplicação

1. **Elastic Beanstalk Console** → **Create Application**
2. **Application name:** `rateio-top-mvp`
3. **Platform:** Node.js
4. **Platform version:** Node.js 20
5. **Application code:** Upload do código
6. **Create**

### Passo 2: Configurar Variáveis de Ambiente

1. **Configuration** → **Software** → **Environment properties**
2. Adicione todas as variáveis do `.env`
3. **Apply**

### Passo 3: Configurar HTTPS

1. **Configuration** → **Load Balancer**
2. **Listener:** Adicione listener HTTPS (443)
3. **SSL Certificate:** Selecione certificado do ACM
4. **Apply**

**Nota:** Para mTLS, você precisará usar **Nginx via `.ebextensions`**.

---

## 🌐 Configuração de Domínio e SSL

### Opção A: Route 53 + ACM (Recomendado)

1. **Route 53** → **Hosted Zones** → Criar zona para seu domínio
2. **ACM** → **Request Certificate** → `api.rateio.top`
3. Validar via DNS
4. Associar ao ALB ou usar no Nginx

### Opção B: Let's Encrypt (Gratuito)

Já detalhado na seção EC2 acima.

---

## 🔐 Configuração de Webhook (mTLS)

### Testar mTLS

```bash
# Testar se webhook está rejeitando requisições sem certificado
curl -X POST https://api.rateio.top/api/webhook/efipay \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Deve retornar 403 Forbidden ✅

# Testar com certificado (requer certificado .p12)
curl -X POST https://api.rateio.top/api/webhook/efipay \
  --cert certificado.p12:senha \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Deve retornar 200 OK ✅
```

### Verificar Logs Nginx

```bash
# Ver logs de acesso
sudo tail -f /var/log/nginx/rateio-access.log

# Ver logs de erro
sudo tail -f /var/log/nginx/rateio-error.log

# Verificar se mTLS está funcionando
sudo grep "ssl_client_verify" /var/log/nginx/rateio-access.log
```

---

## 💰 Custos Estimados

### Opção 1: EC2 + Nginx (Recomendado)

| Serviço | Especificação | Custo Mensal |
|---------|---------------|--------------|
| **EC2 t3.small** | 2 vCPU, 2 GB RAM | ~$15 |
| **Elastic IP** | IP estático | Grátis (se associado) |
| **RDS MySQL db.t3.micro** | 20 GB | ~$15 (Free tier: $0) |
| **EBS Storage** | 20 GB gp3 | ~$2 |
| **Data Transfer** | Primeiros 100 GB | Grátis |
| **Route 53** | Hosted Zone | ~$0.50 |
| **ACM** | Certificado SSL | Grátis |
| **TOTAL** | | **~$32-35/mês** |

**Com Free Tier (primeiro ano):**
- EC2 t2.micro: Grátis
- RDS db.t2.micro: Grátis
- **TOTAL:** ~$2-5/mês

### Opção 2: ECS Fargate

| Serviço | Especificação | Custo Mensal |
|---------|---------------|--------------|
| **ECS Fargate** | 0.5 vCPU, 1 GB RAM | ~$15-30 |
| **ALB** | Application Load Balancer | ~$16 |
| **RDS MySQL** | db.t3.small | ~$30 |
| **ECR** | Armazenamento de imagem | ~$0.10 |
| **CloudWatch Logs** | Logs da aplicação | ~$1-5 |
| **TOTAL** | | **~$62-82/mês** |

### Opção 3: Elastic Beanstalk

| Serviço | Especificação | Custo Mensal |
|---------|---------------|--------------|
| **EC2 (gerenciado)** | t3.small | ~$15 |
| **RDS MySQL** | db.t3.micro | ~$15 |
| **TOTAL** | | **~$30/mês** |

### Otimizações de Custo

1. **Reserved Instances:** Economia de até 72% (1-3 anos)
2. **Spot Instances:** Até 90% de desconto (não recomendado para produção)
3. **Free Tier:** Use durante primeiro ano
4. **RDS:** Use db.t3.micro no Free Tier
5. **S3:** Armazenar backups (muito barato)

---

## 📊 Monitoramento e Logs

### CloudWatch Logs

```bash
# Instalar CloudWatch Agent
sudo yum install amazon-cloudwatch-agent -y

# Configurar
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c ssm:AmazonCloudWatch-linux
```

### PM2 Monitoring

```bash
# Instalar PM2 Plus (opcional)
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY

# Ver logs
pm2 logs rateio-top-mvp

# Ver status
pm2 status

# Monitorar recursos
pm2 monit
```

### Alertas CloudWatch

1. **CloudWatch** → **Alarms** → **Create Alarm**
2. **Metric:** CPU Utilization > 80%
3. **Action:** Enviar email via SNS
4. **Create**

---

## 🐛 Troubleshooting

### Webhook retorna 403

**Causa:** mTLS não configurado corretamente.

**Solução:**
```bash
# Verificar certificado Efí Pay
sudo ls -la /etc/nginx/certs/efi/

# Verificar configuração Nginx
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/rateio-error.log
```

### Aplicação não inicia

**Causa:** Variáveis de ambiente faltando ou banco não acessível.

**Solução:**
```bash
# Verificar .env
cat .env

# Testar conexão com banco
mysql -h RDS_ENDPOINT -u admin -p

# Ver logs PM2
pm2 logs rateio-top-mvp --lines 50
```

### Certificado SSL expira

**Solução:**
```bash
# Renovar Let's Encrypt
sudo certbot renew

# Recarregar Nginx
sudo systemctl reload nginx
```

### Alto uso de CPU/Memória

**Solução:**
```bash
# Ver processos
top

# Ver uso PM2
pm2 monit

# Reiniciar aplicação
pm2 restart rateio-top-mvp

# Considerar upgrade de instância
```

---

## 🔒 Segurança

### Security Groups

**EC2 Security Group:**
```
Inbound:
- SSH (22): Seu IP específico
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0

Outbound:
- All traffic: 0.0.0.0/0
```

**RDS Security Group:**
```
Inbound:
- MySQL (3306): EC2 Security Group ID

Outbound:
- None
```

### Secrets Management

**Use AWS Secrets Manager:**

```bash
# Criar secret
aws secretsmanager create-secret \
  --name rateio-top-mvp/env \
  --secret-string file://env.json

# No código, usar:
# AWS SDK para buscar secrets
```

### Backup RDS

1. **RDS Console** → Seu banco → **Automated backups**
2. **Backup retention:** 7 dias
3. **Backup window:** Escolha horário de baixo tráfego

---

## 📚 Referências

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [Nginx mTLS Guide](https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_client_certificate)
- [Efí Pay Webhooks](https://dev.efipay.com.br/docs/api-pix/webhooks/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

---

## ✅ Checklist de Deploy

- [ ] Instância EC2 criada e configurada
- [ ] Elastic IP associado
- [ ] Node.js 20.x instalado
- [ ] Nginx instalado e configurado
- [ ] Certificado SSL configurado (Let's Encrypt ou ACM)
- [ ] Certificado Efí Pay baixado e configurado
- [ ] mTLS funcionando (teste retorna 403 sem cert, 200 com cert)
- [ ] RDS MySQL criado e acessível
- [ ] Variáveis de ambiente configuradas
- [ ] Aplicação rodando com PM2
- [ ] PM2 configurado para iniciar no boot
- [ ] Domínio configurado (DNS)
- [ ] Webhook configurado na Efí Pay
- [ ] Teste de webhook funcionando
- [ ] Logs configurados (CloudWatch ou local)
- [ ] Backup RDS configurado
- [ ] Security Groups configurados corretamente
- [ ] Monitoramento configurado (opcional)

---

**Pronto para deploy!** 🚀

Se tiver dúvidas específicas, consulte a documentação oficial ou abra uma issue no repositório.
