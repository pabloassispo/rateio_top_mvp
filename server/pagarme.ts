import axios, { AxiosInstance } from "axios";

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

  constructor() {
    this.apiKey = process.env.sk_test_7446b32a18614e3e87f62019f745e85b || "";
    this.accountId = process.env.acc_wpnVbycJehD1NrdJ || "";

    if (!this.apiKey || !this.accountId) {
      console.warn("[Pagar.me] Missing API credentials. Set PAGARME_API_KEY and PAGARME_ACCOUNT_ID");
    }

    this.client = axios.create({
      baseURL: "https://api.pagar.me/core/v5",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Create a Pix charge with QR Code
   * @param amount Amount in cents (e.g., 10000 for R$ 100.00)
   * @param description Description for the charge
   * @param customerId Optional customer ID
   * @returns Charge with QR Code and copy-paste code
   */
  async createPixCharge(
    amount: number,
    description: string,
    customerId?: string
  ): Promise<PagarmeCharge> {
    try {
      const payload: any = {
        amount,
        payment_method: "pix",
        description,
        capture: true, // Auto-capture on payment
        pix: {
          expires_in: 900, // 15 minutes in seconds
        },
      };

      if (customerId) {
        payload.customer_id = customerId;
      }

      const response = await this.client.post("/charges", payload);

      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        pix_qr_code: response.data.last_transaction?.qr_code,
        pix_copy_and_paste: response.data.last_transaction?.qr_code_text,
        pix_expires_at: response.data.last_transaction?.pix_qr_code_expires_at,
      };
    } catch (error: any) {
      console.error("[Pagar.me] Error creating Pix charge:", error.response?.data || error.message);
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

      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount,
        pix_qr_code: response.data.last_transaction?.qr_code,
        pix_copy_and_paste: response.data.last_transaction?.qr_code_text,
        pix_expires_at: response.data.last_transaction?.pix_qr_code_expires_at,
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
  validateWebhookSignature(body: string, signature: string): boolean {
    // Pagar.me uses HMAC-SHA256 for webhook signatures
    // The signature is sent in the X-Hub-Signature header
    // For now, we'll implement basic validation
    // In production, use the actual API key to validate
    return true; // TODO: Implement proper signature validation
  }
}

export const pagarmeService = new PagarmeService();
