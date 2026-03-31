# 🚀 Deployment Guide

Guia completo para fazer deploy do Rateio.Top MVP.

## 📋 Opções de Deploy

Você tem duas opções principais:

1. **Deploy Completo (Recomendado)**: Frontend + Backend juntos no mesmo servidor
2. **Deploy Separado**: Frontend em CDN/Static Hosting + Backend em servidor separado

---

## 🎯 Opção 1: Deploy Completo (Frontend + Backend)

### Vantagens:
- ✅ Mais simples de configurar
- ✅ Mesmo domínio para tudo
- ✅ Sem problemas de CORS
- ✅ Cookies funcionam perfeitamente

### Opções de Hospedagem:

#### A. **VPS/Cloud Server (DigitalOcean, AWS EC2, Linode, etc.)**

**Passos:**

1. **Preparar o servidor:**
   ```bash
   # Conectar ao servidor via SSH
   ssh user@your-server.com
   
   # Instalar Node.js 22+
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Instalar pnpm
   npm install -g pnpm
   
   # Instalar MySQL (ou usar serviço gerenciado)
   sudo apt-get install mysql-server
   ```

2. **Configurar domínio:**
   ```bash
   # Instalar Nginx como reverse proxy
   sudo apt-get install nginx
   
   # Configurar SSL com Let's Encrypt
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Configurar Nginx:**
   ```nginx
   # /etc/nginx/sites-available/rateio-top
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       # Proxy para aplicação Node.js
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Deploy da aplicação:**
   ```bash
   # Clonar repositório
   git clone your-repo-url
   cd rateio_top_mvp
   
   # Instalar dependências
   pnpm install
   
   # Criar arquivo .env com variáveis de ambiente
   nano .env
   ```
   
   **Variáveis de ambiente necessárias:**
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=mysql://user:password@localhost:3306/rateio_top_mvp
   JWT_SECRET=your-secret-key-here
   
   # Efí Pay (antigo Gerencianet)
   # IMPORTANTE: Use apenas os valores, SEM os prefixos Client_Id_ ou Client_Secret_
   EFI_CLIENT_ID=xxxxxxxx
   EFI_CLIENT_SECRET=xxxxxxxx
   EFI_CERTIFICATE_PATH=/path/to/certificate.p12
   EFI_SANDBOX=false
   EFI_PIX_KEY=your-pix-key-for-receiving
   ```

5. **Build e iniciar:**
   ```bash
   # Build da aplicação
   pnpm build
   
   # Executar migrações do banco
   pnpm db:push
   
   # Iniciar com PM2 (process manager)
   npm install -g pm2
   pm2 start dist/index.js --name rateio-top
   pm2 save
   pm2 startup
   ```

#### B. **Railway.app** (Mais fácil, recomendado para começar)

1. **Conectar repositório:**
   - Acesse https://railway.app
   - Conecte seu repositório GitHub
   - Railway detecta automaticamente o projeto Node.js

2. **Configurar variáveis de ambiente:**
   - No dashboard Railway, vá em "Variables"
   - Adicione todas as variáveis do `.env`

3. **Configurar banco de dados:**
   - Adicione um serviço MySQL no Railway
   - Use a URL de conexão gerada no `DATABASE_URL`

4. **Deploy automático:**
   - Railway faz deploy automaticamente a cada push
   - Configure domínio customizado no dashboard

#### C. **Render.com** (Similar ao Railway)

1. **Criar novo Web Service:**
   - Conecte repositório GitHub
   - Build Command: `pnpm install && pnpm build`
   - Start Command: `pnpm start`

2. **Adicionar banco de dados:**
   - Crie PostgreSQL ou MySQL no Render
   - Configure `DATABASE_URL`

3. **Configurar domínio:**
   - No dashboard, configure domínio customizado

---

## 🎯 Opção 2: Deploy Separado (Frontend + Backend)

### Frontend em CDN/Static Hosting

#### A. **Vercel** (Recomendado para frontend)

**⚠️ IMPORTANTE:** Como seu frontend precisa se conectar ao backend via tRPC, você precisa configurar um proxy.

1. **Criar `vercel.json`:**
   ```json
   {
     "buildCommand": "pnpm build",
     "outputDirectory": "dist/public",
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://api.yourdomain.com/api/:path*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ],
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [
           {
             "key": "Access-Control-Allow-Origin",
             "value": "*"
           }
         ]
       }
     ]
   }
   ```

2. **Deploy:**
   ```bash
   # Instalar Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configurar domínio:**
   - No dashboard Vercel, adicione seu domínio customizado

#### B. **Netlify**

1. **Criar `netlify.toml`:**
   ```toml
   [build]
     command = "pnpm build"
     publish = "dist/public"

   [[redirects]]
     from = "/api/*"
     to = "https://api.yourdomain.com/api/:splat"
     status = 200
     force = true

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy:**
   - Conecte repositório no Netlify
   - Configure build settings
   - Adicione domínio customizado

#### C. **Cloudflare Pages**

1. **Build settings:**
   - Build command: `pnpm build`
   - Build output: `dist/public`

2. **Configurar redirects:**
   - Crie `_redirects` em `client/public/`:
   ```
   /api/*  https://api.yourdomain.com/api/:splat  200
   /*      /index.html  200
   ```

### Backend Separado

Para o backend, você pode usar:
- **Railway.app** (mais fácil)
- **Render.com**
- **Fly.io**
- **DigitalOcean App Platform**
- **AWS Elastic Beanstalk**
- **VPS próprio** (como descrito na Opção 1)

---

## 🔧 Configurações Importantes

### 1. Variáveis de Ambiente

Certifique-se de configurar todas as variáveis:

```env
# Produção
NODE_ENV=production
PORT=3000

# Banco de Dados
DATABASE_URL=mysql://user:password@host:3306/database

# Autenticação
JWT_SECRET=your-very-secure-secret-key-here
VITE_APP_ID=your-app-id

# Efí Pay (antigo Gerencianet) - https://dev.efipay.com.br/docs/api-pix/credenciais/
# IMPORTANTE: Use apenas os valores, SEM os prefixos Client_Id_ ou Client_Secret_
EFI_CLIENT_ID=xxxxxxxx  # SEM o prefixo "Client_Id_"
EFI_CLIENT_SECRET=xxxxxxxx  # SEM o prefixo "Client_Secret_"
EFI_CERTIFICATE_PATH=/path/to/certificate.p12  # Caminho absoluto no servidor
EFI_CERTIFICATE_PASSPHRASE=  # (opcional) senha do .p12, se existir
EFI_SANDBOX=false  # true para homologação, false para produção
EFI_PIX_KEY=your-pix-key-for-receiving  # Chave Pix da sua conta Efí

# OAuth (se usar)
OAUTH_SERVER_URL=https://oauth-server-url
```

### 2. Build do Frontend

O build já está configurado no `package.json`:

```bash
pnpm build
```

Isso gera:
- Frontend estático em `dist/public/`
- Backend compilado em `dist/index.js`

### 3. Migrações do Banco

Execute antes do primeiro deploy:

```bash
pnpm db:push
```

### 4. SSL/HTTPS

**CRÍTICO:** Use HTTPS em produção! Cookies e autenticação requerem HTTPS.

- **Let's Encrypt** (gratuito) com Nginx
- **Cloudflare** (gratuito) como proxy
- **Railway/Render** já incluem SSL automático

### 5. Webhook Efí Pay

Configure o webhook no dashboard Efí Pay:
- URL: `https://yourdomain.com/api/webhook/efipay`
- O webhook usa mTLS (certificado) para autenticação
- Documentação: https://dev.efipay.com.br/docs/api-pix/webhooks

---

## 📝 Checklist de Deploy

- [ ] Build executado com sucesso (`pnpm build`)
- [ ] Variáveis de ambiente configuradas (incluindo Efí Pay)
- [ ] Certificado .p12 da Efí Pay disponível no servidor
- [ ] Banco de dados criado e migrações executadas
- [ ] SSL/HTTPS configurado
- [ ] Domínio apontando para servidor
- [ ] Webhook Efí Pay configurado
- [ ] Testes básicos funcionando:
  - [ ] Criar rateio
  - [ ] Participar de rateio
  - [ ] Gerar QR Code Pix
  - [ ] Receber pagamento Pix
  - [ ] Transferir para criador do rateio

---

## 🐛 Troubleshooting

### Frontend não carrega
- Verifique se `dist/public` existe após build
- Verifique se o servidor está servindo arquivos estáticos corretamente

### Erro de CORS
- Se frontend e backend em domínios diferentes, configure CORS no Express
- Ou use proxy no frontend (Vercel/Netlify)

### Cookies não funcionam
- Certifique-se de usar HTTPS
- Verifique `sameSite` e `secure` nas configurações de cookie
- Se domínios diferentes, configure `domain` corretamente

### Webhook não funciona
- Verifique URL do webhook no Efí Pay
- Verifique se o servidor está acessível publicamente
- Verifique se o certificado está configurado corretamente para mTLS
- Verifique logs do servidor para erros

---

## 💡 Recomendação

Para começar rápido, recomendo **Railway.app** ou **Render.com** para deploy completo:
- ✅ Setup rápido (minutos)
- ✅ SSL automático
- ✅ Deploy automático via Git
- ✅ Banco de dados incluído
- ✅ Domínio customizado fácil

Depois, se precisar de mais controle, migre para VPS próprio.




