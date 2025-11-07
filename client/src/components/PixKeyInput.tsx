import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PixKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  autoRefund: boolean;
  onAutoRefundChange: (value: boolean) => void;
  error?: string;
  disabled?: boolean;
}

type PixKeyType = "EVP" | "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | null;

const pixKeyTypeLabels: Record<string, string> = {
  EVP: "Chave Aleatória (EVP)",
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
};

const pixKeyTypeDescriptions: Record<string, string> = {
  EVP: "UUID aleatória (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
  CPF: "11 dígitos (sem pontos ou traços)",
  CNPJ: "14 dígitos (sem pontos ou traços)",
  EMAIL: "Endereço de e-mail válido",
  TELEFONE: "10 ou 11 dígitos (sem espaços ou parênteses)",
};

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

export default function PixKeyInput({
  value,
  onChange,
  autoRefund,
  onAutoRefundChange,
  error,
  disabled = false,
}: PixKeyInputProps) {
  const [detectedType, setDetectedType] = useState<PixKeyType>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const type = detectPixKeyType(value);
    setDetectedType(type);
    setIsValid(type ? validatePixKey(value, type) : false);
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Chave Pix Input */}
      <div className="space-y-2">
        <Label htmlFor="pixKey">
          Chave Pix <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Input
            id="pixKey"
            placeholder="Digite sua chave Pix (CPF, CNPJ, email, telefone ou EVP)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`${
              error ? "border-red-500" : isValid ? "border-green-500" : ""
            }`}
          />
          {isValid && (
            <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-500" />
          )}
          {error && (
            <AlertCircle className="absolute right-3 top-3 h-5 w-5 text-red-500" />
          )}
        </div>

        {/* Type Detection */}
        {value && (
          <div className="text-sm">
            {detectedType ? (
              <div className={isValid ? "text-green-600" : "text-amber-600"}>
                <p className="font-semibold">{pixKeyTypeLabels[detectedType] || "Tipo desconhecido"}</p>
                <p className="text-xs opacity-75">{pixKeyTypeDescriptions[detectedType] || ""}</p>
              </div>
            ) : (
              <div className="text-red-600">
                <p className="font-semibold">Tipo de chave não identificado</p>
                <p className="text-xs opacity-75">
                  Verifique o formato e tente novamente
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}
      </div>

      {/* Auto Refund Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="autoRefund"
          checked={autoRefund}
          onCheckedChange={(checked) => onAutoRefundChange(checked as boolean)}
          disabled={disabled}
        />
        <Label htmlFor="autoRefund" className="font-normal cursor-pointer">
          Quero reembolso automático se desistir antes do encerramento
        </Label>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Dica:</span> Sua chave Pix será usada para receber o reembolso automático se o rateio for cancelado.
        </p>
      </div>
    </div>
  );
}
