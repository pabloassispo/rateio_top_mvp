# Configuração de Webhooks Efí Pay (API Pix)

## 📋 Visão Geral

A Efí Pay usa **mTLS (mutual TLS)** para autenticação de webhooks. Isso significa que:
- A Efí apresenta um certificado ao fazer requests para seu servidor
- Seu servidor precisa validar esse certificado
- A comunicação é bidirecional e segura

Referência: [Documentação Oficial de Webhooks](https://dev.efipay.com.br/docs/api-pix/webhooks/)

---

## 🔐 Requisitos

### 1. Certificado Público da Efí Pay

Baixe o certificado apropriado para seu ambiente:

| Ambiente | URL do Certificado |
|----------|-------------------|
| **Homologação** | https://certificados.efipay.com.br/webhooks/certificate-chain-homolog.crt |
| **Produção** | https://certificados.efipay.com.br/webhooks/certificate-chain-prod.crt |

```bash
# Homologação
curl -o efi-webhook-homolog.crt https://certificados.efipay.com.br/webhooks/certificate-chain-homolog.crt

# Produção
curl -o efi-webhook-prod.crt https://certificados.efipay.com.br/webhooks/certificate-chain-prod.crt
```

Salve o certificado no servidor, por exemplo em `./certs/efi-webhook.crt`.

### 2. Certificado SSL do Seu Domínio

Você precisa de um certificado SSL válido para seu domínio (HTTPS). Opções:
- **Let's Encrypt** (gratuito) via Certbot
- Certificado comprado de CA
- Cloudflare SSL (mas pode complicar mTLS)

### 3. Domínio Público com HTTPS

O webhook precisa ser acessível via HTTPS em um domínio público, por exemplo:
- `https://api.seudominio.com.br/api/webhook/efipay`
- `https://webhook.seudominio.com.br/api/webhook/efipay`

---

## ⚙️ Configuração do Servidor

### Opção 1: Node.js com mTLS (Recomendado para Produção)

Atualize o `.env`:

```env
# SSL/TLS Configuration
ENABLE_HTTPS=true
SSL_CERT_PATH=/caminho/para/seu-dominio.crt
SSL_KEY_PATH=/caminho/para/seu-dominio.key
EFI_WEBHOOK_CA_PATH=/caminho/para/efi-webhook.crt
```

O servidor já está preparado para usar essas variáveis (veja `server/_core/index.ts`).

### Opção 2: Nginx como Reverse Proxy (Mais Simples)

Configure o Nginx para handle mTLS e fazer proxy para sua aplicação Node.js:

```nginx
server {
    listen 443 ssl;
    server_name webhook.seudominio.com.br;

    # Certificado do seu domínio
    ssl_certificate /etc/letsencrypt/live/seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com.br/privkey.pem;

    # Certificado público da Efí (mTLS)
    ssl_client_certificate /caminho/para/efi-webhook.crt;
    ssl_verify_client optional;
    ssl_verify_depth 3;

    # Rota do webhook
    location /api/webhook/efipay {
        # Só aceita se o certificado da Efí for válido
        if ($ssl_client_verify != SUCCESS) {
            return 403;
        }

        # Proxy para Node.js
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Client-Verify $ssl_client_verify;
    }

    # Outras rotas sem mTLS
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Vantagens do Nginx:**
- Mais fácil de configurar
- Não precisa reiniciar Node.js para renovar certificados
- Melhor performance para SSL

---

## 📝 Configurar Webhook na Plataforma Efí

### 1. Via API (Programático)

Use o endpoint `PUT /v2/webhook/:chave` para configurar:

```bash
curl -X PUT "https://pix-h.api.efipay.com.br/v2/webhook/SUA_CHAVE_PIX" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --cert certificado.p12:senha \
  -d '{
    "webhookUrl": "https://webhook.seudominio.com.br/api/webhook/efipay"
  }'
```

Substitua `SUA_CHAVE_PIX` pela chave Pix configurada no `EFI_PIX_KEY`.

### 2. Via Painel da Efí (Interface)

1. Acesse sua conta Efí → **API** → **Webhooks**
2. Clique em **Configurar Webhook Pix**
3. Insira a URL: `https://webhook.seudominio.com.br/api/webhook/efipay`
4. Clique em **Testar**
   - A Efí fará 2 requisições:
     - **1ª**: Sem certificado (deve retornar 403)
     - **2ª**: Com certificado (deve retornar 200)
5. Se ambos os testes passarem, clique em **Salvar**

---

## 🧪 Como Testar

### 1. Testar Localmente (Desenvolvimento)

Para testar sem expor seu servidor publicamente, use **ngrok** ou **localhost.run**:

```bash
# Com ngrok
ngrok http 3000

# Você receberá uma URL como: https://abc123.ngrok.io
# Configure o webhook: https://abc123.ngrok.io/api/webhook/efipay
```

⚠️ **Limitação**: ngrok gratuito não suporta mTLS customizado. Use apenas para testes básicos.

### 2. Endpoint de Teste Manual

O código já tem um endpoint para simular webhooks:

```http
POST http://localhost:3000/api/webhook/efipay/test
Content-Type: application/json

{
  "txid": "abc123def456...",
  "amount": 1000
}
```

Ou com `participantId`:

```http
POST http://localhost:3000/api/webhook/efipay/test
Content-Type: application/json

{
  "participantId": "uuid-do-participante"
}
```

### 3. Verificar Logs

Após configurar o webhook, crie uma cobrança e faça um pagamento de teste. No console você verá:

```
[Webhook] Received 1 Pix transaction(s)
[Webhook] Processing Pix: {
  txid: 'abc123...',
  endToEndId: 'E00000000202401011234...',
  valor: '100.00'
}
[Webhook] ✅ Payment confirmed for participant abc-123
```

---

## 🔍 Verificar se o Webhook está Configurado

### Via API:

```bash
curl -X GET "https://pix-h.api.efipay.com.br/v2/webhook/SUA_CHAVE_PIX" \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \
  --cert certificado.p12:senha
```

Resposta esperada:

```json
{
  "webhookUrl": "https://webhook.seudominio.com.br/api/webhook/efipay",
  "chave": "sua-chave-pix",
  "criacao": "2024-01-01T12:00:00.000Z"
}
```

---

## 🐛 Troubleshooting

### Erro: "socket hang up" ao configurar webhook

**Causa**: Seu servidor não está aceitando o certificado da Efí.

**Solução**:
- Certifique-se de que o certificado público da Efí está no lugar certo
- Verifique se `ssl_client_certificate` (Nginx) ou `ca` (Node.js) está configurado
- Logs do Nginx: `tail -f /var/log/nginx/error.log`

### Erro: Webhook retorna 403

**Causa**: Sua aplicação está rejeitando a requisição antes de processar.

**Solução**:
- No Nginx: verifique se `ssl_verify_client optional` está ativo
- Certifique-se de que a rota não tem autenticação JWT/middleware bloqueando

### Webhooks não chegam após pagamento

**Causas possíveis**:
1. Webhook não está configurado na Efí
2. URL incorreta
3. Servidor não está respondendo com status 2XX
4. Firewall bloqueando IPs da Efí

**Solução**:
- Verifique se o webhook está ativo: `GET /v2/webhook/:chave`
- Teste manualmente com `POST /api/webhook/efipay/test`
- Verifique logs do servidor

---

## 📊 Estrutura do Payload (Referência)

### Pix Recebido

```json
{
  "pix": [
    {
      "endToEndId": "E00000000202401011234abcdefghij",
      "txid": "abc123def456...",
      "valor": "100.00",
      "horario": "2024-01-01T12:00:00.000Z",
      "chave": "sua-chave-pix",
      "infoPagador": "Mensagem do pagador"
    }
  ]
}
```

### Devolução Enviada

```json
{
  "pix": [
    {
      "endToEndId": "E12345678202009091221syhgfgufg",
      "txid": "abc123...",
      "valor": "100.00",
      "devolucoes": [
        {
          "id": "123ABC",
          "rtrId": "D12345678202009091221abcdf098765",
          "valor": "100.00",
          "status": "DEVOLVIDO"
        }
      ]
    }
  ]
}
```

---

## 🔄 Retentativas

Se seu servidor não responder com status 2XX, a Efí fará até **9 tentativas**:

| Tentativa | Delay |
|-----------|-------|
| 1 | Imediata |
| 2 | 5 min |
| 3 | 5 min |
| 4 | 5 min |
| 5 | 10 min |
| 6 | 20 min |
| 7 | 40 min |
| 8 | 80 min |
| 9 | 160 min |

Após a 9ª tentativa, use o endpoint de reenvio manual se necessário.

---

## ✅ Checklist

- [ ] Certificado SSL do domínio configurado (HTTPS)
- [ ] Certificado público da Efí baixado e configurado no servidor
- [ ] Servidor responde com 403 sem certificado da Efí
- [ ] Servidor responde com 200 com certificado da Efí
- [ ] URL pública acessível
- [ ] Webhook configurado na plataforma Efí (`PUT /v2/webhook/:chave`)
- [ ] Teste com pagamento real ou simulado funcionando
- [ ] Logs mostram recebimento de notificações

---

## 📚 Referências

- [Documentação Oficial - Webhooks Efí Pay](https://dev.efipay.com.br/docs/api-pix/webhooks/)
- [Documentação - Status das Transações](https://dev.efipay.com.br/docs/api-pix/status-transacoes/)
- [Certificados da Efí](https://certificados.efipay.com.br/)
