# 🧪 Testando Pagamentos Pix em Homologação

Guia completo para testar pagamentos Pix no ambiente de homologação da Efí Pay.

**Referência:** [Documentação Oficial - Envio e Pagamento Pix](https://dev.efipay.com.br/docs/api-pix/envio-pagamento-pix/)

---

## 📋 Regras de Teste em Homologação

A Efí Pay simula diferentes cenários baseados no **valor** do Pix:

| Valor | Comportamento | Notificação |
|-------|---------------|-------------|
| **R$ 0,01 a R$ 10,00** | ✅ Pagamento confirmado | Via Webhook |
| **R$ 10,01 a R$ 20,00** | ❌ Pagamento rejeitado | Via Webhook |
| **Acima de R$ 20,00** | ❌ Rejeitado imediatamente | Sem Webhook |
| **R$ 4,00** | ✅ Confirmado + 2 devoluções de R$ 2,00 | Via Webhook |
| **R$ 5,00** | ✅ Confirmado + 1 devolução de R$ 5,00 | Via Webhook |

### ⚠️ Chave Pix Obrigatória para Testes

Para testar pagamentos **via chave Pix**, use **apenas**:

```
[email protected]
```

Qualquer outra chave retornará erro de "chave inválida".

---

## 🎯 Métodos de Teste

### **Método 1: Simulação Manual (Webhook)**

Simula o recebimento do pagamento diretamente no backend, **sem envolver a API da Efí**.

#### Como usar:

1. **Gere o QR Code** (crie um participante no rateio)
2. **Simule o pagamento** via endpoint de teste:

```http
POST http://localhost:3000/api/webhook/efipay/test
Content-Type: application/json

{
  "participantId": "uuid-do-participante"
}

# ✅ NOTA: O "amount" é OPCIONAL
# Se não informado, usa o valor da contribuição do participante automaticamente
# Se informar, deve estar em CENTAVOS (ex: 1000 = R$ 10,00)
```

#### Resposta esperada:

```json
{
  "success": true,
  "message": "Successfully simulated Pix payment for txid abc123...",
  "participantId": "uuid-do-participante",
  "rateioId": "uuid-do-rateio",
  "amount": 10000,
  "e2eId": "E1234567890..."
}
```

✅ **Vantagens:**
- Não precisa de webhook configurado
- Não precisa do escopo `pix.send` ativo
- Teste rápido e local

❌ **Desvantagens:**
- Não testa a integração real com a Efí
- Não valida QR Code

---

### **Método 2: Pagamento via API (Oficial)**

Paga o QR Code **usando a API da Efí**, simulando o fluxo completo.

#### Requisitos:

1. ✅ Escopo `pix.send` ativo na sua aplicação Efí
2. ✅ Escopo `gn.qrcodes.pay` ativo na sua aplicação Efí
3. ✅ Webhook configurado para a chave Pix do pagador (`EFI_PIX_KEY`)
4. ✅ Ambiente de homologação (`EFI_SANDBOX=true`)

#### Como usar:

1. **Gere o QR Code** (crie um participante no rateio)
2. **Pague via API** usando o endpoint:

```http
POST http://localhost:3000/api/webhook/efipay/pay-qrcode
Content-Type: application/json

{
  "participantId": "1efd0118-85db-4b17-a2ad-16c6982bc794"
}
```

**Nota:** Se não informar `payerPixKey`, usa automaticamente `[email protected]`.

#### Resposta esperada:

```json
{
  "success": true,
  "message": "QR Code payment sent successfully. Webhook will arrive shortly.",
  "payment": {
    "idEnvio": "abc123...",
    "e2eId": "E09089356202011251226...",
    "valor": "2.00",
    "horario": {
      "solicitacao": "2024-01-01T12:00:00.000Z"
    },
    "status": "EM_PROCESSAMENTO"
  },
  "participantId": "uuid-do-participante",
  "rateioId": "uuid-do-rateio",
  "hint": "In production, the webhook will notify you when the payment is confirmed"
}
```

#### O que acontece:

1. ✅ A API envia o pagamento para a Efí
2. ⏳ Efí processa o pagamento
3. 📡 Efí envia webhook de confirmação
4. ✅ Seu servidor atualiza o status do participante

✅ **Vantagens:**
- Testa o fluxo completo
- Valida integração real com a Efí
- Simula ambiente de produção

❌ **Desvantagens:**
- Precisa de webhook configurado
- Requer escopos adicionais
- Mais complexo de configurar

---

## 📝 Exemplos Práticos

### Exemplo 1: Teste Simples (Pagamento Aprovado)

```bash
# 1. Criar participante (gera QR Code com R$ 10,00)
# Assumindo que o participantId gerado seja: abc-123-def-456

# 2. Simular pagamento (Método 1) - USA O VALOR CORRETO AUTOMATICAMENTE
curl -X POST http://localhost:3000/api/webhook/efipay/test \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "abc-123-def-456"
  }'

# ✅ Participante será marcado como "paid" com R$ 10,00
# O sistema usa automaticamente o valor da contribuição do participante
```

### Exemplo 1b: Teste com Valor Customizado (CUIDADO!)

```bash
# ⚠️ ATENÇÃO: O "amount" deve estar em CENTAVOS!

# ❌ ERRADO - vai registrar apenas R$ 0,10
curl -X POST http://localhost:3000/api/webhook/efipay/test \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "abc-123-def-456",
    "amount": 10
  }'

# ✅ CORRETO - registra R$ 10,00 (1000 centavos)
curl -X POST http://localhost:3000/api/webhook/efipay/test \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "abc-123-def-456",
    "amount": 1000
  }'
```

### Exemplo 2: Teste com API da Efí (Pagamento Real)

```bash
# 1. Criar participante (gera QR Code com R$ 5,00)
# participantId: abc-123-def-456

# 2. Pagar via API da Efí (Método 2)
curl -X POST http://localhost:3000/api/webhook/efipay/pay-qrcode \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "abc-123-def-456",
    "payerPixKey": "[email protected]"
  }'

# ⏳ Aguarde ~2-5 segundos
# 📡 Webhook será recebido automaticamente
# ✅ Participante será marcado como "paid"
```

### Exemplo 3: Teste de Rejeição (Valor Alto)

```bash
# 1. Criar participante com valor > R$ 20,00
# participantId: xyz-789-abc-012

# 2. Tentar pagar via API
curl -X POST http://localhost:3000/api/webhook/efipay/pay-qrcode \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "xyz-789-abc-012"
  }'

# ❌ Retornará erro 400 ou 422 imediatamente
# "Saldo insuficiente" ou "Valor acima do limite"
```

---

## 🔍 Verificando os Resultados

### 1. Via Logs do Console

Após simular o pagamento, verifique os logs:

```
[Webhook Test] Paying QR Code for participant abc-123-def-456 using API
[Efí Pay] Paying QR Code: {
  idEnvio: 'ml7hc60038f629ab633bff81',
  payerKey: '[email protected]...',
  qrCode: '00020101021226830014BR.GOV...'
}
[Efí Pay] ✅ QR Code paid successfully: E09089356202011251226...
[Webhook Test] ✅ Simulated webhook received for e2eId E09089356...
[Webhook] ✅ Payment confirmed for participant abc-123-def-456
```

### 2. Via Banco de Dados

Consulte o status do participante:

```sql
SELECT id, pixKey, status, paidAmount, createdAt, updatedAt
FROM participants
WHERE id = 'abc-123-def-456';
```

**Resultado esperado:**
```
status: "paid"
paidAmount: 500 (R$ 5,00 em centavos)
updatedAt: (data recente)
```

### 3. Via API (tRPC)

Use o endpoint de status do rateio:

```http
POST http://localhost:3000/api/trpc/rateio.getById
Content-Type: application/json

{
  "input": {
    "id": "uuid-do-rateio"
  }
}
```

Verifique o campo `paidAmount` e `totalParticipants`.

---

## 🐛 Troubleshooting

### Erro: "insufficient_scope"

**Causa:** Escopo `pix.send` ou `gn.qrcodes.pay` não está ativo.

**Solução:**
1. Acesse sua conta Efí → **API** → **Aplicações**
2. Edite a aplicação
3. Ative os escopos:
   - ✅ `pix.send` - Enviar Pix
   - ✅ `gn.qrcodes.pay` - Pagar QR Code Pix
4. Salve e reinicie o servidor

### Erro: "A chave do recebedor não foi encontrada"

**Causa:** Está usando uma chave diferente de `[email protected]` em homologação.

**Solução:**
Use **sempre** `[email protected]` como `payerPixKey` em testes.

### Erro: "Funcionalidade desabilitada em ambiente de homologação"

**Causa:** A Efí restringe algumas funcionalidades em homologação (ex: valores muito altos).

**Solução:**
- Use valores entre **R$ 0,01 e R$ 10,00** para sucesso
- Ou use o **Método 1** (simulação manual) que não tem restrições

### Webhook não chega após pagamento

**Possíveis causas:**
1. Webhook não configurado na Efí
2. Servidor não está acessível publicamente
3. mTLS não configurado corretamente

**Solução:**
- Use `POST /api/webhook/efipay/test` (Método 1) para testar sem webhook
- Veja o guia completo em `WEBHOOK_SETUP.md`

---

## 📚 Resumo Rápido

| Cenário | Método | Comando |
|---------|--------|---------|
| **Teste rápido local** | Método 1 | `POST /api/webhook/efipay/test` |
| **Teste com API real** | Método 2 | `POST /api/webhook/efipay/pay-qrcode` |
| **Pagamento aprovado** | Ambos | Valor: R$ 0,01 a R$ 10,00 |
| **Pagamento rejeitado** | Ambos | Valor: R$ 10,01 a R$ 20,00 |
| **Com devoluções** | Ambos | Valor: R$ 4,00 ou R$ 5,00 |

---

## 🎯 Próximos Passos

1. ✅ Teste com **Método 1** (simulação manual)
2. ✅ Configure webhook (veja `WEBHOOK_SETUP.md`)
3. ✅ Teste com **Método 2** (API da Efí)
4. ✅ Teste diferentes valores (aprovado, rejeitado, devolução)
5. ✅ Verifique logs e banco de dados
6. 🚀 Deploy em produção!

---

## 📖 Referências

- [Documentação - Envio e Pagamento Pix](https://dev.efipay.com.br/docs/api-pix/envio-pagamento-pix/)
- [Documentação - Webhooks](https://dev.efipay.com.br/docs/api-pix/webhooks/)
- [Documentação - Credenciais](https://dev.efipay.com.br/docs/api-pix/credenciais/)
- `WEBHOOK_SETUP.md` - Configuração de webhooks
