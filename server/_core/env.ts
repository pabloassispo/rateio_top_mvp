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
  pagarmeApiKey: process.env.PAGARME_API_KEY ?? "",
  pagarmeAccountId: process.env.PAGARME_ACCOUNT_ID ?? "",
  pagarmeWebhookSecret: process.env.PAGARME_WEBHOOK_SECRET ?? "",
  pagarmeWebhookUrl: process.env.PAGARME_WEBHOOK_URL ?? "",
};

// Debug logging for Pagar.me env vars
if (process.env.NODE_ENV === "development") {
  console.log("\n========== ENV LOADER DEBUG ==========");
  console.log("[ENV] process.env.PAGARME_API_KEY:", process.env.PAGARME_API_KEY ? 
    `${process.env.PAGARME_API_KEY.substring(0, 20)}... (${process.env.PAGARME_API_KEY.length} chars)` : 
    "UNDEFINED");
  console.log("[ENV] process.env.PAGARME_ACCOUNT_ID:", process.env.PAGARME_ACCOUNT_ID ? 
    `${process.env.PAGARME_ACCOUNT_ID.substring(0, 20)}... (${process.env.PAGARME_ACCOUNT_ID.length} chars)` : 
    "UNDEFINED");
  console.log("[ENV] ENV.pagarmeApiKey:", ENV.pagarmeApiKey ? 
    `${ENV.pagarmeApiKey.substring(0, 20)}... (${ENV.pagarmeApiKey.length} chars)` : 
    "EMPTY STRING");
  console.log("[ENV] ENV.pagarmeAccountId:", ENV.pagarmeAccountId ? 
    `${ENV.pagarmeAccountId.substring(0, 20)}... (${ENV.pagarmeAccountId.length} chars)` : 
    "EMPTY STRING");
  console.log("======================================\n");
}
