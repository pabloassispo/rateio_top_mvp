import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { ENV } from "./_core/env";

interface PagarmePixIntent {
  qr_code: string;
  qr_code_url: string;
  copy_and_paste: string;
  expires_at: string;
  id: string;
}

interface PagarmeCharge {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | "canceled";
  amount: number;
  pix_qr_code?: string;
  pix_copy_and_paste?: string;
  pix_expires_at?: string;
}

class PagarmeService {
  private client: AxiosInstance;
  private apiKey: string;
  private accountId: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = ENV.pagarmeApiKey || "";
    this.accountId = ENV.pagarmeAccountId || "";
    this.webhookSecret = ENV.pagarmeWebhookSecret || "";

    console.log("\n========== PAGAR.ME INITIALIZATION ==========");
    console.log("[Pagar.me] Raw ENV values:");
    console.log("  - PAGARME_API_KEY from ENV:", ENV.pagarmeApiKey ? `${ENV.pagarmeApiKey.substring(0, 20)}... (length: ${ENV.pagarmeApiKey.length})` : "EMPTY");
    console.log("  - PAGARME_ACCOUNT_ID from ENV:", ENV.pagarmeAccountId ? `${ENV.pagarmeAccountId.substring(0, 20)}... (length: ${ENV.pagarmeAccountId.length})` : "EMPTY");
    console.log("  - PAGARME_WEBHOOK_SECRET from ENV:", ENV.pagarmeWebhookSecret ? `${ENV.pagarmeWebhookSecret.substring(0, 20)}... (length: ${ENV.pagarmeWebhookSecret.length})` : "EMPTY");

    if (!this.apiKey || !this.accountId) {
      console.warn("[Pagar.me] ⚠️  Missing API credentials. Set PAGARME_API_KEY and PAGARME_ACCOUNT_ID");
    }

    // Check for public key instead of secret key (common mistake)
    if (this.apiKey.startsWith("pk_")) {
      console.error("\n🚨🚨🚨 CRITICAL ERROR 🚨🚨🚨");
      console.error("[Pagar.me] You're using a PUBLIC KEY (pk_...) instead of SECRET KEY (sk_...)!");
      console.error("[Pagar.me] Public keys are for client-side JavaScript only.");
      console.error("[Pagar.me] You MUST use the SECRET KEY (sk_test_... or sk_prod_...) for server-side API calls.");
      console.error("[Pagar.me] Go to: https://dashboard.pagar.me/ → Settings → API Keys → Copy the SECRET KEY");
      console.error("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n");
    }

    // Warn about placeholder credentials
    if (this.apiKey === "todo" || this.accountId === "todo" || 
        this.apiKey.includes("YOUR_KEY_HERE") || this.accountId.includes("YOUR_ACCOUNT_ID_HERE") ||
        this.apiKey.includes("YOUR_SECRET_KEY_HERE")) {
      console.error(
        "[Pagar.me] 🚨 PLACEHOLDER CREDENTIALS DETECTED! Replace with real API credentials from https://dashboard.pagar.me/"
      );
      console.error(
        "[Pagar.me] Get your API_KEY and ACCOUNT_ID from: Settings → API Keys → Test/Production"
      );
    }

    if (!this.webhookSecret || this.webhookSecret === "todo") {
      console.warn("[Pagar.me] ⚠️  Missing or placeholder webhook secret. Set PAGARME_WEBHOOK_SECRET to validate callbacks.");
    }

    const authHeader = `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
    console.log("[Pagar.me] Authorization header created (length):", authHeader.length);

    this.client = axios.create({
      baseURL: "https://api.pagar.me/core/v5",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    console.log("[Pagar.me] ✅ Initialized with baseURL:", "https://api.pagar.me/core/v5");
    console.log("[Pagar.me] API Key configured:", this.apiKey ? `${this.apiKey.substring(0, 15)}...` : "MISSING");
    console.log("[Pagar.me] Account ID configured:", this.accountId ? `${this.accountId.substring(0, 15)}...` : "MISSING");
    console.log("=============================================\n");
  }

  /**
   * Create a Pix charge with QR Code
   * @param amount Amount in cents (e.g., 10000 for R$ 100.00)
   * @param description Description for the charge
   * @param customer Customer data (name, email, document) or customer ID
   * @returns Charge with QR Code and copy-paste code
   */
  async createPixCharge(
    amount: number,
    description: string,
    customer?: { name: string; email: string; document?: string; document_type?: string; phones?: { mobile_phone?: { country_code: string; area_code: string; number: string }; home_phone?: { country_code: string; area_code: string; number: string } } } | string
  ): Promise<PagarmeCharge> {
    try {
      const payload: any = {
        amount,
        description,
        capture: true, // Auto-capture on payment
        payment: {
          payment_method: "pix",
          pix: {
            expires_in: 900, // 15 minutes in seconds
          },
        },
      };

      // Customer data is REQUIRED by Pagar.me API
      if (typeof customer === "string") {
        // If customer is a string, treat it as customer_id
        payload.customer_id = customer;
      } else if (customer) {
        // If customer is an object, use it directly
        // Only add default document/phones if not provided (for backward compatibility)
        payload.customer = {
          ...customer,
          document: customer.document || undefined, // Only add if provided
          document_type: customer.document_type || (customer.document ? "CPF" : undefined),
          type: customer.document_type === "CNPJ" ? "company" : "individual",
          phones: customer.phones || undefined, // Only add if provided
        };
        
        // Remove undefined fields to avoid sending them
        if (!payload.customer.document) {
          delete payload.customer.document;
          delete payload.customer.document_type;
        }
        if (!payload.customer.phones) {
          delete payload.customer.phones;
        }
      } else {
        // If no customer data provided, create a default one (fallback for unauthenticated users)
        payload.customer = {
          name: "Participante Rateio",
          email: "participante@rateio.top",
          document: "12345678909", // Mocked CPF - only used as fallback
          document_type: "CPF",
          type: "individual",
          phones: {
            mobile_phone: {
              country_code: "55",
              area_code: "11",
              number: "987654321",
            },
          },
        };
      }

      console.log("[Pagar.me] Creating PIX charge with payload:", {
        amount,
        description,
        customer: payload.customer?.email || payload.customer_id,
      });

      const response = await this.client.post("/charges", payload);

      console.log("[Pagar.me] ✅ Charge created successfully");
      console.log("[Pagar.me] Response data:", JSON.stringify(response.data, null, 2));

      const transaction = response.data.last_transaction;
      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        pix_qr_code: transaction?.qr_code_url || transaction?.qr_code,
        pix_copy_and_paste: transaction?.qr_code_text || transaction?.copy_and_paste,
        pix_expires_at: transaction?.pix_qr_code_expires_at || transaction?.expires_at,
      };
    } catch (error: any) {
      console.error("\n========== PAGAR.ME ERROR DETAILS ==========");
      console.error("[Pagar.me] Error object type:", error.constructor.name);
      console.error("[Pagar.me] Error message:", error.message);
      
      if (error.response) {
        console.error("[Pagar.me] HTTP Status:", error.response.status);
        console.error("[Pagar.me] Status Text:", error.response.statusText);
        console.error("[Pagar.me] Response Headers:", JSON.stringify(error.response.headers, null, 2));
        console.error("[Pagar.me] Response Data (FULL):", JSON.stringify(error.response.data, null, 2));
        console.error("[Pagar.me] Request URL:", error.response.config?.url);
        console.error("[Pagar.me] Request Method:", error.response.config?.method);
        console.error("[Pagar.me] Request Data:", error.response.config?.data);
        console.error("[Pagar.me] Request Headers:", {
          Authorization: error.response.config?.headers?.Authorization ? 
            `Basic (length: ${error.response.config.headers.Authorization.length})` : "Missing",
          "Content-Type": error.response.config?.headers?.["Content-Type"],
        });
      } else if (error.request) {
        console.error("[Pagar.me] No response received from server");
        console.error("[Pagar.me] Request details:", error.request);
      } else {
        console.error("[Pagar.me] Error setting up request:", error.message);
      }
      console.error("============================================\n");
      
      // Provide helpful error messages for common issues
      if (error.response?.status === 401 || error.response?.data?.message?.includes("Authorization")) {
        const errorDetails = error.response?.data?.errors || error.response?.data || {};
        console.error("[Pagar.me] Authorization Error Details:", JSON.stringify(errorDetails, null, 2));
        throw new Error(
          `Falha ao gerar QR Code Pix: Credenciais Pagar.me inválidas. Status: ${error.response?.status}. Detalhes: ${JSON.stringify(errorDetails)}`
        );
      }
      
      throw new Error(
        `Falha ao gerar QR Code Pix: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Get charge status
   */
  async getChargeStatus(chargeId: string): Promise<PagarmeCharge> {
    try {
      const response = await this.client.get(`/charges/${chargeId}`);
      const transaction = response.data.last_transaction;

      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        pix_qr_code: transaction?.qr_code_url || transaction?.qr_code,
        pix_copy_and_paste: transaction?.qr_code_text || transaction?.copy_and_paste,
        pix_expires_at: transaction?.pix_qr_code_expires_at || transaction?.expires_at,
      };
    } catch (error: any) {
      console.error("[Pagar.me] Error getting charge status:", error.response?.data || error.message);
      throw new Error("Falha ao obter status do pagamento");
    }
  }

  /**
   * Refund a charge
   */
  async refundCharge(chargeId: string, amount?: number): Promise<{ id: string; status: string }> {
    try {
      const payload: any = {};
      if (amount) {
        payload.amount = amount;
      }

      const response = await this.client.post(`/charges/${chargeId}/refunds`, payload);

      return {
        id: response.data.id,
        status: response.data.status,
      };
    } catch (error: any) {
      console.error("[Pagar.me] Error refunding charge:", error.response?.data || error.message);
      throw new Error("Falha ao processar reembolso");
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(body: string, signatureHeader?: string | null): boolean {
    // Skip validation if no secret configured (local development convenience)
    if (!this.webhookSecret) {
      return true;
    }

    if (!signatureHeader) {
      console.warn("[Pagar.me] Missing webhook signature header");
      return false;
    }

    const sanitizedHeader = signatureHeader.trim();
    const [scheme, signature] = sanitizedHeader.split("=");
    if (!scheme || !signature) {
      console.warn("[Pagar.me] Invalid webhook signature format");
      return false;
    }

    const algorithm = scheme.toLowerCase();
    if (!["sha1", "sha256", "sha512"].includes(algorithm)) {
      console.warn(`[Pagar.me] Unsupported signature algorithm: ${scheme}`);
      return false;
    }

    const expected = crypto
      .createHmac(algorithm, this.webhookSecret)
      .update(body, "utf8")
      .digest("hex");

    let signatureBuffer: Buffer;
    let expectedBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(signature, "hex");
      expectedBuffer = Buffer.from(expected, "hex");
    } catch (error) {
      console.warn("[Pagar.me] Unable to parse webhook signature", error);
      return false;
    }

    if (signatureBuffer.length !== expectedBuffer.length) {
      console.warn("[Pagar.me] Signature length mismatch");
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }
}

export const pagarmeService = new PagarmeService();
