import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import PixKeyInput from "@/components/PixKeyInput";
import { trpc } from "@/lib/trpc";

export default function ParticipateRateio() {
  const [, params] = useRoute("/rateio/:id/participate");
  const [, setLocation] = useLocation();
  const rateioId = params?.id;

  const [pixKey, setPixKey] = useState("");
  const [autoRefund, setAutoRefund] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [contributionAmount, setContributionAmount] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copyPaste, setCopyPaste] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const { data: rateio, isLoading: rateioLoading } = trpc.rateio.getById.useQuery(
    { id: rateioId! },
    { enabled: !!rateioId }
  );

  const createParticipant = trpc.participant.create.useMutation();
  const createIntent = trpc.payment.createIntent.useMutation();

  const handleCreateParticipant = async () => {
    if (!termsAccepted) {
      setError("Você deve aceitar os termos para continuar");
      return;
    }

    // Validate contribution amount
    const amountInCents = contributionAmount ? Math.round(parseFloat(contributionAmount) * 100) : null;
    const totalAmount = rateio?.totalAmount || 0;

    if (amountInCents && amountInCents > totalAmount) {
      setError(`O valor da contribuição não pode ser maior que R$ ${(totalAmount / 100).toFixed(2)}`);
      return;
    }

    if (amountInCents && amountInCents <= 0) {
      setError("O valor da contribuição deve ser maior que zero");
      return;
    }

    try {
      const result = await createParticipant.mutateAsync({
        rateioId: rateioId!,
        pixKey,
        autoRefund,
      });

      setParticipantId(result.id);

      // Create payment intent with contribution amount
      const intentResult = await createIntent.mutateAsync({
        participantId: result.id,
        amount: amountInCents || undefined,
      });

      setPaidAmount(amountInCents || rateio?.totalAmount || null);
      setQrCode(intentResult.qrCode || null);
      setCopyPaste(intentResult.copyPaste || null);
    } catch (err: any) {
      setError(err.message || "Erro ao processar participante");
    }
  };

  const handleCopyPaste = () => {
    if (copyPaste) {
      navigator.clipboard.writeText(copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (rateioLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!rateio) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-red-600 mb-4">Rateio não encontrado</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Voltar para Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Participar do Rateio</h1>
        </div>

        {/* Rateio Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{rateio.name}</CardTitle>
            {rateio.description && (
              <CardDescription>{rateio.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {((rateio.totalAmount || 0) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Privacidade</p>
                <p className="text-lg font-semibold">
                  {rateio.privacyMode === "PARCIAL"
                    ? "Parcial"
                    : rateio.privacyMode === "TOTAL"
                    ? "Total"
                    : "Aberto"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code Display */}
        {qrCode && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-900">QR Code Gerado!</CardTitle>
              {paidAmount && (
                <CardDescription className="text-green-800">
                  Valor a pagar: <span className="font-bold">R$ {(paidAmount / 100).toFixed(2)}</span>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code Image */}
              <div className="flex justify-center p-4 bg-white rounded-lg border border-green-200">
                {qrCode ? (
                  qrCode.startsWith("<svg") ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: qrCode }}
                      className="w-64 h-64"
                    />
                  ) : (
                    <img 
                      src={qrCode} 
                      alt="QR Code Pix" 
                      className="w-64 h-64 object-contain"
                      onError={(e) => {
                        console.error("Failed to load QR code image:", qrCode);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )
                ) : null}
              </div>

              {/* Copy and Paste */}
              {copyPaste && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Copia e Cola</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={copyPaste}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-md font-mono text-xs bg-white"
                    />
                    <Button
                      onClick={handleCopyPaste}
                      variant="outline"
                      size="icon"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Copiado!
                    </p>
                  )}
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Próximos passos:</span>
                </p>
                <ol className="text-sm text-blue-900 list-decimal list-inside mt-2">
                  <li>Abra seu app de banco ou Pix</li>
                  <li>Escaneie o QR Code ou cole o código</li>
                  <li>Confirme o pagamento</li>
                </ol>
              </div>

              <Button
                onClick={() => setLocation(`/rateio/${rateioId}/status`)}
                className="w-full"
                size="lg"
              >
                Ver Status do Pagamento
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Participation Form */}
        {!qrCode && (
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Chave Pix</CardTitle>
              <CardDescription>
                Informe sua chave Pix para receber o reembolso automático se necessário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contribution Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="contributionAmount" className="text-sm font-semibold">
                  Valor da Contribuição (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    id="contributionAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={rateio ? (rateio.totalAmount / 100).toFixed(2) : undefined}
                    placeholder={`Máximo: ${rateio ? (rateio.totalAmount / 100).toFixed(2) : "0.00"}`}
                    value={contributionAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      const totalAmount = rateio?.totalAmount || 0;
                      const maxValue = totalAmount / 100;
                      
                      // Allow empty or valid number with max 2 decimal places
                      if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                        // If user typed a value, check if it exceeds maximum
                        if (value && !isNaN(parseFloat(value))) {
                          const numValue = parseFloat(value);
                          if (numValue > maxValue) {
                            // Auto-adjust to maximum value
                            setContributionAmount(maxValue.toFixed(2));
                            setError("");
                          } else {
                            setContributionAmount(value);
                            // Clear error when user starts typing
                            if (error && error.includes("valor da contribuição")) {
                              setError("");
                            }
                          }
                        } else {
                          setContributionAmount(value);
                          // Clear error when user starts typing
                          if (error && error.includes("valor da contribuição")) {
                            setError("");
                          }
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      const totalAmount = rateio?.totalAmount || 0;
                      if (e.target.value && !isNaN(value)) {
                        if (value * 100 > totalAmount) {
                          // Auto-adjust to maximum
                          const maxValue = (totalAmount / 100).toFixed(2);
                          setContributionAmount(maxValue);
                          setError("");
                        } else if (value <= 0) {
                          setError("O valor da contribuição deve ser maior que zero");
                        } else {
                          // Format to 2 decimal places
                          setContributionAmount(value.toFixed(2));
                          setError("");
                        }
                      }
                    }}
                    disabled={createParticipant.isPending || createIntent.isPending}
                    className="w-full pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para contribuir com o valor total do rateio (R$ {rateio ? (rateio.totalAmount / 100).toFixed(2) : "0.00"})
                </p>
              </div>

              {/* Pix Key Input */}
              <PixKeyInput
                value={pixKey}
                onChange={setPixKey}
                autoRefund={autoRefund}
                onAutoRefundChange={setAutoRefund}
                error={error && pixKey ? error : ""}
                disabled={createParticipant.isPending || createIntent.isPending}
              />

              {/* Terms Checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  disabled={createParticipant.isPending || createIntent.isPending}
                />
                <Label htmlFor="terms" className="font-normal cursor-pointer text-sm">
                  Eu li e aceito os{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    termos de privacidade
                  </a>{" "}
                  e entendo que minha chave Pix será usada para reembolso automático
                </Label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleCreateParticipant}
                disabled={
                  !pixKey || 
                  !termsAccepted || 
                  createParticipant.isPending || 
                  createIntent.isPending ||
                  (contributionAmount !== "" && (parseFloat(contributionAmount) <= 0 || parseFloat(contributionAmount) * 100 > (rateio?.totalAmount || 0)))
                }
                className="w-full"
                size="lg"
              >
                {createParticipant.isPending || createIntent.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  "Gerar QR Code Pix"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
