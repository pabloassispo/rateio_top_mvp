# Rateio.Top MVP - TODO

## Épico A: Criar e Compartilhar um Rateio

### A1 - Formulário de Criação
- [ ] A1.1 - Definir metadados do rateio (nome, valor, prazo, privacidade)
  - [ ] Validação de campos obrigatórios (nome 3-60 chars, valor ≥ 1 centavo, prazo futuro ≥ +15min)
  - [ ] Descrição máx. 140 chars, imagem opcional
  - [ ] Privacidade default = Parcial (só pode endurecer para Total)
  - [ ] Botão "Criar Rateio" habilitado apenas quando 100% válido
  - [ ] Retornar link único ao salvar

### A2 - Confirmação e Compartilhamento
- [ ] A2.1 - Tela de confirmação com resumo do rateio
  - [ ] Exibir slug familyos.link/{id}
  - [ ] Botão "Copiar link" com feedback visual
  - [ ] Botão "Compartilhar" para convidar participantes
  - [ ] Exibir recebedores (sem valores em modo privado)

## Épico B: Captura de Chave Pix e Geração de QR

### B1 - Captura e Validação da Chave Pix
- [ ] B1.1 - Formulário de entrada de chave Pix
  - [ ] Autodetectar tipo de chave (EVP, CPF, CNPJ, telefone, email)
  - [ ] Máscara/validação por tipo
  - [ ] Mensagens de erro claras por tipo de chave
  - [ ] Ícone de sucesso quando válido
  - [ ] Switch "Quero reembolso automático" persistido

### B2 - Geração do QR Code Pix
- [ ] B2.1 - Criar intent e gerar QR Code
  - [ ] POST /participants/{pid}/intent para criar intent via Pagar.me
  - [ ] Renderizar QR em SVG
  - [ ] Botão "Copiar Pix" com alternativa textual (código copia e cola)
  - [ ] Feedback visual de cópia
  - [ ] Tratamento de erros legíveis (ex: indisponibilidade PSP)
  - [ ] Expiração de intent com opção de gerar novo

### B3 - Feedback de Pagamento e Progresso
- [ ] B3.1 - Status e progresso do rateio
  - [ ] Atualização por polling de status (PENDING/PAID/REFUNDED)
  - [ ] Mensagens diferenciadas ("Contribuição confirmada" / "Aguardando outros...")
  - [ ] Barra de progresso com milestones (25/50/75/100%)

## Épico C: Encerramento Automático e Histórico

### C1 - Auto-disparo e Tela de Sucesso
- [ ] C1.1 - Liquidação automática ao atingir 100%
  - [ ] Banner "Pagamentos automáticos enviados"
  - [ ] Ação "Ver histórico"
  - [ ] Exibir participantes conforme privacidade (P#01, P#02 para Total)

### C2 - Histórico e Estados Finais
- [ ] C2.1 - Tela de histórico de rateios
  - [ ] Cards com selos "Concluído" / "Cancelado"
  - [ ] Filtros por status
  - [ ] Detalhes de cada rateio

## Épico D: Barra de Progresso e Milestones

### D1 - Progresso Visual
- [ ] D1.1 - ProgressBar com marcos 25/50/75/100%
  - [ ] Microanimações
  - [ ] Histórico leve de eventos ("Fulano contribuiu")
  - [ ] Respeitar privacidade no histórico

### D2 - Concorrência e Corrida ao 100%
- [ ] D2.2 - Tratamento de contribuição acima do necessário
  - [ ] Detectar excedente
  - [ ] Se excedente > taxa de reembolso: dividir entre cadastrados
  - [ ] Se excedente < taxa: manter no rateio.top
  - [ ] Mensagem "valor excedente tratado"

## Épico E: Liquidação e Reembolsos

### E1 - Tela de Liquidação
- [ ] E1.1 - Banner de sucesso ao 100%
  - [ ] Confete sutil
  - [ ] Call-to-action "Ver histórico"

### E2 - Cancelamento Controlado
- [ ] E2.1 - Cancelar enquanto ATIVO
  - [ ] Modal de confirmação
  - [ ] Aviso de política de reembolso (texto estático)
  - [ ] Bloquear se DISPARADO_AUTOMÁTICO

### E3 - Reembolsos (UX Mínima)
- [ ] E3.1 - Reembolso automático opt-in
  - [ ] Se criador cancelar: "Seu reembolso foi solicitado"
  - [ ] Sem ação manual no front
  - [ ] Webhook reflete status

## Backend & Integração

### Banco de Dados
- [x] Schema Drizzle com tabelas: rateios, participantes, pagamentos, transações
- [x] Migrations aplicadas com sucesso
- [ ] Seed data para testes

### API Endpoints (tRPC)
- [x] rateio.create - criar rateio
- [x] rateio.getById - status público
- [x] rateio.getByCreator - listar rateios do criador
- [x] rateio.updateStatus - atualizar status
- [x] participant.create - adicionar participante com validação Pix
- [x] participant.getById - obter detalhes do participante
- [x] participant.getByRateio - listar participantes
- [x] payment.createIntent - gerar intent Pix via Pagar.me
- [x] payment.getStatus - obter status do pagamento
- [x] payment.refund - processar reembolso
- [ ] POST /webhook/pagarme - receber notificações de pagamento

### Integração Pagar.me
- [x] Serviço pagarmeService implementado
- [x] Criar charges Pix com QR Code
- [x] Obter status de charges
- [x] Processar reembolsos
- [ ] Webhook para notificações (PAID, REFUNDED)
- [ ] Validação de assinatura de webhook

### Tunnel & Webhook
- [ ] Configurar ngrok para receber callbacks
- [ ] Endpoint webhook para processar eventos
- [ ] Processar eventos de pagamento

## Frontend

### Páginas
- [x] Home/Landing com navegação
- [x] Criar Rateio (formulário com validações)
- [x] Confirmação e Compartilhamento (slug + botões)
- [x] Participante (captura Pix + QR Code)
- [x] Status/Progresso (polling com auto-refresh)
- [x] Histórico de rateios (timeline de eventos)

### Componentes
- [x] FormulárioRateio com validações inline
- [x] QRCodeDisplay (renderizar SVG)
- [ ] ProgressBar com milestones (25/50/75/100%)
- [ ] Toast notifications (sucesso/erro/expiração)
- [ ] Modal de confirmação
- [x] PixKeyInput com autodetect de tipo

## Testes & Validação

### Teste MVP: "Chá de Fralda"
- [ ] Criar rateio "Chá de Fralda" com valor total R$ 500
- [ ] Adicionar 3 participantes com chaves Pix válidas
- [ ] Gerar QR Pix para cada um via Pagar.me
- [ ] Simular pagamentos via Pagar.me sandbox
- [ ] Validar liquidação automática ao 100%
- [ ] Verificar histórico e eventos
- [ ] Testar polling e auto-refresh na página de status

### Testes Funcionais
- [ ] Validação de chaves Pix (EVP, CPF, CNPJ, email, telefone)
- [ ] Privacidade Parcial (criador vê tudo, participante vê só sua contribuição)
- [ ] Privacidade Total (sem nomes, apenas P#01, P#02)
- [ ] Expiração de intent e retry
- [ ] Tratamento de erros PSP
- [ ] Reembolsos automáticos
- [ ] Webhook de notificação de pagamento

## Documentação & Deploy

- [ ] README com instruções de setup
- [ ] Variáveis de ambiente (.env.example)
- [ ] Instruções para ngrok
- [ ] Guia de testes com Pagar.me sandbox
- [ ] Deploy checklist
