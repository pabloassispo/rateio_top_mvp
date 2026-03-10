export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
  isDevMode: process.env.VITE_DEV_MODE === "true",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // SSL/HTTPS Configuration (optional, for production with mTLS webhooks)
  enableHttps: process.env.ENABLE_HTTPS === "true",
  sslCertPath: process.env.SSL_CERT_PATH ?? "",
  sslKeyPath: process.env.SSL_KEY_PATH ?? "",
  efiWebhookCaPath: process.env.EFI_WEBHOOK_CA_PATH ?? "",
  // Efí Pay (antigo Gerencianet) credentials
  efiClientId: process.env.EFI_CLIENT_ID ?? "",
  efiClientSecret: process.env.EFI_CLIENT_SECRET ?? "",
  efiCertificatePath: process.env.EFI_CERTIFICATE_PATH ?? "",
  efiCertificatePassphrase: process.env.EFI_CERTIFICATE_PASSPHRASE ?? "",
  efiSandbox: process.env.EFI_SANDBOX === "true",
  efiPixKey: process.env.EFI_PIX_KEY ?? "", // Chave Pix da conta Efí para receber pagamentos
  // Legacy Pagar.me (deprecated)
  pagarmeApiKey: process.env.PAGARME_API_KEY ?? "",
  pagarmeAccountId: process.env.PAGARME_ACCOUNT_ID ?? "",
  pagarmeWebhookSecret: process.env.PAGARME_WEBHOOK_SECRET ?? "",
  pagarmeWebhookUrl: process.env.PAGARME_WEBHOOK_URL ?? "",
};

// Debug logging for Efí Pay env vars
if (process.env.NODE_ENV === "development") {
  console.log("\n========== ENV LOADER DEBUG ==========");
  console.log("[ENV] EFI_CLIENT_ID:", process.env.EFI_CLIENT_ID ? 
    `${process.env.EFI_CLIENT_ID.substring(0, 20)}... (${process.env.EFI_CLIENT_ID.length} chars)` : 
    "UNDEFINED");
  console.log("[ENV] EFI_CLIENT_SECRET:", process.env.EFI_CLIENT_SECRET ? 
    `${process.env.EFI_CLIENT_SECRET.substring(0, 20)}... (${process.env.EFI_CLIENT_SECRET.length} chars)` : 
    "UNDEFINED");
  console.log("[ENV] EFI_CERTIFICATE_PATH:", process.env.EFI_CERTIFICATE_PATH || "UNDEFINED");
  console.log("[ENV] EFI_CERTIFICATE_PASSPHRASE:", process.env.EFI_CERTIFICATE_PASSPHRASE ? "(set)" : "(not set)");
  console.log("[ENV] EFI_SANDBOX:", process.env.EFI_SANDBOX || "UNDEFINED");
  console.log("[ENV] EFI_PIX_KEY:", process.env.EFI_PIX_KEY ? 
    `${process.env.EFI_PIX_KEY.substring(0, 20)}...` : 
    "UNDEFINED");
  console.log("======================================\n");
}
