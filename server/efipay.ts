import https from "https";
import fs from "fs";
import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import tls from "tls";
import { ENV } from "./_core/env";

// ============= INTERFACES =============

interface EfiPixCharge {
  txid: string;
  status: "ATIVA" | "CONCLUIDA" | "REMOVIDA_PELO_USUARIO_RECEBEDOR" | "REMOVIDA_PELO_PSP";
  valor: {
    original: string;
  };
  chave: string;
  location?: string;
  pixCopiaECola?: string;
  qrCode?: string;
}

interface EfiChargeResponse {
  txid: string;
  status: string;
  valor: { original: string };
  chave: string;
  location?: string;
  loc?: { id: number; location: string; tipoCob: string };
  pixCopiaECola?: string;
  calendario?: { criacao: string; expiracao: number };
}

interface EfiPixSendResponse {
  idEnvio: string;
  e2eId: string;
  valor: string;
  horario: { solicitacao: string };
  status: string;
}

interface EfiDevolutionResponse {
  id: string;
  rtrId: string;
  valor: string;
  horario: { solicitacao: string };
  status: string;
}

export interface EfiChargeResult {
  txid: string;
  status: "pending" | "paid" | "failed" | "refunded" | "canceled";
  amount: number;
  pixKey: string;
  qrCode?: string;
  pixCopiaECola?: string;
  expiresAt?: string;
}

// ============= EFÍ PAY SERVICE =============

class EfiPayService {
  private client: AxiosInstance | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private clientId: string;
  private clientSecret: string;
  private certificatePath: string;
  private isSandbox: boolean;
  private pixKey: string;
  private httpsAgent: https.Agent | undefined;

  constructor() {
    this.clientId = ENV.efiClientId || "";
    this.clientSecret = ENV.efiClientSecret || "";
    this.certificatePath = ENV.efiCertificatePath || "";
    this.isSandbox = ENV.efiSandbox;
    this.pixKey = ENV.efiPixKey || "";

    const oauthUrl = this.isSandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br";
    const apiUrl = this.isSandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br";

    this.httpsAgent = this.buildHttpsAgent();

    console.log("\n========== EFÍ PAY INITIALIZATION ==========");
    console.log("[Efí Pay] Client ID:", this.clientId ? `${this.clientId.substring(0, 20)}...` : "MISSING");
    console.log("[Efí Pay] Client Secret:", this.clientSecret ? `${this.clientSecret.substring(0, 20)}...` : "MISSING");
    console.log("[Efí Pay] Certificate Path:", this.certificatePath || "MISSING");
    console.log("[Efí Pay] Certificate Loaded:", !!this.httpsAgent);
    console.log("[Efí Pay] Sandbox Mode:", this.isSandbox);
    console.log("[Efí Pay] OAuth URL:", oauthUrl);
    console.log("[Efí Pay] API URL:", apiUrl);
    console.log("[Efí Pay] Pix Key:", this.pixKey ? `${this.pixKey.substring(0, 20)}...` : "MISSING");

    if (!this.clientId || !this.clientSecret) {
      console.warn("[Efí Pay] ⚠️  Missing API credentials. Set EFI_CLIENT_ID and EFI_CLIENT_SECRET");
    }

    if (!this.certificatePath) {
      console.warn("[Efí Pay] ⚠️  Missing certificate path. Set EFI_CERTIFICATE_PATH");
    } else if (!this.httpsAgent) {
      console.warn(
        "[Efí Pay] ⚠️  Certificate not loaded. mTLS requests will likely fail. Check path/passphrase/file permissions."
      );
    }

    if (!this.pixKey) {
      console.warn("[Efí Pay] ⚠️  Missing Pix key for receiving payments. Set EFI_PIX_KEY");
    }

    console.log("=============================================\n");
  }

  /**
   * Get the base URL for API requests
   */
  private getBaseUrl(): string {
    return this.isSandbox
      ? "https://pix-h.api.efipay.com.br"
      : "https://pix.api.efipay.com.br";
  }

  /**
   * Get the OAuth base URL
   * According to official docs: https://dev.efipay.com.br/docs/api-pix/credenciais/
   */
  private getOAuthBaseUrl(): string {
    return this.isSandbox
      ? "https://pix-h.api.efipay.com.br"
      : "https://pix.api.efipay.com.br";
  }

  /**
   * Create HTTPS agent with mTLS certificate
   */
  private buildHttpsAgent(): https.Agent | undefined {
    if (!this.certificatePath) {
      console.warn("[Efí Pay] No certificate configured, requests may fail");
      return undefined;
    }

    try {
      // Check if certificate file exists
      if (!fs.existsSync(this.certificatePath)) {
        console.error(`[Efí Pay] Certificate file not found: ${this.certificatePath}`);
        return undefined;
      }

      const cert = fs.readFileSync(this.certificatePath);

      // Validate that we can create a secure context with this PFX (and optional passphrase)
      // This catches common issues early (wrong passphrase, corrupted file, etc).
      tls.createSecureContext({
        pfx: cert,
        passphrase: ENV.efiCertificatePassphrase || "",
      });

      console.log("[Efí Pay] ✅ Certificate loaded and validated (SecureContext OK)");
      console.log("[Efí Pay] Certificate file size:", cert.length, "bytes");

      return new https.Agent({
        pfx: cert,
        passphrase: ENV.efiCertificatePassphrase || "", // Some .p12 files are password-protected
      });
    } catch (error: any) {
      console.error("[Efí Pay] Error loading certificate:", error.message);
      return undefined;
    }
  }

  private getHttpsAgent(): https.Agent | undefined {
    return this.httpsAgent;
  }

  /**
   * Get OAuth2 access token
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const httpsAgent = this.getHttpsAgent();
    const oauthUrl = `${this.getOAuthBaseUrl()}/oauth/token`;

    console.log("[Efí Pay] Requesting OAuth token...");
    console.log("[Efí Pay] OAuth URL:", oauthUrl);
    console.log("[Efí Pay] Client ID:", this.clientId.substring(0, 20) + "...");
    console.log("[Efí Pay] Has Certificate:", !!httpsAgent);

    try {
      const response = await axios.post(
        oauthUrl,
        JSON.stringify({ grant_type: "client_credentials" }),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
          httpsAgent,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

      console.log("[Efí Pay] ✅ OAuth token obtained successfully");
      console.log("[Efí Pay] Token expires in:", response.data.expires_in, "seconds");
      console.log("[Efí Pay] Token scopes:", response.data.scope);

      return this.accessToken!;
    } catch (error: any) {
      console.error("[Efí Pay] ❌ Error obtaining OAuth token");
      console.error("[Efí Pay] Status:", error.response?.status);
      console.error("[Efí Pay] Response:", error.response?.data);
      console.error("[Efí Pay] Message:", error.message);
      
      if (error.response?.data?.error === 'invalid_client') {
        throw new Error(
          "Credenciais inválidas. Verifique se:\n" +
          "1. Removeu os prefixos 'Client_Id_' e 'Client_Secret_' do .env\n" +
          "2. A aplicação tem a API Pix habilitada (não Open Finance)\n" +
          "3. Os escopos da API Pix estão ativos na aplicação\n" +
          "4. O certificado corresponde à mesma aplicação das credenciais"
        );
      }
      
      throw new Error(`Falha ao autenticar com Efí Pay: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Make authenticated request to Efí Pay API
   */
  private async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
    data?: any
  ): Promise<T> {
    const token = await this.getAccessToken();
    const httpsAgent = this.getHttpsAgent();

    try {
      const response = await axios({
        method,
        url: `${this.getBaseUrl()}${endpoint}`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data,
        httpsAgent,
      });

      return response.data;
    } catch (error: any) {
      console.error(`[Efí Pay] API Error (${method} ${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate a unique txid for Pix charges
   * Efí Pay requires: 26-35 alphanumeric characters (pattern: ^[a-zA-Z0-9]{26,35}$)
   */
  private generateTxid(): string {
    // Generate enough random bytes to ensure we have at least 26 chars
    const timestamp = Date.now().toString(36); // ~8-9 chars
    const random = crypto.randomBytes(12).toString("hex"); // 24 chars
    const combined = `${timestamp}${random}`; // ~32-33 chars
    
    // Ensure we're within 26-35 range
    if (combined.length < 26) {
      // Add more random chars if needed
      const extra = crypto.randomBytes(2).toString("hex");
      return (combined + extra).substring(0, 35);
    }
    
    return combined.substring(0, 35);
  }

  /**
   * Create a Pix charge (cobrança imediata)
   * @param amount Amount in cents (e.g., 10000 for R$ 100.00)
   * @param description Description for the charge
   * @param expirationSeconds Expiration time in seconds (default: 900 = 15 minutes)
   */
  async createPixCharge(
    amount: number,
    description: string,
    expirationSeconds: number = 900
  ): Promise<EfiChargeResult> {
    const txid = this.generateTxid();
    const amountInReais = (amount / 100).toFixed(2);

    // Validate txid format (Efí Pay requirement: 26-35 alphanumeric chars)
    if (txid.length < 26 || txid.length > 35 || !/^[a-zA-Z0-9]+$/.test(txid)) {
      throw new Error(
        `Invalid txid generated: "${txid}" (length: ${txid.length}). Must be 26-35 alphanumeric characters.`
      );
    }

    try {
      const payload = {
        calendario: {
          expiracao: expirationSeconds,
        },
        valor: {
          original: amountInReais,
        },
        chave: this.pixKey, // Using the configured Pix key for receiving
        solicitacaoPagador: description,
      };

      console.log("[Efí Pay] Creating Pix charge:", { 
        txid, 
        txidLength: txid.length,
        amount: amountInReais, 
        description 
      });

      // Create charge with txid
      const response = await this.makeRequest<EfiChargeResponse>(
        "PUT",
        `/v2/cob/${txid}`,
        payload
      );

      console.log("[Efí Pay] ✅ Charge created:", response.txid);

      // Get QR Code
      const locId = response.loc?.id;
      let qrCode: string | undefined;
      let pixCopiaECola: string | undefined;

      if (locId) {
        try {
          const qrResponse = await this.makeRequest<{ imagemQrcode: string; qrcode: string }>(
            "GET",
            `/v2/loc/${locId}/qrcode`
          );
          qrCode = qrResponse.imagemQrcode;
          pixCopiaECola = qrResponse.qrcode;
        } catch (qrError) {
          console.warn("[Efí Pay] Could not get QR Code:", qrError);
          pixCopiaECola = response.pixCopiaECola;
        }
      } else {
        pixCopiaECola = response.pixCopiaECola;
      }

      return {
        txid: response.txid,
        status: this.mapEfiStatus(response.status),
        amount: amount,
        pixKey: this.pixKey,
        qrCode,
        pixCopiaECola,
        expiresAt: response.calendario?.criacao
          ? new Date(
              new Date(response.calendario.criacao).getTime() +
                (response.calendario.expiracao || expirationSeconds) * 1000
            ).toISOString()
          : undefined,
      };
    } catch (error: any) {
      console.error("[Efí Pay] Error creating charge:", error.response?.data || error.message);
      throw new Error(
        `Falha ao criar cobrança Pix: ${error.response?.data?.mensagem || error.message}`
      );
    }
  }

  /**
   * Get charge status by txid
   */
  async getChargeStatus(txid: string): Promise<EfiChargeResult> {
    try {
      const response = await this.makeRequest<EfiChargeResponse>("GET", `/v2/cob/${txid}`);

      return {
        txid: response.txid,
        status: this.mapEfiStatus(response.status),
        amount: Math.round(parseFloat(response.valor.original) * 100),
        pixKey: response.chave,
        pixCopiaECola: response.pixCopiaECola,
      };
    } catch (error: any) {
      console.error("[Efí Pay] Error getting charge status:", error.response?.data || error.message);
      throw new Error("Falha ao obter status da cobrança");
    }
  }

  /**
   * Send Pix to a third party (e.g., rateio creator)
   * This is the key feature that Pagar.me doesn't support!
   * 
   * Endpoint: PUT /v3/gn/pix/:idEnvio
   * Documentation: https://dev.efipay.com.br/docs/api-pix/envio-pagamento-pix/
   * 
   * @param pixKey The recipient's Pix key
   * @param amount Amount in cents
   * @param description Description for the transfer (infoPagador)
   */
  async sendPix(
    pixKey: string,
    amount: number,
    description: string
  ): Promise<EfiPixSendResponse> {
    const amountInReais = (amount / 100).toFixed(2);
    const idEnvio = this.generateTxid();

    try {
      const payload = {
        valor: amountInReais,
        pagador: {
          chave: this.pixKey, // Our Pix key (sender)
          infoPagador: description, // Moved description here as per docs
        },
        favorecido: {
          chave: pixKey, // Recipient's Pix key
        },
      };

      console.log("[Efí Pay] Sending Pix:", {
        idEnvio,
        from: this.pixKey.substring(0, 10) + "...",
        to: pixKey.substring(0, 10) + "...",
        amount: amountInReais,
      });

      const response = await this.makeRequest<EfiPixSendResponse>(
        "PUT",
        `/v3/gn/pix/${idEnvio}`,
        payload
      );

      console.log("[Efí Pay] ✅ Pix sent successfully:", response.e2eId);

      return response;
    } catch (error: any) {
      console.error("[Efí Pay] Error sending Pix:", error.response?.data || error.message);
      throw new Error(
        `Falha ao enviar Pix: ${error.response?.data?.mensagem || error.message}`
      );
    }
  }

  /**
   * Pay a Pix QR Code via API
   * Useful for testing in homologation environment
   * 
   * @param pixCopiaECola The Pix copy-paste string (EMV code from QR Code)
   * @param payerPixKey The payer's Pix key (must have webhook configured)
   * @param description Description for the payment
   * @returns Payment response with idEnvio and e2eId
   */
  async payPixQRCode(
    pixCopiaECola: string,
    payerPixKey: string,
    description: string = "Pagamento de QR Code via API"
  ): Promise<EfiPixSendResponse> {
    const idEnvio = this.generateTxid();

    try {
      const payload = {
        pagador: {
          chave: payerPixKey,
          infoPagador: description,
        },
        pixCopiaECola,
      };

      console.log("[Efí Pay] Paying QR Code:", {
        idEnvio,
        payerKey: payerPixKey.substring(0, 20) + "...",
        qrCode: pixCopiaECola.substring(0, 40) + "...",
      });

      const response = await this.makeRequest<EfiPixSendResponse>(
        "PUT",
        `/v2/gn/pix/${idEnvio}/qrcode`,
        payload
      );

      console.log("[Efí Pay] ✅ QR Code paid successfully:", response.e2eId);

      return response;
    } catch (error: any) {
      console.error("[Efí Pay] Error paying QR Code:", error.response?.data || error.message);
      throw new Error(
        `Falha ao pagar QR Code: ${error.response?.data?.detail || error.message}`
      );
    }
  }

  /**
   * Request a refund (devolução) for a received Pix
   * 
   * @param e2eId The e2eId of the received Pix
   * @param amount Amount to refund in cents (optional, defaults to full amount)
   */
  async refundPix(e2eId: string, amount?: number): Promise<EfiDevolutionResponse> {
    const devolutionId = crypto.randomBytes(16).toString("hex").substring(0, 35);

    try {
      const payload: any = {};
      
      if (amount) {
        payload.valor = (amount / 100).toFixed(2);
      }

      console.log("[Efí Pay] Requesting refund:", { e2eId, amount });

      const response = await this.makeRequest<EfiDevolutionResponse>(
        "PUT",
        `/v2/pix/${e2eId}/devolucao/${devolutionId}`,
        payload
      );

      console.log("[Efí Pay] ✅ Refund processed:", response.rtrId);

      return response;
    } catch (error: any) {
      console.error("[Efí Pay] Error refunding:", error.response?.data || error.message);
      throw new Error(
        `Falha ao processar devolução: ${error.response?.data?.mensagem || error.message}`
      );
    }
  }

  /**
   * List received Pix transactions
   * @param startDate Start date (ISO string)
   * @param endDate End date (ISO string)
   */
  async listReceivedPix(
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    try {
      const response = await this.makeRequest<{ pix: any[] }>(
        "GET",
        `/v2/pix?inicio=${encodeURIComponent(startDate)}&fim=${encodeURIComponent(endDate)}`
      );

      return response.pix || [];
    } catch (error: any) {
      console.error("[Efí Pay] Error listing received Pix:", error.response?.data || error.message);
      throw new Error("Falha ao listar Pix recebidos");
    }
  }

  /**
   * Map Efí Pay status to standardized status
   */
  private mapEfiStatus(efiStatus: string): "pending" | "paid" | "failed" | "refunded" | "canceled" {
    switch (efiStatus) {
      case "ATIVA":
        return "pending";
      case "CONCLUIDA":
        return "paid";
      case "REMOVIDA_PELO_USUARIO_RECEBEDOR":
      case "REMOVIDA_PELO_PSP":
        return "canceled";
      default:
        return "pending";
    }
  }

  /**
   * Validate webhook signature from Efí Pay
   * Efí webhooks use mTLS for authentication, so we mainly verify the payload structure
   */
  validateWebhookSignature(body: string, signature?: string | null): boolean {
    // Efí Pay uses mTLS for webhook authentication
    // The webhook endpoint should only accept connections with valid certificates
    // For additional security, we can validate the payload structure
    
    try {
      const payload = JSON.parse(body);
      
      // Check for expected Efí webhook structure
      if (payload.pix && Array.isArray(payload.pix)) {
        return true;
      }
      
      // Check for charge update webhook
      if (payload.txid || payload.endToEndId) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ disponivel: string; bloqueado: string }> {
    try {
      const response = await this.makeRequest<any>("GET", "/v2/gn/saldo");
      return {
        disponivel: response.saldo || "0.00",
        bloqueado: response.bloqueado || "0.00",
      };
    } catch (error: any) {
      console.error("[Efí Pay] Error getting balance:", error.response?.data || error.message);
      throw new Error("Falha ao obter saldo");
    }
  }
}

export const efiPayService = new EfiPayService();
