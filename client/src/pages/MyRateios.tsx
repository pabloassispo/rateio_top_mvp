import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  Plus, 
  Users, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Eye,
  Calendar,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MyRateios() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const { data: rateios, isLoading: rateiossLoading, refetch } = trpc.rateio.getByCreator.useQuery(
    undefined,
    { enabled: isAuthenticated, refetchInterval: 10000 }
  );

  if (loading || rateiossLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acesso Restrito</h1>
          <p className="text-muted-foreground mb-6">
            Você precisa estar autenticado para ver seus rateios
          </p>
          <Button onClick={() => setLocation("/")}>Voltar para Home</Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ATIVO":
        return <Badge variant="default" className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />Ativo</Badge>;
      case "CONCLUIDO":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
      case "CANCELADO":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true, locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meus Rateios</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie e acompanhe todos os seus rateios
              </p>
            </div>
            <Button
              onClick={() => setLocation("/create")}
              className="bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Criar Novo Rateio
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {rateios && rateios.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total de Rateios</CardDescription>
                <CardTitle className="text-3xl">{rateios.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Rateios Ativos</CardDescription>
                <CardTitle className="text-3xl text-blue-600">
                  {rateios.filter((r) => r.status === "ATIVO").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Rateios Concluídos</CardDescription>
                <CardTitle className="text-3xl text-green-600">
                  {rateios.filter((r) => r.status === "CONCLUIDO").length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Rateios List */}
        {!rateios || rateios.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum rateio criado ainda</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Comece criando seu primeiro rateio para dividir despesas com amigos e familiares
              </p>
              <Button
                onClick={() => setLocation("/create")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Rateio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rateios.map((rateio) => (
              <Card 
                key={rateio.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setLocation(`/rateio/${rateio.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{rateio.name}</CardTitle>
                        {getStatusBadge(rateio.status)}
                      </div>
                      {rateio.description && (
                        <CardDescription className="text-sm">
                          {rateio.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    {rateio.status === "ATIVO" && rateio.progress && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-semibold">
                            {formatCurrency(rateio.progress.paidAmount)} / {formatCurrency(rateio.totalAmount)}
                          </span>
                        </div>
                        <Progress value={rateio.progress.progress} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{rateio.progress.progress.toFixed(1)}% completo</span>
                          {rateio.progress.isPaid && (
                            <span className="text-green-600 font-semibold">✓ Meta atingida!</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Valor Total</p>
                          <p className="font-semibold">{formatCurrency(rateio.totalAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Participantes</p>
                          <p className="font-semibold">{rateio.participantCount || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Privacidade</p>
                          <p className="font-semibold text-xs">{rateio.privacyMode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Criado</p>
                          <p className="font-semibold text-xs">{formatDate(rateio.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/rateio/${rateio.id}`);
                        }}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/rateio/${rateio.id}/status`);
                        }}
                        className="flex-1"
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        Ver Status
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
