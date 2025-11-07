import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function RateioStatus() {
  const [, params] = useRoute("/rateio/:id/status");
  const [, setLocation] = useLocation();
  const rateioId = params?.id;

  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: rateio, isLoading, refetch } = trpc.rateio.getById.useQuery(
    { id: rateioId! },
    { enabled: !!rateioId, refetchInterval: autoRefresh ? 3000 : false }
  );

  const { data: participants } = trpc.participant.getByRateio.useQuery(
    { rateioId: rateioId! },
    { enabled: !!rateioId, refetchInterval: autoRefresh ? 3000 : false }
  );

  // Events will be fetched from the rateio data
  const events = rateio?.events || [];

  if (isLoading) {
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
  const progress = rateio.totalAmount > 0 ? (paidAmount / rateio.totalAmount) * 100 : 0;
  const progressPercentage = Math.round(progress);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAGO":
        return "text-green-600";
      case "PENDENTE":
        return "text-yellow-600";
      case "REEMBOLSADO":
        return "text-blue-600";
      case "FALHOU":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAGO":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "PENDENTE":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "REEMBOLSADO":
        return <CheckCircle2 className="h-5 w-5 text-blue-600" />;
      case "FALHOU":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Status do Rateio</h1>
        </div>

        {/* Rateio Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{rateio.name}</CardTitle>
            {rateio.description && (
              <CardDescription>{rateio.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {((rateio.totalAmount || 0) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Pago</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {((paidAmount || 0) / 100).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Progresso</p>
                <p className="text-sm font-bold text-blue-600">{progressPercentage}%</p>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
                {rateio.status === "CONCLUIDO" ? "Concluído" : "Em Andamento"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Participants List */}
        {participants && participants.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Participantes ({participants.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {participants.map((participant, index) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(participant.status)}
                      <div>
                        <p className="font-semibold">
                          {rateio.privacyMode === "TOTAL" ? `P#${index + 1}` : "Participante"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {participant.pixKey}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        R$ {((participant.paidAmount || 0) / 100).toFixed(2)}
                      </p>
                      <p className={`text-sm ${getStatusColor(participant.status)}`}>
                        {participant.status === "PAGO"
                          ? "Pago"
                          : participant.status === "PENDENTE"
                          ? "Pendente"
                          : participant.status === "REEMBOLSADO"
                          ? "Reembolsado"
                          : "Falhou"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events Timeline */}
        {events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((event: any, index: number) => (
                    <div
                      key={event.id}
                      className="flex gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                          <span className="text-xs font-semibold text-blue-600">{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auto Refresh Toggle */}
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Agora
          </Button>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
          >
            {autoRefresh ? "Auto-atualização: Ativa" : "Auto-atualização: Inativa"}
          </Button>
        </div>
      </div>
    </div>
  );
}
