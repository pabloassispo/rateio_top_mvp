import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCPF, maskPhone, unmaskCPF, unmaskPhone, validateCPF, validatePhone } from "@/lib/masks";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface CompleteProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  onComplete: () => void;
  requirePixKey?: boolean; // Se true, exige chave Pix (para criação de rateio)
}

type PixKeyType = "EVP" | "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | null;

function detectPixKeyType(key: string): PixKeyType {
  if (!key) return null;

  // EVP: UUID format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return "EVP";
  }
  // CPF: 11 digits
  if (/^\d{11}$/.test(key)) {
    return "CPF";
  }
  // CNPJ: 14 digits
  if (/^\d{14}$/.test(key)) {
    return "CNPJ";
  }
  // EMAIL
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
    return "EMAIL";
  }
  // TELEFONE: 10-11 digits
  if (/^\d{10,11}$/.test(key)) {
    return "TELEFONE";
  }

  return null;
}

function validatePixKey(key: string, type: PixKeyType): boolean {
  if (!type) return false;

  switch (type) {
    case "EVP":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    case "CPF":
      return /^\d{11}$/.test(key);
    case "CNPJ":
      return /^\d{14}$/.test(key);
    case "EMAIL":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case "TELEFONE":
      return /^\d{10,11}$/.test(key);
    default:
      return false;
  }
}

export default function CompleteProfileModal({
  open,
  onOpenChange,
  message,
  onComplete,
  requirePixKey = false,
}: CompleteProfileModalProps) {
  const { user } = useAuth();
  const [cpf, setCpf] = useState("");
  const [contato, setContato] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>(null);
  const [errors, setErrors] = useState<{ cpf?: string; contato?: string; pixKey?: string }>({});

  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Perfil atualizado com sucesso!");
      await utils.auth.me.invalidate();
      await utils.auth.me.refetch();
      onComplete();
      onOpenChange(false);
      // Reset form
      setCpf("");
      setContato("");
      setPixKey("");
      setPixKeyType(null);
      setErrors({});
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar perfil");
    },
  });

  // Load existing pix key if user has one
  const { data: existingPixKey } = trpc.auth.getPixKey.useQuery(undefined, {
    enabled: open && requirePixKey && !!user,
  });

  useEffect(() => {
    if (open && existingPixKey?.pixKey) {
      setPixKey(existingPixKey.pixKey);
      setPixKeyType(existingPixKey.pixKeyType as PixKeyType);
    } else if (open && !existingPixKey) {
      // Reset when modal opens and no existing key
      setPixKey("");
      setPixKeyType(null);
    }
  }, [existingPixKey, open]);

  useEffect(() => {
    if (pixKey) {
      const type = detectPixKeyType(pixKey);
      setPixKeyType(type);
      if (errors.pixKey && type && validatePixKey(pixKey, type)) {
        setErrors({ ...errors, pixKey: undefined });
      }
    }
  }, [pixKey, errors.pixKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { cpf?: string; contato?: string; pixKey?: string } = {};
    
    const cpfNumbers = unmaskCPF(cpf);
    if (!cpfNumbers || cpfNumbers.length !== 11) {
      newErrors.cpf = "CPF deve ter 11 dígitos";
    } else if (!validateCPF(cpf)) {
      newErrors.cpf = "CPF inválido";
    }

    const contatoNumbers = unmaskPhone(contato);
    if (!contatoNumbers || (contatoNumbers.length !== 10 && contatoNumbers.length !== 11)) {
      newErrors.contato = "Telefone deve ter 10 ou 11 dígitos";
    } else if (!validatePhone(contato)) {
      newErrors.contato = "Telefone inválido";
    }

    // Validate Pix key if required
    if (requirePixKey) {
      if (!pixKey || !pixKeyType) {
        newErrors.pixKey = "Chave Pix é obrigatória";
      } else if (!validatePixKey(pixKey, pixKeyType)) {
        newErrors.pixKey = "Chave Pix inválida";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updateData: { cpf: string; contato: string; pixKey?: string; pixKeyType?: string } = {
      cpf: cpfNumbers,
      contato: contatoNumbers,
    };

    if (requirePixKey && pixKey && pixKeyType) {
      updateData.pixKey = pixKey;
      updateData.pixKeyType = pixKeyType;
    }

    updateProfileMutation.mutate(updateData);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPF(e.target.value);
    setCpf(masked);
    if (errors.cpf) {
      setErrors({ ...errors, cpf: undefined });
    }
  };

  const handleContatoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhone(e.target.value);
    setContato(masked);
    if (errors.contato) {
      setErrors({ ...errors, contato: undefined });
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setCpf("");
      setContato("");
      setPixKey("");
      setPixKeyType(null);
      setErrors({});
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Finalizar Cadastro</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={handleCpfChange}
                maxLength={14}
                disabled={updateProfileMutation.isPending}
                className={errors.cpf ? "border-red-500" : ""}
              />
              {errors.cpf && (
                <p className="text-sm text-red-500">{errors.cpf}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contato">Contato</Label>
              <Input
                id="contato"
                placeholder="(00) 00000-0000"
                value={contato}
                onChange={handleContatoChange}
                maxLength={15}
                disabled={updateProfileMutation.isPending}
                className={errors.contato ? "border-red-500" : ""}
              />
              {errors.contato && (
                <p className="text-sm text-red-500">{errors.contato}</p>
              )}
            </div>
            {requirePixKey && (
              <div className="grid gap-2">
                <Label htmlFor="pixKey">
                  Chave Pix <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="pixKey"
                    placeholder="Digite sua chave Pix (CPF, CNPJ, email, telefone ou EVP)"
                    value={pixKey}
                    onChange={(e) => {
                      setPixKey(e.target.value);
                      if (errors.pixKey) {
                        setErrors({ ...errors, pixKey: undefined });
                      }
                    }}
                    disabled={updateProfileMutation.isPending}
                    className={errors.pixKey ? "border-red-500" : pixKeyType && validatePixKey(pixKey, pixKeyType) ? "border-green-500" : ""}
                  />
                  {pixKeyType && validatePixKey(pixKey, pixKeyType) && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                  )}
                  {errors.pixKey && (
                    <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                  )}
                </div>
                {pixKey && (
                  <div className="text-sm">
                    {pixKeyType ? (
                      <div className={validatePixKey(pixKey, pixKeyType) ? "text-green-600" : "text-amber-600"}>
                        <p className="font-semibold">
                          {pixKeyType === "EVP" && "Chave Aleatória (EVP)"}
                          {pixKeyType === "CPF" && "CPF"}
                          {pixKeyType === "CNPJ" && "CNPJ"}
                          {pixKeyType === "EMAIL" && "E-mail"}
                          {pixKeyType === "TELEFONE" && "Telefone"}
                        </p>
                      </div>
                    ) : (
                      <div className="text-red-600">
                        <p className="font-semibold">Tipo de chave não identificado</p>
                      </div>
                    )}
                  </div>
                )}
                {errors.pixKey && (
                  <p className="text-sm text-red-500">{errors.pixKey}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateProfileMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

