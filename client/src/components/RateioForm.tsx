import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface RateioFormProps {
  onSuccess?: (rateioId: string, slug: string) => void;
}

export default function RateioForm({ onSuccess }: RateioFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    totalAmount: "",
    privacyMode: "PARCIAL" as const,
    expiresAt: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const createRateio = trpc.rateio.create.useMutation();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome do rateio é obrigatório";
    } else if (formData.name.length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    } else if (formData.name.length > 60) {
      newErrors.name = "Nome não pode exceder 60 caracteres";
    }

    if (!formData.totalAmount) {
      newErrors.totalAmount = "Valor total é obrigatório";
    } else {
      const amount = parseFloat(formData.totalAmount);
      if (isNaN(amount) || amount < 0.01) {
        newErrors.totalAmount = "Valor deve ser maior que R$ 0,01";
      }
    }

    if (formData.description && formData.description.length > 140) {
      newErrors.description = "Descrição não pode exceder 140 caracteres";
    }

    if (formData.expiresAt) {
      const expiresDate = new Date(formData.expiresAt);
      const now = new Date();
      const diffMinutes = (expiresDate.getTime() - now.getTime()) / (1000 * 60);
      if (diffMinutes < 15) {
        newErrors.expiresAt = "Prazo deve ser pelo menos 15 minutos no futuro";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const totalAmountCents = Math.round(parseFloat(formData.totalAmount) * 100);

      const result = await createRateio.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
        totalAmount: totalAmountCents,
        privacyMode: formData.privacyMode,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : undefined,
      });

      onSuccess?.(result.id, result.slug);
    } catch (error: any) {
      setErrors({
        submit: error.message || "Erro ao criar rateio",
      });
    }
  };

  const isFormValid = formData.name.trim() && formData.totalAmount && !createRateio.isPending;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Criar Novo Rateio</CardTitle>
        <CardDescription>
          Configure os detalhes do seu rateio e convide participantes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome do Rateio <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ex: Chá de Fralda da Maria"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/60 caracteres
            </p>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva o evento ou causa do rateio"
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (errors.description) setErrors({ ...errors, description: "" });
              }}
              className={errors.description ? "border-red-500" : ""}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/140 caracteres
            </p>
          </div>

          {/* Valor Total */}
          <div className="space-y-2">
            <Label htmlFor="totalAmount">
              Valor Total (R$) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="totalAmount"
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              value={formData.totalAmount}
              onChange={(e) => {
                setFormData({ ...formData, totalAmount: e.target.value });
                if (errors.totalAmount) setErrors({ ...errors, totalAmount: "" });
              }}
              className={errors.totalAmount ? "border-red-500" : ""}
            />
            {errors.totalAmount && (
              <p className="text-sm text-red-500">{errors.totalAmount}</p>
            )}
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label htmlFor="expiresAt">Prazo (opcional)</Label>
            <Input
              id="expiresAt"
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => {
                setFormData({ ...formData, expiresAt: e.target.value });
                if (errors.expiresAt) setErrors({ ...errors, expiresAt: "" });
              }}
              className={errors.expiresAt ? "border-red-500" : ""}
            />
            {errors.expiresAt && (
              <p className="text-sm text-red-500">{errors.expiresAt}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Mínimo de 15 minutos no futuro
            </p>
          </div>

          {/* Privacidade */}
          <div className="space-y-3">
            <Label>Modo de Privacidade</Label>
            <RadioGroup value={formData.privacyMode} onValueChange={(value: any) => {
              setFormData({ ...formData, privacyMode: value });
            }}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PARCIAL" id="privacy-parcial" />
                <Label htmlFor="privacy-parcial" className="font-normal cursor-pointer">
                  <span className="font-semibold">Parcial (padrão)</span> - Criador vê nomes e valores; participantes veem apenas sua contribuição
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="TOTAL" id="privacy-total" />
                <Label htmlFor="privacy-total" className="font-normal cursor-pointer">
                  <span className="font-semibold">Total</span> - Sem nomes, apenas P#01, P#02, etc
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ABERTO" id="privacy-aberto" disabled />
                <Label htmlFor="privacy-aberto" className="font-normal cursor-pointer opacity-50">
                  <span className="font-semibold">Aberto</span> - Todos veem tudo (em desenvolvimento)
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Você só pode endurecer a privacidade (Parcial → Total), nunca relaxar
            </p>
          </div>

          {/* Erro de submit */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Botão Submit */}
          <Button
            type="submit"
            disabled={!isFormValid}
            className="w-full"
            size="lg"
          >
            {createRateio.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando rateio...
              </>
            ) : (
              "Criar Rateio"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
