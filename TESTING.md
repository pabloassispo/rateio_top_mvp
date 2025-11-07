# Guia de Testes - Rateio.Top MVP

## 🧪 Teste Manual: "Chá de Fralda"

Este guia descreve como testar o fluxo completo do MVP com um caso de uso real.

---

## Pré-requisitos

- Servidor rodando em http://localhost:3000
- Conta Pagar.me (sandbox)
- 2-3 navegadores ou abas incógnitas para simular usuários

---

## Teste 1: Criar Rateio

### Passo 1: Acessar Home

```
URL: http://localhost:3000
Esperado: Home com botão "Criar Novo Rateio"
```

### Passo 2: Autenticar (se necessário)

```
Clique: "Entrar"
Esperado: Redirecionado para Manus OAuth
Resultado: Volta para Home com "Olá, [Nome]"
```

### Passo 3: Criar Rateio

```
Clique: "Criar Novo Rateio"
URL: http://localhost:3000/create
```

**Preencha o formulário:**

| Campo | Valor |
|-------|-------|
| Nome | Chá de Fralda da Maria |
| Descrição | Chá de fralda para celebrar a chegada da bebê |
| Valor Total | 500.00 |
| Privacidade | Parcial |
| Prazo | (deixe vazio ou defina 1 hora no futuro) |

### Passo 4: Validações

Teste as validações:

```
Nome vazio → "Nome do rateio é obrigatório"
Nome < 3 caracteres → "Nome deve ter pelo menos 3 caracteres"
Valor 0 → "Valor deve ser maior que R$ 0,01"
Prazo < 15 min → "Prazo deve ser pelo menos 15 minutos no futuro"
```

### Passo 5: Criar Rateio

```
Clique: "Criar Rateio"
Esperado: Página de confirmação com slug
URL: http://localhost:3000/create (mantém na página)
```

**Verifique:**
- ✅ Título "Chá de Fralda da Maria"
- ✅ Valor: R$ 500.00
- ✅ Privacidade: Parcial
- ✅ Link gerado: `familyos.link/{id}`
- ✅ Botão "Copiar" funciona
- ✅ Botão "Compartilhar" (se suportado pelo navegador)

---

## Teste 2: Compartilhar Link

### Passo 1: Copiar Link

```
Clique: Botão de cópia ao lado do link
Esperado: Toast "Link copiado!"
Resultado: Link está na área de transferência
```

### Passo 2: Testar Link em Nova Aba

```
Abra nova aba
Cole o link: http://localhost:3000/rateio/{id}
Esperado: Página de detalhes do rateio (sem participar)
```

**Verifique:**
- ✅ Nome: "Chá de Fralda da Maria"
- ✅ Valor: R$ 500.00
- ✅ Privacidade: Parcial
- ✅ Descrição visível
- ✅ Botão "Participar" disponível

---

## Teste 3: Participante Adiciona Pix

### Passo 1: Acessar como Participante

```
URL: http://localhost:3000/rateio/{id}/participate
Esperado: Formulário de participação
```

### Passo 2: Testar Validação de Chaves Pix

**Teste CPF:**
```
Entrada: 12345678901
Esperado: "CPF" detectado, cor verde
```

**Teste CNPJ:**
```
Entrada: 12345678901234
Esperado: "CNPJ" detectado, cor verde
```

**Teste Email:**
```
Entrada: user@example.com
Esperado: "E-mail" detectado, cor verde
```

**Teste Telefone:**
```
Entrada: 11987654321
Esperado: "Telefone" detectado, cor verde
```

**Teste EVP (UUID):**
```
Entrada: 550e8400-e29b-41d4-a716-446655440000
Esperado: "Chave Aleatória (EVP)" detectado, cor verde
```

**Teste Inválido:**
```
Entrada: abc123
Esperado: "Tipo de chave não identificado", cor vermelha
```

### Passo 3: Adicionar Chave Pix Válida

```
Chave Pix: 12345678901 (CPF válido)
Checkbox: Marque "Quero reembolso automático"
Termos: Marque "Eu li e aceito os termos"
Clique: "Gerar QR Code Pix"
```

**Esperado:**
- ✅ Loading spinner
- ✅ Página muda para exibir QR Code
- ✅ QR Code renderizado (SVG ou imagem)
- ✅ Código "Copia e Cola" visível
- ✅ Botão "Copiar" funciona

---

## Teste 4: Simular Pagamento (Pagar.me)

### Passo 1: Obter ID da Charge

Após gerar QR Code, o sistema criou uma charge no Pagar.me. Para simular pagamento:

```bash
# Obtenha a lista de charges
curl -X GET https://api.pagar.me/core/v5/charges \
  -H "Authorization: Basic $(echo -n :$PAGARME_API_KEY | base64)"
```

### Passo 2: Simular Webhook (Local)

Para testar webhook localmente, use ngrok:

```bash
ngrok http 3000
# Copie a URL: https://xxxx-xx-xxx-xxx-xx.ngrok.io
```

Configure em Pagar.me:
```
Webhook URL: https://xxxx.ngrok.io/api/webhook/pagarme
```

### Passo 3: Enviar Evento de Teste

```bash
curl -X POST http://localhost:3000/api/webhook/pagarme \
  -H "Content-Type: application/json" \
  -d '{
    "type": "charge.paid",
    "data": {
      "id": "ch_xxxxx",
      "status": "paid",
      "amount": 50000
    }
  }'
```

**Esperado:**
- ✅ Status 200
- ✅ Resposta: `{ "success": true }`

---

## Teste 5: Acompanhar Progresso

### Passo 1: Acessar Status

```
URL: http://localhost:3000/rateio/{id}/status
Esperado: Página de status com progresso
```

**Verifique:**
- ✅ Barra de progresso visível
- ✅ Percentual exibido (0%, 25%, 50%, 75%, 100%)
- ✅ Lista de participantes
- ✅ Status de cada participante (PENDENTE, PAGO, etc)
- ✅ Timeline de eventos

### Passo 2: Testar Polling

```
Aguarde 3 segundos
Esperado: Página atualiza automaticamente
Resultado: Progresso muda se houver novo pagamento
```

### Passo 3: Desativar Auto-refresh

```
Clique: "Auto-atualização: Ativa"
Esperado: Muda para "Auto-atualização: Inativa"
Resultado: Página não atualiza mais
```

### Passo 4: Atualizar Manualmente

```
Clique: "Atualizar Agora"
Esperado: Página recarrega dados
Resultado: Progresso atualiza
```

---

## Teste 6: Privacidade

### Teste Modo Parcial

**Como Criador:**
```
Esperado: Vê nomes dos participantes
Exemplo: "João Silva" - R$ 150.00 - PAGO
```

**Como Participante:**
```
Esperado: Vê apenas sua contribuição
Exemplo: "Sua contribuição: R$ 150.00"
```

### Teste Modo Total

Crie novo rateio com privacidade "Total":

**Como Criador:**
```
Esperado: Vê P#01, P#02, P#03 (sem nomes)
Exemplo: "P#01" - R$ 150.00 - PAGO
```

**Como Participante:**
```
Esperado: Vê apenas sua contribuição
Exemplo: "Sua contribuição: R$ 150.00"
```

---

## Teste 7: Casos de Erro

### Erro 1: Chave Pix Inválida

```
Chave Pix: "invalid"
Clique: "Gerar QR Code Pix"
Esperado: Mensagem de erro
```

### Erro 2: Rateio Não Encontrado

```
URL: http://localhost:3000/rateio/invalid-id
Esperado: "Rateio não encontrado"
Botão: "Voltar para Home"
```

### Erro 3: Sem Autenticação

```
Logout
Acesse: http://localhost:3000/create
Esperado: "Você precisa estar autenticado"
Botão: "Voltar para Home"
```

---

## ✅ Checklist Final

- [ ] Criar rateio com validações
- [ ] Compartilhar link
- [ ] Acessar link como participante
- [ ] Validar autodetect de chaves Pix
- [ ] Gerar QR Code
- [ ] Simular pagamento via webhook
- [ ] Acompanhar progresso com polling
- [ ] Testar privacidade Parcial
- [ ] Testar privacidade Total
- [ ] Desativar/ativar auto-refresh
- [ ] Testar casos de erro
- [ ] Verificar timeline de eventos

---

## 🐛 Bugs Conhecidos

Nenhum no momento. Reporte qualquer problema!

---

## 📊 Métricas de Sucesso

- ✅ Fluxo completo funciona sem erros
- ✅ Validações funcionam corretamente
- ✅ Polling atualiza em tempo real
- ✅ Webhook processa eventos
- ✅ Privacidade é respeitada
- ✅ UI é responsiva e intuitiva

---

**Teste concluído com sucesso! 🎉**
