import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/UserAvatar";
import { getUserDisplayName } from "@/lib/userUtils";
import { ArrowLeft, QrCode, Send, Loader2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function RateioDetails() {
  const [, params] = useRoute("/rateio/:id");
  const [, setLocation] = useLocation();
  const rateioId = params?.id;
  const { user } = useAuth();
  const [isTransferring, setIsTransferring] = useState(false);

  const utils = trpc.useUtils();
  const { data: rateio, isLoading: rateioLoading } = trpc.rateio.getById.useQuery(
    { id: rateioId! },
    { enabled: !!rateioId, refetchInterval: 5000 }
  );

  const { data: participants } = trpc.participant.getByRateio.useQuery(
    { rateioId: rateioId! },
    { enabled: !!rateioId, refetchInterval: 5000 }
  );

  const transferMutation = trpc.payment.transferToCreator.useMutation({
    onSuccess: (data) => {
      toast.success(`Transferência de R$ ${(data.amount / 100).toFixed(2)} realizada com sucesso!`, {
        description: `e2eId: ${data.e2eId}`,
        duration: 5000,
      });
      utils.rateio.getById.invalidate({ id: rateioId! });
      setIsTransferring(false);
    },
    onError: (error) => {
      toast.error("Erro ao solicitar transferência", {
        description: error.message,
        duration: 5000,
      });
      setIsTransferring(false);
    },
  });

  const handleContribute = () => {
    if (!rateioId) return;
    // Redirect to participate page to collect pix key and generate QR code
    setLocation(`/rateio/${rateioId}/participate`);
  };

  const handleTransferToCreator = async () => {
    if (!rateioId) return;
    
    setIsTransferring(true);
    toast.info("Solicitando transferência...", {
      description: "Isso pode levar alguns segundos",
    });

    transferMutation.mutate({ rateioId });
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

  const paidAmount = rateio.progress?.paidAmount || 0;
  const targetAmount = rateio.targetAmount || rateio.totalAmount;
  const progress = targetAmount > 0 ? (paidAmount / targetAmount) * 100 : 0;
  const progressPercentage = Math.min(Math.round(progress), 100);

  // Filter participants who have contributed (paidAmount > 0)
  const contributors = (participants || []).filter(p => (p.paidAmount || 0) > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
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
          <h1 className="text-3xl font-bold text-gray-900">{rateio.name}</h1>
          {rateio.description && (
            <p className="text-gray-600 mt-2">{rateio.description}</p>
          )}
        </div>

        {/* QR Code Section */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900 flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Contribua para este Rateio
            </CardTitle>
            <CardDescription>
              Clique no botão abaixo para adicionar sua chave Pix e gerar o QR Code de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleContribute}
              className="w-full"
              size="lg"
              variant="default"
            >
              <QrCode className="mr-2 h-5 w-5" />
              Contribuir Agora
            </Button>
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Você será redirecionado para adicionar sua chave Pix e gerar o QR Code de pagamento
            </p>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Progresso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Meta</p>
                <p className="text-sm font-bold text-blue-600">{progressPercentage}%</p>
              </div>
              <Progress value={progressPercentage} className="h-4" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>R$ {((paidAmount || 0) / 100).toFixed(2)}</span>
                <span className="font-semibold">R$ {((targetAmount || 0) / 100).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transfer to Creator Section - Only visible when goal is met and user is creator */}
        {rateio.progress?.isPaid && 
         user?.id === rateio.creatorId && 
         rateio.status !== "CONCLUIDO" && (
          <Card className="mb-6 border-green-500 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader>
              <CardTitle className="text-green-900 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Meta Atingida! 🎉
              </CardTitle>
              <CardDescription className="text-green-800">
                Parabéns! O rateio atingiu 100% da meta. Você pode solicitar a transferência do valor para sua chave Pix.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/60 p-4 rounded-lg border border-green-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Valor Total Arrecadado:</span>
                  <span className="text-2xl font-bold text-green-600">
                    R$ {((rateio.progress?.paidAmount || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Este valor será transferido para a sua chave Pix cadastrada
                </p>
              </div>

              <Button
                onClick={handleTransferToCreator}
                disabled={isTransferring || transferMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
                size="lg"
              >
                {isTransferring || transferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando Transferência...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Solicitar Transferência
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                A transferência será processada via Pix e pode levar alguns segundos para ser concluída
              </p>
            </CardContent>
          </Card>
        )}

        {/* Completed Status - Only visible when rateio is completed */}
        {rateio.status === "CONCLUIDO" && user?.id === rateio.creatorId && (
          <Card className="mb-6 border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardHeader>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
                Rateio Concluído
              </CardTitle>
              <CardDescription className="text-blue-800">
                A transferência foi realizada com sucesso! Verifique sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white/60 p-4 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Valor Transferido:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    R$ {((rateio.progress?.paidAmount || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contributors List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Contribuidores {contributors.length > 0 && `(${contributors.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contributors.length > 0 ? (
              <div className="space-y-3">
                {contributors.map((participant) => {
                  const displayName = participant.user
                    ? getUserDisplayName(participant.user)
                    : participant.pixKey?.split("@")[0] || "Anônimo";
                  
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={participant.user || undefined}
                          email={participant.pixKey}
                          size="md"
                        />
                        <div>
                          <p className="font-semibold">{displayName}</p>
                          {participant.user?.email && (
                            <p className="text-sm text-muted-foreground">
                              {participant.user.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-green-600">
                          R$ {((participant.paidAmount || 0) / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {participant.status === "PAGO" ? "Pago" : "Pendente"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum contribuidor ainda.</p>
                <p className="text-sm mt-2">Seja o primeiro a contribuir!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

