# Rateio.Top MVP

**Plataforma de Rateios com Pagamento via Pix**

Um MVP completo para criar rateios, compartilhar links e receber pagamentos automaticamente via Pix usando Pagar.me como provedor de pagamento.

---

## 🎯 Visão Geral

Rateio.Top permite que usuários:

1. **Criem rateios** com nome, valor total, descrição e modo de privacidade
2. **Compartilhem links** únicos (familyos.link/{id}) com participantes
3. **Adicionem chaves Pix** com autodetect de tipo (EVP, CPF, CNPJ, email, telefone)
4. **Gerem QR Codes Pix** automaticamente via Pagar.me
5. **Acompanhem progresso** em tempo real com polling
6. **Recebam liquidação automática** ao atingir 100%

---

## 🏗️ Arquitetura

### Backend (Node.js + Express + tRPC)

**Banco de Dados (Drizzle + MySQL):**
- `users` - Usuários autenticados via Manus OAuth
- `rateios` - Rateios criados
- `participants` - Participantes do rateio
- `paymentIntents` - Intents de pagamento Pagar.me
- `transactions` - Histórico de transações
- `rateioEvents` - Timeline de eventos

**Endpoints tRPC:**

```
rateio.create(name, totalAmount, privacyMode, description?, expiresAt?)
rateio.getById(id) → Rateio com progresso e eventos
rateio.getByCreator() → Lista de rateios do criador
rateio.updateStatus(id, status)

participant.create(rateioId, pixKey, autoRefund)
participant.getById(id)
participant.getByRateio(rateioId)

payment.createIntent(participantId) → QR Code + Copia e Cola
payment.getStatus(intentId)
payment.refund(intentId)
```

**Webhook:**
```
POST /api/webhook/pagarme
- charge.paid → Atualiza status do participante, cria evento
- charge.refunded → Processa reembolso
- charge.failed → Registra falha
```

### Frontend (React 19 + Tailwind + shadcn/ui)

**Páginas:**
- `/` - Home com navegação e CTA
- `/create` - Formulário de criação de rateio
- `/rateio/:id/participate` - Captura de Pix e geração de QR
- `/rateio/:id/status` - Status com polling e timeline

**Componentes:**
- `RateioForm` - Formulário validado
- `RateioConfirmation` - Slug e compartilhamento
- `PixKeyInput` - Input com autodetect
- `RateioStatus` - Progresso e eventos

---

## 🚀 Como Começar

### Pré-requisitos

- Node.js 22+
- pnpm
- Conta Pagar.me (sandbox)
- Manus OAuth (já configurado)

### Instalação

```bash
cd rateio_top_mvp
pnpm install
pnpm db:push
```

### Variáveis de Ambiente

As seguintes variáveis já estão injetadas pelo Manus:

```
DATABASE_URL=mysql://...
JWT_SECRET=...
VITE_APP_ID=...
OAUTH_SERVER_URL=...
VITE_OAUTH_PORTAL_URL=...
OWNER_OPEN_ID=...
OWNER_NAME=...
PAGARME_API_KEY=...
PAGARME_ACCOUNT_ID=...
```

### Desenvolvimento

```bash
pnpm dev
# Acesse http://localhost:3000
```

---

## 📋 Fluxo de Uso - "Chá de Fralda"

### 1. Criador cria rateio

```
Nome: Chá de Fralda da Maria
Valor Total: R$ 500.00
Privacidade: Parcial
Descrição: Chá de fralda para celebrar a chegada da bebê
```

**Resultado:** Link `familyos.link/{id}` gerado

### 2. Criador compartilha link

- Copia link ou usa botão "Compartilhar"
- Envia via WhatsApp, email, etc

### 3. Participante acessa link

- Clica no link recebido
- Vê detalhes do rateio (nome, valor, privacidade)
- Clica em "Participar"

### 4. Participante adiciona Pix

```
Chave Pix: 12345678901 (CPF)
ou
Chave Pix: uuid-aleatorio-aqui (EVP)
ou
Chave Pix: email@example.com
```

**Autodetect:** Sistema identifica tipo automaticamente

### 5. Participante gera QR Code

- Clica "Gerar QR Code Pix"
- Recebe QR Code + Copia e Cola
- Abre app do banco e escaneia ou cola código

### 6. Pagamento processado

- Webhook Pagar.me notifica sucesso
- Status do participante muda para "PAGO"
- Progresso atualiza em tempo real

### 7. Liquidação automática

- Ao atingir 100%, status muda para "CONCLUIDO"
- Evento criado: "Rateio concluído! Liquidação automática iniciada"
- (Futura) Reembolsos automáticos se cancelado

---

## 🔐 Privacidade

### Modo Parcial (padrão)

- **Criador vê:** Nomes dos participantes, valores, status
- **Participante vê:** Apenas sua contribuição e progresso total

### Modo Total

- **Criador vê:** P#01, P#02, P#03 (sem nomes)
- **Participante vê:** Apenas sua contribuição e progresso total

### Modo Aberto (futuro)

- Todos veem tudo (nomes, valores, status)

---

## 🔄 Polling e Real-time

A página de status (`/rateio/:id/status`) faz polling a cada 3 segundos:

```typescript
const { data: rateio } = trpc.rateio.getById.useQuery(
  { id: rateioId },
  { refetchInterval: autoRefresh ? 3000 : false }
);
```

**Desativar auto-refresh:** Clique no botão "Auto-atualização: Ativa"

---

## 🧪 Teste com Pagar.me Sandbox

### 1. Obter credenciais

- Acesse [Pagar.me Dashboard](https://dashboard.pagar.me)
- Vá para Configurações → Chaves de API
- Copie `API_KEY` e `ACCOUNT_ID`

### 2. Configurar variáveis

As variáveis já estão injetadas. Verifique em Settings → Secrets.

### 3. Simular pagamento

Use a API Pagar.me para simular:

```bash
curl -X POST https://api.pagar.me/core/v5/charges \
  -H "Authorization: Basic $(echo -n :$PAGARME_API_KEY | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "payment_method": "pix",
    "customer": {
      "email": "test@example.com",
      "name": "Test User"
    }
  }'
```

---

## 📊 Validação de Chaves Pix

O sistema autodetecta e valida:

| Tipo | Formato | Exemplo |
|------|---------|---------|
| **EVP** | UUID | `550e8400-e29b-41d4-a716-446655440000` |
| **CPF** | 11 dígitos | `12345678901` |
| **CNPJ** | 14 dígitos | `12345678901234` |
| **Email** | Email válido | `user@example.com` |
| **Telefone** | 10-11 dígitos | `11987654321` |

---

## 🐛 Troubleshooting

### "Erro ao criar rateio"

- Verifique se está autenticado
- Valide o valor total (mínimo R$ 0,01)
- Prazo deve ser 15+ minutos no futuro

### "Chave Pix inválida"

- Verifique o formato
- Use apenas números para CPF/CNPJ
- Email deve ter @ e domínio

### "Erro ao gerar QR Code"

- Verifique credenciais Pagar.me
- Confirme que a chave Pix é válida
- Tente novamente em alguns segundos

### "Webhook não recebido"

- Configure ngrok: `ngrok http 3000`
- Atualize URL do webhook em Pagar.me
- Verifique logs do servidor

---

## 📝 Próximos Passos

### MVP Completo

- [x] Criar rateio com validações
- [x] Compartilhar link
- [x] Adicionar participantes com Pix
- [x] Gerar QR Code Pix
- [x] Acompanhar progresso
- [x] Webhook de notificações
- [ ] Reembolsos automáticos
- [ ] Modo Aberto (público)
- [ ] Notificações por email/SMS

### Melhorias Futuras

- [ ] Histórico de rateios do usuário
- [ ] Edição de rateios (antes de começar)
- [ ] Cancelamento com reembolso
- [ ] Modo "Sorteio" (quem paga?)
- [ ] Integração com WhatsApp
- [ ] Análise de dados (dashboard)
- [ ] API pública para integrações

---

## 📞 Suporte

Para dúvidas ou reportar bugs, entre em contato com a equipe Rateio.Top.

---

## 📄 Licença

Propriedade da Rateio.Top. Todos os direitos reservados.

---

**Desenvolvido com ❤️ usando tRPC, React, Tailwind e Pagar.me**
