# 💸 Funcionalidade de Transferência para o Criador

## 📋 Visão Geral

Quando um rateio atinge 100% da meta, o **criador** pode solicitar a transferência do valor arrecadado para sua chave Pix cadastrada.

---

## ✨ Como Funciona

### 1. **Meta Atingida**
Quando o total de pagamentos confirmados atinge 100% da meta:
- ✅ Sistema cria evento: `"Meta atingida! O criador pode solicitar a transferência"`
- 📊 `rateio.progress.isPaid` vira `true`
- 💰 `rateio.progress.paidAmount` contém o valor total arrecadado

### 2. **Botão Aparece**
O botão "**Solicitar Transferência**" aparece **apenas** quando:
- ✅ Meta foi atingida (`progress.isPaid === true`)
- ✅ Usuário logado é o criador (`user.id === rateio.creatorId`)
- ✅ Rateio não foi concluído (`status !== "CONCLUIDO"`)

### 3. **Criador Solicita Transferência**
- Criador clica no botão
- Sistema valida:
  - ✅ Criador tem chave Pix cadastrada
  - ✅ Há valor disponível para transferência
  - ✅ Rateio não foi concluído antes
- Sistema envia Pix via Efí Pay API

### 4. **Transferência Processada**
- ✅ Pix enviado para a chave do criador
- ✅ Status do rateio muda para `"CONCLUIDO"`
- ✅ Evento criado: `"Transferência de R$ XX,XX realizada para o criador"`
- 📧 Webhook da Efí notifica o status da transferência

---

## 🖥️ Interface do Usuário

### Página de Detalhes (`/rateio/:id`)

Quando a meta é atingida, um card verde aparece:

```
┌────────────────────────────────────────┐
│ ✓ Meta Atingida! 🎉                    │
│                                         │
│ Parabéns! O rateio atingiu 100% da    │
│ meta. Você pode solicitar a            │
│ transferência do valor para sua chave  │
│ Pix.                                    │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Valor Total Arrecadado:          │   │
│ │                      R$ 100,00   │   │
│ └─────────────────────────────────┘   │
│                                         │
│ [📤 Solicitar Transferência]           │
└────────────────────────────────────────┘
```

### Página de Status (`/rateio/:id/status`)

O mesmo botão aparece dentro do card de informações do rateio.

### Depois da Transferência

```
┌────────────────────────────────────────┐
│ ✓ Rateio Concluído                     │
│                                         │
│ A transferência foi realizada com      │
│ sucesso! Verifique sua conta.          │
│                                         │
│ ┌─────────────────────────────────┐   │
│ │ Valor Transferido:               │   │
│ │                      R$ 100,00   │   │
│ └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

## 🔧 Implementação Técnica

### Backend (tRPC Mutation)

**Rota:** `payment.transferToCreator`

```typescript
// server/routers.ts
transferToCreator: protectedProcedure
  .input(z.object({ rateioId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Validar rateio existe
    // 2. Validar usuário é o criador
    // 3. Buscar chave Pix do criador
    // 4. Calcular valor total
    // 5. Enviar Pix via efiPayService.sendPix()
    //    Endpoint usado: PUT /v3/gn/pix/:idEnvio
    // 6. Atualizar status do rateio para "CONCLUIDO"
    // 7. Criar evento de conclusão
    return { success, transferId, e2eId, amount };
  })
```

**Endpoint Efí Pay usado:** `PUT /v3/gn/pix/:idEnvio`  
**Documentação:** https://dev.efipay.com.br/docs/api-pix/envio-pagamento-pix/

### Frontend (React Component)

**Arquivos:**
- `client/src/pages/RateioDetails.tsx`
- `client/src/pages/RateioStatus.tsx`

```typescript
const transferMutation = trpc.payment.transferToCreator.useMutation({
  onSuccess: (data) => {
    toast.success(`Transferência de R$ ${(data.amount / 100).toFixed(2)} realizada!`);
  },
  onError: (error) => {
    toast.error("Erro ao solicitar transferência", { description: error.message });
  },
});

const handleTransferToCreator = () => {
  transferMutation.mutate({ rateioId });
};
```

### Efí Pay Integration

```typescript
// server/efipay.ts
async sendPix(
  pixKey: string,
  amount: number, // in cents
  description: string
): Promise<EfiPixSendResponse>
```

---

## ⚙️ Requisitos

Para que a transferência funcione:

### 1. **Escopos da Efí**
- ✅ `pix.send` - Enviar Pix
- ✅ `gn.pix.send.read` - Consultar Pix enviado

### 2. **Webhook Configurado**
- ✅ Webhook ativo para `EFI_PIX_KEY`
- ✅ Endpoint: `https://seu-dominio/api/webhook/efipay`

### 3. **Criador com Chave Pix**
- ✅ Criador precisa ter cadastrado sua chave Pix no sistema
- ✅ Feito no modal "Finalizar Cadastro" ao criar rateio

### 4. **Saldo na Conta Efí**
- ✅ O dinheiro precisa ter "entrado" antes de "sair"
- ✅ Participantes pagam → dinheiro cai na conta Efí → criador solicita → dinheiro sai

---

## 🧪 Como Testar

### 1. Criar Rateio
```bash
# 1. Login como criador
# 2. Criar rateio de R$ 10,00
# 3. Cadastrar chave Pix no modal (se ainda não tiver)
```

### 2. Atingir Meta
```bash
# Opção A: Via teste manual
POST http://localhost:3000/api/webhook/efipay/test
{
  "participantId": "uuid-do-participante"
}

# Opção B: Via API da Efí (homologação)
POST http://localhost:3000/api/webhook/efipay/pay-qrcode
{
  "participantId": "uuid-do-participante",
  "payerPixKey": "[email protected]"
}
```

### 3. Solicitar Transferência
```bash
# 1. Recarregar a página do rateio
# 2. Ver o card verde "Meta Atingida! 🎉"
# 3. Clicar em "Solicitar Transferência"
# 4. Aguardar confirmação (toast de sucesso)
# 5. Ver card azul "Rateio Concluído"
```

### 4. Verificar Webhook
```bash
# O webhook da Efí notificará o status do Pix enviado
# Logs esperados:
[Efí Pay] Sending Pix: { to: 'chave-do-criador', amount: '10.00' }
[Efí Pay] ✅ Pix sent successfully: E09089356202...
[Webhook] Received Pix sent confirmation
```

---

## 🚨 Possíveis Erros

### "Você precisa cadastrar uma chave Pix para receber o valor"
**Causa:** Criador não tem chave Pix no banco.

**Solução:**
1. Ir para "Finalizar Cadastro"
2. Preencher chave Pix
3. Salvar
4. Tentar novamente

### "Não há valor disponível para transferência"
**Causa:** `paidAmount <= 0`

**Solução:**
- Confirmar que pagamentos foram recebidos
- Verificar `rateio.progress.paidAmount` no banco

### "Este rateio já foi concluído"
**Causa:** `rateio.status === "CONCLUIDO"`

**Solução:**
- Transferência já foi feita antes
- Verificar eventos do rateio

### "Falha ao enviar Pix" (Efí Pay)
**Possíveis causas:**
- Escopo `pix.send` não ativo
- Webhook não configurado
- Chave Pix inválida
- Saldo insuficiente na conta Efí

**Solução:**
- Verificar configuração da aplicação Efí
- Ver logs da Efí Pay: `[Efí Pay] Error sending Pix`

---

## 📊 Fluxo Completo

```
1. Participantes pagam via Pix
   ↓
2. Webhooks confirmam pagamentos
   ↓
3. Sistema calcula progresso
   ↓
4. Meta atinge 100% → isPaid = true
   ↓
5. Botão aparece para criador
   ↓
6. Criador clica "Solicitar Transferência"
   ↓
7. Backend valida e envia Pix
   ↓
8. Efí Pay processa transferência
   ↓
9. Webhook confirma envio
   ↓
10. Status muda para "CONCLUIDO"
    ↓
11. Criador vê confirmação ✓
```

---

## 🔄 Diferença: Automático vs Manual

### ❌ Transferência Automática (NÃO implementada)
- Sistema transfere automaticamente ao atingir 100%
- **Riscos:** transferências acidentais, menos controle

### ✅ Transferência Manual (Implementada)
- Criador decide quando receber
- Mais seguro e com controle total
- Recomendado pela documentação Efí Pay

---

## 📚 Referências

- [Documentação Efí - Envio de Pix](https://dev.efipay.com.br/docs/api-pix/envio-pagamento-pix/)
- [Webhooks Efí Pay](https://dev.efipay.com.br/docs/api-pix/webhooks/)
- `server/routers.ts` - Implementação do backend
- `client/src/pages/RateioDetails.tsx` - Interface do usuário
- `TESTING_HOMOLOGACAO.md` - Guia de testes
