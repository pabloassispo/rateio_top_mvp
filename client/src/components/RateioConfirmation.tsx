import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Copy, Share2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RateioConfirmationProps {
  rateioId: string;
  slug: string;
  onCreateAnother?: () => void;
}

export default function RateioConfirmation({
  rateioId,
  slug,
  onCreateAnother,
}: RateioConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const { data: rateio, isLoading } = trpc.rateio.getById.useQuery({ id: rateioId });

  const fullLink = `${window.location.origin}/rateio/${rateioId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: rateio?.name || "Rateio",
          text: `Participe do rateio: ${rateio?.name}`,
          url: fullLink,
        });
      } catch (error) {
        console.log("Share cancelled or failed");
      }
    } else {
      handleCopyLink();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Rateio criado com sucesso!</p>
              <p className="text-sm text-green-700">
                Compartilhe o link abaixo para convidar participantes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rateio Details */}
      <Card>
        <CardHeader>
          <CardTitle>{rateio?.name}</CardTitle>
          {rateio?.description && (
            <CardDescription>{rateio.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold">
                R$ {((rateio?.totalAmount || 0) / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Privacidade</p>
              <p className="text-lg font-semibold">
                {rateio?.privacyMode === "PARCIAL"
                  ? "Parcial"
                  : rateio?.privacyMode === "TOTAL"
                  ? "Total"
                  : "Aberto"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compartilhar Rateio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Link do Rateio</label>
            <div className="flex gap-2">
              <Input
                value={fullLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Link copiado!
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Slug (familyos.link)</label>
            <div className="flex gap-2">
              <Input
                value={`familyos.link/${rateioId}`}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(`familyos.link/${rateioId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleShare}
              className="w-full"
              size="lg"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
            <Button
              onClick={onCreateAnother}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Novo Rateio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximos Passos</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 list-decimal list-inside">
            <li className="text-sm">
              <span className="font-semibold">Compartilhe o link</span> com os participantes via WhatsApp, email ou outro canal
            </li>
            <li className="text-sm">
              <span className="font-semibold">Participantes adicionam suas chaves Pix</span> e geram o QR Code
            </li>
            <li className="text-sm">
              <span className="font-semibold">Pagamentos são processados</span> conforme os participantes contribuem
            </li>
            <li className="text-sm">
              <span className="font-semibold">Ao atingir 100%</span>, a liquidação automática é iniciada
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
