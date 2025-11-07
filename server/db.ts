import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, rateios, participants, transactions, paymentIntents, rateioEvents } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============= RATEIO QUERIES =============

export async function createRateio(data: {
  id: string;
  creatorId: number;
  name: string;
  description?: string;
  imageUrl?: string;
  totalAmount: number;
  targetAmount?: number;
  privacyMode: "TOTAL" | "PARCIAL" | "ABERTO";
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(rateios).values(data);
  return result;
}

export async function getRateioById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(rateios).where(eq(rateios.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getRateiosByCreator(creatorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(rateios).where(eq(rateios.creatorId, creatorId));
}

export async function updateRateioStatus(id: string, status: "ATIVO" | "CONCLUIDO" | "CANCELADO") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(rateios).set({ status, updatedAt: new Date() }).where(eq(rateios.id, id));
}

// ============= PARTICIPANT QUERIES =============

export async function createParticipant(data: {
  id: string;
  rateioId: string;
  pixKey: string;
  pixKeyType: "EVP" | "CPF" | "CNPJ" | "EMAIL" | "TELEFONE";
  autoRefund?: boolean;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(participants).values({
    ...data,
    autoRefund: data.autoRefund ?? false,
  });
}

export async function getParticipantById(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(participants).where(eq(participants.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getParticipantsByRateio(rateioId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(participants).where(eq(participants.rateioId, rateioId));
}

export async function updateParticipantStatus(id: string, status: "PENDENTE" | "PAGO" | "REEMBOLSADO", paidAmount?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status, updatedAt: new Date() };
  if (paidAmount !== undefined) {
    updateData.paidAmount = paidAmount;
  }

  return await db.update(participants).set(updateData).where(eq(participants.id, id));
}

// ============= PAYMENT INTENT QUERIES =============

export async function createPaymentIntent(data: {
  id: string;
  participantId: string;
  pagarmeIntentId: string;
  qrCode?: string;
  copyPaste?: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(paymentIntents).values(data);
}

export async function getPaymentIntentByParticipant(participantId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(paymentIntents)
    .where(eq(paymentIntents.participantId, participantId))
    .orderBy(paymentIntents.createdAt)
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updatePaymentIntentStatus(id: string, status: "CRIADO" | "EXPIRADO" | "PAGO") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(paymentIntents).set({ status, updatedAt: new Date() }).where(eq(paymentIntents.id, id));
}

// ============= TRANSACTION QUERIES =============

export async function createTransaction(data: {
  id: string;
  participantId: string;
  rateioId: string;
  pagarmeTransactionId: string;
  amount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(transactions).values(data);
}

export async function getTransactionsByRateio(rateioId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(transactions).where(eq(transactions.rateioId, rateioId));
}

export async function updateTransactionStatus(id: string, status: "PENDENTE" | "PAGO" | "FALHOU" | "REEMBOLSADO", paidAt?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status, updatedAt: new Date() };
  if (paidAt) {
    updateData.paidAt = paidAt;
  }

  return await db.update(transactions).set(updateData).where(eq(transactions.id, id));
}

export async function calculateRateioProgress(rateioId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rateio = await getRateioById(rateioId);
  if (!rateio) return null;

  const txs = await getTransactionsByRateio(rateioId);
  const paidAmount = txs
    .filter(tx => tx.status === "PAGO")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const target = rateio.targetAmount || rateio.totalAmount;
  const progress = Math.min((paidAmount / target) * 100, 100);

  return {
    paidAmount,
    targetAmount: target,
    progress,
    isPaid: paidAmount >= target,
  };
}

// ============= RATEIO EVENT QUERIES =============

export async function createRateioEvent(data: {
  id: string;
  rateioId: string;
  participantId?: string;
  eventType: "CRIADO" | "PARTICIPANTE_ADICIONADO" | "PAGAMENTO_CONFIRMADO" | "CONCLUIDO" | "CANCELADO" | "REEMBOLSO_SOLICITADO";
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(rateioEvents).values(data);
}

export async function getRateioEventsByRateio(rateioId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(rateioEvents).where(eq(rateioEvents.rateioId, rateioId));
}

export async function getPaymentIntentByChargeId(chargeId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(paymentIntents).where(eq(paymentIntents.pagarmeIntentId, chargeId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
