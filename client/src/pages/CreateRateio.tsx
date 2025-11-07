import { useState } from "react";
import { useLocation } from "wouter";
import RateioForm from "@/components/RateioForm";
import RateioConfirmation from "@/components/RateioConfirmation";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CreateRateio() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [createdRateio, setCreatedRateio] = useState<{
    id: string;
    slug: string;
  } | null>(null);

  if (loading) {
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
            Você precisa estar autenticado para criar um rateio
          </p>
          <Button onClick={() => setLocation("/")}>Voltar para Home</Button>
        </div>
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
          <h1 className="text-3xl font-bold text-gray-900">
            {createdRateio ? "Rateio Criado!" : "Novo Rateio"}
          </h1>
        </div>

        {/* Content */}
        {createdRateio ? (
          <RateioConfirmation
            rateioId={createdRateio.id}
            slug={createdRateio.slug}
            onCreateAnother={() => setCreatedRateio(null)}
          />
        ) : (
          <RateioForm
            onSuccess={(id, slug) => {
              setCreatedRateio({ id, slug });
            }}
          />
        )}
      </div>
    </div>
  );
}
