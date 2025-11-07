import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Rateio (split/crowdfunding) table
 */
export const rateios = mysqlTable("rateios", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  creatorId: int("creatorId").notNull().references(() => users.id),
  name: varchar("name", { length: 60 }).notNull(),
  description: varchar("description", { length: 140 }),
  imageUrl: text("imageUrl"),
  totalAmount: int("totalAmount").notNull(), // in cents
  targetAmount: int("targetAmount"), // in cents, optional
  privacyMode: mysqlEnum("privacyMode", ["TOTAL", "PARCIAL", "ABERTO"]).default("PARCIAL").notNull(),
  status: mysqlEnum("status", ["ATIVO", "CONCLUIDO", "CANCELADO"]).default("ATIVO").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rateio = typeof rateios.$inferSelect;
export type InsertRateio = typeof rateios.$inferInsert;

/**
 * Participants in a rateio
 */
export const participants = mysqlTable("participants", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  rateioId: varchar("rateioId", { length: 36 }).notNull().references(() => rateios.id),
  userId: int("userId").references(() => users.id), // null if not registered yet
  pixKey: varchar("pixKey", { length: 255 }).notNull(), // EVP, CPF, CNPJ, email, phone
  pixKeyType: mysqlEnum("pixKeyType", ["EVP", "CPF", "CNPJ", "EMAIL", "TELEFONE"]).notNull(),
  autoRefund: boolean("autoRefund").default(false).notNull(),
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "REEMBOLSADO"]).default("PENDENTE").notNull(),
  paidAmount: int("paidAmount").default(0).notNull(), // in cents
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Participant = typeof participants.$inferSelect;
export type InsertParticipant = typeof participants.$inferInsert;

/**
 * Payment intents (Pagar.me)
 */
export const paymentIntents = mysqlTable("paymentIntents", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  participantId: varchar("participantId", { length: 36 }).notNull().references(() => participants.id),
  pagarmeIntentId: varchar("pagarmeIntentId", { length: 255 }).notNull().unique(),
  qrCode: text("qrCode"), // SVG or URL
  copyPaste: varchar("copyPaste", { length: 255 }), // "copia e cola" code
  status: mysqlEnum("status", ["CRIADO", "EXPIRADO", "PAGO"]).default("CRIADO").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PaymentIntent = typeof paymentIntents.$inferSelect;
export type InsertPaymentIntent = typeof paymentIntents.$inferInsert;

/**
 * Transactions (payment records)
 */
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  participantId: varchar("participantId", { length: 36 }).notNull().references(() => participants.id),
  rateioId: varchar("rateioId", { length: 36 }).notNull().references(() => rateios.id),
  pagarmeTransactionId: varchar("pagarmeTransactionId", { length: 255 }).notNull().unique(),
  amount: int("amount").notNull(), // in cents
  status: mysqlEnum("status", ["PENDENTE", "PAGO", "FALHOU", "REEMBOLSADO"]).default("PENDENTE").notNull(),
  paidAt: timestamp("paidAt"),
  refundedAt: timestamp("refundedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Event log for rateio history (respects privacy)
 */
export const rateioEvents = mysqlTable("rateioEvents", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  rateioId: varchar("rateioId", { length: 36 }).notNull().references(() => rateios.id),
  participantId: varchar("participantId", { length: 36 }).references(() => participants.id),
  eventType: mysqlEnum("eventType", ["CRIADO", "PARTICIPANTE_ADICIONADO", "PAGAMENTO_CONFIRMADO", "CONCLUIDO", "CANCELADO", "REEMBOLSO_SOLICITADO"]).notNull(),
  message: text("message"), // Friendly message respecting privacy
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RateioEvent = typeof rateioEvents.$inferSelect;
export type InsertRateioEvent = typeof rateioEvents.$inferInsert;
