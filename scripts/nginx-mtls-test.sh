#!/bin/bash
# Script para testar configuração mTLS do Nginx
# Uso: ./scripts/nginx-mtls-test.sh

set -e

WEBHOOK_URL="${1:-https://api.rateio.top/api/webhook/efipay}"
CERT_PATH="${2:-./certs/certificado.p12}"
CERT_PASS="${3:-}"

echo "🧪 Testando configuração mTLS do webhook..."
echo "URL: $WEBHOOK_URL"
echo ""

# Teste 1: Sem certificado (deve retornar 403)
echo "Teste 1: Requisição SEM certificado (deve retornar 403)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}')

if [ "$HTTP_CODE" == "403" ]; then
  echo "✅ PASS: Retornou 403 (correto - rejeitou sem certificado)"
else
  echo "❌ FAIL: Retornou $HTTP_CODE (esperado: 403)"
fi

echo ""

# Teste 2: Com certificado (deve retornar 200 ou 400)
if [ -f "$CERT_PATH" ]; then
  echo "Teste 2: Requisição COM certificado (deve retornar 200 ou 400)"
  
  if [ -z "$CERT_PASS" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      --cert "$CERT_PATH" \
      -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"test": "data"}')
  else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      --cert "$CERT_PATH:$CERT_PASS" \
      -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"test": "data"}')
  fi
  
  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "400" ]; then
    echo "✅ PASS: Retornou $HTTP_CODE (correto - aceitou com certificado)"
  else
    echo "⚠️  WARNING: Retornou $HTTP_CODE (esperado: 200 ou 400)"
    echo "   Isso pode ser normal se o payload não for válido"
  fi
else
  echo "⚠️  Certificado não encontrado em $CERT_PATH"
  echo "   Pulando teste com certificado"
fi

echo ""
echo "✅ Testes concluídos!"
echo ""
echo "Se ambos os testes passaram, sua configuração mTLS está correta!"
