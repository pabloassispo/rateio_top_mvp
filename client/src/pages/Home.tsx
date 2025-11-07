import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Plus, Share2 } from "lucide-react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8" />}
            <h1 className="text-2xl font-bold text-gray-900">{APP_TITLE}</h1>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-600">Olá, {user?.name || "Usuário"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logout()}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Rateios Simplificados
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Crie rateios, compartilhe links e receba pagamentos via Pix de forma segura e automática
          </p>
          {isAuthenticated ? (
            <Button
              size="lg"
              onClick={() => setLocation("/create")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Criar Novo Rateio
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Entrar para Começar
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Criar Rateio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Defina o valor total, privacidade e convide participantes com um link único
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-green-600" />
                Compartilhar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Envie o link via WhatsApp, email ou qualquer outro canal para seus amigos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Pagar com Pix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Participantes geram QR Code e pagam via Pix. Liquidação automática ao 100%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
            <CardDescription>
              Siga estes passos simples para criar seu primeiro rateio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 list-decimal list-inside">
              <li className="text-gray-700">
                <span className="font-semibold">Crie um rateio</span> com nome, valor total e modo de privacidade
              </li>
              <li className="text-gray-700">
                <span className="font-semibold">Compartilhe o link</span> familyos.link/id com os participantes
              </li>
              <li className="text-gray-700">
                <span className="font-semibold">Participantes adicionam chave Pix</span> e geram QR Code
              </li>
              <li className="text-gray-700">
                <span className="font-semibold">Pagamentos são processados</span> conforme contribuem
              </li>
              <li className="text-gray-700">
                <span className="font-semibold">Ao atingir 100%</span>, liquidação automática é iniciada
              </li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
